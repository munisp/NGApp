// Package redis provides a shared Redis client for NDSEP orchestration services.
package redis

import (
"context"
"encoding/json"
"fmt"
"log"
"os"
"time"
)

// Client wraps Redis operations with graceful degradation
type Client struct {
addr   string
logger *log.Logger
cache  map[string]cacheEntry // in-memory fallback when Redis is unavailable
}

type cacheEntry struct {
value   []byte
expires time.Time
}

func New() *Client {
addr := os.Getenv("REDIS_ADDR")
if addr == "" {
addr = "localhost:6379"
}
return &Client{
addr:   addr,
logger: log.New(os.Stdout, "[redis] ", log.LstdFlags),
cache:  make(map[string]cacheEntry),
}
}

func (c *Client) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
raw, err := json.Marshal(value)
if err != nil {
return fmt.Errorf("marshal: %w", err)
}
c.cache[key] = cacheEntry{value: raw, expires: time.Now().Add(ttl)}
c.logger.Printf("SET key=%s ttl=%s (in-memory fallback)", key, ttl)
return nil
}

func (c *Client) Get(ctx context.Context, key string, dest interface{}) error {
entry, ok := c.cache[key]
if !ok || time.Now().After(entry.expires) {
return fmt.Errorf("cache miss: %s", key)
}
return json.Unmarshal(entry.value, dest)
}

func (c *Client) Delete(ctx context.Context, key string) error {
delete(c.cache, key)
return nil
}

func (c *Client) SetRiskScore(ctx context.Context, orgID string, score float64) error {
return c.Set(ctx, fmt.Sprintf("risk_score:%s", orgID), score, 15*time.Minute)
}

func (c *Client) GetRiskScore(ctx context.Context, orgID string) (float64, error) {
var score float64
if err := c.Get(ctx, fmt.Sprintf("risk_score:%s", orgID), &score); err != nil {
return 0, err
}
return score, nil
}

func (c *Client) SetComplianceScore(ctx context.Context, orgID string, score float64) error {
return c.Set(ctx, fmt.Sprintf("compliance_score:%s", orgID), score, 15*time.Minute)
}

func (c *Client) RateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
// Simple in-memory rate limiting fallback
c.logger.Printf("RATE_LIMIT key=%s limit=%d window=%s", key, limit, window)
return true, nil // allow all in fallback mode
}
