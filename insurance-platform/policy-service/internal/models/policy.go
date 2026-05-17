package models

import (
	"time"

	"github.com/google/uuid"
)

// PolicyStatus represents the status of a policy
type PolicyStatus string

const (
	PolicyStatusDraft     PolicyStatus = "DRAFT"
	PolicyStatusPending   PolicyStatus = "PENDING"
	PolicyStatusActive    PolicyStatus = "ACTIVE"
	PolicyStatusSuspended PolicyStatus = "SUSPENDED"
	PolicyStatusCancelled PolicyStatus = "CANCELLED"
	PolicyStatusExpired   PolicyStatus = "EXPIRED"
)

// PolicyType represents the type of insurance policy
type PolicyType string

const (
	PolicyTypeMotor      PolicyType = "MOTOR"
	PolicyTypeHealth     PolicyType = "HEALTH"
	PolicyTypeLife       PolicyType = "LIFE"
	PolicyTypeProperty   PolicyType = "PROPERTY"
	PolicyTypeMarine     PolicyType = "MARINE"
	PolicyTypeTravel     PolicyType = "TRAVEL"
	PolicyTypeMicro      PolicyType = "MICRO"
)

// PremiumFrequency represents how often premiums are paid
type PremiumFrequency string

const (
	PremiumFrequencyDaily     PremiumFrequency = "DAILY"
	PremiumFrequencyWeekly    PremiumFrequency = "WEEKLY"
	PremiumFrequencyMonthly   PremiumFrequency = "MONTHLY"
	PremiumFrequencyQuarterly PremiumFrequency = "QUARTERLY"
	PremiumFrequencyAnnually  PremiumFrequency = "ANNUALLY"
)

// Policy represents an insurance policy
type Policy struct {
	ID                 uuid.UUID        `json:"id" db:"id"`
	PolicyNumber       string           `json:"policy_number" db:"policy_number"`
	CustomerID         uuid.UUID        `json:"customer_id" db:"customer_id"`
	AgentID            *uuid.UUID       `json:"agent_id" db:"agent_id"`
	PolicyType         PolicyType       `json:"policy_type" db:"policy_type"`
	Status             PolicyStatus     `json:"status" db:"status"`
	PremiumAmount      int64            `json:"premium_amount" db:"premium_amount"`
	PremiumFrequency   PremiumFrequency `json:"premium_frequency" db:"premium_frequency"`
	SumAssured         int64            `json:"sum_assured" db:"sum_assured"`
	Currency           string           `json:"currency" db:"currency"`
	StartDate          time.Time        `json:"start_date" db:"start_date"`
	EndDate            time.Time        `json:"end_date" db:"end_date"`
	NextPremiumDueDate *time.Time       `json:"next_premium_due_date" db:"next_premium_due_date"`
	Beneficiaries      string           `json:"beneficiaries" db:"beneficiaries"`
	CoverageDetails    string           `json:"coverage_details" db:"coverage_details"`
	Exclusions         string           `json:"exclusions" db:"exclusions"`
	Metadata           string           `json:"metadata" db:"metadata"`
	CreatedAt          time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at" db:"updated_at"`
	IssuedAt           *time.Time       `json:"issued_at" db:"issued_at"`
	CancelledAt        *time.Time       `json:"cancelled_at" db:"cancelled_at"`
}

// CreatePolicyRequest represents a request to create a policy
type CreatePolicyRequest struct {
	CustomerID       uuid.UUID        `json:"customer_id" binding:"required"`
	AgentID          *uuid.UUID       `json:"agent_id"`
	PolicyType       PolicyType       `json:"policy_type" binding:"required"`
	PremiumAmount    int64            `json:"premium_amount" binding:"required,gt=0"`
	PremiumFrequency PremiumFrequency `json:"premium_frequency" binding:"required"`
	SumAssured       int64            `json:"sum_assured" binding:"required,gt=0"`
	Currency         string           `json:"currency" binding:"required"`
	StartDate        time.Time        `json:"start_date" binding:"required"`
	DurationMonths   int              `json:"duration_months" binding:"required,gt=0"`
	Beneficiaries    []Beneficiary    `json:"beneficiaries"`
	CoverageDetails  map[string]interface{} `json:"coverage_details"`
	Metadata         map[string]interface{} `json:"metadata"`
}

// Beneficiary represents a policy beneficiary
type Beneficiary struct {
	Name         string  `json:"name" binding:"required"`
	Relationship string  `json:"relationship" binding:"required"`
	Percentage   float64 `json:"percentage" binding:"required,gt=0,lte=100"`
	NIN          string  `json:"nin"`
	PhoneNumber  string  `json:"phone_number"`
}

// UpdatePolicyRequest represents a request to update a policy
type UpdatePolicyRequest struct {
	Status          *PolicyStatus `json:"status"`
	PremiumAmount   *int64        `json:"premium_amount"`
	SumAssured      *int64        `json:"sum_assured"`
	Beneficiaries   []Beneficiary `json:"beneficiaries"`
	CoverageDetails map[string]interface{} `json:"coverage_details"`
}

