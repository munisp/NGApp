package postgresql

import (
	"fmt"
	"time"
)

// --- PgBouncer Connection Pooling (#13) ---

type PgBouncerConfig struct {
	ListenAddr    string `json:"listen_addr"`
	ListenPort    int    `json:"listen_port"`
	AuthType      string `json:"auth_type"`
	PoolMode      string `json:"pool_mode"`
	MaxClientConn int    `json:"max_client_conn"`
	DefaultPoolSize int  `json:"default_pool_size"`
	MinPoolSize     int  `json:"min_pool_size"`
	ReservePoolSize int  `json:"reserve_pool_size"`
	ReservePoolTimeout int `json:"reserve_pool_timeout"`
	MaxDBConnections  int `json:"max_db_connections"`
	ServerIdleTimeout int `json:"server_idle_timeout"`
	QueryTimeout      int `json:"query_timeout"`
	StatsPeriod       int `json:"stats_period"`
}

var DefaultPgBouncerConfig = PgBouncerConfig{
	ListenAddr:         "0.0.0.0",
	ListenPort:         6432,
	AuthType:           "scram-sha-256",
	PoolMode:           "transaction",
	MaxClientConn:      2000,
	DefaultPoolSize:    50,
	MinPoolSize:        10,
	ReservePoolSize:    20,
	ReservePoolTimeout: 5,
	MaxDBConnections:   200,
	ServerIdleTimeout:  600,
	QueryTimeout:       30,
	StatsPeriod:        60,
}

// Per-service pool configurations
var ServicePoolConfigs = map[string]PgBouncerConfig{
	"go-ledger": {PoolMode: "transaction", DefaultPoolSize: 80, MinPoolSize: 20, MaxDBConnections: 100},
	"fraud-detection": {PoolMode: "transaction", DefaultPoolSize: 40, MinPoolSize: 10, MaxDBConnections: 50},
	"settlement-engine": {PoolMode: "session", DefaultPoolSize: 30, MinPoolSize: 5, MaxDBConnections: 40},
	"data-pipeline": {PoolMode: "transaction", DefaultPoolSize: 20, MinPoolSize: 5, MaxDBConnections: 30},
	"temporal-server": {PoolMode: "transaction", DefaultPoolSize: 60, MinPoolSize: 15, MaxDBConnections: 80},
	"keycloak": {PoolMode: "session", DefaultPoolSize: 30, MinPoolSize: 10, MaxDBConnections: 40},
	"permify": {PoolMode: "transaction", DefaultPoolSize: 20, MinPoolSize: 5, MaxDBConnections: 30},
}

// --- Patroni HA / Read Replicas (#14) ---

type PatroniConfig struct {
	Scope     string          `json:"scope"`
	Namespace string          `json:"namespace"`
	Name      string          `json:"name"`
	Bootstrap BootstrapConfig `json:"bootstrap"`
	Replicas  []ReplicaNode   `json:"replicas"`
}

type BootstrapConfig struct {
	DCS                 DCSConfig `json:"dcs"`
	InitDB              []string  `json:"initdb"`
	PgHBA               []string  `json:"pg_hba"`
	MaximumLagOnFailover int64    `json:"maximum_lag_on_failover"`
}

type DCSConfig struct {
	TTL                  int `json:"ttl"`
	LoopWait             int `json:"loop_wait"`
	RetryTimeout         int `json:"retry_timeout"`
	MaximumLagOnFailover int `json:"maximum_lag_on_failover"`
}

type ReplicaNode struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Role     string `json:"role"` // primary, replica, sync-replica
	Region   string `json:"region"`
	Priority int    `json:"priority"`
	State    string `json:"state"` // running, streaming, stopped
}

var DefaultPatroniConfig = PatroniConfig{
	Scope:     "payment-switch-pg",
	Namespace: "payment-switch",
	Name:      "pg-primary",
	Bootstrap: BootstrapConfig{
		DCS: DCSConfig{TTL: 30, LoopWait: 10, RetryTimeout: 10, MaximumLagOnFailover: 1048576},
		InitDB: []string{
			"encoding: UTF8",
			"data-checksums",
			"locale: en_US.UTF-8",
		},
		PgHBA: []string{
			"host replication replicator 10.0.0.0/8 scram-sha-256",
			"host all all 10.0.0.0/8 scram-sha-256",
		},
	},
	Replicas: []ReplicaNode{
		{Name: "pg-primary", Host: "pg-primary.payment-switch.svc", Port: 5432, Role: "primary", Region: "lagos", Priority: 100, State: "running"},
		{Name: "pg-replica-1", Host: "pg-replica-1.payment-switch.svc", Port: 5432, Role: "sync-replica", Region: "lagos", Priority: 90, State: "streaming"},
		{Name: "pg-replica-2", Host: "pg-replica-2.payment-switch.svc", Port: 5432, Role: "replica", Region: "london", Priority: 80, State: "streaming"},
	},
}

// --- Logical Replication (#15) ---

type LogicalReplicationConfig struct {
	PublicationName string   `json:"publication_name"`
	SubscriptionName string  `json:"subscription_name"`
	Tables          []string `json:"tables"`
	TargetHost      string   `json:"target_host"`
	TargetPort      int      `json:"target_port"`
	SlotName        string   `json:"slot_name"`
	OutputPlugin    string   `json:"output_plugin"`
}

