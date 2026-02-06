package internal

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/IBM/sarama"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	msgProducedTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_messages_produced_total",
		Help: "Total messages produced",
	}, []string{"topic"})
	msgConsumedTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "kafka_messages_consumed_total",
		Help: "Total messages consumed",
	}, []string{"topic"})
	prodErrorsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kafka_produce_errors_total",
		Help: "Total produce errors",
	})
	prodLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "kafka_produce_latency_seconds",
		Help:    "Produce latency distribution",
		Buckets: prometheus.DefBuckets,
	})
	dlqTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "kafka_dlq_messages_total",
		Help: "Total dead letter queue messages",
	})
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
	Connected      bool             `json:"connected"`
	Brokers        []string         `json:"brokers"`
	TopicCount     int              `json:"topic_count"`
	ConsumerGroups int              `json:"consumer_groups"`
	PendingDLQ     int              `json:"pending_dlq"`
	Metrics        map[string]int64 `json:"metrics"`
}

type Metrics struct {
	MessagesProduced int64            `json:"messages_produced"`
	MessagesConsumed int64            `json:"messages_consumed"`
	ProduceErrors    int64            `json:"produce_errors"`
	ConsumeErrors    int64            `json:"consume_errors"`
	DLQMessages      int64            `json:"dlq_messages"`
	TopicMetrics     map[string]int64 `json:"topic_metrics"`
	AvgLatencyMs     float64          `json:"avg_latency_ms"`
}

type KafkaClient struct {
	config        *Config
	producer      sarama.SyncProducer
	client        sarama.Client
	admin         sarama.ClusterAdmin
	connected     bool
	mu            sync.RWMutex
	topics        map[string]bool
	consumers     map[string]ConsumerHandler
	deadLetterQ   []*Message
	messageBuffer []*Message
	metrics       *clientMetrics
	cancelFunc    context.CancelFunc
}

type clientMetrics struct {
	mu            sync.Mutex
	produced      int64
	consumed      int64
	produceErrors int64
	consumeErrors int64
	dlqCount      int64
	topicCounts   map[string]int64
	latencies     []float64
}

var registeredTopics = []string{
	"transactions.created", "transactions.completed", "transactions.failed",
	"payments.initiated", "payments.completed", "payments.failed",
	"accounts.updated", "accounts.suspended",
	"kyc.submitted", "kyc.approved", "kyc.rejected",
	"auth.login", "auth.failed", "audit.action",
	"notifications.send", "budgets.exceeded", "savings.goal_reached",
	"bnpl.payment_due", "bill.reminder", "credit_score.updated",
	"fraud.detected", "fraud.resolved",
	"reconciliation.started", "reconciliation.completed",
}

func NewKafkaClient(cfg *Config) (*KafkaClient, error) {
	ctx, cancel := context.WithCancel(context.Background())
	client := &KafkaClient{
		config:     cfg,
		topics:     make(map[string]bool),
		consumers:  make(map[string]ConsumerHandler),
		metrics:    &clientMetrics{topicCounts: make(map[string]int64)},
		cancelFunc: cancel,
	}
	for _, topic := range registeredTopics {
		client.topics[topic] = true
	}
	if err := client.connect(); err != nil {
		fmt.Printf("[Kafka] Initial connection failed, will retry: %v\n", err)
	}
	go client.reconnectLoop(ctx)
	go client.bufferFlushLoop(ctx)
	return client, nil
}

func (c *KafkaClient) buildSaramaConfig() *sarama.Config {
	cfg := sarama.NewConfig()
	cfg.ClientID = c.config.ClientID
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForAll
	cfg.Producer.Retry.Max = 5
	cfg.Producer.Retry.Backoff = 100 * time.Millisecond
	cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{sarama.NewBalanceStrategyRoundRobin()}
	cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	cfg.Net.MaxOpenRequests = 5
	cfg.Metadata.Retry.Max = 3
	if c.config.SSL {
		cfg.Net.TLS.Enable = true
		cfg.Net.TLS.Config = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	if c.config.SASLMechanism != "" {
		cfg.Net.SASL.Enable = true
		cfg.Net.SASL.User = c.config.SASLUsername
		cfg.Net.SASL.Password = c.config.SASLPassword
		cfg.Net.SASL.Mechanism = sarama.SASLMechanism(c.config.SASLMechanism)
	}
	return cfg
}

func (c *KafkaClient) connect() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	sarCfg := c.buildSaramaConfig()
	saramaClient, err := sarama.NewClient(c.config.Brokers, sarCfg)
	if err != nil {
		c.connected = false
		return fmt.Errorf("sarama client: %w", err)
	}
	c.client = saramaClient
	producer, err := sarama.NewSyncProducerFromClient(saramaClient)
	if err != nil {
		saramaClient.Close()
		c.connected = false
		return fmt.Errorf("sync producer: %w", err)
	}
	c.producer = producer
	admin, err := sarama.NewClusterAdminFromClient(saramaClient)
	if err != nil {
		fmt.Printf("[Kafka] Warning: admin client: %v\n", err)
	} else {
		c.admin = admin
		c.ensureTopicsExist()
	}
	c.connected = true
	fmt.Printf("[Kafka] Connected via sarama to %v (client: %s, group: %s)\n",
		c.config.Brokers, c.config.ClientID, c.config.GroupID)
	return nil
}

