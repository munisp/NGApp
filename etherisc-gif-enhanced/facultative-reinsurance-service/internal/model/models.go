package model

import (
	"time"
)

// Policy represents a high-value policy requiring facultative reinsurance.
type Policy struct {
	PolicyID    string    `json:"policy_id"`
	InsuredName string    `json:"insured_name"`
	SumInsured  float64   `json:"sum_insured"`
	Premium     float64   `json:"premium"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	IsCeded     bool      `json:"is_ceded"`
}

// Reinsurer represents a potential reinsurance partner.
type Reinsurer struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Rating  string `json:"rating"` // e.g., "A+", "B"
	Capacity float64 `json:"capacity"` // Max sum insured they can take
	ContactEmail string `json:"contact_email"`
}

// ReinsuranceQuote represents a quote received from a reinsurer.
type ReinsuranceQuote struct {
	QuoteID      string    `json:"quote_id"`
	ReinsurerID  string    `json:"reinsurer_id"`
	PolicyID     string    `json:"policy_id"`
	CededShare   float64   `json:"ceded_share"` // Percentage of risk ceded (0.0 to 1.0)
	CededPremium float64   `json:"ceded_premium"`
	Commission   float64   `json:"commission"` // Commission rate for the reinsurer
	Status       string    `json:"status"` // "PENDING", "ACCEPTED", "REJECTED"
	QuoteTime    time.Time `json:"quote_time"`
}

// CededReinsurance represents the final, accepted reinsurance contract.
type CededReinsurance struct {
	ContractID   string    `json:"contract_id"`
	PolicyID     string    `json:"policy_id"`
	ReinsurerID  string    `json:"reinsurer_id"`
	CededShare   float64   `json:"ceded_share"`
	CededPremium float64   `json:"ceded_premium"`
	Commission   float64   `json:"commission"`
	EffectiveDate time.Time `json:"effective_date"`
	Status       string    `json:"status"` // "ACTIVE", "EXPIRED", "CLAIMED"
	GIFContractID string `json:"gif_contract_id"` // ID on the Etherisc GIF blockchain
}

// ClaimCession represents a claim event ceded to the reinsurer.
type ClaimCession struct {
	CessionID    string    `json:"cession_id"`
	ContractID   string    `json:"contract_id"`
	ClaimID      string    `json:"claim_id"`
	ClaimAmount  float64   `json:"claim_amount"`
	ReinsurerShare float64 `json:"reinsurer_share"` // Amount to be paid by reinsurer
	Status       string    `json:"status"` // "PENDING", "PAID", "REJECTED"
	CessionTime  time.Time `json:"cession_time"`
}

// ReinsurerSelectionCriteria defines the input for the selection algorithm.
type ReinsurerSelectionCriteria struct {
	SumInsured float64
	PolicyType string
	MinRating  string
}

// ReinsurerSelectionResult is the output of the selection algorithm.
type ReinsurerSelectionResult struct {
	ReinsurerID string
	CededShare float64
}

// GIFIntegrationRequest is the payload for interacting with Etherisc GIF.
type GIFIntegrationRequest struct {
	ContractType string
	Data map[string]interface{}
}

// GIFIntegrationResponse is the response from Etherisc GIF.
type GIFIntegrationResponse struct {
	Success bool
	TransactionHash string
	ContractID string
	Error string
}
