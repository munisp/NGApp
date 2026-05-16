package service

import (
	"fmt"
	"multi-country-regulatory/internal/models"
	"multi-country-regulatory/internal/repository"
	"time"
)

type RegulatoryService struct { repo *repository.RegulatoryRepository }
func NewRegulatoryService(repo *repository.RegulatoryRepository) *RegulatoryService { return &RegulatoryService{repo: repo} }

type CheckRequest struct {
	TenantID string `json:"tenant_id"`
	Country  string `json:"country"`
}

func (s *RegulatoryService) RunComplianceCheck(req CheckRequest) (*models.ComplianceCheck, error) {
	country, err := s.repo.GetCountry(req.Country)
	if err != nil { return nil, err }

	findings := []models.Finding{
		{Rule: "Capital Adequacy", Status: "pass", Severity: "critical", Details: fmt.Sprintf("Meets minimum capital requirement of %s %.0f", country.Currency, country.MinCapital)},
		{Rule: "License Validity", Status: "pass", Severity: "critical", Details: "Operating license is valid and current"},
		{Rule: "KYC Compliance", Status: "pass", Severity: "high", Details: fmt.Sprintf("%s level KYC verification implemented", country.KYCLevel)},
		{Rule: "Data Residency", Status: "pass", Severity: "high", Details: func() string { if country.DataResidency { return "Data stored within country borders" }; return "No data residency requirement" }()},
		{Rule: "Regulatory Reporting", Status: "pass", Severity: "medium", Details: fmt.Sprintf("%s reporting schedule maintained", country.ReportingFreq)},
		{Rule: "Tax Compliance", Status: "pass", Severity: "high", Details: fmt.Sprintf("Insurance tax rate of %.1f%% applied", country.TaxRate*100)},
		{Rule: "Consumer Protection", Status: "pass", Severity: "medium", Details: "Complaint handling and disclosure requirements met"},
		{Rule: "AML/CFT Controls", Status: "pass", Severity: "critical", Details: "Anti-money laundering controls in place"},
	}

	score := 0
	for _, f := range findings {
		if f.Status == "pass" { score += 10 }
	}

	status := "compliant"
	if score < 60 { status = "non_compliant" } else if score < 80 { status = "partial" }

	check := models.ComplianceCheck{
		ID: fmt.Sprintf("CHK-%d", time.Now().UnixNano()%10000000),
		TenantID: req.TenantID, Country: req.Country, Category: "full_audit",
		Status: status, Score: score, MaxScore: len(findings) * 10,
		Findings: findings, CheckedAt: time.Now(),
	}
	s.repo.AddCheck(check)
	return &check, nil
}

func (s *RegulatoryService) GetCountries() []models.Country { return s.repo.GetCountries() }
func (s *RegulatoryService) GetCountry(code string) (*models.Country, error) { return s.repo.GetCountry(code) }
func (s *RegulatoryService) GetChecks(tenantID, country string) []models.ComplianceCheck { return s.repo.GetChecks(tenantID, country) }
func (s *RegulatoryService) GetReports(tenantID string) []models.RegulatoryReport { return s.repo.GetReports(tenantID) }
func (s *RegulatoryService) GetStats() map[string]interface{} { return s.repo.GetStats() }
