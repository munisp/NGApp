package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// --- Schema Registry (#2) ---

type SchemaType string

const (
	SchemaAvro     SchemaType = "AVRO"
	SchemaProtobuf SchemaType = "PROTOBUF"
	SchemaJSON     SchemaType = "JSON"
)

type SchemaRegistryEntry struct {
	ID            string     `json:"id"`
	Subject       string     `json:"subject"`
	Version       int        `json:"version"`
	SchemaType    SchemaType `json:"schema_type"`
	Schema        string     `json:"schema"`
	Compatibility string     `json:"compatibility"`
	RegisteredAt  time.Time  `json:"registered_at"`
	Fingerprint   string     `json:"fingerprint"`
}

type SchemaRegistry struct {
	mu       sync.RWMutex
	schemas  map[string][]SchemaRegistryEntry
	endpoint string
}

func NewSchemaRegistry(endpoint string) *SchemaRegistry {
	return &SchemaRegistry{
		schemas:  make(map[string][]SchemaRegistryEntry),
		endpoint: endpoint,
	}
}

func (sr *SchemaRegistry) RegisterSchema(subject string, schemaType SchemaType, schema string) (*SchemaRegistryEntry, error) {
	sr.mu.Lock()
	defer sr.mu.Unlock()

	versions := sr.schemas[subject]
	entry := SchemaRegistryEntry{
		ID:            fmt.Sprintf("schema-%s-%d", subject, len(versions)+1),
		Subject:       subject,
		Version:       len(versions) + 1,
		SchemaType:    schemaType,
		Schema:        schema,
		Compatibility: "BACKWARD",
		RegisteredAt:  time.Now(),
	}
	sr.schemas[subject] = append(versions, entry)
	return &entry, nil
}

func (sr *SchemaRegistry) GetLatestSchema(subject string) (*SchemaRegistryEntry, error) {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	versions, ok := sr.schemas[subject]
	if !ok || len(versions) == 0 {
		return nil, fmt.Errorf("no schema found for subject: %s", subject)
	}
	return &versions[len(versions)-1], nil
}

// Payment topic schemas
var PaymentSchemas = map[string]string{
	"nip-transfer-value": `{
		"type": "record",
		"name": "NIPTransfer",
		"fields": [
			{"name": "transfer_id", "type": "string"},
			{"name": "source_bank", "type": "string"},
			{"name": "destination_bank", "type": "string"},
			{"name": "amount_kobo", "type": "long"},
			{"name": "currency", "type": {"type": "enum", "name": "Currency", "symbols": ["NGN","USD","GBP","EUR"]}},
			{"name": "narration", "type": "string"},
			{"name": "timestamp", "type": {"type": "long", "logicalType": "timestamp-millis"}},
			{"name": "session_id", "type": "string"},
			{"name": "response_code", "type": ["null", "string"], "default": null}
		]
	}`,
	"settlement-batch-value": `{
		"type": "record",
		"name": "SettlementBatch",
		"fields": [
			{"name": "batch_id", "type": "string"},
			{"name": "settlement_date", "type": "string"},
			{"name": "total_credits", "type": "long"},
			{"name": "total_debits", "type": "long"},
			{"name": "net_position", "type": "long"},
			{"name": "participant_count", "type": "int"},
			{"name": "status", "type": {"type": "enum", "name": "BatchStatus", "symbols": ["PENDING","PROCESSING","SETTLED","FAILED"]}}
		]
	}`,
	"fraud-alert-value": `{
		"type": "record",
		"name": "FraudAlert",
		"fields": [
			{"name": "alert_id", "type": "string"},
			{"name": "transaction_id", "type": "string"},
			{"name": "risk_score", "type": "double"},
			{"name": "risk_factors", "type": {"type": "array", "items": "string"}},
			{"name": "severity", "type": {"type": "enum", "name": "Severity", "symbols": ["LOW","MEDIUM","HIGH","CRITICAL"]}},
			{"name": "action", "type": {"type": "enum", "name": "Action", "symbols": ["ALLOW","FLAG","REVIEW","BLOCK"]}}
		]
	}`,
}

// --- Dead Letter Queue (#4) ---

type DLQMessage struct {
	OriginalTopic   string          `json:"original_topic"`
	OriginalKey     string          `json:"original_key"`
	Payload         json.RawMessage `json:"payload"`
	ErrorMessage    string          `json:"error_message"`
	ErrorCode       string          `json:"error_code"`
	RetryCount      int             `json:"retry_count"`
	MaxRetries      int             `json:"max_retries"`
	FirstFailedAt   time.Time       `json:"first_failed_at"`
	LastFailedAt    time.Time       `json:"last_failed_at"`
	NextRetryAt     time.Time       `json:"next_retry_at"`
	Status          string          `json:"status"` // PENDING, RETRYING, EXHAUSTED, RESOLVED
	ProcessorNodeID string          `json:"processor_node_id"`
}

type DLQProcessor struct {
	mu               sync.Mutex
	messages         []DLQMessage
	maxRetries       int
	retryBackoffBase time.Duration
	totalProcessed   atomic.Int64
	totalResolved    atomic.Int64
	totalExhausted   atomic.Int64
}

