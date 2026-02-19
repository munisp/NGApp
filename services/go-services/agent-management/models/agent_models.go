package models

import (
	"time"
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// Agent represents the main agent entity
type Agent struct {
	ID                string                 `json:"id" db:"id"`
	AgentCode         string                 `json:"agent_code" db:"agent_code"`
	FirstName         string                 `json:"first_name" db:"first_name"`
	LastName          string                 `json:"last_name" db:"last_name"`
	Email             string                 `json:"email" db:"email"`
	Phone             string                 `json:"phone" db:"phone"`
	AlternatePhone    string                 `json:"alternate_phone" db:"alternate_phone"`
	DateOfBirth       time.Time              `json:"date_of_birth" db:"date_of_birth"`
	Gender            string                 `json:"gender" db:"gender"`
	NationalID        string                 `json:"national_id" db:"national_id"`
	BusinessName      string                 `json:"business_name" db:"business_name"`
	BusinessType      string                 `json:"business_type" db:"business_type"`
	BusinessLicense   string                 `json:"business_license" db:"business_license"`
	TaxID             string                 `json:"tax_id" db:"tax_id"`
	Address           Address                `json:"address" db:"address"`
	Location          Location               `json:"location" db:"location"`
	BankAccount       BankAccount            `json:"bank_account" db:"bank_account"`
	AgentType         AgentType              `json:"agent_type" db:"agent_type"`
	Status            AgentStatus            `json:"status" db:"status"`
	ParentAgentID     *string                `json:"parent_agent_id" db:"parent_agent_id"`
	HierarchyLevel    int                    `json:"hierarchy_level" db:"hierarchy_level"`
	Region            string                 `json:"region" db:"region"`
	Territory         string                 `json:"territory" db:"territory"`
	CommissionProfile CommissionProfile      `json:"commission_profile" db:"commission_profile"`
	TransactionLimits TransactionLimits      `json:"transaction_limits" db:"transaction_limits"`
	KYCStatus         KYCStatus              `json:"kyc_status" db:"kyc_status"`
	KYCData           KYCData                `json:"kyc_data" db:"kyc_data"`
	OnboardingData    OnboardingData         `json:"onboarding_data" db:"onboarding_data"`
	Metadata          map[string]interface{} `json:"metadata" db:"metadata"`
	CreatedAt         time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at" db:"updated_at"`
	CreatedBy         string                 `json:"created_by" db:"created_by"`
	UpdatedBy         string                 `json:"updated_by" db:"updated_by"`
	ApprovedAt        *time.Time             `json:"approved_at" db:"approved_at"`
	ApprovedBy        *string                `json:"approved_by" db:"approved_by"`
	SuspendedAt       *time.Time             `json:"suspended_at" db:"suspended_at"`
	SuspendedBy       *string                `json:"suspended_by" db:"suspended_by"`
	LastLoginAt       *time.Time             `json:"last_login_at" db:"last_login_at"`
	IsActive          bool                   `json:"is_active" db:"is_active"`
	Version           int                    `json:"version" db:"version"`
}

// Address represents agent address information
type Address struct {
	Street     string `json:"street"`
	City       string `json:"city"`
	State      string `json:"state"`
	PostalCode string `json:"postal_code"`
	Country    string `json:"country"`
}

// Location represents geographical coordinates
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Accuracy  float64 `json:"accuracy"`
	Altitude  float64 `json:"altitude"`
}

// BankAccount represents agent bank account details
type BankAccount struct {
	BankName      string `json:"bank_name"`
	BankCode      string `json:"bank_code"`
	AccountNumber string `json:"account_number"`
	AccountName   string `json:"account_name"`
	BranchCode    string `json:"branch_code"`
	SwiftCode     string `json:"swift_code"`
	IBAN          string `json:"iban"`
	Currency      string `json:"currency"`
	IsVerified    bool   `json:"is_verified"`
	VerifiedAt    *time.Time `json:"verified_at"`
}

// CommissionProfile represents agent commission configuration
type CommissionProfile struct {
	ProfileID          string                 `json:"profile_id"`
	ProfileName        string                 `json:"profile_name"`
	CommissionRates    map[string]float64     `json:"commission_rates"`
	FeeStructure       map[string]float64     `json:"fee_structure"`
	MinimumCommission  float64                `json:"minimum_commission"`
	MaximumCommission  float64                `json:"maximum_commission"`
	SettlementPeriod   string                 `json:"settlement_period"`
	PaymentMethod      string                 `json:"payment_method"`
	TaxRate            float64                `json:"tax_rate"`
	IsActive           bool                   `json:"is_active"`
	EffectiveFrom      time.Time              `json:"effective_from"`
	EffectiveTo        *time.Time             `json:"effective_to"`
	CustomRules        map[string]interface{} `json:"custom_rules"`
}

