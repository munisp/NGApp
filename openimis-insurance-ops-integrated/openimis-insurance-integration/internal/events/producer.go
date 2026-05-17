package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/sirupsen/logrus"
	"openimis-insurance-integration/internal/metrics"
	"openimis-insurance-integration/pkg/config"
)

// Producer is the Kafka producer for actuarial events
type Producer struct {
	producer *kafka.Producer
	config   *config.Config
	log      *logrus.Entry
	metrics  *metrics.Metrics
}

// NewProducer creates a new Kafka producer
func NewProducer(cfg *config.Config, m *metrics.Metrics) (*Producer, error) {
	log := logrus.WithField("component", "KafkaProducer")
	p, err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": cfg.KafkaBootstrapServers})
	if err != nil {
		log.WithError(err).Error("Failed to create Kafka producer")
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	log.Info("Kafka Producer created successfully")
	return &Producer{
		producer: p,
		config:   cfg,
		log:      log,
		metrics:  m,
	}, nil
}

// ProduceEvent sends an ActuarialEvent to the appropriate Kafka topic
func (p *Producer) ProduceEvent(ctx context.Context, event ActuarialEvent) error {
	topic := p.config.KafkaTopicPrefix + string(event.EventType)
	event.Timestamp = time.Now().UTC()
	event.Source = "OpenIMIS"

	// Marshal the specific payload
	var payload interface{}
	switch event.EventType {
	case PremiumAdjustment:
		payload = &PremiumAdjustmentPayload{}
	case ReserveAdjustment:
		payload = &ReserveAdjustmentPayload{}
	case ProductConfigUpdate:
		payload = &ProductConfigUpdatePayload{}
	case LossRatioAlert:
		payload = &LossRatioAlertPayload{}
	default:
		p.log.WithField("event_type", event.EventType).Warn("Unknown event type, skipping production")
		return nil
	}

	if err := json.Unmarshal(event.Payload, payload); err != nil {
		p.log.WithError(err).Error("Failed to unmarshal event payload for validation")
		return fmt.Errorf("failed to unmarshal event payload: %w", err)
	}

	// Re-marshal the full event structure for Kafka
	eventBytes, err := json.Marshal(event)
	if err != nil {
		p.log.WithError(err).Error("Failed to marshal ActuarialEvent")
		return fmt.Errorf("failed to marshal ActuarialEvent: %w", err)
	}

	// Produce message
	err = p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Value:          eventBytes,
		Key:            []byte(event.EventID),
		Timestamp:      event.Timestamp,
	}, nil)

	if err != nil {
		p.log.WithError(err).WithField("topic", topic).Error("Failed to produce message")
		return fmt.Errorf("failed to produce message: %w", err)
	}

	p.metrics.EventsProduced.WithLabelValues(string(event.EventType)).Inc()

	p.log.WithFields(logrus.Fields{
		"event_id": event.EventID,
		"topic":    topic,
	}).Info("Message produced successfully")

	return nil
}

// Close closes the Kafka producer connection
func (p *Producer) Close() {
	p.log.Info("Closing Kafka Producer...")
	p.producer.Close()
}

// DeliveryReportHandler handles delivery reports from Kafka
func (p *Producer) DeliveryReportHandler() {
	for e := range p.producer.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				p.log.WithError(ev.TopicPartition.Error).WithField("topic", *ev.TopicPartition.Topic).Error("Delivery failed")
			} else {
				p.log.WithFields(logrus.Fields{
					"topic":     *ev.TopicPartition.Topic,
					"partition": ev.TopicPartition.Partition,
					"offset":    ev.TopicPartition.Offset,
				}).Debug("Message delivered")
			}
		}
	}
}
