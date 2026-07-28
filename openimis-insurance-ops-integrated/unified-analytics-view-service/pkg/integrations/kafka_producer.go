package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/sirupsen/logrus"
)

// KafkaProducerImpl implements the KafkaProducer interface.
type KafkaProducerImpl struct {
	producer *kafka.Producer
	logger   *logrus.Entry
}

// NewKafkaProducer creates a new instance of KafkaProducerImpl.
func NewKafkaProducer(brokers []string, logger *logrus.Entry) (KafkaProducer, error) {
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": brokers[0], // Use the first broker for simplicity
		"acks":              "all",
		"message.timeout.ms": 5000,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	// Start a goroutine to handle delivery reports
	go func() {
		for e := range p.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					logger.Errorf("Delivery failed: %v", ev.TopicPartition)
				} else {
					logger.Debugf("Delivered message to %v", ev.TopicPartition)
				}
			}
		}
	}()

	return &KafkaProducerImpl{producer: p, logger: logger}, nil
}

// ProduceView publishes a unified view to a Kafka topic.
func (k *KafkaProducerImpl) ProduceView(ctx context.Context, topic string, key string, view interface{}) error {
	value, err := json.Marshal(view)
	if err != nil {
		return fmt.Errorf("failed to marshal view to JSON: %w", err)
	}

	message := &kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(key),
		Value:          value,
		Timestamp:      time.Now(),
	}

	// Produce message with a timeout
	select {
	case k.producer.ProduceChannel() <- message:
		// Message sent to the internal queue
	case <-time.After(1 * time.Second):
		return fmt.Errorf("timeout sending message to Kafka internal queue")
	case <-ctx.Done():
		return ctx.Err()
	}

	// Flush the producer to ensure delivery
	// In a real application, flushing should be done periodically or on shutdown.
	// For this example, we flush after each message for immediate feedback.
	k.producer.Flush(1000) // 1 second timeout for flush

	return nil
}
