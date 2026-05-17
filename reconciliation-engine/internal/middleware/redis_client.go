package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

const (
	ReconciliationJobPrefix     = "recon:job:"
	ReconciliationItemPrefix    = "recon:item:"
	ReconciliationStatsPrefix   = "recon:stats:"
	ReconciliationLockPrefix    = "recon:lock:"
	ReconciliationCachePrefix   = "recon:cache:"
	MatchingResultPrefix        = "recon:match:"
	StatementCachePrefix        = "recon:statement:"
	VarianceAlertPrefix         = "recon:alert:"
	ReconciliationQueueKey      = "recon:queue:pending"
	ReconciliationProcessingKey = "recon:queue:processing"
)

type CachedReconciliationJob struct {
	ID                 string    `json:"id"`
	JobName            string    `json:"job_name"`
	ReconciliationType string    `json:"reconciliation_type"`
	Status             string    `json:"status"`
	MatchedRecords     int       `json:"matched_records"`
	UnmatchedRecords   int       `json:"unmatched_records"`
	TotalVariance      float64   `json:"total_variance"`
	MatchRate          float64   `json:"match_rate"`
	LastUpdated        time.Time `json:"last_updated"`
}

type CachedMatchingResult struct {
	SourceRef       string    `json:"source_ref"`
	TargetRef       string    `json:"target_ref"`
	MatchStatus     string    `json:"match_status"`
	MatchConfidence float64   `json:"match_confidence"`
	Variance        float64   `json:"variance"`
	CachedAt        time.Time `json:"cached_at"`
}

func NewRedisClient(addr string, password string, db int) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		PoolSize:     10,
		MinIdleConns: 5,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	return &RedisClient{client: client}, nil
}

func (r *RedisClient) CacheJob(ctx context.Context, job *CachedReconciliationJob, ttl time.Duration) error {
	key := ReconciliationJobPrefix + job.ID
	job.LastUpdated = time.Now()

	data, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedJob(ctx context.Context, jobID string) (*CachedReconciliationJob, error) {
	key := ReconciliationJobPrefix + jobID

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get cached job: %w", err)
	}

	var job CachedReconciliationJob
	if err := json.Unmarshal(data, &job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

func (r *RedisClient) InvalidateJobCache(ctx context.Context, jobID string) error {
	key := ReconciliationJobPrefix + jobID
	return r.client.Del(ctx, key).Err()
}

func (r *RedisClient) CacheMatchingResult(ctx context.Context, jobID string, result *CachedMatchingResult, ttl time.Duration) error {
	key := MatchingResultPrefix + jobID + ":" + result.SourceRef
	result.CachedAt = time.Now()

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal matching result: %w", err)
	}

	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedMatchingResult(ctx context.Context, jobID, sourceRef string) (*CachedMatchingResult, error) {
	key := MatchingResultPrefix + jobID + ":" + sourceRef

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get cached matching result: %w", err)
	}

	var result CachedMatchingResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal matching result: %w", err)
	}

	return &result, nil
}

func (r *RedisClient) AcquireLock(ctx context.Context, lockKey string, ttl time.Duration) (bool, error) {
	key := ReconciliationLockPrefix + lockKey
	return r.client.SetNX(ctx, key, time.Now().Unix(), ttl).Result()
}

func (r *RedisClient) ReleaseLock(ctx context.Context, lockKey string) error {
	key := ReconciliationLockPrefix + lockKey
	return r.client.Del(ctx, key).Err()
}

func (r *RedisClient) ExtendLock(ctx context.Context, lockKey string, ttl time.Duration) error {
	key := ReconciliationLockPrefix + lockKey
	return r.client.Expire(ctx, key, ttl).Err()
}

func (r *RedisClient) EnqueueJob(ctx context.Context, jobID string, priority float64) error {
	return r.client.ZAdd(ctx, ReconciliationQueueKey, redis.Z{
		Score:  priority,
		Member: jobID,
	}).Err()
}

func (r *RedisClient) DequeueJob(ctx context.Context) (string, error) {
	result, err := r.client.ZPopMin(ctx, ReconciliationQueueKey, 1).Result()
	if err != nil {
		return "", err
	}
	if len(result) == 0 {
		return "", nil
	}

	jobID := result[0].Member.(string)

	r.client.SAdd(ctx, ReconciliationProcessingKey, jobID)

	return jobID, nil
}

func (r *RedisClient) MarkJobComplete(ctx context.Context, jobID string) error {
	return r.client.SRem(ctx, ReconciliationProcessingKey, jobID).Err()
}

func (r *RedisClient) GetQueueLength(ctx context.Context) (int64, error) {
	return r.client.ZCard(ctx, ReconciliationQueueKey).Result()
}

func (r *RedisClient) GetProcessingCount(ctx context.Context) (int64, error) {
	return r.client.SCard(ctx, ReconciliationProcessingKey).Result()
}

func (r *RedisClient) IncrementStats(ctx context.Context, statKey string, value int64) error {
	key := ReconciliationStatsPrefix + statKey
	return r.client.IncrBy(ctx, key, value).Err()
}

func (r *RedisClient) GetStats(ctx context.Context, statKey string) (int64, error) {
	key := ReconciliationStatsPrefix + statKey
	return r.client.Get(ctx, key).Int64()
}

func (r *RedisClient) SetVarianceAlert(ctx context.Context, jobID string, variance float64, threshold float64) error {
	key := VarianceAlertPrefix + jobID
	data := map[string]interface{}{
		"job_id":    jobID,
		"variance":  variance,
		"threshold": threshold,
		"exceeded":  variance > threshold,
		"timestamp": time.Now().Unix(),
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, key, jsonData, 24*time.Hour).Err()
}

func (r *RedisClient) GetActiveAlerts(ctx context.Context) ([]map[string]interface{}, error) {
	keys, err := r.client.Keys(ctx, VarianceAlertPrefix+"*").Result()
	if err != nil {
		return nil, err
	}

	var alerts []map[string]interface{}
	for _, key := range keys {
		data, err := r.client.Get(ctx, key).Bytes()
		if err != nil {
			continue
		}

		var alert map[string]interface{}
		if err := json.Unmarshal(data, &alert); err != nil {
			continue
		}

		if exceeded, ok := alert["exceeded"].(bool); ok && exceeded {
			alerts = append(alerts, alert)
		}
	}

	return alerts, nil
}

func (r *RedisClient) CacheStatement(ctx context.Context, statementID string, data interface{}, ttl time.Duration) error {
	key := StatementCachePrefix + statementID

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	return r.client.Set(ctx, key, jsonData, ttl).Err()
}

func (r *RedisClient) GetCachedStatement(ctx context.Context, statementID string) (map[string]interface{}, error) {
	key := StatementCachePrefix + statementID

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *RedisClient) PublishReconciliationUpdate(ctx context.Context, channel string, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	return r.client.Publish(ctx, channel, data).Err()
}

func (r *RedisClient) SubscribeToUpdates(ctx context.Context, channel string, handler func(message string)) error {
	pubsub := r.client.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg := <-ch:
			handler(msg.Payload)
		}
	}
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}
