// Package kafka provides a Kafka consumer that processes sensor readings and
// alarm events, forwarding critical alarms to Redis pub/sub for real-time
// delivery to the Node.js tRPC server.
package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	confluent "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/og-rmm/middleware/internal/cache"
)

// Topics consumed by the worker.
const (
	TopicSensorReadings = "og.sensor.readings"
	TopicAlarmsAll      = "og.alarms.all"
	TopicAlarmsCritical = "og.alarms.critical"
)

// SensorReading mirrors the payload published by field edge devices.
type SensorReading struct {
	WellID    string    `json:"wellId"`
	Tag       string    `json:"tag"`
	Value     float64   `json:"value"`
	Unit      string    `json:"unit"`
	Quality   int       `json:"quality"`
	Timestamp time.Time `json:"timestamp"`
}

// AlarmEvent mirrors the alarm payload from the tRPC alarm router.
type AlarmEvent struct {
	AlarmID   int       `json:"alarmId"`
	WellID    string    `json:"wellId"`
	Severity  int       `json:"severity"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

// Consumer interface for the Kafka consumer.
type Consumer interface {
	Start(ctx context.Context)
	Stats() map[string]any
}

// ─── Real consumer ────────────────────────────────────────────────────────────

type realConsumer struct {
	consumer *confluent.Consumer
	cache    *cache.Client
	stats    consumerStats
}

type consumerStats struct {
	MessagesProcessed int64
	Errors            int64
	LastMessage       time.Time
}

// NewConsumer creates a Confluent Kafka consumer subscribed to sensor and alarm topics.
func NewConsumer(brokers string, cacheClient *cache.Client) (Consumer, error) {
	c, err := confluent.NewConsumer(&confluent.ConfigMap{
		"bootstrap.servers":  brokers,
		"group.id":           "og-rmm-worker",
		"auto.offset.reset":  "latest",
		"enable.auto.commit": true,
	})
	if err != nil {
		return nil, err
	}

	topics := []string{TopicSensorReadings, TopicAlarmsAll, TopicAlarmsCritical}
	if err := c.SubscribeTopics(topics, nil); err != nil {
		c.Close()
		return nil, err
	}

	return &realConsumer{consumer: c, cache: cacheClient}, nil
}

func (rc *realConsumer) Start(ctx context.Context) {
	log.Printf("[kafka] Consumer started on topics: %s, %s, %s",
		TopicSensorReadings, TopicAlarmsAll, TopicAlarmsCritical)

	for {
		select {
		case <-ctx.Done():
			rc.consumer.Close()
			return
		default:
			msg, err := rc.consumer.ReadMessage(200 * time.Millisecond)
			if err != nil {
				if kafkaErr, ok := err.(confluent.Error); ok && kafkaErr.Code() == confluent.ErrTimedOut {
					continue
				}
				log.Printf("[kafka] Read error: %v", err)
				rc.stats.Errors++
				continue
			}

			rc.stats.MessagesProcessed++
			rc.stats.LastMessage = time.Now()

			topic := *msg.TopicPartition.Topic
			switch topic {
			case TopicSensorReadings:
				rc.handleSensorReading(ctx, msg.Value)
			case TopicAlarmsCritical:
				rc.handleCriticalAlarm(ctx, msg.Value)
			}
		}
	}
}

func (rc *realConsumer) handleSensorReading(ctx context.Context, data []byte) {
	var reading SensorReading
	if err := json.Unmarshal(data, &reading); err != nil {
		log.Printf("[kafka] Invalid sensor reading: %v", err)
		return
	}
	// Cache latest value per tag (TTL 5 min)
	key := "sensor:" + reading.WellID + ":" + reading.Tag
	_ = rc.cache.Set(ctx, key, reading, 5*time.Minute)
}

func (rc *realConsumer) handleCriticalAlarm(ctx context.Context, data []byte) {
	var alarm AlarmEvent
	if err := json.Unmarshal(data, &alarm); err != nil {
		log.Printf("[kafka] Invalid alarm event: %v", err)
		return
	}
	// Publish to Redis channel for Node.js SSE / push notification handler
	if err := rc.cache.Publish(ctx, "alarms:critical", alarm); err != nil {
		log.Printf("[kafka] Redis publish failed: %v", err)
	}
	log.Printf("[kafka] Critical alarm forwarded: well=%s sev=%d msg=%s",
		alarm.WellID, alarm.Severity, alarm.Message)
}

func (rc *realConsumer) Stats() map[string]any {
	return map[string]any{
		"messagesProcessed": rc.stats.MessagesProcessed,
		"errors":            rc.stats.Errors,
		"lastMessage":       rc.stats.LastMessage,
		"mode":              "kafka",
	}
}

// ─── Unavailable consumer (returned when Kafka is not configured) ─────────────

type unavailableConsumer struct{}

// NewUnavailableConsumer returns a consumer that logs a warning and exits.
func NewUnavailableConsumer() Consumer {
	log.Println("[kafka] WARNING: Kafka not configured — consumer unavailable")
	return &unavailableConsumer{}
}

func (u *unavailableConsumer) Start(ctx context.Context) {
	log.Println("[kafka] Consumer not started — Kafka broker not configured. Set KAFKA_BROKERS env var.")
	<-ctx.Done()
}

func (u *unavailableConsumer) Stats() map[string]any {
	return map[string]any{
		"messagesProcessed": 0,
		"errors":            0,
		"mode":              "not_configured",
	}
}
