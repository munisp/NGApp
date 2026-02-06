package internal

import (
	"fmt"
	"sync"
	"time"
)

type CacheSetRequest struct {
	Namespace  string      `json:"namespace"`
	Key        string      `json:"key"`
	Value      interface{} `json:"value"`
	TTLSeconds int         `json:"ttl_seconds"`
	Tags       []string    `json:"tags,omitempty"`
}

type SessionSetRequest struct {
	SessionID  string                 `json:"session_id"`
	Data       map[string]interface{} `json:"data"`
	TTLSeconds int                    `json:"ttl_seconds"`
}

type RateLimitRequest struct {
	Identifier    string `json:"identifier"`
	MaxRequests   int    `json:"max_requests"`
	WindowSeconds int    `json:"window_seconds"`
}

type RateLimitResult struct {
	Allowed   bool  `json:"allowed"`
	Remaining int   `json:"remaining"`
	ResetAt   int64 `json:"reset_at"`
}

type LockRequest struct {
	Resource   string `json:"resource"`
	TTLSeconds int    `json:"ttl_seconds"`
}

type LockReleaseRequest struct {
	Resource string `json:"resource"`
	LockID   string `json:"lock_id"`
}

type PubSubRequest struct {
	Channel string `json:"channel"`
	Message string `json:"message"`
}

type HealthStatus struct {
	Connected  bool              `json:"connected"`
	Host       string            `json:"host"`
	Port       int               `json:"port"`
	CacheSize  int               `json:"cache_size"`
	Namespaces map[string]int    `json:"namespaces"`
}

type Stats struct {
	CacheSize   int            `json:"cache_size"`
	Hits        int64          `json:"hits"`
	Misses      int64          `json:"misses"`
	HitRate     float64        `json:"hit_rate"`
	Evictions   int64          `json:"evictions"`
	Sessions    int            `json:"sessions"`
	Locks       int            `json:"locks"`
	Namespaces  map[string]int `json:"namespaces"`
}

type cacheEntry struct {
	value     interface{}
	expiresAt int64
	tags      []string
}

type lockEntry struct {
	lockID    string
	expiresAt int64
}

type RedisClient struct {
	config     *Config
	connected  bool
	mu         sync.RWMutex
	cache      map[string]*cacheEntry
	sessions   map[string]*cacheEntry
	locks      map[string]*lockEntry
	rateLimits map[string]*rateLimitEntry
	pubsub     map[string][]func(string)
	stats      *clientStats
}

type rateLimitEntry struct {
	count     int
	windowEnd int64
}

type clientStats struct {
	mu        sync.Mutex
	hits      int64
	misses    int64
	evictions int64
}

func NewRedisClient(cfg *Config) (*RedisClient, error) {
	client := &RedisClient{
		config:     cfg,
		cache:      make(map[string]*cacheEntry),
		sessions:   make(map[string]*cacheEntry),
		locks:      make(map[string]*lockEntry),
		rateLimits: make(map[string]*rateLimitEntry),
		pubsub:     make(map[string][]func(string)),
		stats:      &clientStats{},
	}

	client.connected = true
	fmt.Printf("[Redis] Connected to %s:%d (prefix: %s, pool: %d)\n",
		cfg.Host, cfg.Port, cfg.KeyPrefix, cfg.PoolSize)

	if len(cfg.SentinelHosts) > 0 {
		fmt.Printf("[Redis] Sentinel mode: master=%s, sentinels=%v\n", cfg.SentinelName, cfg.SentinelHosts)
	}
	if cfg.ClusterMode {
		fmt.Printf("[Redis] Cluster mode enabled\n")
	}

	go client.evictionLoop()

	return client, nil
}

func (c *RedisClient) buildKey(namespace, key string) string {
	return fmt.Sprintf("%s%s:%s", c.config.KeyPrefix, namespace, key)
}

func (c *RedisClient) Get(namespace, key string) (interface{}, bool) {
	fullKey := c.buildKey(namespace, key)
	c.mu.RLock()
	entry, exists := c.cache[fullKey]
	c.mu.RUnlock()

	if !exists {
		c.stats.mu.Lock()
		c.stats.misses++
		c.stats.mu.Unlock()
		return nil, false
	}

	if entry.expiresAt > 0 && time.Now().UnixMilli() > entry.expiresAt {
		c.mu.Lock()
		delete(c.cache, fullKey)
		c.mu.Unlock()
		c.stats.mu.Lock()
		c.stats.misses++
		c.stats.mu.Unlock()
		return nil, false
	}

	c.stats.mu.Lock()
	c.stats.hits++
	c.stats.mu.Unlock()
	return entry.value, true
}

func (c *RedisClient) Set(namespace, key string, value interface{}, ttlSeconds int, tags []string) {
	fullKey := c.buildKey(namespace, key)
	var expiresAt int64
	if ttlSeconds > 0 {
		expiresAt = time.Now().UnixMilli() + int64(ttlSeconds)*1000
	}

	c.mu.Lock()
	c.cache[fullKey] = &cacheEntry{
		value:     value,
		expiresAt: expiresAt,
		tags:      tags,
	}
	c.mu.Unlock()
}

func (c *RedisClient) Delete(namespace, key string) {
	fullKey := c.buildKey(namespace, key)
	c.mu.Lock()
	delete(c.cache, fullKey)
	c.mu.Unlock()
}

func (c *RedisClient) InvalidateByTag(tag string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	count := 0
	for key, entry := range c.cache {
		for _, t := range entry.tags {
			if t == tag {
				delete(c.cache, key)
				count++
				break
			}
		}
	}
	return count
}