func (c *KafkaClient) ensureTopicsExist() {
	if c.admin == nil {
		return
	}
	existing, err := c.admin.ListTopics()
	if err != nil {
		return
	}
	for _, topic := range registeredTopics {
		if _, ok := existing[topic]; !ok {
			_ = c.admin.CreateTopic(topic, &sarama.TopicDetail{
				NumPartitions: 3, ReplicationFactor: 1,
			}, false)
		}
	}
}

func (c *KafkaClient) reconnectLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.mu.RLock()
			conn := c.connected
			c.mu.RUnlock()
			if !conn {
				if err := c.connect(); err != nil {
					fmt.Printf("[Kafka] Reconnect failed: %v\n", err)
				}
			}
		}
	}
}

func (c *KafkaClient) bufferFlushLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.mu.Lock()
			if len(c.messageBuffer) > 0 && c.connected {
				for _, msg := range c.messageBuffer {
					if err := c.produceInternal(msg); err != nil {
						c.deadLetterQ = append(c.deadLetterQ, msg)
						c.metrics.mu.Lock()
						c.metrics.dlqCount++
						c.metrics.mu.Unlock()
						dlqTotal.Inc()
					}
				}
				c.messageBuffer = nil
			}
			c.mu.Unlock()
		}
	}
}

func (c *KafkaClient) Produce(topic, key string, value json.RawMessage, headers map[string]string) error {
	start := time.Now()
	msg := &Message{Topic: topic, Key: key, Value: value, Headers: headers, Timestamp: time.Now()}
	if msg.Headers == nil {
		msg.Headers = make(map[string]string)
	}
	msg.Headers["x-source"] = c.config.ClientID
	msg.Headers["x-timestamp"] = fmt.Sprintf("%d", time.Now().UnixMilli())
	msg.Headers["x-correlation-id"] = generateCorrelationID()
	c.mu.RLock()
	conn := c.connected
	c.mu.RUnlock()
	if !conn {
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
		prodErrorsTotal.Inc()
		return err
	}
	lat := time.Since(start).Seconds()
	prodLatency.Observe(lat)
	latMs := lat * 1000
	c.metrics.mu.Lock()
	c.metrics.produced++
	c.metrics.topicCounts[topic]++
	c.metrics.latencies = append(c.metrics.latencies, latMs)
	if len(c.metrics.latencies) > 10000 {
		c.metrics.latencies = c.metrics.latencies[5000:]
	}
	c.metrics.mu.Unlock()
	msgProducedTotal.WithLabelValues(topic).Inc()
	return nil
}

func (c *KafkaClient) produceInternal(msg *Message) error {
	if !c.topics[msg.Topic] {
		return fmt.Errorf("unknown topic: %s", msg.Topic)
	}
	c.mu.RLock()
	producer := c.producer
	c.mu.RUnlock()
	if producer == nil {
		return fmt.Errorf("producer not connected")
	}
	hdrs := make([]sarama.RecordHeader, 0, len(msg.Headers))
	for k, v := range msg.Headers {
		hdrs = append(hdrs, sarama.RecordHeader{Key: []byte(k), Value: []byte(v)})
	}
	partition, offset, err := producer.SendMessage(&sarama.ProducerMessage{
		Topic: msg.Topic, Key: sarama.StringEncoder(msg.Key),
		Value: sarama.ByteEncoder(msg.Value), Headers: hdrs,
	})
	if err != nil {
		return fmt.Errorf("send: %w", err)
	}
	msg.Partition = partition
	msg.Offset = offset
	return nil
}

