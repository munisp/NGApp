package dapr

import (
	"time"
)

// --- Service Invocation for All Services (#39) ---

type DaprSidecarConfig struct {
	AppID                 string `json:"app_id"`
	AppPort               int    `json:"app_port"`
	AppProtocol           string `json:"app_protocol"` // http, grpc
	HTTPMaxRequestSize    int    `json:"http_max_request_size_mb"`
	GracefulShutdownSec   int    `json:"graceful_shutdown_sec"`
	MetricsPort           int    `json:"metrics_port"`
	EnableProfiling       bool   `json:"enable_profiling"`
	LogLevel              string `json:"log_level"`
	EnableMTLS            bool   `json:"enable_mtls"`
	SentryAddress         string `json:"sentry_address"`
}

var ServiceSidecars = []DaprSidecarConfig{
	{AppID: "go-ledger", AppPort: 8080, AppProtocol: "grpc", HTTPMaxRequestSize: 16, GracefulShutdownSec: 30, MetricsPort: 9090, EnableMTLS: true, LogLevel: "info"},
	{AppID: "fraud-detection", AppPort: 8081, AppProtocol: "http", HTTPMaxRequestSize: 4, GracefulShutdownSec: 15, MetricsPort: 9091, EnableMTLS: true, LogLevel: "info"},
	{AppID: "settlement-engine", AppPort: 8082, AppProtocol: "grpc", HTTPMaxRequestSize: 32, GracefulShutdownSec: 60, MetricsPort: 9092, EnableMTLS: true, LogLevel: "info"},
	{AppID: "data-pipeline", AppPort: 8083, AppProtocol: "http", HTTPMaxRequestSize: 64, GracefulShutdownSec: 30, MetricsPort: 9093, EnableMTLS: true, LogLevel: "info"},
	{AppID: "compliance-engine", AppPort: 8084, AppProtocol: "http", HTTPMaxRequestSize: 8, GracefulShutdownSec: 15, MetricsPort: 9094, EnableMTLS: true, LogLevel: "info"},
	{AppID: "remittance-engine", AppPort: 8085, AppProtocol: "grpc", HTTPMaxRequestSize: 16, GracefulShutdownSec: 30, MetricsPort: 9095, EnableMTLS: true, LogLevel: "info"},
	{AppID: "ai-ml-services", AppPort: 8086, AppProtocol: "http", HTTPMaxRequestSize: 32, GracefulShutdownSec: 60, MetricsPort: 9096, EnableMTLS: true, LogLevel: "info"},
	{AppID: "web-portal", AppPort: 3000, AppProtocol: "http", HTTPMaxRequestSize: 4, GracefulShutdownSec: 10, MetricsPort: 9097, EnableMTLS: true, LogLevel: "warn"},
}

// --- Distributed Lock (#40) ---

type DistributedLockConfig struct {
	LockStore    string        `json:"lock_store"` // redis, etcd, consul
	ResourceID   string        `json:"resource_id"`
	Owner        string        `json:"owner"`
	ExpiryInSec  int           `json:"expiry_in_sec"`
}

type LockableResource struct {
	ResourceID   string `json:"resource_id"`
	Description  string `json:"description"`
	MaxHoldSec   int    `json:"max_hold_sec"`
	RetryCount   int    `json:"retry_count"`
	RetryDelaySec int   `json:"retry_delay_sec"`
}

var LockableResources = []LockableResource{
	{ResourceID: "settlement-batch-{date}", Description: "Lock for daily settlement batch processing", MaxHoldSec: 600, RetryCount: 5, RetryDelaySec: 10},
	{ResourceID: "neft-clearing-{window}", Description: "Lock for NEFT clearing window processing", MaxHoldSec: 300, RetryCount: 3, RetryDelaySec: 5},
	{ResourceID: "sanctions-list-refresh", Description: "Lock for sanctions list refresh (prevent duplicate refresh)", MaxHoldSec: 3600, RetryCount: 1, RetryDelaySec: 60},
	{ResourceID: "cbn-report-{type}-{date}", Description: "Lock for CBN report generation", MaxHoldSec: 1800, RetryCount: 2, RetryDelaySec: 30},
	{ResourceID: "prophet-retrain", Description: "Lock for Prophet model retraining", MaxHoldSec: 7200, RetryCount: 1, RetryDelaySec: 300},
	{ResourceID: "tigerbeetle-backup", Description: "Lock for TigerBeetle snapshot", MaxHoldSec: 3600, RetryCount: 1, RetryDelaySec: 120},
}

// --- Configuration Store (#41) ---

type DaprConfigItem struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Mutable     bool   `json:"mutable"`
}

