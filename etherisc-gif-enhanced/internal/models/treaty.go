package models

import (
	"time"

	"gorm.io/gorm"
)

// TreatyType defines the type of reinsurance treaty
type TreatyType string

const (
	// Proportional treaties
	TreatyTypeQuotaShare TreatyType = "QUOTA_SHARE"
	TreatyTypeSurplus    TreatyType = "SURPLUS"
	// Non-proportional treaties
	TreatyTypeExcessOfLoss TreatyType = "EXCESS_OF_LOSS"
	TreatyTypeStopLoss     TreatyType = "STOP_LOSS"
)

// Treaty represents a reinsurance treaty agreement
type Treaty struct {
	gorm.Model
	Name             string     `gorm:"uniqueIndex;not null" json:"name"`
	TreatyType       TreatyType `gorm:"type:varchar(50);not null" json:"treaty_type"`
	EffectiveDate    time.Time  `gorm:"not null" json:"effective_date"`
	ExpirationDate   time.Time  `gorm:"not null" json:"expiration_date"`
	ReinsurerID      string     `gorm:"not null" json:"reinsurer_id"` // ID of the reinsurer in the GIF system
	Status           string     `gorm:"default:'ACTIVE'" json:"status"`
	// Proportional fields (e.g., Quota Share, Surplus)
	SharePercentage  float64    `json:"share_percentage,omitempty"` // Quota Share percentage or Surplus line
	RetentionLimit   float64    `json:"retention_limit,omitempty"`  // Insurer's retention limit
	// Non-proportional fields (e.g., Excess of Loss, Stop Loss)
	PriorityLimit    float64    `json:"priority_limit,omitempty"`   // The attachment point (retention)
	TreatyLimit      float64    `json:"treaty_limit,omitempty"`     // The maximum amount the treaty will pay
	AggregateLimit   float64    `json:"aggregate_limit,omitempty"`  // For Stop Loss or aggregate XL
}

// Utilization tracks the current usage against a non-proportional treaty's limits
type Utilization struct {
	gorm.Model
	TreatyID         uint      `gorm:"uniqueIndex;not null" json:"treaty_id"`
	Treaty           Treaty    `json:"treaty"`
	CurrentLosses    float64   `gorm:"default:0" json:"current_losses"` // Total losses ceded so far
	LastUpdated      time.Time `json:"last_updated"`
}

// TableName for Utilization to avoid conflicts
func (Utilization) TableName() string {
	return "treaty_utilizations"
}
