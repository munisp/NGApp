package models

import "time"

// ClaimEvent represents the raw data event from OpenIMIS for a claim.
type ClaimEvent struct {
	ClaimID     string    `json:"claim_id"`
	PolicyID    string    `json:"policy_id"`
	InsureeID   string    `json:"insuree_id"`
	ClaimAmount float64   `json:"claim_amount"`
	ClaimDate   time.Time `json:"claim_date"`
	Status      string    `json:"status"`
	Region      string    `json:"region"`
	ProductCode string    `json:"product_code"`
}

// OperationalContext represents data fetched from operational services for enrichment.
type OperationalContext struct {
	InsureeRiskScore float64 `json:"insuree_risk_score"`
	PolicyPremium    float64 `json:"policy_premium"`
	PolicyStartDate  time.Time `json:"policy_start_date"`
}

// EnrichedClaim represents the claim data after transformation and enrichment.
type EnrichedClaim struct {
	ClaimEvent
	OperationalContext
	ProcessingTime time.Time `json:"processing_time"`
	IsLate         bool      `json:"is_late"`
	DataQualityScore float64 `json:"data_quality_score"`
}

// LossRatioAggregation represents the aggregated data for analytics.
type LossRatioAggregation struct {
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	AggregationKey string `json:"aggregation_key"` // e.g., "daily_region_A", "monthly_product_B"
	TotalClaims float64   `json:"total_claims"`
	TotalPremium float64   `json:"total_premium"`
	LossRatio   float64   `json:"loss_ratio"` // TotalClaims / TotalPremium
	RiskScoreDistribution map[string]int `json:"risk_score_distribution"` // e.g., {"low": 10, "medium": 5, "high": 2}
}
