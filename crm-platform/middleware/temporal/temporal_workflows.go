package temporal

import (
	"time"
)

// Temporal workflow definitions for CRM platform —
// customer onboarding, KYC verification, dispute resolution,
// campaign orchestration, and compliance workflows

type WorkflowConfig struct {
	Namespace    string `json:"namespace"`
	TaskQueue    string `json:"task_queue"`
	Address      string `json:"address"`
	TLSCertPath  string `json:"tls_cert_path"`
	TLSKeyPath   string `json:"tls_key_path"`
}

func DefaultWorkflowConfig() *WorkflowConfig {
	return &WorkflowConfig{
		Namespace: "crm-platform",
		TaskQueue: "crm-tasks",
		Address:   "temporal.crm.svc:7233",
	}
}

// CustomerOnboardingWorkflow — 5-step onboarding with parallel KYC checks
type CustomerOnboardingInput struct {
	TenantID      string                 `json:"tenant_id"`
	CustomerID    string                 `json:"customer_id"`
	CustomerData  map[string]interface{} `json:"customer_data"`
	KYCLevel      int                    `json:"kyc_level"`
	Products      []string               `json:"products"`
	Channel       string                 `json:"channel"` // web, agent, ussd, mobile
}

type CustomerOnboardingOutput struct {
	CustomerID    string    `json:"customer_id"`
	AccountNumber string    `json:"account_number"`
	Status        string    `json:"status"`
	KYCStatus     string    `json:"kyc_status"`
	CompletedAt   time.Time `json:"completed_at"`
	ApprovedBy    string    `json:"approved_by"`
}

// KYCVerificationWorkflow — parallel BVN, NIN, address, PEP, sanctions checks
type KYCVerificationInput struct {
	TenantID    string `json:"tenant_id"`
	CustomerID  string `json:"customer_id"`
	BVN         string `json:"bvn"`
	NIN         string `json:"nin"`
	FullName    string `json:"full_name"`
	DateOfBirth string `json:"date_of_birth"`
	Address     string `json:"address"`
	Photo       string `json:"photo_url"`
	Level       int    `json:"level"` // 1, 2, or 3
}

type KYCVerificationOutput struct {
	CustomerID       string    `json:"customer_id"`
	BVNVerified      bool      `json:"bvn_verified"`
	NINVerified      bool      `json:"nin_verified"`
	AddressVerified  bool      `json:"address_verified"`
	PEPMatch         bool      `json:"pep_match"`
	SanctionsMatch   bool      `json:"sanctions_match"`
	OverallStatus    string    `json:"overall_status"`
	RiskScore        float64   `json:"risk_score"`
	CompletedAt      time.Time `json:"completed_at"`
}