func (c *KafkaClient) Subscribe(topic string, handler ConsumerHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.consumers[topic] = handler
}

func (c *KafkaClient) RegisterDefaultConsumers() {
	dh := map[string]string{
		"transactions.completed": "completed transaction",
		"payments.failed":       "failed payment",
		"auth.failed":           "auth failure",
		"kyc.submitted":         "KYC submission",
		"budgets.exceeded":      "budget exceeded",
		"fraud.detected":        "fraud detection",
	}
	for topic, desc := range dh {
		t, d := topic, desc
		c.Subscribe(t, func(msg *Message) error {
			fmt.Printf("[Kafka] Processing %s: %s\n", d, msg.Key)
			msgConsumedTotal.WithLabelValues(t).Inc()
			return nil
		})
	}
	c.startConsumerGroups()
}

func (c *KafkaClient) startConsumerGroups() {
	c.mu.RLock()
	cl := c.client
	c.mu.RUnlock()
	if cl == nil {
		return
	}
	topics := make([]string, 0)
	c.mu.RLock()
	for t := range c.consumers {
		topics = append(topics, t)
	}
	c.mu.RUnlock()
	go func() {
		cfg := c.buildSaramaConfig()
		group, err := sarama.NewConsumerGroup(c.config.Brokers, c.config.GroupID, cfg)
		if err != nil {
			fmt.Printf("[Kafka] Consumer group error: %v\n", err)
			return
		}
		handler := &consumerGroupHandler{client: c}
		for {
			if err := group.Consume(context.Background(), topics, handler); err != nil {
				time.Sleep(5 * time.Second)
			}
		}
	}()
}

type consumerGroupHandler struct{ client *KafkaClient }

func (h *consumerGroupHandler) Setup(_ sarama.ConsumerGroupSession) error   { return nil }
func (h *consumerGroupHandler) Cleanup(_ sarama.ConsumerGroupSession) error { return nil }
func (h *consumerGroupHandler) ConsumeClaim(sess sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for sm := range claim.Messages() {
		msg := &Message{
			Topic: sm.Topic, Key: string(sm.Key), Value: sm.Value,
			Partition: sm.Partition, Offset: sm.Offset, Timestamp: sm.Timestamp,
			Headers: make(map[string]string),
		}
		for _, hdr := range sm.Headers {
			msg.Headers[string(hdr.Key)] = string(hdr.Value)
		}
		h.client.mu.RLock()
		handler, ok := h.client.consumers[sm.Topic]
		h.client.mu.RUnlock()
		if ok {
			if err := handler(msg); err != nil {
				h.client.mu.Lock()
				h.client.deadLetterQ = append(h.client.deadLetterQ, msg)
				h.client.mu.Unlock()
				dlqTotal.Inc()
			}
		}
		sess.MarkMessage(sm, "")
		h.client.metrics.mu.Lock()
		h.client.metrics.consumed++
		h.client.metrics.mu.Unlock()
	}
	return nil
}

func (c *KafkaClient) ListTopics() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.client != nil {
		if topics, err := c.client.Topics(); err == nil {
			return topics
		}
	}
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
	var avg float64
	if len(c.metrics.latencies) > 0 {
		var sum float64
		for _, l := range c.metrics.latencies {
			sum += l
		}
		avg = sum / float64(len(c.metrics.latencies))
	}
	tc := make(map[string]int64)
	for k, v := range c.metrics.topicCounts {
		tc[k] = v
	}
	return &Metrics{
		MessagesProduced: c.metrics.produced, MessagesConsumed: c.metrics.consumed,
		ProduceErrors: c.metrics.produceErrors, ConsumeErrors: c.metrics.consumeErrors,
		DLQMessages: c.metrics.dlqCount, TopicMetrics: tc, AvgLatencyMs: avg,
	}
}

func (c *KafkaClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	brokers := c.config.Brokers
	if c.client != nil {
		sb := c.client.Brokers()
		brokers = make([]string, len(sb))
		for i, b := range sb {
			brokers[i] = b.Addr()
		}
	}
	return &HealthStatus{
		Connected: c.connected, Brokers: brokers,
		TopicCount: len(c.topics), ConsumerGroups: len(c.consumers),
		PendingDLQ: len(c.deadLetterQ),
	}
}

func (c *KafkaClient) Close() {
	c.cancelFunc()
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.producer != nil {
		c.producer.Close()
	}
	if c.admin != nil {
		c.admin.Close()
	}
	if c.client != nil {
		c.client.Close()
	}
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
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}
