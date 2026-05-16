package model

import "time"

type Claim struct {
	ID              string    `json:"id"`
	PolicyID        string    `json:"policy_id"`
	ClaimantID      string    `json:"claimant_id"`
	ClaimType       string    `json:"claim_type"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Status          string    `json:"status"`
	Description     string    `json:"description"`
	IncidentDate    time.Time `json:"incident_date"`
	SubmissionDate  time.Time `json:"submission_date"`
	ProcessedDate   *time.Time `json:"processed_date,omitempty"`
	OpenIMISClaimID string    `json:"openimis_claim_id,omitempty"`
	SyncStatus      string    `json:"sync_status"`
	LastSyncAt      *time.Time `json:"last_sync_at,omitempty"`
}

type OpenIMISClaim struct {
	UUID          string    `json:"uuid"`
	Code          string    `json:"code"`
	DateClaimed   string    `json:"date_claimed"`
	DateFrom      string    `json:"date_from"`
	DateTo        string    `json:"date_to"`
	Status        int       `json:"status"`
	Claimed       float64   `json:"claimed"`
	Approved      float64   `json:"approved"`
	InsureeUUID   string    `json:"insuree_uuid"`
	HealthFacility string   `json:"health_facility"`
}

type SyncResult struct {
	ClaimID       string    `json:"claim_id"`
	OpenIMISID    string    `json:"openimis_id"`
	Status        string    `json:"status"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	SyncedAt      time.Time `json:"synced_at"`
}

type ClaimEvent struct {
	EventType string `json:"event_type"`
	ClaimID   string `json:"claim_id"`
	Timestamp string `json:"timestamp"`
	Data      Claim  `json:"data"`
}
