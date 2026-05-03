package fluvio

import (
	"time"
)

// --- SmartModules (#57) ---

type SmartModule struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // filter, map, filter-map, aggregate, array-map
	WASMPath    string `json:"wasm_path"`
	Description string `json:"description"`
	InputTopic  string `json:"input_topic"`
	OutputTopic string `json:"output_topic"`
	AvgLatencyUs int64 `json:"avg_latency_us"`
}

var SmartModules = []SmartModule{
	{
		Name: "nip-high-value-filter", Type: "filter", WASMPath: "/smartmodules/nip-high-value-filter.wasm",
		Description: "Filter NIP transactions above ₦10M for enhanced scrutiny",
		InputTopic: "nip-transfers", OutputTopic: "nip-high-value", AvgLatencyUs: 12,
	},
	{
		Name: "fraud-score-enrichment", Type: "map", WASMPath: "/smartmodules/fraud-score-enrichment.wasm",
		Description: "Enrich transactions with real-time fraud score from MCMC engine",
		InputTopic: "nip-transfers", OutputTopic: "nip-scored", AvgLatencyUs: 45,
	},
	{
		Name: "pii-redaction", Type: "map", WASMPath: "/smartmodules/pii-redaction.wasm",
		Description: "Redact PII (BVN, account numbers) before forwarding to analytics",
		InputTopic: "nip-transfers", OutputTopic: "nip-analytics-safe", AvgLatencyUs: 8,
	},
	{
		Name: "velocity-aggregator", Type: "aggregate", WASMPath: "/smartmodules/velocity-aggregator.wasm",
		Description: "Compute rolling 5-min transaction velocity per account",
		InputTopic: "nip-transfers", OutputTopic: "velocity-updates", AvgLatencyUs: 25,
	},
	{
		Name: "settlement-splitter", Type: "array-map", WASMPath: "/smartmodules/settlement-splitter.wasm",
		Description: "Split batch settlement files into individual bank entries",
		InputTopic: "settlement-batches", OutputTopic: "settlement-entries", AvgLatencyUs: 15,
	},
	{
		Name: "sanctions-match-filter", Type: "filter-map", WASMPath: "/smartmodules/sanctions-match-filter.wasm",
		Description: "Filter and flag transactions matching sanctions watchlist",
		InputTopic: "remittance-transfers", OutputTopic: "sanctions-matches", AvgLatencyUs: 35,
	},
}

// --- Kafka Mirror Connector (#58) ---

type KafkaMirrorConfig struct {
	SourceKafka     string            `json:"source_kafka"`
	TargetFluvio    string            `json:"target_fluvio"`
	TopicMappings   []TopicMapping    `json:"topic_mappings"`
	Direction       string            `json:"direction"` // kafka-to-fluvio, fluvio-to-kafka, bidirectional
	BatchSize       int               `json:"batch_size"`
	FlushIntervalMs int               `json:"flush_interval_ms"`
}

type TopicMapping struct {
	KafkaTopic  string `json:"kafka_topic"`
	FluvioTopic string `json:"fluvio_topic"`
	Direction   string `json:"direction"`
	Priority    string `json:"priority"` // hot-path, standard, cold
}

var DefaultMirrorConfig = KafkaMirrorConfig{
	SourceKafka:     "kafka.payment-switch.svc:9092",
	TargetFluvio:    "fluvio.payment-switch.svc:9003",
	Direction:       "bidirectional",
	BatchSize:       1000,
	FlushIntervalMs: 100,
	TopicMappings: []TopicMapping{
		{KafkaTopic: "nip-transfers", FluvioTopic: "fluvio-nip-transfers", Direction: "kafka-to-fluvio", Priority: "hot-path"},
		{KafkaTopic: "fraud-alerts", FluvioTopic: "fluvio-fraud-alerts", Direction: "kafka-to-fluvio", Priority: "hot-path"},
		{KafkaTopic: "nip-status-updates", FluvioTopic: "fluvio-nip-status", Direction: "fluvio-to-kafka", Priority: "hot-path"},
		{KafkaTopic: "settlement-batches", FluvioTopic: "fluvio-settlement", Direction: "kafka-to-fluvio", Priority: "standard"},
		{KafkaTopic: "audit-events", FluvioTopic: "fluvio-audit", Direction: "kafka-to-fluvio", Priority: "cold"},
	},
}

// --- Stateful Stream Processing (#59) ---

type StreamProcessor struct {
	Name            string `json:"name"`
	InputTopic      string `json:"input_topic"`
	OutputTopic     string `json:"output_topic"`
	WindowType      string `json:"window_type"` // tumbling, sliding, session
	WindowDuration  time.Duration `json:"window_duration"`
	AggregationType string `json:"aggregation_type"` // count, sum, avg, max, min
	GroupByField    string `json:"group_by_field"`
	Description     string `json:"description"`
}

var StreamProcessors = []StreamProcessor{
	{
		Name: "tps-counter", InputTopic: "nip-transfers", OutputTopic: "nip-tps",
		WindowType: "tumbling", WindowDuration: 1 * time.Second,
		AggregationType: "count", GroupByField: "channel",
		Description: "Real-time TPS counting per channel",
	},
	{
		Name: "bank-volume-tracker", InputTopic: "nip-transfers", OutputTopic: "bank-volume",
		WindowType: "tumbling", WindowDuration: 1 * time.Minute,
		AggregationType: "sum", GroupByField: "source_bank",
		Description: "Per-bank transaction volume tracker (1-min windows)",
	},
	{
		Name: "fraud-velocity-check", InputTopic: "nip-transfers", OutputTopic: "velocity-alerts",
		WindowType: "sliding", WindowDuration: 5 * time.Minute,
		AggregationType: "count", GroupByField: "source_account",
		Description: "Per-account transaction velocity (5-min sliding window)",
	},
	{
		Name: "error-rate-monitor", InputTopic: "nip-transfers", OutputTopic: "error-rate",
		WindowType: "tumbling", WindowDuration: 1 * time.Minute,
		AggregationType: "avg", GroupByField: "destination_bank",
		Description: "Per-bank error rate (1-min tumbling window)",
	},
	{
		Name: "settlement-accumulator", InputTopic: "settlement-entries", OutputTopic: "settlement-positions",
		WindowType: "session", WindowDuration: 30 * time.Minute,
		AggregationType: "sum", GroupByField: "bank_code",
		Description: "Running settlement position accumulation",
	},
	{
		Name: "corridor-volume", InputTopic: "remittance-transfers", OutputTopic: "corridor-stats",
		WindowType: "tumbling", WindowDuration: 1 * time.Hour,
		AggregationType: "sum", GroupByField: "corridor",
		Description: "Hourly remittance corridor volume tracking",
	},
}
