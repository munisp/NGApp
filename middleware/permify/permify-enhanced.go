package permify

import (
	"sync/atomic"
	"time"
)

// --- Payment-Specific Schema (#60) ---

type PermifySchema struct {
	Version     string       `json:"version"`
	Entities    []Entity     `json:"entities"`
	Relations   []Relation   `json:"relations"`
	Permissions []Permission `json:"permissions"`
}

type Entity struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Relation struct {
	Entity      string   `json:"entity"`
	Relation    string   `json:"relation"`
	Types       []string `json:"types"`
	Description string   `json:"description"`
}

type Permission struct {
	Entity     string `json:"entity"`
	Permission string `json:"permission"`
	Rule       string `json:"rule"`
	Description string `json:"description"`
}

var PaymentSchema = PermifySchema{
	Version: "1.0.0",
	Entities: []Entity{
		{Name: "platform", Description: "NDSEP payment switch platform"},
		{Name: "bank", Description: "Participant bank (DMB, MMO)"},
		{Name: "branch", Description: "Bank branch"},
		{Name: "user", Description: "Platform user (operator, admin, compliance)"},
		{Name: "account", Description: "TigerBeetle/PostgreSQL account"},
		{Name: "transaction", Description: "Payment transaction (NIP, NEFT, etc.)"},
		{Name: "settlement", Description: "Settlement batch"},
		{Name: "report", Description: "Compliance/regulatory report"},
		{Name: "merchant", Description: "Registered merchant"},
		{Name: "corridor", Description: "Remittance corridor"},
	},
	Relations: []Relation{
		{Entity: "platform", Relation: "admin", Types: []string{"user"}, Description: "Platform administrators"},
		{Entity: "platform", Relation: "operator", Types: []string{"user"}, Description: "Platform operators"},
		{Entity: "bank", Relation: "member", Types: []string{"platform"}, Description: "Bank belongs to platform"},
		{Entity: "bank", Relation: "admin", Types: []string{"user"}, Description: "Bank administrators"},
		{Entity: "bank", Relation: "operator", Types: []string{"user"}, Description: "Bank operators"},
		{Entity: "bank", Relation: "compliance_officer", Types: []string{"user"}, Description: "Bank compliance officers"},
		{Entity: "branch", Relation: "parent", Types: []string{"bank"}, Description: "Branch belongs to bank"},
		{Entity: "branch", Relation: "manager", Types: []string{"user"}, Description: "Branch managers"},
		{Entity: "account", Relation: "owner", Types: []string{"bank", "merchant", "user"}, Description: "Account owner"},
		{Entity: "account", Relation: "viewer", Types: []string{"user"}, Description: "Can view account balance"},
		{Entity: "transaction", Relation: "initiator", Types: []string{"user"}, Description: "Transaction initiator"},
		{Entity: "transaction", Relation: "approver", Types: []string{"user"}, Description: "Transaction approver (maker-checker)"},
		{Entity: "transaction", Relation: "source_bank", Types: []string{"bank"}, Description: "Source bank"},
		{Entity: "settlement", Relation: "creator", Types: []string{"user"}, Description: "Settlement batch creator"},
		{Entity: "settlement", Relation: "approver", Types: []string{"user"}, Description: "Settlement approver"},
		{Entity: "report", Relation: "generator", Types: []string{"user"}, Description: "Report generator"},
		{Entity: "report", Relation: "reviewer", Types: []string{"user"}, Description: "Report reviewer"},
		{Entity: "merchant", Relation: "owner", Types: []string{"bank"}, Description: "Acquiring bank"},
		{Entity: "corridor", Relation: "manager", Types: []string{"user"}, Description: "Corridor manager"},
	},
	Permissions: []Permission{
		{Entity: "bank", Permission: "view", Rule: "admin or operator or compliance_officer or member.admin", Description: "View bank details"},
		{Entity: "bank", Permission: "manage", Rule: "admin or member.admin", Description: "Manage bank configuration"},
		{Entity: "account", Permission: "view_balance", Rule: "owner or viewer or owner.admin or owner.operator", Description: "View account balance"},
		{Entity: "account", Permission: "transfer", Rule: "owner or owner.admin", Description: "Initiate transfer from account"},
		{Entity: "transaction", Permission: "view", Rule: "initiator or approver or source_bank.admin or source_bank.operator or source_bank.compliance_officer", Description: "View transaction details"},
		{Entity: "transaction", Permission: "approve", Rule: "approver and not initiator", Description: "Approve transaction (cannot self-approve)"},
		{Entity: "settlement", Permission: "view", Rule: "creator or approver", Description: "View settlement batch"},
		{Entity: "settlement", Permission: "approve", Rule: "approver and not creator", Description: "Approve settlement (maker-checker)"},
		{Entity: "report", Permission: "view", Rule: "generator or reviewer", Description: "View compliance report"},
		{Entity: "report", Permission: "submit", Rule: "reviewer", Description: "Submit report to CBN"},
	},
}

