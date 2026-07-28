package repository

import (
	"embedded-distribution-platform/internal/models"
	"sync"
	"time"
)

type Repository struct {
	mu          sync.RWMutex
	partners    map[string]*models.Partner
	products    map[string]*models.EmbeddedProduct
	enrollments map[string]*models.Enrollment
}

func NewRepository() *Repository {
	r := &Repository{
		partners:    make(map[string]*models.Partner),
		products:    make(map[string]*models.EmbeddedProduct),
		enrollments: make(map[string]*models.Enrollment),
	}
	r.seed()
	return r
}

func (r *Repository) seed() {
	partners := []models.Partner{
		{ID: "PTR-001", Name: "PayStack Financial", Channel: models.ChannelLoanEmbedded, Industry: "fintech", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://paystack.example/webhook", CommissionPct: 15, IsActive: true, CreatedAt: time.Now()},
		{ID: "PTR-002", Name: "MTN MoMo Nigeria", Channel: models.ChannelAirtimeBundled, Industry: "telco", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://mtn.example/webhook", CommissionPct: 20, IsActive: true, CreatedAt: time.Now()},
		{ID: "PTR-003", Name: "Jumia Marketplace", Channel: models.ChannelEcomCheckout, Industry: "ecommerce", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://jumia.example/webhook", CommissionPct: 12, IsActive: true, CreatedAt: time.Now()},
		{ID: "PTR-004", Name: "Bolt Nigeria", Channel: models.ChannelRideHailing, Industry: "ride_hailing", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://bolt.example/webhook", CommissionPct: 18, IsActive: true, CreatedAt: time.Now()},
		{ID: "PTR-005", Name: "PiggyVest", Channel: models.ChannelSavingsLinked, Industry: "savings", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://piggyvest.example/webhook", CommissionPct: 10, IsActive: true, CreatedAt: time.Now()},
		{ID: "PTR-006", Name: "Kuda Bank", Channel: models.ChannelMarketplaceSDK, Industry: "neobank", APIKey: "PARTNER_KEY_PLACEHOLDER", WebhookURL: "https://kuda.example/webhook", CommissionPct: 14, IsActive: true, CreatedAt: time.Now()},
	}
	for i := range partners {
		r.partners[partners[i].ID] = &partners[i]
	}
	products := []models.EmbeddedProduct{
		{ID: "EMB-001", Name: "Credit Life Plus", Channel: models.ChannelLoanEmbedded, InsuranceType: "credit_life", PremiumNGN: 500, CoverageNGN: 100000, Duration: "loan_term", AutoEnroll: true, Description: "Auto-enrolled with loan disbursement — covers outstanding balance on death/disability"},
		{ID: "EMB-002", Name: "Airtime Accident Cover", Channel: models.ChannelAirtimeBundled, InsuranceType: "personal_accident", PremiumNGN: 50, CoverageNGN: 25000, Duration: "30_days", AutoEnroll: true, Description: "Bundled with N500+ data purchase — personal accident cover for 30 days"},
		{ID: "EMB-003", Name: "Device Protection", Channel: models.ChannelEcomCheckout, InsuranceType: "device_protection", PremiumNGN: 1500, CoverageNGN: 150000, Duration: "12_months", AutoEnroll: false, Description: "Offered at checkout for electronics — covers accidental damage and theft"},
		{ID: "EMB-004", Name: "Ride-Hailing Driver Cover", Channel: models.ChannelRideHailing, InsuranceType: "motor_commercial", PremiumNGN: 200, CoverageNGN: 500000, Duration: "per_day", AutoEnroll: true, Description: "Per-trip/daily coverage for gig drivers — activate/deactivate with swipe"},
		{ID: "EMB-005", Name: "Savings Guard", Channel: models.ChannelSavingsLinked, InsuranceType: "savings_protection", PremiumNGN: 300, CoverageNGN: 200000, Duration: "monthly", AutoEnroll: true, Description: "Protects savings from health emergencies — auto-deducted monthly"},
		{ID: "EMB-006", Name: "Marketplace Insurance Exchange", Channel: models.ChannelMarketplaceSDK, InsuranceType: "multi_product", PremiumNGN: 0, CoverageNGN: 0, Duration: "varies", AutoEnroll: false, Description: "B2B2C SDK — any distributor offers any insurer product via API"},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
}

func (r *Repository) GetPartners() []models.Partner {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.Partner, 0, len(r.partners))
	for _, p := range r.partners {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) GetPartner(id string) *models.Partner {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if p, ok := r.partners[id]; ok {
		c := *p
		return &c
	}
	return nil
}

func (r *Repository) GetProducts() []models.EmbeddedProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.EmbeddedProduct, 0, len(r.products))
	for _, p := range r.products {
		result = append(result, *p)
	}
	return result
}

func (r *Repository) CreateEnrollment(e *models.Enrollment) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enrollments[e.ID] = e
}

func (r *Repository) GetEnrollments() []models.Enrollment {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]models.Enrollment, 0, len(r.enrollments))
	for _, e := range r.enrollments {
		result = append(result, *e)
	}
	return result
}

func (r *Repository) GetEnrollmentsByPartner(partnerID string) []models.Enrollment {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Enrollment
	for _, e := range r.enrollments {
		if e.PartnerID == partnerID {
			result = append(result, *e)
		}
	}
	return result
}
