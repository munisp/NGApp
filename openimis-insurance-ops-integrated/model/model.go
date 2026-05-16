package model

import "time"

// Claim represents the structure of a claim in the source Claims service.
type Claim struct {
	ID            string    `json:"id"`
	PolicyID      string    `json:"policy_id"`
	ClaimAmount   float64   `json:"claim_amount"`
	ReserveAmount float64   `json:"reserve_amount"`
	Status        string    `json:"status"`
	LastUpdated   time.Time `json:"last_updated"`
}

// OpenIMISClaim represents the structure required for syncing a claim to OpenIMIS.
type OpenIMISClaim struct {
	ClaimUUID     string    `json:"claim_uuid"`
	InsureeID     string    `json:"insuree_id"`
	ClaimDate     time.Time `json:"claim_date"`
	TotalAmount   float64   `json:"total_amount"`
	Status        string    `json:"status"` // e.g., "PENDING", "APPROVED"
	ExternalRefID string    `json:"external_ref_id"` // Source Claim ID
}

// ReserveAdjustment represents a reserve change initiated in OpenIMIS that needs to be synced back.
type ReserveAdjustment struct {
	ClaimUUID     string    `json:"claim_uuid"`
	AdjustmentID  string    `json:"adjustment_id"`
	NewReserve    float64   `json:"new_reserve"`
	AdjustmentDate time.Time `json:"adjustment_date"`
	Reason        string    `json:"reason"`
}

// LossRatioUpdate represents the data required for loss ratio reconciliation.
type LossRatioUpdate struct {
	PolicyID      string    `json:"policy_id"`
	TotalClaims   float64   `json:"total_claims"`
	TotalPremium  float64   `json:"total_premium"`
	LossRatio     float64   `json:"loss_ratio"`
	CalculationDate time.Time `json:"calculation_date"`
}

// SyncStatus represents the tracking information for a claim sync operation.
type SyncStatus struct {
	ClaimID       string    `json:"claim_id"`
	WorkflowID    string    `json:"workflow_id"`
	RunID         string    `json:"run_id"`
	LastSyncTime  time.Time `json:"last_sync_time"`
	Status        string    `json:"status"` // e.g., "IN_PROGRESS", "COMPLETED", "FAILED"
	ErrorMessage  string    `json:"error_message"`
}
