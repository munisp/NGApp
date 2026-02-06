package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
)

var (
	redisOpsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "redis_operations_total",
		Help: "Total Redis operations",
	}, []string{"operation"})
	redisLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "redis_operation_latency_seconds",
		Help:    "Redis operation latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation"})
	redisCacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "redis_cache_hits_total",
		Help: "Total cache hits",
	})
	redisCacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "redis_cache_misses_total",
		Help: "Total cache misses",
	})
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
	Connected  bool           `json:"connected"`
	Host       string         `json:"host"`
	Port       int            `json:"port"`
	CacheSize  int            `json:"cache_size"`
	Namespaces map[string]int `json:"namespaces"`
}

type Stats struct {
	CacheSize  int            `json:"cache_size"`
	Hits       int64          `json:"hits"`
	Misses     int64          `json:"misses"`
	HitRate    float64        `json:"hit_rate"`
	Evictions  int64          `json:"evictions"`
	Sessions   int            `json:"sessions"`
	Locks      int            `json:"locks"`
	Namespaces map[string]int `json:"namespaces"`
}

type RedisClient struct {
	config    *Config
	rdb       redis.UniversalClient
	connected bool
	mu        sync.RWMutex
	stats     *clientStats
	ctx       context.Context
}

type clientStats struct {
	mu        sync.Mutex
	hits      int64
	misses    int64
	evictions int64
}

func NewRedisClient(cfg *Config) (*RedisClient, error) {
	client := &RedisClient{
		config: cfg,
		stats:  &clientStats{},
		ctx:    context.Background(),
	}

	var rdb redis.UniversalClient
	if cfg.ClusterMode {
		rdb = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:      []string{fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)},
			Password:   cfg.Password,
			MaxRetries: cfg.MaxRetries,
			PoolSize:   cfg.PoolSize,
		})
	} else if len(cfg.SentinelHosts) > 0 {
		rdb = redis.NewFailoverClient(&redis.FailoverOptions{
			MasterName:    cfg.SentinelName,
			SentinelAddrs: cfg.SentinelHosts,
			Password:      cfg.Password,
			DB:            cfg.DB,
			MaxRetries:    cfg.MaxRetries,
			PoolSize:      cfg.PoolSize,
		})
	} else {
		rdb = redis.NewClient(&redis.Options{
			Addr:       fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
			Password:   cfg.Password,
			DB:         cfg.DB,
			MaxRetries: cfg.MaxRetries,
			PoolSize:   cfg.PoolSize,
		})
	}

	client.rdb = rdb

	if err := rdb.Ping(client.ctx).Err(); err != nil {
		fmt.Printf("[Redis] Connection failed (will retry): %v\n", err)
		client.connected = false
	} else {
		client.connected = true
		mode := "standalone"
		if cfg.ClusterMode {
			mode = "cluster"
		} else if len(cfg.SentinelHosts) > 0 {
			mode = "sentinel"
		}
		fmt.Printf("[Redis] Connected to %s:%d (mode: %s, prefix: %s, pool: %d)\n",
			cfg.Host, cfg.Port, mode, cfg.KeyPrefix, cfg.PoolSize)
	}

	go client.healthCheckLoop()
	return client, nil
}

func (c *RedisClient) healthCheckLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		err := c.rdb.Ping(c.ctx).Err()
		c.mu.Lock()
		c.connected = (err == nil)
		c.mu.Unlock()
	}
}

func (c *RedisClient) buildKey(namespace, key string) string {
	return fmt.Sprintf("%s%s:%s", c.config.KeyPrefix, namespace, key)
}

func (c *RedisClient) Get(namespace, key string) (interface{}, bool) {
	start := time.Now()
	defer func() { redisLatency.WithLabelValues("get").Observe(time.Since(start).Seconds()) }()
	redisOpsTotal.WithLabelValues("get").Inc()

	fullKey := c.buildKey(namespace, key)
	val, err := c.rdb.Get(c.ctx, fullKey).Result()
	if err == redis.Nil {
		c.stats.mu.Lock()
		c.stats.misses++
		c.stats.mu.Unlock()
		redisCacheMisses.Inc()
		return nil, false
	}
	if err != nil {
		c.stats.mu.Lock()
		c.stats.misses++
		c.stats.mu.Unlock()
		redisCacheMisses.Inc()
		return nil, false
	}

	var result interface{}
	if err := json.Unmarshal([]byte(val), &result); err != nil {
		result = val
	}

	c.stats.mu.Lock()
	c.stats.hits++
	c.stats.mu.Unlock()
	redisCacheHits.Inc()
	return result, true
}

func (c *RedisClient) Set(namespace, key string, value interface{}, ttlSeconds int, tags []string) {
	start := time.Now()
	defer func() { redisLatency.WithLabelValues("set").Observe(time.Since(start).Seconds()) }()
	redisOpsTotal.WithLabelValues("set").Inc()

	fullKey := c.buildKey(namespace, key)
	data, err := json.Marshal(value)
	if err != nil {
		return
	}

	var ttl time.Duration
	if ttlSeconds > 0 {
		ttl = time.Duration(ttlSeconds) * time.Second
	}
	c.rdb.Set(c.ctx, fullKey, data, ttl)

	if len(tags) > 0 {
		for _, tag := range tags {
			tagKey := fmt.Sprintf("%stag:%s", c.config.KeyPrefix, tag)
			c.rdb.SAdd(c.ctx, tagKey, fullKey)
		}
	}
}

func (c *RedisClient) Delete(namespace, key string) {
	redisOpsTotal.WithLabelValues("delete").Inc()
	fullKey := c.buildKey(namespace, key)
	c.rdb.Del(c.ctx, fullKey)
}