var DefaultReplicationConfig = LogicalReplicationConfig{
	PublicationName:  "payment_switch_pub",
	SubscriptionName: "payment_switch_sub_dr",
	Tables: []string{
		"transactions", "accounts", "settlements", "bank_participants",
		"merchants", "mandates", "fraud_alerts", "audit_logs",
		"remittance_transfers", "compliance_reports",
	},
	TargetHost:   "pg-dr.accra.payment-switch.svc",
	TargetPort:   5432,
	SlotName:     "payment_switch_slot",
	OutputPlugin: "pgoutput",
}

// --- Table Partitioning (#16) ---

type PartitionConfig struct {
	TableName     string `json:"table_name"`
	PartitionKey  string `json:"partition_key"`
	PartitionType string `json:"partition_type"` // RANGE, LIST, HASH
	Interval      string `json:"interval"`       // MONTH, WEEK, DAY
	RetentionDays int    `json:"retention_days"`
	HotDays       int    `json:"hot_days"`
	WarmDays      int    `json:"warm_days"`
}

var PartitionConfigs = []PartitionConfig{
	{TableName: "transactions", PartitionKey: "created_at", PartitionType: "RANGE", Interval: "MONTH", RetentionDays: 2555, HotDays: 90, WarmDays: 365},
	{TableName: "audit_logs", PartitionKey: "logged_at", PartitionType: "RANGE", Interval: "MONTH", RetentionDays: 2555, HotDays: 90, WarmDays: 365},
	{TableName: "fraud_alerts", PartitionKey: "detected_at", PartitionType: "RANGE", Interval: "MONTH", RetentionDays: 1825, HotDays: 180, WarmDays: 365},
	{TableName: "settlement_entries", PartitionKey: "settlement_date", PartitionType: "RANGE", Interval: "MONTH", RetentionDays: 2555, HotDays: 90, WarmDays: 365},
	{TableName: "remittance_transfers", PartitionKey: "initiated_at", PartitionType: "RANGE", Interval: "MONTH", RetentionDays: 2555, HotDays: 90, WarmDays: 365},
}

func GeneratePartitionSQL(config PartitionConfig) string {
	return fmt.Sprintf(`
-- Partition table %s by %s (%s)
ALTER TABLE %s RENAME TO %s_old;
CREATE TABLE %s (LIKE %s_old INCLUDING ALL) PARTITION BY RANGE (%s);

-- Create partitions for current and next 3 months
-- Hot data (last %d days) stays on fast NVMe storage
-- Warm data (%d-%d days) moves to standard SSD
-- Cold data (>%d days) archived to Lakehouse via pg_cron
`,
		config.TableName, config.PartitionKey, config.PartitionType,
		config.TableName, config.TableName,
		config.TableName, config.TableName, config.PartitionKey,
		config.HotDays, config.HotDays, config.WarmDays, config.WarmDays,
	)
}

// --- pg_cron Maintenance (#17) ---

type CronJob struct {
	Schedule    string `json:"schedule"`
	Command     string `json:"command"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

var MaintenanceCronJobs = []CronJob{
	{Schedule: "0 2 * * *", Command: "VACUUM ANALYZE transactions", Description: "Daily vacuum analyze on transactions", Enabled: true},
	{Schedule: "0 3 * * *", Command: "VACUUM ANALYZE audit_logs", Description: "Daily vacuum analyze on audit logs", Enabled: true},
	{Schedule: "0 4 * * 0", Command: "REINDEX DATABASE ndsep_db", Description: "Weekly reindex", Enabled: true},
	{Schedule: "0 1 1 * *", Command: "SELECT create_next_month_partitions()", Description: "Monthly partition creation", Enabled: true},
	{Schedule: "0 5 1 * *", Command: "SELECT detach_old_partitions(90)", Description: "Monthly old partition detach", Enabled: true},
	{Schedule: "*/15 * * * *", Command: "SELECT refresh_materialized_views()", Description: "Refresh materialized views every 15 min", Enabled: true},
	{Schedule: "0 */6 * * *", Command: "ANALYZE", Description: "Full database analyze every 6 hours", Enabled: true},
}

// --- TDE / Encryption at Rest (#18) ---

type TDEConfig struct {
	Enabled           bool   `json:"enabled"`
	Provider          string `json:"provider"` // "file", "aws-kms", "hashicorp-vault"
	KeyID             string `json:"key_id"`
	Algorithm         string `json:"algorithm"`
	RotationDays      int    `json:"rotation_days"`
	TablespaceEncrypt bool   `json:"tablespace_encrypt"`
	WALEncrypt        bool   `json:"wal_encrypt"`
	TempFileEncrypt   bool   `json:"temp_file_encrypt"`
}

var DefaultTDEConfig = TDEConfig{
	Enabled:           true,
	Provider:          "aws-kms",
	KeyID:             "arn:aws:kms:af-south-1:ACCOUNT:key/KEY_ID",
	Algorithm:         "AES-256-GCM",
	RotationDays:      90,
	TablespaceEncrypt: true,
	WALEncrypt:        true,
	TempFileEncrypt:   true,
}

// --- Connection Pool Stats ---

type PoolStats struct {
	Service       string    `json:"service"`
	ActiveConns   int       `json:"active_conns"`
	IdleConns     int       `json:"idle_conns"`
	WaitingConns  int       `json:"waiting_conns"`
	TotalConns    int       `json:"total_conns"`
	MaxConns      int       `json:"max_conns"`
	AvgQueryTimeMs float64  `json:"avg_query_time_ms"`
	QueriesPerSec  float64  `json:"queries_per_sec"`
	LastChecked   time.Time `json:"last_checked"`
}
