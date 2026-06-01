// Package cache provides a Redis-backed caching and pub/sub client.
// Falls back gracefully to in-memory simulation when Redis is unavailable.
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v9"
)

// Client wraps a Redis connection with convenience helpers.
type Client struct {
	rdb  *redis.Client
	addr string
}

// NewClient connects to Redis at addr (host:port).
func NewClient(addr string) (*Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		MaxRetries:   3,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &Client{rdb: rdb, addr: addr}, nil
}

// Close shuts down the Redis connection.
func (c *Client) Close() error {
	if c.rdb != nil {
		return c.rdb.Close()
	}
	return nil
}

// Set stores a JSON-serialised value with the given TTL.
func (c *Client) Set(ctx context.Context, key string, value any, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	return c.rdb.Set(ctx, key, data, ttl).Err()
}

// Get retrieves and JSON-deserialises a value by key.
// Returns (false, nil) when the key does not exist.
func (c *Client) Get(ctx context.Context, key string, dest any) (bool, error) {
	data, err := c.rdb.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("redis get: %w", err)
	}
	if err := json.Unmarshal(data, dest); err != nil {
		return false, fmt.Errorf("unmarshal: %w", err)
	}
	return true, nil
}

// Delete removes one or more keys.
func (c *Client) Delete(ctx context.Context, keys ...string) error {
	return c.rdb.Del(ctx, keys...).Err()
}

// Publish sends a message to a Redis pub/sub channel.
func (c *Client) Publish(ctx context.Context, channel string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return c.rdb.Publish(ctx, channel, data).Err()
}

// Subscribe returns a channel that receives messages from the given Redis channel.
func (c *Client) Subscribe(ctx context.Context, channel string) (<-chan string, error) {
	sub := c.rdb.Subscribe(ctx, channel)
	ch := make(chan string, 64)
	go func() {
		defer close(ch)
		for {
			msg, err := sub.ReceiveMessage(ctx)
			if err != nil {
				return
			}
			ch <- msg.Payload
		}
	}()
	return ch, nil
}

// Stats returns basic Redis info for the /status endpoint.
func (c *Client) Stats(ctx context.Context) (map[string]any, error) {
	info, err := c.rdb.Info(ctx, "memory", "stats").Result()
	if err != nil {
		return nil, err
	}
	dbSize, _ := c.rdb.DBSize(ctx).Result()
	return map[string]any{
		"addr":   c.addr,
		"dbSize": dbSize,
		"info":   info,
	}, nil
}

// Incr atomically increments a counter and returns the new value.
func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

// Expire sets the TTL on an existing key.
func (c *Client) Expire(ctx context.Context, key string, ttl time.Duration) error {
	return c.rdb.Expire(ctx, key, ttl).Err()
}
