package kafka

import (
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/sirupsen/logrus"
)

// Client is a wrapper for the Kafka producer.
type Client struct {
	producer *kafka.Producer
}

// NewClient creates and returns a new Kafka client.
func NewClient(bootstrapServers string) (*Client, error) {
	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": bootstrapServers,
		"acks":              "all",
		"retries":           5,
		"retry.backoff.ms":  100,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	logrus.Infof("Kafka producer created for servers: %s", bootstrapServers)

	// Start a goroutine to handle delivery reports
	go func() {
		for e := range p.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					logrus.Errorf("Delivery failed: %v", ev.TopicPartition)
				} else {
					logrus.Debugf("Delivered message to topic %s [%d] at offset %v",
						*ev.TopicPartition.Topic, ev.TopicPartition.Partition, ev.TopicPartition.Offset)
				}
			}
		}
	}()

	return &Client{producer: p}, nil
}

// Produce sends a message to the specified Kafka topic.
func (c *Client) Produce(topic string, key string, value []byte) error {
	deliveryChan := make(chan kafka.Event)

	err := c.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &topic, Partition: kafka.PartitionAny},
		Key:            []byte(key),
		Value:          value,
		Timestamp:      time.Now(),
	}, deliveryChan)

	if err != nil {
		return fmt.Errorf("failed to produce message: %w", err)
	}

	// Wait for delivery report (synchronous for simplicity in this simulation)
	e := <-deliveryChan
	m := e.(*kafka.Message)

	if m.TopicPartition.Error != nil {
		return fmt.Errorf("delivery failed: %w", m.TopicPartition.Error)
	}

	close(deliveryChan)
	return nil
}

// Close closes the Kafka producer connection.
func (c *Client) Close() {
	// Wait for all messages to be delivered
	remaining := c.producer.Flush(15 * 1000) // 15 seconds timeout
	if remaining > 0 {
		logrus.Warnf("Producer failed to flush %d messages", remaining)
	}
	c.producer.Close()
	logrus.Info("Kafka producer closed")
}
