package internal

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type Topic struct {
	Name       string `json:"name"`
	Partitions int    `json:"partitions"`
	Replicas   int    `json:"replicas"`
	CreatedAt  int64  `json:"created_at"`
}

type Record struct {
	Topic     string          `json:"topic"`
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	Offset    int64           `json:"offset"`
	Timestamp int64           `json:"timestamp"`
	Partition int             `json:"partition"`
}

type SmartModule struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Desc    string `json:"description"`
}

type CreateTopicRequest struct {
	Name       string `json:"name"`
	Partitions int    `json:"partitions"`
	Replicas   int    `json:"replicas"`
}

type ProduceRequest struct {
	Topic string          `json:"topic"`
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

type StreamMetrics struct {
	TotalTopics    int              `json:"total_topics"`
	TotalRecords   int64            `json:"total_records"`
	RecordsByTopic map[string]int64 `json:"records_by_topic"`
	BytesIn        int64            `json:"bytes_in"`
	BytesOut       int64            `json:"bytes_out"`
	SmartModules   int              `json:"smart_modules"`
}

type HealthStatus struct {
	Connected bool   `json:"connected"`
	Endpoint  string `json:"endpoint"`
	Topics    int    `json:"topics"`
	Records   int64  `json:"total_records"`
}

type FluvioClient struct {
	config       *Config
	connected    bool
	mu           sync.RWMutex
	topics       map[string]*Topic
	records      map[string][]*Record
	offsets      map[string]int64
	smartModules []*SmartModule
	bytesIn      int64
	bytesOut     int64
}

func NewFluvioClient(cfg *Config) (*FluvioClient, error) {
	client := &FluvioClient{
		config:  cfg,
		connected: true,
		topics:  make(map[string]*Topic),
		records: make(map[string][]*Record),
		offsets: make(map[string]int64),
	}

	client.registerDefaultTopics()
	client.registerSmartModules()

	fmt.Printf("[Fluvio] Connected to %s (profile: %s)\n", cfg.Endpoint, cfg.Profile)
	return client, nil
}

func (c *FluvioClient) registerDefaultTopics() {
	defaults := []CreateTopicRequest{
		{Name: "transaction-stream", Partitions: 6, Replicas: 3},
		{Name: "payment-events", Partitions: 4, Replicas: 3},
		{Name: "account-changes", Partitions: 3, Replicas: 3},
		{Name: "fraud-signals", Partitions: 2, Replicas: 3},
		{Name: "audit-trail", Partitions: 4, Replicas: 3},
		{Name: "notification-stream", Partitions: 2, Replicas: 2},
		{Name: "kyc-events", Partitions: 2, Replicas: 3},
		{Name: "realtime-balances", Partitions: 6, Replicas: 3},
		{Name: "market-data", Partitions: 4, Replicas: 2},
		{Name: "user-activity", Partitions: 3, Replicas: 2},
	}

	for _, req := range defaults {
		c.CreateTopic(req.Name, req.Partitions, req.Replicas)
	}
}

func (c *FluvioClient) registerSmartModules() {
	c.smartModules = []*SmartModule{
		{Name: "fraud-filter", Type: "filter", Desc: "Filters transactions flagged as potentially fraudulent"},
		{Name: "pii-redactor", Type: "map", Desc: "Redacts PII fields from audit streams"},
		{Name: "balance-aggregator", Type: "aggregate", Desc: "Aggregates balance changes in real-time"},
		{Name: "transaction-enricher", Type: "map", Desc: "Enriches transactions with merchant/category data"},
		{Name: "dedup-filter", Type: "filter", Desc: "Deduplicates events by correlation ID"},
		{Name: "currency-converter", Type: "map", Desc: "Converts amounts to base currency"},
		{Name: "compliance-filter", Type: "filter", Desc: "Filters events requiring compliance review"},
		{Name: "json-to-avro", Type: "map", Desc: "Converts JSON records to Avro format for lakehouse"},
	}
}

func (c *FluvioClient) CreateTopic(name string, partitions, replicas int) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.topics[name]; exists {
		return fmt.Errorf("topic %s already exists", name)
	}

	c.topics[name] = &Topic{
		Name:       name,
		Partitions: partitions,
		Replicas:   replicas,
		CreatedAt:  time.Now().Unix(),
	}
	c.records[name] = make([]*Record, 0)
	c.offsets[name] = 0
	return nil
}

func (c *FluvioClient) Produce(topic, key string, value json.RawMessage) (int64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, exists := c.topics[topic]; !exists {
		return 0, fmt.Errorf("topic %s not found", topic)
	}

	offset := c.offsets[topic]
	c.offsets[topic]++

	record := &Record{
		Topic:     topic,
		Key:       key,
		Value:     value,
		Offset:    offset,
		Timestamp: time.Now().UnixMilli(),
		Partition: int(offset) % c.topics[topic].Partitions,
	}

	c.records[topic] = append(c.records[topic], record)
	c.bytesIn += int64(len(value))

	if len(c.records[topic]) > 100000 {
		c.records[topic] = c.records[topic][50000:]
	}

	return offset, nil
}

func (c *FluvioClient) Consume(topic string, limit int) []*Record {
	c.mu.RLock()
	defer c.mu.RUnlock()

	records, exists := c.records[topic]
	if !exists {
		return nil
	}

	start := 0
	if len(records) > limit {
		start = len(records) - limit
	}

	result := make([]*Record, len(records[start:]))
	copy(result, records[start:])

	for _, r := range result {
		c.bytesOut += int64(len(r.Value))
	}

	return result
}

func (c *FluvioClient) ListTopics() []*Topic {
	c.mu.RLock()
	defer c.mu.RUnlock()
	topics := make([]*Topic, 0, len(c.topics))
	for _, t := range c.topics {
		topics = append(topics, t)
	}
	return topics
}

func (c *FluvioClient) ListSmartModules() []*SmartModule {
	return c.smartModules
}

func (c *FluvioClient) GetMetrics() *StreamMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var totalRecords int64
	byTopic := make(map[string]int64)
	for name, records := range c.records {
		byTopic[name] = int64(len(records))
		totalRecords += int64(len(records))
	}

	return &StreamMetrics{
		TotalTopics:    len(c.topics),
		TotalRecords:   totalRecords,
		RecordsByTopic: byTopic,
		BytesIn:        c.bytesIn,
		BytesOut:       c.bytesOut,
		SmartModules:   len(c.smartModules),
	}
}

func (c *FluvioClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var totalRecords int64
	for _, records := range c.records {
		totalRecords += int64(len(records))
	}
	return &HealthStatus{
		Connected: c.connected,
		Endpoint:  c.config.Endpoint,
		Topics:    len(c.topics),
		Records:   totalRecords,
	}
}

func (c *FluvioClient) Close() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	fmt.Println("[Fluvio] Client closed")
}
