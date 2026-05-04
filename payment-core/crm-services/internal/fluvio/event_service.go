package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/infinyon/fluvio-go"
	"github.com/infinyon/fluvio-go/fluvio"
	"github.com/infinyon/fluvio-go/fluvio/smartmodule"

	"banking-crm-integration/go/models"
)

// FluvioConfig holds configuration for Fluvio event streaming
type FluvioConfig struct {
	BootstrapServers string
	ClientID         string
	Topics           map[string]string
	ConsumerGroup    string
	SmartModules     map[string]string
}

// FluvioEventService handles event streaming with Fluvio
type FluvioEventService struct {
	config       FluvioConfig
	client       *fluvio.Fluvio
	producers    map[string]fluvio.TopicProducer
	consumers    map[string]fluvio.PartitionConsumer
	handlers     map[string]EventHandler
	producerLock sync.RWMutex
	consumerLock sync.RWMutex
	handlerLock  sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

// EventHandler is a function that handles events
type EventHandler func(event []byte) error

// NewFluvioEventService creates a new FluvioEventService
func NewFluvioEventService(config FluvioConfig) (*FluvioEventService, error) {
	ctx, cancel := context.WithCancel(context.Background())

	service := &FluvioEventService{
		config:    config,
		producers: make(map[string]fluvio.TopicProducer),
		consumers: make(map[string]fluvio.PartitionConsumer),
		handlers:  make(map[string]EventHandler),
		ctx:       ctx,
		cancel:    cancel,
	}

	// Connect to Fluvio
	err := service.connect()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to connect to Fluvio: %w", err)
	}

	return service, nil
}

// connect establishes connection to Fluvio
func (s *FluvioEventService) connect() error {
	// Create Fluvio client
	client, err := fluvio.Connect(s.config.BootstrapServers)
	if err != nil {
		return fmt.Errorf("failed to connect to Fluvio: %w", err)
	}

	s.client = client
	log.Printf("Connected to Fluvio at %s", s.config.BootstrapServers)

	return nil
}

// Close closes the FluvioEventService
func (s *FluvioEventService) Close() error {
	// Cancel context
	s.cancel()

	// Close producers
	s.producerLock.Lock()
	for topic, producer := range s.producers {
		if err := producer.Close(); err != nil {
			log.Printf("Error closing producer for topic %s: %v", topic, err)
		}
	}
	s.producerLock.Unlock()

	// Close consumers
	s.consumerLock.Lock()
	for topic, consumer := range s.consumers {
		if err := consumer.Close(); err != nil {
			log.Printf("Error closing consumer for topic %s: %v", topic, err)
		}
	}
	s.consumerLock.Unlock()

	// Close client
	if s.client != nil {
		if err := s.client.Close(); err != nil {
			return fmt.Errorf("failed to close Fluvio client: %w", err)
		}
	}

	log.Println("Fluvio event service closed")
	return nil
}

// getProducer gets or creates a producer for a topic
func (s *FluvioEventService) getProducer(topic string) (fluvio.TopicProducer, error) {
	s.producerLock.RLock()
	producer, exists := s.producers[topic]
	s.producerLock.RUnlock()

	if exists {
		return producer, nil
	}

	// Create producer
	producer, err := s.client.TopicProducer(topic)
	if err != nil {
		return nil, fmt.Errorf("failed to create producer for topic %s: %w", topic, err)
	}

	// Store producer
	s.producerLock.Lock()
	s.producers[topic] = producer
	s.producerLock.Unlock()

	log.Printf("Created producer for topic %s", topic)
	return producer, nil
}

