package fluvio

import (
	"encoding/json"
	"log"
	"sync"
)

// Client wraps Fluvio real-time streaming operations.
// In production: uses Fluvio Go client for high-throughput, low-latency streaming.
// Topics (Fluvio topics, separate from Kafka):
//   market-ticks       - Raw tick data from exchanges (sub-millisecond latency)
//   price-aggregates   - Aggregated OHLCV candles
//   trade-signals      - AI/ML generated trading signals
//   risk-alerts        - Real-time risk threshold breaches
type Client struct {
	endpoint  string
	connected bool
	mu        sync.RWMutex
	consumers map[string][]func([]byte)
}

func NewClient(endpoint string) *Client {
	c := &Client{
		endpoint:  endpoint,
		consumers: make(map[string][]func([]byte)),
	}
	c.connect()
	return c
}

func (c *Client) connect() {
	log.Printf("[Fluvio] Connecting to endpoint: %s", c.endpoint)
	c.mu.Lock()
	c.connected = true
	c.mu.Unlock()
	log.Printf("[Fluvio] Connected to endpoint: %s", c.endpoint)
}

// Produce sends a record to a Fluvio topic
func (c *Client) Produce(topic string, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	log.Printf("[Fluvio] Producing to topic=%s key=%s size=%d", topic, key, len(data))

	c.mu.RLock()
	consumers := c.consumers[topic]
	c.mu.RUnlock()
	for _, fn := range consumers {
		go fn(data)
	}
	return nil
}

// Consume registers a consumer for a Fluvio topic
func (c *Client) Consume(topic string, handler func([]byte)) {
	c.mu.Lock()
	c.consumers[topic] = append(c.consumers[topic], handler)
	c.mu.Unlock()
	log.Printf("[Fluvio] Consumer registered for topic: %s", topic)
}

// CreateTopic creates a new Fluvio topic with partitions and replication
func (c *Client) CreateTopic(name string, partitions int, replication int) error {
	log.Printf("[Fluvio] Creating topic=%s partitions=%d replication=%d", name, partitions, replication)
	return nil
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	log.Println("[Fluvio] Connection closed")
}

// Fluvio topic constants
const (
	TopicMarketTicks     = "market-ticks"
	TopicPriceAggregates = "price-aggregates"
	TopicTradeSignals    = "trade-signals"
	TopicRiskAlerts      = "risk-alerts"
)