var FeatureFlags = []DaprConfigItem{
	{Key: "feature.nip.enabled", Value: "true", Version: "1", Description: "Enable NIP instant payments", Mutable: true},
	{Key: "feature.neft.enabled", Value: "true", Version: "1", Description: "Enable NEFT batch transfers", Mutable: true},
	{Key: "feature.nacs.enabled", Value: "true", Version: "1", Description: "Enable NACS cheque clearing", Mutable: true},
	{Key: "feature.ndd.enabled", Value: "true", Version: "1", Description: "Enable NDD direct debit", Mutable: true},
	{Key: "feature.outbound_remittance.enabled", Value: "true", Version: "1", Description: "Enable outbound remittance", Mutable: true},
	{Key: "feature.inbound_remittance.enabled", Value: "true", Version: "1", Description: "Enable inbound remittance", Mutable: true},
	{Key: "feature.open_banking.enabled", Value: "true", Version: "1", Description: "Enable Open Banking APIs", Mutable: true},
	{Key: "feature.smart_routing.enabled", Value: "false", Version: "1", Description: "Enable smart payment routing (beta)", Mutable: true},
	{Key: "feature.ai_fraud.enabled", Value: "true", Version: "1", Description: "Enable AI-powered fraud detection", Mutable: true},
	{Key: "feature.gnn_network_detection.enabled", Value: "false", Version: "1", Description: "Enable GNN mule network detection (beta)", Mutable: true},
	{Key: "config.nip.rate_limit", Value: "5000", Version: "1", Description: "NIP rate limit per second", Mutable: true},
	{Key: "config.salary_day_multiplier", Value: "3", Version: "1", Description: "Rate limit multiplier on salary days (25th-28th)", Mutable: true},
}

// --- External Bindings (#42) ---

type DaprBinding struct {
	Name        string            `json:"name"`
	Type        string            `json:"type"` // input, output
	Component   string            `json:"component"` // http, smtp, cron, aws.s3
	Metadata    map[string]string `json:"metadata"`
	Description string            `json:"description"`
}

var ExternalBindings = []DaprBinding{
	{Name: "nibss-nip-api", Type: "output", Component: "bindings.http", Metadata: map[string]string{"url": "https://api.nibss-plc.com.ng/nip/v2", "securityToken": "${NIBSS_API_KEY}"}, Description: "NIBSS NIP API for instant payments"},
	{Name: "nibss-neft-api", Type: "output", Component: "bindings.http", Metadata: map[string]string{"url": "https://api.nibss-plc.com.ng/neft/v1", "securityToken": "${NIBSS_API_KEY}"}, Description: "NIBSS NEFT API for batch transfers"},
	{Name: "swift-gpi-api", Type: "output", Component: "bindings.http", Metadata: map[string]string{"url": "https://sandbox.swift.com/gpi/v4", "securityToken": "${SWIFT_API_KEY}"}, Description: "SWIFT gpi API for cross-border payments"},
	{Name: "cbn-reporting-api", Type: "output", Component: "bindings.http", Metadata: map[string]string{"url": "https://reporting.cbn.gov.ng/api/v1", "securityToken": "${CBN_API_KEY}"}, Description: "CBN regulatory reporting endpoint"},
	{Name: "ofac-sdn-api", Type: "output", Component: "bindings.http", Metadata: map[string]string{"url": "https://api.ofac-api.com/v4", "securityToken": "${OFAC_API_KEY}"}, Description: "OFAC SDN sanctions screening"},
	{Name: "email-notifications", Type: "output", Component: "bindings.smtp", Metadata: map[string]string{"host": "smtp.payment-switch.ng", "port": "587"}, Description: "Email notifications for alerts and reports"},
	{Name: "s3-backup-store", Type: "output", Component: "bindings.aws.s3", Metadata: map[string]string{"bucket": "payment-switch-backups", "region": "af-south-1"}, Description: "S3 bucket for backups and archives"},
	{Name: "settlement-file-watcher", Type: "input", Component: "bindings.cron", Metadata: map[string]string{"schedule": "@every 5m"}, Description: "Watch for incoming settlement files"},
}

// --- Message TTL (#43) ---

type MessageTTLConfig struct {
	TopicName string        `json:"topic_name"`
	TTL       time.Duration `json:"ttl"`
	Description string      `json:"description"`
}

var MessageTTLs = []MessageTTLConfig{
	{TopicName: "nip-status-updates", TTL: 30 * time.Second, Description: "NIP real-time status updates expire after 30s (stale updates harmful)"},
	{TopicName: "fraud-score-requests", TTL: 5 * time.Second, Description: "Fraud scoring requests expire quickly (must be real-time)"},
	{TopicName: "settlement-notifications", TTL: 24 * time.Hour, Description: "Settlement notifications valid for 24h"},
	{TopicName: "compliance-alerts", TTL: 7 * 24 * time.Hour, Description: "Compliance alerts retained for 7 days"},
	{TopicName: "audit-events", TTL: 0, Description: "Audit events never expire (regulatory requirement)"},
	{TopicName: "rate-limit-updates", TTL: 60 * time.Second, Description: "Rate limit updates expire after 1 minute"},
	{TopicName: "health-checks", TTL: 10 * time.Second, Description: "Health check messages expire quickly"},
}
