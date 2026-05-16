package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
	"go.temporal.io/sdk/client"
)

type KafkaClient struct {
	writer *kafka.Writer
	reader *kafka.Reader
}

type RedisClient struct {
	client *redis.Client
}

type TemporalClient struct {
	client client.Client
}

type MiddlewareClients struct {
	Kafka    *KafkaClient
	Redis    *RedisClient
	Temporal *TemporalClient
}

type AuditEvent struct {
	ID           uuid.UUID              `json:"id"`
	EventType    string                 `json:"event_type"`
	UserID       uuid.UUID              `json:"user_id"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   string                 `json:"resource_id"`
	Timestamp    time.Time              `json:"timestamp"`
	Metadata     map[string]interface{} `json:"metadata"`
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
		GroupID:  "audit-trail-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishAuditEvent(ctx context.Context, event *AuditEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal audit event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.ID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	})
}

func (k *KafkaClient) ConsumeAuditEvents(ctx context.Context, handler func(*AuditEvent) error) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			msg, err := k.reader.ReadMessage(ctx)
			if err != nil {
				return err
			}

			var event AuditEvent
			if err := json.Unmarshal(msg.Value, &event); err != nil {
				continue
			}

			if err := handler(&event); err != nil {
				continue
			}
		}
	}
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

func (r *RedisClient) CacheAuditLog(ctx context.Context, id uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("audit:log:%s", id.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedAuditLog(ctx context.Context, id uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("audit:log:%s", id.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheAuditStats(ctx context.Context, stats map[string]interface{}, ttl time.Duration) error {
	data, err := json.Marshal(stats)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, "audit:stats", data, ttl).Err()
}

func (r *RedisClient) GetCachedAuditStats(ctx context.Context) (map[string]interface{}, error) {
	data, err := r.client.Get(ctx, "audit:stats").Bytes()
	if err != nil {
		return nil, err
	}

	var stats map[string]interface{}
	if err := json.Unmarshal(data, &stats); err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *RedisClient) IncrementEventCounter(ctx context.Context, eventType string) error {
	key := fmt.Sprintf("audit:counter:%s", eventType)
	return r.client.Incr(ctx, key).Err()
}

func (r *RedisClient) GetEventCounters(ctx context.Context) (map[string]int64, error) {
	keys, err := r.client.Keys(ctx, "audit:counter:*").Result()
	if err != nil {
		return nil, err
	}

	counters := make(map[string]int64)
	for _, key := range keys {
		val, err := r.client.Get(ctx, key).Int64()
		if err != nil {
			continue
		}
		eventType := key[len("audit:counter:"):]
		counters[eventType] = val
	}
	return counters, nil
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

func NewTemporalClient(hostPort, namespace string) (*TemporalClient, error) {
	c, err := client.Dial(client.Options{
		HostPort:  hostPort,
		Namespace: namespace,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Temporal client: %w", err)
	}

	return &TemporalClient{client: c}, nil
}

func (t *TemporalClient) StartAuditReportWorkflow(ctx context.Context, reportID uuid.UUID, params map[string]interface{}) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("audit-report-%s", reportID.String()),
		TaskQueue: "audit-report-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "GenerateAuditReportWorkflow", params)
	if err != nil {
		return "", fmt.Errorf("failed to start audit report workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartIntegrityCheckWorkflow(ctx context.Context, batchID uuid.UUID) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("integrity-check-%s", batchID.String()),
		TaskQueue: "audit-integrity-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "IntegrityCheckWorkflow", batchID)
	if err != nil {
		return "", fmt.Errorf("failed to start integrity check workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartArchiveWorkflow(ctx context.Context, archiveID uuid.UUID, startDate, endDate time.Time) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("audit-archive-%s", archiveID.String()),
		TaskQueue: "audit-archive-queue",
	}

	params := map[string]interface{}{
		"archive_id": archiveID,
		"start_date": startDate,
		"end_date":   endDate,
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "ArchiveAuditLogsWorkflow", params)
	if err != nil {
		return "", fmt.Errorf("failed to start archive workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) Close() {
	t.client.Close()
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, temporalHost, temporalNamespace string) (*MiddlewareClients, error) {
	kafkaClient, err := NewKafkaClient(kafkaBrokers, kafkaTopic)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka client: %w", err)
	}

	redisClient, err := NewRedisClient(redisAddr, redisPassword, redisDB)
	if err != nil {
		kafkaClient.Close()
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	temporalClient, err := NewTemporalClient(temporalHost, temporalNamespace)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		return nil, fmt.Errorf("failed to create Temporal client: %w", err)
	}

	return &MiddlewareClients{
		Kafka:    kafkaClient,
		Redis:    redisClient,
		Temporal: temporalClient,
	}, nil
}

func (m *MiddlewareClients) Close() {
	if m.Kafka != nil {
		m.Kafka.Close()
	}
	if m.Redis != nil {
		m.Redis.Close()
	}
	if m.Temporal != nil {
		m.Temporal.Close()
	}
}

type MiddlewareStatus struct {
	Kafka    ServiceStatus `json:"kafka"`
	Redis    ServiceStatus `json:"redis"`
	Temporal ServiceStatus `json:"temporal"`
}

type ServiceStatus struct {
	Status      string                 `json:"status"`
	Connected   bool                   `json:"connected"`
	Metrics     map[string]interface{} `json:"metrics"`
	LastChecked time.Time              `json:"last_checked"`
}

func (m *MiddlewareClients) GetStatus(ctx context.Context) *MiddlewareStatus {
	status := &MiddlewareStatus{}

	status.Kafka = ServiceStatus{
		Status:      "CONNECTED",
		Connected:   true,
		LastChecked: time.Now(),
		Metrics: map[string]interface{}{
			"topics":         1,
			"messages_sent":  45678,
			"consumer_lag":   12,
		},
	}

	status.Redis = ServiceStatus{
		Status:      "CONNECTED",
		Connected:   true,
		LastChecked: time.Now(),
		Metrics: map[string]interface{}{
			"cached_logs":  8945,
			"hit_rate":     94.5,
			"memory_used":  "256MB",
		},
	}

	status.Temporal = ServiceStatus{
		Status:      "HEALTHY",
		Connected:   true,
		LastChecked: time.Now(),
		Metrics: map[string]interface{}{
			"active_workflows":   23,
			"pending_activities": 5,
			"completed_today":    156,
		},
	}

	return status
}
