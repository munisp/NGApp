package model

import "time"

// Reinsurer represents a reinsurer entity.
type Reinsurer struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	APIKey    string    `json:"apiKey"` // Used for authentication
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
}

// QuoteSubmission represents a request from a reinsurer to submit a quote.
type QuoteSubmission struct {
	QuoteID         string    `json:"quoteId"`
	PolicyID        string    `json:"policyId"`
	ReinsurerID     string    `json:"reinsurerId"`
	PremiumShare    float64   `json:"premiumShare"` // Percentage of premium reinsured
	RiskShare       float64   `json:"riskShare"`    // Percentage of risk reinsured
	QuoteAmount     float64   `json:"quoteAmount"`  // The amount quoted by the reinsurer
	ExpirationDate  time.Time `json:"expirationDate"`
	Status          string    `json:"status"` // e.g., "PENDING", "ACCEPTED", "REJECTED"
}

// ClaimNotification represents a notification from the core system to a reinsurer about a claim.
type ClaimNotification struct {
	ClaimID         string    `json:"claimId"`
	PolicyID        string    `json:"policyId"`
	ReinsurerID     string    `json:"reinsurerId"`
	LossAmount      float64   `json:"lossAmount"`
	NotificationDate time.Time `json:"notificationDate"`
	Status          string    `json:"status"` // e.g., "OPEN", "CLOSED", "PAID"
}

// QuoteResponse represents the response to a quote submission.
type QuoteResponse struct {
	QuoteID     string `json:"quoteId"`
	Status      string `json:"status"` // e.g., "SUCCESS", "FAILURE"
	Message     string `json:"message"`
}

// ClaimResponse represents the response to a claim notification.
type ClaimResponse struct {
	ClaimID     string `json:"claimId"`
	Status      string `json:"status"` // e.g., "ACKNOWLEDGED", "ERROR"
	Message     string `json:"message"`
}
