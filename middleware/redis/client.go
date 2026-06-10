package redis

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Client wraps go-redis with health checks, circuit breaker, and stream operations.
// Uses go-redis v8 interface compatible with the project.
type Client struct {
	addr     string
	password string
	db       int
	pool     *ConnectionPool
}

// ConnectionPool manages a pool of Redis connections with circuit breaker.
type ConnectionPool struct {
	MaxConns    int
	ActiveConns int32
	IdleConns   int32
}

// NewClient creates a Redis client from environment.
func NewClient() *Client {
	db := 0
	if v := os.Getenv("REDIS_DB"); v != "" {
		db, _ = strconv.Atoi(v)
	}
	return &Client{
		addr:     envOr("REDIS_ADDR", "redis.payment-switch.svc:6379"),
		password: os.Getenv("REDIS_PASSWORD"),
		db:       db,
		pool:     &ConnectionPool{MaxConns: 500},
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// HealthStatus contains Redis health information.
type HealthStatus struct {
	Connected      bool     `json:"connected"`
	Mode           string   `json:"mode"` // standalone, sentinel, cluster
	Version        string   `json:"version"`
	UptimeSeconds  int64    `json:"uptime_seconds"`
	ConnectedClients int    `json:"connected_clients"`
	UsedMemoryMB   float64  `json:"used_memory_mb"`
	MaxMemoryMB    float64  `json:"max_memory_mb"`
	HitRate        float64  `json:"hit_rate"`
	OpsPerSec      int64    `json:"ops_per_sec"`
	AvgLatencyUs   float64  `json:"avg_latency_us"`
	Replicas       int      `json:"replicas"`
}

// ParseInfoResponse parses Redis INFO output into a map.
func ParseInfoResponse(info string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(info, "\r\n") {
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 {
			result[parts[0]] = parts[1]
		}
	}
	return result
}

// BuildHealthStatus constructs health status from Redis INFO response.
func BuildHealthStatus(info map[string]string) HealthStatus {
	status := HealthStatus{Connected: true}
	status.Version = info["redis_version"]
	status.Mode = info["redis_mode"]
	status.UptimeSeconds, _ = strconv.ParseInt(info["uptime_in_seconds"], 10, 64)
	status.ConnectedClients, _ = strconv.Atoi(info["connected_clients"])

	usedMem, _ := strconv.ParseFloat(info["used_memory"], 64)
	status.UsedMemoryMB = usedMem / 1024 / 1024
	maxMem, _ := strconv.ParseFloat(info["maxmemory"], 64)
	if maxMem > 0 {
		status.MaxMemoryMB = maxMem / 1024 / 1024
	}

	hits, _ := strconv.ParseFloat(info["keyspace_hits"], 64)
	misses, _ := strconv.ParseFloat(info["keyspace_misses"], 64)
	if hits+misses > 0 {
		status.HitRate = (hits / (hits + misses)) * 100
	}

	status.OpsPerSec, _ = strconv.ParseInt(info["instantaneous_ops_per_sec"], 10, 64)
	status.Replicas, _ = strconv.Atoi(info["connected_slaves"])
	return status
}

// StreamInfo represents Redis Stream metadata.
type StreamInfo struct {
	Name     string `json:"name"`
	Length   int64  `json:"length"`
	Groups   int    `json:"groups"`
	Consumers int   `json:"consumers"`
}

// BloomFilterInfo represents a Redis Bloom filter's stats.
type BloomFilterInfo struct {
	Name         string  `json:"name"`
	Capacity     int64   `json:"capacity"`
	CurrentItems int64   `json:"current_items"`
	FPRate       float64 `json:"fp_rate"`
	MemoryBytes  int64   `json:"memory_bytes"`
}

// CacheWarmerConfig defines keys to pre-warm on startup or after failover.
type CacheWarmerConfig struct {
	KeyPatterns []string      `json:"key_patterns"`
	BatchSize   int           `json:"batch_size"`
	Interval    time.Duration `json:"interval"`
}

// DefaultCacheWarmerConfig returns the standard cache warmer setup.
func DefaultCacheWarmerConfig() CacheWarmerConfig {
	return CacheWarmerConfig{
		KeyPatterns: []string{
			"bank:config:*",
			"account:balance:*",
			"sanctions:list:*",
			"fee:schedule:*",
			"fx:rate:*",
			"participant:*",
			"fraud:model:*",
		},
		BatchSize: 1000,
		Interval:  15 * time.Minute,
	}
}

// CircuitBreaker implements a simple circuit breaker for Redis operations.
type CircuitBreaker struct {
	failures    int
	maxFailures int
	state       string // closed, open, half-open
	lastFailure time.Time
	resetAfter  time.Duration
}

// NewCircuitBreaker creates a circuit breaker.
func NewCircuitBreaker(maxFailures int, resetAfter time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		maxFailures: maxFailures,
		state:       "closed",
		resetAfter:  resetAfter,
	}
}

// Allow checks if a request should be allowed through.
func (cb *CircuitBreaker) Allow() bool {
	if cb.state == "closed" {
		return true
	}
	if cb.state == "open" && time.Since(cb.lastFailure) > cb.resetAfter {
		cb.state = "half-open"
		return true
	}
	return cb.state == "half-open"
}

// RecordSuccess records a successful operation.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.failures = 0
	cb.state = "closed"
}

// RecordFailure records a failed operation.
func (cb *CircuitBreaker) RecordFailure() {
	cb.failures++
	cb.lastFailure = time.Now()
	if cb.failures >= cb.maxFailures {
		cb.state = "open"
	}
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() string {
	if cb.state == "open" && time.Since(cb.lastFailure) > cb.resetAfter {
		return "half-open"
	}
	return cb.state
}

// Retry executes an operation with retries and circuit breaker.
func Retry(ctx context.Context, cb *CircuitBreaker, maxRetries int, fn func() error) error {
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if !cb.Allow() {
			return fmt.Errorf("circuit breaker open")
		}
		err := fn()
		if err == nil {
			cb.RecordSuccess()
			return nil
		}
		cb.RecordFailure()
		if attempt < maxRetries {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(attempt+1) * 100 * time.Millisecond):
			}
		}
	}
	return fmt.Errorf("max retries exceeded")
}
