package shared

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type CacheConfig struct {
	RedisAddr    string
	RedisPass    string
	RedisDB      int
	DefaultTTL   time.Duration
	KeyPrefix    string
	MaxRetries   int
}

type CacheAside struct {
	client     *redis.Client
	config     CacheConfig
	logger     *StructuredLogger
	mu         sync.RWMutex
	hitCount   int64
	missCount  int64
}

func NewCacheAside(cfg CacheConfig, logger *StructuredLogger) *CacheAside {
	client := redis.NewClient(&redis.Options{
		Addr:       cfg.RedisAddr,
		Password:   cfg.RedisPass,
		DB:         cfg.RedisDB,
		MaxRetries: cfg.MaxRetries,
		PoolSize:   50,
		MinIdleConns: 10,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})

	return &CacheAside{
		client: client,
		config: cfg,
		logger: logger,
	}
}

func (c *CacheAside) key(k string) string {
	return c.config.KeyPrefix + k
}

func (c *CacheAside) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	val, err := c.client.Get(ctx, c.key(key)).Result()
	if err == redis.Nil {
		c.mu.Lock()
		c.missCount++
		c.mu.Unlock()
		return false, nil
	}
	if err != nil {
		return false, err
	}

	c.mu.Lock()
	c.hitCount++
	c.mu.Unlock()

	return true, json.Unmarshal([]byte(val), dest)
}

func (c *CacheAside) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if ttl == 0 {
		ttl = c.config.DefaultTTL
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, c.key(key), data, ttl).Err()
}

func (c *CacheAside) GetOrLoad(ctx context.Context, key string, dest interface{}, ttl time.Duration, loader func() (interface{}, error)) error {
	found, err := c.Get(ctx, key, dest)
	if err != nil {
		c.logger.Warn("cache get error, falling through to loader", map[string]interface{}{"key": key, "error": err.Error()})
	}
	if found {
		return nil
	}

	result, err := loader()
	if err != nil {
		return err
	}

	data, _ := json.Marshal(result)
	json.Unmarshal(data, dest)

	go func() {
		setErr := c.Set(context.Background(), key, result, ttl)
		if setErr != nil {
			c.logger.Warn("cache set error", map[string]interface{}{"key": key, "error": setErr.Error()})
		}
	}()

	return nil
}

func (c *CacheAside) Invalidate(ctx context.Context, keys ...string) error {
	prefixed := make([]string, len(keys))
	for i, k := range keys {
		prefixed[i] = c.key(k)
	}
	return c.client.Del(ctx, prefixed...).Err()
}

func (c *CacheAside) InvalidatePattern(ctx context.Context, pattern string) error {
	iter := c.client.Scan(ctx, 0, c.key(pattern), 100).Iterator()
	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if len(keys) > 0 {
		return c.client.Del(ctx, keys...).Err()
	}
	return nil
}

func (c *CacheAside) Stats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()
	total := c.hitCount + c.missCount
	hitRate := float64(0)
	if total > 0 {
		hitRate = float64(c.hitCount) / float64(total) * 100
	}
	return map[string]interface{}{
		"hits":     c.hitCount,
		"misses":   c.missCount,
		"hit_rate": fmt.Sprintf("%.1f%%", hitRate),
		"total":    total,
	}
}

func (c *CacheAside) HealthCheck() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return c.client.Ping(ctx).Err() == nil
}

func (c *CacheAside) Close() error {
	return c.client.Close()
}

var (
	accountBalanceCache    = "account:balance:%s"
	fraudScoreCache        = "fraud:score:%s"
	kycStatusCache         = "kyc:status:%s"
	merchantProfileCache   = "merchant:profile:%s"
	exchangeRateCache      = "exchange:rate:%s:%s"
)

func AccountBalanceCacheKey(accountID string) string {
	return fmt.Sprintf(accountBalanceCache, accountID)
}

func FraudScoreCacheKey(txnID string) string {
	return fmt.Sprintf(fraudScoreCache, txnID)
}

func KYCStatusCacheKey(userID string) string {
	return fmt.Sprintf(kycStatusCache, userID)
}

func MerchantProfileCacheKey(merchantID string) string {
	return fmt.Sprintf(merchantProfileCache, merchantID)
}

func ExchangeRateCacheKey(from, to string) string {
	return fmt.Sprintf(exchangeRateCache, from, to)
}
