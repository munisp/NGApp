package models

import "time"

type ChannelType string

const (
	ChannelLoanEmbedded   ChannelType = "loan_embedded"
	ChannelAirtimeBundled  ChannelType = "airtime_bundled"
	ChannelEcomCheckout    ChannelType = "ecommerce_checkout"
	ChannelRideHailing     ChannelType = "ride_hailing"
	ChannelSavingsLinked   ChannelType = "savings_linked"
	ChannelMarketplaceSDK  ChannelType = "marketplace_sdk"
)

type Partner struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Channel      ChannelType `json:"channel"`
	Industry     string      `json:"industry"`
	APIKey       string      `json:"api_key"`
	WebhookURL   string      `json:"webhook_url"`
	CommissionPct float64    `json:"commission_pct"`
	IsActive     bool        `json:"is_active"`
	CreatedAt    time.Time   `json:"created_at"`
}

type EmbeddedProduct struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Channel       ChannelType `json:"channel"`
	InsuranceType string      `json:"insurance_type"`
	PremiumNGN    float64     `json:"premium_ngn"`
	CoverageNGN   float64     `json:"coverage_ngn"`
	Duration      string      `json:"duration"`
	AutoEnroll    bool        `json:"auto_enroll"`
	Description   string      `json:"description"`
}

type Enrollment struct {
	ID           string    `json:"id"`
	PartnerID    string    `json:"partner_id"`
	ProductID    string    `json:"product_id"`
	CustomerRef  string    `json:"customer_ref"`
	CustomerName string    `json:"customer_name"`
	PremiumPaid  float64   `json:"premium_paid_ngn"`
	Status       string    `json:"status"`
	Channel      string    `json:"channel"`
	TransactionRef string  `json:"transaction_ref"`
	CreatedAt    time.Time `json:"created_at"`
}

type RevenueShare struct {
	PartnerID     string  `json:"partner_id"`
	TotalPremiums float64 `json:"total_premiums_ngn"`
	Commission    float64 `json:"commission_ngn"`
	NetToInsurer  float64 `json:"net_to_insurer_ngn"`
	Enrollments   int     `json:"enrollment_count"`
}
