package tigerbeetle

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

// --- Multi-Node Cluster (#19) ---

type ClusterConfig struct {
	ClusterID     uint64       `json:"cluster_id"`
	ReplicaCount  int          `json:"replica_count"`
	Replicas      []ReplicaConfig `json:"replicas"`
	QuorumSize    int          `json:"quorum_size"`
}

type ReplicaConfig struct {
	ReplicaIndex int    `json:"replica_index"`
	Address      string `json:"address"`
	Region       string `json:"region"`
	DataDir      string `json:"data_dir"`
	Status       string `json:"status"` // ACTIVE, SYNCING, OFFLINE
	LastHeartbeat time.Time `json:"last_heartbeat"`
}

var DefaultClusterConfig = ClusterConfig{
	ClusterID:    1,
	ReplicaCount: 6,
	QuorumSize:   4,
	Replicas: []ReplicaConfig{
		{ReplicaIndex: 0, Address: "tigerbeetle-0.lagos.payment-switch.svc:3000", Region: "lagos", DataDir: "/data/0_0.tigerbeetle", Status: "ACTIVE"},
		{ReplicaIndex: 1, Address: "tigerbeetle-1.lagos.payment-switch.svc:3000", Region: "lagos", DataDir: "/data/1_0.tigerbeetle", Status: "ACTIVE"},
		{ReplicaIndex: 2, Address: "tigerbeetle-2.lagos.payment-switch.svc:3000", Region: "lagos", DataDir: "/data/2_0.tigerbeetle", Status: "ACTIVE"},
		{ReplicaIndex: 3, Address: "tigerbeetle-3.london.payment-switch.svc:3000", Region: "london", DataDir: "/data/3_0.tigerbeetle", Status: "ACTIVE"},
		{ReplicaIndex: 4, Address: "tigerbeetle-4.london.payment-switch.svc:3000", Region: "london", DataDir: "/data/4_0.tigerbeetle", Status: "ACTIVE"},
		{ReplicaIndex: 5, Address: "tigerbeetle-5.accra.payment-switch.svc:3000", Region: "accra", DataDir: "/data/5_0.tigerbeetle", Status: "ACTIVE"},
	},
}

// --- Backup & Recovery Pipeline (#20) ---

type BackupConfig struct {
	Schedule        string `json:"schedule"`
	RetentionDays   int    `json:"retention_days"`
	S3Bucket        string `json:"s3_bucket"`
	S3Region        string `json:"s3_region"`
	EncryptionKeyID string `json:"encryption_key_id"`
	Compression     string `json:"compression"` // zstd, lz4, snappy
	VerifyAfterBackup bool `json:"verify_after_backup"`
}

type BackupRecord struct {
	ID            string    `json:"id"`
	Timestamp     time.Time `json:"timestamp"`
	SizeBytes     int64     `json:"size_bytes"`
	DurationMs    int64     `json:"duration_ms"`
	AccountCount  int64     `json:"account_count"`
	TransferCount int64     `json:"transfer_count"`
	Checksum      string    `json:"checksum"`
	S3Path        string    `json:"s3_path"`
	Status        string    `json:"status"` // COMPLETED, FAILED, VERIFYING
}

var DefaultBackupConfig = BackupConfig{
	Schedule:          "0 0 * * *",
	RetentionDays:     90,
	S3Bucket:          "payment-switch-tb-backups",
	S3Region:          "af-south-1",
	EncryptionKeyID:   "arn:aws:kms:af-south-1:ACCOUNT:key/TB_BACKUP_KEY",
	Compression:       "zstd",
	VerifyAfterBackup: true,
}

// --- Balance Reconciliation (#21) ---

type ReconciliationEngine struct {
	mu           sync.Mutex
	driftAlerts  []DriftAlert
	lastRunTime  time.Time
	totalChecked atomic.Int64
	totalDrift   atomic.Int64
}

type DriftAlert struct {
	AccountID       string    `json:"account_id"`
	TBBalance       int64     `json:"tb_balance"`
	PGBalance       int64     `json:"pg_balance"`
	DriftAmount     int64     `json:"drift_amount"`
	DriftPercentage float64   `json:"drift_percentage"`
	DetectedAt      time.Time `json:"detected_at"`
	Severity        string    `json:"severity"` // LOW, MEDIUM, HIGH, CRITICAL
	Resolution      string    `json:"resolution"` // PENDING, AUTO_CORRECTED, MANUAL
}

func NewReconciliationEngine() *ReconciliationEngine {
	return &ReconciliationEngine{}
}

func (re *ReconciliationEngine) CheckDrift(accountID string, tbBalance, pgBalance int64) *DriftAlert {
	re.totalChecked.Add(1)
	drift := tbBalance - pgBalance
	if drift == 0 {
		return nil
	}

	re.totalDrift.Add(1)
	var pct float64
	if tbBalance != 0 {
		pct = float64(abs(drift)) / float64(abs(tbBalance)) * 100
	}

	severity := "LOW"
	if pct > 1.0 {
		severity = "HIGH"
	} else if pct > 0.1 {
		severity = "MEDIUM"
	}
	if abs(drift) > 100000000 { // >₦1M
		severity = "CRITICAL"
	}

	alert := &DriftAlert{
		AccountID:       accountID,
		TBBalance:       tbBalance,
		PGBalance:       pgBalance,
		DriftAmount:     drift,
		DriftPercentage: pct,
		DetectedAt:      time.Now(),
		Severity:        severity,
		Resolution:      "PENDING",
	}

	re.mu.Lock()
	re.driftAlerts = append(re.driftAlerts, *alert)
	re.mu.Unlock()

	return alert
}

func (re *ReconciliationEngine) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_checked":     re.totalChecked.Load(),
		"total_drift":       re.totalDrift.Load(),
		"drift_rate_pct":    float64(re.totalDrift.Load()) / float64(max(re.totalChecked.Load(), 1)) * 100,
		"last_run":          re.lastRunTime,
		"pending_alerts":    len(re.driftAlerts),
	}
}

// --- Account Hierarchy (#22) ---

type AccountHierarchy struct {
	RootAccountID string            `json:"root_account_id"`
	Structure     map[string]string `json:"structure"` // child -> parent mapping
	Levels        []HierarchyLevel  `json:"levels"`
}

type HierarchyLevel struct {
	Level       int    `json:"level"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

var DefaultHierarchy = AccountHierarchy{
	Levels: []HierarchyLevel{
		{Level: 0, Name: "Platform", Description: "NDSEP platform master account"},
		{Level: 1, Name: "Bank", Description: "Participant bank settlement account"},
		{Level: 2, Name: "Branch", Description: "Bank branch sub-account"},
		{Level: 3, Name: "Merchant", Description: "Merchant settlement account"},
		{Level: 4, Name: "Sub-Merchant", Description: "Sub-merchant or agent account"},
	},
	Structure: map[string]string{
		"gtbank-settlement":     "ndsep-master",
		"gtbank-lagos-main":     "gtbank-settlement",
		"gtbank-vi-branch":      "gtbank-lagos-main",
		"merchant-shoprite-vi":   "gtbank-vi-branch",
		"access-settlement":     "ndsep-master",
		"zenith-settlement":     "ndsep-master",
		"firstbank-settlement":  "ndsep-master",
	},
}

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func init() {
	_ = fmt.Sprintf // avoid unused import
}
