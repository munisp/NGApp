// Package kafka provides a Kafka producer for publishing telemetry events.
// Uses franz-go (high-performance Kafka client for Go, supports KRaft mode).
// Topics:
//   og.field.telemetry.raw    — raw sensor readings (250K msg/sec target)
//   og.field.alarms.events    — ISA-18.2 alarm state changes
//   og.field.liquid.loading   — Turner critical velocity breach events
//   og.field.sand.events      — sand onset detection events
package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
)

// TelemetryEvent is the canonical message schema for og.field.telemetry.raw.
type TelemetryEvent struct {
	WellID     string    `json:"well_id"`
	FacilityID string    `json:"facility_id,omitempty"`
	SensorType string    `json:"sensor_type"`
	SensorTag  string    `json:"sensor_tag"`
	Value      float64   `json:"value"`
	Unit       string    `json:"unit"`
	Quality    int       `json:"quality"` // OPC-UA quality code: 192=GOOD
	Timestamp  time.Time `json:"timestamp"`
	Source     string    `json:"source"` // "mqtt", "modbus", "opc-ua", "simulated"
}

// AlarmEvent is the canonical message schema for og.field.alarms.events.
type AlarmEvent struct {
	WellID     string    `json:"well_id"`
	FacilityID string    `json:"facility_id,omitempty"`
	AlarmTag   string    `json:"alarm_tag"`
	Severity   string    `json:"severity"` // CRITICAL, HIGH, MEDIUM, LOW
	State      string    `json:"state"`    // ACTIVE, ACKNOWLEDGED, CLEARED
	Message    string    `json:"message"`
	OccurredAt time.Time `json:"occurred_at"`
}

// LiquidLoadingEvent is published when Turner critical velocity is breached.
type LiquidLoadingEvent struct {
	WellID           string    `json:"well_id"`
	TurnerRatio      float64   `json:"turner_ratio"`
	ActualVelocity   float64   `json:"actual_velocity_ms"`
	CriticalVelocity float64   `json:"critical_velocity_ms"`
	RiskLevel        string    `json:"risk_level"`
	OccurredAt       time.Time `json:"occurred_at"`
}

// SandEvent is published when sand onset critical drawdown is breached.
type SandEvent struct {
	WellID           string    `json:"well_id"`
	DrawdownPressure float64   `json:"drawdown_pressure_psi"`
	CriticalDrawdown float64   `json:"critical_drawdown_psi"`
	SandRateMgm3     float64   `json:"sand_rate_mg_m3"`
	OccurredAt       time.Time `json:"occurred_at"`
}

// Producer wraps franz-go for publishing to OG-RMM Kafka topics.
type Producer struct {
	client  *kgo.Client
	brokers []string
}

// NewProducer creates a new franz-go Kafka producer.
// Falls back to simulation mode if Kafka is unreachable.
func NewProducer(brokerList string) (*Producer, error) {
	brokers := strings.Split(brokerList, ",")
	for i, b := range brokers {
		brokers[i] = strings.TrimSpace(b)
	}

	client, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.ProducerBatchMaxBytes(1<<20),
		kgo.ProducerLinger(5*time.Millisecond),
		kgo.RecordRetries(5),
		kgo.ProducerBatchCompression(kgo.SnappyCompression()),
	)
	if err != nil {
		return nil, fmt.Errorf("kafka producer init: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx); err != nil {
		client.Close()
		slog.Warn("Kafka unreachable, producer in simulation mode", "brokers", brokerList)
		return &Producer{client: nil, brokers: brokers}, nil
	}

	slog.Info("Kafka producer connected", "brokers", brokerList)
	return &Producer{client: client, brokers: brokers}, nil
}

// PublishTelemetry publishes a raw sensor reading to og.field.telemetry.raw.
func (p *Producer) PublishTelemetry(ctx context.Context, event TelemetryEvent) error {
	return p.publish(ctx, "og.field.telemetry.raw", event.WellID, event)
}

// PublishAlarm publishes an alarm state change to og.field.alarms.events.
func (p *Producer) PublishAlarm(ctx context.Context, event AlarmEvent) error {
	return p.publish(ctx, "og.field.alarms.events", event.WellID, event)
}

// PublishLiquidLoading publishes a liquid loading breach event.
func (p *Producer) PublishLiquidLoading(ctx context.Context, event LiquidLoadingEvent) error {
	return p.publish(ctx, "og.field.liquid.loading", event.WellID, event)
}

// PublishSandEvent publishes a sand onset detection event.
func (p *Producer) PublishSandEvent(ctx context.Context, event SandEvent) error {
	return p.publish(ctx, "og.field.sand.events", event.WellID, event)
}

// publish serialises the payload and produces a record to the given topic.
func (p *Producer) publish(ctx context.Context, topic, key string, payload any) error {
	if p.client == nil {
		// Simulation mode — log only
		slog.Debug("kafka simulation publish", "topic", topic, "key", key)
		return nil
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal %T: %w", payload, err)
	}
	record := &kgo.Record{
		Topic: topic,
		Key:   []byte(key),
		Value: data,
		Headers: []kgo.RecordHeader{
			{Key: "content-type", Value: []byte("application/json")},
			{Key: "source", Value: []byte("og-rmm-telemetry")},
		},
	}
	results := p.client.ProduceSync(ctx, record)
	if err := results.FirstErr(); err != nil {
		slog.Error("Kafka produce failed", "topic", topic, "key", key, "err", err)
		return fmt.Errorf("kafka produce to %s: %w", topic, err)
	}
	return nil
}

// Close gracefully shuts down the producer.
func (p *Producer) Close() {
	if p.client != nil {
		p.client.Close()
		slog.Info("Kafka producer closed")
	}
}
