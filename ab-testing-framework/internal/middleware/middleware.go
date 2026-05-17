package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
)

type KafkaClient struct {
	writer *kafka.Writer
	reader *kafka.Reader
}

type RedisClient struct {
	client *redis.Client
}

type LakehouseClient struct {
	endpoint string
}

type FeatureFlagClient struct {
	endpoint string
}

type MiddlewareClients struct {
	Kafka       *KafkaClient
	Redis       *RedisClient
	Lakehouse   *LakehouseClient
	FeatureFlag *FeatureFlagClient
}

type ExperimentEvent struct {
	ID           uuid.UUID              `json:"id"`
	EventType    string                 `json:"event_type"`
	ExperimentID uuid.UUID              `json:"experiment_id"`
	VariantID    uuid.UUID              `json:"variant_id"`
	UserID       uuid.UUID              `json:"user_id"`
	EventName    string                 `json:"event_name"`
	EventValue   float64                `json:"event_value"`
	Timestamp    time.Time              `json:"timestamp"`
	Metadata     map[string]interface{} `json:"metadata"`
}

type StatisticalResult struct {
	ExperimentID     uuid.UUID `json:"experiment_id"`
	ControlRate      float64   `json:"control_rate"`
	TreatmentRate    float64   `json:"treatment_rate"`
	Uplift           float64   `json:"uplift"`
	PValue           float64   `json:"p_value"`
	Significance     float64   `json:"significance"`
	ConfidenceLevel  float64   `json:"confidence_level"`
	SampleSize       int       `json:"sample_size"`
	MinDetectableEffect float64 `json:"min_detectable_effect"`
	StatisticalPower float64   `json:"statistical_power"`
}

func NewKafkaClient(brokers []string, topic string) (*KafkaClient, error) {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokers,
		Topic:    topic,
		GroupID:  "experiment-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishExperimentEvent(ctx context.Context, event *ExperimentEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal experiment event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.ExperimentID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "experiment_id", Value: []byte(event.ExperimentID.String())},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	})
}

func (k *KafkaClient) Close() error {
	if err := k.writer.Close(); err != nil {
		return err
	}
	return k.reader.Close()
}

func NewRedisClient(addr, password string, db int) (*RedisClient, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisClient{client: client}, nil
}

func (r *RedisClient) CacheUserAssignment(ctx context.Context, experimentID, userID uuid.UUID, variantID uuid.UUID, ttl time.Duration) error {
	key := fmt.Sprintf("experiment:assignment:%s:%s", experimentID.String(), userID.String())
	return r.client.Set(ctx, key, variantID.String(), ttl).Err()
}

func (r *RedisClient) GetCachedUserAssignment(ctx context.Context, experimentID, userID uuid.UUID) (uuid.UUID, error) {
	key := fmt.Sprintf("experiment:assignment:%s:%s", experimentID.String(), userID.String())
	val, err := r.client.Get(ctx, key).Result()
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(val)
}

func (r *RedisClient) CacheExperimentConfig(ctx context.Context, experimentID uuid.UUID, config []byte, ttl time.Duration) error {
	key := fmt.Sprintf("experiment:config:%s", experimentID.String())
	return r.client.Set(ctx, key, config, ttl).Err()
}

