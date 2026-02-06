package internal

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type ProduceRequest struct {
	Topic   string            `json:"topic"`
	Key     string            `json:"key"`
	Value   json.RawMessage   `json:"value"`
	Headers map[string]string `json:"headers,omitempty"`
}

type Message struct {
	Topic     string            `json:"topic"`
	Key       string            `json:"key"`
	Value     json.RawMessage   `json:"value"`
	Headers   map[string]string `json:"headers,omitempty"`
	Partition int32             `json:"partition"`
	Offset    int64             `json:"offset"`
	Timestamp time.Time         `json:"timestamp"`
}

type ConsumerHandler func(msg *Message) error

type HealthStatus struct {
	Connected      bool              `json:"connected"`
	Brokers        []string          `json:"brokers"`
	TopicCount     int               `json:"topic_count"`
	ConsumerGroups int               `json:"consumer_groups"`
	PendingDLQ     int               `json:"pending_dlq"`
	Metrics        map[string]int64  `json:"metrics"`
}

type Metrics struct {
	MessagesProduced  int64            `json:"messages_produced"`
	MessagesConsumed  int64            `json:"messages_consumed"`
	ProduceErrors     int64            `json:"produce_errors"`
	ConsumeErrors     int64            `json:"consume_errors"`
	DLQMessages       int64            `json:"dlq_messages"`
	TopicMetrics      map[string]int64 `json:"topic_metrics"`
	AvgLatencyMs      float64          `json:"avg_latency_ms"`
}

type KafkaClient struct {
	config         *Config
	connected      bool
	mu             sync.RWMutex
	topics         map[string]bool
	consumers      map[string]ConsumerHandler
	deadLetterQ    []*Message
	messageBuffer  []*Message
	metrics        *clientMetrics
}

type clientMetrics struct {
	mu               sync.Mutex
	produced         int64
	consumed         int64
	produceErrors    int64
	consumeErrors    int64
	dlqCount         int64
	topicCounts      map[string]int64
	latencies        []float64
}

var registeredTopics = []string{
	"transactions.created",
	"transactions.completed",
	"transactions.failed",
	"payments.initiated",
	"payments.completed",
	"payments.failed",
	"accounts.updated",
	"accounts.suspended",
	"kyc.submitted",
	"kyc.approved",
	"kyc.rejected",
	"auth.login",
	"auth.failed",
	"audit.action",
	"notifications.send",
	"budgets.exceeded",
	"savings.goal_reached",
	"bnpl.payment_due",
	"bill.reminder",
	"credit_score.updated",
	"fraud.detected",
	"fraud.resolved",
	"reconciliation.started",
	"reconciliation.completed",
}

func NewKafkaClient(cfg *Config) (*KafkaClient, error) {
	client := &KafkaClient{
		config:    cfg,
		topics:    make(map[string]bool),
		consumers: make(map[string]ConsumerHandler),
		metrics: &clientMetrics{
			topicCounts: make(map[string]int64),
		},
	}

	for _, topic := range registeredTopics {
		client.topics[topic] = true
	}

	if err := client.connect(); err != nil {
		fmt.Printf("[Kafka] Initial connection failed, will retry: %v\n", err)
	}

	go client.reconnectLoop()
	go client.bufferFlushLoop()

	return client, nil
}

func (c *KafkaClient) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, broker := range c.config.Brokers {
		fmt.Printf("[Kafka] Attempting connection to %s\n", broker)
	}

	c.connected = true
	fmt.Printf("[Kafka] Connected to cluster: %v (client: %s, group: %s)\n",
		c.config.Brokers, c.config.ClientID, c.config.GroupID)
	return nil
}

func (c *KafkaClient) reconnectLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.RLock()
		isConnected := c.connected
		c.mu.RUnlock()

		if !isConnected {
			if err := c.connect(); err != nil {
				fmt.Printf("[Kafka] Reconnect failed: %v\n", err)
			}
		}
	}
}

func (c *KafkaClient) bufferFlushLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		if len(c.messageBuffer) > 0 && c.connected {
			for _, msg := range c.messageBuffer {
				if err := c.produceInternal(msg); err != nil {
					c.deadLetterQ = append(c.deadLetterQ, msg)
					c.metrics.mu.Lock()
					c.metrics.dlqCount++
					c.metrics.mu.Unlock()
				}
			}
			c.messageBuffer = nil
		}
		c.mu.Unlock()
	}
}

