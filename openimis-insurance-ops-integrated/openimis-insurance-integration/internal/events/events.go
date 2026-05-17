package events

import "time"

// EventType defines the type of actuarial event
type EventType string

const (
	PremiumAdjustment      EventType = "PremiumAdjustment"
	ReserveAdjustment      EventType = "ReserveAdjustment"
	ProductConfigUpdate    EventType = "ProductConfigUpdate"
	LossRatioAlert         EventType = "LossRatioAlert"
)

// ActuarialEvent is the common wrapper for all events
type ActuarialEvent struct {
	EventID   string    `json:"event_id"`
	Timestamp time.Time `json:"timestamp"`
	EventType EventType `json:"event_type"`
	Source    string    `json:"source"`
	Payload   []byte    `json:"payload"` // JSON marshaled specific event payload
}

// PremiumAdjustmentPayload represents a premium adjustment event
type PremiumAdjustmentPayload struct {
	PolicyID         string  `json:"policy_id"`
	AdjustmentAmount float64 `json:"adjustment_amount"`
	Reason           string  `json:"reason"`
}

// ReserveAdjustmentPayload represents a reserve adjustment event
type ReserveAdjustmentPayload struct {
	PolicyID         string  `json:"policy_id"`
	ReserveType      string  `json:"reserve_type"` // e.g., "IBNR", "CaseReserve"
	AdjustmentAmount float64 `json:"adjustment_amount"`
}

// ProductConfigUpdatePayload represents a product configuration update event
type ProductConfigUpdatePayload struct {
	ProductID string `json:"product_id"`
	Field     string `json:"field"`
	OldValue  string `json:"old_value"`
	NewValue  string `json:"new_value"`
}

// LossRatioAlertPayload represents a loss ratio alert event
type LossRatioAlertPayload struct {
	ProductID        string  `json:"product_id"`
	CurrentLossRatio float64 `json:"current_loss_ratio"`
	Threshold        float64 `json:"threshold"`
	AlertLevel       string  `json:"alert_level"` // e.g., "Warning", "Critical"
}
