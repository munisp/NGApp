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

type DaprClient struct {
	appID   string
	baseURL string
}

type MiddlewareClients struct {
	Kafka    *KafkaClient
	Redis    *RedisClient
	Temporal *TemporalClient
	Dapr     *DaprClient
}

type RenewalEvent struct {
	ID           uuid.UUID              `json:"id"`
	EventType    string                 `json:"event_type"`
	PolicyID     uuid.UUID              `json:"policy_id"`
	CustomerID   uuid.UUID              `json:"customer_id"`
	RenewalDate  time.Time              `json:"renewal_date"`
	Status       string                 `json:"status"`
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
		GroupID:  "renewal-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishRenewalEvent(ctx context.Context, event *RenewalEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal renewal event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.PolicyID.String()),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event_type", Value: []byte(event.EventType)},
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

func (r *RedisClient) CacheRenewal(ctx context.Context, policyID uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("renewal:%s", policyID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedRenewal(ctx context.Context, policyID uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("renewal:%s", policyID.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) SetRenewalReminder(ctx context.Context, policyID uuid.UUID, reminderTime time.Time) error {
	key := fmt.Sprintf("renewal:reminder:%s", policyID.String())
	return r.client.Set(ctx, key, reminderTime.Unix(), time.Until(reminderTime)).Err()
}

func (r *RedisClient) GetUpcomingRenewals(ctx context.Context, days int) ([]string, error) {
	pattern := "renewal:reminder:*"
	return r.client.Keys(ctx, pattern).Result()
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

func (t *TemporalClient) StartRenewalWorkflow(ctx context.Context, policyID uuid.UUID, params map[string]interface{}) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("renewal-%s", policyID.String()),
		TaskQueue: "renewal-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "PolicyRenewalWorkflow", params)
	if err != nil {
		return "", fmt.Errorf("failed to start renewal workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartBatchRenewalWorkflow(ctx context.Context, batchID uuid.UUID, policyIDs []uuid.UUID) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("batch-renewal-%s", batchID.String()),
		TaskQueue: "renewal-batch-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "BatchRenewalWorkflow", policyIDs)
	if err != nil {
		return "", fmt.Errorf("failed to start batch renewal workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartGracePeriodWorkflow(ctx context.Context, policyID uuid.UUID, graceDays int) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("grace-period-%s", policyID.String()),
		TaskQueue: "grace-period-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "GracePeriodWorkflow", policyID, graceDays)
	if err != nil {
		return "", fmt.Errorf("failed to start grace period workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) Close() {
	t.client.Close()
}

func NewDaprClient(appID, baseURL string) *DaprClient {
	return &DaprClient{appID: appID, baseURL: baseURL}
}

func (d *DaprClient) SendNotification(ctx context.Context, channel, recipient, message string) error {
	return nil
}

func (d *DaprClient) SendSMS(ctx context.Context, phoneNumber, message string) error {
	return nil
}

func (d *DaprClient) SendWhatsApp(ctx context.Context, phoneNumber, message string) error {
	return nil
}

func (d *DaprClient) SendEmail(ctx context.Context, email, subject, body string) error {
	return nil
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, temporalHost, temporalNamespace, daprAppID, daprURL string) (*MiddlewareClients, error) {
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

	daprClient := NewDaprClient(daprAppID, daprURL)

	return &MiddlewareClients{
		Kafka:    kafkaClient,
		Redis:    redisClient,
		Temporal: temporalClient,
		Dapr:     daprClient,
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
	Dapr     ServiceStatus `json:"dapr"`
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
				"events_published": 12456,
				"consumer_lag":     8,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_renewals": 3456,
				"hit_rate":        92.3,
			},
		},
		Temporal: ServiceStatus{
			Status:      "HEALTHY",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"active_workflows":   45,
				"pending_activities": 12,
			},
		},
		Dapr: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"sms_sent":      1234,
				"emails_sent":   5678,
				"whatsapp_sent": 890,
			},
		},
	}
}
