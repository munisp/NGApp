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

	"github.com/infinyon/fluvio-client-go/fluvio"
	"github.com/segmentio/kafka-go"
)

// FluvioNativeBridge provides bi-directional streaming between Kafka and Fluvio
// using native SDKs for optimal performance
type FluvioNativeBridge struct {
	kafkaReaders   map[string]*kafka.Reader
	kafkaWriters   map[string]*kafka.Writer
	fluvioClient   *fluvio.Fluvio
	fluvioProducers map[string]*fluvio.TopicProducer
	fluvioConsumers map[string]*fluvio.PartitionConsumer
	wg             sync.WaitGroup
	ctx            context.Context
	cancel         context.CancelFunc
	mu             sync.RWMutex
	metrics        *BridgeMetrics
}

// BridgeConfig holds configuration for the bridge
type BridgeConfig struct {
	KafkaBrokers   string
	FluvioEndpoint string
	TopicMappings  map[string]string // Kafka topic -> Fluvio topic
}

// BridgeMetrics tracks bridge performance
type BridgeMetrics struct {
	KafkaToFluvioMessages   int64
	FluvioToKafkaMessages   int64
	KafkaToFluvioErrors     int64
	FluvioToKafkaErrors     int64
	LastKafkaToFluvioTime   time.Time
	LastFluvioToKafkaTime   time.Time
	mu                      sync.RWMutex
}

func (m *BridgeMetrics) IncrementKafkaToFluvio() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.KafkaToFluvioMessages++
	m.LastKafkaToFluvioTime = time.Now()
}

func (m *BridgeMetrics) IncrementFluvioToKafka() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FluvioToKafkaMessages++
	m.LastFluvioToKafkaTime = time.Now()
}

func (m *BridgeMetrics) IncrementKafkaToFluvioError() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.KafkaToFluvioErrors++
}

func (m *BridgeMetrics) IncrementFluvioToKafkaError() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FluvioToKafkaErrors++
}

func (m *BridgeMetrics) GetStats() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return map[string]interface{}{
		"kafka_to_fluvio_messages": m.KafkaToFluvioMessages,
		"fluvio_to_kafka_messages": m.FluvioToKafkaMessages,
		"kafka_to_fluvio_errors":   m.KafkaToFluvioErrors,
		"fluvio_to_kafka_errors":   m.FluvioToKafkaErrors,
		"last_kafka_to_fluvio":     m.LastKafkaToFluvioTime,
		"last_fluvio_to_kafka":     m.LastFluvioToKafkaTime,
	}
}

// NewFluvioNativeBridge creates a new bridge instance
func NewFluvioNativeBridge(config BridgeConfig) (*FluvioNativeBridge, error) {
	ctx, cancel := context.WithCancel(context.Background())

	// Connect to Fluvio cluster using native SDK
	fluvioClient, err := fluvio.Connect()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to connect to Fluvio: %w", err)
	}

	return &FluvioNativeBridge{
		kafkaReaders:    make(map[string]*kafka.Reader),
		kafkaWriters:    make(map[string]*kafka.Writer),
		fluvioClient:    fluvioClient,
		fluvioProducers: make(map[string]*fluvio.TopicProducer),
		fluvioConsumers: make(map[string]*fluvio.PartitionConsumer),
		ctx:             ctx,
		cancel:          cancel,
		metrics:         &BridgeMetrics{},
	}, nil
}

// Start initializes all bridges based on topic mappings
func (b *FluvioNativeBridge) Start(config BridgeConfig) error {
	for kafkaTopic, fluvioTopic := range config.TopicMappings {
		// Setup Kafka -> Fluvio bridge
		if err := b.setupKafkaToFluvioBridge(kafkaTopic, fluvioTopic, config.KafkaBrokers); err != nil {
			return fmt.Errorf("failed to setup Kafka->Fluvio bridge for %s: %w", kafkaTopic, err)
		}

		// Setup Fluvio -> Kafka bridge
		if err := b.setupFluvioToKafkaBridge(fluvioTopic, kafkaTopic, config.KafkaBrokers); err != nil {
			return fmt.Errorf("failed to setup Fluvio->Kafka bridge for %s: %w", fluvioTopic, err)
		}
	}

	log.Println("Fluvio Native Bridge started successfully")
	return nil
}

// setupKafkaToFluvioBridge creates a Kafka consumer and Fluvio producer
func (b *FluvioNativeBridge) setupKafkaToFluvioBridge(kafkaTopic, fluvioTopic, brokers string) error {
	// Create Kafka reader
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        []string{brokers},
		Topic:          kafkaTopic,
		GroupID:        fmt.Sprintf("fluvio-native-bridge-%s", kafkaTopic),
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})

	b.mu.Lock()
	b.kafkaReaders[kafkaTopic] = reader
	b.mu.Unlock()

	// Create Fluvio producer using native SDK
	producer, err := b.fluvioClient.TopicProducer(fluvioTopic)
	if err != nil {
		return fmt.Errorf("failed to create Fluvio producer for %s: %w", fluvioTopic, err)
	}

	b.mu.Lock()
	b.fluvioProducers[fluvioTopic] = producer
	b.mu.Unlock()

	// Start consumer goroutine
	b.wg.Add(1)
	go b.consumeKafkaToFluvio(kafkaTopic, fluvioTopic, reader, producer)

	log.Printf("Setup Kafka->Fluvio bridge: %s -> %s (native SDK)", kafkaTopic, fluvioTopic)
	return nil
}