func NewDLQProcessor(maxRetries int) *DLQProcessor {
	return &DLQProcessor{
		maxRetries:       maxRetries,
		retryBackoffBase: 30 * time.Second,
	}
}

func (d *DLQProcessor) EnqueueFailed(topic, key string, payload json.RawMessage, err error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	msg := DLQMessage{
		OriginalTopic: topic,
		OriginalKey:   key,
		Payload:       payload,
		ErrorMessage:  err.Error(),
		RetryCount:    0,
		MaxRetries:    d.maxRetries,
		FirstFailedAt: now,
		LastFailedAt:  now,
		NextRetryAt:   now.Add(d.retryBackoffBase),
		Status:        "PENDING",
	}
	d.messages = append(d.messages, msg)
	d.totalProcessed.Add(1)
}

func (d *DLQProcessor) ProcessRetries(ctx context.Context) {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	for i := range d.messages {
		if d.messages[i].Status != "PENDING" && d.messages[i].Status != "RETRYING" {
			continue
		}
		if now.Before(d.messages[i].NextRetryAt) {
			continue
		}
		d.messages[i].RetryCount++
		if d.messages[i].RetryCount >= d.messages[i].MaxRetries {
			d.messages[i].Status = "EXHAUSTED"
			d.totalExhausted.Add(1)
		} else {
			d.messages[i].Status = "RETRYING"
			backoff := d.retryBackoffBase * time.Duration(1<<uint(d.messages[i].RetryCount))
			d.messages[i].NextRetryAt = now.Add(backoff)
			d.messages[i].LastFailedAt = now
		}
	}
}

func (d *DLQProcessor) GetStats() map[string]int64 {
	return map[string]int64{
		"total_processed": d.totalProcessed.Load(),
		"total_resolved":  d.totalResolved.Load(),
		"total_exhausted": d.totalExhausted.Load(),
	}
}

// --- Consumer Lag Monitoring (#5) ---

type ConsumerGroupLag struct {
	GroupID      string            `json:"group_id"`
	TopicLags    map[string]int64  `json:"topic_lags"`
	TotalLag     int64             `json:"total_lag"`
	AlertLevel   string            `json:"alert_level"` // NORMAL, WARNING, CRITICAL
	LastChecked  time.Time         `json:"last_checked"`
	ConsumerPods int               `json:"consumer_pods"`
	TargetPods   int               `json:"target_pods"`
}

type ConsumerLagMonitor struct {
	mu                sync.RWMutex
	groups            map[string]*ConsumerGroupLag
	warningThreshold  int64
	criticalThreshold int64
	maxPods           int
}

func NewConsumerLagMonitor(warningThreshold, criticalThreshold int64, maxPods int) *ConsumerLagMonitor {
	return &ConsumerLagMonitor{
		groups:            make(map[string]*ConsumerGroupLag),
		warningThreshold:  warningThreshold,
		criticalThreshold: criticalThreshold,
		maxPods:           maxPods,
	}
}

func (m *ConsumerLagMonitor) UpdateLag(groupID string, topicLags map[string]int64, currentPods int) *ConsumerGroupLag {
	m.mu.Lock()
	defer m.mu.Unlock()

	var totalLag int64
	for _, lag := range topicLags {
		totalLag += lag
	}

	alertLevel := "NORMAL"
	targetPods := currentPods
	if totalLag > m.criticalThreshold {
		alertLevel = "CRITICAL"
		targetPods = min(currentPods*3, m.maxPods)
	} else if totalLag > m.warningThreshold {
		alertLevel = "WARNING"
		targetPods = min(currentPods*2, m.maxPods)
	}

	lag := &ConsumerGroupLag{
		GroupID:      groupID,
		TopicLags:    topicLags,
		TotalLag:     totalLag,
		AlertLevel:   alertLevel,
		LastChecked:  time.Now(),
		ConsumerPods: currentPods,
		TargetPods:   targetPods,
	}
	m.groups[groupID] = lag
	return lag
}

func (m *ConsumerLagMonitor) GetAllLags() []*ConsumerGroupLag {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*ConsumerGroupLag, 0, len(m.groups))
	for _, lag := range m.groups {
		result = append(result, lag)
	}
	return result
}

// --- Exactly-Once Semantics (#7) ---

type EOSConfig struct {
	TransactionalID string `json:"transactional_id"`
	EnableIdempotent bool   `json:"enable_idempotent"`
	MaxInFlight      int    `json:"max_in_flight"`
	Acks             string `json:"acks"`       // "all"
	IsolationLevel   string `json:"isolation_level"` // "read_committed"
	TransactionTimeout time.Duration `json:"transaction_timeout"`
}

type TransactionalProducer struct {
	config       EOSConfig
	inTransaction atomic.Bool
	txnCount      atomic.Int64
	txnAborted    atomic.Int64
}

func NewTransactionalProducer(txnID string) *TransactionalProducer {
	return &TransactionalProducer{
		config: EOSConfig{
			TransactionalID:    txnID,
			EnableIdempotent:   true,
			MaxInFlight:        5,
			Acks:               "all",
			IsolationLevel:     "read_committed",
			TransactionTimeout: 60 * time.Second,
		},
	}
}