func (c *RedisClient) InvalidateByTag(tag string) int {
	redisOpsTotal.WithLabelValues("invalidate_tag").Inc()
	tagKey := fmt.Sprintf("%stag:%s", c.config.KeyPrefix, tag)
	keys, err := c.rdb.SMembers(c.ctx, tagKey).Result()
	if err != nil {
		return 0
	}
	if len(keys) > 0 {
		c.rdb.Del(c.ctx, keys...)
		c.rdb.Del(c.ctx, tagKey)
	}
	return len(keys)
}

func (c *RedisClient) SetSession(sessionID string, data map[string]interface{}, ttlSeconds int) {
	redisOpsTotal.WithLabelValues("session_set").Inc()
	key := fmt.Sprintf("%ssession:%s", c.config.KeyPrefix, sessionID)
	jsonData, err := json.Marshal(data)
	if err != nil {
		return
	}
	var ttl time.Duration
	if ttlSeconds > 0 {
		ttl = time.Duration(ttlSeconds) * time.Second
	}
	c.rdb.Set(c.ctx, key, jsonData, ttl)
}

func (c *RedisClient) GetSession(sessionID string) (map[string]interface{}, bool) {
	redisOpsTotal.WithLabelValues("session_get").Inc()
	key := fmt.Sprintf("%ssession:%s", c.config.KeyPrefix, sessionID)
	val, err := c.rdb.Get(c.ctx, key).Result()
	if err != nil {
		return nil, false
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(val), &data); err != nil {
		return nil, false
	}
	return data, true
}

func (c *RedisClient) DeleteSession(sessionID string) {
	key := fmt.Sprintf("%ssession:%s", c.config.KeyPrefix, sessionID)
	c.rdb.Del(c.ctx, key)
}

func (c *RedisClient) CheckRateLimit(identifier string, maxRequests, windowSeconds int) *RateLimitResult {
	redisOpsTotal.WithLabelValues("rate_limit").Inc()
	key := fmt.Sprintf("%srl:%s", c.config.KeyPrefix, identifier)
	now := time.Now().UnixMilli()
	windowMs := int64(windowSeconds) * 1000

	pipe := c.rdb.Pipeline()
	pipe.ZRemRangeByScore(c.ctx, key, "0", fmt.Sprintf("%d", now-windowMs))
	pipe.ZCard(c.ctx, key)
	pipe.ZAdd(c.ctx, key, redis.Z{Score: float64(now), Member: fmt.Sprintf("%d", now)})
	pipe.Expire(c.ctx, key, time.Duration(windowSeconds)*time.Second)
	results, err := pipe.Exec(c.ctx)

	if err != nil {
		return &RateLimitResult{Allowed: true, Remaining: maxRequests - 1, ResetAt: now + windowMs}
	}

	count := results[1].(*redis.IntCmd).Val()
	allowed := count < int64(maxRequests)
	remaining := int64(maxRequests) - count - 1
	if remaining < 0 {
		remaining = 0
	}

	return &RateLimitResult{
		Allowed:   allowed,
		Remaining: int(remaining),
		ResetAt:   now + windowMs,
	}
}

func (c *RedisClient) AcquireLock(resource string, ttlSeconds int) (string, bool) {
	redisOpsTotal.WithLabelValues("lock_acquire").Inc()
	lockID := fmt.Sprintf("lock-%d", time.Now().UnixNano())
	key := fmt.Sprintf("%slock:%s", c.config.KeyPrefix, resource)
	ttl := time.Duration(ttlSeconds) * time.Second

	ok, err := c.rdb.SetNX(c.ctx, key, lockID, ttl).Result()
	if err != nil || !ok {
		return "", false
	}
	return lockID, true
}

func (c *RedisClient) ReleaseLock(resource, lockID string) bool {
	redisOpsTotal.WithLabelValues("lock_release").Inc()
	key := fmt.Sprintf("%slock:%s", c.config.KeyPrefix, resource)

	script := redis.NewScript(`
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`)
	result, err := script.Run(c.ctx, c.rdb, []string{key}, lockID).Int64()
	return err == nil && result == 1
}

func (c *RedisClient) Publish(channel, message string) {
	redisOpsTotal.WithLabelValues("publish").Inc()
	c.rdb.Publish(c.ctx, fmt.Sprintf("%s%s", c.config.KeyPrefix, channel), message)
}

func (c *RedisClient) Subscribe(channel string, handler func(string)) {
	ch := fmt.Sprintf("%s%s", c.config.KeyPrefix, channel)
	sub := c.rdb.Subscribe(c.ctx, ch)
	go func() {
		for msg := range sub.Channel() {
			handler(msg.Payload)
		}
	}()
}

func (c *RedisClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	namespaces := make(map[string]int)
	info, err := c.rdb.Info(c.ctx, "keyspace").Result()
	if err == nil {
		namespaces["info"] = len(info)
	}

	dbSize, _ := c.rdb.DBSize(c.ctx).Result()

	return &HealthStatus{
		Connected:  c.connected,
		Host:       c.config.Host,
		Port:       c.config.Port,
		CacheSize:  int(dbSize),
		Namespaces: namespaces,
	}
}

func (c *RedisClient) GetStats() *Stats {
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

	dbSize, _ := c.rdb.DBSize(c.ctx).Result()

	return &Stats{
		CacheSize:  int(dbSize),
		Hits:       hits,
		Misses:     misses,
		HitRate:    hitRate,
		Evictions:  evictions,
		Sessions:   0,
		Locks:      0,
		Namespaces: map[string]int{},
	}
}

func (c *RedisClient) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	c.rdb.Close()
	fmt.Println("[Redis] Client closed")
}
