package temporal

import (
	"time"
)

// --- Multi-Cluster Replication (#23) ---

type MultiClusterConfig struct {
	PrimaryCluster   ClusterEndpoint   `json:"primary_cluster"`
	SecondaryCluster ClusterEndpoint   `json:"secondary_cluster"`
	Namespaces       []NamespaceReplication `json:"namespaces"`
	ReplicationLag   time.Duration     `json:"replication_lag"`
}

type ClusterEndpoint struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	Region  string `json:"region"`
}

type NamespaceReplication struct {
	Namespace          string `json:"namespace"`
	ActiveCluster      string `json:"active_cluster"`
	ReplicationEnabled bool   `json:"replication_enabled"`
	FailoverVersion    int64  `json:"failover_version"`
}

var DefaultMultiClusterConfig = MultiClusterConfig{
	PrimaryCluster:   ClusterEndpoint{Name: "lagos", Address: "temporal-lagos.payment-switch.svc:7233", Region: "lagos"},
	SecondaryCluster: ClusterEndpoint{Name: "london", Address: "temporal-london.payment-switch.svc:7233", Region: "london"},
	Namespaces: []NamespaceReplication{
		{Namespace: "payment-switch", ActiveCluster: "lagos", ReplicationEnabled: true, FailoverVersion: 1},
		{Namespace: "payment-switch-settlement", ActiveCluster: "lagos", ReplicationEnabled: true, FailoverVersion: 1},
		{Namespace: "payment-switch-compliance", ActiveCluster: "lagos", ReplicationEnabled: true, FailoverVersion: 1},
	},
	ReplicationLag: 500 * time.Millisecond,
}

// --- Workflow Versioning (#24) ---

type WorkflowVersion struct {
	WorkflowType    string    `json:"workflow_type"`
	Version         int       `json:"version"`
	ChangeID        string    `json:"change_id"`
	Description     string    `json:"description"`
	BackwardCompat  bool      `json:"backward_compatible"`
	DeployedAt      time.Time `json:"deployed_at"`
	MinVersion      int       `json:"min_version"`
}

var WorkflowVersions = []WorkflowVersion{
	{WorkflowType: "NIPTransferSaga", Version: 3, ChangeID: "nip-v3-enhanced-routing", Description: "Added smart routing and fallback rails", BackwardCompat: true, MinVersion: 2},
	{WorkflowType: "NEFTBatchSettlement", Version: 2, ChangeID: "neft-v2-parallel-clearing", Description: "Parallel batch processing with configurable concurrency", BackwardCompat: true, MinVersion: 1},
	{WorkflowType: "OutboundRemittanceSaga", Version: 2, ChangeID: "outbound-v2-multi-corridor", Description: "Multi-corridor support with dynamic FX", BackwardCompat: true, MinVersion: 1},
	{WorkflowType: "InboundRemittanceSaga", Version: 2, ChangeID: "inbound-v2-compliance", Description: "Enhanced compliance checks with PEP screening", BackwardCompat: true, MinVersion: 1},
	{WorkflowType: "FraudInvestigation", Version: 3, ChangeID: "fraud-v3-ml-enhanced", Description: "ML-enhanced scoring with GNN mule detection", BackwardCompat: false, MinVersion: 3},
	{WorkflowType: "SettlementReconciliation", Version: 2, ChangeID: "recon-v2-auto-match", Description: "Automated matching with TigerBeetle shadow sync", BackwardCompat: true, MinVersion: 1},
	{WorkflowType: "CBNReporting", Version: 2, ChangeID: "cbn-v2-automated", Description: "Fully automated CBN returns generation", BackwardCompat: true, MinVersion: 1},
}

// --- Saga Visibility Dashboard (#25) ---

type SagaVisibility struct {
	WorkflowID     string          `json:"workflow_id"`
	RunID          string          `json:"run_id"`
	Type           string          `json:"type"`
	Status         string          `json:"status"` // RUNNING, COMPLETED, FAILED, COMPENSATING, TIMED_OUT
	Steps          []SagaStep      `json:"steps"`
	StartedAt      time.Time       `json:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at,omitempty"`
	DurationMs     int64           `json:"duration_ms"`
	PaymentRef     string          `json:"payment_ref"`
	Amount         int64           `json:"amount"`
	Currency       string          `json:"currency"`
}

type SagaStep struct {
	Name           string     `json:"name"`
	Status         string     `json:"status"` // PENDING, RUNNING, COMPLETED, FAILED, COMPENSATED
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	DurationMs     int64      `json:"duration_ms"`
	Error          string     `json:"error,omitempty"`
	CompensationRun bool      `json:"compensation_run"`
}

// --- KEDA Auto-Scaling (#26) ---

type KEDAScalerConfig struct {
	ScalerName      string `json:"scaler_name"`
	TaskQueue       string `json:"task_queue"`
	Namespace       string `json:"namespace"`
	MinReplicaCount int    `json:"min_replica_count"`
	MaxReplicaCount int    `json:"max_replica_count"`
	PollingInterval int    `json:"polling_interval"`
	CooldownPeriod  int    `json:"cooldown_period"`
	Threshold       int    `json:"threshold"`
}

