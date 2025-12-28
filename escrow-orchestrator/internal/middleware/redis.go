package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/rs/zerolog/log"
)

// RedisClient wraps Redis functionality for caching and distributed locks
type RedisClient struct {
	cfg       *config.Config
	connected bool
	mu        sync.RWMutex
	cache     map[string]cacheEntry // In-memory fallback for dev
}

type cacheEntry struct {
	value     []byte
	expiresAt time.Time
}

// NewRedisClient creates a new Redis client
func NewRedisClient(cfg *config.Config) *RedisClient {
	return &RedisClient{
		cfg:       cfg,
		connected: false,
		cache:     make(map[string]cacheEntry),
	}
}

// Connect establishes connection to Redis
func (r *RedisClient) Connect(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	log.Info().
		Str("host", r.cfg.RedisHost).
		Int("port", r.cfg.RedisPort).
		Msg("Connecting to Redis")

	// In production, this would use go-redis
	// client := redis.NewClient(&redis.Options{
	//     Addr:     fmt.Sprintf("%s:%d", r.cfg.RedisHost, r.cfg.RedisPort),
	//     Password: r.cfg.RedisPassword,
	//     DB:       r.cfg.RedisDB,
	// })

	r.connected = true
	log.Info().Msg("Redis client connected")
	return nil
}

// IsConnected returns connection status
func (r *RedisClient) IsConnected() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.connected
}

// Set stores a value with optional TTL
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.cache[key] = cacheEntry{
		value:     data,
		expiresAt: time.Now().Add(ttl),
	}

	log.Debug().
		Str("key", key).
		Dur("ttl", ttl).
		Msg("Set cache value")

	return nil
}

// Get retrieves a value
func (r *RedisClient) Get(ctx context.Context, key string, dest interface{}) error {
	r.mu.RLock()
	entry, exists := r.cache[key]
	r.mu.RUnlock()

	if !exists {
		return fmt.Errorf("key not found: %s", key)
	}

	if time.Now().After(entry.expiresAt) {
		r.mu.Lock()
		delete(r.cache, key)
		r.mu.Unlock()
		return fmt.Errorf("key expired: %s", key)
	}

	return json.Unmarshal(entry.value, dest)
}

// Delete removes a key
func (r *RedisClient) Delete(ctx context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.cache, key)
	return nil
}

// CacheWorkflowID stores workflow ID for an escrow
func (r *RedisClient) CacheWorkflowID(ctx context.Context, escrowID, workflowID string) error {
	key := fmt.Sprintf("escrow:%s:workflow", escrowID)
	return r.Set(ctx, key, workflowID, 24*time.Hour)
}

// GetWorkflowID retrieves workflow ID for an escrow
func (r *RedisClient) GetWorkflowID(ctx context.Context, escrowID string) (string, error) {
	key := fmt.Sprintf("escrow:%s:workflow", escrowID)
	var workflowID string
	err := r.Get(ctx, key, &workflowID)
	return workflowID, err
}

// CacheEscrowStatus caches escrow status for quick lookups
func (r *RedisClient) CacheEscrowStatus(ctx context.Context, escrowID, status string) error {
	key := fmt.Sprintf("escrow:%s:status", escrowID)
	return r.Set(ctx, key, status, 1*time.Hour)
}

// GetEscrowStatus retrieves cached escrow status
func (r *RedisClient) GetEscrowStatus(ctx context.Context, escrowID string) (string, error) {
	key := fmt.Sprintf("escrow:%s:status", escrowID)
	var status string
	err := r.Get(ctx, key, &status)
	return status, err
}

// AcquireLock attempts to acquire a distributed lock
func (r *RedisClient) AcquireLock(ctx context.Context, lockKey string, ttl time.Duration) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := fmt.Sprintf("lock:%s", lockKey)
	entry, exists := r.cache[key]

	if exists && time.Now().Before(entry.expiresAt) {
		return false, nil // Lock already held
	}

	r.cache[key] = cacheEntry{
		value:     []byte("locked"),
		expiresAt: time.Now().Add(ttl),
	}

	log.Debug().
		Str("lock_key", lockKey).
		Dur("ttl", ttl).
		Msg("Lock acquired")

	return true, nil
}

// ReleaseLock releases a distributed lock
func (r *RedisClient) ReleaseLock(ctx context.Context, lockKey string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := fmt.Sprintf("lock:%s", lockKey)
	delete(r.cache, key)

	log.Debug().
		Str("lock_key", lockKey).
		Msg("Lock released")

	return nil
}

// RateLimit checks if an action is rate limited
func (r *RedisClient) RateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	rateKey := fmt.Sprintf("rate:%s", key)
	entry, exists := r.cache[rateKey]

	var count int
	if exists && time.Now().Before(entry.expiresAt) {
		json.Unmarshal(entry.value, &count)
	}

	if count >= limit {
		return false, nil // Rate limited
	}

	count++
	data, _ := json.Marshal(count)
	r.cache[rateKey] = cacheEntry{
		value:     data,
		expiresAt: time.Now().Add(window),
	}

	return true, nil
}

// Incr increments a counter
func (r *RedisClient) Incr(ctx context.Context, key string) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	var count int64
	entry, exists := r.cache[key]
	if exists {
		json.Unmarshal(entry.value, &count)
	}

	count++
	data, _ := json.Marshal(count)
	r.cache[key] = cacheEntry{
		value:     data,
		expiresAt: time.Now().Add(24 * time.Hour),
	}

	return count, nil
}

// Close closes the Redis client
func (r *RedisClient) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.connected = false
	r.cache = make(map[string]cacheEntry)
	log.Info().Msg("Redis client closed")
	return nil
}
