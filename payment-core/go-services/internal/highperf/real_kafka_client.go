// Package highperf provides real Kafka client integration using segmentio/kafka-go
package highperf

import (
	"context"
	"crypto/tls"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

// RealKafkaProducer implements KafkaProducer interface with real Kafka client
type RealKafkaProducer struct {
	writers   map[string]*kafka.Writer
	writersMu sync.RWMutex
	config    RealKafkaConfig
	dialer    *kafka.Dialer

	// Stats
	totalProduced  uint64
	totalFailed    uint64
	totalBytes     uint64
	totalLatencyNs uint64
}

// RealKafkaConfig configures the real Kafka producer
type RealKafkaConfig struct {
	Brokers          []string
	SecurityProtocol string // PLAINTEXT, SASL_SSL, SASL_PLAINTEXT
	SASLMechanism    string // SCRAM-SHA-256, SCRAM-SHA-512
	SASLUsername     string
	SASLPassword     string
	BatchSize        int
	BatchBytes       int64
	BatchTimeout     time.Duration
	RequiredAcks     kafka.RequiredAcks
	Compression      kafka.Compression
	MaxAttempts      int
	ReadTimeout      time.Duration
	WriteTimeout     time.Duration
	Async            bool
}

// DefaultRealKafkaConfig returns production-optimized defaults
func DefaultRealKafkaConfig() RealKafkaConfig {
	return RealKafkaConfig{
		Brokers:          []string{"kafka-0:9092", "kafka-1:9092", "kafka-2:9092"},
		SecurityProtocol: "PLAINTEXT",
		BatchSize:        1000,
		BatchBytes:       65536, // 64KB
		BatchTimeout:     5 * time.Millisecond,
		RequiredAcks:     kafka.RequireOne,
		Compression:      kafka.Lz4,
		MaxAttempts:      3,
		ReadTimeout:      10 * time.Second,
		WriteTimeout:     10 * time.Second,
		Async:            true,
	}
}

// NewRealKafkaProducer creates a new real Kafka producer
func NewRealKafkaProducer(config RealKafkaConfig) (*RealKafkaProducer, error) {
	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
	}

	// Configure SASL if needed
	if config.SASLMechanism != "" && config.SASLUsername != "" {
		var mechanism scram.Algorithm
		switch config.SASLMechanism {
		case "SCRAM-SHA-256":
			mechanism = scram.SHA256
		case "SCRAM-SHA-512":
			mechanism = scram.SHA512
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", config.SASLMechanism)
		}

		scramMech, err := scram.Mechanism(mechanism, config.SASLUsername, config.SASLPassword)
		if err != nil {
			return nil, fmt.Errorf("failed to create SCRAM mechanism: %w", err)
		}
		dialer.SASLMechanism = scramMech
	}

	// Configure TLS if needed
	if config.SecurityProtocol == "SASL_SSL" || config.SecurityProtocol == "SSL" {
		dialer.TLS = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	return &RealKafkaProducer{
		writers: make(map[string]*kafka.Writer),
		config:  config,
		dialer:  dialer,
	}, nil
}

// getWriter gets or creates a writer for a topic
func (p *RealKafkaProducer) getWriter(topic string) *kafka.Writer {
	p.writersMu.RLock()
	writer, ok := p.writers[topic]
	p.writersMu.RUnlock()

	if ok {
		return writer
	}

	p.writersMu.Lock()
	defer p.writersMu.Unlock()

	// Double-check after acquiring write lock
	if writer, ok = p.writers[topic]; ok {
		return writer
	}

	writer = &kafka.Writer{
		Addr:         kafka.TCP(p.config.Brokers...),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    p.config.BatchSize,
		BatchBytes:   p.config.BatchBytes,
		BatchTimeout: p.config.BatchTimeout,
		RequiredAcks: p.config.RequiredAcks,
		Compression:  p.config.Compression,
		MaxAttempts:  p.config.MaxAttempts,
		ReadTimeout:  p.config.ReadTimeout,
		WriteTimeout: p.config.WriteTimeout,
		Async:        p.config.Async,
		Transport: &kafka.Transport{
			Dial: p.dialer.DialFunc,
			TLS:  p.dialer.TLS,
			SASL: p.dialer.SASLMechanism,
		},
	}

	p.writers[topic] = writer
	return writer
}

// ProduceBatch implements KafkaProducer interface
func (p *RealKafkaProducer) ProduceBatch(ctx context.Context, events []KafkaEvent) error {
	if len(events) == 0 {
		return nil
	}

	startTime := time.Now()

	// Group events by topic
	byTopic := make(map[string][]kafka.Message)
	for _, event := range events {
		headers := make([]kafka.Header, 0, len(event.Headers))
		for k, v := range event.Headers {
			headers = append(headers, kafka.Header{Key: k, Value: v})
		}

		msg := kafka.Message{
			Key:     event.Key,
			Value:   event.Value,
			Headers: headers,
			Time:    event.Timestamp,
		}
		byTopic[event.Topic] = append(byTopic[event.Topic], msg)
	}

	// Write to each topic
	var lastErr error
	var totalBytes int
	for topic, messages := range byTopic {
		writer := p.getWriter(topic)
		if err := writer.WriteMessages(ctx, messages...); err != nil {
			lastErr = err
			atomic.AddUint64(&p.totalFailed, uint64(len(messages)))
		} else {
			atomic.AddUint64(&p.totalProduced, uint64(len(messages)))
			for _, msg := range messages {
				totalBytes += len(msg.Key) + len(msg.Value)
			}
		}
	}

	atomic.AddUint64(&p.totalBytes, uint64(totalBytes))
	atomic.AddUint64(&p.totalLatencyNs, uint64(time.Since(startTime).Nanoseconds()))

	return lastErr
}

// Produce produces a single message
func (p *RealKafkaProducer) Produce(ctx context.Context, topic string, key, value []byte, headers map[string][]byte) error {
	event := KafkaEvent{
		Topic:     topic,
		Key:       key,
		Value:     value,
		Headers:   headers,
		Timestamp: time.Now(),
	}
	return p.ProduceBatch(ctx, []KafkaEvent{event})
}

// Close closes all writers
func (p *RealKafkaProducer) Close() error {
	p.writersMu.Lock()
	defer p.writersMu.Unlock()

	var lastErr error
	for _, writer := range p.writers {
		if err := writer.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// Stats returns producer statistics
func (p *RealKafkaProducer) Stats() (produced, failed, bytes uint64, avgLatencyMs float64) {
	produced = atomic.LoadUint64(&p.totalProduced)
	failed = atomic.LoadUint64(&p.totalFailed)
	bytes = atomic.LoadUint64(&p.totalBytes)
	totalLatency := atomic.LoadUint64(&p.totalLatencyNs)
	if produced > 0 {
		avgLatencyMs = float64(totalLatency) / float64(produced) / 1e6
	}
	return
}

// RealKafkaConsumer provides real Kafka consumer functionality
type RealKafkaConsumer struct {
	reader  *kafka.Reader
	config  RealKafkaConsumerConfig
	handler MessageHandler

	// Stats
	totalConsumed uint64
	totalErrors   uint64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// MessageHandler handles consumed messages
type MessageHandler func(ctx context.Context, msg kafka.Message) error

// RealKafkaConsumerConfig configures the Kafka consumer
type RealKafkaConsumerConfig struct {
	Brokers          []string
	Topic            string
	GroupID          string
	MinBytes         int
	MaxBytes         int
	MaxWait          time.Duration
	CommitInterval   time.Duration
	StartOffset      int64
	SecurityProtocol string
	SASLMechanism    string
	SASLUsername     string
	SASLPassword     string
}

// DefaultRealKafkaConsumerConfig returns production-optimized defaults
func DefaultRealKafkaConsumerConfig(topic, groupID string) RealKafkaConsumerConfig {
	return RealKafkaConsumerConfig{
		Brokers:        []string{"kafka-0:9092", "kafka-1:9092", "kafka-2:9092"},
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       1,
		MaxBytes:       10e6, // 10MB
		MaxWait:        100 * time.Millisecond,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	}
}

// NewRealKafkaConsumer creates a new real Kafka consumer
func NewRealKafkaConsumer(config RealKafkaConsumerConfig, handler MessageHandler) (*RealKafkaConsumer, error) {
	dialer := &kafka.Dialer{
		Timeout:   10 * time.Second,
		DualStack: true,
	}

	// Configure SASL if needed
	if config.SASLMechanism != "" && config.SASLUsername != "" {
		var mechanism scram.Algorithm
		switch config.SASLMechanism {
		case "SCRAM-SHA-256":
			mechanism = scram.SHA256
		case "SCRAM-SHA-512":
			mechanism = scram.SHA512
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", config.SASLMechanism)
		}

		scramMech, err := scram.Mechanism(mechanism, config.SASLUsername, config.SASLPassword)
		if err != nil {
			return nil, fmt.Errorf("failed to create SCRAM mechanism: %w", err)
		}
		dialer.SASLMechanism = scramMech
	}

	// Configure TLS if needed
	if config.SecurityProtocol == "SASL_SSL" || config.SecurityProtocol == "SSL" {
		dialer.TLS = &tls.Config{
			MinVersion: tls.VersionTLS12,
		}
	}

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        config.Brokers,
		Topic:          config.Topic,
		GroupID:        config.GroupID,
		MinBytes:       config.MinBytes,
		MaxBytes:       config.MaxBytes,
		MaxWait:        config.MaxWait,
		CommitInterval: config.CommitInterval,
		StartOffset:    config.StartOffset,
		Dialer:         dialer,
	})

	ctx, cancel := context.WithCancel(context.Background())

	return &RealKafkaConsumer{
		reader:  reader,
		config:  config,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}, nil
}

// Start starts consuming messages
func (c *RealKafkaConsumer) Start() {
	c.wg.Add(1)
	go c.consumeLoop()
}

func (c *RealKafkaConsumer) consumeLoop() {
	defer c.wg.Done()

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
			msg, err := c.reader.FetchMessage(c.ctx)
			if err != nil {
				if c.ctx.Err() != nil {
					return
				}
				atomic.AddUint64(&c.totalErrors, 1)
				continue
			}

			if err := c.handler(c.ctx, msg); err != nil {
				atomic.AddUint64(&c.totalErrors, 1)
				// Don't commit on error - will be reprocessed
				continue
			}

			if err := c.reader.CommitMessages(c.ctx, msg); err != nil {
				atomic.AddUint64(&c.totalErrors, 1)
			} else {
				atomic.AddUint64(&c.totalConsumed, 1)
			}
		}
	}
}