var KEDAScalers = []KEDAScalerConfig{
	{ScalerName: "nip-transfer-worker", TaskQueue: "nip-transfer-queue", Namespace: "payment-switch", MinReplicaCount: 3, MaxReplicaCount: 30, PollingInterval: 5, CooldownPeriod: 60, Threshold: 100},
	{ScalerName: "neft-batch-worker", TaskQueue: "neft-batch-queue", Namespace: "payment-switch", MinReplicaCount: 2, MaxReplicaCount: 20, PollingInterval: 10, CooldownPeriod: 120, Threshold: 50},
	{ScalerName: "settlement-worker", TaskQueue: "settlement-queue", Namespace: "payment-switch", MinReplicaCount: 2, MaxReplicaCount: 10, PollingInterval: 15, CooldownPeriod: 180, Threshold: 20},
	{ScalerName: "fraud-investigation-worker", TaskQueue: "fraud-queue", Namespace: "payment-switch", MinReplicaCount: 2, MaxReplicaCount: 15, PollingInterval: 5, CooldownPeriod: 60, Threshold: 30},
	{ScalerName: "remittance-worker", TaskQueue: "remittance-queue", Namespace: "payment-switch", MinReplicaCount: 2, MaxReplicaCount: 10, PollingInterval: 10, CooldownPeriod: 120, Threshold: 50},
	{ScalerName: "compliance-worker", TaskQueue: "compliance-queue", Namespace: "payment-switch", MinReplicaCount: 1, MaxReplicaCount: 5, PollingInterval: 30, CooldownPeriod: 300, Threshold: 10},
}

// --- Cron Workflows (#27) ---

type CronWorkflow struct {
	WorkflowType string `json:"workflow_type"`
	CronSchedule string `json:"cron_schedule"`
	TaskQueue    string `json:"task_queue"`
	Description  string `json:"description"`
	Timeout      time.Duration `json:"timeout"`
	RetryPolicy  RetryPolicy   `json:"retry_policy"`
}

type RetryPolicy struct {
	MaxAttempts       int           `json:"max_attempts"`
	InitialInterval   time.Duration `json:"initial_interval"`
	BackoffCoefficient float64      `json:"backoff_coefficient"`
	MaxInterval       time.Duration `json:"max_interval"`
}

var CronWorkflows = []CronWorkflow{
	{
		WorkflowType: "CBNDailyReport",
		CronSchedule: "0 6 * * *",
		TaskQueue:    "compliance-queue",
		Description:  "Generate and submit daily CBN NIP settlement report",
		Timeout:      30 * time.Minute,
		RetryPolicy:  RetryPolicy{MaxAttempts: 3, InitialInterval: 5 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
	},
	{
		WorkflowType: "SettlementReconciliation",
		CronSchedule: "0 23 * * *",
		TaskQueue:    "settlement-queue",
		Description:  "End-of-day settlement reconciliation across all banks",
		Timeout:      2 * time.Hour,
		RetryPolicy:  RetryPolicy{MaxAttempts: 3, InitialInterval: 10 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 1 * time.Hour},
	},
	{
		WorkflowType: "SanctionsListRefresh",
		CronSchedule: "0 1 * * *",
		TaskQueue:    "compliance-queue",
		Description:  "Refresh OFAC/UN/EU/EFCC sanctions lists",
		Timeout:      1 * time.Hour,
		RetryPolicy:  RetryPolicy{MaxAttempts: 5, InitialInterval: 5 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
	},
	{
		WorkflowType: "TigerBeetleBackup",
		CronSchedule: "0 0 * * *",
		TaskQueue:    "infra-queue",
		Description:  "Daily TigerBeetle snapshot to S3",
		Timeout:      1 * time.Hour,
		RetryPolicy:  RetryPolicy{MaxAttempts: 3, InitialInterval: 10 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
	},
	{
		WorkflowType: "BalanceReconciliation",
		CronSchedule: "*/30 * * * *",
		TaskQueue:    "infra-queue",
		Description:  "TigerBeetle ↔ PostgreSQL balance drift check every 30 min",
		Timeout:      15 * time.Minute,
		RetryPolicy:  RetryPolicy{MaxAttempts: 2, InitialInterval: 2 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 10 * time.Minute},
	},
	{
		WorkflowType: "CertificateRotation",
		CronSchedule: "0 2 * * 0",
		TaskQueue:    "infra-queue",
		Description:  "Weekly mTLS certificate rotation check",
		Timeout:      30 * time.Minute,
		RetryPolicy:  RetryPolicy{MaxAttempts: 3, InitialInterval: 5 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 15 * time.Minute},
	},
	{
		WorkflowType: "ProphetModelRetrain",
		CronSchedule: "0 3 * * 0",
		TaskQueue:    "ml-queue",
		Description:  "Weekly Prophet volume forecasting model retraining",
		Timeout:      2 * time.Hour,
		RetryPolicy:  RetryPolicy{MaxAttempts: 2, InitialInterval: 15 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: 1 * time.Hour},
	},
}
