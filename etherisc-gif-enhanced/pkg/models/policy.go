package models

import (
	"time"

	"github.com/google/uuid"
)

// PolicyType defines the type of policy.
type PolicyType string

const (
	Traditional PolicyType = "Traditional"
	Parametric  PolicyType = "Parametric"
)

// PolicyStatus defines the lifecycle status of a policy.
type PolicyStatus string

const (
	StatusDraft          PolicyStatus = "Draft"
	StatusPendingOnChain PolicyStatus = "PendingOnChain"
	StatusActive         PolicyStatus = "Active"
	StatusExpired        PolicyStatus = "Expired"
	StatusFailed         PolicyStatus = "Failed"
)

// Policy represents the core policy record in the database.
type Policy struct {
	ID                   uuid.UUID    `json:"id"`
	PolicyType           PolicyType   `json:"policy_type"`
	Status               PolicyStatus `json:"status"`
	ParametricPolicyID   *uuid.UUID   `json:"parametric_policy_id,omitempty"` // Foreign key to ParametricPolicy
	CreatedAt            time.Time    `json:"created_at"`
	UpdatedAt            time.Time    `json:"updated_at"`
}

// ParametricPolicy holds blockchain-specific data for a parametric policy.
type ParametricPolicy struct {
	ID               uuid.UUID `json:"id"` // Matches Policy.ParametricPolicyID
	GIFProductID     string    `json:"gif_product_id"`
	OnChainAddress   string    `json:"on_chain_address"`
	TxHash           string    `json:"tx_hash"`
	PremiumData      []byte    `json:"premium_data"` // JSONB in DB
	PayoutData       []byte    `json:"payout_data"`  // JSONB in DB
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// PolicyCreationRequest is the input model for creating a new parametric policy.
type PolicyCreationRequest struct {
	GIFProductID string `json:"gif_product_id"`
	PremiumData  []byte `json:"premium_data"`
	PayoutData   []byte `json:"payout_data"`
}
