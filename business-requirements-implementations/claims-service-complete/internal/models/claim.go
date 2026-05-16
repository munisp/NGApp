package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ClaimStatus represents the status of a claim
type ClaimStatus string

const (
	ClaimStatusDraft        ClaimStatus = "DRAFT"
	ClaimStatusSubmitted    ClaimStatus = "SUBMITTED"
	ClaimStatusUnderReview  ClaimStatus = "UNDER_REVIEW"
	ClaimStatusInvestigating ClaimStatus = "INVESTIGATING"
	ClaimStatusApproved     ClaimStatus = "APPROVED"
	ClaimStatusDenied       ClaimStatus = "DENIED"
	ClaimStatusSettled      ClaimStatus = "SETTLED"
	ClaimStatusClosed       ClaimStatus = "CLOSED"
	ClaimStatusAppealed     ClaimStatus = "APPEALED"
)

// ClaimType represents the type of claim
type ClaimType string

const (
	ClaimTypeProperty  ClaimType = "PROPERTY"
	ClaimTypeHealth    ClaimType = "HEALTH"
	ClaimTypeAuto      ClaimType = "AUTO"
	ClaimTypeLife      ClaimType = "LIFE"
	ClaimTypeTravel    ClaimType = "TRAVEL"
	ClaimTypeLiability ClaimType = "LIABILITY"
)

