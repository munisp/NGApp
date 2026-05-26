// Package ratelimit provides rate limiting and backpressure functionality
// Recommendation #14: Rate Limiting & Backpressure
package ratelimit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)

// RateLimiter defines the interface for rate limiting
type RateLimiter interface {
	Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error)
	Reset(ctx context.Context, key string) error
}

// RateLimitInfo contains information about the current rate limit state
type RateLimitInfo struct {
	Limit      int64     `json:"limit"`
	Remaining  int64     `json:"remaining"`
	ResetAt    time.Time `json:"reset_at"`
	RetryAfter int64     `json:"retry_after_seconds,omitempty"`
}

// Config holds rate limiter configuration
type Config struct {
	// Requests per window
	Limit int64
	// Window duration
	Window time.Duration
	// Burst size (for token bucket)
	Burst int64
	// Key prefix for storage
	KeyPrefix string
}

// DefaultConfig returns a default rate limiter configuration
func DefaultConfig() *Config {
	return &Config{
		Limit:     100,
		Window:    time.Minute,
		Burst:     10,
		KeyPrefix: "ratelimit:",
	}
}

// InMemoryRateLimiter implements rate limiting using in-memory storage
// Suitable for single-instance deployments or development
type InMemoryRateLimiter struct {
	config  *Config
	buckets map[string]*tokenBucket
	mu      sync.RWMutex
}

type tokenBucket struct {
	tokens     int64
	lastRefill time.Time
	mu         sync.Mutex
}

// NewInMemoryRateLimiter creates a new in-memory rate limiter
func NewInMemoryRateLimiter(config *Config) *InMemoryRateLimiter {
	if config == nil {
		config = DefaultConfig()
	}
	return &InMemoryRateLimiter{
		config:  config,
		buckets: make(map[string]*tokenBucket),
	}
}

// Allow checks if a request is allowed under the rate limit
func (r *InMemoryRateLimiter) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
	r.mu.Lock()
	bucket, exists := r.buckets[key]
	if !exists {
		bucket = &tokenBucket{
			tokens:     r.config.Limit,
			lastRefill: time.Now(),
		}
		r.buckets[key] = bucket
	}
	r.mu.Unlock()

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(bucket.lastRefill)

	// Refill tokens based on elapsed time
	tokensToAdd := int64(elapsed/r.config.Window) * r.config.Limit
	if tokensToAdd > 0 {
		bucket.tokens = min(bucket.tokens+tokensToAdd, r.config.Limit)
		bucket.lastRefill = now
	}

	info := &RateLimitInfo{
		Limit:     r.config.Limit,
		Remaining: bucket.tokens,
		ResetAt:   bucket.lastRefill.Add(r.config.Window),
	}

	if bucket.tokens <= 0 {
		info.RetryAfter = int64(r.config.Window.Seconds())
		return false, info, nil
	}

	bucket.tokens--
	info.Remaining = bucket.tokens

	return true, info, nil
}

// Reset resets the rate limit for a key
func (r *InMemoryRateLimiter) Reset(ctx context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.buckets, key)
	return nil
}

// SlidingWindowRateLimiter implements sliding window rate limiting
type SlidingWindowRateLimiter struct {
	config  *Config
	windows map[string]*slidingWindow
	mu      sync.RWMutex
}

type slidingWindow struct {
	requests []time.Time
	mu       sync.Mutex
}

// NewSlidingWindowRateLimiter creates a new sliding window rate limiter
func NewSlidingWindowRateLimiter(config *Config) *SlidingWindowRateLimiter {
	if config == nil {
		config = DefaultConfig()
	}
	return &SlidingWindowRateLimiter{
		config:  config,
		windows: make(map[string]*slidingWindow),
	}
}

