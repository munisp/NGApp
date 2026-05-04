// Package integration provides infrastructure integration components
package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/IBM/sarama"
)

// FluvioKafkaBridge bridges Fluvio streams to Kafka topics for unified event plane
type FluvioKafkaBridge struct {
	config        *BridgeConfig
	kafkaProducer sarama.SyncProducer
	fluvioClient  *FluvioClient
	running       bool
	stopCh        chan struct{}
	wg            sync.WaitGroup
	metrics       *BridgeMetrics
	mu            sync.RWMutex
}

// BridgeConfig holds configuration for the Fluvio-Kafka bridge
type BridgeConfig struct {
	FluvioEndpoint    string         `json:"fluvio_endpoint"`
	KafkaBrokers      []string       `json:"kafka_brokers"`
	TopicMappings     []TopicMapping `json:"topic_mappings"`
	BatchSize         int            `json:"batch_size"`
	FlushIntervalMs   int            `json:"flush_interval_ms"`
	RetryAttempts     int            `json:"retry_attempts"`
	RetryDelayMs      int            `json:"retry_delay_ms"`
	EnableCompression bool           `json:"enable_compression"`
	EnableIdempotence bool           `json:"enable_idempotence"`
}

// TopicMapping defines how Fluvio topics map to Kafka topics
type TopicMapping struct {
	FluvioTopic     string `json:"fluvio_topic"`
	KafkaTopic      string `json:"kafka_topic"`
	TransformFunc   string `json:"transform_func,omitempty"`
	PartitionKey    string `json:"partition_key,omitempty"`
	FilterCondition string `json:"filter_condition,omitempty"`
	Enabled         bool   `json:"enabled"`
}

// BridgeMetrics tracks bridge performance
type BridgeMetrics struct {
	MessagesReceived  int64     `json:"messages_received"`
	MessagesPublished int64     `json:"messages_published"`
	MessagesFailed    int64     `json:"messages_failed"`
	BytesTransferred  int64     `json:"bytes_transferred"`
	LastMessageTime   time.Time `json:"last_message_time"`
	AverageLatencyMs  float64   `json:"average_latency_ms"`
	ErrorCount        int64     `json:"error_count"`
	mu                sync.RWMutex
}

// FluvioClient wraps Fluvio consumer functionality
type FluvioClient struct {
	endpoint  string
	consumers map[string]*FluvioConsumer
	mu        sync.RWMutex
}

// FluvioConsumer represents a Fluvio topic consumer
type FluvioConsumer struct {
	topic     string
	offset    int64
	running   bool
	messageCh chan *FluvioMessage
	stopCh    chan struct{}
}

