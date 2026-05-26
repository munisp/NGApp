// Package kafka provides a Kafka consumer that processes sensor readings and
// alarm events, forwarding critical alarms to Redis pub/sub for real-time
// delivery to the Node.js tRPC server.
package kafka

import (
	"context"
	"encoding/json"
	"fmt"
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
	TopicDLQ            = "og.dlq"

	// Max retries before sending to DLQ
	maxRetries = 3
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
	consumer  *confluent.Consumer
	producer  *confluent.Producer
	cache     *cache.Client
	stats     consumerStats
}

type consumerStats struct {
	MessagesProcessed int64
	Errors            int64
	DLQMessages       int64
	LastMessage       time.Time
}

// NewConsumer creates a Confluent Kafka consumer subscribed to sensor and alarm topics.
// Includes a DLQ producer for failed messages.
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

	// DLQ producer for failed messages
	p, err := confluent.NewProducer(&confluent.ConfigMap{
		"bootstrap.servers": brokers,
		"acks":              "all",
	})
	if err != nil {
		c.Close()
		return nil, err
	}
	go func() {
		for range p.Events() {
		}
	}()

	topics := []string{TopicSensorReadings, TopicAlarmsAll, TopicAlarmsCritical}
	if err := c.SubscribeTopics(topics, nil); err != nil {
		c.Close()
		p.Close()
		return nil, err
	}

	return &realConsumer{consumer: c, producer: p, cache: cacheClient}, nil
}

func (rc *realConsumer) Start(ctx context.Context) {
	log.Printf("[kafka] Consumer started on topics: %s, %s, %s (DLQ: %s)",
		TopicSensorReadings, TopicAlarmsAll, TopicAlarmsCritical, TopicDLQ)

	for {
		select {
		case <-ctx.Done():
			rc.consumer.Close()
			rc.producer.Close()
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
			var processErr error
			switch topic {
			case TopicSensorReadings:
				processErr = rc.handleSensorReadingWithRetry(ctx, msg.Value)
			case TopicAlarmsCritical:
				processErr = rc.handleCriticalAlarmWithRetry(ctx, msg.Value)
			}

			if processErr != nil {
				rc.sendToDLQ(topic, msg.Value, processErr)
			}
		}
	}
}

func (rc *realConsumer) sendToDLQ(originalTopic string, data []byte, err error) {
	dlqTopic := TopicDLQ
	headers := []confluent.Header{
		{Key: "original-topic", Value: []byte(originalTopic)},
		{Key: "error", Value: []byte(err.Error())},
		{Key: "timestamp", Value: []byte(time.Now().UTC().Format(time.RFC3339))},
	}
	rc.producer.Produce(&confluent.Message{
		TopicPartition: confluent.TopicPartition{Topic: &dlqTopic, Partition: confluent.PartitionAny},
		Value:          data,
		Headers:        headers,
	}, nil)
	rc.stats.DLQMessages++
	log.Printf("[kafka] Message sent to DLQ from topic=%s error=%v", originalTopic, err)
}

func (rc *realConsumer) handleSensorReadingWithRetry(ctx context.Context, data []byte) error {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := rc.processSensorReading(ctx, data); err != nil {
			lastErr = err
			backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
			time.Sleep(backoff)
			continue
		}
		return nil
	}
	return lastErr
}

func (rc *realConsumer) handleCriticalAlarmWithRetry(ctx context.Context, data []byte) error {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := rc.processCriticalAlarm(ctx, data); err != nil {
			lastErr = err
			backoff := time.Duration(1<<uint(i)) * 100 * time.Millisecond
			time.Sleep(backoff)
			continue
		}
		return nil
	}
	return lastErr
}

func (rc *realConsumer) processSensorReading(ctx context.Context, data []byte) error {
	var reading SensorReading
	if err := json.Unmarshal(data, &reading); err != nil {
		return fmt.Errorf("invalid sensor reading: %w", err)
	}
	key := "sensor:" + reading.WellID + ":" + reading.Tag
	return rc.cache.Set(ctx, key, reading, 5*time.Minute)
}

func (rc *realConsumer) processCriticalAlarm(ctx context.Context, data []byte) error {
	var alarm AlarmEvent
	if err := json.Unmarshal(data, &alarm); err != nil {
		return fmt.Errorf("invalid alarm event: %w", err)
	}
	if err := rc.cache.Publish(ctx, "alarms:critical", alarm); err != nil {
		return fmt.Errorf("redis publish failed: %w", err)
	}
	log.Printf("[kafka] Critical alarm forwarded: well=%s sev=%d msg=%s",
		alarm.WellID, alarm.Severity, alarm.Message)
	return nil
}



func (rc *realConsumer) Stats() map[string]any {
	return map[string]any{
		"messagesProcessed": rc.stats.MessagesProcessed,
		"errors":            rc.stats.Errors,
		"dlqMessages":       rc.stats.DLQMessages,
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
