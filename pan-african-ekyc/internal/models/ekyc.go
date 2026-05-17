package models

import "time"

type VerificationType string
const (
	VerifyNIN      VerificationType = "nin"
	VerifyBVN      VerificationType = "bvn"
	VerifyPassport VerificationType = "passport"
	VerifyDrivers  VerificationType = "drivers_license"
	VerifyVoterID  VerificationType = "voter_id"
	VerifyCAC      VerificationType = "cac"
	VerifyTIN      VerificationType = "tin"
)

type VerificationRequest struct {
	ID            string           `json:"id"`
	CustomerID    string           `json:"customer_id"`
	Type          VerificationType `json:"type"`
	Country       string           `json:"country"`
	DocumentID    string           `json:"document_id"`
	FullName      string           `json:"full_name"`
	DateOfBirth   string           `json:"date_of_birth,omitempty"`
	Status        string           `json:"status"`
	Score         float64          `json:"verification_score"`
	MatchDetails  MatchResult      `json:"match_details"`
	RiskFlags     []string         `json:"risk_flags,omitempty"`
	Provider      string           `json:"provider"`
	ProviderRef   string           `json:"provider_ref,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	CompletedAt   *time.Time       `json:"completed_at,omitempty"`
}

type MatchResult struct {
	NameMatch     float64 `json:"name_match_pct"`
	DOBMatch      bool    `json:"dob_match"`
	PhotoMatch    float64 `json:"photo_match_pct"`
	AddressMatch  float64 `json:"address_match_pct"`
	Overall       float64 `json:"overall_pct"`
}

type KYCProfile struct {
	ID             string    `json:"id"`
	CustomerID     string    `json:"customer_id"`
	FullName       string    `json:"full_name"`
	Country        string    `json:"country"`
	Level          string    `json:"kyc_level"`
	VerifiedDocs   []string  `json:"verified_documents"`
	RiskScore      float64   `json:"risk_score"`
	PEPCheck       bool      `json:"pep_check_passed"`
	SanctionsCheck bool      `json:"sanctions_check_passed"`
	AMLCheck       bool      `json:"aml_check_passed"`
	Status         string    `json:"status"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}

type SupportedDocument struct {
	Country  string `json:"country"`
	Type     string `json:"type"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Format   string `json:"format_hint"`
}
