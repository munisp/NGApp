package models

import (
	"time"

	"github.com/google/uuid"
)

type ClaimStatus string
type RuleType string
type DecisionType string

const (
	ClaimStatusPending    ClaimStatus = "PENDING"
	ClaimStatusInReview   ClaimStatus = "IN_REVIEW"
	ClaimStatusApproved   ClaimStatus = "APPROVED"
	ClaimStatusRejected   ClaimStatus = "REJECTED"
	ClaimStatusEscalated  ClaimStatus = "ESCALATED"
	ClaimStatusPaid       ClaimStatus = "PAID"

	RuleTypeEligibility   RuleType = "ELIGIBILITY"
	RuleTypeCoverage      RuleType = "COVERAGE"
	RuleTypeFraud         RuleType = "FRAUD"
	RuleTypeLimit         RuleType = "LIMIT"
	RuleTypeDeductible    RuleType = "DEDUCTIBLE"

	DecisionTypeAutoApprove DecisionType = "AUTO_APPROVE"
	DecisionTypeAutoReject  DecisionType = "AUTO_REJECT"
	DecisionTypeManualReview DecisionType = "MANUAL_REVIEW"
	DecisionTypeEscalate    DecisionType = "ESCALATE"
)

type Claim struct {
	ID              uuid.UUID   `json:"id" gorm:"type:uuid;primary_key"`
	PolicyID        uuid.UUID   `json:"policy_id" gorm:"type:uuid;not null;index"`
	ClaimNumber     string      `json:"claim_number" gorm:"type:varchar(50);unique"`
	ClaimType       string      `json:"claim_type" gorm:"type:varchar(50)"`
	Status          ClaimStatus `json:"status" gorm:"type:varchar(20);not null"`
	ClaimAmount     float64     `json:"claim_amount" gorm:"type:decimal(20,2)"`
	ApprovedAmount  float64     `json:"approved_amount" gorm:"type:decimal(20,2)"`
	DeductibleAmount float64    `json:"deductible_amount" gorm:"type:decimal(20,2)"`
	IncidentDate    time.Time   `json:"incident_date"`
	ReportedDate    time.Time   `json:"reported_date"`
	Description     string      `json:"description" gorm:"type:text"`
	ClaimantID      uuid.UUID   `json:"claimant_id" gorm:"type:uuid"`
	AssignedTo      *uuid.UUID  `json:"assigned_to" gorm:"type:uuid"`
	FraudScore      float64     `json:"fraud_score" gorm:"type:decimal(5,2)"`
	Priority        int         `json:"priority" gorm:"default:5"`
	CreatedAt       time.Time   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time   `json:"updated_at" gorm:"autoUpdateTime"`
}

type AdjudicationRule struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	Name        string    `json:"name" gorm:"type:varchar(100);not null"`
	Description string    `json:"description" gorm:"type:text"`
	RuleType    RuleType  `json:"rule_type" gorm:"type:varchar(50);not null"`
	Condition   string    `json:"condition" gorm:"type:jsonb;not null"`
	Action      string    `json:"action" gorm:"type:jsonb;not null"`
	Priority    int       `json:"priority" gorm:"default:100"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	ProductType string    `json:"product_type" gorm:"type:varchar(50)"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type AdjudicationDecision struct {
	ID           uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID      uuid.UUID    `json:"claim_id" gorm:"type:uuid;not null;index"`
	DecisionType DecisionType `json:"decision_type" gorm:"type:varchar(30);not null"`
	RulesApplied string       `json:"rules_applied" gorm:"type:jsonb"`
	Reasoning    string       `json:"reasoning" gorm:"type:text"`
	DecidedBy    string       `json:"decided_by" gorm:"type:varchar(50)"`
	DecidedAt    time.Time    `json:"decided_at" gorm:"autoCreateTime"`
	IsOverridden bool         `json:"is_overridden" gorm:"default:false"`
	OverriddenBy *uuid.UUID   `json:"overridden_by" gorm:"type:uuid"`
	OverrideReason string     `json:"override_reason" gorm:"type:text"`
}

type ClaimDocument struct {
	ID           uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID      uuid.UUID `json:"claim_id" gorm:"type:uuid;not null;index"`
	DocumentType string    `json:"document_type" gorm:"type:varchar(50)"`
	FileName     string    `json:"file_name" gorm:"type:varchar(255)"`
	FilePath     string    `json:"file_path" gorm:"type:varchar(500)"`
	FileSize     int64     `json:"file_size"`
	MimeType     string    `json:"mime_type" gorm:"type:varchar(100)"`
	IsVerified   bool      `json:"is_verified" gorm:"default:false"`
	VerifiedBy   *uuid.UUID `json:"verified_by" gorm:"type:uuid"`
	UploadedAt   time.Time `json:"uploaded_at" gorm:"autoCreateTime"`
}

type ClaimPayment struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ClaimID       uuid.UUID `json:"claim_id" gorm:"type:uuid;not null;index"`
	PaymentAmount float64   `json:"payment_amount" gorm:"type:decimal(20,2)"`
	PaymentMethod string    `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentRef    string    `json:"payment_ref" gorm:"type:varchar(100)"`
	BankAccount   string    `json:"bank_account" gorm:"type:varchar(50)"`
	BankName      string    `json:"bank_name" gorm:"type:varchar(100)"`
	Status        string    `json:"status" gorm:"type:varchar(20)"`
	ProcessedAt   *time.Time `json:"processed_at"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}
