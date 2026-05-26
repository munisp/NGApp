package observability

import (
	"time"
)

// --- Tail-Based Sampling (#49) ---

type TailSamplingConfig struct {
	DecisionWaitSec     int                `json:"decision_wait_sec"`
	NumTraces           int                `json:"num_traces"`
	ExpectedNewTracesPerSec int            `json:"expected_new_traces_per_sec"`
	Policies            []SamplingPolicy   `json:"policies"`
}

type SamplingPolicy struct {
	Name       string  `json:"name"`
	Type       string  `json:"type"` // always_sample, probabilistic, status_code, latency, string_attribute
	Rate       float64 `json:"rate,omitempty"`
	ThresholdMs int    `json:"threshold_ms,omitempty"`
	StatusCodes []int  `json:"status_codes,omitempty"`
}

var DefaultTailSampling = TailSamplingConfig{
	DecisionWaitSec:         10,
	NumTraces:               100000,
	ExpectedNewTracesPerSec: 5000,
	Policies: []SamplingPolicy{
		{Name: "error-traces", Type: "status_code", Rate: 1.0, StatusCodes: []int{500, 502, 503, 504}},
		{Name: "slow-traces", Type: "latency", Rate: 1.0, ThresholdMs: 500},
		{Name: "payment-traces", Type: "string_attribute", Rate: 1.0},
		{Name: "normal-traces", Type: "probabilistic", Rate: 0.1},
	},
}

// --- Long-Term Storage with Thanos (#50) ---

type ThanosConfig struct {
	SidecarEnabled  bool   `json:"sidecar_enabled"`
	StoreGateway    string `json:"store_gateway"`
	ObjectStore     ObjectStoreConfig `json:"object_store"`
	RetentionRaw    string `json:"retention_raw"`
	Retention5m     string `json:"retention_5m"`
	Retention1h     string `json:"retention_1h"`
	CompactorEnabled bool  `json:"compactor_enabled"`
	QueryFrontend   bool   `json:"query_frontend"`
}

type ObjectStoreConfig struct {
	Type      string `json:"type"` // S3, GCS, Azure
	Bucket    string `json:"bucket"`
	Endpoint  string `json:"endpoint"`
	Region    string `json:"region"`
}

var DefaultThanosConfig = ThanosConfig{
	SidecarEnabled: true,
	StoreGateway:   "thanos-store.monitoring.svc:10901",
	ObjectStore: ObjectStoreConfig{
		Type:     "S3",
		Bucket:   "payment-switch-metrics",
		Endpoint: "minio.payment-switch.svc:9000",
		Region:   "af-south-1",
	},
	RetentionRaw:     "15d",
	Retention5m:      "90d",
	Retention1h:      "365d",
	CompactorEnabled: true,
	QueryFrontend:    true,
}

// --- Unified Alerting (#51) ---

type UnifiedAlertRule struct {
	Name          string            `json:"name"`
	Folder        string            `json:"folder"`
	DataSource    string            `json:"data_source"` // prometheus, opensearch, jaeger
	Expression    string            `json:"expression"`
	Duration      string            `json:"duration"`
	Severity      string            `json:"severity"` // P1, P2, P3
	NotifyChannels []string         `json:"notify_channels"`
	Labels        map[string]string `json:"labels"`
	Annotations   map[string]string `json:"annotations"`
}

var UnifiedAlerts = []UnifiedAlertRule{
	{Name: "NIP Success Rate Below 99%", Folder: "Payment Operations", DataSource: "prometheus", Expression: "nip_success_rate < 0.99", Duration: "2m", Severity: "P1", NotifyChannels: []string{"pagerduty-oncall", "slack-payment-ops"}, Labels: map[string]string{"team": "payment-ops", "service": "nip"}, Annotations: map[string]string{"summary": "NIP success rate dropped below 99%"}},
	{Name: "Settlement Mismatch Detected", Folder: "Settlement", DataSource: "opensearch", Expression: "settlement_mismatch_count > 0", Duration: "1m", Severity: "P1", NotifyChannels: []string{"pagerduty-oncall", "slack-settlement"}, Labels: map[string]string{"team": "settlement", "service": "reconciliation"}, Annotations: map[string]string{"summary": "Settlement reconciliation found mismatches"}},
	{Name: "Fraud Alert Spike", Folder: "Fraud", DataSource: "opensearch", Expression: "fraud_alert_count_5m > avg_fraud_count_5m * 3", Duration: "5m", Severity: "P2", NotifyChannels: []string{"slack-fraud-team"}, Labels: map[string]string{"team": "fraud", "service": "fraud-detection"}, Annotations: map[string]string{"summary": "Fraud alerts 3x above normal"}},
	{Name: "API Latency P99 > 500ms", Folder: "Performance", DataSource: "jaeger", Expression: "api_latency_p99 > 500", Duration: "3m", Severity: "P2", NotifyChannels: []string{"slack-platform-eng"}, Labels: map[string]string{"team": "platform", "service": "api-gateway"}, Annotations: map[string]string{"summary": "API P99 latency exceeded 500ms"}},
	{Name: "TigerBeetle Balance Drift", Folder: "Infrastructure", DataSource: "prometheus", Expression: "tb_pg_balance_drift > 0", Duration: "1m", Severity: "P1", NotifyChannels: []string{"pagerduty-oncall", "slack-infra"}, Labels: map[string]string{"team": "infra", "service": "tigerbeetle"}, Annotations: map[string]string{"summary": "TigerBeetle-PostgreSQL balance drift detected"}},
	{Name: "Kafka Consumer Lag Critical", Folder: "Infrastructure", DataSource: "prometheus", Expression: "kafka_consumer_lag > 50000", Duration: "5m", Severity: "P2", NotifyChannels: []string{"slack-infra"}, Labels: map[string]string{"team": "infra", "service": "kafka"}, Annotations: map[string]string{"summary": "Kafka consumer lag exceeded 50K messages"}},
}

