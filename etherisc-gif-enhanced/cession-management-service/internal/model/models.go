package model

import (
	"time"

	"github.com/google/uuid"
)

// CessionType defines the type of cession (Premium or Claim)
type CessionType string

const (
	CessionTypePremium CessionType = "PREMIUM"
	CessionTypeClaim   CessionType = "CLAIM"
)

// Cession represents a single cession event (premium or claim)
type Cession struct {
	ID            uuid.UUID   `json:"id" gorm:"type:uuid;primaryKey"`
	PolicyID      uuid.UUID   `json:"policy_id" gorm:"type:uuid;not null"`
	ReinsurerID   uuid.UUID   `json:"reinsurer_id" gorm:"type:uuid;not null"`
	Type          CessionType `json:"type" gorm:"type:varchar(10);not null"`
	Amount        float64     `json:"amount" gorm:"type:numeric;not null"`
	Currency      string      `json:"currency" gorm:"type:varchar(3);not null"`
	CededShare    float64     `json:"ceded_share" gorm:"type:numeric;not null"` // e.g., 0.5 for 50%
	EffectiveDate time.Time   `json:"effective_date" gorm:"not null"`
	CreatedAt     time.Time   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time   `json:"updated_at" gorm:"autoUpdateTime"`
}

// CessionCalculation represents the result of the cession calculation engine for a single event
type CessionCalculation struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	CessionID     uuid.UUID `json:"cession_id" gorm:"type:uuid;not null"`
	CededAmount   float64   `json:"ceded_amount" gorm:"type:numeric;not null"`
	Commission    float64   `json:"commission" gorm:"type:numeric;not null"` // Commission paid to the ceding company
	NetPayable    float64   `json:"net_payable" gorm:"type:numeric;not null"` // Amount to be paid to or received from reinsurer
	CalculationAt time.Time `json:"calculation_at" gorm:"autoCreateTime"`
}

// ReinsurerBalance tracks the running balance for a reinsurer
type ReinsurerBalance struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	ReinsurerID   uuid.UUID `json:"reinsurer_id" gorm:"type:uuid;uniqueIndex:idx_reinsurer_month;not null"`
	Month         time.Time `json:"month" gorm:"type:date;uniqueIndex:idx_reinsurer_month;not null"` // First day of the month
	TotalPremium  float64   `json:"total_premium" gorm:"type:numeric;default:0"`
	TotalClaim    float64   `json:"total_claim" gorm:"type:numeric;default:0"`
	TotalCommission float64 `json:"total_commission" gorm:"type:numeric;default:0"`
	NetBalance    float64   `json:"net_balance" gorm:"type:numeric;default:0"` // Positive: Reinsurer owes us, Negative: We owe reinsurer
	LastUpdated   time.Time `json:"last_updated" gorm:"autoUpdateTime"`
}

// BordereauStatus defines the status of a bordereau
type BordereauStatus string

const (
	BordereauStatusDraft     BordereauStatus = "DRAFT"
	BordereauStatusGenerated BordereauStatus = "GENERATED"
	BordereauStatusSent      BordereauStatus = "SENT"
	BordereauStatusSettled   BordereauStatus = "SETTLED"
)

// Bordereau represents the monthly statement sent to a reinsurer
type Bordereau struct {
	ID            uuid.UUID       `json:"id" gorm:"type:uuid;primaryKey"`
	ReinsurerID   uuid.UUID       `json:"reinsurer_id" gorm:"type:uuid;not null"`
	StatementMonth time.Time      `json:"statement_month" gorm:"type:date;not null"` // First day of the month
	Status        BordereauStatus `json:"status" gorm:"type:varchar(10);not null"`
	TotalNetPayable float64       `json:"total_net_payable" gorm:"type:numeric;not null"`
	FilePath      string          `json:"file_path" gorm:"type:varchar(255)"` // Path to the generated PDF/CSV file
	GeneratedAt   time.Time       `json:"generated_at" gorm:"autoCreateTime"`
	SentAt        *time.Time      `json:"sent_at"`
}

// SettlementWorkflow represents the final payment/settlement event
type SettlementWorkflow struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	BordereauID   uuid.UUID `json:"bordereau_id" gorm:"type:uuid;not null"`
	PaymentRef    string    `json:"payment_ref" gorm:"type:varchar(255)"` // Reference from Payment Service/TigerBeetle
	Amount        float64   `json:"amount" gorm:"type:numeric;not null"`
	Direction     string    `json:"direction" gorm:"type:varchar(10)"` // "IN" or "OUT"
	SettledAt     time.Time `json:"settled_at" gorm:"autoCreateTime"`
}
