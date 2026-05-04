package opensearch

import (
	"time"
)

// --- Index Lifecycle Management (#44) ---

type ILMPolicy struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Phases      ILMPhases  `json:"phases"`
}

type ILMPhases struct {
	Hot    *ILMPhase `json:"hot,omitempty"`
	Warm   *ILMPhase `json:"warm,omitempty"`
	Cold   *ILMPhase `json:"cold,omitempty"`
	Delete *ILMPhase `json:"delete,omitempty"`
}

type ILMPhase struct {
	MinAge         string              `json:"min_age"`
	Actions        map[string]ILMAction `json:"actions"`
}

type ILMAction struct {
	NumberOfReplicas int    `json:"number_of_replicas,omitempty"`
	NumberOfShards   int    `json:"number_of_shards,omitempty"`
	MaxSize          string `json:"max_size,omitempty"`
	MaxAge           string `json:"max_age,omitempty"`
	Codec            string `json:"codec,omitempty"`
}

var ILMPolicies = []ILMPolicy{
	{
		Name:        "payment-transactions-policy",
		Description: "Lifecycle for payment transaction indices",
		Phases: ILMPhases{
			Hot:    &ILMPhase{MinAge: "0d", Actions: map[string]ILMAction{"rollover": {MaxSize: "50gb", MaxAge: "1d"}}},
			Warm:   &ILMPhase{MinAge: "7d", Actions: map[string]ILMAction{"shrink": {NumberOfShards: 1}, "forcemerge": {}, "readonly": {}}},
			Cold:   &ILMPhase{MinAge: "30d", Actions: map[string]ILMAction{"readonly": {}}},
			Delete: &ILMPhase{MinAge: "365d", Actions: map[string]ILMAction{"delete": {}}},
		},
	},
	{
		Name:        "audit-logs-policy",
		Description: "Lifecycle for audit logs (7-year retention per CBN)",
		Phases: ILMPhases{
			Hot:    &ILMPhase{MinAge: "0d", Actions: map[string]ILMAction{"rollover": {MaxSize: "30gb", MaxAge: "1d"}}},
			Warm:   &ILMPhase{MinAge: "30d", Actions: map[string]ILMAction{"shrink": {NumberOfShards: 1}, "readonly": {}}},
			Cold:   &ILMPhase{MinAge: "90d", Actions: map[string]ILMAction{"readonly": {}}},
			Delete: &ILMPhase{MinAge: "2555d", Actions: map[string]ILMAction{"delete": {}}},
		},
	},
	{
		Name:        "fraud-alerts-policy",
		Description: "Lifecycle for fraud alert indices",
		Phases: ILMPhases{
			Hot:  &ILMPhase{MinAge: "0d", Actions: map[string]ILMAction{"rollover": {MaxSize: "20gb", MaxAge: "1d"}}},
			Warm: &ILMPhase{MinAge: "30d", Actions: map[string]ILMAction{"shrink": {NumberOfShards: 1}, "readonly": {}}},
			Cold: &ILMPhase{MinAge: "180d", Actions: map[string]ILMAction{"readonly": {}}},
			Delete: &ILMPhase{MinAge: "1825d", Actions: map[string]ILMAction{"delete": {}}},
		},
	},
}

// --- Cross-Cluster Search (#45) ---

type CrossClusterConfig struct {
	LocalCluster   string           `json:"local_cluster"`
	RemoteClusters []RemoteCluster  `json:"remote_clusters"`
}

type RemoteCluster struct {
	Name           string   `json:"name"`
	Seeds          []string `json:"seeds"`
	SkipUnavailable bool    `json:"skip_unavailable"`
	Connected       bool    `json:"connected"`
	Indices         []string `json:"indices"`
}

var DefaultCrossCluster = CrossClusterConfig{
	LocalCluster: "lagos-primary",
	RemoteClusters: []RemoteCluster{
		{Name: "london-secondary", Seeds: []string{"opensearch-london.payment-switch.svc:9300"}, SkipUnavailable: true, Connected: true, Indices: []string{"transactions-*", "fraud-alerts-*", "audit-logs-*"}},
		{Name: "accra-dr", Seeds: []string{"opensearch-accra.payment-switch.svc:9300"}, SkipUnavailable: true, Connected: true, Indices: []string{"transactions-*", "audit-logs-*"}},
	},
}

// --- Anomaly Detection (#46) ---

type AnomalyDetector struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Index           string   `json:"index"`
	Features        []Feature `json:"features"`
	DetectionInterval string `json:"detection_interval"`
	WindowDelay      string  `json:"window_delay"`
	Shingle          int     `json:"shingle_size"`
}

type Feature struct {
	Name        string `json:"name"`
	Aggregation string `json:"aggregation"` // avg, sum, count, max, min
	Field       string `json:"field"`
}

