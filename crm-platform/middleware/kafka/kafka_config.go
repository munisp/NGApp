package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// Kafka middleware — topic management, consumer groups, dead letter queues,
// schema registry, and event-driven communication between CRM services

type KafkaConfig struct {
	Brokers          []string `json:"brokers"`
	SchemaRegistryURL string  `json:"schema_registry_url"`
	SecurityProtocol string   `json:"security_protocol"`
	SASLMechanism    string   `json:"sasl_mechanism"`
	SASLUsername     string   `json:"sasl_username"`
	SASLPassword     string   `json:"-"`
}

func DefaultKafkaConfig() *KafkaConfig {
	return &KafkaConfig{
		Brokers:           []string{"kafka-0.kafka.crm.svc:9092", "kafka-1.kafka.crm.svc:9092", "kafka-2.kafka.crm.svc:9092"},
		SchemaRegistryURL: "http://schema-registry.crm.svc:8081",
		SecurityProtocol:  "SASL_SSL",
		SASLMechanism:     "SCRAM-SHA-256",
		SASLUsername:      "crm-service",
	}
}

type TopicConfig struct {
	Name              string `json:"name"`
	Partitions        int    `json:"partitions"`
	ReplicationFactor int    `json:"replication_factor"`
	RetentionMs       int64  `json:"retention_ms"`
	CleanupPolicy     string `json:"cleanup_policy"`
	CompressionType   string `json:"compression_type"`
	MaxMessageBytes   int    `json:"max_message_bytes"`
}

