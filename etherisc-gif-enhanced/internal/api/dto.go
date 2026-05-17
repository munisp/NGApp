package api

import (
	"time"

	"github.com/etherisc/treaty-reinsurance-service/internal/models"
)

// CreateTreatyRequest is the request body for creating a new treaty
type CreateTreatyRequest struct {
	Name             string             `json:"name" binding:"required"`
	TreatyType       models.TreatyType  `json:"treaty_type" binding:"required"`
	EffectiveDate    time.Time          `json:"effective_date" binding:"required"`
	ExpirationDate   time.Time          `json:"expiration_date" binding:"required"`
	ReinsurerID      string             `json:"reinsurer_id" binding:"required"`
	SharePercentage  float64            `json:"share_percentage"`
	RetentionLimit   float64            `json:"retention_limit"`
	PriorityLimit    float64            `json:"priority_limit"`
	TreatyLimit      float64            `json:"treaty_limit"`
	AggregateLimit   float64            `json:"aggregate_limit"`
}

// TreatyResponse is the response body for a treaty
type TreatyResponse struct {
	ID               uint               `json:"id"`
	Name             string             `json:"name"`
	TreatyType       models.TreatyType  `json:"treaty_type"`
	EffectiveDate    time.Time          `json:"effective_date"`
	ExpirationDate   time.Time          `json:"expiration_date"`
	ReinsurerID      string             `json:"reinsurer_id"`
	Status           string             `json:"status"`
	SharePercentage  float64            `json:"share_percentage,omitempty"`
	RetentionLimit   float64            `json:"retention_limit,omitempty"`
	PriorityLimit    float64            `json:"priority_limit,omitempty"`
	TreatyLimit      float64            `json:"treaty_limit,omitempty"`
	AggregateLimit   float64            `json:"aggregate_limit,omitempty"`
	CreatedAt        time.Time          `json:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at"`
}

// CalculateCessionRequest is the request body for calculating a cession
type CalculateCessionRequest struct {
	ExternalRefID string  `json:"external_ref_id" binding:"required"` // e.g., Policy ID or Claim ID
	OriginalAmount float64 `json:"original_amount" binding:"required,gt=0"`
}

// CessionResponse is the response body for a cession calculation
type CessionResponse struct {
	ID               uint               `json:"id"`
	TreatyID         uint               `json:"treaty_id"`
	ExternalRefID    string             `json:"external_ref_id"`
	CessionType      models.TreatyType  `json:"cession_type"`
	OriginalAmount   float64            `json:"original_amount"`
	CededAmount      float64            `json:"ceded_amount"`
	RetainedAmount   float64            `json:"retained_amount"`
	CededPercentage  float64            `json:"ceded_percentage"`
	CessionDate      time.Time          `json:"cession_date"`
}

// UtilizationResponse is the response body for treaty utilization
type UtilizationResponse struct {
	TreatyID         uint               `json:"treaty_id"`
	CurrentLosses    float64            `json:"current_losses"`
	LastUpdated      time.Time          `json:"last_updated"`
}
