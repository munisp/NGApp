package repository

import (
	"api-marketplace/internal/models"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

type MarketplaceRepository struct {
	mu            sync.RWMutex
	products      map[string]*models.APIProduct
	subscriptions map[string]*models.Subscription
}

func NewMarketplaceRepository() *MarketplaceRepository {
	repo := &MarketplaceRepository{
		products:      make(map[string]*models.APIProduct),
		subscriptions: make(map[string]*models.Subscription),
	}
	repo.seedProducts()
	return repo
}

func (r *MarketplaceRepository) seedProducts() {
	products := []models.APIProduct{
		{ID: "API-001", Name: "Claims Processing API", Description: "End-to-end claims submission, adjudication, and payout", Version: "2.0", Category: "claims", Provider: "NGInsure Core", Pricing: "free_tier", RateLimit: 100, Status: "active", Subscribers: 45,
			Endpoints: []models.APIEndpoint{{Method: "POST", Path: "/claims/submit", Description: "Submit a new claim"}, {Method: "GET", Path: "/claims/{id}", Description: "Get claim status"}, {Method: "POST", Path: "/claims/{id}/approve", Description: "Approve a claim"}}, CreatedAt: time.Now().AddDate(-1, 0, 0)},
		{ID: "API-002", Name: "Underwriting API", Description: "Risk assessment and policy pricing", Version: "1.5", Category: "underwriting", Provider: "NGInsure Core", Pricing: "per_call", RateLimit: 50, Status: "active", Subscribers: 32,
			Endpoints: []models.APIEndpoint{{Method: "POST", Path: "/underwrite/assess", Description: "Assess risk"}, {Method: "POST", Path: "/underwrite/price", Description: "Calculate premium"}}, CreatedAt: time.Now().AddDate(0, -8, 0)},
		{ID: "API-003", Name: "KYC/KYB Verification", Description: "Identity verification with NIN, BVN, CAC lookup", Version: "2.1", Category: "compliance", Provider: "NGInsure Identity", Pricing: "per_call", RateLimit: 30, Status: "active", Subscribers: 78,
			Endpoints: []models.APIEndpoint{{Method: "POST", Path: "/kyc/verify-nin", Description: "Verify NIN"}, {Method: "POST", Path: "/kyc/verify-bvn", Description: "Verify BVN"}, {Method: "POST", Path: "/kyc/liveness", Description: "Liveness check"}}, CreatedAt: time.Now().AddDate(0, -6, 0)},
		{ID: "API-004", Name: "Payment Gateway", Description: "Multi-channel payment processing (bank, mobile money, USSD)", Version: "3.0", Category: "payments", Provider: "NGInsure Payments", Pricing: "per_transaction", RateLimit: 200, Status: "active", Subscribers: 120,
			Endpoints: []models.APIEndpoint{{Method: "POST", Path: "/pay/initiate", Description: "Initiate payment"}, {Method: "GET", Path: "/pay/{ref}/status", Description: "Payment status"}, {Method: "POST", Path: "/pay/payout", Description: "Disbursement"}}, CreatedAt: time.Now().AddDate(-1, -3, 0)},
		{ID: "API-005", Name: "Telematics & UBI", Description: "Vehicle telematics data ingestion and driving score", Version: "1.0", Category: "iot", Provider: "NGInsure IoT", Pricing: "per_device", RateLimit: 500, Status: "active", Subscribers: 15,
			Endpoints: []models.APIEndpoint{{Method: "POST", Path: "/telemetry/ingest", Description: "Ingest data"}, {Method: "GET", Path: "/telemetry/{policy}/score", Description: "Driving score"}}, CreatedAt: time.Now().AddDate(0, -2, 0)},
	}
	for i := range products {
		r.products[products[i].ID] = &products[i]
	}
}

func generateAPIKey() string {
	b := make([]byte, 24)
	rand.Read(b)
	return "ngk_" + hex.EncodeToString(b)
}

func (r *MarketplaceRepository) GetProducts(category string) []models.APIProduct {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.APIProduct
	for _, p := range r.products {
		if category != "" && p.Category != category { continue }
		if p.Status == "active" { result = append(result, *p) }
	}
	return result
}

func (r *MarketplaceRepository) GetProduct(id string) (*models.APIProduct, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.products[id]
	if !ok { return nil, fmt.Errorf("product %s not found", id) }
	return p, nil
}

func (r *MarketplaceRepository) Subscribe(tenantID, productID, plan string) (*models.Subscription, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.products[productID]
	if !ok { return nil, fmt.Errorf("product %s not found", productID) }
	callsLimit := 1000
	switch plan {
	case "professional": callsLimit = 10000
	case "enterprise": callsLimit = 100000
	}
	sub := &models.Subscription{
		ID: fmt.Sprintf("SUB-%d", time.Now().UnixNano()%10000000),
		TenantID: tenantID, ProductID: productID,
		APIKey: generateAPIKey(), Plan: plan, Status: "active",
		CallsLimit: callsLimit, ExpiresAt: time.Now().AddDate(0, 1, 0), CreatedAt: time.Now(),
	}
	r.subscriptions[sub.ID] = sub
	p.Subscribers++
	return sub, nil
}

func (r *MarketplaceRepository) GetSubscriptions(tenantID string) []models.Subscription {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []models.Subscription
	for _, s := range r.subscriptions {
		if s.TenantID == tenantID { result = append(result, *s) }
	}
	return result
}

func (r *MarketplaceRepository) GetStats() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()
	totalSubs := len(r.subscriptions)
	byCat := map[string]int{}
	for _, p := range r.products { byCat[p.Category]++ }
	return map[string]interface{}{
		"total_products": len(r.products), "total_subscriptions": totalSubs, "by_category": byCat,
	}
}
