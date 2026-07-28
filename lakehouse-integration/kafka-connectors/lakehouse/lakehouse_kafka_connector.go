package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/segmentio/kafka-go"
)

// LakehouseKafkaConnector streams data between Kafka and Lakehouse
type LakehouseKafkaConnector struct {
	readers     map[string]*kafka.Reader
	writers     map[string]*kafka.Writer
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	metrics     *ConnectorMetrics
}

// ConnectorMetrics tracks connector performance
type ConnectorMetrics struct {
	mu                  sync.RWMutex
	MessagesConsumed    int64
	MessagesProduced    int64
	BytesConsumed       int64
	BytesProduced       int64
	Errors              int64
	LastMessageTime     time.Time
}

// TopicMapping defines source to destination topic mapping
type TopicMapping struct {
	SourceTopic      string
	DestinationTopic string
	Transform        func([]byte) ([]byte, error)
}

// LakehouseEvent represents an event for the lakehouse
type LakehouseEvent struct {
	EventID        string                 `json:"event_id"`
	EventType      string                 `json:"event_type"`
	Source         string                 `json:"source"`
	Timestamp      time.Time              `json:"timestamp"`
	IngestionTime  time.Time              `json:"ingestion_time"`
	Payload        map[string]interface{} `json:"payload"`
	PartitionKey   string                 `json:"partition_key"`
	SchemaVersion  string                 `json:"schema_version"`
}

// NewLakehouseKafkaConnector creates a new connector
func NewLakehouseKafkaConnector() *LakehouseKafkaConnector {
	ctx, cancel := context.WithCancel(context.Background())
	return &LakehouseKafkaConnector{
		readers: make(map[string]*kafka.Reader),
		writers: make(map[string]*kafka.Writer),
		ctx:     ctx,
		cancel:  cancel,
		metrics: &ConnectorMetrics{},
	}
}

// GetBrokers returns Kafka broker addresses
func GetBrokers() []string {
	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		return []string{"kafka-0:9092", "kafka-1:9092", "kafka-2:9092"}
	}
	return []string{brokers}
}

// SetupPolicyEventsConnector sets up policy events streaming to lakehouse
func (c *LakehouseKafkaConnector) SetupPolicyEventsConnector() error {
	brokers := GetBrokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          "policy-events",
		GroupID:        "lakehouse-policy-connector",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "lakehouse-bronze-policies",
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
	}

	c.readers["policy-events"] = reader
	c.writers["lakehouse-bronze-policies"] = writer

	c.wg.Add(1)
	go c.streamWithTransform("policy-events", "lakehouse-bronze-policies", c.transformPolicyEvent)

	log.Println("Policy events connector started")
	return nil
}

// SetupClaimEventsConnector sets up claim events streaming to lakehouse
func (c *LakehouseKafkaConnector) SetupClaimEventsConnector() error {
	brokers := GetBrokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          "claim-events",
		GroupID:        "lakehouse-claim-connector",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "lakehouse-bronze-claims",
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
	}

	c.readers["claim-events"] = reader
	c.writers["lakehouse-bronze-claims"] = writer

	c.wg.Add(1)
	go c.streamWithTransform("claim-events", "lakehouse-bronze-claims", c.transformClaimEvent)

	log.Println("Claim events connector started")
	return nil
}

// SetupPaymentEventsConnector sets up payment events streaming to lakehouse
func (c *LakehouseKafkaConnector) SetupPaymentEventsConnector() error {
	brokers := GetBrokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          "payment-events",
		GroupID:        "lakehouse-payment-connector",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "lakehouse-bronze-payments",
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
	}

	c.readers["payment-events"] = reader
	c.writers["lakehouse-bronze-payments"] = writer

	c.wg.Add(1)
	go c.streamWithTransform("payment-events", "lakehouse-bronze-payments", c.transformPaymentEvent)

	log.Println("Payment events connector started")
	return nil
}

