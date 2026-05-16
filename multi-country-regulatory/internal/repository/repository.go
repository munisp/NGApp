package repository

import (
	"fmt"
	"multi-country-regulatory/internal/models"
	"sync"
	"time"
)

type RegulatoryRepository struct {
	mu        sync.RWMutex
	countries map[string]models.Country
	checks    []models.ComplianceCheck
	reports   []models.RegulatoryReport
}

func NewRegulatoryRepository() *RegulatoryRepository {
	repo := &RegulatoryRepository{
		countries: make(map[string]models.Country),
	}
	repo.seedCountries()
	return repo
}

func (r *RegulatoryRepository) seedCountries() {
	countries := []models.Country{
		{Code: "NG", Name: "Nigeria", Regulator: "NAICOM", Currency: "NGN", MinCapital: 3000000000, LicenseTypes: []string{"life", "non-life", "composite", "micro", "takaful"}, ReportingFreq: "quarterly", DataResidency: true, KYCLevel: "enhanced", TaxRate: 0.05, IsActive: true},
		{Code: "KE", Name: "Kenya", Regulator: "IRA Kenya", Currency: "KES", MinCapital: 600000000, LicenseTypes: []string{"life", "general", "composite", "micro"}, ReportingFreq: "quarterly", DataResidency: true, KYCLevel: "standard", TaxRate: 0.045, IsActive: true},
		{Code: "GH", Name: "Ghana", Regulator: "NIC Ghana", Currency: "GHS", MinCapital: 50000000, LicenseTypes: []string{"life", "non-life", "reinsurance"}, ReportingFreq: "quarterly", DataResidency: false, KYCLevel: "standard", TaxRate: 0.06, IsActive: true},
		{Code: "ZA", Name: "South Africa", Regulator: "FSCA/PA", Currency: "ZAR", MinCapital: 10000000, LicenseTypes: []string{"life", "non-life", "composite", "micro", "cell_captive"}, ReportingFreq: "monthly", DataResidency: true, KYCLevel: "enhanced", TaxRate: 0.0, IsActive: true},
		{Code: "EG", Name: "Egypt", Regulator: "FRA Egypt", Currency: "EGP", MinCapital: 150000000, LicenseTypes: []string{"life", "property", "medical"}, ReportingFreq: "quarterly", DataResidency: true, KYCLevel: "enhanced", TaxRate: 0.10, IsActive: true},
		{Code: "RW", Name: "Rwanda", Regulator: "BNR", Currency: "RWF", MinCapital: 5000000000, LicenseTypes: []string{"life", "general", "micro"}, ReportingFreq: "quarterly", DataResidency: false, KYCLevel: "standard", TaxRate: 0.05, IsActive: true},
	}
	for _, c := range countries {
		r.countries[c.Code] = c
	}
}

func (r *RegulatoryRepository) GetCountries() []models.Country {
	var result []models.Country
	for _, c := range r.countries {
		if c.IsActive { result = append(result, c) }
	}
	return result
}

func (r *RegulatoryRepository) GetCountry(code string) (*models.Country, error) {
	c, ok := r.countries[code]
	if !ok { return nil, fmt.Errorf("country %s not found", code) }
	return &c, nil
}

func (r *RegulatoryRepository) AddCheck(c models.ComplianceCheck) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.checks = append(r.checks, c)
}

func (r *RegulatoryRepository) GetChecks(tenantID, country string) []models.ComplianceCheck {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.ComplianceCheck
	for _, c := range r.checks {
		if (tenantID == "" || c.TenantID == tenantID) && (country == "" || c.Country == country) {
			result = append(result, c)
		}
	}
	return result
}

func (r *RegulatoryRepository) AddReport(rr models.RegulatoryReport) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.reports = append(r.reports, rr)
}

func (r *RegulatoryRepository) GetReports(tenantID string) []models.RegulatoryReport {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.RegulatoryReport
	for _, rr := range r.reports {
		if tenantID == "" || rr.TenantID == tenantID {
			result = append(result, rr)
		}
	}
	return result
}

func (r *RegulatoryRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	passed, failed := 0, 0
	for _, c := range r.checks {
		if c.Status == "compliant" { passed++ } else { failed++ }
	}
	return map[string]interface{}{
		"countries": len(r.countries), "total_checks": len(r.checks),
		"compliant": passed, "non_compliant": failed,
		"pending_reports": func() int { c := 0; for _, rr := range r.reports { if rr.Status == "pending" { c++ } }; return c }(),
	}
}

func init() { _ = time.Now }
