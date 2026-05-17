package model

import (
	"time"

	"github.com/google/uuid"
)

type CessionType string

const (
	CessionTypePremium CessionType = "PREMIUM"
	CessionTypeClaim   CessionType = "CLAIM"
)

type Treaty struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	Name         string    `json:"name"`
	ReinsurerID  string    `json:"reinsurer_id"`
	Type         string    `json:"type"`
	RetentionPct float64   `json:"retention_pct"`
	MaxCession   float64   `json:"max_cession"`
	Status       string    `json:"status"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	CreatedAt    time.Time `json:"created_at"`
}

type Cession struct {
	ID              uuid.UUID   `json:"id" gorm:"primaryKey;type:uuid"`
	TreatyID        string      `json:"treaty_id"`
	PolicyID        uuid.UUID   `json:"policy_id" gorm:"type:uuid"`
	ReinsurerID     uuid.UUID   `json:"reinsurer_id" gorm:"type:uuid"`
	Type            CessionType `json:"type"`
	Amount          float64     `json:"amount"`
	Currency        string      `json:"currency"`
	CededShare      float64     `json:"ceded_share"`
	CededPremium    float64     `json:"ceded_premium"`
	RetainedPremium float64     `json:"retained_premium"`
	CededRisk       float64     `json:"ceded_risk"`
	RetainedRisk    float64     `json:"retained_risk"`
	Commission      float64     `json:"commission"`
	Status          string      `json:"status"`
	EffectiveDate   time.Time   `json:"effective_date"`
	CreatedAt       time.Time   `json:"created_at"`
}

type CessionSummary struct {
	TotalCeded    float64 `json:"total_ceded"`
	TotalRetained float64 `json:"total_retained"`
	TotalPolicies int     `json:"total_policies"`
	AvgRetention  float64 `json:"avg_retention_pct"`
}

type CessionCalculation struct {
	ID              uuid.UUID `json:"id" gorm:"primaryKey;type:uuid"`
	CessionID       uuid.UUID `json:"cession_id" gorm:"type:uuid"`
	TreatyID        string    `json:"treaty_id"`
	PolicyID        uuid.UUID `json:"policy_id" gorm:"type:uuid"`
	ReinsurerID     uuid.UUID `json:"reinsurer_id" gorm:"type:uuid"`
	GrossPremium    float64   `json:"gross_premium"`
	CededAmount     float64   `json:"ceded_amount"`
	CededPremium    float64   `json:"ceded_premium"`
	RetainedPremium float64   `json:"retained_premium"`
	Commission      float64   `json:"commission"`
	NetPayable      float64   `json:"net_payable"`
	Method          string    `json:"method"`
	CalculatedAt    time.Time `json:"calculated_at"`
}

type ReinsurerBalance struct {
	ID              uuid.UUID `json:"id" gorm:"primaryKey;type:uuid"`
	ReinsurerID     uuid.UUID `json:"reinsurer_id" gorm:"type:uuid"`
	TreatyID        string    `json:"treaty_id"`
	Month           time.Time `json:"month"`
	TotalPremium    float64   `json:"total_premium"`
	TotalClaim      float64   `json:"total_claim"`
	TotalCommission float64   `json:"total_commission"`
	PremiumOwed     float64   `json:"premium_owed"`
	PremiumPaid     float64   `json:"premium_paid"`
	ClaimsOwed      float64   `json:"claims_owed"`
	ClaimsPaid      float64   `json:"claims_paid"`
	NetBalance      float64   `json:"net_balance"`
	Currency        string    `json:"currency"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type BordereauStatus string

const (
	BordereauDraft      BordereauStatus = "draft"
	BordereauSubmitted  BordereauStatus = "submitted"
	BordereauAccepted   BordereauStatus = "accepted"
	BordereauRejected   BordereauStatus = "rejected"
	BordereauStatusSent BordereauStatus = "sent"
)

type Bordereau struct {
	ID              uuid.UUID       `json:"id" gorm:"primaryKey;type:uuid"`
	TreatyID        string          `json:"treaty_id"`
	ReinsurerID     uuid.UUID       `json:"reinsurer_id" gorm:"type:uuid"`
	Type            string          `json:"type"`
	StatementMonth  time.Time       `json:"statement_month"`
	PeriodStart     time.Time       `json:"period_start"`
	PeriodEnd       time.Time       `json:"period_end"`
	TotalPremium    float64         `json:"total_premium"`
	TotalClaims     float64         `json:"total_claims"`
	TotalNetPayable float64         `json:"total_net_payable"`
	LineItems       int             `json:"line_items"`
	Status          BordereauStatus `json:"status"`
	FilePath        string          `json:"file_path"`
	SubmittedAt     time.Time       `json:"submitted_at"`
	CreatedAt       time.Time       `json:"created_at"`
}

type SettlementWorkflow struct {
	ID          uuid.UUID `json:"id" gorm:"primaryKey;type:uuid"`
	TreatyID    string    `json:"treaty_id"`
	ReinsurerID uuid.UUID `json:"reinsurer_id" gorm:"type:uuid"`
	BordereauID uuid.UUID `json:"bordereau_id" gorm:"type:uuid"`
	PaymentRef  string    `json:"payment_ref"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Direction   string    `json:"direction"`
	Status      string    `json:"status"`
	InitiatedBy string    `json:"initiated_by"`
	ApprovedBy  string    `json:"approved_by"`
	SettledAt   time.Time `json:"settled_at"`
	CreatedAt   time.Time `json:"created_at"`
}