// getConsumer gets or creates a consumer for a topic
func (s *FluvioEventService) getConsumer(topic string) (fluvio.PartitionConsumer, error) {
	s.consumerLock.RLock()
	consumer, exists := s.consumers[topic]
	s.consumerLock.RUnlock()

	if exists {
		return consumer, nil
	}

	// Create consumer
	consumer, err := s.client.PartitionConsumer(fluvio.ConsumerConfig{
		Topic:     topic,
		Partition: 0,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create consumer for topic %s: %w", topic, err)
	}

	// Store consumer
	s.consumerLock.Lock()
	s.consumers[topic] = consumer
	s.consumerLock.Unlock()

	log.Printf("Created consumer for topic %s", topic)
	return consumer, nil
}

// PublishEvent publishes an event to a topic
func (s *FluvioEventService) PublishEvent(topic string, event interface{}) error {
	// Get producer
	producer, err := s.getProducer(topic)
	if err != nil {
		return err
	}

	// Marshal event to JSON
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Send event
	err = producer.Send(string(data))
	if err != nil {
		return fmt.Errorf("failed to send event to topic %s: %w", topic, err)
	}

	log.Printf("Published event to topic %s", topic)
	return nil
}

// PublishBankingEvent publishes a banking event
func (s *FluvioEventService) PublishBankingEvent(event models.BankingEvent) error {
	// Get topic
	topic, exists := s.config.Topics["banking_events"]
	if !exists {
		return fmt.Errorf("banking_events topic not configured")
	}

	// Publish event
	return s.PublishEvent(topic, event)
}

// PublishCustomerEvent publishes a customer event
func (s *FluvioEventService) PublishCustomerEvent(event models.CustomerEvent) error {
	// Get topic
	topic, exists := s.config.Topics["customer_events"]
	if !exists {
		return fmt.Errorf("customer_events topic not configured")
	}

	// Publish event
	return s.PublishEvent(topic, event)
}

// PublishTransactionEvent publishes a transaction event
func (s *FluvioEventService) PublishTransactionEvent(event models.TransactionEvent) error {
	// Get topic
	topic, exists := s.config.Topics["transaction_events"]
	if !exists {
		return fmt.Errorf("transaction_events topic not configured")
	}

	// Publish event
	return s.PublishEvent(topic, event)
}

// PublishFraudEvent publishes a fraud event
func (s *FluvioEventService) PublishFraudEvent(event models.FraudEvent) error {
	// Get topic
	topic, exists := s.config.Topics["fraud_events"]
	if !exists {
		return fmt.Errorf("fraud_events topic not configured")
	}

	// Publish event
	return s.PublishEvent(topic, event)
}

// RegisterEventHandler registers a handler for events from a topic
func (s *FluvioEventService) RegisterEventHandler(topic string, handler EventHandler) {
	s.handlerLock.Lock()
	defer s.handlerLock.Unlock()

	s.handlers[topic] = handler
	log.Printf("Registered handler for topic %s", topic)
}

// StartConsumer starts consuming events from a topic
func (s *FluvioEventService) StartConsumer(topic string) error {
	// Get consumer
	consumer, err := s.getConsumer(topic)
	if err != nil {
		return err
	}

	// Get handler
	s.handlerLock.RLock()
	handler, exists := s.handlers[topic]
	s.handlerLock.RUnlock()

	if !exists {
		return fmt.Errorf("no handler registered for topic %s", topic)
	}

	// Start consuming
	go func() {
		log.Printf("Starting consumer for topic %s", topic)

		// Stream events
		stream, err := consumer.Stream(fluvio.StreamConfig{})
		if err != nil {
			log.Printf("Error creating stream for topic %s: %v", topic, err)
			return
		}

		for {
			select {
			case <-s.ctx.Done():
				log.Printf("Stopping consumer for topic %s", topic)
				return
			default:
				// Read next record
				record, err := stream.Next()
				if err != nil {
					log.Printf("Error reading from topic %s: %v", topic, err)
					time.Sleep(1 * time.Second)
					continue
				}

				// Handle record
				err = handler(record.Value())
				if err != nil {
					log.Printf("Error handling event from topic %s: %v", topic, err)
				}
			}
		}
	}()

	return nil
}

// StartAllConsumers starts all configured consumers
func (s *FluvioEventService) StartAllConsumers() error {
	for topic := range s.config.Topics {
		err := s.StartConsumer(topic)
		if err != nil {
			return fmt.Errorf("failed to start consumer for topic %s: %w", topic, err)
		}
	}

	log.Println("Started all consumers")
	return nil
}

// ApplySmartModule applies a smart module to a topic
func (s *FluvioEventService) ApplySmartModule(topic string, moduleName string) error {
	// Get smart module
	moduleWasm, exists := s.config.SmartModules[moduleName]
	if !exists {
		return fmt.Errorf("smart module %s not configured", moduleName)
	}

	// Create smart module
	module, err := smartmodule.NewFromWasm([]byte(moduleWasm))
	if err != nil {
		return fmt.Errorf("failed to create smart module %s: %w", moduleName, err)
	}

	// Apply smart module
	consumer, err := s.getConsumer(topic)
	if err != nil {
		return err
	}

	// Create stream with smart module
	_, err = consumer.StreamWithSmartModule(fluvio.StreamConfig{}, module)
	if err != nil {
		return fmt.Errorf("failed to apply smart module %s to topic %s: %w", moduleName, topic, err)
	}

	log.Printf("Applied smart module %s to topic %s", moduleName, topic)
	return nil
}

// HandleBankingEvents registers handlers for banking events
func (s *FluvioEventService) HandleBankingEvents(handler func(event models.BankingEvent) error) error {
	// Get topic
	topic, exists := s.config.Topics["banking_events"]
	if !exists {
		return fmt.Errorf("banking_events topic not configured")
	}

	// Register handler
	s.RegisterEventHandler(topic, func(data []byte) error {
		var event models.BankingEvent
		if err := json.Unmarshal(data, &event); err != nil {
			return fmt.Errorf("failed to unmarshal banking event: %w", err)
		}
		return handler(event)
	})

	// Start consumer
	return s.StartConsumer(topic)
}

// HandleCustomerEvents registers handlers for customer events
func (s *FluvioEventService) HandleCustomerEvents(handler func(event models.CustomerEvent) error) error {
	// Get topic
	topic, exists := s.config.Topics["customer_events"]
	if !exists {
		return fmt.Errorf("customer_events topic not configured")
	}

	// Register handler
	s.RegisterEventHandler(topic, func(data []byte) error {
		var event models.CustomerEvent
		if err := json.Unmarshal(data, &event); err != nil {
			return fmt.Errorf("failed to unmarshal customer event: %w", err)
		}
		return handler(event)
	})

	// Start consumer
	return s.StartConsumer(topic)
}

// HandleTransactionEvents registers handlers for transaction events
func (s *FluvioEventService) HandleTransactionEvents(handler func(event models.TransactionEvent) error) error {
	// Get topic
	topic, exists := s.config.Topics["transaction_events"]
	if !exists {
		return fmt.Errorf("transaction_events topic not configured")
	}

	// Register handler
	s.RegisterEventHandler(topic, func(data []byte) error {
		var event models.TransactionEvent
		if err := json.Unmarshal(data, &event); err != nil {
			return fmt.Errorf("failed to unmarshal transaction event: %w", err)
		}
		return handler(event)
	})

	// Start consumer
	return s.StartConsumer(topic)
}

// HandleFraudEvents registers handlers for fraud events
func (s *FluvioEventService) HandleFraudEvents(handler func(event models.FraudEvent) error) error {
	// Get topic
	topic, exists := s.config.Topics["fraud_events"]
	if !exists {
		return fmt.Errorf("fraud_events topic not configured")
	}

	// Register handler
	s.RegisterEventHandler(topic, func(data []byte) error {
		var event models.FraudEvent
		if err := json.Unmarshal(data, &event); err != nil {
			return fmt.Errorf("failed to unmarshal fraud event: %w", err)
		}
		return handler(event)
	})

	// Start consumer
	return s.StartConsumer(topic)
}

// CreateMQTTIntegration creates an MQTT integration for IoT/POS devices
func (s *FluvioEventService) CreateMQTTIntegration(mqttTopic string, fluvioTopic string, mqttConfig map[string]string) error {
	// This would typically involve creating a Fluvio connector
	// For now, we'll just log the integration
	log.Printf("Creating MQTT integration from %s to %s", mqttTopic, fluvioTopic)
	return nil
}

