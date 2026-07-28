package models

import "time"

// UnderwritingData represents the data synced from the Underwriting Service to OpenIMIS.
type UnderwritingData struct {
	PolicyID      string    `json:"policy_id"`
	InsureeID     string    `json:"insuree_id"`
	RiskScore     float64   `json:"risk_score"`
	EffectiveDate time.Time `json:"effective_date"`
	Status        string    `json:"status"` // e.g., "Active", "Pending"
}

// ActuarialGuideline represents the data synced from OpenIMIS to the Underwriting Service.
type ActuarialGuideline struct {
	GuidelineID string    `json:"guideline_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Threshold   float64   `json:"threshold"`
	Version     int       `json:"version"`
	LastUpdated time.Time `json:"last_updated"`
}

// SyncStatus tracks the result of a synchronization operation.
type SyncStatus struct {
	TemporalWorkflowID string    `json:"temporal_workflow_id"`
	SourceSystem       string    `json:"source_system"` // e.g., "Underwriting", "OpenIMIS"
	TargetSystem       string    `json:"target_system"`
	EntityID           string    `json:"entity_id"` // e.g., PolicyID or GuidelineID
	Success            bool      `json:"success"`
	Message            string    `json:"message"`
	Timestamp          time.Time `json:"timestamp"`
}

// RiskScoreUpdate is used for the reconciliation workflow.
type RiskScoreUpdate struct {
	PolicyID  string  `json:"policy_id"`
	NewScore  float64 `json:"new_score"`
	OpenIMISScore float64 `json:"openimis_score"`
	Reason    string  `json:"reason"`
}

// Database table name constants
const (
	TableSyncStatus = "sync_status"
)