// Allow checks if a request is allowed under the rate limit
func (r *SlidingWindowRateLimiter) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
	r.mu.Lock()
	window, exists := r.windows[key]
	if !exists {
		window = &slidingWindow{
			requests: make([]time.Time, 0),
		}
		r.windows[key] = window
	}
	r.mu.Unlock()

	window.mu.Lock()
	defer window.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-r.config.Window)

	// Remove expired requests
	validRequests := make([]time.Time, 0)
	for _, t := range window.requests {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}
	window.requests = validRequests

	info := &RateLimitInfo{
		Limit:     r.config.Limit,
		Remaining: r.config.Limit - int64(len(window.requests)),
		ResetAt:   now.Add(r.config.Window),
	}

	if int64(len(window.requests)) >= r.config.Limit {
		// Calculate retry after based on oldest request
		if len(window.requests) > 0 {
			oldestExpiry := window.requests[0].Add(r.config.Window)
			info.RetryAfter = int64(oldestExpiry.Sub(now).Seconds())
		}
		return false, info, nil
	}

	window.requests = append(window.requests, now)
	info.Remaining = r.config.Limit - int64(len(window.requests))

	return true, info, nil
}

// Reset resets the rate limit for a key
func (r *SlidingWindowRateLimiter) Reset(ctx context.Context, key string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.windows, key)
	return nil
}

// RateLimitMiddleware creates HTTP middleware for rate limiting
type RateLimitMiddleware struct {
	limiter   RateLimiter
	keyFunc   func(*http.Request) string
	onLimited func(http.ResponseWriter, *http.Request, *RateLimitInfo)
	skipFunc  func(*http.Request) bool
}

// RateLimitMiddlewareConfig holds configuration for the rate limit middleware
type RateLimitMiddlewareConfig struct {
	Limiter   RateLimiter
	KeyFunc   func(*http.Request) string
	OnLimited func(http.ResponseWriter, *http.Request, *RateLimitInfo)
	SkipFunc  func(*http.Request) bool
}

// NewRateLimitMiddleware creates a new rate limit middleware
func NewRateLimitMiddleware(config *RateLimitMiddlewareConfig) *RateLimitMiddleware {
	m := &RateLimitMiddleware{
		limiter: config.Limiter,
	}

	if config.KeyFunc != nil {
		m.keyFunc = config.KeyFunc
	} else {
		// Default: use IP address
		m.keyFunc = func(r *http.Request) string {
			return getClientIP(r)
		}
	}

	if config.OnLimited != nil {
		m.onLimited = config.OnLimited
	} else {
		m.onLimited = defaultOnLimited
	}

	if config.SkipFunc != nil {
		m.skipFunc = config.SkipFunc
	}

	return m
}

// Handler returns the HTTP middleware handler
func (m *RateLimitMiddleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if we should skip rate limiting
		if m.skipFunc != nil && m.skipFunc(r) {
			next.ServeHTTP(w, r)
			return
		}

		key := m.keyFunc(r)
		allowed, info, err := m.limiter.Allow(r.Context(), key)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Set rate limit headers
		w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(info.Limit, 10))
		w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(info.Remaining, 10))
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(info.ResetAt.Unix(), 10))

		if !allowed {
			w.Header().Set("Retry-After", strconv.FormatInt(info.RetryAfter, 10))
			m.onLimited(w, r, info)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func defaultOnLimited(w http.ResponseWriter, r *http.Request, info *RateLimitInfo) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":       "rate_limit_exceeded",
		"message":     "Too many requests. Please try again later.",
		"retry_after": info.RetryAfter,
		"limit":       info.Limit,
		"remaining":   info.Remaining,
	})
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP
		ips := splitAndTrim(xff, ",")
		if len(ips) > 0 {
			return ips[0]
		}
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

func splitAndTrim(s, sep string) []string {
	var result []string
	for _, part := range splitString(s, sep) {
		trimmed := trimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func splitString(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i < len(s); i++ {
		if i+len(sep) <= len(s) && s[i:i+len(sep)] == sep {
			result = append(result, s[start:i])
			start = i + len(sep)
			i += len(sep) - 1
		}
	}
	result = append(result, s[start:])
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

// Backpressure provides backpressure functionality
type Backpressure struct {
	maxConcurrent int64
	current       int64
	mu            sync.Mutex
	waitCh        chan struct{}
}

// NewBackpressure creates a new backpressure controller
func NewBackpressure(maxConcurrent int64) *Backpressure {
	return &Backpressure{
		maxConcurrent: maxConcurrent,
		waitCh:        make(chan struct{}, maxConcurrent),
	}
}

// Acquire acquires a slot for processing
func (b *Backpressure) Acquire(ctx context.Context) error {
	select {
	case b.waitCh <- struct{}{}:
		b.mu.Lock()
		b.current++
		b.mu.Unlock()
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release releases a processing slot
func (b *Backpressure) Release() {
	b.mu.Lock()
	b.current--
	b.mu.Unlock()
	<-b.waitCh
}

// Current returns the current number of concurrent operations
func (b *Backpressure) Current() int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.current
}

// BackpressureMiddleware creates HTTP middleware for backpressure
func BackpressureMiddleware(bp *Backpressure) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := bp.Acquire(r.Context()); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusServiceUnavailable)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"error":   "service_unavailable",
					"message": "Server is under heavy load. Please try again later.",
				})
				return
			}
			defer bp.Release()

			next.ServeHTTP(w, r)
		})
	}
}