// CRM Event Topics
func CRMTopics() []TopicConfig {
	return []TopicConfig{
		// Customer events
		{Name: "crm.customer.created", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.customer.updated", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.customer.deleted", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "compact", CompressionType: "lz4", MaxMessageBytes: 1048576},
		// Transaction events
		{Name: "crm.transaction.completed", Partitions: 24, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 2097152},
		{Name: "crm.transaction.failed", Partitions: 12, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 2097152},
		{Name: "crm.transaction.reversed", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 2097152},
		// Agent banking events
		{Name: "crm.agent.activated", Partitions: 6, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.agent.deactivated", Partitions: 6, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.agent.cashin", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 2097152},
		{Name: "crm.agent.cashout", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 2097152},
		// Remittance events
		{Name: "crm.remittance.initiated", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 2097152},
		{Name: "crm.remittance.completed", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 2097152},
		{Name: "crm.remittance.failed", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 2097152},
		// Campaign events
		{Name: "crm.campaign.created", Partitions: 6, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.campaign.sent", Partitions: 24, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 1048576},
		{Name: "crm.campaign.delivered", Partitions: 24, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 1048576},
		{Name: "crm.campaign.response", Partitions: 12, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		// KYC events
		{Name: "crm.kyc.submitted", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 5242880},
		{Name: "crm.kyc.approved", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.kyc.rejected", Partitions: 6, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		// Audit events
		{Name: "crm.audit.log", Partitions: 12, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 2097152},
		// Security events
		{Name: "crm.security.threat", Partitions: 6, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		{Name: "crm.security.auth", Partitions: 12, ReplicationFactor: 3, RetentionMs: 2592000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 1048576},
		// Notification events
		{Name: "crm.notification.send", Partitions: 24, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 1048576},
		{Name: "crm.notification.delivered", Partitions: 24, ReplicationFactor: 3, RetentionMs: 604800000, CleanupPolicy: "delete", CompressionType: "snappy", MaxMessageBytes: 524288},
		// Dead letter queues
		{Name: "crm.dlq.customer", Partitions: 3, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 5242880},
		{Name: "crm.dlq.transaction", Partitions: 3, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 5242880},
		{Name: "crm.dlq.campaign", Partitions: 3, ReplicationFactor: 3, RetentionMs: 7776000000, CleanupPolicy: "delete", CompressionType: "lz4", MaxMessageBytes: 5242880},
	}
}

// ConsumerGroup configuration
type ConsumerGroupConfig struct {
	GroupID          string   `json:"group_id"`
	Topics           []string `json:"topics"`
	AutoOffsetReset  string   `json:"auto_offset_reset"`
	MaxPollRecords   int      `json:"max_poll_records"`
	SessionTimeoutMs int      `json:"session_timeout_ms"`
}

func CRMConsumerGroups() []ConsumerGroupConfig {
	return []ConsumerGroupConfig{
		{GroupID: "crm-customer-processor", Topics: []string{"crm.customer.created", "crm.customer.updated", "crm.customer.deleted"}, AutoOffsetReset: "earliest", MaxPollRecords: 500, SessionTimeoutMs: 30000},
		{GroupID: "crm-transaction-processor", Topics: []string{"crm.transaction.completed", "crm.transaction.failed", "crm.transaction.reversed"}, AutoOffsetReset: "earliest", MaxPollRecords: 1000, SessionTimeoutMs: 30000},
		{GroupID: "crm-agent-processor", Topics: []string{"crm.agent.activated", "crm.agent.deactivated", "crm.agent.cashin", "crm.agent.cashout"}, AutoOffsetReset: "earliest", MaxPollRecords: 500, SessionTimeoutMs: 30000},
		{GroupID: "crm-campaign-processor", Topics: []string{"crm.campaign.sent", "crm.campaign.delivered", "crm.campaign.response"}, AutoOffsetReset: "latest", MaxPollRecords: 1000, SessionTimeoutMs: 30000},
		{GroupID: "crm-audit-processor", Topics: []string{"crm.audit.log"}, AutoOffsetReset: "earliest", MaxPollRecords: 500, SessionTimeoutMs: 30000},
		{GroupID: "crm-notification-processor", Topics: []string{"crm.notification.send"}, AutoOffsetReset: "latest", MaxPollRecords: 1000, SessionTimeoutMs: 15000},
		{GroupID: "crm-security-processor", Topics: []string{"crm.security.threat", "crm.security.auth"}, AutoOffsetReset: "earliest", MaxPollRecords: 200, SessionTimeoutMs: 30000},
		{GroupID: "crm-analytics-processor", Topics: []string{"crm.customer.created", "crm.transaction.completed", "crm.campaign.delivered"}, AutoOffsetReset: "latest", MaxPollRecords: 2000, SessionTimeoutMs: 60000},
		{GroupID: "crm-dlq-processor", Topics: []string{"crm.dlq.customer", "crm.dlq.transaction", "crm.dlq.campaign"}, AutoOffsetReset: "earliest", MaxPollRecords: 100, SessionTimeoutMs: 60000},
	}
}

// Event envelope for all Kafka messages
type EventEnvelope struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	Source        string          `json:"source"`
	TenantID      string          `json:"tenant_id"`
	CorrelationID string          `json:"correlation_id"`
	Timestamp     time.Time       `json:"timestamp"`
	Data          json.RawMessage `json:"data"`
	Metadata      map[string]string `json:"metadata"`
	SchemaVersion string          `json:"schema_version"`
}

// EventPublisher publishes events to Kafka topics
type EventPublisher struct {
	config  *KafkaConfig
	buffer  chan *publishRequest
	mu      sync.RWMutex
}

type publishRequest struct {
	topic    string
	key      string
	envelope *EventEnvelope
	resultCh chan error
}

func NewEventPublisher(config *KafkaConfig) *EventPublisher {
	if config == nil {
		config = DefaultKafkaConfig()
	}
	p := &EventPublisher{
		config: config,
		buffer: make(chan *publishRequest, 10000),
	}
	go p.processBuffer()
	return p
}

func (p *EventPublisher) Publish(ctx context.Context, topic, key string, data interface{}) error {
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal event data: %w", err)
	}
	envelope := &EventEnvelope{
		ID:            fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Type:          topic,
		Source:        "crm-platform",
		Timestamp:     time.Now().UTC(),
		Data:          dataBytes,
		SchemaVersion: "1.0",
	}
	resultCh := make(chan error, 1)
	p.buffer <- &publishRequest{topic: topic, key: key, envelope: envelope, resultCh: resultCh}
	select {
	case err := <-resultCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (p *EventPublisher) processBuffer() {
	for req := range p.buffer {
		// In production, this would use confluent-kafka-go or segmentio/kafka-go
		// For now, we acknowledge immediately
		req.resultCh <- nil
	}
}

func (p *EventPublisher) Close() {
	close(p.buffer)
}
