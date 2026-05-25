package infra

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type RedisClient struct {
	client *redis.Client
	logger *zap.Logger
}

func NewRedisClient(logger *zap.Logger, addr string) *RedisClient {
	c := &RedisClient{logger: logger}
	rdb := redis.NewClient(&redis.Options{
		Addr:            addr,
		PoolSize:        20,
		MinIdleConns:    5,
		MaxRetries:      3,
		DialTimeout:     3 * time.Second,
		ReadTimeout:     2 * time.Second,
		WriteTimeout:    2 * time.Second,
		PoolTimeout:     3 * time.Second,
		ConnMaxLifetime: 30 * time.Minute,
	})
	c.client = rdb

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		logger.Warn("redis_ping_failed", zap.Error(err))
	} else {
		logger.Info("redis_connected", zap.String("addr", addr))
	}
	return c
}

func (c *RedisClient) Ping(ctx context.Context) error {
	if c.client == nil {
		return fmt.Errorf("redis not initialized")
	}
	return c.client.Ping(ctx).Err()
}

func (c *RedisClient) Client() *redis.Client { return c.client }

func (c *RedisClient) CacheJSON(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	return c.client.Set(ctx, key, data, ttl).Err()
}

func (c *RedisClient) GetCachedJSON(ctx context.Context, key string, dest interface{}) error {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (c *RedisClient) RateLimit(ctx context.Context, key string, maxRequests int64, window time.Duration) (bool, error) {
	pipe := c.client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	return incr.Val() <= maxRequests, nil
}

func (c *RedisClient) AcquireLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	return c.client.SetNX(ctx, "lock:"+key, time.Now().UnixMilli(), ttl).Result()
}

func (c *RedisClient) ReleaseLock(ctx context.Context, key string) error {
	return c.client.Del(ctx, "lock:"+key).Err()
}

func (c *RedisClient) Publish(ctx context.Context, channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return c.client.Publish(ctx, channel, data).Err()
}

func (c *RedisClient) Subscribe(ctx context.Context, channel string) *redis.PubSub {
	return c.client.Subscribe(ctx, channel)
}

func (c *RedisClient) SetKYCGate(ctx context.Context, userID string, allowed bool, level int, ttl time.Duration) error {
	data := map[string]interface{}{"allowed": allowed, "level": level, "ts": time.Now().Unix()}
	return c.CacheJSON(ctx, "kyc:gate:"+userID, data, ttl)
}

func (c *RedisClient) GetKYCGate(ctx context.Context, userID string) (bool, int, error) {
	var data map[string]interface{}
	if err := c.GetCachedJSON(ctx, "kyc:gate:"+userID, &data); err != nil {
		return false, 0, err
	}
	allowed, _ := data["allowed"].(bool)
	level := int(data["level"].(float64))
	return allowed, level, nil
}

func (c *RedisClient) InvalidatePattern(ctx context.Context, pattern string) (int64, error) {
	var cursor uint64
	var deleted int64
	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return deleted, err
		}
		if len(keys) > 0 {
			d, _ := c.client.Del(ctx, keys...).Result()
			deleted += d
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return deleted, nil
}

func (c *RedisClient) PoolStats() *redis.PoolStats {
	if c.client == nil {
		return nil
	}
	return c.client.PoolStats()
}

func (c *RedisClient) Close() {
	if c.client != nil {
		c.client.Close()
	}
}
