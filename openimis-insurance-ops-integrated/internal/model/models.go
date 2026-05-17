package model

import (
	"time"

	"github.com/google/uuid"
)

// Claim represents a simplified claim from OpenIMIS
type Claim struct {
	ID        uuid.UUID `json:"id"`
	ClaimCode string    `json:"claimCode"`
	PolicyID  uuid.UUID `json:"policyId"`
	Status    string    `json:"status"` // e.g., "PENDING", "APPROVED", "REJECTED"
	Amount    float64   `json:"amount"`
	IsLarge   bool      `json:"isLarge"`
	CreatedAt time.Time `json:"createdAt"`
}

// Reserve represents the calculated reserve for a claim
type Reserve struct {
	ID        uuid.UUID `json:"id"`
	ClaimID   uuid.UUID `json:"claimId"`
	ReserveType string  `json:"reserveType"` // e.g., "INDIVIDUAL", "IBNR", "ACTUARIAL"
	Amount    float64   `json:"amount"`
	Timestamp time.Time `json:"timestamp"`
	IsActive  bool      `json:"isActive"`
}

// ReserveAdjustmentRequest is the payload for the Temporal workflow
type ReserveAdjustmentRequest struct {
	ClaimID uuid.UUID `json:"claimId"`
	Event   string    `json:"event"` // e.g., "CLAIM_CREATED", "CLAIM_UPDATED", "PAYMENT_MADE"
}

// ActuarialReviewRequest is the payload for the large claim review
type ActuarialReviewRequest struct {
	ClaimID uuid.UUID `json:"claimId"`
	ClaimAmount float64 `json:"claimAmount"`
}

// ActuarialReviewResponse is the response from the actuarial service
type ActuarialReviewResponse struct {
	RecommendedReserve float64 `json:"recommendedReserve"`
	ReviewerID         string  `json:"reviewerId"`
}

// IBNRCalculationResult is the result of the IBNR calculation
type IBNRCalculationResult struct {
	TotalIBNR float64 `json:"totalIbnr"`
	Timestamp time.Time `json:"timestamp"`
}
