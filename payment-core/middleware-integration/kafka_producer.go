package middleware

import (
	"encoding/json"
	"sync"
	"time"
)

type KafkaConfig struct {
	Brokers          string
	ClientID         string
	SecurityProtocol string
	SASLMechanism    string
	SchemaRegistryURL string
	ProducerConfig   ProducerConfig
	ConsumerConfig   ConsumerConfig
}

type ProducerConfig struct {
	Acks            string
	Retries         int
	BatchSize       int
	LingerMs        int
	CompressionType string
	Idempotent      bool
	MaxInFlight     int
}

type ConsumerConfig struct {
	GroupID         string
	AutoCommit      bool
	AutoOffsetReset string
	SessionTimeout  int
	HeartbeatMs     int
	MaxPollRecords  int
	IsolationLevel  string
}

type PaymentEvent struct {
	ID            string
	Type          string
	TransactionID string
	Amount        int64
	Currency      string
	SenderBank    string
	RecipientBank string
	Status        string
	Timestamp     time.Time
	Metadata      map[string]string
}

var DefaultKafkaConfig = KafkaConfig{
	Brokers:           "kafka:9092",
	ClientID:          "payment-switch",
	SecurityProtocol:  "PLAINTEXT",
	SchemaRegistryURL: "http://schema-registry:8081",
	ProducerConfig: ProducerConfig{
		Acks: "all", Retries: 3, BatchSize: 16384, LingerMs: 5,
		CompressionType: "lz4", Idempotent: true, MaxInFlight: 5,
	},
	ConsumerConfig: ConsumerConfig{
		GroupID: "payment-switch-consumers", AutoCommit: false,
		AutoOffsetReset: "earliest", SessionTimeout: 30000,
		HeartbeatMs: 10000, MaxPollRecords: 500, IsolationLevel: "read_committed",
	},
}

var PaymentTopics = map[string]string{
	"nip_transactions":     "payment.nip.transactions",
	"neft_batches":         "payment.neft.batches",
	"settlements":          "payment.settlements",
	"fraud_alerts":         "payment.fraud.alerts",
	"compliance_events":    "payment.compliance.events",
	"remittance_outbound":  "payment.remittance.outbound",
	"remittance_inbound":   "payment.remittance.inbound",
	"audit_log":            "platform.audit.log",
	"dlq":                  "payment.dlq",
	"sanctions_screening":  "payment.sanctions.screening",
	"webhook_deliveries":   "payment.webhooks.deliveries",
}

type KafkaProducer struct {
	mu      sync.RWMutex
	config  KafkaConfig
	sent    int64
	failed  int64
	events  []PaymentEvent
}

func NewKafkaProducer(cfg KafkaConfig) *KafkaProducer {
	return &KafkaProducer{
		config: cfg,
		events: make([]PaymentEvent, 0, 1000),
	}
}

func (kp *KafkaProducer) Publish(topic string, event PaymentEvent) error {
	kp.mu.Lock()
	defer kp.mu.Unlock()

	event.Timestamp = time.Now()
	kp.events = append(kp.events, event)
	kp.sent++

	if len(kp.events) > 10000 {
		kp.events = kp.events[len(kp.events)-10000:]
	}
	return nil
}

func (kp *KafkaProducer) PublishJSON(topic string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		kp.mu.Lock()
		kp.failed++
		kp.mu.Unlock()
		return err
	}

	event := PaymentEvent{
		ID:        time.Now().Format("20060102150405.000"),
		Type:      topic,
		Timestamp: time.Now(),
		Metadata:  map[string]string{"payload_size": string(rune(len(data)))},
	}
	return kp.Publish(topic, event)
}

func (kp *KafkaProducer) GetMetrics() map[string]int64 {
	kp.mu.RLock()
	defer kp.mu.RUnlock()
	return map[string]int64{
		"sent":   kp.sent,
		"failed": kp.failed,
		"queued": int64(len(kp.events)),
	}
}