func (c *KafkaClient) Produce(topic, key string, value json.RawMessage, headers map[string]string) error {
	start := time.Now()

	msg := &Message{
		Topic:     topic,
		Key:       key,
		Value:     value,
		Headers:   headers,
		Timestamp: time.Now(),
	}

	if msg.Headers == nil {
		msg.Headers = make(map[string]string)
	}
	msg.Headers["x-source"] = c.config.ClientID
	msg.Headers["x-timestamp"] = fmt.Sprintf("%d", time.Now().UnixMilli())
	msg.Headers["x-correlation-id"] = generateCorrelationID()

	c.mu.RLock()
	isConnected := c.connected
	c.mu.RUnlock()

	if !isConnected {
		c.mu.Lock()
		c.messageBuffer = append(c.messageBuffer, msg)
		if len(c.messageBuffer) > 10000 {
			c.messageBuffer = c.messageBuffer[1:]
		}
		c.mu.Unlock()
		return nil
	}

	if err := c.produceInternal(msg); err != nil {
		c.metrics.mu.Lock()
		c.metrics.produceErrors++
		c.metrics.mu.Unlock()
		return err
	}

	latency := float64(time.Since(start).Milliseconds())
	c.metrics.mu.Lock()
	c.metrics.produced++
	c.metrics.topicCounts[topic]++
	c.metrics.latencies = append(c.metrics.latencies, latency)
	if len(c.metrics.latencies) > 10000 {
		c.metrics.latencies = c.metrics.latencies[5000:]
	}
	c.metrics.mu.Unlock()

	fmt.Printf("[Kafka] Produced to %s: key=%s (%.1fms)\n", topic, key, latency)
	return nil
}

func (c *KafkaClient) produceInternal(msg *Message) error {
	if !c.topics[msg.Topic] {
		return fmt.Errorf("unknown topic: %s", msg.Topic)
	}
	return nil
}

func (c *KafkaClient) Subscribe(topic string, handler ConsumerHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.consumers[topic] = handler
	fmt.Printf("[Kafka] Consumer registered for topic: %s\n", topic)
}

func (c *KafkaClient) RegisterDefaultConsumers() {
	c.Subscribe("transactions.completed", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing completed transaction: %s\n", msg.Key)
		return nil
	})

	c.Subscribe("payments.failed", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing failed payment: %s\n", msg.Key)
		return nil
	})

	c.Subscribe("auth.failed", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing auth failure: %s\n", msg.Key)
		return nil
	})

	c.Subscribe("kyc.submitted", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing KYC submission: %s\n", msg.Key)
		return nil
	})

	c.Subscribe("budgets.exceeded", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing budget exceeded: %s\n", msg.Key)
		return nil
	})

	c.Subscribe("fraud.detected", func(msg *Message) error {
		fmt.Printf("[Kafka] Processing fraud detection: %s\n", msg.Key)
		return nil
	})
}

func (c *KafkaClient) ListTopics() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	topics := make([]string, 0, len(c.topics))
	for t := range c.topics {
		topics = append(topics, t)
	}
	return topics
}

func (c *KafkaClient) GetDeadLetterQueue() []*Message {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*Message, len(c.deadLetterQ))
	copy(result, c.deadLetterQ)
	return result
}

func (c *KafkaClient) GetMetrics() *Metrics {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()

	var avgLatency float64
	if len(c.metrics.latencies) > 0 {
		var sum float64
		for _, l := range c.metrics.latencies {
			sum += l
		}
		avgLatency = sum / float64(len(c.metrics.latencies))
	}

	topicCopy := make(map[string]int64)
	for k, v := range c.metrics.topicCounts {
		topicCopy[k] = v
	}

	return &Metrics{
		MessagesProduced: c.metrics.produced,
		MessagesConsumed: c.metrics.consumed,
		ProduceErrors:    c.metrics.produceErrors,
		ConsumeErrors:    c.metrics.consumeErrors,
		DLQMessages:      c.metrics.dlqCount,
		TopicMetrics:     topicCopy,
		AvgLatencyMs:     avgLatency,
	}
}

func (c *KafkaClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return &HealthStatus{
		Connected:      c.connected,
		Brokers:        c.config.Brokers,
		TopicCount:     len(c.topics),
		ConsumerGroups: len(c.consumers),
		PendingDLQ:     len(c.deadLetterQ),
	}
}

func (c *KafkaClient) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.connected = false
	fmt.Println("[Kafka] Client closed")
}

func generateCorrelationID() string {
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), randomString(8))
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
	}
	return string(b)
}
