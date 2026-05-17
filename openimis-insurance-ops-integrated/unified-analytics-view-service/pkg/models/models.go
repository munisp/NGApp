package models

import "time"

// PolicyWithActuarialMetrics represents the unified view for policy data.
type PolicyWithActuarialMetrics struct {
	PolicyID          string    `json:"policy_id"`
	ClientID          string    `json:"client_id"`
	EffectiveDate     time.Time `json:"effective_date"`
	ExpirationDate    time.Time `json:"expiration_date"`
	PremiumAmount     float64   `json:"premium_amount"`
	CoverageType      string    `json:"coverage_type"`
	ActuarialValue    float64   `json:"actuarial_value"` // e.g., Expected Loss Ratio
	RiskScore         float64   `json:"risk_score"`
	UnderwriterID     string    `json:"underwriter_id"`
}

// ClaimsWithReservesAndLossRatios represents the unified view for claims data.
type ClaimsWithReservesAndLossRatios struct {
	ClaimID           string    `json:"claim_id"`
	PolicyID          string    `json:"policy_id"`
	DateOfLoss        time.Time `json:"date_of_loss"`
	ReportedDate      time.Time `json:"reported_date"`
	IncurredAmount    float64   `json:"incurred_amount"`
	PaidAmount        float64   `json:"paid_amount"`
	CaseReserve       float64   `json:"case_reserve"`
	IBNRReserve       float64   `json:"ibnr_reserve"`
	TotalReserve      float64   `json:"total_reserve"`
	LossRatio         float64   `json:"loss_ratio"` // Incurred / Premium
	ClaimStatus       string    `json:"claim_status"`
}

// UnderwritingWithRiskScores represents the unified view for underwriting data.
type UnderwritingWithRiskScores struct {
	UnderwritingID    string    `json:"underwriting_id"`
	PolicyID          string    `json:"policy_id"`
	ApplicationDate   time.Time `json:"application_date"`
	DecisionDate      time.Time `json:"decision_date"`
	DecisionStatus    string    `json:"decision_status"`
	CalculatedRiskScore float64 `json:"calculated_risk_score"`
	UnderwriterNotes  string    `json:"underwriter_notes"`
	ExternalDataScore float64   `json:"external_data_score"`
}

// RegulatoryReportData represents the structure for regulatory data export.
type RegulatoryReportData struct {
	ReportID          string    `json:"report_id"`
	ReportingPeriod   string    `json:"reporting_period"`
	GeneratedAt       time.Time `json:"generated_at"`
	DataRows          []map[string]interface{} `json:"data_rows"`
}
