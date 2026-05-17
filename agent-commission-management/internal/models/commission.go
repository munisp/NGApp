package models

import (
	"time"

	"github.com/google/uuid"
)

type CommissionStatus string
type PayoutStatus string

const (
	CommissionStatusPending   CommissionStatus = "PENDING"
	CommissionStatusApproved  CommissionStatus = "APPROVED"
	CommissionStatusPaid      CommissionStatus = "PAID"
	CommissionStatusCancelled CommissionStatus = "CANCELLED"

	PayoutStatusPending    PayoutStatus = "PENDING"
	PayoutStatusProcessing PayoutStatus = "PROCESSING"
	PayoutStatusCompleted  PayoutStatus = "COMPLETED"
	PayoutStatusFailed     PayoutStatus = "FAILED"
)

type Agent struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	AgentCode     string    `json:"agent_code" gorm:"type:varchar(20);unique"`
	FirstName     string    `json:"first_name" gorm:"type:varchar(100)"`
	LastName      string    `json:"last_name" gorm:"type:varchar(100)"`
	Email         string    `json:"email" gorm:"type:varchar(255);unique"`
	Phone         string    `json:"phone" gorm:"type:varchar(20)"`
	Tier          string    `json:"tier" gorm:"type:varchar(20);default:'BRONZE'"`
	BankName      string    `json:"bank_name" gorm:"type:varchar(100)"`
	BankAccount   string    `json:"bank_account" gorm:"type:varchar(20)"`
	TotalEarnings float64   `json:"total_earnings" gorm:"type:decimal(20,2);default:0"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
	JoinedAt      time.Time `json:"joined_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

type CommissionRate struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	ProductType string    `json:"product_type" gorm:"type:varchar(50);not null"`
	AgentTier   string    `json:"agent_tier" gorm:"type:varchar(20);not null"`
	BaseRate    float64   `json:"base_rate" gorm:"type:decimal(5,2);not null"`
	BonusRate   float64   `json:"bonus_rate" gorm:"type:decimal(5,2);default:0"`
	MinPremium  float64   `json:"min_premium" gorm:"type:decimal(20,2);default:0"`
	MaxPremium  float64   `json:"max_premium" gorm:"type:decimal(20,2)"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	EffectiveFrom time.Time `json:"effective_from"`
	EffectiveTo   *time.Time `json:"effective_to"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

type Commission struct {
	ID               uuid.UUID        `json:"id" gorm:"type:uuid;primary_key"`
	AgentID          uuid.UUID        `json:"agent_id" gorm:"type:uuid;not null;index"`
	PolicyID         uuid.UUID        `json:"policy_id" gorm:"type:uuid;not null"`
	PolicyNumber     string           `json:"policy_number" gorm:"type:varchar(50)"`
	ProductType      string           `json:"product_type" gorm:"type:varchar(50)"`
	PremiumAmount    float64          `json:"premium_amount" gorm:"type:decimal(20,2)"`
	CommissionRate   float64          `json:"commission_rate" gorm:"type:decimal(5,2)"`
	CommissionAmount float64          `json:"commission_amount" gorm:"type:decimal(20,2)"`
	BonusAmount      float64          `json:"bonus_amount" gorm:"type:decimal(20,2);default:0"`
	TotalAmount      float64          `json:"total_amount" gorm:"type:decimal(20,2)"`
	Status           CommissionStatus `json:"status" gorm:"type:varchar(20);not null"`
	TransactionDate  time.Time        `json:"transaction_date"`
	ApprovedAt       *time.Time       `json:"approved_at"`
	ApprovedBy       *uuid.UUID       `json:"approved_by" gorm:"type:uuid"`
	PaidAt           *time.Time       `json:"paid_at"`
	CreatedAt        time.Time        `json:"created_at" gorm:"autoCreateTime"`
}

type CommissionPayout struct {
	ID            uuid.UUID    `json:"id" gorm:"type:uuid;primary_key"`
	AgentID       uuid.UUID    `json:"agent_id" gorm:"type:uuid;not null;index"`
	PayoutAmount  float64      `json:"payout_amount" gorm:"type:decimal(20,2)"`
	PayoutMethod  string       `json:"payout_method" gorm:"type:varchar(50)"`
	BankName      string       `json:"bank_name" gorm:"type:varchar(100)"`
	BankAccount   string       `json:"bank_account" gorm:"type:varchar(20)"`
	TransactionRef string      `json:"transaction_ref" gorm:"type:varchar(100)"`
	Status        PayoutStatus `json:"status" gorm:"type:varchar(20)"`
	ProcessedAt   *time.Time   `json:"processed_at"`
	FailureReason string       `json:"failure_reason" gorm:"type:text"`
	CreatedAt     time.Time    `json:"created_at" gorm:"autoCreateTime"`
}

type IncentiveTier struct {
	ID              uuid.UUID `json:"id" gorm:"type:uuid;primary_key"`
	TierName        string    `json:"tier_name" gorm:"type:varchar(20);unique"`
	MinSalesVolume  float64   `json:"min_sales_volume" gorm:"type:decimal(20,2)"`
	MaxSalesVolume  float64   `json:"max_sales_volume" gorm:"type:decimal(20,2)"`
	BonusPercentage float64   `json:"bonus_percentage" gorm:"type:decimal(5,2)"`
	Benefits        string    `json:"benefits" gorm:"type:jsonb"`
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
}