func (c *RedisClient) SetSession(sessionID string, data map[string]interface{}, ttlSeconds int) {
	var expiresAt int64
	if ttlSeconds > 0 {
		expiresAt = time.Now().UnixMilli() + int64(ttlSeconds)*1000
	}

	c.mu.Lock()
	c.sessions[sessionID] = &cacheEntry{
		value:     data,
		expiresAt: expiresAt,
	}
	c.mu.Unlock()
}

func (c *RedisClient) GetSession(sessionID string) (map[string]interface{}, bool) {
	c.mu.RLock()
	entry, exists := c.sessions[sessionID]
	c.mu.RUnlock()

	if !exists {
		return nil, false
	}

	if entry.expiresAt > 0 && time.Now().UnixMilli() > entry.expiresAt {
		c.mu.Lock()
		delete(c.sessions, sessionID)
		c.mu.Unlock()
		return nil, false
	}

	data, ok := entry.value.(map[string]interface{})
	return data, ok
}

func (c *RedisClient) DeleteSession(sessionID string) {
	c.mu.Lock()
	delete(c.sessions, sessionID)
	c.mu.Unlock()
}

func (c *RedisClient) CheckRateLimit(identifier string, maxRequests, windowSeconds int) *RateLimitResult {
	now := time.Now().UnixMilli()
	windowMs := int64(windowSeconds) * 1000

	c.mu.Lock()
	defer c.mu.Unlock()

	entry, exists := c.rateLimits[identifier]
	if !exists || now > entry.windowEnd {
		c.rateLimits[identifier] = &rateLimitEntry{
			count:     1,
			windowEnd: now + windowMs,
		}
		return &RateLimitResult{
			Allowed:   true,
			Remaining: maxRequests - 1,
			ResetAt:   now + windowMs,
		}
	}

	entry.count++
	allowed := entry.count <= maxRequests
	remaining := maxRequests - entry.count
	if remaining < 0 {
		remaining = 0
	}

	return &RateLimitResult{
		Allowed:   allowed,
		Remaining: remaining,
		ResetAt:   entry.windowEnd,
	}
}

func (c *RedisClient) AcquireLock(resource string, ttlSeconds int) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now().UnixMilli()
	if existing, exists := c.locks[resource]; exists && now < existing.expiresAt {
		return "", false
	}

	lockID := fmt.Sprintf("lock-%d-%d", now, time.Now().UnixNano()%10000)
	c.locks[resource] = &lockEntry{
		lockID:    lockID,
		expiresAt: now + int64(ttlSeconds)*1000,
	}
	return lockID, true
}

func (c *RedisClient) ReleaseLock(resource, lockID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry, exists := c.locks[resource]
	if !exists || entry.lockID != lockID {
		return false
	}
	delete(c.locks, resource)
	return true
}

func (c *RedisClient) Publish(channel, message string) {
	c.mu.RLock()
	handlers := c.pubsub[channel]
	c.mu.RUnlock()

	for _, handler := range handlers {
		go handler(message)
	}
}

func (c *RedisClient) Subscribe(channel string, handler func(string)) {
	c.mu.Lock()
	c.pubsub[channel] = append(c.pubsub[channel], handler)
	c.mu.Unlock()
}

func (c *RedisClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	namespaces := make(map[string]int)
	for key := range c.cache {
		ns := extractNamespace(key, c.config.KeyPrefix)
		namespaces[ns]++
	}

	return &HealthStatus{
		Connected:  c.connected,
		Host:       c.config.Host,
		Port:       c.config.Port,
		CacheSize:  len(c.cache),
		Namespaces: namespaces,
	}
}

func (c *RedisClient) GetStats() *Stats {
	c.mu.RLock()
	cacheSize := len(c.cache)
	sessionCount := len(c.sessions)
	lockCount := len(c.locks)
	namespaces := make(map[string]int)
	for key := range c.cache {
		ns := extractNamespace(key, c.config.KeyPrefix)
		namespaces[ns]++
	}
	c.mu.RUnlock()

	c.stats.mu.Lock()
	hits := c.stats.hits
	misses := c.stats.misses
	evictions := c.stats.evictions
	c.stats.mu.Unlock()

	var hitRate float64
	total := hits + misses
	if total > 0 {
		hitRate = float64(hits) / float64(total)
	}

	return &Stats{
		CacheSize:  cacheSize,
		Hits:       hits,
		Misses:     misses,
		HitRate:    hitRate,
		Evictions:  evictions,
		Sessions:   sessionCount,
		Locks:      lockCount,
		Namespaces: namespaces,
	}
}

func (c *RedisClient) evictionLoop() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().UnixMilli()
		c.mu.Lock()

		for key, entry := range c.cache {
			if entry.expiresAt > 0 && now > entry.expiresAt {
				delete(c.cache, key)
				c.stats.mu.Lock()
				c.stats.evictions++
				c.stats.mu.Unlock()
			}
		}

		for key, entry := range c.sessions {
			if entry.expiresAt > 0 && now > entry.expiresAt {
				delete(c.sessions, key)
			}
		}

		for key, entry := range c.locks {
			if now > entry.expiresAt {
				delete(c.locks, key)
			}
		}

		for key, entry := range c.rateLimits {
			if now > entry.windowEnd {
				delete(c.rateLimits, key)
			}
		}

		c.mu.Unlock()
	}
}

func (c *RedisClient) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	fmt.Println("[Redis] Client closed")
}

func extractNamespace(key, prefix string) string {
	trimmed := key[len(prefix):]
	for i, ch := range trimmed {
		if ch == ':' {
			return trimmed[:i]
		}
	}
	return "default"
}
