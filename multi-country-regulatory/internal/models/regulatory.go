package models

import "time"

type Country struct {
	Code           string   `json:"code"`
	Name           string   `json:"name"`
	Regulator      string   `json:"regulator"`
	Currency       string   `json:"currency"`
	MinCapital     float64  `json:"min_capital_requirement"`
	LicenseTypes   []string `json:"license_types"`
	ReportingFreq  string   `json:"reporting_frequency"`
	DataResidency  bool     `json:"data_residency_required"`
	KYCLevel       string   `json:"kyc_level"`
	TaxRate        float64  `json:"insurance_tax_rate"`
	IsActive       bool     `json:"is_active"`
}

type ComplianceCheck struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Country     string    `json:"country"`
	Category    string    `json:"category"`
	Status      string    `json:"status"`
	Score       int       `json:"score"`
	MaxScore    int       `json:"max_score"`
	Findings    []Finding `json:"findings"`
	CheckedAt   time.Time `json:"checked_at"`
}

type Finding struct {
	Rule     string `json:"rule"`
	Status   string `json:"status"`
	Severity string `json:"severity"`
	Details  string `json:"details"`
}

type RegulatoryReport struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Country   string    `json:"country"`
	Type      string    `json:"type"`
	Period    string    `json:"period"`
	Status    string    `json:"status"`
	DueDate   time.Time `json:"due_date"`
	FiledAt   *time.Time `json:"filed_at,omitempty"`
}