// DisputeResolutionWorkflow — automated dispute handling with escalation
type DisputeResolutionInput struct {
	TenantID      string  `json:"tenant_id"`
	DisputeID     string  `json:"dispute_id"`
	TransactionID string  `json:"transaction_id"`
	CustomerID    string  `json:"customer_id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	Reason        string  `json:"reason"`
	Category      string  `json:"category"` // unauthorized, duplicate, service_not_received, defective
}

type DisputeResolutionOutput struct {
	DisputeID    string    `json:"dispute_id"`
	Resolution   string    `json:"resolution"` // refunded, rejected, escalated, partial_refund
	RefundAmount float64   `json:"refund_amount"`
	ResolvedBy   string    `json:"resolved_by"`
	ResolvedAt   time.Time `json:"resolved_at"`
	Notes        string    `json:"notes"`
}

// CampaignOrchestrationWorkflow — multi-step campaign execution
type CampaignOrchestrationInput struct {
	TenantID       string    `json:"tenant_id"`
	CampaignID     string    `json:"campaign_id"`
	AudienceQuery  string    `json:"audience_query"`
	Channels       []string  `json:"channels"` // sms, whatsapp, email, voice, push
	ScheduledAt    time.Time `json:"scheduled_at"`
	ABTestEnabled  bool      `json:"ab_test_enabled"`
	ABTestVariants int       `json:"ab_test_variants"`
}

type CampaignOrchestrationOutput struct {
	CampaignID      string    `json:"campaign_id"`
	TotalRecipients int       `json:"total_recipients"`
	Delivered       int       `json:"delivered"`
	Failed          int       `json:"failed"`
	Opened          int       `json:"opened"`
	Clicked         int       `json:"clicked"`
	Converted       int       `json:"converted"`
	CompletedAt     time.Time `json:"completed_at"`
}

// LoanApprovalWorkflow — multi-tier loan approval with risk scoring
type LoanApprovalInput struct {
	TenantID    string  `json:"tenant_id"`
	CustomerID  string  `json:"customer_id"`
	LoanAmount  float64 `json:"loan_amount"`
	LoanTerm    int     `json:"loan_term_months"`
	LoanType    string  `json:"loan_type"` // personal, business, mortgage, microfinance
	Collateral  float64 `json:"collateral_value"`
	Income      float64 `json:"monthly_income"`
}

type LoanApprovalOutput struct {
	LoanID         string    `json:"loan_id"`
	Status         string    `json:"status"` // approved, rejected, conditional
	ApprovedAmount float64   `json:"approved_amount"`
	InterestRate   float64   `json:"interest_rate"`
	RiskScore      float64   `json:"risk_score"`
	ApprovedBy     string    `json:"approved_by"`
	Conditions     []string  `json:"conditions"`
	DecidedAt      time.Time `json:"decided_at"`
}

// ComplianceCheckWorkflow — periodic compliance assessment
type ComplianceCheckInput struct {
	TenantID    string   `json:"tenant_id"`
	Framework   string   `json:"framework"` // ndpr, cbn, pci_dss, aml_cft
	Scope       string   `json:"scope"`     // full, incremental
	TriggeredBy string   `json:"triggered_by"`
}

type ComplianceCheckOutput struct {
	ReportID         string    `json:"report_id"`
	Framework        string    `json:"framework"`
	OverallScore     float64   `json:"overall_score"`
	Status           string    `json:"status"`
	FindingsCount    int       `json:"findings_count"`
	CriticalFindings int       `json:"critical_findings"`
	CompletedAt      time.Time `json:"completed_at"`
}

// WorkflowRegistry holds all registered workflow definitions
type WorkflowDefinition struct {
	Name            string        `json:"name"`
	TaskQueue       string        `json:"task_queue"`
	Timeout         time.Duration `json:"timeout"`
	RetryPolicy     RetryPolicy   `json:"retry_policy"`
	CronSchedule    string        `json:"cron_schedule,omitempty"`
	Description     string        `json:"description"`
}

type RetryPolicy struct {
	MaxRetries          int           `json:"max_retries"`
	InitialInterval     time.Duration `json:"initial_interval"`
	BackoffCoefficient  float64       `json:"backoff_coefficient"`
	MaxInterval         time.Duration `json:"max_interval"`
}

func CRMWorkflows() []WorkflowDefinition {
	return []WorkflowDefinition{
		{
			Name: "CustomerOnboarding", TaskQueue: "crm-onboarding",
			Timeout: 72 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 3, InitialInterval: time.Minute, BackoffCoefficient: 2.0, MaxInterval: time.Hour},
			Description: "5-step customer onboarding with KYC, account creation, and product provisioning",
		},
		{
			Name: "KYCVerification", TaskQueue: "crm-kyc",
			Timeout: 48 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 5, InitialInterval: 30 * time.Second, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
			Description: "Parallel BVN/NIN/address/PEP/sanctions verification",
		},
		{
			Name: "DisputeResolution", TaskQueue: "crm-disputes",
			Timeout: 30 * 24 * time.Hour, // 30 days per CBN guideline
			RetryPolicy: RetryPolicy{MaxRetries: 3, InitialInterval: 5 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: time.Hour},
			Description: "Dispute handling with auto-resolution, escalation, and refund processing",
		},
		{
			Name: "CampaignOrchestration", TaskQueue: "crm-campaigns",
			Timeout: 7 * 24 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 3, InitialInterval: time.Minute, BackoffCoefficient: 2.0, MaxInterval: time.Hour},
			Description: "Multi-channel campaign execution with A/B testing and analytics",
		},
		{
			Name: "LoanApproval", TaskQueue: "crm-loans",
			Timeout: 5 * 24 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 3, InitialInterval: time.Minute, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
			Description: "Multi-tier loan approval with credit scoring, risk assessment, and collateral evaluation",
		},
		{
			Name: "ComplianceCheck", TaskQueue: "crm-compliance",
			Timeout: 24 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 2, InitialInterval: 5 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: time.Hour},
			CronSchedule: "0 0 1 * *", // Monthly
			Description: "Automated compliance assessment against NDPR, CBN, PCI-DSS, and AML/CFT frameworks",
		},
		{
			Name: "DataRetentionPurge", TaskQueue: "crm-maintenance",
			Timeout: 6 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 2, InitialInterval: 10 * time.Minute, BackoffCoefficient: 2.0, MaxInterval: time.Hour},
			CronSchedule: "0 2 * * 0", // Weekly Sunday 2am
			Description: "Automated data retention enforcement and secure data purging",
		},
		{
			Name: "AgentReconciliation", TaskQueue: "crm-agent-banking",
			Timeout: 4 * time.Hour,
			RetryPolicy: RetryPolicy{MaxRetries: 3, InitialInterval: time.Minute, BackoffCoefficient: 2.0, MaxInterval: 30 * time.Minute},
			CronSchedule: "0 23 * * *", // Daily 11pm
			Description: "End-of-day agent banking reconciliation and float management",
		},
	}
}
