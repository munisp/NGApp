package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/segmentio/kafka-go"
)

type EventPublisher struct {
	writer *kafka.Writer
	service string
}

func NewEventPublisher(service string) *EventPublisher {
	broker := os.Getenv("KAFKA_BROKERS")
	if broker == "" {
		broker = "localhost:9092"
	}

	w := &kafka.Writer{
		Addr:         kafka.TCP(broker),
		Topic:        fmt.Sprintf("ngapp.%s.events", service),
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
		RequiredAcks: kafka.RequireOne,
	}

	log.Printf("[multi-tenant-platform] kafka producer ready -> %s", broker)
	return &EventPublisher{writer: w, service: service}
}

type DomainEvent struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"`
	Service   string      `json:"service"`
	Timestamp time.Time   `json:"timestamp"`
	TenantID  string      `json:"tenant_id,omitempty"`
	UserID    string      `json:"user_id,omitempty"`
	Payload   interface{} `json:"payload"`
}

func (p *EventPublisher) Publish(ctx context.Context, eventType string, key string, payload interface{}) error {
	event := DomainEvent{
		ID:        fmt.Sprintf("%s-%d", eventType, time.Now().UnixNano()),
		Type:      eventType,
		Service:   p.service,
		Timestamp: time.Now().UTC(),
		Payload:   payload,
	}
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	err = p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(key),
		Value: data,
	})
	if err != nil {
		log.Printf("[multi-tenant-platform] kafka publish failed (non-fatal): %v", err)
		return nil // graceful degradation
	}
	return nil
}

func (p *EventPublisher) Close() error {
	return p.writer.Close()
}
