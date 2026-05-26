package middleware

import (
	"sync"
	"time"
)

type RedisConfig struct {
	URL              string
	SentinelAddrs    []string
	MasterName       string
	Password         string
	DB               int
	MaxRetries       int
	PoolSize         int
	MinIdleConns     int
	ReadTimeout      time.Duration
	WriteTimeout     time.Duration
	PoolTimeout      time.Duration
}

var DefaultRedisConfig = RedisConfig{
	URL:          "redis://redis:6379",
	MasterName:   "payment-switch-master",
	MaxRetries:   3,
	PoolSize:     50,
	MinIdleConns: 10,
	ReadTimeout:  3 * time.Second,
	WriteTimeout: 3 * time.Second,
	PoolTimeout:  4 * time.Second,
}

type CacheEntry struct {
	Key       string
	Value     string
	TTL       time.Duration
	CreatedAt time.Time
}

type RedisClient struct {
	mu     sync.RWMutex
	config RedisConfig
	cache  map[string]CacheEntry
	hits   int64
	misses int64
}

func NewRedisClient(cfg RedisConfig) *RedisClient {
	return &RedisClient{
		config: cfg,
		cache:  make(map[string]CacheEntry),
	}
}

func (rc *RedisClient) Get(key string) (string, bool) {
	rc.mu.RLock()
	defer rc.mu.RUnlock()

	entry, exists := rc.cache[key]
	if !exists {
		rc.mu.RUnlock()
		rc.mu.Lock()
		rc.misses++
		rc.mu.Unlock()
		rc.mu.RLock()
		return "", false
	}

	if entry.TTL > 0 && time.Since(entry.CreatedAt) > entry.TTL {
		return "", false
	}

	rc.mu.RUnlock()
	rc.mu.Lock()
	rc.hits++
	rc.mu.Unlock()
	rc.mu.RLock()
	return entry.Value, true
}

func (rc *RedisClient) Set(key string, value string, ttl time.Duration) {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	rc.cache[key] = CacheEntry{
		Key: key, Value: value, TTL: ttl, CreatedAt: time.Now(),
	}
}

func (rc *RedisClient) Delete(key string) bool {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	if _, exists := rc.cache[key]; exists {
		delete(rc.cache, key)
		return true
	}
	return false
}

func (rc *RedisClient) GetMetrics() map[string]int64 {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	return map[string]int64{
		"hits":     rc.hits,
		"misses":   rc.misses,
		"keys":     int64(len(rc.cache)),
	}
}