// TransactionLimits represents agent transaction limits
type TransactionLimits struct {
	DailyTransactionLimit    float64            `json:"daily_transaction_limit"`
	MonthlyTransactionLimit  float64            `json:"monthly_transaction_limit"`
	SingleTransactionLimit   float64            `json:"single_transaction_limit"`
	DailyTransactionCount    int                `json:"daily_transaction_count"`
	MonthlyTransactionCount  int                `json:"monthly_transaction_count"`
	CashInLimit              float64            `json:"cash_in_limit"`
	CashOutLimit             float64            `json:"cash_out_limit"`
	TransferLimit            float64            `json:"transfer_limit"`
	BillPaymentLimit         float64            `json:"bill_payment_limit"`
	CurrencyLimits           map[string]float64 `json:"currency_limits"`
	IsActive                 bool               `json:"is_active"`
	LastUpdated              time.Time          `json:"last_updated"`
	UpdatedBy                string             `json:"updated_by"`
}

// KYCData represents Know Your Customer data
type KYCData struct {
	DocumentType         string                 `json:"document_type"`
	DocumentNumber       string                 `json:"document_number"`
	DocumentExpiryDate   *time.Time             `json:"document_expiry_date"`
	DocumentImages       []string               `json:"document_images"`
	BiometricData        BiometricData          `json:"biometric_data"`
	RiskScore            float64                `json:"risk_score"`
	RiskCategory         string                 `json:"risk_category"`
	VerificationStatus   string                 `json:"verification_status"`
	VerificationDate     *time.Time             `json:"verification_date"`
	VerifiedBy           string                 `json:"verified_by"`
	ComplianceChecks     []ComplianceCheck      `json:"compliance_checks"`
	AdditionalDocuments  []Document             `json:"additional_documents"`
	Notes                string                 `json:"notes"`
	LastReviewDate       *time.Time             `json:"last_review_date"`
	NextReviewDate       *time.Time             `json:"next_review_date"`
}

// BiometricData represents biometric verification data
type BiometricData struct {
	FingerprintHash    string    `json:"fingerprint_hash"`
	FaceImageHash      string    `json:"face_image_hash"`
	VoicePrintHash     string    `json:"voice_print_hash"`
	BiometricScore     float64   `json:"biometric_score"`
	VerificationMethod string    `json:"verification_method"`
	CapturedAt         time.Time `json:"captured_at"`
	DeviceID           string    `json:"device_id"`
	IsVerified         bool      `json:"is_verified"`
}

// ComplianceCheck represents compliance verification
type ComplianceCheck struct {
	CheckType     string                 `json:"check_type"`
	CheckStatus   string                 `json:"check_status"`
	CheckResult   map[string]interface{} `json:"check_result"`
	CheckedAt     time.Time              `json:"checked_at"`
	CheckedBy     string                 `json:"checked_by"`
	ExpiresAt     *time.Time             `json:"expires_at"`
	Notes         string                 `json:"notes"`
}

// Document represents uploaded documents
type Document struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	FilePath     string    `json:"file_path"`
	FileSize     int64     `json:"file_size"`
	MimeType     string    `json:"mime_type"`
	Hash         string    `json:"hash"`
	UploadedAt   time.Time `json:"uploaded_at"`
	UploadedBy   string    `json:"uploaded_by"`
	IsVerified   bool      `json:"is_verified"`
	VerifiedAt   *time.Time `json:"verified_at"`
	VerifiedBy   string    `json:"verified_by"`
	ExpiresAt    *time.Time `json:"expires_at"`
}

// OnboardingData represents agent onboarding information
type OnboardingData struct {
	OnboardingStage      string                 `json:"onboarding_stage"`
	CompletedSteps       []string               `json:"completed_steps"`
	PendingSteps         []string               `json:"pending_steps"`
	OnboardingStartDate  time.Time              `json:"onboarding_start_date"`
	OnboardingEndDate    *time.Time             `json:"onboarding_end_date"`
	TrainingCompleted    bool                   `json:"training_completed"`
	TrainingScore        float64                `json:"training_score"`
	CertificationStatus  string                 `json:"certification_status"`
	CertificationDate    *time.Time             `json:"certification_date"`
	OnboardingNotes      string                 `json:"onboarding_notes"`
	AssignedTrainer      string                 `json:"assigned_trainer"`
	TrainingMaterials    []string               `json:"training_materials"`
	AssessmentResults    map[string]interface{} `json:"assessment_results"`
}