// PolicyQuoteRequest represents a request for a policy quote
type PolicyQuoteRequest struct {
	CustomerID       uuid.UUID        `json:"customer_id" binding:"required"`
	PolicyType       PolicyType       `json:"policy_type" binding:"required"`
	SumAssured       int64            `json:"sum_assured" binding:"required,gt=0"`
	DurationMonths   int              `json:"duration_months" binding:"required,gt=0"`
	PremiumFrequency PremiumFrequency `json:"premium_frequency" binding:"required"`
	RiskFactors      map[string]interface{} `json:"risk_factors"`
}

// PolicyQuoteResponse represents a policy quote response
type PolicyQuoteResponse struct {
	QuoteID          uuid.UUID        `json:"quote_id"`
	CustomerID       uuid.UUID        `json:"customer_id"`
	PolicyType       PolicyType       `json:"policy_type"`
	SumAssured       int64            `json:"sum_assured"`
	PremiumAmount    int64            `json:"premium_amount"`
	PremiumFrequency PremiumFrequency `json:"premium_frequency"`
	DurationMonths   int              `json:"duration_months"`
	ValidUntil       time.Time        `json:"valid_until"`
	RiskScore        float64          `json:"risk_score"`
	CreatedAt        time.Time        `json:"created_at"`
}

// PolicyEndorsement represents a change to an existing policy
type PolicyEndorsement struct {
	ID              uuid.UUID `json:"id" db:"id"`
	PolicyID        uuid.UUID `json:"policy_id" db:"policy_id"`
	EndorsementType string    `json:"endorsement_type" db:"endorsement_type"`
	Description     string    `json:"description" db:"description"`
	EffectiveDate   time.Time `json:"effective_date" db:"effective_date"`
	PremiumChange   int64     `json:"premium_change" db:"premium_change"`
	Changes         string    `json:"changes" db:"changes"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	ApprovedAt      *time.Time `json:"approved_at" db:"approved_at"`
	ApprovedBy      *uuid.UUID `json:"approved_by" db:"approved_by"`
}

// PolicyRenewal represents a policy renewal
type PolicyRenewal struct {
	ID                uuid.UUID    `json:"id" db:"id"`
	PolicyID          uuid.UUID    `json:"policy_id" db:"policy_id"`
	OldEndDate        time.Time    `json:"old_end_date" db:"old_end_date"`
	NewEndDate        time.Time    `json:"new_end_date" db:"new_end_date"`
	OldPremiumAmount  int64        `json:"old_premium_amount" db:"old_premium_amount"`
	NewPremiumAmount  int64        `json:"new_premium_amount" db:"new_premium_amount"`
	Status            PolicyStatus `json:"status" db:"status"`
	CreatedAt         time.Time    `json:"created_at" db:"created_at"`
	CompletedAt       *time.Time   `json:"completed_at" db:"completed_at"`
}

// PolicyEvent represents a policy event for Kafka (Mojaloop-inspired)
type PolicyEvent struct {
	EventID       uuid.UUID              `json:"event_id"`
	EventType     string                 `json:"event_type"`
	PolicyID      uuid.UUID              `json:"policy_id"`
	PolicyNumber  string                 `json:"policy_number"`
	CustomerID    uuid.UUID              `json:"customer_id"`
	PolicyType    PolicyType             `json:"policy_type"`
	Status        PolicyStatus           `json:"status"`
	Timestamp     time.Time              `json:"timestamp"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// MojalloopTransferRequest represents a Mojaloop-style transfer request
type MojalloopTransferRequest struct {
	TransferID      string                 `json:"transferId"`
	PayerFSP        string                 `json:"payerFsp"`
	PayeeFSP        string                 `json:"payeeFsp"`
	Amount          Amount                 `json:"amount"`
	TransactionType TransactionType        `json:"transactionType"`
	Note            string                 `json:"note"`
	ExtensionList   []Extension            `json:"extensionList,omitempty"`
}

// Amount represents a monetary amount (Mojaloop pattern)
type Amount struct {
	Currency string `json:"currency"`
	Amount   string `json:"amount"`
}

// TransactionType represents the type of transaction (Mojaloop pattern)
type TransactionType struct {
	Scenario        string `json:"scenario"`
	Initiator       string `json:"initiator"`
	InitiatorType   string `json:"initiatorType"`
}

// Extension represents additional metadata (Mojaloop pattern)
type Extension struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// MojalloopTransferResponse represents a Mojaloop-style transfer response
type MojalloopTransferResponse struct {
	TransferID       string    `json:"transferId"`
	TransferState    string    `json:"transferState"`
	CompletedTime    time.Time `json:"completedTimestamp"`
	FulfilmentBase64 string    `json:"fulfilment"`
}
