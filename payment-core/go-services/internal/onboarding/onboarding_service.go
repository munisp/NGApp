// Package onboarding provides comprehensive stakeholder onboarding for the payment switch
package onboarding

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// StakeholderType represents the type of stakeholder being onboarded
type StakeholderType string

const (
	StakeholderBank          StakeholderType = "BANK"
	StakeholderMobileMoneyOp StakeholderType = "MOBILE_MONEY_OPERATOR"
	StakeholderFintech       StakeholderType = "FINTECH"
	StakeholderMFI           StakeholderType = "MICROFINANCE_INSTITUTION"
	StakeholderGovernment    StakeholderType = "GOVERNMENT_AGENCY"
	StakeholderMerchant      StakeholderType = "MERCHANT"
	StakeholderRegulator     StakeholderType = "REGULATOR"
	StakeholderNOCOperator   StakeholderType = "NOC_OPERATOR"
	StakeholderDeveloper     StakeholderType = "DEVELOPER"
)

// OnboardingStatus represents the status of an onboarding case
type OnboardingStatus string

const (
	StatusDraft              OnboardingStatus = "DRAFT"
	StatusSubmitted          OnboardingStatus = "SUBMITTED"
	StatusDueDiligence       OnboardingStatus = "DUE_DILIGENCE"
	StatusTechnicalSetup     OnboardingStatus = "TECHNICAL_SETUP"
	StatusSandboxCertified   OnboardingStatus = "SANDBOX_CERTIFIED"
	StatusOperationalReady   OnboardingStatus = "OPERATIONAL_READINESS"
	StatusGovernanceApproval OnboardingStatus = "GOVERNANCE_APPROVAL"
	StatusProdProvisioned    OnboardingStatus = "PRODUCTION_PROVISIONED"
	StatusProdCertified      OnboardingStatus = "PRODUCTION_CERTIFIED"
	StatusActive             OnboardingStatus = "ACTIVE"
	StatusSuspended          OnboardingStatus = "SUSPENDED"
	StatusRejected           OnboardingStatus = "REJECTED"
	StatusOffboarded         OnboardingStatus = "OFFBOARDED"
	StatusReworkRequested    OnboardingStatus = "REWORK_REQUESTED"
)

// OnboardingService manages stakeholder onboarding
type OnboardingService struct {
	cases        map[string]*OnboardingCase
	casesMu      sync.RWMutex
	templates    map[StakeholderType]*OnboardingTemplate
	approvers    map[string]*Approver
	eventEmitter EventEmitter
}

