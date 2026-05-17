package model

import "time"

type Policy struct {
	ID              string    `json:"id"`
	PolicyNumber    string    `json:"policy_number"`
	ProductID       string    `json:"product_id"`
	HolderID        string    `json:"holder_id"`
	Status          string    `json:"status"`
	EffectiveDate   time.Time `json:"effective_date"`
	ExpirationDate  time.Time `json:"expiration_date"`
	PremiumAmount   float64   `json:"premium_amount"`
	Currency        string    `json:"currency"`
	OpenIMISPolicyID string   `json:"openimis_policy_id,omitempty"`
	SyncStatus      string    `json:"sync_status"`
	LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
}

type OpenIMISPolicy struct {
	UUID          string  `json:"uuid"`
	EnrollDate    string  `json:"enroll_date"`
	StartDate     string  `json:"start_date"`
	ExpiryDate    string  `json:"expiry_date"`
	Status        string  `json:"status"`
	Value         float64 `json:"value"`
	ProductUUID   string  `json:"product_uuid"`
	FamilyUUID    string  `json:"family_uuid"`
}

type SyncStatus struct {
	PolicyID      string    `json:"policy_id"`
	OpenIMISID    string    `json:"openimis_id"`
	Status        string    `json:"status"`
	LastSyncAt    time.Time `json:"last_sync_at"`
	ErrorMessage  string    `json:"error_message,omitempty"`
}