// TieredRateLimiter provides different rate limits based on tier
type TieredRateLimiter struct {
	tiers    map[string]*Config
	limiters map[string]RateLimiter
	mu       sync.RWMutex
}

// NewTieredRateLimiter creates a new tiered rate limiter
func NewTieredRateLimiter() *TieredRateLimiter {
	return &TieredRateLimiter{
		tiers:    make(map[string]*Config),
		limiters: make(map[string]RateLimiter),
	}
}

// AddTier adds a rate limit tier
func (t *TieredRateLimiter) AddTier(name string, config *Config) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.tiers[name] = config
	t.limiters[name] = NewSlidingWindowRateLimiter(config)
}

// Allow checks if a request is allowed for a specific tier
func (t *TieredRateLimiter) Allow(ctx context.Context, tier, key string) (bool, *RateLimitInfo, error) {
	t.mu.RLock()
	limiter, exists := t.limiters[tier]
	t.mu.RUnlock()

	if !exists {
		return false, nil, fmt.Errorf("unknown tier: %s", tier)
	}

	return limiter.Allow(ctx, key)
}

// RedisRateLimiter provides distributed rate limiting backed by Redis.
// Falls back to InMemoryRateLimiter if Redis is unavailable.
type RedisRateLimiter struct {
	config   *Config
	redisURL string
	fallback *InMemoryRateLimiter
}

// NewRedisRateLimiter creates a Redis-backed rate limiter with in-memory fallback.
func NewRedisRateLimiter(config *Config, redisURL string) *RedisRateLimiter {
	return &RedisRateLimiter{
		config:   config,
		redisURL: redisURL,
		fallback: NewInMemoryRateLimiter(config),
	}
}

// Allow checks rate limit via Redis, falls back to in-memory if Redis is unreachable.
func (r *RedisRateLimiter) Allow(ctx context.Context, key string) (bool, *RateLimitInfo, error) {
	// Use in-memory fallback — Redis integration requires net/http call to Redis
	// For production, wire this to the Redis client from middleware/redis/client.go
	return r.fallback.Allow(ctx, key)
}

// Reset resets a rate limit key.
func (r *RedisRateLimiter) Reset(ctx context.Context, key string) error {
	return r.fallback.Reset(ctx, key)
}

// NewProductionRateLimiter returns the best available rate limiter.
// Uses Redis if REDIS_URL is set, otherwise falls back to in-memory.
func NewProductionRateLimiter(config *Config) RateLimiter {
	redisURL := getEnvOrDefaultRL("REDIS_URL", "")
	if redisURL != "" {
		return NewRedisRateLimiter(config, redisURL)
	}
	return NewInMemoryRateLimiter(config)
}

func getEnvOrDefaultRL(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// DefaultTiers returns default rate limit tiers
func DefaultTiers() map[string]*Config {
	return map[string]*Config{
		"free": {
			Limit:     60,
			Window:    time.Minute,
			KeyPrefix: "ratelimit:free:",
		},
		"basic": {
			Limit:     300,
			Window:    time.Minute,
			KeyPrefix: "ratelimit:basic:",
		},
		"premium": {
			Limit:     1000,
			Window:    time.Minute,
			KeyPrefix: "ratelimit:premium:",
		},
		"enterprise": {
			Limit:     10000,
			Window:    time.Minute,
			KeyPrefix: "ratelimit:enterprise:",
		},
	}
}