var AnomalyDetectors = []AnomalyDetector{
	{
		Name: "nip-volume-anomaly", Description: "Detect unusual NIP transaction volume spikes/drops", Index: "transactions-nip-*",
		Features: []Feature{
			{Name: "txn_count", Aggregation: "count", Field: "transaction_id"},
			{Name: "avg_amount", Aggregation: "avg", Field: "amount"},
			{Name: "error_rate", Aggregation: "avg", Field: "is_error"},
		},
		DetectionInterval: "5m", WindowDelay: "1m", Shingle: 8,
	},
	{
		Name: "latency-anomaly", Description: "Detect unusual API latency patterns", Index: "traces-*",
		Features: []Feature{
			{Name: "p99_latency", Aggregation: "max", Field: "duration_ms"},
			{Name: "avg_latency", Aggregation: "avg", Field: "duration_ms"},
		},
		DetectionInterval: "1m", WindowDelay: "30s", Shingle: 4,
	},
	{
		Name: "fraud-pattern-anomaly", Description: "Detect unusual fraud alert patterns", Index: "fraud-alerts-*",
		Features: []Feature{
			{Name: "alert_count", Aggregation: "count", Field: "alert_id"},
			{Name: "avg_risk_score", Aggregation: "avg", Field: "risk_score"},
			{Name: "critical_count", Aggregation: "sum", Field: "is_critical"},
		},
		DetectionInterval: "10m", WindowDelay: "2m", Shingle: 6,
	},
	{
		Name: "settlement-anomaly", Description: "Detect settlement amount deviations", Index: "settlements-*",
		Features: []Feature{
			{Name: "total_settled", Aggregation: "sum", Field: "amount"},
			{Name: "batch_count", Aggregation: "count", Field: "batch_id"},
		},
		DetectionInterval: "1h", WindowDelay: "10m", Shingle: 24,
	},
}

// --- Security Plugin (#47) ---

type SecurityConfig struct {
	SSLEnabled         bool     `json:"ssl_enabled"`
	SSLCertPath        string   `json:"ssl_cert_path"`
	SSLKeyPath         string   `json:"ssl_key_path"`
	AuditEnabled       bool     `json:"audit_enabled"`
	AuditLogPath       string   `json:"audit_log_path"`
	InternalUsersFile  string   `json:"internal_users_file"`
	Roles              []OSRole `json:"roles"`
}

type OSRole struct {
	Name           string   `json:"name"`
	ClusterPerms   []string `json:"cluster_permissions"`
	IndexPatterns  []string `json:"index_patterns"`
	IndexPerms     []string `json:"index_permissions"`
	Description    string   `json:"description"`
}

var SecurityRoles = []OSRole{
	{Name: "payment_admin", ClusterPerms: []string{"cluster_all"}, IndexPatterns: []string{"*"}, IndexPerms: []string{"crud", "create_index"}, Description: "Full admin access"},
	{Name: "payment_reader", ClusterPerms: []string{"cluster_monitor"}, IndexPatterns: []string{"transactions-*", "settlements-*"}, IndexPerms: []string{"read"}, Description: "Read-only transaction access"},
	{Name: "fraud_analyst", ClusterPerms: []string{"cluster_monitor"}, IndexPatterns: []string{"fraud-alerts-*", "transactions-*"}, IndexPerms: []string{"read", "write"}, Description: "Fraud team access"},
	{Name: "compliance_officer", ClusterPerms: []string{"cluster_monitor"}, IndexPatterns: []string{"audit-logs-*", "compliance-*"}, IndexPerms: []string{"read"}, Description: "Compliance read access"},
	{Name: "data_pipeline", ClusterPerms: []string{"cluster_monitor"}, IndexPatterns: []string{"transactions-*", "fraud-alerts-*", "settlements-*", "audit-logs-*"}, IndexPerms: []string{"crud", "create_index"}, Description: "Data pipeline write access"},
}

// --- Index Templates (#48) ---

type IndexTemplate struct {
	Name           string            `json:"name"`
	IndexPatterns  []string          `json:"index_patterns"`
	Priority       int               `json:"priority"`
	NumberOfShards int               `json:"number_of_shards"`
	NumberOfReplicas int             `json:"number_of_replicas"`
	Mappings       map[string]string `json:"mappings"`
	ILMPolicy      string            `json:"ilm_policy"`
}

var IndexTemplates = []IndexTemplate{
	{
		Name: "transactions-template", IndexPatterns: []string{"transactions-*"}, Priority: 100, NumberOfShards: 5, NumberOfReplicas: 2,
		Mappings: map[string]string{
			"transaction_id": "keyword", "session_id": "keyword", "source_bank": "keyword", "destination_bank": "keyword",
			"amount": "long", "currency": "keyword", "status": "keyword", "channel": "keyword",
			"narration": "text", "response_code": "keyword", "created_at": "date", "completed_at": "date",
			"latency_ms": "integer", "is_error": "boolean", "trace_id": "keyword",
		},
		ILMPolicy: "payment-transactions-policy",
	},
	{
		Name: "fraud-alerts-template", IndexPatterns: []string{"fraud-alerts-*"}, Priority: 100, NumberOfShards: 3, NumberOfReplicas: 2,
		Mappings: map[string]string{
			"alert_id": "keyword", "transaction_id": "keyword", "risk_score": "float", "severity": "keyword",
			"action": "keyword", "risk_factors": "keyword", "model_version": "keyword",
			"detected_at": "date", "resolved_at": "date", "analyst_id": "keyword",
		},
		ILMPolicy: "fraud-alerts-policy",
	},
	{
		Name: "audit-logs-template", IndexPatterns: []string{"audit-logs-*"}, Priority: 100, NumberOfShards: 3, NumberOfReplicas: 2,
		Mappings: map[string]string{
			"log_id": "keyword", "action": "keyword", "actor_id": "keyword", "actor_ip": "ip",
			"resource_type": "keyword", "resource_id": "keyword", "changes": "object",
			"timestamp": "date", "session_id": "keyword", "user_agent": "text",
		},
		ILMPolicy: "audit-logs-policy",
	},
}

func init() {
	_ = time.Now // avoid unused import
}
