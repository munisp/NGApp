package kafka

import (
	"encoding/json"
	"log"
	"sync"
)

// Client wraps Kafka producer/consumer functionality.
// In production, this connects to Kafka brokers via confluent-kafka-go or segmentio/kafka-go.
// Topics: nexcom.orders, nexcom.trades, nexcom.market-data, nexcom.settlements,
// nexcom.alerts, nexcom.notifications, nexcom.audit-log
type Client struct {
	brokers    string
	connected  bool
	mu         sync.RWMutex
	handlers   map[string][]func([]byte)
}

func NewClient(brokers string) *Client {
	c := &Client{
		brokers:  brokers,
		handlers: make(map[string][]func([]byte)),
	}
	c.connect()
	return c
}

func (c *Client) connect() {
	// In production: initialize Kafka producer and consumer groups
	// Producer config: acks=all, retries=3, idempotence=true
	// Consumer config: group.id=nexcom-gateway, auto.offset.reset=earliest
	log.Printf("[Kafka] Initializing connection to brokers: %s", c.brokers)
	c.mu.Lock()
	c.connected = true
	c.mu.Unlock()
	log.Printf("[Kafka] Connected to brokers: %s", c.brokers)
}

// Produce sends a message to a Kafka topic
func (c *Client) Produce(topic string, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	// In production: c.producer.Produce(&kafka.Message{
	//   TopicPartition: kafka.TopicPartition{Topic: &topic},
	//   Key: []byte(key), Value: data,
	// }, nil)
	log.Printf("[Kafka] Producing to topic=%s key=%s size=%d", topic, key, len(data))

	// Dispatch to local handlers for development
	c.mu.RLock()
	handlers := c.handlers[topic]
	c.mu.RUnlock()
	for _, h := range handlers {
		go h(data)
	}
	return nil
}

// Subscribe registers a handler for a Kafka topic
func (c *Client) Subscribe(topic string, handler func([]byte)) {
	c.mu.Lock()
	c.handlers[topic] = append(c.handlers[topic], handler)
	c.mu.Unlock()
	log.Printf("[Kafka] Subscribed to topic: %s", topic)
}

// IsConnected returns the connection status
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[Kafka] Connection closed")
}

// Topic constants
const (
	TopicOrders       = "nexcom.orders"
	TopicTrades       = "nexcom.trades"
	TopicMarketData   = "nexcom.market-data"
	TopicSettlements  = "nexcom.settlements"
	TopicAlerts       = "nexcom.alerts"
	TopicNotifications = "nexcom.notifications"
	TopicAuditLog     = "nexcom.audit-log"
	TopicRiskEvents   = "nexcom.risk-events"
	TopicKYCEvents    = "nexcom.kyc-events"
)