// SetupFraudEventsConnector sets up fraud detection events streaming
func (c *LakehouseKafkaConnector) SetupFraudEventsConnector() error {
	brokers := GetBrokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          "fraud-detection-results",
		GroupID:        "lakehouse-fraud-connector",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "lakehouse-bronze-fraud",
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
	}

	c.readers["fraud-detection-results"] = reader
	c.writers["lakehouse-bronze-fraud"] = writer

	c.wg.Add(1)
	go c.streamWithTransform("fraud-detection-results", "lakehouse-bronze-fraud", c.transformFraudEvent)

	log.Println("Fraud events connector started")
	return nil
}

// SetupMLPredictionsConnector sets up ML predictions streaming to lakehouse
func (c *LakehouseKafkaConnector) SetupMLPredictionsConnector() error {
	brokers := GetBrokers()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        brokers,
		Topic:          "ml-predictions",
		GroupID:        "lakehouse-ml-connector",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        "lakehouse-bronze-ml-predictions",
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
		Async:        false,
	}

	c.readers["ml-predictions"] = reader
	c.writers["lakehouse-bronze-ml-predictions"] = writer

	c.wg.Add(1)
	go c.streamWithTransform("ml-predictions", "lakehouse-bronze-ml-predictions", c.transformMLPrediction)

	log.Println("ML predictions connector started")
	return nil
}

func (c *LakehouseKafkaConnector) streamWithTransform(sourceTopic, destTopic string, transform func([]byte) ([]byte, error)) {
	defer c.wg.Done()

	reader := c.readers[sourceTopic]
	writer := c.writers[destTopic]

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
			msg, err := reader.ReadMessage(c.ctx)
			if err != nil {
				if err == context.Canceled {
					return
				}
				log.Printf("Error reading from %s: %v", sourceTopic, err)
				c.metrics.mu.Lock()
				c.metrics.Errors++
				c.metrics.mu.Unlock()
				continue
			}

			c.metrics.mu.Lock()
			c.metrics.MessagesConsumed++
			c.metrics.BytesConsumed += int64(len(msg.Value))
			c.metrics.LastMessageTime = time.Now()
			c.metrics.mu.Unlock()

			// Transform message
			transformed, err := transform(msg.Value)
			if err != nil {
				log.Printf("Error transforming message from %s: %v", sourceTopic, err)
				c.metrics.mu.Lock()
				c.metrics.Errors++
				c.metrics.mu.Unlock()
				continue
			}

			// Write to destination
			err = writer.WriteMessages(c.ctx, kafka.Message{
				Key:   msg.Key,
				Value: transformed,
			})
			if err != nil {
				log.Printf("Error writing to %s: %v", destTopic, err)
				c.metrics.mu.Lock()
				c.metrics.Errors++
				c.metrics.mu.Unlock()
				continue
			}

			c.metrics.mu.Lock()
			c.metrics.MessagesProduced++
			c.metrics.BytesProduced += int64(len(transformed))
			c.metrics.mu.Unlock()
		}
	}
}

func (c *LakehouseKafkaConnector) transformPolicyEvent(data []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	event := LakehouseEvent{
		EventID:       fmt.Sprintf("policy-%d", time.Now().UnixNano()),
		EventType:     "policy_event",
		Source:        "policy-service",
		Timestamp:     time.Now(),
		IngestionTime: time.Now(),
		Payload:       payload,
		PartitionKey:  fmt.Sprintf("%v", payload["policy_id"]),
		SchemaVersion: "1.0.0",
	}

	return json.Marshal(event)
}

func (c *LakehouseKafkaConnector) transformClaimEvent(data []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	event := LakehouseEvent{
		EventID:       fmt.Sprintf("claim-%d", time.Now().UnixNano()),
		EventType:     "claim_event",
		Source:        "claims-service",
		Timestamp:     time.Now(),
		IngestionTime: time.Now(),
		Payload:       payload,
		PartitionKey:  fmt.Sprintf("%v", payload["claim_id"]),
		SchemaVersion: "1.0.0",
	}

	return json.Marshal(event)
}

