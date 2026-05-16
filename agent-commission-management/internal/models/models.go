package models

import (
	"time"

	"github.com/google/uuid"
)

type Agent struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	AgentCode       string    `json:"agent_code" gorm:"uniqueIndex;not null"`
	FullName        string    `json:"full_name" gorm:"not null"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	AgentType       string    `json:"agent_type"` // individual, corporate, broker, bancassurance
	LicenseNumber   string    `json:"license_number"`
	TierLevel       string    `json:"tier_level" gorm:"default:'bronze'"` // bronze, silver, gold, platinum
	Region          string    `json:"region"`
	BankName        string    `json:"bank_name"`
	AccountNumber   string    `json:"account_number"`
	TaxID           string    `json:"tax_id"`
	Status          string    `json:"status" gorm:"default:'active'"` // active, suspended, terminated
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type CommissionStructure struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	Name            string    `json:"name" gorm:"not null"`
	ProductType     string    `json:"product_type" gorm:"index"` // life, motor, health, property, marine
	AgentType       string    `json:"agent_type"`
	TierLevel       string    `json:"tier_level"`
	BaseRate        float64   `json:"base_rate"`
	RenewalRate     float64   `json:"renewal_rate"`
	OverrideRate    float64   `json:"override_rate"`
	BonusThreshold  float64   `json:"bonus_threshold"`
	BonusRate       float64   `json:"bonus_rate"`
	ClawbackPeriod  int       `json:"clawback_period"` // months
	ClawbackRate    float64   `json:"clawback_rate"`
	EffectiveFrom   time.Time `json:"effective_from"`
	EffectiveTo     *time.Time `json:"effective_to"`
	Status          string    `json:"status" gorm:"default:'active'"`
	CreatedAt       time.Time `json:"created_at"`
}

type CommissionTransaction struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	AgentID         uuid.UUID `json:"agent_id" gorm:"type:uuid;index;not null"`
	PolicyID        string    `json:"policy_id" gorm:"index"`
	PolicyNumber    string    `json:"policy_number"`
	ProductType     string    `json:"product_type"`
	TransactionType string    `json:"transaction_type"` // initial, renewal, override, bonus, clawback, adjustment
	GrossPremium    float64   `json:"gross_premium"`
	CommissionRate  float64   `json:"commission_rate"`
	GrossCommission float64   `json:"gross_commission"`
	WithholdingTax  float64   `json:"withholding_tax"`
	NetCommission   float64   `json:"net_commission"`
	Period          string    `json:"period"`
	Status          string    `json:"status" gorm:"default:'pending'"` // pending, approved, paid, reversed
	ApprovedBy      string    `json:"approved_by"`
	PaidAt          *time.Time `json:"paid_at"`
	PaymentRef      string    `json:"payment_ref"`
	CreatedAt       time.Time `json:"created_at"`
}

type CommissionPayment struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	AgentID         uuid.UUID `json:"agent_id" gorm:"type:uuid;index"`
	PaymentRef      string    `json:"payment_ref" gorm:"uniqueIndex"`
	Period          string    `json:"period"`
	TotalGross      float64   `json:"total_gross"`
	TotalTax        float64   `json:"total_tax"`
	TotalNet        float64   `json:"total_net"`
	TransactionCount int      `json:"transaction_count"`
	BankName        string    `json:"bank_name"`
	AccountNumber   string    `json:"account_number"`
	Status          string    `json:"status" gorm:"default:'pending'"` // pending, processing, completed, failed
	ProcessedAt     *time.Time `json:"processed_at"`
	CreatedAt       time.Time `json:"created_at"`
}

type AgentPerformance struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primaryKey"`
	AgentID           uuid.UUID `json:"agent_id" gorm:"type:uuid;index"`
	Period            string    `json:"period"`
	PoliciesSold      int       `json:"policies_sold"`
	TotalPremium      float64   `json:"total_premium"`
	TotalCommission   float64   `json:"total_commission"`
	RenewalRate       float64   `json:"renewal_rate_pct"`
	ClaimRatio        float64   `json:"claim_ratio"`
	CustomerSatisfaction float64 `json:"customer_satisfaction"`
	TierQualified     string    `json:"tier_qualified"`
	CreatedAt         time.Time `json:"created_at"`
}

type ClawbackRecord struct {
	ID                uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	OriginalTxnID     uuid.UUID  `json:"original_txn_id" gorm:"type:uuid"`
	AgentID           uuid.UUID  `json:"agent_id" gorm:"type:uuid;index"`
	PolicyID          string     `json:"policy_id"`
	OriginalCommission float64   `json:"original_commission"`
	ClawbackAmount    float64    `json:"clawback_amount"`
	Reason            string     `json:"reason"` // cancellation, lapse, fraud
	PolicyCancelDate  time.Time  `json:"policy_cancel_date"`
	Status            string     `json:"status" gorm:"default:'pending'"` // pending, applied, waived
	CreatedAt         time.Time  `json:"created_at"`
}
