// Package highperf provides real Redis client integration using go-redis
package highperf

import (
	"context"
	"crypto/tls"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/v8"
)

// RealRedisClient implements Redis operations with real go-redis client
type RealRedisClient struct {
	client      redis.UniversalClient
	config      RealRedisConfig
	isCluster   bool

	// Stats
	totalOps      uint64
	totalErrors   uint64
	totalLatencyNs uint64

	// Connection pool stats
	poolHits   uint64
	poolMisses uint64
}

// RealRedisConfig configures the real Redis client
type RealRedisConfig struct {
	// Connection
	Addresses    []string
	Password     string
	DB           int
	Username     string

	// Cluster mode
	ClusterMode  bool

	// TLS
	TLSEnabled   bool
	TLSConfig    *tls.Config

	// Pool
	PoolSize     int
	MinIdleConns int
	MaxConnAge   time.Duration
	PoolTimeout  time.Duration
	IdleTimeout  time.Duration

	// Timeouts
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration

	// Retry
	MaxRetries      int
	MinRetryBackoff time.Duration
	MaxRetryBackoff time.Duration
}

// DefaultRealRedisConfig returns production-optimized defaults
func DefaultRealRedisConfig() RealRedisConfig {
	return RealRedisConfig{
		Addresses:       []string{"redis:6379"},
		DB:              0,
		ClusterMode:     false,
		PoolSize:        100,
		MinIdleConns:    10,
		MaxConnAge:      0, // No max age
		PoolTimeout:     4 * time.Second,
		IdleTimeout:     5 * time.Minute,
		DialTimeout:     5 * time.Second,
		ReadTimeout:     3 * time.Second,
		WriteTimeout:    3 * time.Second,
		MaxRetries:      3,
		MinRetryBackoff: 8 * time.Millisecond,
		MaxRetryBackoff: 512 * time.Millisecond,
	}
}

// DefaultRealRedisClusterConfig returns production-optimized cluster defaults
func DefaultRealRedisClusterConfig() RealRedisConfig {
	config := DefaultRealRedisConfig()
	config.Addresses = []string{
		"redis-0:6379", "redis-1:6379", "redis-2:6379",
		"redis-3:6379", "redis-4:6379", "redis-5:6379",
	}
	config.ClusterMode = true
	config.PoolSize = 50 // Per node
	return config
}

// NewRealRedisClient creates a new real Redis client
func NewRealRedisClient(config RealRedisConfig) (*RealRedisClient, error) {
	var client redis.UniversalClient

	if config.ClusterMode {
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:           config.Addresses,
			Password:        config.Password,
			Username:        config.Username,
			PoolSize:        config.PoolSize,
			MinIdleConns:    config.MinIdleConns,
			MaxConnAge:      config.MaxConnAge,
			PoolTimeout:     config.PoolTimeout,
			IdleTimeout:     config.IdleTimeout,
			DialTimeout:     config.DialTimeout,
			ReadTimeout:     config.ReadTimeout,
			WriteTimeout:    config.WriteTimeout,
			MaxRetries:      config.MaxRetries,
			MinRetryBackoff: config.MinRetryBackoff,
			MaxRetryBackoff: config.MaxRetryBackoff,
			TLSConfig:       config.TLSConfig,
		})
	} else {
		client = redis.NewClient(&redis.Options{
			Addr:            config.Addresses[0],
			Password:        config.Password,
			Username:        config.Username,
			DB:              config.DB,
			PoolSize:        config.PoolSize,
			MinIdleConns:    config.MinIdleConns,
			MaxConnAge:      config.MaxConnAge,
			PoolTimeout:     config.PoolTimeout,
			IdleTimeout:     config.IdleTimeout,
			DialTimeout:     config.DialTimeout,
			ReadTimeout:     config.ReadTimeout,
			WriteTimeout:    config.WriteTimeout,
			MaxRetries:      config.MaxRetries,
			MinRetryBackoff: config.MinRetryBackoff,
			MaxRetryBackoff: config.MaxRetryBackoff,
			TLSConfig:       config.TLSConfig,
		})
	}

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RealRedisClient{
		client:    client,
		config:    config,
		isCluster: config.ClusterMode,
	}, nil
}

// Get gets a value from Redis
func (c *RealRedisClient) Get(ctx context.Context, key string) (string, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.Get(ctx, key).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil && err != redis.Nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return "", err
	}

	return result, nil
}

// Set sets a value in Redis
func (c *RealRedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.Set(ctx, key, value, expiration).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// SetNX sets a value only if it doesn't exist (for distributed locks)
func (c *RealRedisClient) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.SetNX(ctx, key, value, expiration).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return false, err
	}

	return result, nil
}

// Del deletes keys from Redis
func (c *RealRedisClient) Del(ctx context.Context, keys ...string) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.Del(ctx, keys...).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// Incr increments a counter
func (c *RealRedisClient) Incr(ctx context.Context, key string) (int64, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.Incr(ctx, key).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return 0, err
	}

	return result, nil
}

// IncrBy increments a counter by a specific amount
func (c *RealRedisClient) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.IncrBy(ctx, key, value).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return 0, err
	}

	return result, nil
}

