package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaConfig struct {
	Brokers       []string
	GroupID       string
	Topic         string
	MaxRetries    int
	RetryInterval time.Duration
}

type PaymentEvent struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Source        string                 `json:"source"`
	Timestamp     time.Time              `json:"timestamp"`
	Payload       map[string]interface{} `json:"payload"`
	CorrelationID string                 `json:"correlation_id"`
	RetryCount    int                    `json:"retry_count"`
}

type KafkaConsumer struct {
	reader *kafka.Reader
	config KafkaConfig
}

func NewKafkaConsumer(config KafkaConfig) *KafkaConsumer {
	brokers := config.Brokers
	if len(brokers) == 0 {
		brokers = []string{getEnvOrDefault("KAFKA_BROKERS", "localhost:9092")}
	}
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		GroupID:        config.GroupID,
		Topic:          config.Topic,
		MinBytes:       10e3,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})
	return &KafkaConsumer{reader: reader, config: config}
}

func (c *KafkaConsumer) Consume(ctx context.Context, handler func(PaymentEvent) error) error {
	for {
		select {
		case <-ctx.Done():
			return c.reader.Close()
		default:
			msg, err := c.reader.ReadMessage(ctx)
			if err != nil {
				log.Printf("Error reading Kafka message: %v", err)
				continue
			}
			var event PaymentEvent
			if err := json.Unmarshal(msg.Value, &event); err != nil {
				log.Printf("Error unmarshaling event: %v", err)
				continue
			}
			if err := c.processWithRetry(event, handler); err != nil {
				log.Printf("Failed to process event %s after %d retries: %v", event.ID, c.config.MaxRetries, err)
				c.publishToDeadLetter(event, err)
			}
		}
	}
}

func (c *KafkaConsumer) processWithRetry(event PaymentEvent, handler func(PaymentEvent) error) error {
	var lastErr error
	for i := 0; i <= c.config.MaxRetries; i++ {
		if err := handler(event); err != nil {
			lastErr = err
			event.RetryCount = i + 1
			time.Sleep(c.config.RetryInterval * time.Duration(i+1))
			continue
		}
		return nil
	}
	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

func (c *KafkaConsumer) publishToDeadLetter(event PaymentEvent, err error) {
	dlqTopic := c.config.Topic + ".dlq"
	writer := &kafka.Writer{
		Addr:  kafka.TCP(getEnvOrDefault("KAFKA_BROKERS", "localhost:9092")),
		Topic: dlqTopic,
	}
	defer writer.Close()
	data, _ := json.Marshal(map[string]interface{}{
		"event": event,
		"error": err.Error(),
		"timestamp": time.Now(),
	})
	_ = writer.WriteMessages(context.Background(), kafka.Message{Value: data})
}

type KafkaProducer struct {
	writer *kafka.Writer
}

func NewKafkaProducer(topic string) *KafkaProducer {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(getEnvOrDefault("KAFKA_BROKERS", "localhost:9092")),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}
	return &KafkaProducer{writer: writer}
}

func (p *KafkaProducer) Publish(ctx context.Context, event PaymentEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(event.ID),
		Value: data,
		Headers: []kafka.Header{
			{Key: "event-type", Value: []byte(event.Type)},
			{Key: "correlation-id", Value: []byte(event.CorrelationID)},
		},
	})
}

func (p *KafkaProducer) Close() error {
	return p.writer.Close()
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