// AgentType represents different types of agents
type AgentType string

const (
	AgentTypeMaster     AgentType = "master"
	AgentTypeSuper      AgentType = "super"
	AgentTypeRegular    AgentType = "regular"
	AgentTypeSubAgent   AgentType = "sub_agent"
	AgentTypeMobile     AgentType = "mobile"
	AgentTypeKiosk      AgentType = "kiosk"
	AgentTypePartner    AgentType = "partner"
)

// AgentStatus represents agent status
type AgentStatus string

const (
	AgentStatusPending    AgentStatus = "pending"
	AgentStatusActive     AgentStatus = "active"
	AgentStatusSuspended  AgentStatus = "suspended"
	AgentStatusInactive   AgentStatus = "inactive"
	AgentStatusRejected   AgentStatus = "rejected"
	AgentStatusTerminated AgentStatus = "terminated"
	AgentStatusUnderReview AgentStatus = "under_review"
)

// KYCStatus represents KYC verification status
type KYCStatus string

const (
	KYCStatusPending   KYCStatus = "pending"
	KYCStatusVerified  KYCStatus = "verified"
	KYCStatusRejected  KYCStatus = "rejected"
	KYCStatusExpired   KYCStatus = "expired"
	KYCStatusIncomplete KYCStatus = "incomplete"
)

// Request/Response Models