// OnboardingCase represents an onboarding case for a stakeholder
type OnboardingCase struct {
	ID               string           `json:"id"`
	OrganizationID   string           `json:"organization_id"`
	OrganizationName string           `json:"organization_name"`
	StakeholderType  StakeholderType  `json:"stakeholder_type"`
	Status           OnboardingStatus `json:"status"`
	Jurisdiction     string           `json:"jurisdiction"`
	Country          string           `json:"country"`
	ContactEmail     string           `json:"contact_email"`
	AssignedReviewer string           `json:"assigned_reviewer,omitempty"`
	RiskScore        float64          `json:"risk_score"`

	// Contact Information
	PrimaryContact    ContactInfo `json:"primary_contact"`
	TechnicalContact  ContactInfo `json:"technical_contact"`
	ComplianceContact ContactInfo `json:"compliance_contact"`

	// Requirements & Evidence
	Requirements []Requirement  `json:"requirements"`
	Evidence     []EvidenceItem `json:"evidence"`

	// Technical Profile
	TechnicalProfile *TechnicalProfile `json:"technical_profile,omitempty"`

	// Certification
	CertificationRuns []CertificationRun `json:"certification_runs"`

	// Approvals
	Approvals []Approval `json:"approvals"`

	// Provisioning
	SandboxResources    *ProvisionedResources `json:"sandbox_resources,omitempty"`
	ProductionResources *ProvisionedResources `json:"production_resources,omitempty"`

	// Audit Trail
	StatusHistory []StatusChange `json:"status_history"`
	Notes         []CaseNote     `json:"notes"`

	// Timestamps
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`

	// Metadata
	Metadata map[string]interface{} `json:"metadata"`
}

// ContactInfo represents contact information
type ContactInfo struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Phone      string `json:"phone"`
	Title      string `json:"title"`
	Department string `json:"department,omitempty"`
}

// Requirement represents an onboarding requirement
type Requirement struct {
	ID          string     `json:"id"`
	CaseID      string     `json:"case_id"`
	Category    string     `json:"category"` // DOCUMENT, ATTESTATION, TECHNICAL, OPERATIONAL
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Required    bool       `json:"required"`
	Mandatory   bool       `json:"mandatory"`
	Status      string     `json:"status"` // PENDING, SUBMITTED, APPROVED, REJECTED
	DueDate     *time.Time `json:"due_date,omitempty"`
	EvidenceIDs []string   `json:"evidence_ids"`
	ReviewedBy  string     `json:"reviewed_by,omitempty"`
	ReviewedAt  *time.Time `json:"reviewed_at,omitempty"`
	ReviewNotes string     `json:"review_notes,omitempty"`
	Notes       string     `json:"notes,omitempty"`
}

// EvidenceItem represents uploaded evidence/documents
type EvidenceItem struct {
	ID            string                 `json:"id"`
	RequirementID string                 `json:"requirement_id"`
	Type          string                 `json:"type"` // DOCUMENT, LINK, ATTESTATION, QUESTIONNAIRE
	Name          string                 `json:"name"`
	Description   string                 `json:"description,omitempty"`
	FileURL       string                 `json:"file_url,omitempty"`
	FileHash      string                 `json:"file_hash,omitempty"`
	MimeType      string                 `json:"mime_type,omitempty"`
	Size          int64                  `json:"size,omitempty"`
	UploadedBy    string                 `json:"uploaded_by"`
	UploadedAt    time.Time              `json:"uploaded_at"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// TechnicalProfile represents technical integration details
type TechnicalProfile struct {
	CaseID string `json:"case_id"`

	// Organization Info (for KYB/KYC triggering)
	OrganizationName   string          `json:"organization_name"`
	RegistrationNumber string          `json:"registration_number"`
	Country            string          `json:"country"`
	KeyPersonnel       []KeyPersonInfo `json:"key_personnel,omitempty"`

	// Endpoints
	BaseURL        string `json:"base_url"`
	APIEndpoint    string `json:"api_endpoint"`
	CallbackURL    string `json:"callback_url"`
	WebhookURL     string `json:"webhook_url,omitempty"`
	HealthEndpoint string `json:"health_endpoint"`

	// Security
	MTLSEnabled     bool     `json:"mtls_enabled"`
	MTLSCert        string   `json:"mtls_cert,omitempty"`
	CertFingerprint string   `json:"cert_fingerprint,omitempty"`
	JWKSURL         string   `json:"jwks_url,omitempty"`
	AllowedIPs      []string `json:"allowed_ips,omitempty"`
	IPWhitelist     []string `json:"ip_whitelist,omitempty"`

	// API Configuration
	APIKeyID           string `json:"api_key_id,omitempty"`
	SandboxClientID    string `json:"sandbox_client_id,omitempty"`
	ProductionClientID string `json:"production_client_id,omitempty"`
	RateLimitTPS       int    `json:"rate_limit_tps"`

	// Capabilities
	SupportedCurrencies    []string `json:"supported_currencies"`
	SupportedTransferTypes []string `json:"supported_transfer_types"`

	// Validation Status
	ConnectivityValidated bool `json:"connectivity_validated"`
	SecurityValidated     bool `json:"security_validated"`
	PerformanceValidated  bool `json:"performance_validated"`

	ValidatedAt *time.Time `json:"validated_at,omitempty"`
}

// KeyPersonInfo represents a key person in the organization for KYC
type KeyPersonInfo struct {
	Name  string `json:"name"`
	Role  string `json:"role"` // DIRECTOR, UBO, SIGNATORY
	Email string `json:"email"`
}

// CertificationRun represents a certification test run
type CertificationRun struct {
	ID            string     `json:"id"`
	Environment   string     `json:"environment"` // SANDBOX, PRODUCTION
	Level         string     `json:"level"`       // BASIC, STANDARD, ADVANCED
	Status        string     `json:"status"`      // PENDING, RUNNING, PASSED, FAILED
	StartedAt     time.Time  `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	TotalTests    int        `json:"total_tests"`
	PassedTests   int        `json:"passed_tests"`
	FailedTests   int        `json:"failed_tests"`
	PassRate      float64    `json:"pass_rate"`
	CertificateID string     `json:"certificate_id,omitempty"`
	ReportURL     string     `json:"report_url,omitempty"`
}

// Approval represents an approval decision
type Approval struct {
	ID           string    `json:"id"`
	Step         string    `json:"step"` // DUE_DILIGENCE, SECURITY, RISK, OPERATIONS, GOVERNANCE
	ApproverRole string    `json:"approver_role"`
	ApproverID   string    `json:"approver_id"`
	ApproverName string    `json:"approver_name"`
	Decision     string    `json:"decision"` // APPROVED, REJECTED, REWORK_REQUESTED
	Notes        string    `json:"notes,omitempty"`
	DecidedAt    time.Time `json:"decided_at"`
	Conditions   []string  `json:"conditions,omitempty"`
}

// ProvisionedResources represents provisioned resources
type ProvisionedResources struct {
	Environment      string         `json:"environment"`
	ParticipantID    string         `json:"participant_id"`
	FSPID            string         `json:"fsp_id"`
	LedgerAccountID  string         `json:"ledger_account_id"`
	APIKeyID         string         `json:"api_key_id"`
	APIKeySecret     string         `json:"api_key_secret,omitempty"` // Only shown once
	CertificateID    string         `json:"certificate_id,omitempty"`
	APISIXRouteID    string         `json:"apisix_route_id"`
	KeycloakClientID string         `json:"keycloak_client_id"`
	ProvisionedAt    time.Time      `json:"provisioned_at"`
	Limits           ResourceLimits `json:"limits"`
}

// ResourceLimits represents resource limits
type ResourceLimits struct {
	MaxTPS                 int     `json:"max_tps"`
	DailyTransactionLimit  float64 `json:"daily_transaction_limit"`
	SingleTransactionLimit float64 `json:"single_transaction_limit"`
	NetDebitCap            float64 `json:"net_debit_cap"`
}

// StatusChange represents a status change in the audit trail
type StatusChange struct {
	FromStatus OnboardingStatus `json:"from_status"`
	ToStatus   OnboardingStatus `json:"to_status"`
	ChangedBy  string           `json:"changed_by"`
	ChangedAt  time.Time        `json:"changed_at"`
	Reason     string           `json:"reason,omitempty"`
}

// CaseNote represents a note on the case
type CaseNote struct {
	ID         string    `json:"id"`
	AuthorID   string    `json:"author_id"`
	AuthorName string    `json:"author_name"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
	Internal   bool      `json:"internal"` // Internal notes not visible to applicant
}

// OnboardingTemplate defines requirements for a stakeholder type
type OnboardingTemplate struct {
	StakeholderType    StakeholderType       `json:"stakeholder_type"`
	Name               string                `json:"name"`
	Description        string                `json:"description"`
	Requirements       []RequirementTemplate `json:"requirements"`
	ApprovalSteps      []ApprovalStep        `json:"approval_steps"`
	CertificationLevel string                `json:"certification_level"`
	EstimatedDays      int                   `json:"estimated_days"`
}

// RequirementTemplate defines a requirement template
type RequirementTemplate struct {
	ID          string `json:"id"`
	Category    string `json:"category"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
	DueDays     int    `json:"due_days"` // Days from submission
}

// ApprovalStep defines an approval step
type ApprovalStep struct {
	Step          string   `json:"step"`
	Name          string   `json:"name"`
	Description   string   `json:"description"`
	ApproverRoles []string `json:"approver_roles"`
	DualApproval  bool     `json:"dual_approval"`
	Order         int      `json:"order"`
}

// Approver represents an approver
type Approver struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Email string   `json:"email"`
	Roles []string `json:"roles"`
}

// EventEmitter interface for emitting domain events
type EventEmitter interface {
	Emit(ctx context.Context, event interface{}) error
}

// NewOnboardingService creates a new onboarding service
func NewOnboardingService(emitter EventEmitter) *OnboardingService {
	svc := &OnboardingService{
		cases:        make(map[string]*OnboardingCase),
		templates:    make(map[StakeholderType]*OnboardingTemplate),
		approvers:    make(map[string]*Approver),
		eventEmitter: emitter,
	}

	// Register default templates
	svc.registerDefaultTemplates()

	return svc
}

// registerDefaultTemplates registers onboarding templates for each stakeholder type
func (s *OnboardingService) registerDefaultTemplates() {
	// Bank template
	s.templates[StakeholderBank] = &OnboardingTemplate{
		StakeholderType:    StakeholderBank,
		Name:               "Bank Onboarding",
		Description:        "Full onboarding process for licensed banks",
		CertificationLevel: "ADVANCED",
		EstimatedDays:      30,
		Requirements: []RequirementTemplate{
			// Legal & Compliance Documents
			{ID: "bank-doc-001", Category: "DOCUMENT", Name: "Certificate of Incorporation", Description: "Official certificate of incorporation", Required: true, DueDays: 7},
			{ID: "bank-doc-002", Category: "DOCUMENT", Name: "Banking License", Description: "Valid banking license from central bank", Required: true, DueDays: 7},
			{ID: "bank-doc-003", Category: "DOCUMENT", Name: "Beneficial Ownership Declaration", Description: "Declaration of beneficial owners (>10% stake)", Required: true, DueDays: 7},
			{ID: "bank-doc-004", Category: "DOCUMENT", Name: "Board Resolution", Description: "Board resolution authorizing participation", Required: true, DueDays: 7},
			{ID: "bank-doc-005", Category: "DOCUMENT", Name: "AML/CFT Policy", Description: "Anti-money laundering and counter-terrorism financing policy", Required: true, DueDays: 14},
			{ID: "bank-doc-006", Category: "DOCUMENT", Name: "Data Protection Policy", Description: "Data protection and privacy policy", Required: true, DueDays: 14},
			{ID: "bank-doc-007", Category: "DOCUMENT", Name: "Financial Statements", Description: "Audited financial statements (last 2 years)", Required: true, DueDays: 14},
			{ID: "bank-doc-008", Category: "DOCUMENT", Name: "Settlement Collateral Proof", Description: "Proof of settlement collateral/guarantee", Required: true, DueDays: 14},
			// Security & Technical
			{ID: "bank-sec-001", Category: "ATTESTATION", Name: "Security Attestation", Description: "SOC2/ISO27001 certification or security questionnaire", Required: true, DueDays: 14},
			{ID: "bank-sec-002", Category: "TECHNICAL", Name: "mTLS Certificate", Description: "Valid mTLS certificate for API communication", Required: true, DueDays: 21},
			{ID: "bank-sec-003", Category: "TECHNICAL", Name: "API Endpoint Registration", Description: "Register API endpoints and callback URLs", Required: true, DueDays: 21},
			// Operational
			{ID: "bank-ops-001", Category: "OPERATIONAL", Name: "Incident Response Plan", Description: "Documented incident response procedures", Required: true, DueDays: 21},
			{ID: "bank-ops-002", Category: "OPERATIONAL", Name: "24/7 Contact List", Description: "Emergency contact list for 24/7 support", Required: true, DueDays: 21},
			{ID: "bank-ops-003", Category: "OPERATIONAL", Name: "Disaster Recovery Plan", Description: "Business continuity and DR plan", Required: true, DueDays: 21},
			// Agreement
			{ID: "bank-agr-001", Category: "DOCUMENT", Name: "Participation Agreement", Description: "Signed participation agreement", Required: true, DueDays: 28},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Due Diligence Review", Description: "Legal and compliance document review", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, DualApproval: false, Order: 1},
			{Step: "SECURITY", Name: "Security Review", Description: "Technical security assessment", ApproverRoles: []string{"SECURITY_OFFICER"}, DualApproval: false, Order: 2},
			{Step: "RISK", Name: "Risk Assessment", Description: "Risk and limits assessment", ApproverRoles: []string{"RISK_OFFICER"}, DualApproval: false, Order: 3},
			{Step: "OPERATIONS", Name: "Operational Readiness", Description: "Operational readiness verification", ApproverRoles: []string{"OPERATIONS_MANAGER"}, DualApproval: false, Order: 4},
			{Step: "GOVERNANCE", Name: "Final Governance Approval", Description: "Final approval for production access", ApproverRoles: []string{"COMPLIANCE_OFFICER", "OPERATIONS_MANAGER"}, DualApproval: true, Order: 5},
		},
	}

	// Mobile Money Operator template
	s.templates[StakeholderMobileMoneyOp] = &OnboardingTemplate{
		StakeholderType:    StakeholderMobileMoneyOp,
		Name:               "Mobile Money Operator Onboarding",
		Description:        "Onboarding process for mobile money operators",
		CertificationLevel: "ADVANCED",
		EstimatedDays:      30,
		Requirements: []RequirementTemplate{
			{ID: "mmo-doc-001", Category: "DOCUMENT", Name: "Certificate of Incorporation", Description: "Official certificate of incorporation", Required: true, DueDays: 7},
			{ID: "mmo-doc-002", Category: "DOCUMENT", Name: "Mobile Money License", Description: "Valid mobile money operator license", Required: true, DueDays: 7},
			{ID: "mmo-doc-003", Category: "DOCUMENT", Name: "Beneficial Ownership Declaration", Description: "Declaration of beneficial owners", Required: true, DueDays: 7},
			{ID: "mmo-doc-004", Category: "DOCUMENT", Name: "AML/CFT Policy", Description: "Anti-money laundering policy", Required: true, DueDays: 14},
			{ID: "mmo-doc-005", Category: "DOCUMENT", Name: "Agent Network Policy", Description: "Agent management and oversight policy", Required: true, DueDays: 14},
			{ID: "mmo-doc-006", Category: "DOCUMENT", Name: "Trust Account Statement", Description: "Trust account/float management proof", Required: true, DueDays: 14},
			{ID: "mmo-sec-001", Category: "ATTESTATION", Name: "Security Attestation", Description: "Security certification or questionnaire", Required: true, DueDays: 14},
			{ID: "mmo-sec-002", Category: "TECHNICAL", Name: "API Integration", Description: "API endpoint and security configuration", Required: true, DueDays: 21},
			{ID: "mmo-ops-001", Category: "OPERATIONAL", Name: "Incident Response Plan", Description: "Incident response procedures", Required: true, DueDays: 21},
			{ID: "mmo-ops-002", Category: "OPERATIONAL", Name: "24/7 Contact List", Description: "Emergency contacts", Required: true, DueDays: 21},
			{ID: "mmo-agr-001", Category: "DOCUMENT", Name: "Participation Agreement", Description: "Signed participation agreement", Required: true, DueDays: 28},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Due Diligence Review", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, Order: 1},
			{Step: "SECURITY", Name: "Security Review", ApproverRoles: []string{"SECURITY_OFFICER"}, Order: 2},
			{Step: "RISK", Name: "Risk Assessment", ApproverRoles: []string{"RISK_OFFICER"}, Order: 3},
			{Step: "OPERATIONS", Name: "Operational Readiness", ApproverRoles: []string{"OPERATIONS_MANAGER"}, Order: 4},
			{Step: "GOVERNANCE", Name: "Final Approval", ApproverRoles: []string{"COMPLIANCE_OFFICER", "OPERATIONS_MANAGER"}, DualApproval: true, Order: 5},
		},
	}

	// Fintech template
	s.templates[StakeholderFintech] = &OnboardingTemplate{
		StakeholderType:    StakeholderFintech,
		Name:               "Fintech Onboarding",
		Description:        "Onboarding process for fintech companies and PSPs",
		CertificationLevel: "STANDARD",
		EstimatedDays:      21,
		Requirements: []RequirementTemplate{
			{ID: "fin-doc-001", Category: "DOCUMENT", Name: "Certificate of Incorporation", Description: "Certificate of incorporation", Required: true, DueDays: 7},
			{ID: "fin-doc-002", Category: "DOCUMENT", Name: "PSP License", Description: "Payment service provider license (if applicable)", Required: false, DueDays: 7},
			{ID: "fin-doc-003", Category: "DOCUMENT", Name: "Beneficial Ownership", Description: "Beneficial ownership declaration", Required: true, DueDays: 7},
			{ID: "fin-doc-004", Category: "DOCUMENT", Name: "AML Policy", Description: "AML/KYC policy", Required: true, DueDays: 14},
			{ID: "fin-sec-001", Category: "ATTESTATION", Name: "Security Questionnaire", Description: "Security self-assessment questionnaire", Required: true, DueDays: 14},
			{ID: "fin-sec-002", Category: "TECHNICAL", Name: "API Configuration", Description: "API endpoints and authentication", Required: true, DueDays: 14},
			{ID: "fin-ops-001", Category: "OPERATIONAL", Name: "Support Contacts", Description: "Technical and business contacts", Required: true, DueDays: 14},
			{ID: "fin-agr-001", Category: "DOCUMENT", Name: "Participation Agreement", Description: "Signed agreement", Required: true, DueDays: 21},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Due Diligence", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, Order: 1},
			{Step: "SECURITY", Name: "Security Review", ApproverRoles: []string{"SECURITY_OFFICER"}, Order: 2},
			{Step: "OPERATIONS", Name: "Operational Review", ApproverRoles: []string{"OPERATIONS_MANAGER"}, Order: 3},
		},
	}

	// Microfinance Institution template
	s.templates[StakeholderMFI] = &OnboardingTemplate{
		StakeholderType:    StakeholderMFI,
		Name:               "Microfinance Institution Onboarding",
		Description:        "Onboarding for microfinance institutions",
		CertificationLevel: "STANDARD",
		EstimatedDays:      21,
		Requirements: []RequirementTemplate{
			{ID: "mfi-doc-001", Category: "DOCUMENT", Name: "Registration Certificate", Description: "MFI registration certificate", Required: true, DueDays: 7},
			{ID: "mfi-doc-002", Category: "DOCUMENT", Name: "MFI License", Description: "Microfinance license", Required: true, DueDays: 7},
			{ID: "mfi-doc-003", Category: "DOCUMENT", Name: "Board Resolution", Description: "Board authorization", Required: true, DueDays: 7},
			{ID: "mfi-doc-004", Category: "DOCUMENT", Name: "AML Policy", Description: "AML/KYC procedures", Required: true, DueDays: 14},
			{ID: "mfi-sec-001", Category: "TECHNICAL", Name: "API Configuration", Description: "Technical integration setup", Required: true, DueDays: 14},
			{ID: "mfi-ops-001", Category: "OPERATIONAL", Name: "Contact Information", Description: "Support contacts", Required: true, DueDays: 14},
			{ID: "mfi-agr-001", Category: "DOCUMENT", Name: "Participation Agreement", Description: "Signed agreement", Required: true, DueDays: 21},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Due Diligence", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, Order: 1},
			{Step: "SECURITY", Name: "Technical Review", ApproverRoles: []string{"SECURITY_OFFICER"}, Order: 2},
			{Step: "OPERATIONS", Name: "Operational Review", ApproverRoles: []string{"OPERATIONS_MANAGER"}, Order: 3},
		},
	}

	// Government Agency template
	s.templates[StakeholderGovernment] = &OnboardingTemplate{
		StakeholderType:    StakeholderGovernment,
		Name:               "Government Agency Onboarding",
		Description:        "Onboarding for government agencies (G2P, tax collection)",
		CertificationLevel: "STANDARD",
		EstimatedDays:      14,
		Requirements: []RequirementTemplate{
			{ID: "gov-doc-001", Category: "DOCUMENT", Name: "Mandate Letter", Description: "Official mandate/authorization letter", Required: true, DueDays: 7},
			{ID: "gov-doc-002", Category: "DOCUMENT", Name: "Treasury Account Details", Description: "Treasury/funding account information", Required: true, DueDays: 7},
			{ID: "gov-doc-003", Category: "DOCUMENT", Name: "Program Specification", Description: "Payment program details (G2P, tax, etc.)", Required: true, DueDays: 7},
			{ID: "gov-doc-004", Category: "DOCUMENT", Name: "Data Sharing Agreement", Description: "Data protection and sharing agreement", Required: true, DueDays: 7},
			{ID: "gov-sec-001", Category: "TECHNICAL", Name: "API Configuration", Description: "Technical integration", Required: true, DueDays: 10},
			{ID: "gov-ops-001", Category: "OPERATIONAL", Name: "Reporting Requirements", Description: "Reporting and reconciliation requirements", Required: true, DueDays: 10},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Mandate Verification", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, Order: 1},
			{Step: "OPERATIONS", Name: "Program Setup", ApproverRoles: []string{"OPERATIONS_MANAGER"}, Order: 2},
		},
	}

	// Merchant template
	s.templates[StakeholderMerchant] = &OnboardingTemplate{
		StakeholderType:    StakeholderMerchant,
		Name:               "Merchant Onboarding",
		Description:        "Simplified onboarding for merchants",
		CertificationLevel: "BASIC",
		EstimatedDays:      7,
		Requirements: []RequirementTemplate{
			{ID: "mer-doc-001", Category: "DOCUMENT", Name: "Business Registration", Description: "Business registration certificate", Required: true, DueDays: 3},
			{ID: "mer-doc-002", Category: "DOCUMENT", Name: "Tax ID", Description: "Tax identification number", Required: true, DueDays: 3},
			{ID: "mer-doc-003", Category: "DOCUMENT", Name: "Settlement Account", Description: "Bank account for settlements", Required: true, DueDays: 3},
			{ID: "mer-doc-004", Category: "ATTESTATION", Name: "Risk Category", Description: "Merchant risk category assessment", Required: true, DueDays: 5},
			{ID: "mer-sec-001", Category: "TECHNICAL", Name: "Integration Setup", Description: "POS/API integration", Required: true, DueDays: 5},
			{ID: "mer-agr-001", Category: "DOCUMENT", Name: "Merchant Agreement", Description: "Signed merchant agreement", Required: true, DueDays: 7},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "DUE_DILIGENCE", Name: "Merchant Verification", ApproverRoles: []string{"COMPLIANCE_OFFICER"}, Order: 1},
		},
	}

	// Regulator template
	s.templates[StakeholderRegulator] = &OnboardingTemplate{
		StakeholderType:    StakeholderRegulator,
		Name:               "Regulator Onboarding",
		Description:        "Onboarding for central bank and regulatory bodies",
		CertificationLevel: "BASIC",
		EstimatedDays:      7,
		Requirements: []RequirementTemplate{
			{ID: "reg-doc-001", Category: "DOCUMENT", Name: "Authorization Letter", Description: "Official authorization from regulatory body", Required: true, DueDays: 3},
			{ID: "reg-doc-002", Category: "DOCUMENT", Name: "Access Scope", Description: "Defined scope of access and permissions", Required: true, DueDays: 3},
			{ID: "reg-sec-001", Category: "TECHNICAL", Name: "User Accounts", Description: "User account setup for regulatory staff", Required: true, DueDays: 5},
			{ID: "reg-ops-001", Category: "OPERATIONAL", Name: "Reporting Requirements", Description: "Required reports and frequency", Required: true, DueDays: 5},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "GOVERNANCE", Name: "Executive Approval", ApproverRoles: []string{"EXECUTIVE"}, Order: 1},
		},
	}

	// NOC Operator template
	s.templates[StakeholderNOCOperator] = &OnboardingTemplate{
		StakeholderType:    StakeholderNOCOperator,
		Name:               "NOC Operator Onboarding",
		Description:        "Onboarding for internal NOC operations staff",
		CertificationLevel: "BASIC",
		EstimatedDays:      3,
		Requirements: []RequirementTemplate{
			{ID: "noc-doc-001", Category: "DOCUMENT", Name: "Employment Verification", Description: "Employment verification and background check", Required: true, DueDays: 1},
			{ID: "noc-doc-002", Category: "ATTESTATION", Name: "Training Completion", Description: "NOC training certification", Required: true, DueDays: 2},
			{ID: "noc-sec-001", Category: "TECHNICAL", Name: "Access Setup", Description: "System access and permissions", Required: true, DueDays: 2},
			{ID: "noc-ops-001", Category: "OPERATIONAL", Name: "Shift Assignment", Description: "Shift schedule assignment", Required: true, DueDays: 3},
		},
		ApprovalSteps: []ApprovalStep{
			{Step: "OPERATIONS", Name: "Manager Approval", ApproverRoles: []string{"OPERATIONS_MANAGER"}, Order: 1},
		},
	}

	// Developer template
	s.templates[StakeholderDeveloper] = &OnboardingTemplate{
		StakeholderType:    StakeholderDeveloper,
		Name:               "Developer Onboarding",
		Description:        "Quick onboarding for third-party developers",
		CertificationLevel: "BASIC",
		EstimatedDays:      1,
		Requirements: []RequirementTemplate{
			{ID: "dev-doc-001", Category: "ATTESTATION", Name: "Terms Acceptance", Description: "Accept API terms of service", Required: true, DueDays: 1},
			{ID: "dev-doc-002", Category: "DOCUMENT", Name: "Company Information", Description: "Basic company/individual information", Required: true, DueDays: 1},
			{ID: "dev-sec-001", Category: "TECHNICAL", Name: "API Key Request", Description: "Request sandbox API key", Required: true, DueDays: 1},
		},
		ApprovalSteps: []ApprovalStep{
			// Auto-approved for sandbox
		},
	}
}

// CreateCase creates a new onboarding case
func (s *OnboardingService) CreateCase(ctx context.Context, req CreateCaseRequest) (*OnboardingCase, error) {
	template, ok := s.templates[req.StakeholderType]
	if !ok {
		return nil, fmt.Errorf("unknown stakeholder type: %s", req.StakeholderType)
	}

	now := time.Now()
	caseID := generateCaseID()

	// Generate requirements from template
	requirements := make([]Requirement, len(template.Requirements))
	for i, tmpl := range template.Requirements {
		dueDate := now.AddDate(0, 0, tmpl.DueDays)
		requirements[i] = Requirement{
			ID:          tmpl.ID,
			Category:    tmpl.Category,
			Name:        tmpl.Name,
			Description: tmpl.Description,
			Required:    tmpl.Required,
			Status:      "PENDING",
			DueDate:     &dueDate,
			EvidenceIDs: make([]string, 0),
		}
	}

	onboardingCase := &OnboardingCase{
		ID:                caseID,
		OrganizationID:    req.OrganizationID,
		OrganizationName:  req.OrganizationName,
		StakeholderType:   req.StakeholderType,
		Status:            StatusDraft,
		Jurisdiction:      req.Jurisdiction,
		PrimaryContact:    req.PrimaryContact,
		TechnicalContact:  req.TechnicalContact,
		ComplianceContact: req.ComplianceContact,
		Requirements:      requirements,
		Evidence:          make([]EvidenceItem, 0),
		CertificationRuns: make([]CertificationRun, 0),
		Approvals:         make([]Approval, 0),
		StatusHistory:     make([]StatusChange, 0),
		Notes:             make([]CaseNote, 0),
		CreatedAt:         now,
		UpdatedAt:         now,
		Metadata:          make(map[string]interface{}),
	}

	// Store case
	s.casesMu.Lock()
	s.cases[caseID] = onboardingCase
	s.casesMu.Unlock()

	// Emit event
	if s.eventEmitter != nil {
		s.eventEmitter.Emit(ctx, OnboardingCaseCreatedEvent{
			CaseID:          caseID,
			OrganizationID:  req.OrganizationID,
			StakeholderType: string(req.StakeholderType),
			Timestamp:       now,
		})
	}

	return onboardingCase, nil
}

// CreateCaseRequest represents a request to create an onboarding case
type CreateCaseRequest struct {
	OrganizationID    string          `json:"organization_id"`
	OrganizationName  string          `json:"organization_name"`
	StakeholderType   StakeholderType `json:"stakeholder_type"`
	Jurisdiction      string          `json:"jurisdiction"`
	PrimaryContact    ContactInfo     `json:"primary_contact"`
	TechnicalContact  ContactInfo     `json:"technical_contact"`
	ComplianceContact ContactInfo     `json:"compliance_contact"`
}

// SubmitCase submits a case for review
func (s *OnboardingService) SubmitCase(ctx context.Context, caseID, submittedBy string) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	if c.Status != StatusDraft && c.Status != StatusReworkRequested {
		return fmt.Errorf("case cannot be submitted from status: %s", c.Status)
	}

	// Validate required requirements have evidence
	for _, req := range c.Requirements {
		if req.Required && len(req.EvidenceIDs) == 0 {
			return fmt.Errorf("required document missing: %s", req.Name)
		}
	}

	now := time.Now()
	c.StatusHistory = append(c.StatusHistory, StatusChange{
		FromStatus: c.Status,
		ToStatus:   StatusSubmitted,
		ChangedBy:  submittedBy,
		ChangedAt:  now,
	})
	c.Status = StatusSubmitted
	c.SubmittedAt = &now
	c.UpdatedAt = now

	return nil
}

// UploadEvidence uploads evidence for a requirement
func (s *OnboardingService) UploadEvidence(ctx context.Context, caseID string, evidence EvidenceItem) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	evidence.ID = generateEvidenceID()
	evidence.UploadedAt = time.Now()

	c.Evidence = append(c.Evidence, evidence)

	// Link to requirement
	for i := range c.Requirements {
		if c.Requirements[i].ID == evidence.RequirementID {
			c.Requirements[i].EvidenceIDs = append(c.Requirements[i].EvidenceIDs, evidence.ID)
			c.Requirements[i].Status = "SUBMITTED"
			break
		}
	}

	c.UpdatedAt = time.Now()

	return nil
}

// ReviewRequirement reviews a requirement
func (s *OnboardingService) ReviewRequirement(ctx context.Context, caseID, requirementID, reviewerID, decision, notes string) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	now := time.Now()
	for i := range c.Requirements {
		if c.Requirements[i].ID == requirementID {
			c.Requirements[i].Status = decision // APPROVED, REJECTED
			c.Requirements[i].ReviewedBy = reviewerID
			c.Requirements[i].ReviewedAt = &now
			c.Requirements[i].ReviewNotes = notes
			break
		}
	}

	c.UpdatedAt = now

	return nil
}

// SetTechnicalProfile sets the technical profile for a case
func (s *OnboardingService) SetTechnicalProfile(ctx context.Context, caseID string, profile TechnicalProfile) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	c.TechnicalProfile = &profile
	c.UpdatedAt = time.Now()

	return nil
}

// TransitionStatus transitions the case to a new status
func (s *OnboardingService) TransitionStatus(ctx context.Context, caseID string, newStatus OnboardingStatus, changedBy, reason string) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	// Validate transition
	if !s.isValidTransition(c.Status, newStatus) {
		return fmt.Errorf("invalid transition from %s to %s", c.Status, newStatus)
	}

	now := time.Now()
	c.StatusHistory = append(c.StatusHistory, StatusChange{
		FromStatus: c.Status,
		ToStatus:   newStatus,
		ChangedBy:  changedBy,
		ChangedAt:  now,
		Reason:     reason,
	})
	c.Status = newStatus
	c.UpdatedAt = now

	if newStatus == StatusActive {
		c.CompletedAt = &now
	}

	// Emit event
	if s.eventEmitter != nil {
		s.eventEmitter.Emit(ctx, OnboardingStatusChangedEvent{
			CaseID:     caseID,
			FromStatus: string(c.StatusHistory[len(c.StatusHistory)-1].FromStatus),
			ToStatus:   string(newStatus),
			ChangedBy:  changedBy,
			Timestamp:  now,
		})
	}

	return nil
}

// isValidTransition checks if a status transition is valid
func (s *OnboardingService) isValidTransition(from, to OnboardingStatus) bool {
	validTransitions := map[OnboardingStatus][]OnboardingStatus{
		StatusDraft:              {StatusSubmitted},
		StatusSubmitted:          {StatusDueDiligence, StatusRejected, StatusReworkRequested},
		StatusDueDiligence:       {StatusTechnicalSetup, StatusRejected, StatusReworkRequested},
		StatusTechnicalSetup:     {StatusSandboxCertified, StatusRejected, StatusReworkRequested},
		StatusSandboxCertified:   {StatusOperationalReady, StatusRejected, StatusReworkRequested},
		StatusOperationalReady:   {StatusGovernanceApproval, StatusRejected, StatusReworkRequested},
		StatusGovernanceApproval: {StatusProdProvisioned, StatusRejected, StatusReworkRequested},
		StatusProdProvisioned:    {StatusProdCertified, StatusRejected},
		StatusProdCertified:      {StatusActive, StatusRejected},
		StatusActive:             {StatusSuspended, StatusOffboarded},
		StatusSuspended:          {StatusActive, StatusOffboarded},
		StatusReworkRequested:    {StatusSubmitted},
	}

	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}

	for _, status := range allowed {
		if status == to {
			return true
		}
	}

	return false
}

// AddApproval adds an approval decision
func (s *OnboardingService) AddApproval(ctx context.Context, caseID string, approval Approval) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	approval.ID = generateApprovalID()
	approval.DecidedAt = time.Now()

	c.Approvals = append(c.Approvals, approval)
	c.UpdatedAt = time.Now()

	return nil
}

// ProvisionSandbox provisions sandbox resources
func (s *OnboardingService) ProvisionSandbox(ctx context.Context, caseID string) (*ProvisionedResources, error) {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return nil, fmt.Errorf("case not found: %s", caseID)
	}

	resources := &ProvisionedResources{
		Environment:      "SANDBOX",
		ParticipantID:    generateParticipantID(),
		FSPID:            fmt.Sprintf("sandbox-%s", c.OrganizationID),
		LedgerAccountID:  generateLedgerAccountID(),
		APIKeyID:         generateAPIKeyID(),
		APIKeySecret:     generateAPIKeySecret(),
		APISIXRouteID:    generateRouteID(),
		KeycloakClientID: fmt.Sprintf("sandbox-%s", c.OrganizationID),
		ProvisionedAt:    time.Now(),
		Limits: ResourceLimits{
			MaxTPS:                 100,
			DailyTransactionLimit:  1000000,
			SingleTransactionLimit: 10000,
			NetDebitCap:            100000,
		},
	}

	c.SandboxResources = resources
	c.UpdatedAt = time.Now()

	return resources, nil
}

// ProvisionProduction provisions production resources
func (s *OnboardingService) ProvisionProduction(ctx context.Context, caseID string, limits ResourceLimits) (*ProvisionedResources, error) {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return nil, fmt.Errorf("case not found: %s", caseID)
	}

	resources := &ProvisionedResources{
		Environment:      "PRODUCTION",
		ParticipantID:    generateParticipantID(),
		FSPID:            c.OrganizationID,
		LedgerAccountID:  generateLedgerAccountID(),
		APIKeyID:         generateAPIKeyID(),
		APIKeySecret:     generateAPIKeySecret(),
		APISIXRouteID:    generateRouteID(),
		KeycloakClientID: c.OrganizationID,
		ProvisionedAt:    time.Now(),
		Limits:           limits,
	}

	c.ProductionResources = resources
	c.UpdatedAt = time.Now()

	return resources, nil
}

// GetCase retrieves a case by ID
func (s *OnboardingService) GetCase(ctx context.Context, caseID string) (*OnboardingCase, error) {
	s.casesMu.RLock()
	defer s.casesMu.RUnlock()

	c, ok := s.cases[caseID]
	if !ok {
		return nil, fmt.Errorf("case not found: %s", caseID)
	}

	return c, nil
}

// ListCases lists cases with optional filters
func (s *OnboardingService) ListCases(ctx context.Context, filters CaseFilters) ([]*OnboardingCase, error) {
	s.casesMu.RLock()
	defer s.casesMu.RUnlock()

	result := make([]*OnboardingCase, 0)

	for _, c := range s.cases {
		if filters.StakeholderType != "" && c.StakeholderType != filters.StakeholderType {
			continue
		}
		if filters.Status != "" && c.Status != filters.Status {
			continue
		}
		if filters.Jurisdiction != "" && c.Jurisdiction != filters.Jurisdiction {
			continue
		}
		result = append(result, c)
	}

	return result, nil
}

// CaseFilters represents filters for listing cases
type CaseFilters struct {
	StakeholderType StakeholderType  `json:"stakeholder_type,omitempty"`
	Status          OnboardingStatus `json:"status,omitempty"`
	Jurisdiction    string           `json:"jurisdiction,omitempty"`
}

// AddNote adds a note to a case
func (s *OnboardingService) AddNote(ctx context.Context, caseID string, note CaseNote) error {
	s.casesMu.Lock()
	defer s.casesMu.Unlock()

	c, ok := s.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found: %s", caseID)
	}

	note.ID = generateNoteID()
	note.CreatedAt = time.Now()

	c.Notes = append(c.Notes, note)
	c.UpdatedAt = time.Now()

	return nil
}

// GetTemplate retrieves the onboarding template for a stakeholder type
func (s *OnboardingService) GetTemplate(stakeholderType StakeholderType) (*OnboardingTemplate, error) {
	template, ok := s.templates[stakeholderType]
	if !ok {
		return nil, fmt.Errorf("template not found for: %s", stakeholderType)
	}
	return template, nil
}

// GetAllTemplates returns all onboarding templates
func (s *OnboardingService) GetAllTemplates() map[StakeholderType]*OnboardingTemplate {
	return s.templates
}

// Events
type OnboardingCaseCreatedEvent struct {
	CaseID          string    `json:"case_id"`
	OrganizationID  string    `json:"organization_id"`
	StakeholderType string    `json:"stakeholder_type"`
	Timestamp       time.Time `json:"timestamp"`
}

type OnboardingStatusChangedEvent struct {
	CaseID     string    `json:"case_id"`
	FromStatus string    `json:"from_status"`
	ToStatus   string    `json:"to_status"`
	ChangedBy  string    `json:"changed_by"`
	Timestamp  time.Time `json:"timestamp"`
}

// Helper functions
func generateCaseID() string {
	return fmt.Sprintf("OB-%d", time.Now().UnixNano())
}

func generateEvidenceID() string {
	return fmt.Sprintf("EV-%d", time.Now().UnixNano())
}

func generateApprovalID() string {
	return fmt.Sprintf("AP-%d", time.Now().UnixNano())
}

func generateParticipantID() string {
	return fmt.Sprintf("P-%d", time.Now().UnixNano())
}

func generateLedgerAccountID() string {
	return fmt.Sprintf("LA-%d", time.Now().UnixNano())
}

func generateAPIKeyID() string {
	return fmt.Sprintf("AK-%d", time.Now().UnixNano())
}

func generateAPIKeySecret() string {
	return fmt.Sprintf("sk_live_%d", time.Now().UnixNano())
}

func generateRouteID() string {
	return fmt.Sprintf("RT-%d", time.Now().UnixNano())
}

func generateNoteID() string {
	return fmt.Sprintf("NT-%d", time.Now().UnixNano())
}
