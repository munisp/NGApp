package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

// RedisClient handles Redis caching and pub/sub
type RedisClient struct {
	client *redis.Client
	config RedisConfig
}

// NewRedisClient creates a new Redis client
func NewRedisClient(config RedisConfig) *RedisClient {
	if config.Host == "" {
		config.Host = os.Getenv("REDIS_HOST")
		if config.Host == "" {
			config.Host = "localhost"
		}
	}
	if config.Port == "" {
		config.Port = os.Getenv("REDIS_PORT")
		if config.Port == "" {
			config.Port = "6379"
		}
	}
	if config.Password == "" {
		config.Password = os.Getenv("REDIS_PASSWORD")
	}

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", config.Host, config.Port),
		Password: config.Password,
		DB:       config.DB,
	})

	return &RedisClient{
		client: client,
		config: config,
	}
}

// Cache keys
const (
	ClaimCachePrefix     = "claim:"
	RuleCachePrefix      = "rule:"
	FraudScoreCachePrefix = "fraud:"
	SLACachePrefix       = "sla:"
	SessionCachePrefix   = "session:"
	RateLimitPrefix      = "ratelimit:"
	LockPrefix           = "lock:"
)

// CacheClaim caches a claim for quick retrieval
func (r *RedisClient) CacheClaim(ctx context.Context, claimID uuid.UUID, data interface{}, ttl time.Duration) error {
	key := ClaimCachePrefix + claimID.String()
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, jsonData, ttl).Err()
}

// GetCachedClaim retrieves a cached claim
func (r *RedisClient) GetCachedClaim(ctx context.Context, claimID uuid.UUID, dest interface{}) error {
	key := ClaimCachePrefix + claimID.String()
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// InvalidateClaimCache invalidates a claim cache
func (r *RedisClient) InvalidateClaimCache(ctx context.Context, claimID uuid.UUID) error {
	key := ClaimCachePrefix + claimID.String()
	return r.client.Del(ctx, key).Err()
}

// CacheRules caches adjudication rules
func (r *RedisClient) CacheRules(ctx context.Context, rules interface{}, ttl time.Duration) error {
	key := RuleCachePrefix + "all"
	jsonData, err := json.Marshal(rules)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, jsonData, ttl).Err()
}

// GetCachedRules retrieves cached rules
func (r *RedisClient) GetCachedRules(ctx context.Context, dest interface{}) error {
	key := RuleCachePrefix + "all"
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// CacheFraudScore caches a fraud score for a customer
func (r *RedisClient) CacheFraudScore(ctx context.Context, customerID uuid.UUID, score float64, ttl time.Duration) error {
	key := FraudScoreCachePrefix + customerID.String()
	return r.client.Set(ctx, key, score, ttl).Err()
}

// GetCachedFraudScore retrieves a cached fraud score
func (r *RedisClient) GetCachedFraudScore(ctx context.Context, customerID uuid.UUID) (float64, error) {
	key := FraudScoreCachePrefix + customerID.String()
	return r.client.Get(ctx, key).Float64()
}

// SetSLADeadline sets an SLA deadline for a claim
func (r *RedisClient) SetSLADeadline(ctx context.Context, claimID uuid.UUID, slaType string, deadline time.Time) error {
	key := SLACachePrefix + claimID.String() + ":" + slaType
	return r.client.Set(ctx, key, deadline.Unix(), time.Until(deadline)+time.Hour).Err()
}

// GetSLADeadline gets an SLA deadline for a claim
func (r *RedisClient) GetSLADeadline(ctx context.Context, claimID uuid.UUID, slaType string) (time.Time, error) {
	key := SLACachePrefix + claimID.String() + ":" + slaType
	unix, err := r.client.Get(ctx, key).Int64()
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(unix, 0), nil
}

// CheckRateLimit checks if a rate limit has been exceeded
func (r *RedisClient) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	fullKey := RateLimitPrefix + key
	
	pipe := r.client.Pipeline()
	incr := pipe.Incr(ctx, fullKey)
	pipe.Expire(ctx, fullKey, window)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}

	count, err := incr.Result()
	if err != nil {
		return false, err
	}

	return count <= int64(limit), nil
}

// AcquireLock acquires a distributed lock
func (r *RedisClient) AcquireLock(ctx context.Context, lockKey string, ttl time.Duration) (bool, error) {
	key := LockPrefix + lockKey
	return r.client.SetNX(ctx, key, "locked", ttl).Result()
}

// ReleaseLock releases a distributed lock
func (r *RedisClient) ReleaseLock(ctx context.Context, lockKey string) error {
	key := LockPrefix + lockKey
	return r.client.Del(ctx, key).Err()
}

// PublishEvent publishes an event to a Redis channel
func (r *RedisClient) PublishEvent(ctx context.Context, channel string, event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return r.client.Publish(ctx, channel, data).Err()
}

// SubscribeToChannel subscribes to a Redis channel
func (r *RedisClient) SubscribeToChannel(ctx context.Context, channel string, handler func([]byte)) error {
	pubsub := r.client.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			handler([]byte(msg.Payload))
		}
	}
}

// IncrementCounter increments a counter
func (r *RedisClient) IncrementCounter(ctx context.Context, key string) (int64, error) {
	return r.client.Incr(ctx, key).Result()
}

// GetCounter gets a counter value
func (r *RedisClient) GetCounter(ctx context.Context, key string) (int64, error) {
	return r.client.Get(ctx, key).Int64()
}

// AddToSet adds a value to a set
func (r *RedisClient) AddToSet(ctx context.Context, key string, value interface{}) error {
	return r.client.SAdd(ctx, key, value).Err()
}

// GetSetMembers gets all members of a set
func (r *RedisClient) GetSetMembers(ctx context.Context, key string) ([]string, error) {
	return r.client.SMembers(ctx, key).Result()
}

// AddToSortedSet adds a value to a sorted set with a score
func (r *RedisClient) AddToSortedSet(ctx context.Context, key string, score float64, value interface{}) error {
	return r.client.ZAdd(ctx, key, &redis.Z{Score: score, Member: value}).Err()
}

// GetTopFromSortedSet gets top N items from a sorted set
func (r *RedisClient) GetTopFromSortedSet(ctx context.Context, key string, count int64) ([]string, error) {
	return r.client.ZRevRange(ctx, key, 0, count-1).Result()
}

// SetHash sets a hash field
func (r *RedisClient) SetHash(ctx context.Context, key, field string, value interface{}) error {
	return r.client.HSet(ctx, key, field, value).Err()
}

// GetHash gets a hash field
func (r *RedisClient) GetHash(ctx context.Context, key, field string) (string, error) {
	return r.client.HGet(ctx, key, field).Result()
}

// GetAllHash gets all fields from a hash
func (r *RedisClient) GetAllHash(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	return r.client.Close()
}

// Ping checks if Redis is available
func (r *RedisClient) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}