// --- Bulk Permission Check (#61) ---

type BulkCheckRequest struct {
	Checks []PermissionCheck `json:"checks"`
}

type PermissionCheck struct {
	Entity     string `json:"entity"`
	EntityID   string `json:"entity_id"`
	Permission string `json:"permission"`
	SubjectType string `json:"subject_type"`
	SubjectID   string `json:"subject_id"`
}

type BulkCheckResult struct {
	Results    []CheckResult `json:"results"`
	TotalMs    int64         `json:"total_ms"`
	CheckCount int           `json:"check_count"`
	AllowCount int           `json:"allow_count"`
	DenyCount  int           `json:"deny_count"`
}

type CheckResult struct {
	Allowed  bool   `json:"allowed"`
	EntityID string `json:"entity_id"`
	Reason   string `json:"reason,omitempty"`
}

type BulkChecker struct {
	batchSize     int
	totalChecks   atomic.Int64
	totalAllowed  atomic.Int64
	totalDenied   atomic.Int64
	avgLatencyMs  atomic.Int64
}

func NewBulkChecker(batchSize int) *BulkChecker {
	return &BulkChecker{batchSize: batchSize}
}

func (bc *BulkChecker) GetStats() map[string]int64 {
	return map[string]int64{
		"total_checks":   bc.totalChecks.Load(),
		"total_allowed":  bc.totalAllowed.Load(),
		"total_denied":   bc.totalDenied.Load(),
		"avg_latency_ms": bc.avgLatencyMs.Load(),
	}
}

// --- Audit Log Integration (#62) ---

type PermifyAuditLog struct {
	ID            string    `json:"id"`
	Timestamp     time.Time `json:"timestamp"`
	CheckType     string    `json:"check_type"` // permission, relation, lookup
	Entity        string    `json:"entity"`
	EntityID      string    `json:"entity_id"`
	Permission    string    `json:"permission"`
	SubjectType   string    `json:"subject_type"`
	SubjectID     string    `json:"subject_id"`
	Decision      string    `json:"decision"` // ALLOW, DENY
	LatencyMs     int64     `json:"latency_ms"`
	TraceID       string    `json:"trace_id"`
	ClientIP      string    `json:"client_ip"`
	UserAgent     string    `json:"user_agent"`
}

type AuditLogConfig struct {
	Enabled          bool   `json:"enabled"`
	IndexName        string `json:"index_name"`
	OpenSearchHost   string `json:"opensearch_host"`
	BatchSize        int    `json:"batch_size"`
	FlushIntervalSec int    `json:"flush_interval_sec"`
	RetentionDays    int    `json:"retention_days"`
}

var DefaultAuditLogConfig = AuditLogConfig{
	Enabled:          true,
	IndexName:        "permify-audit-logs",
	OpenSearchHost:   "opensearch.payment-switch.svc:9200",
	BatchSize:        500,
	FlushIntervalSec: 5,
	RetentionDays:    2555, // 7 years per CBN requirement
}
