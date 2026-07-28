package actuarial

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/linkedin/goavro/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

// PolicyEventConsumer handles consuming policy events from Kafka.
type PolicyEventConsumer struct {
	consumer *kafka.Consumer
	codec    *goavro.Codec
	updater  *ActuarialModelUpdater
	log      *logrus.Entry
	metrics  *ConsumerMetrics
}

// ConsumerMetrics holds Prometheus metrics for the consumer.
type ConsumerMetrics struct {
	EventsConsumed *prometheus.CounterVec
	ProcessingTime prometheus.Histogram
}

// NewConsumerMetrics initializes and registers Prometheus metrics.
func NewConsumerMetrics() *ConsumerMetrics {
	m := &ConsumerMetrics{
		EventsConsumed: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "policy_events_consumed_total",
				Help: "Total number of policy events consumed, labeled by event type and status.",
			},
			[]string{"event_type", "status"},
		),
		ProcessingTime: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "policy_event_processing_time_seconds",
			Help:    "Time taken to process a policy event.",
			Buckets: prometheus.DefBuckets,
		}),
	}
	prometheus.MustRegister(m.EventsConsumed, m.ProcessingTime)
	return m
}

// NewPolicyEventConsumer creates a new Kafka consumer instance.
func NewPolicyEventConsumer(broker, group, topic string, updater *ActuarialModelUpdater, log *logrus.Entry) (*PolicyEventConsumer, error) {
	// Load the Avro schema for decoding
	codec, err := goavro.NewCodec(PolicyEventSchema)
	if err != nil {
		return nil, fmt.Errorf("failed to create Avro codec: %w", err)
	}

	// Kafka consumer configuration
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": broker,
		"group.id":          group,
		"auto.offset.reset": "earliest",
		"enable.auto.commit": false, // Manual commit for reliable processing
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka consumer: %w", err)
	}

	// Subscribe to the topic
	if err := c.SubscribeTopics([]string{topic}, nil); err != nil {
		return nil, fmt.Errorf("failed to subscribe to topic %s: %w", topic, err)
	}

	log.Infof("Kafka consumer initialized for topic: %s, group: %s", topic, group)

	return &PolicyEventConsumer{
		consumer: c,
		codec:    codec,
		updater:  updater,
		log:      log,
		metrics:  NewConsumerMetrics(),
	}, nil
}

// StartConsuming starts the main consumption loop.
func (c *PolicyEventConsumer) StartConsuming(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			c.log.Info("Consumer shutdown signal received.")
			return
		default:
			// Poll for a message with a timeout
			msg, err := c.consumer.ReadMessage(time.Second)
			if err == nil {
				c.processMessage(ctx, msg)
			} else if !err.(kafka.Error).IsTimeout() {
				// The client will automatically try to recover from most errors
				c.log.Errorf("Consumer error: %v", err)
			}
		}
	}
}

// processMessage handles the decoding and processing of a single Kafka message.
func (c *PolicyEventConsumer) processMessage(ctx context.Context, msg *kafka.Message) {
	start := time.Now()
	logEntry := c.log.WithFields(logrus.Fields{
		"topic": *msg.TopicPartition.Topic,
		"partition": msg.TopicPartition.Partition,
		"offset": msg.TopicPartition.Offset,
	})

	// 1. Decode Avro binary to Go native map
	native, _, err := c.codec.NativeFromBinary(msg.Value)
	if err != nil {
		logEntry.Errorf("Failed to decode Avro binary: %v", err)
		// Commit the offset to skip the bad message (Dead Letter Queue in a real system)
		c.commitOffset(msg)
		c.metrics.EventsConsumed.WithLabelValues("UNKNOWN", "decoding_failed").Inc()
		return
	}

	// 2. Convert Go native map to PolicyEvent struct
	// Use JSON marshal/unmarshal for easy conversion from map[string]interface{} to struct
	jsonBytes, err := json.Marshal(native)
	if err != nil {
		logEntry.Errorf("Failed to marshal native Avro map to JSON: %v", err)
		c.commitOffset(msg)
		c.metrics.EventsConsumed.WithLabelValues("UNKNOWN", "serialization_failed").Inc()
		return
	}

	var event PolicyEvent
	if err := json.Unmarshal(jsonBytes, &event); err != nil {
		logEntry.Errorf("Failed to unmarshal JSON to PolicyEvent struct: %v", err)
		c.commitOffset(msg)
		c.metrics.EventsConsumed.WithLabelValues("UNKNOWN", "serialization_failed").Inc()
		return
	}

	// Extract trace ID from headers for structured logging
	traceID := ""
	for _, header := range msg.Headers {
		if header.Key == "trace_id" {
			traceID = string(header.Value)
			break
		}
	}
	
	// Add trace ID to context for downstream use
	processCtx := context.WithValue(ctx, "trace_id", traceID)
	
	// Update log entry with event details
	logEntry = logEntry.WithFields(logrus.Fields{
		"event_id": event.EventID,
		"policy_id": event.PolicyID,
		"event_type": event.EventType,
		"trace_id": traceID,
	})

	// 3. Process the event (Update Actuarial Model)
	if err := c.updater.UpdateModel(processCtx, event); err != nil {
		logEntry.Errorf("Failed to update actuarial model: %v. Will retry.", err)
		// DO NOT commit offset, so the message will be retried on rebalance or restart
		c.metrics.EventsConsumed.WithLabelValues(string(event.EventType), "processing_failed").Inc()
		return
	}

	// 4. Commit the offset manually after successful processing
	c.commitOffset(msg)

	// 5. Update metrics
	c.metrics.EventsConsumed.WithLabelValues(string(event.EventType), "success").Inc()
	c.metrics.ProcessingTime.Observe(time.Since(start).Seconds())
	logEntry.Infof("Event processed successfully in %v", time.Since(start))
}

// commitOffset commits the offset of the processed message.
func (c *PolicyEventConsumer) commitOffset(msg *kafka.Message) {
	_, err := c.consumer.CommitMessage(msg)
	if err != nil {
		c.log.Errorf("Failed to commit offset for message at %v: %v", msg.TopicPartition, err)
	}
}

// Close closes the underlying Kafka consumer.
func (c *PolicyEventConsumer) Close() {
	c.log.Info("Closing Kafka consumer...")
	c.consumer.Close()
}