// Expire sets expiration on a key
func (c *RealRedisClient) Expire(ctx context.Context, key string, expiration time.Duration) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.Expire(ctx, key, expiration).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// Pipeline creates a pipeline for batch operations
func (c *RealRedisClient) Pipeline() redis.Pipeliner {
	return c.client.Pipeline()
}

// TxPipeline creates a transactional pipeline
func (c *RealRedisClient) TxPipeline() redis.Pipeliner {
	return c.client.TxPipeline()
}

// ExecutePipeline executes a pipeline of commands
func (c *RealRedisClient) ExecutePipeline(ctx context.Context, fn func(pipe redis.Pipeliner) error) ([]redis.Cmder, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	pipe := c.client.Pipeline()
	if err := fn(pipe); err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return nil, err
	}

	cmds, err := pipe.Exec(ctx)

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil && err != redis.Nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return cmds, err
	}

	return cmds, nil
}

// HSet sets hash fields
func (c *RealRedisClient) HSet(ctx context.Context, key string, values ...interface{}) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.HSet(ctx, key, values...).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// HGet gets a hash field
func (c *RealRedisClient) HGet(ctx context.Context, key, field string) (string, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.HGet(ctx, key, field).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil && err != redis.Nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return "", err
	}

	return result, nil
}

// HGetAll gets all hash fields
func (c *RealRedisClient) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.HGetAll(ctx, key).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return nil, err
	}

	return result, nil
}

// ZAdd adds members to a sorted set
func (c *RealRedisClient) ZAdd(ctx context.Context, key string, members ...*redis.Z) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.ZAdd(ctx, key, members...).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// ZRangeByScore gets members by score range
func (c *RealRedisClient) ZRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) ([]string, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.ZRangeByScore(ctx, key, opt).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return nil, err
	}

	return result, nil
}

// Publish publishes a message to a channel
func (c *RealRedisClient) Publish(ctx context.Context, channel string, message interface{}) error {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	err := c.client.Publish(ctx, channel, message).Err()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return err
	}

	return nil
}

// Subscribe subscribes to channels
func (c *RealRedisClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.client.Subscribe(ctx, channels...)
}