// --- OTEL Auto-Instrumentation (#52) ---

type AutoInstrumentationConfig struct {
	Language       string `json:"language"` // nodejs, go, python, java
	Namespace      string `json:"namespace"`
	ServiceName    string `json:"service_name"`
	Exporter       string `json:"exporter"` // otlp
	Endpoint       string `json:"endpoint"`
	SamplingRate   float64 `json:"sampling_rate"`
	PropagatorType string  `json:"propagator_type"` // tracecontext, b3, baggage
}

var AutoInstrumentations = []AutoInstrumentationConfig{
	{Language: "nodejs", Namespace: "payment-switch", ServiceName: "web-portal", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 1.0, PropagatorType: "tracecontext"},
	{Language: "go", Namespace: "payment-switch", ServiceName: "go-ledger", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 1.0, PropagatorType: "tracecontext"},
	{Language: "go", Namespace: "payment-switch", ServiceName: "settlement-engine", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 1.0, PropagatorType: "tracecontext"},
	{Language: "python", Namespace: "payment-switch", ServiceName: "fraud-detection", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 1.0, PropagatorType: "tracecontext"},
	{Language: "python", Namespace: "payment-switch", ServiceName: "ai-ml-services", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 0.5, PropagatorType: "tracecontext"},
	{Language: "python", Namespace: "payment-switch", ServiceName: "compliance-engine", Exporter: "otlp", Endpoint: "otel-collector:4317", SamplingRate: 1.0, PropagatorType: "tracecontext"},
}

// --- SLO Dashboard (#53) ---

type SLODefinition struct {
	Name          string  `json:"name"`
	Service       string  `json:"service"`
	Target        float64 `json:"target"`
	Window        string  `json:"window"` // 7d, 28d, 30d
	BurnRateAlert float64 `json:"burn_rate_alert"`
	Indicator     string  `json:"indicator"` // availability, latency, throughput
	Query         string  `json:"query"`
}

var SLODefinitions = []SLODefinition{
	{Name: "NIP Availability", Service: "nip-gateway", Target: 99.95, Window: "28d", BurnRateAlert: 14.4, Indicator: "availability", Query: "sum(rate(nip_requests_total{status!~'5..'}[5m])) / sum(rate(nip_requests_total[5m]))"},
	{Name: "NIP Latency P99", Service: "nip-gateway", Target: 99.0, Window: "28d", BurnRateAlert: 14.4, Indicator: "latency", Query: "histogram_quantile(0.99, rate(nip_request_duration_seconds_bucket[5m])) < 0.1"},
	{Name: "Settlement Success", Service: "settlement-engine", Target: 99.99, Window: "28d", BurnRateAlert: 14.4, Indicator: "availability", Query: "sum(rate(settlements_total{status='completed'}[5m])) / sum(rate(settlements_total[5m]))"},
	{Name: "Fraud Detection Latency", Service: "fraud-detection", Target: 99.5, Window: "28d", BurnRateAlert: 14.4, Indicator: "latency", Query: "histogram_quantile(0.99, rate(fraud_score_duration_seconds_bucket[5m])) < 0.05"},
	{Name: "Remittance Availability", Service: "remittance-engine", Target: 99.9, Window: "28d", BurnRateAlert: 14.4, Indicator: "availability", Query: "sum(rate(remittance_requests_total{status!~'5..'}[5m])) / sum(rate(remittance_requests_total[5m]))"},
	{Name: "API Gateway Uptime", Service: "apisix", Target: 99.99, Window: "28d", BurnRateAlert: 14.4, Indicator: "availability", Query: "sum(rate(apisix_http_status{code!~'5..'}[5m])) / sum(rate(apisix_http_status[5m]))"},
}

func init() {
	_ = time.Now // avoid unused import
}
