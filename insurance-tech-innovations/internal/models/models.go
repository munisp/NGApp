package models

import "time"

type DynamicPriceRequest struct {
	PolicyID     string  `json:"policy_id"`
	ProductType  string  `json:"product_type"`
	BasePremium  float64 `json:"base_premium_ngn"`
	DrivingScore float64 `json:"driving_score"`
	ClaimsCount  int     `json:"claims_count_3yr"`
	MileageKM    float64 `json:"monthly_mileage_km"`
	Region       string  `json:"region"`
	VehicleAge   int     `json:"vehicle_age_years"`
}

type DynamicPriceResult struct {
	PolicyID        string    `json:"policy_id"`
	BasePremium     float64   `json:"base_premium_ngn"`
	AdjustedPremium float64   `json:"adjusted_premium_ngn"`
	Discount        float64   `json:"discount_pct"`
	Surcharge       float64   `json:"surcharge_pct"`
	Factors         []PricingFactor `json:"factors"`
	NextReviewAt    time.Time `json:"next_review_at"`
}

type PricingFactor struct {
	Name   string  `json:"name"`
	Impact float64 `json:"impact_pct"`
	Reason string  `json:"reason"`
}

type InstantClaimRequest struct {
	PolicyID      string  `json:"policy_id"`
	ClaimType     string  `json:"claim_type"`
	Region        string  `json:"region"`
	SatelliteData bool    `json:"satellite_verified"`
	DamageScore   float64 `json:"damage_score"`
	Amount        float64 `json:"amount_ngn"`
}

type InstantClaimResult struct {
	ClaimID       string    `json:"claim_id"`
	PolicyID      string    `json:"policy_id"`
	Decision      string    `json:"decision"`
	Amount        float64   `json:"amount_ngn"`
	Confidence    float64   `json:"confidence_pct"`
	ProcessingMS  int       `json:"processing_ms"`
	Method        string    `json:"method"`
	ProcessedAt   time.Time `json:"processed_at"`
}

type GamificationProfile struct {
	CustomerID     string  `json:"customer_id"`
	Points         int     `json:"points"`
	Level          string  `json:"level"`
	StepsToday     int     `json:"steps_today"`
	SafeDrivingDays int    `json:"safe_driving_days"`
	PremiumDiscount float64 `json:"premium_discount_pct"`
	Rewards        []Reward `json:"rewards"`
	LossRatioImpact float64 `json:"loss_ratio_improvement_pct"`
}

type Reward struct {
	Name   string `json:"name"`
	Points int    `json:"points_required"`
	Status string `json:"status"`
}

type P2PPool struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Members     int       `json:"members"`
	PoolBalance float64   `json:"pool_balance_ngn"`
	ClaimsPaid  float64   `json:"claims_paid_ngn"`
	Giveback    float64   `json:"giveback_pct"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProductBuilderSpec struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Perils          []string `json:"perils"`
	TriggerType     string   `json:"trigger_type"`
	PayoutMechanism string   `json:"payout_mechanism"`
	Distribution    string   `json:"distribution_channel"`
	PremiumModel    string   `json:"premium_model"`
	Status          string   `json:"status"`
	CreatedInDays   int      `json:"created_in_days"`
}
