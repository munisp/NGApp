//go:build ignore

package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/munisp/NGApp/crm-platform/services/go/crm-services/internal/config"
)

// KafkaProducer wraps the Kafka producer with additional functionality
type KafkaProducer struct {
	producer *kafka.Producer
	topics   config.TopicsConfig
	logger   *logrus.Logger
}

// NewKafkaProducer creates a new Kafka producer
func NewKafkaProducer(cfg config.KafkaConfig, logger *logrus.Logger) (*KafkaProducer, error) {
	// Configure producer
	configMap := &kafka.ConfigMap{
		"bootstrap.servers":   cfg.Brokers,
		"acks":               cfg.Producer.Acks,
		"retries":            cfg.Producer.Retries,
		"batch.size":         cfg.Producer.BatchSize,
		"linger.ms":          cfg.Producer.LingerMs,
		"buffer.memory":      cfg.Producer.BufferMemory,
		"compression.type":   cfg.Producer.Compression,
		"request.timeout.ms": int(cfg.Producer.RequestTimeout.Milliseconds()),
		"client.id":          "crm-core-service-producer",
	}

	producer, err := kafka.NewProducer(configMap)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	kp := &KafkaProducer{
		producer: producer,
		topics:   cfg.Topics,
		logger:   logger,
	}

	// Start delivery report handler
	go kp.handleDeliveryReports()

	logger.Info("Kafka producer initialized successfully")
	return kp, nil
}

// Close closes the Kafka producer
func (kp *KafkaProducer) Close() {
	if kp.producer != nil {
		kp.producer.Flush(15 * 1000) // Wait up to 15 seconds
		kp.producer.Close()
	}
}

// handleDeliveryReports handles delivery reports from Kafka
func (kp *KafkaProducer) handleDeliveryReports() {
	for e := range kp.producer.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				kp.logger.WithFields(logrus.Fields{
					"topic":     *ev.TopicPartition.Topic,
					"partition": ev.TopicPartition.Partition,
					"offset":    ev.TopicPartition.Offset,
					"error":     ev.TopicPartition.Error,
				}).Error("Failed to deliver message")
			} else {
				kp.logger.WithFields(logrus.Fields{
					"topic":     *ev.TopicPartition.Topic,
					"partition": ev.TopicPartition.Partition,
					"offset":    ev.TopicPartition.Offset,
				}).Debug("Message delivered successfully")
			}
		}
	}
}

// PublishEvent publishes an event to the specified topic
func (kp *KafkaProducer) PublishEvent(ctx context.Context, topic string, key string, event interface{}) error {
	eventData, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	message := &kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(key),
		Value:          eventData,
		Headers: []kafka.Header{
			{Key: "content-type", Value: []byte("application/json")},
			{Key: "source", Value: []byte("crm-core-service")},
			{Key: "timestamp", Value: []byte(time.Now().UTC().Format(time.RFC3339))},
		},
	}

	// Produce message asynchronously
	err = kp.producer.Produce(message, nil)
	if err != nil {
		return fmt.Errorf("failed to produce message: %w", err)
	}

	kp.logger.WithFields(logrus.Fields{
		"topic": topic,
		"key":   key,
		"size":  len(eventData),
	}).Debug("Event published to Kafka")

	return nil
}

// Event types and structures

