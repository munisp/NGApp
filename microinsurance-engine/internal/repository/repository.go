package repository

import (
	"fmt"
	"microinsurance-engine/internal/models"
	"sync"
	"time"
)

type MicroRepository struct {
	mu        sync.RWMutex
	products  map[string]*models.MicroProduct
	policies  map[string]*models.MicroPolicy
	claims    map[string]*models.MicroClaim
}

func NewMicroRepository() *MicroRepository {
	repo := &MicroRepository{
		products: make(map[string]*models.MicroProduct),
		policies: make(map[string]*models.MicroPolicy),
		claims:   make(map[string]*models.MicroClaim),
	}
	repo.seedProducts()
	return repo
}

func (r *MicroRepository) seedProducts() {
	products := []models.MicroProduct{
		{ID: "MP-001", Name: "Crop Shield", Type: models.ProductCropInsurance, Description: "Covers crop loss from drought, flood, pest", MinPremium: 200, MaxPremium: 5000, CoverageAmount: 50000, DurationDays: 180, Currency: "NGN", IsActive: true, RiskMultiplier: 1.2, ClaimWaitDays: 7, MaxClaimsPerYear: 2},
		{ID: "MP-002", Name: "Livestock Guard", Type: models.ProductLivestockCover, Description: "Covers livestock death/theft", MinPremium: 500, MaxPremium: 10000, CoverageAmount: 100000, DurationDays: 365, Currency: "NGN", IsActive: true, RiskMultiplier: 1.5, ClaimWaitDays: 14, MaxClaimsPerYear: 1},
		{ID: "MP-003", Name: "Device Safe", Type: models.ProductDeviceProtection, Description: "Phone/device screen damage and theft", MinPremium: 100, MaxPremium: 3000, CoverageAmount: 25000, DurationDays: 90, Currency: "NGN", IsActive: true, RiskMultiplier: 0.8, ClaimWaitDays: 3, MaxClaimsPerYear: 3},
		{ID: "MP-004", Name: "Health Lite", Type: models.ProductHealthMicro, Description: "Basic outpatient and pharmacy cover", MinPremium: 300, MaxPremium: 8000, CoverageAmount: 75000, DurationDays: 30, Currency: "NGN", IsActive: true, RiskMultiplier: 1.0, ClaimWaitDays: 0, MaxClaimsPerYear: 12},
		{ID: "MP-005", Name: "Travel Safe", Type: models.ProductTravelMicro, Description: "Trip cancellation and medical abroad", MinPremium: 500, MaxPremium: 15000, CoverageAmount: 200000, DurationDays: 30, Currency: "NGN", IsActive: true, RiskMultiplier: 0.6, ClaimWaitDays: 5, MaxClaimsPerYear: 2},
		{ID: "MP-006", Name: "Farewell Plan", Type: models.ProductFuneralCover, Description: "Funeral expense coverage", MinPremium: 200, MaxPremium: 5000, CoverageAmount: 100000, DurationDays: 365, Currency: "NGN", IsActive: true, RiskMultiplier: 0.3, ClaimWaitDays: 0, MaxClaimsPerYear: 1},
		{ID: "MP-007", Name: "Accident Shield", Type: models.ProductAccidentCover, Description: "Personal accident death/disability", MinPremium: 150, MaxPremium: 4000, CoverageAmount: 150000, DurationDays: 365, Currency: "NGN", IsActive: true, RiskMultiplier: 0.5, ClaimWaitDays: 7, MaxClaimsPerYear: 1},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
}

func (r *MicroRepository) GetProducts() []models.MicroProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.MicroProduct
	for _, p := range r.products {
		if p.IsActive {
			result = append(result, *p)
		}
	}
	return result
}

func (r *MicroRepository) GetProduct(id string) (*models.MicroProduct, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.products[id]
	if !ok {
		return nil, fmt.Errorf("product %s not found", id)
	}
	return p, nil
}

func (r *MicroRepository) CreatePolicy(p *models.MicroPolicy) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.policies[p.ID] = p
	return nil
}

func (r *MicroRepository) GetPolicy(id string) (*models.MicroPolicy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.policies[id]
	if !ok {
		return nil, fmt.Errorf("policy %s not found", id)
	}
	return p, nil
}

func (r *MicroRepository) ListPolicies(customerID string) []models.MicroPolicy {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.MicroPolicy
	for _, p := range r.policies {
		if customerID == "" || p.CustomerID == customerID {
			result = append(result, *p)
		}
	}
	return result
}

func (r *MicroRepository) CreateClaim(c *models.MicroClaim) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.claims[c.ID] = c
	return nil
}

func (r *MicroRepository) GetClaim(id string) (*models.MicroClaim, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	c, ok := r.claims[id]
	if !ok {
		return nil, fmt.Errorf("claim %s not found", id)
	}
	return c, nil
}

func (r *MicroRepository) UpdateClaim(c *models.MicroClaim) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.claims[c.ID] = c
	return nil
}

func (r *MicroRepository) CountClaimsForPolicy(policyID string) int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	count := 0
	for _, c := range r.claims {
		if c.PolicyID == policyID {
			count++
		}
	}
	return count
}

func (r *MicroRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	activePolicies := 0
	totalPremiums := 0.0
	totalClaims := len(r.claims)
	approvedClaims := 0
	claimsPaid := 0.0
	now := time.Now()
	for _, p := range r.policies {
		if p.Status == "active" && now.Before(p.EndDate) {
			activePolicies++
		}
		totalPremiums += p.Premium
	}
	for _, c := range r.claims {
		if c.Status == "approved" || c.Status == "paid" {
			approvedClaims++
			claimsPaid += c.Amount
		}
	}
	return map[string]interface{}{
		"total_products":    len(r.products),
		"active_policies":   activePolicies,
		"total_premiums":    totalPremiums,
		"total_claims":      totalClaims,
		"approved_claims":   approvedClaims,
		"total_claims_paid": claimsPaid,
		"loss_ratio":        claimsPaid / (totalPremiums + 0.01) * 100,
	}
}
