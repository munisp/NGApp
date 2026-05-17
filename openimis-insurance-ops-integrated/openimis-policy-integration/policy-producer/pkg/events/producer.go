package events

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
	"github.com/linkedin/goavro/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

// PolicyEventProducer handles the creation and sending of policy events to Kafka.
type PolicyEventProducer struct {
	producer *kafka.Producer
	topic    string
	codec    *goavro.Codec
	log      *logrus.Entry
	metrics  *ProducerMetrics
}

// ProducerMetrics holds Prometheus metrics for the producer.
type ProducerMetrics struct {
	EventsProduced *prometheus.CounterVec
	ProduceLatency prometheus.Histogram
}

// NewProducerMetrics initializes and registers Prometheus metrics.
func NewProducerMetrics() *ProducerMetrics {
	m := &ProducerMetrics{
		EventsProduced: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "policy_events_produced_total",
				Help: "Total number of policy events produced, labeled by event type and status.",
			},
			[]string{"event_type", "status"},
		),
		ProduceLatency: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name:    "policy_event_produce_latency_seconds",
			Help:    "Latency of producing policy events to Kafka.",
			Buckets: prometheus.DefBuckets,
		}),
	}
	prometheus.MustRegister(m.EventsProduced, m.ProduceLatency)
	return m
}

// NewPolicyEventProducer creates a new Kafka producer instance.
func NewPolicyEventProducer(broker, topic string, log *logrus.Entry) (*PolicyEventProducer, error) {
	// Load the Avro schema for encoding
	codec, err := goavro.NewCodec(PolicyEventSchema)
	if err != nil {
		return nil, fmt.Errorf("failed to create Avro codec: %w", err)
	}

	// Kafka producer configuration
	p, err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": broker})
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	producer := &PolicyEventProducer{
		producer: p,
		topic:    topic,
		codec:    codec,
		log:      log,
		metrics:  NewProducerMetrics(),
	}

	// Start a goroutine to handle delivery reports
	go producer.handleDeliveryReports()

	log.Infof("Kafka producer initialized for topic: %s", topic)
	return producer, nil
}

// Close closes the underlying Kafka producer.
func (p *PolicyEventProducer) Close() {
	p.log.Info("Closing Kafka producer...")
	p.producer.Close()
}

// handleDeliveryReports processes delivery reports from Kafka.
func (p *PolicyEventProducer) handleDeliveryReports() {
	for e := range p.producer.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			m := ev
			if m.TopicPartition.Error != nil {
				p.log.Errorf("Delivery failed for message on topic %s: %v", *m.TopicPartition.Topic, m.TopicPartition.Error)
				// Assuming the original message was a PolicyEvent, we can't easily recover the type for metrics here,
				// so we'll log the failure and use a generic metric.
				p.metrics.EventsProduced.WithLabelValues("UNKNOWN", "failed").Inc()
			} else {
				p.log.Debugf("Successfully delivered message to topic %s [%d] at offset %v",
					*m.TopicPartition.Topic, m.TopicPartition.Partition, m.TopicPartition.Offset)
				// Success metric is updated in the Produce method
			}
		}
	}
}

// EnrichEvent adds actuarial metadata to the policy event.
func (p *PolicyEventProducer) EnrichEvent(event *PolicyEvent) {
	// Mock implementation of actuarial metadata enrichment
	// In a real system, this would involve calling an Actuarial Service API or running a local model.
	rand.Seed(time.Now().UnixNano())
	event.PolicyData.ActuarialMetadata = ActuarialMetadata{
		RiskScore:           rand.Float64() * 100,
		ExpectedClaimsRatio: rand.Float64() * 0.8,
		ReserveRequired:     event.PolicyData.PremiumAmount * (0.1 + rand.Float64()*0.2), // 10-30% of premium
	}
	p.log.WithFields(logrus.Fields{
		"policy_id": event.PolicyID,
		"risk_score": event.PolicyData.ActuarialMetadata.RiskScore,
	}).Debug("Event enriched with actuarial metadata")
}

// Produce sends a PolicyEvent to Kafka.
func (p *PolicyEventProducer) Produce(ctx context.Context, event PolicyEvent) error {
	start := time.Now()

	// 1. Enrich the event
	p.EnrichEvent(&event)

	// 2. Convert Go struct to Avro-compatible map
	// We use the generated Go struct which is already compatible with the Avro schema.
	// We need to convert the Go struct to a map[string]interface{} for goavro encoding.
	// A quick way is to marshal/unmarshal via JSON, but a direct conversion is cleaner.
	// For simplicity and robustness against struct changes, we'll use JSON marshal/unmarshal here.
	// In a high-performance scenario, a manual conversion function would be preferred.
	jsonBytes, err := json.Marshal(event)
	if err != nil {
		p.metrics.EventsProduced.WithLabelValues(string(event.EventType), "serialization_failed").Inc()
		return fmt.Errorf("failed to marshal event to JSON: %w", err)
	}

	var avroMap map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &avroMap); err != nil {
		p.metrics.EventsProduced.WithLabelValues(string(event.EventType), "serialization_failed").Inc()
		return fmt.Errorf("failed to unmarshal JSON to Avro map: %w", err)
	}

	// 3. Encode the Avro map to binary
	binary, err := p.codec.BinaryFromNative(nil, avroMap)
	if err != nil {
		p.metrics.EventsProduced.WithLabelValues(string(event.EventType), "encoding_failed").Inc()
		return fmt.Errorf("failed to encode Avro binary: %w", err)
	}

	// 4. Produce to Kafka
	err = p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &p.topic, Partition: kafka.PartitionAny},
		Value:          binary,
		Key:            []byte(event.PolicyID), // Use policy ID as key for partitioning
		Headers: []kafka.Header{
			{Key: "trace_id", Value: []byte(fmt.Sprintf("%v", ctx.Value("trace_id")))},
		},
	}, nil)

	if err != nil {
		p.metrics.EventsProduced.WithLabelValues(string(event.EventType), "produce_failed").Inc()
		return fmt.Errorf("failed to produce message: %w", err)
	}

	// Wait for delivery to ensure synchronous behavior for this mock, in a real app, this would be async
	p.producer.Flush(1000)

	// 5. Update metrics
	p.metrics.EventsProduced.WithLabelValues(string(event.EventType), "success").Inc()
	p.metrics.ProduceLatency.Observe(time.Since(start).Seconds())

	p.log.WithFields(logrus.Fields{
		"policy_id": event.PolicyID,
		"event_type": event.EventType,
		"latency_ms": time.Since(start).Milliseconds(),
	}).Info("Policy event produced successfully")

	return nil
}
