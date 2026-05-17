package models

import (
	"time"

	"gorm.io/gorm"
)

// Cession represents a record of reinsurance cession for a specific risk or claim
type Cession struct {
	gorm.Model
	TreatyID         uint      `gorm:"not null" json:"treaty_id"`
	Treaty           Treaty    `gorm:"foreignKey:TreatyID" json:"treaty"`
	ExternalRefID    string    `gorm:"not null;index" json:"external_ref_id"` // e.g., Policy ID or Claim ID
	CessionType      TreatyType `gorm:"type:varchar(50);not null" json:"cession_type"`
	OriginalAmount   float64   `gorm:"not null" json:"original_amount"` // The amount of risk/loss before cession
	CededAmount      float64   `gorm:"not null" json:"ceded_amount"`    // The amount ceded to the reinsurer
	RetainedAmount   float64   `gorm:"not null" json:"retained_amount"` // The amount retained by the insurer
	CededPercentage  float64   `gorm:"not null" json:"ceded_percentage"`
	CessionDate      time.Time `gorm:"not null" json:"cession_date"`
}

// TableName for Cession
func (Cession) TableName() string {
	return "treaty_cessions"
}