// BaseEvent represents the base structure for all CRM events
type BaseEvent struct {
	EventID       uuid.UUID              `json:"event_id"`
	EventType     string                 `json:"event_type"`
	EntityType    string                 `json:"entity_type"`
	EntityID      uuid.UUID              `json:"entity_id"`
	Timestamp     time.Time              `json:"timestamp"`
	Version       string                 `json:"version"`
	Source        string                 `json:"source"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// LeadEvent represents lead-related events
type LeadEvent struct {
	BaseEvent
	Lead     interface{}            `json:"lead"`
	Changes  map[string]interface{} `json:"changes,omitempty"`
	Previous interface{}            `json:"previous,omitempty"`
}

// AccountEvent represents account-related events
type AccountEvent struct {
	BaseEvent
	Account  interface{}            `json:"account"`
	Changes  map[string]interface{} `json:"changes,omitempty"`
	Previous interface{}            `json:"previous,omitempty"`
}

// ContactEvent represents contact-related events
type ContactEvent struct {
	BaseEvent
	Contact  interface{}            `json:"contact"`
	Changes  map[string]interface{} `json:"changes,omitempty"`
	Previous interface{}            `json:"previous,omitempty"`
}

// OpportunityEvent represents opportunity-related events
type OpportunityEvent struct {
	BaseEvent
	Opportunity interface{}            `json:"opportunity"`
	Changes     map[string]interface{} `json:"changes,omitempty"`
	Previous    interface{}            `json:"previous,omitempty"`
}

// ActivityEvent represents activity-related events
type ActivityEvent struct {
	BaseEvent
	Activity interface{}            `json:"activity"`
	Changes  map[string]interface{} `json:"changes,omitempty"`
	Previous interface{}            `json:"previous,omitempty"`
}

// InteractionEvent represents interaction-related events
type InteractionEvent struct {
	BaseEvent
	Interaction interface{}            `json:"interaction"`
	Changes     map[string]interface{} `json:"changes,omitempty"`
	Previous    interface{}            `json:"previous,omitempty"`
}

// Event publishing methods

// PublishLeadEvent publishes a lead-related event
func (kp *KafkaProducer) PublishLeadEvent(ctx context.Context, eventType string, entityID uuid.UUID, lead interface{}, changes map[string]interface{}, previous interface{}) error {
	event := LeadEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "lead",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Lead:     lead,
		Changes:  changes,
		Previous: previous,
	}

	return kp.PublishEvent(ctx, kp.topics.LeadEvents, entityID.String(), event)
}

// PublishAccountEvent publishes an account-related event
func (kp *KafkaProducer) PublishAccountEvent(ctx context.Context, eventType string, entityID uuid.UUID, account interface{}, changes map[string]interface{}, previous interface{}) error {
	event := AccountEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "account",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Account:  account,
		Changes:  changes,
		Previous: previous,
	}

	return kp.PublishEvent(ctx, kp.topics.AccountEvents, entityID.String(), event)
}

// PublishContactEvent publishes a contact-related event
func (kp *KafkaProducer) PublishContactEvent(ctx context.Context, eventType string, entityID uuid.UUID, contact interface{}, changes map[string]interface{}, previous interface{}) error {
	event := ContactEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "contact",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Contact:  contact,
		Changes:  changes,
		Previous: previous,
	}

	return kp.PublishEvent(ctx, kp.topics.ContactEvents, entityID.String(), event)
}

// PublishOpportunityEvent publishes an opportunity-related event
func (kp *KafkaProducer) PublishOpportunityEvent(ctx context.Context, eventType string, entityID uuid.UUID, opportunity interface{}, changes map[string]interface{}, previous interface{}) error {
	event := OpportunityEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "opportunity",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Opportunity: opportunity,
		Changes:     changes,
		Previous:    previous,
	}

	return kp.PublishEvent(ctx, kp.topics.OpportunityEvents, entityID.String(), event)
}

// PublishActivityEvent publishes an activity-related event
func (kp *KafkaProducer) PublishActivityEvent(ctx context.Context, eventType string, entityID uuid.UUID, activity interface{}, changes map[string]interface{}, previous interface{}) error {
	event := ActivityEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "activity",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Activity: activity,
		Changes:  changes,
		Previous: previous,
	}

	return kp.PublishEvent(ctx, kp.topics.ActivityEvents, entityID.String(), event)
}

// PublishInteractionEvent publishes an interaction-related event
func (kp *KafkaProducer) PublishInteractionEvent(ctx context.Context, eventType string, entityID uuid.UUID, interaction interface{}, changes map[string]interface{}, previous interface{}) error {
	event := InteractionEvent{
		BaseEvent: BaseEvent{
			EventID:    uuid.New(),
			EventType:  eventType,
			EntityType: "interaction",
			EntityID:   entityID,
			Timestamp:  time.Now().UTC(),
			Version:    "1.0",
			Source:     "crm-core-service",
		},
		Interaction: interaction,
		Changes:     changes,
		Previous:    previous,
	}

	return kp.PublishEvent(ctx, kp.topics.InteractionEvents, entityID.String(), event)
}

// Batch event publishing for bulk operations

// BatchEvent represents a batch of events
type BatchEvent struct {
	BatchID   uuid.UUID   `json:"batch_id"`
	EventType string      `json:"event_type"`
	Events    []BaseEvent `json:"events"`
	Timestamp time.Time   `json:"timestamp"`
	Source    string      `json:"source"`
	Count     int         `json:"count"`
}

// PublishBatchEvents publishes multiple events as a batch
func (kp *KafkaProducer) PublishBatchEvents(ctx context.Context, topic string, eventType string, events []BaseEvent) error {
	batchEvent := BatchEvent{
		BatchID:   uuid.New(),
		EventType: eventType,
		Events:    events,
		Timestamp: time.Now().UTC(),
		Source:    "crm-core-service",
		Count:     len(events),
	}

	return kp.PublishEvent(ctx, topic, batchEvent.BatchID.String(), batchEvent)
}

// Health check for Kafka producer
func (kp *KafkaProducer) HealthCheck(ctx context.Context) error {
	// Get metadata to check connectivity
	metadata, err := kp.producer.GetMetadata(nil, false, 5000)
	if err != nil {
		return fmt.Errorf("kafka health check failed: %w", err)
	}

	if len(metadata.Brokers) == 0 {
		return fmt.Errorf("no kafka brokers available")
	}

	return nil
}

// GetStats returns producer statistics
func (kp *KafkaProducer) GetStats() (string, error) {
	return kp.producer.String(), nil
}

