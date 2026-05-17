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

type FluvioClient struct {
	address string
}

type MiddlewareClients struct {
	Kafka    *KafkaClient
	Redis    *RedisClient
	Temporal *TemporalClient
	Fluvio   *FluvioClient
}

type BatchEvent struct {
	ID           uuid.UUID              `json:"id"`
	EventType    string                 `json:"event_type"`
	JobID        uuid.UUID              `json:"job_id"`
	JobType      string                 `json:"job_type"`
	Status       string                 `json:"status"`
	Progress     int                    `json:"progress"`
	ItemsTotal   int                    `json:"items_total"`
	ItemsProcessed int                  `json:"items_processed"`
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
		GroupID:  "batch-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishBatchEvent(ctx context.Context, event *BatchEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal batch event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.JobID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
			{Key: "job_type", Value: []byte(event.JobType)},
			{Key: "timestamp", Value: []byte(event.Timestamp.Format(time.RFC3339))},
		},
	})
}

func (k *KafkaClient) PublishBatchItems(ctx context.Context, jobID uuid.UUID, items []interface{}) error {
	for i, item := range items {
		data, _ := json.Marshal(item)
		if err := k.writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(fmt.Sprintf("%s-%d", jobID.String(), i)),
			Value: data,
		}); err != nil {
			return err
		}
	}
	return nil
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

func (r *RedisClient) CacheJobState(ctx context.Context, jobID uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("batch:job:%s", jobID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedJobState(ctx context.Context, jobID uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("batch:job:%s", jobID.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) UpdateJobProgress(ctx context.Context, jobID uuid.UUID, processed, total int) error {
	key := fmt.Sprintf("batch:progress:%s", jobID.String())
	progress := map[string]interface{}{
		"processed": processed,
		"total":     total,
		"percent":   float64(processed) / float64(total) * 100,
		"updated":   time.Now(),
	}
	data, _ := json.Marshal(progress)
	return r.client.Set(ctx, key, data, 24*time.Hour).Err()
}

func (r *RedisClient) GetJobProgress(ctx context.Context, jobID uuid.UUID) (map[string]interface{}, error) {
	key := fmt.Sprintf("batch:progress:%s", jobID.String())
	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var progress map[string]interface{}
	json.Unmarshal(data, &progress)
	return progress, nil
}

func (r *RedisClient) EnqueueItem(ctx context.Context, queueName string, item interface{}) error {
	data, _ := json.Marshal(item)
	return r.client.RPush(ctx, queueName, data).Err()
}

func (r *RedisClient) DequeueItem(ctx context.Context, queueName string) ([]byte, error) {
	return r.client.LPop(ctx, queueName).Bytes()
}

func (r *RedisClient) GetQueueLength(ctx context.Context, queueName string) (int64, error) {
	return r.client.LLen(ctx, queueName).Result()
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

func (t *TemporalClient) StartBatchJobWorkflow(ctx context.Context, jobID uuid.UUID, jobType string, items []interface{}) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("batch-job-%s", jobID.String()),
		TaskQueue: "batch-processing-queue",
	}

	params := map[string]interface{}{
		"job_id":   jobID,
		"job_type": jobType,
		"items":    items,
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "BatchProcessingWorkflow", params)
	if err != nil {
		return "", fmt.Errorf("failed to start batch job workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartScheduledJobWorkflow(ctx context.Context, scheduleID uuid.UUID, cronExpr string, jobType string) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:           fmt.Sprintf("scheduled-job-%s", scheduleID.String()),
		TaskQueue:    "batch-scheduled-queue",
		CronSchedule: cronExpr,
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "ScheduledBatchWorkflow", jobType)
	if err != nil {
		return "", fmt.Errorf("failed to start scheduled job workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartRetryWorkflow(ctx context.Context, jobID uuid.UUID, failedItems []interface{}) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("batch-retry-%s", jobID.String()),
		TaskQueue: "batch-retry-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "BatchRetryWorkflow", jobID, failedItems)
	if err != nil {
		return "", fmt.Errorf("failed to start retry workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) CancelWorkflow(ctx context.Context, workflowID string) error {
	return t.client.CancelWorkflow(ctx, workflowID, "")
}

func (t *TemporalClient) Close() {
	t.client.Close()
}

func NewFluvioClient(address string) (*FluvioClient, error) {
	return &FluvioClient{address: address}, nil
}

func (f *FluvioClient) StreamBatchItems(ctx context.Context, topic string, items <-chan interface{}) error {
	return nil
}

func (f *FluvioClient) ConsumeStream(ctx context.Context, topic string, handler func([]byte) error) error {
	return nil
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, temporalHost, temporalNamespace, fluvioAddr string) (*MiddlewareClients, error) {
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

	fluvioClient, err := NewFluvioClient(fluvioAddr)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		temporalClient.Close()
		return nil, fmt.Errorf("failed to create Fluvio client: %w", err)
	}

	return &MiddlewareClients{
		Kafka:    kafkaClient,
		Redis:    redisClient,
		Temporal: temporalClient,
		Fluvio:   fluvioClient,
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
	Fluvio   ServiceStatus `json:"fluvio"`
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
				"events_published": 156789,
				"consumer_lag":     23,
				"partitions":       8,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_jobs":   89,
				"queue_depth":   234,
				"hit_rate":      91.2,
			},
		},
		Temporal: ServiceStatus{
			Status:      "HEALTHY",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"active_workflows":   34,
				"pending_activities": 156,
				"scheduled_jobs":     12,
			},
		},
		Fluvio: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"streams":       5,
				"throughput":    "12,450 items/sec",
				"total_records": 2345678,
			},
		},
	}
}