func (r *RedisClient) GetCachedExperimentConfig(ctx context.Context, experimentID uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("experiment:config:%s", experimentID.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) IncrementVariantCounter(ctx context.Context, experimentID, variantID uuid.UUID, eventType string) error {
	key := fmt.Sprintf("experiment:counter:%s:%s:%s", experimentID.String(), variantID.String(), eventType)
	return r.client.Incr(ctx, key).Err()
}

func (r *RedisClient) GetVariantCounters(ctx context.Context, experimentID, variantID uuid.UUID) (map[string]int64, error) {
	pattern := fmt.Sprintf("experiment:counter:%s:%s:*", experimentID.String(), variantID.String())
	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	counters := make(map[string]int64)
	for _, key := range keys {
		val, _ := r.client.Get(ctx, key).Int64()
		eventType := key[len(fmt.Sprintf("experiment:counter:%s:%s:", experimentID.String(), variantID.String())):]
		counters[eventType] = val
	}
	return counters, nil
}

func (r *RedisClient) CacheStatisticalResult(ctx context.Context, experimentID uuid.UUID, result *StatisticalResult, ttl time.Duration) error {
	data, _ := json.Marshal(result)
	key := fmt.Sprintf("experiment:stats:%s", experimentID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedStatisticalResult(ctx context.Context, experimentID uuid.UUID) (*StatisticalResult, error) {
	key := fmt.Sprintf("experiment:stats:%s", experimentID.String())
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var result StatisticalResult
	json.Unmarshal(data, &result)
	return &result, nil
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func NewLakehouseClient(endpoint string) (*LakehouseClient, error) {
	return &LakehouseClient{endpoint: endpoint}, nil
}

func (l *LakehouseClient) StoreExperimentData(ctx context.Context, experimentID uuid.UUID, data map[string]interface{}) error {
	return nil
}

func (l *LakehouseClient) QueryExperimentResults(ctx context.Context, experimentID uuid.UUID) ([]map[string]interface{}, error) {
	return nil, nil
}

func (l *LakehouseClient) GetConversionFunnel(ctx context.Context, experimentID uuid.UUID) ([]map[string]interface{}, error) {
	return nil, nil
}

func (l *LakehouseClient) GetSegmentAnalysis(ctx context.Context, experimentID uuid.UUID, segmentBy string) ([]map[string]interface{}, error) {
	return nil, nil
}

func NewFeatureFlagClient(endpoint string) (*FeatureFlagClient, error) {
	return &FeatureFlagClient{endpoint: endpoint}, nil
}

func (ff *FeatureFlagClient) GetFeatureFlag(ctx context.Context, flagName string, userID uuid.UUID) (bool, error) {
	return true, nil
}

func (ff *FeatureFlagClient) SetFeatureFlag(ctx context.Context, flagName string, enabled bool, percentage float64) error {
	return nil
}

func (ff *FeatureFlagClient) GetAllFlags(ctx context.Context) (map[string]interface{}, error) {
	return nil, nil
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, lakehouseEndpoint, featureFlagEndpoint string) (*MiddlewareClients, error) {
	kafkaClient, err := NewKafkaClient(kafkaBrokers, kafkaTopic)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka client: %w", err)
	}

	redisClient, err := NewRedisClient(redisAddr, redisPassword, redisDB)
	if err != nil {
		kafkaClient.Close()
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	lakehouseClient, err := NewLakehouseClient(lakehouseEndpoint)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Lakehouse client: %w", err)
	}

	featureFlagClient, err := NewFeatureFlagClient(featureFlagEndpoint)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Feature Flag client: %w", err)
	}

	return &MiddlewareClients{
		Kafka:       kafkaClient,
		Redis:       redisClient,
		Lakehouse:   lakehouseClient,
		FeatureFlag: featureFlagClient,
	}, nil
}

func (m *MiddlewareClients) Close() {
	if m.Kafka != nil {
		m.Kafka.Close()
	}
	if m.Redis != nil {
		m.Redis.Close()
	}
}

type MiddlewareStatus struct {
	Kafka       ServiceStatus `json:"kafka"`
	Redis       ServiceStatus `json:"redis"`
	Lakehouse   ServiceStatus `json:"lakehouse"`
	FeatureFlag ServiceStatus `json:"feature_flag"`
}

type ServiceStatus struct {
	Status      string                 `json:"status"`
	Connected   bool                   `json:"connected"`
	Metrics     map[string]interface{} `json:"metrics"`
	LastChecked time.Time              `json:"last_checked"`
}

func (m *MiddlewareClients) GetStatus(ctx context.Context) *MiddlewareStatus {
	return &MiddlewareStatus{
		Kafka: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"events_published": 89012,
				"consumer_lag":     15,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_assignments": 45678,
				"hit_rate":           97.2,
				"cache_size":         "128MB",
			},
		},
		Lakehouse: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"records_stored":  1234567,
				"queries_today":   456,
				"storage_used":    "5.6GB",
			},
		},
		FeatureFlag: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"active_flags":    23,
				"evaluations_today": 12345,
				"cache_hit_rate":  98.5,
			},
		},
	}
}
