package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/sony/gobreaker/v2"
)

// Client wraps Kafka producer/consumer with real segmentio/kafka-go SDK.
// Uses kafka.Writer for producing and kafka.Reader for consuming.
// Gracefully falls back to in-memory dispatch when Kafka is unavailable.
type Client struct {
	brokers      string
	connected    bool
	fallbackMode bool
	mu           sync.RWMutex
	handlers     map[string][]func([]byte)

	// Real Kafka writer (producer)
	writer *kafka.Writer
	// Real Kafka readers (consumers) keyed by topic
	readers map[string]*kafka.Reader
	// Circuit breaker for produce calls
	cb *gobreaker.CircuitBreaker[[]byte]
	// Background reconnection
	ctx    context.Context
	cancel context.CancelFunc

	// Metrics
	messagesProduced int64
	messagesFailed   int64
	messagesConsumed int64
}

func NewClient(brokers string) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	c := &Client{
		brokers:  brokers,
		handlers: make(map[string][]func([]byte)),
		readers:  make(map[string]*kafka.Reader),
		ctx:      ctx,
		cancel:   cancel,
	}

	// Circuit breaker: open after 5 failures, half-open after 10s
	c.cb = gobreaker.NewCircuitBreaker[[]byte](gobreaker.Settings{
		Name:        "kafka-producer",
		MaxRequests: 3,
		Interval:    30 * time.Second,
		Timeout:     10 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[Kafka] Circuit breaker %s: %s -> %s", name, from, to)
		},
	})

	c.connect()
	go c.reconnectLoop()
	return c
}

func (c *Client) connect() {
	log.Printf("[Kafka] Connecting to brokers: %s", c.brokers)

	c.writer = &kafka.Writer{
		Addr:         kafka.TCP(c.brokers),
		Balancer:     &kafka.LeastBytes{},
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
		WriteTimeout: 5 * time.Second,
		ReadTimeout:  5 * time.Second,
		RequiredAcks: kafka.RequireOne,
		Async:        false,
	}

	conn, err := kafka.DialContext(c.ctx, "tcp", c.brokers)
	if err != nil {
		log.Printf("[Kafka] WARN: Cannot reach %s: %v — running in fallback mode (in-memory dispatch)", c.brokers, err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	_, err = conn.Brokers()
	conn.Close()
	if err != nil {
		log.Printf("[Kafka] WARN: Broker metadata fetch failed: %v — running in fallback mode", err)
		c.mu.Lock()
		c.fallbackMode = true
		c.connected = false
		c.mu.Unlock()
		return
	}

	c.mu.Lock()
	c.connected = true
	c.fallbackMode = false
	c.mu.Unlock()
	log.Printf("[Kafka] Connected to brokers: %s (metadata verified)", c.brokers)
}

func (c *Client) reconnectLoop() {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			isFallback := c.fallbackMode
			c.mu.RUnlock()
			if isFallback {
				log.Printf("[Kafka] Attempting reconnection to %s...", c.brokers)
				c.connect()
			}
		}
	}
}

// Produce sends a message to a Kafka topic via the real kafka.Writer.
func (c *Client) Produce(topic string, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	c.mu.RLock()
	isFallback := c.fallbackMode
	c.mu.RUnlock()

	if !isFallback {
		_, cbErr := c.cb.Execute(func() ([]byte, error) {
			msg := kafka.Message{
				Topic: topic,
				Key:   []byte(key),
				Value: data,
				Time:  time.Now(),
			}
			writeErr := c.writer.WriteMessages(c.ctx, msg)
			if writeErr != nil {
				c.mu.Lock()
				c.messagesFailed++
				c.mu.Unlock()
				return nil, writeErr
			}
			c.mu.Lock()
			c.messagesProduced++
			c.mu.Unlock()
			log.Printf("[Kafka] Produced to topic=%s key=%s size=%d bytes (real)", topic, key, len(data))
			return nil, nil
		})
		if cbErr == nil {
			c.dispatchLocal(topic, data)
			return nil
		}
		log.Printf("[Kafka] WARN: Produce failed (circuit breaker: %s): %v", c.cb.State(), cbErr)
	}

	c.dispatchLocal(topic, data)
	return nil
}

func (c *Client) ProduceAsync(topic string, key string, value interface{}) {
	go func() {
		if err := c.Produce(topic, key, value); err != nil {
			log.Printf("[Kafka] Async produce error: topic=%s err=%v", topic, err)
		}
	}()
}

// Subscribe registers a handler and starts a real kafka.Reader consumer group when connected.
func (c *Client) Subscribe(topic string, handler func([]byte)) {
	c.mu.Lock()
	c.handlers[topic] = append(c.handlers[topic], handler)
	c.mu.Unlock()
	log.Printf("[Kafka] Subscribed to topic: %s", topic)

	c.mu.RLock()
	isFallback := c.fallbackMode
	_, hasReader := c.readers[topic]
	c.mu.RUnlock()

	if !isFallback && !hasReader {
		reader := kafka.NewReader(kafka.ReaderConfig{
			Brokers:        []string{c.brokers},
			Topic:          topic,
			GroupID:        "nexcom-gateway-" + topic,
			MinBytes:       1,
			MaxBytes:       10e6,
			MaxWait:        500 * time.Millisecond,
			CommitInterval: time.Second,
			StartOffset:    kafka.LastOffset,
		})
		c.mu.Lock()
		c.readers[topic] = reader
		c.mu.Unlock()
		go c.consumeLoop(topic, reader)
	}
}

func (c *Client) consumeLoop(topic string, reader *kafka.Reader) {
	log.Printf("[Kafka] Starting consumer loop for topic: %s", topic)
	for {
		select {
		case <-c.ctx.Done():
			reader.Close()
			return
		default:
			msg, err := reader.ReadMessage(c.ctx)
			if err != nil {
				if c.ctx.Err() != nil {
					return
				}
				log.Printf("[Kafka] Read error on topic=%s: %v", topic, err)
				time.Sleep(time.Second)
				continue
			}
			c.mu.Lock()
			c.messagesConsumed++
			c.mu.Unlock()
			c.dispatchLocal(topic, msg.Value)
		}
	}
}

func (c *Client) dispatchLocal(topic string, data []byte) {
	c.mu.RLock()
	handlers := c.handlers[topic]
	c.mu.RUnlock()
	for _, h := range handlers {
		go h(data)
	}
}

func (c *Client) Reconnect() {
	c.mu.RLock()
	if c.connected && !c.fallbackMode {
		c.mu.RUnlock()
		return
	}
	c.mu.RUnlock()
	c.connect()
}

func (c *Client) GetMetrics() (produced, consumed, failed int64) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.messagesProduced, c.messagesConsumed, c.messagesFailed
}

func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected
}

func (c *Client) IsFallback() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.fallbackMode
}

func (c *Client) Close() {
	c.cancel()
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.writer != nil {
		c.writer.Close()
	}
	for _, reader := range c.readers {
		reader.Close()
	}
	c.connected = false
	log.Println("[Kafka] Connection closed")
}

const (
	TopicOrders        = "nexcom.orders"
	TopicTrades        = "nexcom.trades"
	TopicMarketData    = "nexcom.market-data"
	TopicSettlements   = "nexcom.settlements"
	TopicAlerts        = "nexcom.alerts"
	TopicNotifications = "nexcom.notifications"
	TopicAuditLog      = "nexcom.audit-log"
	TopicRiskEvents    = "nexcom.risk-events"
	TopicKYCEvents     = "nexcom.kyc-events"
)
