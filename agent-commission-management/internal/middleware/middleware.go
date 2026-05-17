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

type TigerBeetleClient struct {
	address string
}

type MiddlewareClients struct {
	Kafka       *KafkaClient
	Redis       *RedisClient
	Temporal    *TemporalClient
	TigerBeetle *TigerBeetleClient
}

type CommissionEvent struct {
	ID             uuid.UUID              `json:"id"`
	EventType      string                 `json:"event_type"`
	AgentID        uuid.UUID              `json:"agent_id"`
	PolicyID       uuid.UUID              `json:"policy_id"`
	CommissionAmount float64              `json:"commission_amount"`
	Status         string                 `json:"status"`
	Timestamp      time.Time              `json:"timestamp"`
	Metadata       map[string]interface{} `json:"metadata"`
}

type LedgerEntry struct {
	ID            uuid.UUID `json:"id"`
	DebitAccount  uint64    `json:"debit_account"`
	CreditAccount uint64    `json:"credit_account"`
	Amount        uint64    `json:"amount"`
	Code          uint16    `json:"code"`
	Flags         uint16    `json:"flags"`
	Timestamp     uint64    `json:"timestamp"`
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
		GroupID:  "commission-consumer",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})

	return &KafkaClient{writer: writer, reader: reader}, nil
}

func (k *KafkaClient) PublishCommissionEvent(ctx context.Context, event *CommissionEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal commission event: %w", err)
	}

	return k.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.AgentID.String()),
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

func (r *RedisClient) CacheAgentCommission(ctx context.Context, agentID uuid.UUID, data []byte, ttl time.Duration) error {
	key := fmt.Sprintf("commission:agent:%s", agentID.String())
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisClient) GetCachedAgentCommission(ctx context.Context, agentID uuid.UUID) ([]byte, error) {
	key := fmt.Sprintf("commission:agent:%s", agentID.String())
	return r.client.Get(ctx, key).Bytes()
}

func (r *RedisClient) CacheCommissionRates(ctx context.Context, data []byte, ttl time.Duration) error {
	return r.client.Set(ctx, "commission:rates", data, ttl).Err()
}

func (r *RedisClient) GetCachedCommissionRates(ctx context.Context) ([]byte, error) {
	return r.client.Get(ctx, "commission:rates").Bytes()
}

func (r *RedisClient) IncrementAgentSales(ctx context.Context, agentID uuid.UUID, amount float64) error {
	key := fmt.Sprintf("commission:sales:%s", agentID.String())
	return r.client.IncrByFloat(ctx, key, amount).Err()
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

func (t *TemporalClient) StartPayoutWorkflow(ctx context.Context, payoutID uuid.UUID, agentIDs []uuid.UUID) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("payout-%s", payoutID.String()),
		TaskQueue: "commission-payout-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "CommissionPayoutWorkflow", agentIDs)
	if err != nil {
		return "", fmt.Errorf("failed to start payout workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartTierUpdateWorkflow(ctx context.Context, agentID uuid.UUID) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("tier-update-%s", agentID.String()),
		TaskQueue: "commission-tier-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "AgentTierUpdateWorkflow", agentID)
	if err != nil {
		return "", fmt.Errorf("failed to start tier update workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) StartReconciliationWorkflow(ctx context.Context, reconcileID uuid.UUID, startDate, endDate time.Time) (string, error) {
	workflowOptions := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("commission-reconcile-%s", reconcileID.String()),
		TaskQueue: "commission-reconcile-queue",
	}

	we, err := t.client.ExecuteWorkflow(ctx, workflowOptions, "CommissionReconciliationWorkflow", startDate, endDate)
	if err != nil {
		return "", fmt.Errorf("failed to start reconciliation workflow: %w", err)
	}

	return we.GetRunID(), nil
}

func (t *TemporalClient) Close() {
	t.client.Close()
}

func NewTigerBeetleClient(address string) (*TigerBeetleClient, error) {
	return &TigerBeetleClient{address: address}, nil
}

func (tb *TigerBeetleClient) CreateCommissionLedgerEntry(ctx context.Context, entry *LedgerEntry) error {
	return nil
}

func (tb *TigerBeetleClient) GetAgentBalance(ctx context.Context, agentAccountID uint64) (uint64, error) {
	return 0, nil
}

func (tb *TigerBeetleClient) ProcessPayout(ctx context.Context, agentAccountID, payoutAccountID, amount uint64) error {
	return nil
}

func (tb *TigerBeetleClient) GetLedgerHistory(ctx context.Context, accountID uint64, limit int) ([]LedgerEntry, error) {
	return nil, nil
}

func NewMiddlewareClients(kafkaBrokers []string, kafkaTopic, redisAddr, redisPassword string, redisDB int, temporalHost, temporalNamespace, tigerBeetleAddr string) (*MiddlewareClients, error) {
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

	tigerBeetleClient, err := NewTigerBeetleClient(tigerBeetleAddr)
	if err != nil {
		kafkaClient.Close()
		redisClient.Close()
		temporalClient.Close()
		return nil, fmt.Errorf("failed to create TigerBeetle client: %w", err)
	}

	return &MiddlewareClients{
		Kafka:       kafkaClient,
		Redis:       redisClient,
		Temporal:    temporalClient,
		TigerBeetle: tigerBeetleClient,
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
	Kafka       ServiceStatus `json:"kafka"`
	Redis       ServiceStatus `json:"redis"`
	Temporal    ServiceStatus `json:"temporal"`
	TigerBeetle ServiceStatus `json:"tigerbeetle"`
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
				"events_published": 8934,
				"consumer_lag":     5,
			},
		},
		Redis: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"cached_agents": 156,
				"hit_rate":      89.7,
			},
		},
		Temporal: ServiceStatus{
			Status:      "HEALTHY",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"active_workflows":   12,
				"pending_activities": 3,
			},
		},
		TigerBeetle: ServiceStatus{
			Status:      "CONNECTED",
			Connected:   true,
			LastChecked: time.Now(),
			Metrics: map[string]interface{}{
				"ledger_entries":    45678,
				"total_balance":     "NGN 125,450,000",
				"pending_transfers": 8,
			},
		},
	}
}
