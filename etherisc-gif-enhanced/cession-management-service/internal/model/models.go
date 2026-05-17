package model

import "time"

type Treaty struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	ReinsurerID  string    `json:"reinsurer_id"`
	Type         string    `json:"type"`
	RetentionPct float64   `json:"retention_pct"`
	MaxCession   float64   `json:"max_cession"`
	Status       string    `json:"status"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	CreatedAt    time.Time `json:"created_at"`
}

type Cession struct {
	ID              string    `json:"id"`
	TreatyID        string    `json:"treaty_id"`
	PolicyID        string    `json:"policy_id"`
	CededPremium    float64   `json:"ceded_premium"`
	RetainedPremium float64   `json:"retained_premium"`
	CededRisk       float64   `json:"ceded_risk"`
	RetainedRisk    float64   `json:"retained_risk"`
	Commission      float64   `json:"commission"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type CessionSummary struct {
	TotalCeded    float64 `json:"total_ceded"`
	TotalRetained float64 `json:"total_retained"`
	TotalPolicies int     `json:"total_policies"`
	AvgRetention  float64 `json:"avg_retention_pct"`
}
