package models

import "time"

// UnderwritingCase represents the input data for a risk assessment.
type UnderwritingCase struct {
	CaseID      string    `json:"case_id"`
	PolicyHolderID string `json:"policy_holder_id"`
	ApplicantAge int      `json:"applicant_age"`
	ProductCode  string   `json:"product_code"`
	SumAssured   float64  `json:"sum_assured"`
	MedicalHistory string `json:"medical_history"`
}

// RiskAssessmentResult represents the output from the OpenIMIS risk assessor.
type RiskAssessmentResult struct {
	CaseID        string    `json:"case_id"`
	RiskScore     float64   `json:"risk_score"`
	RiskCategory  string    `json:"risk_category"` // e.g., "Standard", "Substandard", "Declined"
	RecommendedPremium float64 `json:"recommended_premium"`
	AssessmentDate time.Time `json:"assessment_date"`
}

// MortalityTableEntry represents a single entry from the OpenIMIS mortality table lookup.
type MortalityTableEntry struct {
	Age          int     `json:"age"`
	Gender       string  `json:"gender"`
	MortalityRate float64 `json:"mortality_rate"` // qx
}

// UnderwritingDecision represents the final decision to be synced back to the underwriting service.
type UnderwritingDecision struct {
	CaseID        string    `json:"case_id"`
	Decision      string    `json:"decision"` // e.g., "Approved", "Declined", "Referred"
	DecisionDate  time.Time `json:"decision_date"`
	ReasonCode    string    `json:"reason_code"`
	FinalPremium  float64   `json:"final_premium"`
}
