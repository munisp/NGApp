package repository

import (
	"niira-compulsory-insurance/internal/models"
	"sync"
	"time"
)

type Repository struct {
	mu       sync.RWMutex
	products map[string]*models.CompulsoryProduct
	policies map[string]*models.NIIRAPolicy
	certs    map[string]*models.ComplianceCertificate
}

func NewRepository() *Repository {
	r := &Repository{
		products: make(map[string]*models.CompulsoryProduct),
		policies: make(map[string]*models.NIIRAPolicy),
		certs:    make(map[string]*models.ComplianceCertificate),
	}
	r.seed()
	return r
}

func (r *Repository) seed() {
	products := []models.CompulsoryProduct{
		{ID: "NIIRA-001", Name: "Motor Third Party", Class: models.ClassMotorTP, Description: "Mandatory third-party liability for all motor vehicles", NIIRASection: "Section 68", MinCoverageNGN: 1000000, BasePremiumNGN: 5000, ApplicableTo: []string{"vehicle_owners"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N250,000 fine or 1 year imprisonment", IsActive: true},
		{ID: "NIIRA-002", Name: "Employer Liability", Class: models.ClassEmployerLiability, Description: "Coverage for employer obligations to employees for work-related injuries", NIIRASection: "Section 73", MinCoverageNGN: 5000000, BasePremiumNGN: 25000, ApplicableTo: []string{"employers_5plus"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N500,000 fine", IsActive: true},
		{ID: "NIIRA-003", Name: "Building Insurance", Class: models.ClassBuildingInsurance, Description: "Fire and special perils coverage for buildings exceeding 2 floors", NIIRASection: "Section 64", MinCoverageNGN: 10000000, BasePremiumNGN: 50000, ApplicableTo: []string{"building_owners_2plus_floors"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N1,000,000 fine", IsActive: true},
		{ID: "NIIRA-004", Name: "Professional Indemnity", Class: models.ClassProfessionalPI, Description: "NEW under NIIRA 2025 — mandatory for doctors, lawyers, accountants, engineers", NIIRASection: "Section 75A", MinCoverageNGN: 10000000, BasePremiumNGN: 45000, ApplicableTo: []string{"doctors", "lawyers", "accountants", "engineers", "architects"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "License suspension + N500,000 fine", IsActive: true},
		{ID: "NIIRA-005", Name: "Product Liability", Class: models.ClassProductLiability, Description: "NEW under NIIRA 2025 — mandatory for manufacturers of consumer products", NIIRASection: "Section 75B", MinCoverageNGN: 20000000, BasePremiumNGN: 75000, ApplicableTo: []string{"food_manufacturers", "pharma", "consumer_goods", "electronics"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N1,000,000 fine + product recall liability", IsActive: true},
		{ID: "NIIRA-006", Name: "Healthcare Professional Indemnity", Class: models.ClassHealthcarePI, Description: "NEW under NIIRA 2025 — medical malpractice coverage for healthcare practitioners", NIIRASection: "Section 75C", MinCoverageNGN: 15000000, BasePremiumNGN: 60000, ApplicableTo: []string{"hospitals", "clinics", "pharmacies", "diagnostic_centres"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N750,000 fine + license review", IsActive: true},
		{ID: "NIIRA-007", Name: "Marine Cargo", Class: models.ClassMarineCargo, Description: "Expanded under NIIRA 2025 — all imports must be insured locally", NIIRASection: "Section 71A", MinCoverageNGN: 50000000, BasePremiumNGN: 150000, ApplicableTo: []string{"importers", "exporters", "shipping_companies"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "Cargo seizure + N2,000,000 fine", IsActive: true},
		{ID: "NIIRA-008", Name: "Public Liability", Class: models.ClassPublicLiability, Description: "Expanded under NIIRA 2025 — mandatory for public-facing businesses", NIIRASection: "Section 76A", MinCoverageNGN: 5000000, BasePremiumNGN: 30000, ApplicableTo: []string{"hotels", "malls", "cinemas", "transport_operators", "event_venues"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N500,000 fine + closure order", IsActive: true},
		{ID: "NIIRA-009", Name: "Group Life", Class: models.ClassGroupLife, Description: "Mandatory life insurance for employees by employers with 3+ staff", NIIRASection: "Section 73B", MinCoverageNGN: 3000000, BasePremiumNGN: 15000, ApplicableTo: []string{"employers_3plus"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N250,000 fine", IsActive: true},
		{ID: "NIIRA-010", Name: "Occupiers Liability", Class: models.ClassOccupiers, Description: "Coverage for injuries to visitors on business premises", NIIRASection: "Section 76B", MinCoverageNGN: 3000000, BasePremiumNGN: 20000, ApplicableTo: []string{"office_buildings", "warehouses", "factories"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "N300,000 fine", IsActive: true},
		{ID: "NIIRA-011", Name: "Contractors All Risk", Class: models.ClassContractorsAllRisk, Description: "Coverage for construction projects including third-party liability", NIIRASection: "Section 77", MinCoverageNGN: 100000000, BasePremiumNGN: 250000, ApplicableTo: []string{"construction_companies", "contractors"}, ComplianceDeadline: "2026-07-30", PenaltyForNonCompliance: "Contract nullification + N5,000,000 fine", IsActive: true},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
	_ = time.Now()
}

func (r *Repository) GetProducts() []models.CompulsoryProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.CompulsoryProduct, 0, len(r.products))
	for _, p := range r.products {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetProduct(id string) *models.CompulsoryProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.products[id]; ok {
		c := *p
		return &c
	}
	return nil
}

func (r *Repository) CreatePolicy(p *models.NIIRAPolicy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
}

func (r *Repository) GetPolicies() []models.NIIRAPolicy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.NIIRAPolicy, 0, len(r.policies))
	for _, p := range r.policies {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) CreateCertificate(c *models.ComplianceCertificate) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.certs[c.ID] = c
}

func (r *Repository) GetCertificates() []models.ComplianceCertificate {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.ComplianceCertificate, 0, len(r.certs))
	for _, c := range r.certs {
		result = append(result, *c)
	}
	return result
}
