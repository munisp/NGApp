package models

import "time"

type Provider struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Code         string  `json:"code"`
	Country      string  `json:"country"`
	Currency     string  `json:"currency"`
	FeePercent   float64 `json:"fee_percent"`
	FeeFlat      float64 `json:"fee_flat"`
	MinAmount    float64 `json:"min_amount"`
	MaxAmount    float64 `json:"max_amount"`
	IsActive     bool    `json:"is_active"`
	SettleTime   string  `json:"settlement_time"`
}

type MoMoTransaction struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	ProviderCode string    `json:"provider_code"`
	Phone        string    `json:"phone"`
	Amount       float64   `json:"amount"`
	Fee          float64   `json:"fee"`
	NetAmount    float64   `json:"net_amount"`
	Currency     string    `json:"currency"`
	Reference    string    `json:"reference"`
	PolicyID     string    `json:"policy_id,omitempty"`
	ClaimID      string    `json:"claim_id,omitempty"`
	Status       string    `json:"status"`
	ProviderRef  string    `json:"provider_ref,omitempty"`
	FailReason   string    `json:"fail_reason,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

type WalletBalance struct {
	CustomerID string  `json:"customer_id"`
	Phone      string  `json:"phone"`
	Balance    float64 `json:"balance"`
	Currency   string  `json:"currency"`
}