// setupFluvioToKafkaBridge creates a Fluvio consumer and Kafka producer
func (b *FluvioNativeBridge) setupFluvioToKafkaBridge(fluvioTopic, kafkaTopic, brokers string) error {
	// Create Kafka writer
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers),
		Topic:        kafkaTopic,
		Balancer:     &kafka.Hash{},
		RequiredAcks: kafka.RequireAll,
		Compression:  kafka.Snappy,
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
	}

	b.mu.Lock()
	b.kafkaWriters[kafkaTopic] = writer
	b.mu.Unlock()

	// Create Fluvio consumer using native SDK
	consumer, err := b.fluvioClient.PartitionConsumer(fluvioTopic, 0)
	if err != nil {
		return fmt.Errorf("failed to create Fluvio consumer for %s: %w", fluvioTopic, err)
	}

	b.mu.Lock()
	b.fluvioConsumers[fluvioTopic] = consumer
	b.mu.Unlock()

	// Start consumer goroutine
	b.wg.Add(1)
	go b.consumeFluvioToKafka(fluvioTopic, kafkaTopic, consumer, writer)

	log.Printf("Setup Fluvio->Kafka bridge: %s -> %s (native SDK)", fluvioTopic, kafkaTopic)
	return nil
}

// consumeKafkaToFluvio reads from Kafka and writes to Fluvio
func (b *FluvioNativeBridge) consumeKafkaToFluvio(kafkaTopic, fluvioTopic string, reader *kafka.Reader, producer *fluvio.TopicProducer) {
	defer b.wg.Done()

	for {
		select {
		case <-b.ctx.Done():
			return
		default:
			msg, err := reader.ReadMessage(b.ctx)
			if err != nil {
				if err == context.Canceled {
					return
				}
				log.Printf("Error reading from Kafka topic %s: %v", kafkaTopic, err)
				b.metrics.IncrementKafkaToFluvioError()
				continue
			}

			// Send to Fluvio using native SDK
			if err := producer.Send(msg.Key, msg.Value); err != nil {
				log.Printf("Failed to send to Fluvio topic %s: %v", fluvioTopic, err)
				b.metrics.IncrementKafkaToFluvioError()
				continue
			}

			b.metrics.IncrementKafkaToFluvio()
		}
	}
}

// consumeFluvioToKafka reads from Fluvio and writes to Kafka
func (b *FluvioNativeBridge) consumeFluvioToKafka(fluvioTopic, kafkaTopic string, consumer *fluvio.PartitionConsumer, writer *kafka.Writer) {
	defer b.wg.Done()

	// Create a stream from the consumer
	stream, err := consumer.Stream(fluvio.NewOffsetFromEnd(0))
	if err != nil {
		log.Printf("Failed to create Fluvio stream for %s: %v", fluvioTopic, err)
		return
	}

	for {
		select {
		case <-b.ctx.Done():
			return
		default:
			// Read next record from Fluvio stream
			record, err := stream.Next()
			if err != nil {
				if err == context.Canceled {
					return
				}
				log.Printf("Error reading from Fluvio topic %s: %v", fluvioTopic, err)
				b.metrics.IncrementFluvioToKafkaError()
				continue
			}

			// Send to Kafka
			msg := kafka.Message{
				Key:   record.Key(),
				Value: record.Value(),
				Time:  time.Now(),
			}

			if err := writer.WriteMessages(b.ctx, msg); err != nil {
				log.Printf("Failed to write to Kafka topic %s: %v", kafkaTopic, err)
				b.metrics.IncrementFluvioToKafkaError()
				continue
			}

			b.metrics.IncrementFluvioToKafka()
		}
	}
}

// GetMetrics returns current bridge metrics
func (b *FluvioNativeBridge) GetMetrics() map[string]interface{} {
	return b.metrics.GetStats()
}

// Stop gracefully shuts down the bridge
func (b *FluvioNativeBridge) Stop() error {
	log.Println("Shutting down Fluvio Native Bridge...")

	b.cancel()

	// Close Kafka readers
	b.mu.RLock()
	for _, reader := range b.kafkaReaders {
		if err := reader.Close(); err != nil {
			log.Printf("Error closing Kafka reader: %v", err)
		}
	}

	// Close Kafka writers
	for _, writer := range b.kafkaWriters {
		if err := writer.Close(); err != nil {
			log.Printf("Error closing Kafka writer: %v", err)
		}
	}
	b.mu.RUnlock()

	// Wait for all goroutines to finish
	b.wg.Wait()

	// Print final metrics
	metrics := b.GetMetrics()
	metricsJSON, _ := json.MarshalIndent(metrics, "", "  ")
	log.Printf("Final bridge metrics:\n%s", string(metricsJSON))

	log.Println("Fluvio Native Bridge stopped")
	return nil
}

func main() {
	config := BridgeConfig{
		KafkaBrokers:   getEnv("KAFKA_BROKERS", "kafka-0.kafka-headless:9092"),
		FluvioEndpoint: getEnv("FLUVIO_ENDPOINT", "fluvio-sc:9003"),
		TopicMappings: map[string]string{
			"fraud-detection-events": "fraud-detection-realtime",
			"analytics-events":       "analytics-realtime",
			"geospatial-events":      "geospatial-events",
			"ml-predictions":         "ml-predictions-realtime",
			"policy-events":          "policy-events-stream",
			"claim-events":           "claim-events-stream",
			"payment-events":         "payment-events-stream",
		},
	}

	bridge, err := NewFluvioNativeBridge(config)
	if err != nil {
		log.Fatalf("Failed to create bridge: %v", err)
	}

	if err := bridge.Start(config); err != nil {
		log.Fatalf("Failed to start bridge: %v", err)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	if err := bridge.Stop(); err != nil {
		log.Fatalf("Failed to stop bridge: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
