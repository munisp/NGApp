package api

import (
	"cession-management-service/internal/model"
	"time"

	"github.com/google/uuid"
)

// TrackCessionRequest is the request body for tracking a new cession
type TrackCessionRequest struct {
	PolicyID    uuid.UUID `json:"policy_id"`
	ReinsurerID uuid.UUID `json:"reinsurer_id"`
	Type        string    `json:"type"` // "PREMIUM" or "CLAIM"
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	CededShare  float64   `json:"ceded_share"`
}

// CessionResponse is the response body for a tracked cession
type CessionResponse struct {
	ID            uuid.UUID          `json:"id"`
	PolicyID      uuid.UUID          `json:"policy_id"`
	ReinsurerID   uuid.UUID          `json:"reinsurer_id"`
	Type          model.CessionType  `json:"type"`
	Amount        float64            `json:"amount"`
	Currency      string             `json:"currency"`
	CededShare    float64            `json:"ceded_share"`
	EffectiveDate time.Time          `json:"effective_date"`
	Calculation   *CalculationResponse `json:"calculation,omitempty"`
}

// CalculationResponse is the response body for a cession calculation
type CalculationResponse struct {
	CededAmount float64 `json:"ceded_amount"`
	Commission  float64 `json:"commission"`
	NetPayable  float64 `json:"net_payable"`
}

// BalanceResponse is the response body for a reinsurer balance
type BalanceResponse struct {
	ReinsurerID   uuid.UUID `json:"reinsurer_id"`
	Month         time.Time `json:"month"`
	TotalPremium  float64   `json:"total_premium"`
	TotalClaim    float64   `json:"total_claim"`
	TotalCommission float64 `json:"total_commission"`
	NetBalance    float64   `json:"net_balance"`
}

// BordereauRequest is the request body for generating a bordereau
type BordereauRequest struct {
	ReinsurerID uuid.UUID `json:"reinsurer_id"`
	Month       string    `json:"month"` // YYYY-MM
}

// BordereauResponse is the response body for a bordereau
type BordereauResponse struct {
	ID              uuid.UUID             `json:"id"`
	ReinsurerID     uuid.UUID             `json:"reinsurer_id"`
	StatementMonth  time.Time             `json:"statement_month"`
	Status          model.BordereauStatus `json:"status"`
	TotalNetPayable float64               `json:"total_net_payable"`
	FilePath        string                `json:"file_path"`
}

// SettlementResponse is the response body for a settlement workflow
type SettlementResponse struct {
	ID          uuid.UUID `json:"id"`
	BordereauID uuid.UUID `json:"bordereau_id"`
	PaymentRef  string    `json:"payment_ref"`
	Amount      float64   `json:"amount"`
	Direction   string    `json:"direction"`
	SettledAt   time.Time `json:"settled_at"`
}