// Claim represents a claim entity
type Claim struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimNumber       string         `gorm:"uniqueIndex;not null" json:"claim_number"`
	PolicyID          uuid.UUID      `gorm:"type:uuid;not null;index" json:"policy_id"`
	PolicyNumber      string         `gorm:"not null;index" json:"policy_number"`
	PolicyHolderID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"policy_holder_id"`
	PolicyHolderName  string         `gorm:"not null" json:"policy_holder_name"`
	ClaimType         ClaimType      `gorm:"type:varchar(50);not null;index" json:"claim_type"`
	Status            ClaimStatus    `gorm:"type:varchar(50);not null;index" json:"status"`
	IncidentDate      time.Time      `gorm:"not null" json:"incident_date"`
	ReportedDate      time.Time      `gorm:"not null" json:"reported_date"`
	IncidentLocation  string         `gorm:"type:text" json:"incident_location"`
	IncidentLatitude  *float64       `json:"incident_latitude,omitempty"`
	IncidentLongitude *float64       `json:"incident_longitude,omitempty"`
	Description       string         `gorm:"type:text;not null" json:"description"`
	ClaimedAmount     float64        `gorm:"not null" json:"claimed_amount"`
	ApprovedAmount    *float64       `json:"approved_amount,omitempty"`
	SettledAmount     *float64       `json:"settled_amount,omitempty"`
	ReserveAmount     float64        `gorm:"default:0" json:"reserve_amount"`
	DeductibleAmount  float64        `gorm:"default:0" json:"deductible_amount"`
	AdjusterID        *uuid.UUID     `gorm:"type:uuid;index" json:"adjuster_id,omitempty"`
	AdjusterName      string         `json:"adjuster_name,omitempty"`
	FraudScore        *float64       `json:"fraud_score,omitempty"`
	FraudFlags        []string       `gorm:"type:text[]" json:"fraud_flags,omitempty"`
	IsFraudulent      bool           `gorm:"default:false" json:"is_fraudulent"`
	DenialReason      string         `gorm:"type:text" json:"denial_reason,omitempty"`
	SettlementDate    *time.Time     `json:"settlement_date,omitempty"`
	ClosedDate        *time.Time     `json:"closed_date,omitempty"`
	TemporalWorkflowID string        `gorm:"index" json:"temporal_workflow_id,omitempty"`
	TemporalRunID     string         `json:"temporal_run_id,omitempty"`
	Metadata          map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	Documents         []ClaimDocument `gorm:"foreignKey:ClaimID" json:"documents,omitempty"`
	Activities        []ClaimActivity `gorm:"foreignKey:ClaimID" json:"activities,omitempty"`
	Payments          []ClaimPayment  `gorm:"foreignKey:ClaimID" json:"payments,omitempty"`
	CreatedAt         time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"not null;default:now()" json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// ClaimDocument represents a document attached to a claim
type ClaimDocument struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	DocumentType string         `gorm:"not null" json:"document_type"`
	FileName     string         `gorm:"not null" json:"file_name"`
	FileSize     int64          `gorm:"not null" json:"file_size"`
	FileURL      string         `gorm:"not null" json:"file_url"`
	MimeType     string         `gorm:"not null" json:"mime_type"`
	UploadedBy   uuid.UUID      `gorm:"type:uuid;not null" json:"uploaded_by"`
	UploadedAt   time.Time      `gorm:"not null;default:now()" json:"uploaded_at"`
	Verified     bool           `gorm:"default:false" json:"verified"`
	VerifiedBy   *uuid.UUID     `gorm:"type:uuid" json:"verified_by,omitempty"`
	VerifiedAt   *time.Time     `json:"verified_at,omitempty"`
	Metadata     map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt    time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"not null;default:now()" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// ClaimActivity represents an activity log entry for a claim
type ClaimActivity struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	ActivityType string        `gorm:"not null" json:"activity_type"`
	Description string         `gorm:"type:text;not null" json:"description"`
	PerformedBy uuid.UUID      `gorm:"type:uuid;not null" json:"performed_by"`
	PerformedByName string      `json:"performed_by_name"`
	PreviousStatus *ClaimStatus `gorm:"type:varchar(50)" json:"previous_status,omitempty"`
	NewStatus    *ClaimStatus   `gorm:"type:varchar(50)" json:"new_status,omitempty"`
	Metadata     map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt    time.Time      `gorm:"not null;default:now()" json:"created_at"`
}

// ClaimPayment represents a payment made for a claim
type ClaimPayment struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID           uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	PaymentType       string         `gorm:"not null" json:"payment_type"` // SETTLEMENT, PARTIAL, DEDUCTIBLE
	Amount            float64        `gorm:"not null" json:"amount"`
	Currency          string         `gorm:"default:'NGN'" json:"currency"`
	PaymentMethod     string         `gorm:"not null" json:"payment_method"`
	PaymentReference  string         `gorm:"uniqueIndex;not null" json:"payment_reference"`
	TigerBeetleTransferID uint64     `gorm:"uniqueIndex" json:"tigerbeetle_transfer_id,omitempty"`
	Status            string         `gorm:"not null;default:'PENDING'" json:"status"`
	PayeeID           uuid.UUID      `gorm:"type:uuid;not null" json:"payee_id"`
	PayeeName         string         `gorm:"not null" json:"payee_name"`
	PayeeAccountNumber string        `json:"payee_account_number,omitempty"`
	PayeeBankCode     string         `json:"payee_bank_code,omitempty"`
	ProcessedAt       *time.Time     `json:"processed_at,omitempty"`
	FailureReason     string         `gorm:"type:text" json:"failure_reason,omitempty"`
	Metadata          map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt         time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// ClaimReserve represents reserve calculations for a claim
type ClaimReserve struct {
	ID               uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID          uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	ReserveType      string         `gorm:"not null" json:"reserve_type"` // CASE, IBNR, EXPENSE
	Amount           float64        `gorm:"not null" json:"amount"`
	CalculationMethod string        `gorm:"not null" json:"calculation_method"`
	CalculatedBy     uuid.UUID      `gorm:"type:uuid;not null" json:"calculated_by"`
	CalculatedAt     time.Time      `gorm:"not null;default:now()" json:"calculated_at"`
	ApprovedBy       *uuid.UUID     `gorm:"type:uuid" json:"approved_by,omitempty"`
	ApprovedAt       *time.Time     `json:"approved_at,omitempty"`
	IsActive         bool           `gorm:"default:true" json:"is_active"`
	Notes            string         `gorm:"type:text" json:"notes,omitempty"`
	Metadata         map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt        time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt        time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// ClaimAppeal represents an appeal for a denied claim
type ClaimAppeal struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	AppealNumber    string         `gorm:"uniqueIndex;not null" json:"appeal_number"`
	AppealReason    string         `gorm:"type:text;not null" json:"appeal_reason"`
	AdditionalEvidence string      `gorm:"type:text" json:"additional_evidence,omitempty"`
	SubmittedBy     uuid.UUID      `gorm:"type:uuid;not null" json:"submitted_by"`
	SubmittedAt     time.Time      `gorm:"not null;default:now()" json:"submitted_at"`
	ReviewedBy      *uuid.UUID     `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time     `json:"reviewed_at,omitempty"`
	Decision        string         `gorm:"type:varchar(50)" json:"decision,omitempty"` // UPHELD, OVERTURNED, PARTIAL
	DecisionReason  string         `gorm:"type:text" json:"decision_reason,omitempty"`
	RevisedAmount   *float64       `json:"revised_amount,omitempty"`
	Status          string         `gorm:"not null;default:'PENDING'" json:"status"`
	TemporalWorkflowID string      `gorm:"index" json:"temporal_workflow_id,omitempty"`
	Metadata        map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt       time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// SubrogationCase represents a subrogation case for a claim
