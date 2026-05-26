// Package kafka — producer.go
// Provides a Kafka producer for publishing sensor readings and alarm events
// from the OG-RMM platform to the event streaming backbone.
package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	confluent "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Producer publishes messages to Kafka topics.
type Producer interface {
	PublishSensorReading(ctx context.Context, reading SensorReading) error
	PublishAlarm(ctx context.Context, alarm AlarmEvent) error
	Close()
}

// ─── Real producer ────────────────────────────────────────────────────────────

type realProducer struct {
	producer *confluent.Producer
}

// NewProducer creates a Confluent Kafka producer.
func NewProducer(brokers string) (Producer, error) {
	p, err := confluent.NewProducer(&confluent.ConfigMap{
		"bootstrap.servers":            brokers,
		"acks":                         "all",
		"retries":                      5,
		"retry.backoff.ms":             200,
		"enable.idempotence":           true,
		"max.in.flight.requests.per.connection": 5,
	})
	if err != nil {
		return nil, fmt.Errorf("kafka producer: %w", err)
	}

	// Start delivery report goroutine
	go func() {
		for e := range p.Events() {
			switch ev := e.(type) {
			case *confluent.Message:
				if ev.TopicPartition.Error != nil {
					log.Printf("[kafka] Delivery failed: %v", ev.TopicPartition.Error)
				}
			}
		}
	}()

	return &realProducer{producer: p}, nil
}

func (p *realProducer) publish(topic string, payload any) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return p.producer.Produce(&confluent.Message{
		TopicPartition: confluent.TopicPartition{
			Topic:     &topic,
			Partition: confluent.PartitionAny,
		},
		Value: data,
	}, nil)
}

func (p *realProducer) PublishSensorReading(_ context.Context, reading SensorReading) error {
	return p.publish(TopicSensorReadings, reading)
}

func (p *realProducer) PublishAlarm(_ context.Context, alarm AlarmEvent) error {
	topic := TopicAlarmsAll
	if alarm.Severity >= 4 {
		topic = TopicAlarmsCritical
	}
	return p.publish(topic, alarm)
}

func (p *realProducer) Close() {
	p.producer.Flush(5000)
	p.producer.Close()
}

// ─── Simulated producer ───────────────────────────────────────────────────────

type simulatedProducer struct{}

// NewSimulatedProducer returns a no-op producer for development.
func NewSimulatedProducer() Producer {
	return &simulatedProducer{}
}

func (s *simulatedProducer) PublishSensorReading(_ context.Context, r SensorReading) error {
	log.Printf("[kafka:sim] SensorReading well=%s tag=%s val=%.2f", r.WellID, r.Tag, r.Value)
	return nil
}

func (s *simulatedProducer) PublishAlarm(_ context.Context, a AlarmEvent) error {
	log.Printf("[kafka:sim] Alarm well=%s sev=%d msg=%s", a.WellID, a.Severity, a.Message)
	return nil
}

func (s *simulatedProducer) Close() {}