// Stop stops the consumer
func (c *RealKafkaConsumer) Stop() error {
	c.cancel()
	c.wg.Wait()
	return c.reader.Close()
}

// Stats returns consumer statistics
func (c *RealKafkaConsumer) Stats() (consumed, errors uint64) {
	return atomic.LoadUint64(&c.totalConsumed), atomic.LoadUint64(&c.totalErrors)
}

// KafkaHealthCheck checks Kafka connectivity
func KafkaHealthCheck(ctx context.Context, brokers []string) error {
	conn, err := kafka.DialContext(ctx, "tcp", brokers[0])
	if err != nil {
		return fmt.Errorf("failed to connect to Kafka: %w", err)
	}
	defer conn.Close()

	_, err = conn.Brokers()
	if err != nil {
		return fmt.Errorf("failed to get brokers: %w", err)
	}

	return nil
}

// CreateTopicIfNotExists creates a topic if it doesn't exist
func CreateTopicIfNotExists(ctx context.Context, brokers []string, topic string, numPartitions, replicationFactor int) error {
	conn, err := kafka.DialContext(ctx, "tcp", brokers[0])
	if err != nil {
		return fmt.Errorf("failed to connect to Kafka: %w", err)
	}
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		return fmt.Errorf("failed to get controller: %w", err)
	}

	controllerConn, err := kafka.Dial("tcp", fmt.Sprintf("%s:%d", controller.Host, controller.Port))
	if err != nil {
		return fmt.Errorf("failed to connect to controller: %w", err)
	}
	defer controllerConn.Close()

	topicConfigs := []kafka.TopicConfig{
		{
			Topic:             topic,
			NumPartitions:     numPartitions,
			ReplicationFactor: replicationFactor,
		},
	}

	err = controllerConn.CreateTopics(topicConfigs...)
	if err != nil {
		// Ignore "topic already exists" error
		return nil
	}

	return nil
}