func (p *TransactionalProducer) BeginTransaction() error {
	if p.inTransaction.Load() {
		return fmt.Errorf("transaction already in progress")
	}
	p.inTransaction.Store(true)
	p.txnCount.Add(1)
	return nil
}

func (p *TransactionalProducer) CommitTransaction() error {
	if !p.inTransaction.Load() {
		return fmt.Errorf("no transaction in progress")
	}
	p.inTransaction.Store(false)
	return nil
}

func (p *TransactionalProducer) AbortTransaction() error {
	if !p.inTransaction.Load() {
		return fmt.Errorf("no transaction in progress")
	}
	p.inTransaction.Store(false)
	p.txnAborted.Add(1)
	return nil
}

// --- MirrorMaker2 Config (#1) ---

type MirrorMaker2Config struct {
	SourceCluster      ClusterConfig  `json:"source_cluster"`
	TargetCluster      ClusterConfig  `json:"target_cluster"`
	TopicPatterns      []string       `json:"topic_patterns"`
	ReplicationFactor  int            `json:"replication_factor"`
	SyncGroupOffsets   bool           `json:"sync_group_offsets"`
	EmitHeartbeats     bool           `json:"emit_heartbeats"`
	EmitCheckpoints    bool           `json:"emit_checkpoints"`
	RefreshTopicsSecs  int            `json:"refresh_topics_secs"`
	ReplicationLagMs   int64          `json:"replication_lag_ms"`
}

type ClusterConfig struct {
	Alias           string `json:"alias"`
	BootstrapServer string `json:"bootstrap_server"`
	SecurityProtocol string `json:"security_protocol"`
	SASLMechanism   string `json:"sasl_mechanism,omitempty"`
}

var DefaultMM2Config = MirrorMaker2Config{
	SourceCluster: ClusterConfig{
		Alias:            "lagos",
		BootstrapServer:  "kafka-lagos.payment-switch.svc:9092",
		SecurityProtocol: "SASL_SSL",
		SASLMechanism:    "SCRAM-SHA-512",
	},
	TargetCluster: ClusterConfig{
		Alias:            "london",
		BootstrapServer:  "kafka-london.payment-switch.svc:9092",
		SecurityProtocol: "SASL_SSL",
		SASLMechanism:    "SCRAM-SHA-512",
	},
	TopicPatterns: []string{
		"nip-transfers",
		"neft-batches",
		"settlement-.*",
		"fraud-alerts",
		"remittance-.*",
		"compliance-.*",
	},
	ReplicationFactor: 3,
	SyncGroupOffsets:  true,
	EmitHeartbeats:    true,
	EmitCheckpoints:   true,
	RefreshTopicsSecs: 30,
}

// --- Tiered Storage (#3) ---

type TieredStorageConfig struct {
	LocalRetentionMs    int64  `json:"local_retention_ms"`
	RemoteStorageEnable bool   `json:"remote_storage_enable"`
	RemoteLogStorageDir string `json:"remote_log_storage_dir"`
	S3Bucket            string `json:"s3_bucket"`
	S3Region            string `json:"s3_region"`
	S3Endpoint          string `json:"s3_endpoint"`
}

var DefaultTieredStorage = TieredStorageConfig{
	LocalRetentionMs:    7 * 24 * 60 * 60 * 1000, // 7 days on SSD
	RemoteStorageEnable: true,
	RemoteLogStorageDir: "/data/kafka-tiered",
	S3Bucket:            "payment-switch-kafka-tiered",
	S3Region:            "af-south-1",
	S3Endpoint:          "http://minio:9000",
}

// --- Topic Compaction (#6) ---

type CompactedTopic struct {
	Name            string `json:"name"`
	CleanupPolicy   string `json:"cleanup_policy"` // "compact" or "compact,delete"
	MinCleanableDirtyRatio float64 `json:"min_cleanable_dirty_ratio"`
	DeleteRetentionMs int64  `json:"delete_retention_ms"`
	SegmentMs         int64  `json:"segment_ms"`
}

var CompactedTopics = []CompactedTopic{
	{
		Name:                   "account-balances",
		CleanupPolicy:          "compact",
		MinCleanableDirtyRatio: 0.5,
		DeleteRetentionMs:      86400000,
		SegmentMs:              3600000,
	},
	{
		Name:                   "merchant-state",
		CleanupPolicy:          "compact",
		MinCleanableDirtyRatio: 0.5,
		DeleteRetentionMs:      86400000,
		SegmentMs:              3600000,
	},
	{
		Name:                   "bank-participant-config",
		CleanupPolicy:          "compact",
		MinCleanableDirtyRatio: 0.3,
		DeleteRetentionMs:      604800000,
		SegmentMs:              86400000,
	},
	{
		Name:                   "rate-limit-state",
		CleanupPolicy:          "compact,delete",
		MinCleanableDirtyRatio: 0.5,
		DeleteRetentionMs:      3600000,
		SegmentMs:              1800000,
	},
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