// FluvioMessage represents a message from Fluvio
type FluvioMessage struct {
	Topic     string            `json:"topic"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Key       []byte            `json:"key"`
	Value     []byte            `json:"value"`
	Headers   map[string]string `json:"headers"`
	Timestamp time.Time         `json:"timestamp"`
}

// DefaultBridgeConfig returns default bridge configuration
func DefaultBridgeConfig() *BridgeConfig {
	return &BridgeConfig{
		FluvioEndpoint:    "fluvio-sc.payment-switch.svc.cluster.local:9003",
		KafkaBrokers:      []string{"kafka.payment-switch.svc.cluster.local:9092"},
		BatchSize:         100,
		FlushIntervalMs:   100,
		RetryAttempts:     3,
		RetryDelayMs:      1000,
		EnableCompression: true,
		EnableIdempotence: true,
		TopicMappings: []TopicMapping{
			{
				FluvioTopic:  "pos-transactions",
				KafkaTopic:   "domain.events.pos",
				PartitionKey: "transaction_id",
				Enabled:      true,
			},
			{
				FluvioTopic:  "pos-settlements",
				KafkaTopic:   "domain.events.settlement",
				PartitionKey: "settlement_id",
				Enabled:      true,
			},
			{
				FluvioTopic:  "agent-transactions",
				KafkaTopic:   "domain.events.agent",
				PartitionKey: "agent_id",
				Enabled:      true,
			},
			{
				FluvioTopic:  "mobile-money-events",
				KafkaTopic:   "domain.events.mobile_money",
				PartitionKey: "transaction_id",
				Enabled:      true,
			},
		},
	}
}

// NewFluvioKafkaBridge creates a new bridge instance
func NewFluvioKafkaBridge(config *BridgeConfig) (*FluvioKafkaBridge, error) {
	if config == nil {
		config = DefaultBridgeConfig()
	}

	// Configure Kafka producer
	saramaConfig := sarama.NewConfig()
	saramaConfig.Producer.RequiredAcks = sarama.WaitForAll
	saramaConfig.Producer.Retry.Max = config.RetryAttempts
	saramaConfig.Producer.Return.Successes = true
	saramaConfig.Net.DialTimeout = 10 * time.Second

	if config.EnableCompression {
		saramaConfig.Producer.Compression = sarama.CompressionSnappy
	}

	if config.EnableIdempotence {
		saramaConfig.Producer.Idempotent = true
		saramaConfig.Net.MaxOpenRequests = 1
	}

	producer, err := sarama.NewSyncProducer(config.KafkaBrokers, saramaConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Kafka producer: %w", err)
	}

	fluvioClient := &FluvioClient{
		endpoint:  config.FluvioEndpoint,
		consumers: make(map[string]*FluvioConsumer),
	}

	return &FluvioKafkaBridge{
		config:        config,
		kafkaProducer: producer,
		fluvioClient:  fluvioClient,
		stopCh:        make(chan struct{}),
		metrics:       &BridgeMetrics{},
	}, nil
}

// Start begins the bridge operation
func (b *FluvioKafkaBridge) Start(ctx context.Context) error {
	b.mu.Lock()
	if b.running {
		b.mu.Unlock()
		return fmt.Errorf("bridge already running")
	}
	b.running = true
	b.mu.Unlock()

	// Start consumers for each topic mapping
	for _, mapping := range b.config.TopicMappings {
		if !mapping.Enabled {
			continue
		}

		consumer, err := b.fluvioClient.CreateConsumer(mapping.FluvioTopic)
		if err != nil {
			log.Printf("Failed to create consumer for %s: %v", mapping.FluvioTopic, err)
			continue
		}

		b.wg.Add(1)
		go b.bridgeMessages(ctx, consumer, mapping)
	}

	log.Printf("Fluvio-Kafka bridge started with %d topic mappings", len(b.config.TopicMappings))
	return nil
}

// Stop stops the bridge
func (b *FluvioKafkaBridge) Stop() {
	b.mu.Lock()
	if !b.running {
		b.mu.Unlock()
		return
	}
	b.running = false
	close(b.stopCh)
	b.mu.Unlock()

	b.wg.Wait()
	b.kafkaProducer.Close()
	b.fluvioClient.Close()

	log.Println("Fluvio-Kafka bridge stopped")
}

// bridgeMessages bridges messages from Fluvio to Kafka
func (b *FluvioKafkaBridge) bridgeMessages(ctx context.Context, consumer *FluvioConsumer, mapping TopicMapping) {
	defer b.wg.Done()

	batch := make([]*FluvioMessage, 0, b.config.BatchSize)
	flushTicker := time.NewTicker(time.Duration(b.config.FlushIntervalMs) * time.Millisecond)
	defer flushTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			b.flushBatch(batch, mapping)
			return
		case <-b.stopCh:
			b.flushBatch(batch, mapping)
			return
		case msg := <-consumer.messageCh:
			b.metrics.mu.Lock()
			b.metrics.MessagesReceived++
			b.metrics.mu.Unlock()

			batch = append(batch, msg)
			if len(batch) >= b.config.BatchSize {
				b.flushBatch(batch, mapping)
				batch = batch[:0]
			}
		case <-flushTicker.C:
			if len(batch) > 0 {
				b.flushBatch(batch, mapping)
				batch = batch[:0]
			}
		}
	}
}

// flushBatch publishes a batch of messages to Kafka
func (b *FluvioKafkaBridge) flushBatch(batch []*FluvioMessage, mapping TopicMapping) {
	if len(batch) == 0 {
		return
	}

	for _, msg := range batch {
		startTime := time.Now()

		// Transform message if needed
		transformedValue := b.transformMessage(msg, mapping)

		// Extract partition key
		partitionKey := b.extractPartitionKey(msg, mapping)

		// Create Kafka message
		kafkaMsg := &sarama.ProducerMessage{
			Topic: mapping.KafkaTopic,
			Key:   sarama.StringEncoder(partitionKey),
			Value: sarama.ByteEncoder(transformedValue),
			Headers: []sarama.RecordHeader{
				{Key: []byte("source"), Value: []byte("fluvio")},
				{Key: []byte("source_topic"), Value: []byte(mapping.FluvioTopic)},
				{Key: []byte("source_offset"), Value: []byte(fmt.Sprintf("%d", msg.Offset))},
				{Key: []byte("bridge_timestamp"), Value: []byte(time.Now().UTC().Format(time.RFC3339))},
			},
		}

		// Add original headers
		for k, v := range msg.Headers {
			kafkaMsg.Headers = append(kafkaMsg.Headers, sarama.RecordHeader{
				Key:   []byte(k),
				Value: []byte(v),
			})
		}

		// Publish with retry
		var err error
		for attempt := 0; attempt < b.config.RetryAttempts; attempt++ {
			_, _, err = b.kafkaProducer.SendMessage(kafkaMsg)
			if err == nil {
				break
			}
			time.Sleep(time.Duration(b.config.RetryDelayMs) * time.Millisecond)
		}

		latency := time.Since(startTime).Milliseconds()

		b.metrics.mu.Lock()
		if err != nil {
			b.metrics.MessagesFailed++
			b.metrics.ErrorCount++
			log.Printf("Failed to publish message to Kafka: %v", err)
		} else {
			b.metrics.MessagesPublished++
			b.metrics.BytesTransferred += int64(len(transformedValue))
			b.metrics.LastMessageTime = time.Now()
			// Update average latency (exponential moving average)
			b.metrics.AverageLatencyMs = b.metrics.AverageLatencyMs*0.9 + float64(latency)*0.1
		}
		b.metrics.mu.Unlock()
	}
}

// transformMessage applies transformation to the message
func (b *FluvioKafkaBridge) transformMessage(msg *FluvioMessage, mapping TopicMapping) []byte {
	// Parse original message
	var data map[string]interface{}
	if err := json.Unmarshal(msg.Value, &data); err != nil {
		// Return original if not JSON
		return msg.Value
	}

	// Add bridge metadata
	data["_bridge_metadata"] = map[string]interface{}{
		"source":           "fluvio",
		"source_topic":     mapping.FluvioTopic,
		"source_partition": msg.Partition,
		"source_offset":    msg.Offset,
		"bridge_timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	// Apply domain-specific transformations based on topic
	switch mapping.FluvioTopic {
	case "pos-transactions":
		data = b.transformPOSTransaction(data)
	case "pos-settlements":
		data = b.transformPOSSettlement(data)
	case "agent-transactions":
		data = b.transformAgentTransaction(data)
	case "mobile-money-events":
		data = b.transformMobileMoneyEvent(data)
	}

	result, err := json.Marshal(data)
	if err != nil {
		return msg.Value
	}
	return result
}

// transformPOSTransaction transforms POS transaction to domain event format
func (b *FluvioKafkaBridge) transformPOSTransaction(data map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"event_type":     "pos.transaction.completed",
		"event_version":  "1.0",
		"aggregate_type": "pos_transaction",
		"aggregate_id":   data["transaction_id"],
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"payload":        data,
		"correlation_id": data["correlation_id"],
	}
}

// transformPOSSettlement transforms POS settlement to domain event format
func (b *FluvioKafkaBridge) transformPOSSettlement(data map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"event_type":     "pos.settlement.completed",
		"event_version":  "1.0",
		"aggregate_type": "pos_settlement",
		"aggregate_id":   data["settlement_id"],
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"payload":        data,
		"correlation_id": data["correlation_id"],
	}
}

// transformAgentTransaction transforms agent transaction to domain event format
func (b *FluvioKafkaBridge) transformAgentTransaction(data map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"event_type":     "agent.transaction.completed",
		"event_version":  "1.0",
		"aggregate_type": "agent_transaction",
		"aggregate_id":   data["transaction_id"],
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"payload":        data,
		"agent_id":       data["agent_id"],
		"correlation_id": data["correlation_id"],
	}
}

// transformMobileMoneyEvent transforms mobile money event to domain event format
func (b *FluvioKafkaBridge) transformMobileMoneyEvent(data map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"event_type":     "mobile_money.transaction.completed",
		"event_version":  "1.0",
		"aggregate_type": "mobile_money_transaction",
		"aggregate_id":   data["transaction_id"],
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"payload":        data,
		"provider":       data["provider"],
		"correlation_id": data["correlation_id"],
	}
}

// extractPartitionKey extracts the partition key from the message
func (b *FluvioKafkaBridge) extractPartitionKey(msg *FluvioMessage, mapping TopicMapping) string {
	if mapping.PartitionKey == "" {
		return string(msg.Key)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(msg.Value, &data); err != nil {
		return string(msg.Key)
	}

	if val, ok := data[mapping.PartitionKey]; ok {
		return fmt.Sprintf("%v", val)
	}

	return string(msg.Key)
}

// GetMetrics returns current bridge metrics
func (b *FluvioKafkaBridge) GetMetrics() *BridgeMetrics {
	b.metrics.mu.RLock()
	defer b.metrics.mu.RUnlock()

	return &BridgeMetrics{
		MessagesReceived:  b.metrics.MessagesReceived,
		MessagesPublished: b.metrics.MessagesPublished,
		MessagesFailed:    b.metrics.MessagesFailed,
		BytesTransferred:  b.metrics.BytesTransferred,
		LastMessageTime:   b.metrics.LastMessageTime,
		AverageLatencyMs:  b.metrics.AverageLatencyMs,
		ErrorCount:        b.metrics.ErrorCount,
	}
}

// CreateConsumer creates a new Fluvio consumer for a topic
func (c *FluvioClient) CreateConsumer(topic string) (*FluvioConsumer, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if consumer, exists := c.consumers[topic]; exists {
		return consumer, nil
	}

	consumer := &FluvioConsumer{
		topic:     topic,
		offset:    0,
		running:   true,
		messageCh: make(chan *FluvioMessage, 1000),
		stopCh:    make(chan struct{}),
	}

	// Start consumer goroutine (simulated - in production would use Fluvio SDK)
	go consumer.consume(c.endpoint)

	c.consumers[topic] = consumer
	return consumer, nil
}

// Close closes all Fluvio consumers
func (c *FluvioClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, consumer := range c.consumers {
		consumer.Stop()
	}
}

// consume reads messages from Fluvio (simulated - in production would use Fluvio SDK)
func (c *FluvioConsumer) consume(endpoint string) {
	// In production, this would use the Fluvio Rust SDK via FFI or gRPC
	// For now, this is a placeholder that simulates the consumer behavior
	log.Printf("Fluvio consumer started for topic %s at %s", c.topic, endpoint)

	for c.running {
		select {
		case <-c.stopCh:
			return
		default:
			// In production: poll Fluvio for messages
			// fluvio.consume(c.topic, c.offset) -> messages
			time.Sleep(100 * time.Millisecond)
		}
	}
}

// Stop stops the consumer
func (c *FluvioConsumer) Stop() {
	c.running = false
	close(c.stopCh)
}

// BridgeHealthCheck represents bridge health status
type BridgeHealthCheck struct {
	Status           string    `json:"status"`
	FluvioConnected  bool      `json:"fluvio_connected"`
	KafkaConnected   bool      `json:"kafka_connected"`
	ActiveMappings   int       `json:"active_mappings"`
	MessagesInFlight int       `json:"messages_in_flight"`
	LastError        string    `json:"last_error,omitempty"`
	Uptime           string    `json:"uptime"`
	CheckedAt        time.Time `json:"checked_at"`
}

// HealthCheck performs a health check on the bridge
func (b *FluvioKafkaBridge) HealthCheck() *BridgeHealthCheck {
	b.mu.RLock()
	running := b.running
	b.mu.RUnlock()

	activeMappings := 0
	for _, m := range b.config.TopicMappings {
		if m.Enabled {
			activeMappings++
		}
	}

	status := "healthy"
	if !running {
		status = "stopped"
	}

	return &BridgeHealthCheck{
		Status:          status,
		FluvioConnected: running,
		KafkaConnected:  running,
		ActiveMappings:  activeMappings,
		CheckedAt:       time.Now(),
	}
}

// FluvioKafkaBridgeSchema returns the PostgreSQL schema for bridge state
func FluvioKafkaBridgeSchema() string {
	return `
-- Fluvio-Kafka bridge state tracking
CREATE TABLE IF NOT EXISTS fluvio_kafka_bridge_offsets (
    topic VARCHAR(255) PRIMARY KEY,
    last_offset BIGINT NOT NULL DEFAULT 0,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    messages_processed BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bridge metrics history
CREATE TABLE IF NOT EXISTS fluvio_kafka_bridge_metrics (
    id SERIAL PRIMARY KEY,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    messages_received BIGINT NOT NULL,
    messages_published BIGINT NOT NULL,
    messages_failed BIGINT NOT NULL,
    bytes_transferred BIGINT NOT NULL,
    average_latency_ms DECIMAL(10,2),
    error_count BIGINT NOT NULL
);

-- Index for metrics queries
CREATE INDEX IF NOT EXISTS idx_bridge_metrics_time 
ON fluvio_kafka_bridge_metrics(recorded_at DESC);

-- Dead letter queue for failed messages
CREATE TABLE IF NOT EXISTS fluvio_kafka_bridge_dlq (
    id SERIAL PRIMARY KEY,
    source_topic VARCHAR(255) NOT NULL,
    target_topic VARCHAR(255) NOT NULL,
    message_key TEXT,
    message_value JSONB NOT NULL,
    error_message TEXT NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_retry_at TIMESTAMP WITH TIME ZONE
);

-- Index for DLQ processing
CREATE INDEX IF NOT EXISTS idx_bridge_dlq_retry 
ON fluvio_kafka_bridge_dlq(retry_count, created_at);
`
}
