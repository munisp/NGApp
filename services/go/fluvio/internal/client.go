package internal

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var (
	fluvioRecordsProduced = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "fluvio_records_produced_total",
		Help: "Total records produced",
	}, []string{"topic"})
	fluvioRecordsConsumed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "fluvio_records_consumed_total",
		Help: "Total records consumed",
	}, []string{"topic"})
	fluvioLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "fluvio_operation_latency_seconds",
		Help:    "Fluvio operation latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"operation"})
)

type Topic struct {
	Name       string `json:"name"`
	Partitions int    `json:"partitions"`
	Replicas   int    `json:"replicas"`
	Retention  string `json:"retention"`
	CreatedAt  int64  `json:"created_at"`
}

type Record struct {
	Topic     string          `json:"topic"`
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	Offset    int64           `json:"offset"`
	Timestamp int64           `json:"timestamp"`
	Partition int32           `json:"partition"`
}

type SmartModule struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Version string `json:"version"`
	Status  string `json:"status"`
}

type ProduceRequest struct {
	Topic string          `json:"topic"`
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

type ConsumeRequest struct {
	Topic    string `json:"topic"`
	Offset   int64  `json:"offset"`
	MaxCount int    `json:"max_count"`
}

type StreamMetrics struct {
	TotalRecords    int64            `json:"total_records"`
	TotalTopics     int              `json:"total_topics"`
	RecordsByTopic  map[string]int64 `json:"records_by_topic"`
	SmartModules    int              `json:"smart_modules"`
	AvgThroughput   float64          `json:"avg_throughput_rps"`
}

type HealthStatus struct {
	Connected    bool   `json:"connected"`
	Endpoint     string `json:"endpoint"`
	TopicCount   int    `json:"topic_count"`
	SmartModules int    `json:"smart_modules"`
}

type FluvioClient struct {
	config       *Config
	grpcConn     *grpc.ClientConn
	connected    bool
	mu           sync.RWMutex
	topics       map[string]*Topic
	records      map[string][]*Record
	smartModules []*SmartModule
	offsets      map[string]int64
	metrics      *streamMetrics
}

type streamMetrics struct {
	mu           sync.Mutex
	totalRecords int64
	byTopic      map[string]int64
	produceTimes []float64
}

var defaultTopics = []string{
	"cdc.accounts", "cdc.transactions", "cdc.payments",
	"events.user-activity", "events.notifications",
	"analytics.real-time", "analytics.aggregated",
	"ml.predictions", "ml.features",
	"audit.trail",
}

func NewFluvioClient(cfg *Config) (*FluvioClient, error) {
	client := &FluvioClient{
		config:  cfg,
		topics:  make(map[string]*Topic),
		records: make(map[string][]*Record),
		offsets: make(map[string]int64),
		metrics: &streamMetrics{byTopic: make(map[string]int64)},
	}

	conn, err := grpc.Dial(cfg.Endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		fmt.Printf("[Fluvio] gRPC connection failed (will retry): %v\n", err)
		client.connected = false
	} else {
		client.grpcConn = conn
		client.connected = true
		fmt.Printf("[Fluvio] Connected via gRPC to %s\n", cfg.Endpoint)
	}

	for _, name := range defaultTopics {
		client.topics[name] = &Topic{
			Name: name, Partitions: 3, Replicas: 1,
			Retention: "7d", CreatedAt: time.Now().Unix(),
		}
		client.records[name] = make([]*Record, 0)
		client.offsets[name] = 0
	}

	client.smartModules = []*SmartModule{
		{Name: "json-filter", Type: "filter", Version: "0.1.0", Status: "active"},
		{Name: "dedup", Type: "filter", Version: "0.1.0", Status: "active"},
		{Name: "json-to-avro", Type: "map", Version: "0.1.0", Status: "active"},
		{Name: "aggregate-sum", Type: "aggregate", Version: "0.1.0", Status: "active"},
		{Name: "fraud-score-filter", Type: "filter", Version: "0.2.0", Status: "active"},
	}

	go client.healthCheckLoop()
	return client, nil
}

func (c *FluvioClient) healthCheckLoop() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if c.grpcConn != nil {
			state := c.grpcConn.GetState()
			c.mu.Lock()
			c.connected = state.String() == "READY" || state.String() == "IDLE"
			c.mu.Unlock()
		}
	}
}