type SubrogationCase struct {
	ID                uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID           uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	CaseNumber        string         `gorm:"uniqueIndex;not null" json:"case_number"`
	ThirdPartyName    string         `gorm:"not null" json:"third_party_name"`
	ThirdPartyContact string         `json:"third_party_contact,omitempty"`
	ThirdPartyInsurer string         `json:"third_party_insurer,omitempty"`
	AmountClaimed     float64        `gorm:"not null" json:"amount_claimed"`
	AmountRecovered   float64        `gorm:"default:0" json:"amount_recovered"`
	Status            string         `gorm:"not null;default:'INITIATED'" json:"status"`
	InitiatedBy       uuid.UUID      `gorm:"type:uuid;not null" json:"initiated_by"`
	InitiatedAt       time.Time      `gorm:"not null;default:now()" json:"initiated_at"`
	SettledAt         *time.Time     `json:"settled_at,omitempty"`
	Notes             string         `gorm:"type:text" json:"notes,omitempty"`
	TemporalWorkflowID string        `gorm:"index" json:"temporal_workflow_id,omitempty"`
	Metadata          map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt         time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt         time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// MedicalBill represents a medical bill for health claims
type MedicalBill struct {
	ID              uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ClaimID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"claim_id"`
	BillNumber      string         `gorm:"uniqueIndex;not null" json:"bill_number"`
	ProviderName    string         `gorm:"not null" json:"provider_name"`
	ProviderID      string         `json:"provider_id,omitempty"`
	ServiceDate     time.Time      `gorm:"not null" json:"service_date"`
	BillAmount      float64        `gorm:"not null" json:"bill_amount"`
	ApprovedAmount  *float64       `json:"approved_amount,omitempty"`
	AdjustedAmount  *float64       `json:"adjusted_amount,omitempty"`
	DiagnosisCode   string         `json:"diagnosis_code,omitempty"`
	ProcedureCode   string         `json:"procedure_code,omitempty"`
	ReviewStatus    string         `gorm:"not null;default:'PENDING'" json:"review_status"`
	ReviewedBy      *uuid.UUID     `gorm:"type:uuid" json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time     `json:"reviewed_at,omitempty"`
	ReviewNotes     string         `gorm:"type:text" json:"review_notes,omitempty"`
	AIReviewScore   *float64       `json:"ai_review_score,omitempty"`
	AIReviewFlags   []string       `gorm:"type:text[]" json:"ai_review_flags,omitempty"`
	Metadata        map[string]interface{} `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt       time.Time      `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt       time.Time      `gorm:"not null;default:now()" json:"updated_at"`
}

// TableName overrides
func (Claim) TableName() string              { return "claims" }
func (ClaimDocument) TableName() string      { return "claim_documents" }
func (ClaimActivity) TableName() string      { return "claim_activities" }
func (ClaimPayment) TableName() string       { return "claim_payments" }
func (ClaimReserve) TableName() string       { return "claim_reserves" }
func (ClaimAppeal) TableName() string        { return "claim_appeals" }
func (SubrogationCase) TableName() string    { return "subrogation_cases" }
func (MedicalBill) TableName() string        { return "medical_bills" }
