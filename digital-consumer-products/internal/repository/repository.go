package repository

import (
	"digital-consumer-products/internal/models"
	"sync"
	"time"
)

type Repository struct {
	mu       sync.RWMutex
	products map[string]*models.ConsumerProduct
	policies map[string]*models.ConsumerPolicy
	claims   map[string]*models.HospiCashClaim
	cyberAssessments map[string]*models.CyberRiskAssessment
}

func NewRepository() *Repository {
	r := &Repository{
		products: make(map[string]*models.ConsumerProduct),
		policies: make(map[string]*models.ConsumerPolicy),
		claims:   make(map[string]*models.HospiCashClaim),
		cyberAssessments: make(map[string]*models.CyberRiskAssessment),
	}
	r.seed()
	return r
}

func (r *Repository) seed() {
	products := []models.ConsumerProduct{
		{ID: "DCP-001", Name: "Pay-Per-Day Motor Insurance", Line: models.LinePayPerDay, Description: "Buy 1-7 days at a time — no annual commitment, micropayment friendly", MinPremiumNGN: 350, MaxCoverageNGN: 2000000, BillingCycle: "daily", ActivationType: "on_demand", TargetSegment: "informal_economy_drivers", IsActive: true},
		{ID: "DCP-002", Name: "Gig Worker On-Demand Cover", Line: models.LineGigWorker, Description: "Hourly/daily coverage for delivery riders, artisans, freelancers — activate with a swipe", MinPremiumNGN: 100, MaxCoverageNGN: 500000, BillingCycle: "hourly", ActivationType: "on_demand", TargetSegment: "gig_economy", IsActive: true},
		{ID: "DCP-003", Name: "SME Cyber Shield", Line: models.LineSMECyber, Description: "Full policy limit per-claim for unlimited events — data theft, ransomware, business interruption", MinPremiumNGN: 15000, MaxCoverageNGN: 50000000, BillingCycle: "annual", ActivationType: "underwritten", TargetSegment: "sme_digital", IsActive: true},
		{ID: "DCP-004", Name: "Pet Care Insurance", Line: models.LinePetInsurance, Description: "Accident + illness + dental + tele-vet consultations for dogs and cats", MinPremiumNGN: 2000, MaxCoverageNGN: 500000, BillingCycle: "monthly", ActivationType: "standard", TargetSegment: "urban_pet_owners", IsActive: true},
		{ID: "DCP-005", Name: "Digital Nomad Travel Cover", Line: models.LineDigitalNomad, Description: "Global health + equipment + liability for remote workers — subscription not trip-based", MinPremiumNGN: 8000, MaxCoverageNGN: 10000000, BillingCycle: "monthly", ActivationType: "subscription", TargetSegment: "tech_remote_workers", IsActive: true},
		{ID: "DCP-006", Name: "Subscription Motor Insurance", Line: models.LineSubscriptionMotor, Description: "Monthly subscription, cancel anytime, mileage-based pricing via telematics", MinPremiumNGN: 5000, MaxCoverageNGN: 5000000, BillingCycle: "monthly", ActivationType: "subscription", TargetSegment: "urban_young_drivers", IsActive: true},
		{ID: "DCP-007", Name: "Hospi-Cash Benefit", Line: models.LineHospiCash, Description: "Fixed daily cash payout during hospitalisation — no network restrictions, proof of admission = cash", MinPremiumNGN: 500, MaxCoverageNGN: 1000000, BillingCycle: "monthly", ActivationType: "standard", TargetSegment: "mass_market", IsActive: true},
		{ID: "DCP-008", Name: "Funeral & Burial Insurance", Line: models.LineFuneral, Description: "Formalises existing cultural practice — micro-premiums, instant payout on death certificate", MinPremiumNGN: 200, MaxCoverageNGN: 500000, BillingCycle: "monthly", ActivationType: "standard", TargetSegment: "mass_market", IsActive: true},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
	_ = time.Now()
}

func (r *Repository) GetProducts() []models.ConsumerProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.ConsumerProduct, 0, len(r.products))
	for _, p := range r.products {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetProduct(id string) *models.ConsumerProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.products[id]; ok {
		c := *p
		return &c
	}
	return nil
}

func (r *Repository) CreatePolicy(p *models.ConsumerPolicy) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
}

func (r *Repository) GetPolicies() []models.ConsumerPolicy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.ConsumerPolicy, 0, len(r.policies))
	for _, p := range r.policies {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) CreateClaim(c *models.HospiCashClaim) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.claims[c.ID] = c
}

func (r *Repository) GetClaims() []models.HospiCashClaim {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.HospiCashClaim, 0, len(r.claims))
	for _, c := range r.claims {
		result = append(result, *c)
	}
	return result
}

func (r *Repository) StoreCyberAssessment(a *models.CyberRiskAssessment) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cyberAssessments[a.BusinessName] = a
}