func (c *FluvioClient) CreateTopic(name string, partitions, replicas int) (*Topic, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.topics[name]; exists {
		return nil, fmt.Errorf("topic %s already exists", name)
	}
	topic := &Topic{
		Name: name, Partitions: partitions, Replicas: replicas,
		Retention: "7d", CreatedAt: time.Now().Unix(),
	}
	c.topics[name] = topic
	c.records[name] = make([]*Record, 0)
	c.offsets[name] = 0
	return topic, nil
}

func (c *FluvioClient) DeleteTopic(name string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.topics[name]; !exists {
		return fmt.Errorf("topic %s not found", name)
	}
	delete(c.topics, name)
	delete(c.records, name)
	delete(c.offsets, name)
	return nil
}

func (c *FluvioClient) ListTopics() []*Topic {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*Topic, 0, len(c.topics))
	for _, t := range c.topics {
		result = append(result, t)
	}
	return result
}

func (c *FluvioClient) Produce(topic, key string, value json.RawMessage) (*Record, error) {
	start := time.Now()
	defer func() { fluvioLatency.WithLabelValues("produce").Observe(time.Since(start).Seconds()) }()

	c.mu.Lock()
	defer c.mu.Unlock()
	if _, exists := c.topics[topic]; !exists {
		return nil, fmt.Errorf("topic %s not found", topic)
	}

	offset := c.offsets[topic]
	c.offsets[topic]++

	record := &Record{
		Topic: topic, Key: key, Value: value,
		Offset: offset, Timestamp: time.Now().UnixMilli(),
		Partition: int32(offset % 3),
	}
	c.records[topic] = append(c.records[topic], record)

	c.metrics.mu.Lock()
	c.metrics.totalRecords++
	c.metrics.byTopic[topic]++
	c.metrics.produceTimes = append(c.metrics.produceTimes, time.Since(start).Seconds())
	if len(c.metrics.produceTimes) > 10000 {
		c.metrics.produceTimes = c.metrics.produceTimes[5000:]
	}
	c.metrics.mu.Unlock()

	fluvioRecordsProduced.WithLabelValues(topic).Inc()
	return record, nil
}

func (c *FluvioClient) Consume(topic string, offset int64, maxCount int) ([]*Record, error) {
	start := time.Now()
	defer func() { fluvioLatency.WithLabelValues("consume").Observe(time.Since(start).Seconds()) }()

	c.mu.RLock()
	defer c.mu.RUnlock()
	recs, exists := c.records[topic]
	if !exists {
		return nil, fmt.Errorf("topic %s not found", topic)
	}

	var result []*Record
	for _, r := range recs {
		if r.Offset >= offset {
			result = append(result, r)
			fluvioRecordsConsumed.WithLabelValues(topic).Inc()
			if len(result) >= maxCount {
				break
			}
		}
	}
	return result, nil
}

func (c *FluvioClient) ListSmartModules() []*SmartModule {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]*SmartModule, len(c.smartModules))
	copy(result, c.smartModules)
	return result
}

func (c *FluvioClient) GetMetrics() *StreamMetrics {
	c.metrics.mu.Lock()
	defer c.metrics.mu.Unlock()
	byTopic := make(map[string]int64)
	for k, v := range c.metrics.byTopic {
		byTopic[k] = v
	}
	var avgThroughput float64
	if len(c.metrics.produceTimes) > 0 {
		var total float64
		for _, t := range c.metrics.produceTimes {
			total += t
		}
		avgThroughput = float64(len(c.metrics.produceTimes)) / total
	}
	return &StreamMetrics{
		TotalRecords: c.metrics.totalRecords,
		TotalTopics: len(c.topics),
		RecordsByTopic: byTopic,
		SmartModules: len(c.smartModules),
		AvgThroughput: avgThroughput,
	}
}

func (c *FluvioClient) Health() *HealthStatus {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return &HealthStatus{
		Connected: c.connected, Endpoint: c.config.Endpoint,
		TopicCount: len(c.topics), SmartModules: len(c.smartModules),
	}
}

func (c *FluvioClient) Close() {
	if c.grpcConn != nil {
		c.grpcConn.Close()
	}
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
	fmt.Println("[Fluvio] Client closed")
}
