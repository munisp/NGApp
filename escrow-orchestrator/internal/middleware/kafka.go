package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/rs/zerolog/log"
)

// KafkaClient wraps Kafka producer/consumer functionality
type KafkaClient struct {
	cfg       *config.Config
	connected bool
	mu        sync.RWMutex
}

// KafkaMessage represents a Kafka message
type KafkaMessage struct {
	Topic     string            `json:"topic"`
	Key       string            `json:"key"`
	Value     []byte            `json:"value"`
	Headers   map[string]string `json:"headers"`
	Timestamp time.Time         `json:"timestamp"`
}

// EscrowEvent represents an escrow domain event
type EscrowEvent struct {
	EventID     string                 `json:"event_id"`
	EventType   string                 `json:"event_type"`
	AggregateID string                 `json:"aggregate_id"`
	Timestamp   time.Time              `json:"timestamp"`
	Version     int                    `json:"version"`
	Data        map[string]interface{} `json:"data"`
	Metadata    map[string]string      `json:"metadata"`
}

// NewKafkaClient creates a new Kafka client
func NewKafkaClient(cfg *config.Config) *KafkaClient {
	return &KafkaClient{
		cfg:       cfg,
		connected: false,
	}
}

// Connect establishes connection to Kafka
func (k *KafkaClient) Connect(ctx context.Context) error {
	k.mu.Lock()
	defer k.mu.Unlock()

	log.Info().
		Str("bootstrap_servers", k.cfg.KafkaBootstrapServers).
		Msg("Connecting to Kafka")

	// In production, this would use confluent-kafka-go
	// For now, we simulate connection
	k.connected = true
	log.Info().Msg("Kafka client connected")
	return nil
}

// IsConnected returns connection status
func (k *KafkaClient) IsConnected() bool {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.connected
}

// PublishEvent publishes an escrow event to Kafka
func (k *KafkaClient) PublishEvent(ctx context.Context, event EscrowEvent) error {
	if !k.IsConnected() {
		return fmt.Errorf("kafka not connected")
	}

	topic := fmt.Sprintf("%s.%s", k.cfg.KafkaTopicPrefix, event.EventType)
	
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	log.Debug().
		Str("topic", topic).
		Str("event_id", event.EventID).
		Str("event_type", event.EventType).
		Msg("Publishing event to Kafka")

	// In production, this would use the actual Kafka producer
	// producer.Produce(&kafka.Message{
	//     TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
	//     Key:            []byte(event.AggregateID),
	//     Value:          payload,
	// }, nil)

	_ = payload // Placeholder for actual implementation
	return nil
}

// PublishEscrowCreated publishes escrow.created event
func (k *KafkaClient) PublishEscrowCreated(ctx context.Context, escrowID string, data map[string]interface{}) error {
	return k.PublishEvent(ctx, EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType:   "escrow.created",
		AggregateID: escrowID,
		Timestamp:   time.Now(),
		Version:     1,
		Data:        data,
		Metadata:    map[string]string{"source": "orchestrator"},
	})
}

// PublishEscrowFunded publishes escrow.funded event
func (k *KafkaClient) PublishEscrowFunded(ctx context.Context, escrowID string, amount float64) error {
	return k.PublishEvent(ctx, EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType:   "escrow.funded",
		AggregateID: escrowID,
		Timestamp:   time.Now(),
		Version:     1,
		Data:        map[string]interface{}{"amount": amount},
		Metadata:    map[string]string{"source": "orchestrator"},
	})
}

// PublishEscrowReleased publishes escrow.released event
func (k *KafkaClient) PublishEscrowReleased(ctx context.Context, escrowID string, amount float64) error {
	return k.PublishEvent(ctx, EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType:   "escrow.released",
		AggregateID: escrowID,
		Timestamp:   time.Now(),
		Version:     1,
		Data:        map[string]interface{}{"amount": amount},
		Metadata:    map[string]string{"source": "orchestrator"},
	})
}

// PublishDisputeOpened publishes dispute.opened event
func (k *KafkaClient) PublishDisputeOpened(ctx context.Context, escrowID, disputeID, reason string) error {
	return k.PublishEvent(ctx, EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType:   "dispute.opened",
		AggregateID: escrowID,
		Timestamp:   time.Now(),
		Version:     1,
		Data:        map[string]interface{}{"dispute_id": disputeID, "reason": reason},
		Metadata:    map[string]string{"source": "orchestrator"},
	})
}

// PublishPayoutInitiated publishes payout.initiated event
func (k *KafkaClient) PublishPayoutInitiated(ctx context.Context, escrowID, sellerID string, amount float64) error {
	return k.PublishEvent(ctx, EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", time.Now().UnixNano()),
		EventType:   "payout.initiated",
		AggregateID: escrowID,
		Timestamp:   time.Now(),
		Version:     1,
		Data:        map[string]interface{}{"seller_id": sellerID, "amount": amount},
		Metadata:    map[string]string{"source": "orchestrator"},
	})
}

// Close closes the Kafka client
func (k *KafkaClient) Close() error {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.connected = false
	log.Info().Msg("Kafka client closed")
	return nil
}

// Topics returns the list of topics used by the orchestrator
func (k *KafkaClient) Topics() []string {
	prefix := k.cfg.KafkaTopicPrefix
	return []string{
		fmt.Sprintf("%s.escrow.created", prefix),
		fmt.Sprintf("%s.escrow.funded", prefix),
		fmt.Sprintf("%s.escrow.accepted", prefix),
		fmt.Sprintf("%s.escrow.shipped", prefix),
		fmt.Sprintf("%s.escrow.delivered", prefix),
		fmt.Sprintf("%s.escrow.released", prefix),
		fmt.Sprintf("%s.escrow.refunded", prefix),
		fmt.Sprintf("%s.escrow.expired", prefix),
		fmt.Sprintf("%s.escrow.cancelled", prefix),
		fmt.Sprintf("%s.dispute.opened", prefix),
		fmt.Sprintf("%s.dispute.resolved", prefix),
		fmt.Sprintf("%s.payout.initiated", prefix),
		fmt.Sprintf("%s.payout.completed", prefix),
		fmt.Sprintf("%s.kyc.required", prefix),
		fmt.Sprintf("%s.kyc.completed", prefix),
		fmt.Sprintf("%s.fraud.detected", prefix),
		fmt.Sprintf("%s.agent.assigned", prefix),
	}
}
