package models

import "time"

type ProductType string

const (
	ProductCropInsurance    ProductType = "crop_insurance"
	ProductLivestockCover   ProductType = "livestock_cover"
	ProductDeviceProtection ProductType = "device_protection"
	ProductHealthMicro      ProductType = "health_micro"
	ProductTravelMicro      ProductType = "travel_micro"
	ProductFuneralCover     ProductType = "funeral_cover"
	ProductAccidentCover    ProductType = "personal_accident"
)

type MicroProduct struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Type            ProductType `json:"type"`
	Description     string      `json:"description"`
	MinPremium      float64     `json:"min_premium"`
	MaxPremium      float64     `json:"max_premium"`
	CoverageAmount  float64     `json:"coverage_amount"`
	DurationDays    int         `json:"duration_days"`
	Currency        string      `json:"currency"`
	IsActive        bool        `json:"is_active"`
	RiskMultiplier  float64     `json:"risk_multiplier"`
	ClaimWaitDays   int         `json:"claim_wait_days"`
	AutoRenew       bool        `json:"auto_renew"`
	MaxClaimsPerYear int        `json:"max_claims_per_year"`
}

type MicroPolicy struct {
	ID             string      `json:"id"`
	ProductID      string      `json:"product_id"`
	CustomerID     string      `json:"customer_id"`
	CustomerName   string      `json:"customer_name"`
	CustomerPhone  string      `json:"customer_phone"`
	Premium        float64     `json:"premium"`
	CoverageAmount float64     `json:"coverage_amount"`
	Currency       string      `json:"currency"`
	Status         string      `json:"status"`
	StartDate      time.Time   `json:"start_date"`
	EndDate        time.Time   `json:"end_date"`
	ClaimsCount    int         `json:"claims_count"`
	Channel        string      `json:"channel"`
	PaymentRef     string      `json:"payment_ref"`
	CreatedAt      time.Time   `json:"created_at"`
}

type MicroClaim struct {
	ID          string    `json:"id"`
	PolicyID    string    `json:"policy_id"`
	CustomerID  string    `json:"customer_id"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	Evidence    string    `json:"evidence"`
	Status      string    `json:"status"`
	ReviewNotes string    `json:"review_notes,omitempty"`
	PayoutRef   string    `json:"payout_ref,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
}
