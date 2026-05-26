package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheClient wraps redis with CRM-specific caching patterns.
type CacheClient struct {
	rdb *redis.Client
}

// NewCacheClient creates a Redis client from env or explicit URL.
func NewCacheClient(url string) (*CacheClient, error) {
	if url == "" {
		url = os.Getenv("REDIS_URL")
	}
	if url == "" {
		url = "redis://redis:6379/0"
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	opts.PoolSize = 20
	opts.MinIdleConns = 5
	rdb := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return &CacheClient{rdb: rdb}, nil
}

// Get retrieves a cached value and unmarshals into dest.
func (c *CacheClient) Get(ctx context.Context, key string, dest interface{}) error {
	val, err := c.rdb.Get(ctx, key).Result()
	if err != nil {
		return err
	}
	return json.Unmarshal([]byte(val), dest)
}

// Set caches a value with TTL.
func (c *CacheClient) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.rdb.Set(ctx, key, data, ttl).Err()
}

// Delete removes a cached key.
func (c *CacheClient) Delete(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

// InvalidatePattern removes all keys matching a glob pattern.
func (c *CacheClient) InvalidatePattern(ctx context.Context, pattern string) error {
	iter := c.rdb.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		c.rdb.Del(ctx, iter.Val())
	}
	return iter.Err()
}

// Publish sends a message to a Redis pub/sub channel.
func (c *CacheClient) Publish(ctx context.Context, channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}
	return c.rdb.Publish(ctx, channel, data).Err()
}

// Subscribe returns a channel that receives messages from a Redis pub/sub channel.
func (c *CacheClient) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.rdb.Subscribe(ctx, channels...)
}

// Cache key prefixes for CRM platform
const (
	PrefixCustomer   = "crm:customer:"
	PrefixTenant     = "crm:tenant:"
	PrefixSession    = "crm:session:"
	PrefixAnalytics  = "crm:analytics:"
	PrefixRateLimit  = "crm:ratelimit:"
)

// PubSub channel names
const (
	ChannelCustomerUpdates = "crm:updates:customer"
	ChannelCampaignAlerts  = "crm:alerts:campaign"
	ChannelSystemEvents    = "crm:events:system"
	ChannelRealtimeMetrics = "crm:metrics:realtime"
)
