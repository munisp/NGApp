package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Producer wraps confluent-kafka-go producer with CRM-specific helpers.
type Producer struct {
	p        *kafka.Producer
	defTopic string
}

// NewProducer creates a Kafka producer from env or explicit config.
func NewProducer(brokers, defaultTopic string) (*Producer, error) {
	if brokers == "" {
		brokers = os.Getenv("KAFKA_BROKERS")
	}
	if brokers == "" {
		brokers = "kafka:9092"
	}
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers":  brokers,
		"acks":               "all",
		"retries":            3,
		"linger.ms":          5,
		"compression.type":   "snappy",
		"idempotence.enable": true,
	})
	if err != nil {
		return nil, fmt.Errorf("kafka producer: %w", err)
	}
	return &Producer{p: p, defTopic: defaultTopic}, nil
}

// PublishEvent serializes payload as JSON and sends to topic.
func (pr *Producer) PublishEvent(ctx context.Context, topic, key string, payload interface{}) error {
	if topic == "" {
		topic = pr.defTopic
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	deliveryChan := make(chan kafka.Event, 1)
	err = pr.p.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(key),
		Value:          data,
		Timestamp:       time.Now(),
		Headers: []kafka.Header{
			{Key: "content-type", Value: []byte("application/json")},
			{Key: "source", Value: []byte("crm-platform")},
		},
	}, deliveryChan)
	if err != nil {
		return fmt.Errorf("produce: %w", err)
	}
	e := <-deliveryChan
	m := e.(*kafka.Message)
	if m.TopicPartition.Error != nil {
		return m.TopicPartition.Error
	}
	return nil
}

// Close flushes and closes the producer.
func (pr *Producer) Close() {
	pr.p.Flush(5000)
	pr.p.Close()
}