// Eval executes a Lua script
func (c *RealRedisClient) Eval(ctx context.Context, script string, keys []string, args ...interface{}) (interface{}, error) {
	startTime := time.Now()
	atomic.AddUint64(&c.totalOps, 1)

	result, err := c.client.Eval(ctx, script, keys, args...).Result()

	atomic.AddUint64(&c.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	if err != nil {
		atomic.AddUint64(&c.totalErrors, 1)
		return nil, err
	}

	return result, nil
}

// Close closes the Redis client
func (c *RealRedisClient) Close() error {
	return c.client.Close()
}

// Stats returns client statistics
func (c *RealRedisClient) Stats() (ops, errors uint64, avgLatencyMs float64) {
	ops = atomic.LoadUint64(&c.totalOps)
	errors = atomic.LoadUint64(&c.totalErrors)
	totalLatency := atomic.LoadUint64(&c.totalLatencyNs)
	if ops > 0 {
		avgLatencyMs = float64(totalLatency) / float64(ops) / 1e6
	}
	return
}

// PoolStats returns connection pool statistics
func (c *RealRedisClient) PoolStats() *redis.PoolStats {
	return c.client.PoolStats()
}

// HealthCheck checks Redis connectivity
func (c *RealRedisClient) HealthCheck(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// RedisCache provides a high-level caching interface
type RedisCache struct {
	client     *RealRedisClient
	prefix     string
	defaultTTL time.Duration
	mu         sync.RWMutex
}

// RedisCacheConfig configures the Redis cache
type RedisCacheConfig struct {
	Prefix     string
	DefaultTTL time.Duration
}

// NewRedisCache creates a new Redis cache
func NewRedisCache(client *RealRedisClient, config RedisCacheConfig) *RedisCache {
	return &RedisCache{
		client:     client,
		prefix:     config.Prefix,
		defaultTTL: config.DefaultTTL,
	}
}

// Get gets a value from cache
func (c *RedisCache) Get(ctx context.Context, key string) (string, bool, error) {
	fullKey := c.prefix + key
	value, err := c.client.Get(ctx, fullKey)
	if err != nil {
		return "", false, err
	}
	if value == "" {
		return "", false, nil
	}
	return value, true, nil
}

// Set sets a value in cache
func (c *RedisCache) Set(ctx context.Context, key string, value interface{}, ttl ...time.Duration) error {
	fullKey := c.prefix + key
	expiration := c.defaultTTL
	if len(ttl) > 0 {
		expiration = ttl[0]
	}
	return c.client.Set(ctx, fullKey, value, expiration)
}

// Delete deletes a value from cache
func (c *RedisCache) Delete(ctx context.Context, key string) error {
	fullKey := c.prefix + key
	return c.client.Del(ctx, fullKey)
}

// GetOrSet gets a value from cache or sets it using the provided function
func (c *RedisCache) GetOrSet(ctx context.Context, key string, fn func() (interface{}, error), ttl ...time.Duration) (string, error) {
	value, found, err := c.Get(ctx, key)
	if err != nil {
		return "", err
	}
	if found {
		return value, nil
	}

	// Generate value
	newValue, err := fn()
	if err != nil {
		return "", err
	}

	// Set in cache
	if err := c.Set(ctx, key, newValue, ttl...); err != nil {
		return "", err
	}

	return fmt.Sprintf("%v", newValue), nil
}

// RateLimiterRedis provides Redis-based rate limiting
type RateLimiterRedis struct {
	client     *RealRedisClient
	keyPrefix  string
	ratePerSec int
	burstSize  int
}

// NewRateLimiterRedis creates a new Redis-based rate limiter
func NewRateLimiterRedis(client *RealRedisClient, keyPrefix string, ratePerSec, burstSize int) *RateLimiterRedis {
	return &RateLimiterRedis{
		client:     client,
		keyPrefix:  keyPrefix,
		ratePerSec: ratePerSec,
		burstSize:  burstSize,
	}
}

// Allow checks if a request is allowed using token bucket algorithm
func (rl *RateLimiterRedis) Allow(ctx context.Context, key string) (bool, error) {
	fullKey := rl.keyPrefix + key

	// Lua script for atomic token bucket
	script := `
		local key = KEYS[1]
		local rate = tonumber(ARGV[1])
		local burst = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])
		
		local data = redis.call('HMGET', key, 'tokens', 'last_update')
		local tokens = tonumber(data[1]) or burst
		local last_update = tonumber(data[2]) or now
		
		-- Refill tokens
		local elapsed = now - last_update
		tokens = math.min(burst, tokens + elapsed * rate)
		
		-- Try to consume
		if tokens >= 1 then
			tokens = tokens - 1
			redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
			redis.call('EXPIRE', key, 60)
			return 1
		end
		
		redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
		redis.call('EXPIRE', key, 60)
		return 0
	`

	now := float64(time.Now().UnixNano()) / 1e9
	result, err := rl.client.Eval(ctx, script, []string{fullKey}, rl.ratePerSec, rl.burstSize, now)
	if err != nil {
		return false, err
	}

	return result.(int64) == 1, nil
}

// IdempotencyStoreRedis provides Redis-based idempotency checking
type IdempotencyStoreRedis struct {
	client    *RealRedisClient
	keyPrefix string
	ttl       time.Duration
}

// NewIdempotencyStoreRedis creates a new Redis-based idempotency store
func NewIdempotencyStoreRedis(client *RealRedisClient, keyPrefix string, ttl time.Duration) *IdempotencyStoreRedis {
	return &IdempotencyStoreRedis{
		client:    client,
		keyPrefix: keyPrefix,
		ttl:       ttl,
	}
}

// Check checks if a key exists (returns true if already processed)
func (s *IdempotencyStoreRedis) Check(ctx context.Context, key string) (bool, error) {
	fullKey := s.keyPrefix + key
	value, err := s.client.Get(ctx, fullKey)
	if err != nil {
		return false, err
	}
	return value != "", nil
}

// Set sets an idempotency key (returns false if already exists)
func (s *IdempotencyStoreRedis) Set(ctx context.Context, key string) (bool, error) {
	fullKey := s.keyPrefix + key
	return s.client.SetNX(ctx, fullKey, "1", s.ttl)
}

// DistributedLock provides Redis-based distributed locking
type DistributedLock struct {
	client    *RealRedisClient
	keyPrefix string
	ttl       time.Duration
}

// NewDistributedLock creates a new distributed lock
func NewDistributedLock(client *RealRedisClient, keyPrefix string, ttl time.Duration) *DistributedLock {
	return &DistributedLock{
		client:    client,
		keyPrefix: keyPrefix,
		ttl:       ttl,
	}
}

// Acquire acquires a lock
func (l *DistributedLock) Acquire(ctx context.Context, key, value string) (bool, error) {
	fullKey := l.keyPrefix + key
	return l.client.SetNX(ctx, fullKey, value, l.ttl)
}

// Release releases a lock (only if we own it)
func (l *DistributedLock) Release(ctx context.Context, key, value string) (bool, error) {
	fullKey := l.keyPrefix + key

	// Lua script for atomic release
	script := `
		if redis.call('GET', KEYS[1]) == ARGV[1] then
			return redis.call('DEL', KEYS[1])
		end
		return 0
	`

	result, err := l.client.Eval(ctx, script, []string{fullKey}, value)
	if err != nil {
		return false, err
	}

	return result.(int64) == 1, nil
}

// Extend extends the lock TTL
func (l *DistributedLock) Extend(ctx context.Context, key, value string, ttl time.Duration) (bool, error) {
	fullKey := l.keyPrefix + key

	// Lua script for atomic extend
	script := `
		if redis.call('GET', KEYS[1]) == ARGV[1] then
			return redis.call('PEXPIRE', KEYS[1], ARGV[2])
		end
		return 0
	`

	result, err := l.client.Eval(ctx, script, []string{fullKey}, value, int64(ttl/time.Millisecond))
	if err != nil {
		return false, err
	}

	return result.(int64) == 1, nil
}