// CreateAgentRequest represents agent creation request
type CreateAgentRequest struct {
	FirstName         string                 `json:"first_name" validate:"required,min=2,max=50"`
	LastName          string                 `json:"last_name" validate:"required,min=2,max=50"`
	Email             string                 `json:"email" validate:"required,email"`
	Phone             string                 `json:"phone" validate:"required,e164"`
	AlternatePhone    string                 `json:"alternate_phone" validate:"omitempty,e164"`
	DateOfBirth       time.Time              `json:"date_of_birth" validate:"required"`
	Gender            string                 `json:"gender" validate:"required,oneof=male female other"`
	NationalID        string                 `json:"national_id" validate:"required"`
	BusinessName      string                 `json:"business_name" validate:"required"`
	BusinessType      string                 `json:"business_type" validate:"required"`
	BusinessLicense   string                 `json:"business_license"`
	TaxID             string                 `json:"tax_id"`
	Address           Address                `json:"address" validate:"required"`
	Location          Location               `json:"location" validate:"required"`
	BankAccount       BankAccount            `json:"bank_account" validate:"required"`
	AgentType         AgentType              `json:"agent_type" validate:"required"`
	ParentAgentID     *string                `json:"parent_agent_id"`
	Region            string                 `json:"region" validate:"required"`
	Territory         string                 `json:"territory"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// UpdateAgentRequest represents agent update request
type UpdateAgentRequest struct {
	FirstName         *string                `json:"first_name" validate:"omitempty,min=2,max=50"`
	LastName          *string                `json:"last_name" validate:"omitempty,min=2,max=50"`
	Email             *string                `json:"email" validate:"omitempty,email"`
	Phone             *string                `json:"phone" validate:"omitempty,e164"`
	AlternatePhone    *string                `json:"alternate_phone" validate:"omitempty,e164"`
	BusinessName      *string                `json:"business_name"`
	BusinessType      *string                `json:"business_type"`
	BusinessLicense   *string                `json:"business_license"`
	TaxID             *string                `json:"tax_id"`
	Address           *Address               `json:"address"`
	Location          *Location              `json:"location"`
	BankAccount       *BankAccount           `json:"bank_account"`
	Region            *string                `json:"region"`
	Territory         *string                `json:"territory"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// ApprovalRequest represents agent approval request
type ApprovalRequest struct {
	Notes             string                 `json:"notes"`
	CommissionProfile *CommissionProfile     `json:"commission_profile"`
	TransactionLimits *TransactionLimits     `json:"transaction_limits"`
	Conditions        []string               `json:"conditions"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// RejectionRequest represents agent rejection request
type RejectionRequest struct {
	Reason   string                 `json:"reason" validate:"required"`
	Notes    string                 `json:"notes"`
	Metadata map[string]interface{} `json:"metadata"`
}

// SuspensionRequest represents agent suspension request
type SuspensionRequest struct {
	Reason      string                 `json:"reason" validate:"required"`
	Duration    *time.Duration         `json:"duration"`
	Notes       string                 `json:"notes"`
	Conditions  []string               `json:"conditions"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ReactivationRequest represents agent reactivation request
type ReactivationRequest struct {
	Notes       string                 `json:"notes"`
	Conditions  []string               `json:"conditions"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// UpdateLimitsRequest represents transaction limits update request
type UpdateLimitsRequest struct {
	DailyTransactionLimit   *float64           `json:"daily_transaction_limit"`
	MonthlyTransactionLimit *float64           `json:"monthly_transaction_limit"`
	SingleTransactionLimit  *float64           `json:"single_transaction_limit"`
	DailyTransactionCount   *int               `json:"daily_transaction_count"`
	MonthlyTransactionCount *int               `json:"monthly_transaction_count"`
	CashInLimit             *float64           `json:"cash_in_limit"`
	CashOutLimit            *float64           `json:"cash_out_limit"`
	TransferLimit           *float64           `json:"transfer_limit"`
	BillPaymentLimit        *float64           `json:"bill_payment_limit"`
	CurrencyLimits          map[string]float64 `json:"currency_limits"`
	Reason                  string             `json:"reason" validate:"required"`
}

// BulkUpdateRequest represents bulk agent update request
type BulkUpdateRequest struct {
	AgentIDs  []string               `json:"agent_ids" validate:"required,min=1,max=100"`
	Operation string                 `json:"operation" validate:"required,oneof=activate suspend terminate update_limits"`
	Data      map[string]interface{} `json:"data"`
	Reason    string                 `json:"reason"`
}

// BulkUpdateResult represents bulk update operation result
type BulkUpdateResult struct {
	TotalCount   int                    `json:"total_count"`
	SuccessCount int                    `json:"success_count"`
	FailureCount int                    `json:"failure_count"`
	Results      []BulkOperationResult  `json:"results"`
	Errors       []BulkOperationError   `json:"errors"`
}

// BulkOperationResult represents individual operation result
type BulkOperationResult struct {
	AgentID string `json:"agent_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// BulkOperationError represents individual operation error
type BulkOperationError struct {
	AgentID string `json:"agent_id"`
	Error   string `json:"error"`
}

// Filtering and Pagination Models

// AgentFilters represents agent filtering options
type AgentFilters struct {
	Status       string    `json:"status"`
	Type         string    `json:"type"`
	Region       string    `json:"region"`
	Territory    string    `json:"territory"`
	ParentID     string    `json:"parent_id"`
	KYCStatus    string    `json:"kyc_status"`
	SearchTerm   string    `json:"search_term"`
	CreatedFrom  *time.Time `json:"created_from"`
	CreatedTo    *time.Time `json:"created_to"`
	IsActive     *bool     `json:"is_active"`
	HierarchyLevel *int    `json:"hierarchy_level"`
}

// Pagination represents pagination parameters
type Pagination struct {
	Page   int `json:"page"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// Sorting represents sorting parameters
type Sorting struct {
	Field string `json:"field"`
	Order string `json:"order"`
}

// AgentListResponse represents paginated agent list response
type AgentListResponse struct {
	Agents     []Agent    `json:"agents"`
	Pagination Pagination `json:"pagination"`
	Total      int        `json:"total"`
	Filters    AgentFilters `json:"filters"`
}

// TransactionFilters represents transaction filtering options
type TransactionFilters struct {
	Type      string `json:"type"`
	Status    string `json:"status"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
	MinAmount *float64 `json:"min_amount"`
	MaxAmount *float64 `json:"max_amount"`
	Currency  string `json:"currency"`
}

// Performance Metrics Models

// AgentPerformance represents agent performance metrics
type AgentPerformance struct {
	AgentID              string                 `json:"agent_id"`
	Period               string                 `json:"period"`
	StartDate            time.Time              `json:"start_date"`
	EndDate              time.Time              `json:"end_date"`
	TransactionMetrics   TransactionMetrics     `json:"transaction_metrics"`
	CommissionMetrics    CommissionMetrics      `json:"commission_metrics"`
	CustomerMetrics      CustomerMetrics        `json:"customer_metrics"`
	ComplianceMetrics    ComplianceMetrics      `json:"compliance_metrics"`
	PerformanceScore     float64                `json:"performance_score"`
	Ranking              int                    `json:"ranking"`
	Achievements         []Achievement          `json:"achievements"`
	Recommendations      []string               `json:"recommendations"`
	Metadata             map[string]interface{} `json:"metadata"`
}

// TransactionMetrics represents transaction-related metrics
type TransactionMetrics struct {
	TotalTransactions    int                    `json:"total_transactions"`
	TotalVolume          float64                `json:"total_volume"`
	AverageTransaction   float64                `json:"average_transaction"`
	TransactionsByType   map[string]int         `json:"transactions_by_type"`
	VolumeByType         map[string]float64     `json:"volume_by_type"`
	SuccessRate          float64                `json:"success_rate"`
	FailureRate          float64                `json:"failure_rate"`
	PeakTransactionDay   time.Time              `json:"peak_transaction_day"`
	PeakTransactionHour  int                    `json:"peak_transaction_hour"`
	GrowthRate           float64                `json:"growth_rate"`
	Trends               map[string]interface{} `json:"trends"`
}

// CommissionMetrics represents commission-related metrics
type CommissionMetrics struct {
	TotalCommission      float64                `json:"total_commission"`
	CommissionByType     map[string]float64     `json:"commission_by_type"`
	AverageCommission    float64                `json:"average_commission"`
	CommissionRate       float64                `json:"commission_rate"`
	PendingCommission    float64                `json:"pending_commission"`
	PaidCommission       float64                `json:"paid_commission"`
	CommissionGrowth     float64                `json:"commission_growth"`
	PaymentHistory       []CommissionPayment    `json:"payment_history"`
}

// CustomerMetrics represents customer-related metrics
type CustomerMetrics struct {
	TotalCustomers       int                    `json:"total_customers"`
	NewCustomers         int                    `json:"new_customers"`
	ActiveCustomers      int                    `json:"active_customers"`
	RetentionRate        float64                `json:"retention_rate"`
	CustomerSatisfaction float64                `json:"customer_satisfaction"`
	ComplaintRate        float64                `json:"complaint_rate"`
	CustomerGrowth       float64                `json:"customer_growth"`
	Demographics         map[string]interface{} `json:"demographics"`
}

// ComplianceMetrics represents compliance-related metrics
type ComplianceMetrics struct {
	ComplianceScore      float64                `json:"compliance_score"`
	KYCCompletionRate    float64                `json:"kyc_completion_rate"`
	AMLAlerts            int                    `json:"aml_alerts"`
	SuspiciousTransactions int                  `json:"suspicious_transactions"`
	RegulatoryReports    int                    `json:"regulatory_reports"`
	TrainingCompletion   float64                `json:"training_completion"`
	CertificationStatus  string                 `json:"certification_status"`
	LastAuditDate        *time.Time             `json:"last_audit_date"`
	NextAuditDate        *time.Time             `json:"next_audit_date"`
}

// Achievement represents agent achievements
type Achievement struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	EarnedAt    time.Time `json:"earned_at"`
	Points      int       `json:"points"`
	Badge       string    `json:"badge"`
	Level       string    `json:"level"`
}

// CommissionPayment represents commission payment record
type CommissionPayment struct {
	ID            string    `json:"id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	PaymentDate   time.Time `json:"payment_date"`
	PaymentMethod string    `json:"payment_method"`
	Status        string    `json:"status"`
	Reference     string    `json:"reference"`
}

// Audit Models

// AuditEvent represents audit trail event
type AuditEvent struct {
	ID         string                 `json:"id"`
	UserID     string                 `json:"user_id"`
	Action     string                 `json:"action"`
	EntityID   string                 `json:"entity_id"`
	EntityType string                 `json:"entity_type"`
	Details    map[string]interface{} `json:"details"`
	IPAddress  string                 `json:"ip_address"`
	UserAgent  string                 `json:"user_agent"`
	Timestamp  time.Time              `json:"timestamp"`
}

// Database Value/Scan implementations for custom types

func (a Address) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *Address) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into Address")
	}
	
	return json.Unmarshal(bytes, a)
}

func (l Location) Value() (driver.Value, error) {
	return json.Marshal(l)
}

func (l *Location) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into Location")
	}
	
	return json.Unmarshal(bytes, l)
}

func (b BankAccount) Value() (driver.Value, error) {
	return json.Marshal(b)
}

func (b *BankAccount) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into BankAccount")
	}
	
	return json.Unmarshal(bytes, b)
}

func (c CommissionProfile) Value() (driver.Value, error) {
	return json.Marshal(c)
}

func (c *CommissionProfile) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into CommissionProfile")
	}
	
	return json.Unmarshal(bytes, c)
}

func (t TransactionLimits) Value() (driver.Value, error) {
	return json.Marshal(t)
}

func (t *TransactionLimits) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into TransactionLimits")
	}
	
	return json.Unmarshal(bytes, t)
}

func (k KYCData) Value() (driver.Value, error) {
	return json.Marshal(k)
}

func (k *KYCData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into KYCData")
	}
	
	return json.Unmarshal(bytes, k)
}

func (o OnboardingData) Value() (driver.Value, error) {
	return json.Marshal(o)
}

func (o *OnboardingData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("cannot scan non-bytes into OnboardingData")
	}
	
	return json.Unmarshal(bytes, o)
}