func (c *LakehouseKafkaConnector) transformPaymentEvent(data []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	event := LakehouseEvent{
		EventID:       fmt.Sprintf("payment-%d", time.Now().UnixNano()),
		EventType:     "payment_event",
		Source:        "payment-service",
		Timestamp:     time.Now(),
		IngestionTime: time.Now(),
		Payload:       payload,
		PartitionKey:  fmt.Sprintf("%v", payload["payment_id"]),
		SchemaVersion: "1.0.0",
	}

	return json.Marshal(event)
}

func (c *LakehouseKafkaConnector) transformFraudEvent(data []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	event := LakehouseEvent{
		EventID:       fmt.Sprintf("fraud-%d", time.Now().UnixNano()),
		EventType:     "fraud_detection_event",
		Source:        "fraud-detection-service",
		Timestamp:     time.Now(),
		IngestionTime: time.Now(),
		Payload:       payload,
		PartitionKey:  fmt.Sprintf("%v", payload["transaction_id"]),
		SchemaVersion: "1.0.0",
	}

	return json.Marshal(event)
}

func (c *LakehouseKafkaConnector) transformMLPrediction(data []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}

	event := LakehouseEvent{
		EventID:       fmt.Sprintf("ml-%d", time.Now().UnixNano()),
		EventType:     "ml_prediction_event",
		Source:        "ray-serve-ml",
		Timestamp:     time.Now(),
		IngestionTime: time.Now(),
		Payload:       payload,
		PartitionKey:  fmt.Sprintf("%v", payload["model_name"]),
		SchemaVersion: "1.0.0",
	}

	return json.Marshal(event)
}

// GetMetrics returns current connector metrics
func (c *LakehouseKafkaConnector) GetMetrics() map[string]interface{} {
	c.metrics.mu.RLock()
	defer c.metrics.mu.RUnlock()

	return map[string]interface{}{
		"messages_consumed": c.metrics.MessagesConsumed,
		"messages_produced": c.metrics.MessagesProduced,
		"bytes_consumed":    c.metrics.BytesConsumed,
		"bytes_produced":    c.metrics.BytesProduced,
		"errors":            c.metrics.Errors,
		"last_message_time": c.metrics.LastMessageTime,
	}
}

// Shutdown gracefully shuts down the connector
func (c *LakehouseKafkaConnector) Shutdown() {
	log.Println("Shutting down Lakehouse Kafka Connector...")
	c.cancel()
	c.wg.Wait()

	for name, reader := range c.readers {
		if err := reader.Close(); err != nil {
			log.Printf("Error closing reader %s: %v", name, err)
		}
	}

	for name, writer := range c.writers {
		if err := writer.Close(); err != nil {
			log.Printf("Error closing writer %s: %v", name, err)
		}
	}

	log.Println("Lakehouse Kafka Connector shutdown complete")
}

func main() {
	log.Println("Starting Lakehouse Kafka Connector...")

	connector := NewLakehouseKafkaConnector()

	// Setup all connectors
	if err := connector.SetupPolicyEventsConnector(); err != nil {
		log.Fatalf("Failed to setup policy events connector: %v", err)
	}

	if err := connector.SetupClaimEventsConnector(); err != nil {
		log.Fatalf("Failed to setup claim events connector: %v", err)
	}

	if err := connector.SetupPaymentEventsConnector(); err != nil {
		log.Fatalf("Failed to setup payment events connector: %v", err)
	}

	if err := connector.SetupFraudEventsConnector(); err != nil {
		log.Fatalf("Failed to setup fraud events connector: %v", err)
	}

	if err := connector.SetupMLPredictionsConnector(); err != nil {
		log.Fatalf("Failed to setup ML predictions connector: %v", err)
	}

	log.Println("All Lakehouse Kafka Connectors started successfully")

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	connector.Shutdown()
}
