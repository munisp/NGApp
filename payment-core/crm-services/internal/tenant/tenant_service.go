package tenant

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Product represents a fintech product module that can be enabled per tenant
type Product string

const (
	ProductCoreBanking  Product = "core_banking"
	ProductAgentBanking Product = "agent_banking"
	ProductRemittance   Product = "remittance"
	ProductPayments     Product = "payments"
	ProductLending      Product = "lending"
	ProductInsurance    Product = "insurance"
	ProductInvestments  Product = "investments"
	ProductCards        Product = "cards"
)

// AllProducts returns all available product modules
func AllProducts() []Product {
	return []Product{
		ProductCoreBanking, ProductAgentBanking, ProductRemittance,
		ProductPayments, ProductLending, ProductInsurance,
		ProductInvestments, ProductCards,
	}
}

// TenantStatus represents the operational status of a tenant
type TenantStatus string

const (
	StatusActive    TenantStatus = "active"
	StatusSuspended TenantStatus = "suspended"
	StatusTrial     TenantStatus = "trial"
	StatusPending   TenantStatus = "pending"
)

// Tenant represents a fintech organization using the platform
type Tenant struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Slug             string            `json:"slug"`
	Status           TenantStatus      `json:"status"`
	Products         map[Product]bool  `json:"products"`
	Branding         TenantBranding    `json:"branding"`
	Settings         TenantSettings    `json:"settings"`
	Limits           TenantLimits      `json:"limits"`
	Contacts         []TenantContact   `json:"contacts"`
	Metadata         map[string]string `json:"metadata,omitempty"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
	SubscriptionTier string            `json:"subscription_tier"`
}

// TenantBranding holds tenant-specific visual customization
type TenantBranding struct {
	LogoURL      string `json:"logo_url,omitempty"`
	FaviconURL   string `json:"favicon_url,omitempty"`
	PrimaryColor string `json:"primary_color"`
	AccentColor  string `json:"accent_color"`
	DarkMode     bool   `json:"dark_mode"`
	CompanyName  string `json:"company_name"`
}

// TenantSettings holds operational configuration
type TenantSettings struct {
	DefaultCurrency    string   `json:"default_currency"`
	SupportedCurrencies []string `json:"supported_currencies"`
	Timezone           string   `json:"timezone"`
	Language           string   `json:"language"`
	DataResidency      string   `json:"data_residency"`
	APIRateLimit       int      `json:"api_rate_limit"`
	MaxUsers           int      `json:"max_users"`
	MaxAgents          int      `json:"max_agents"`
	EnableAuditLog     bool     `json:"enable_audit_log"`
	EnableWebhooks     bool     `json:"enable_webhooks"`
	WebhookURL         string   `json:"webhook_url,omitempty"`
}

// TenantLimits holds product-specific operational limits
type TenantLimits struct {
	MaxCustomers         int     `json:"max_customers"`
	MaxTransactionsPerDay int    `json:"max_transactions_per_day"`
	MaxTransferAmount    float64 `json:"max_transfer_amount"`
	MaxAgentCashLimit    float64 `json:"max_agent_cash_limit"`
	MaxRemittanceAmount  float64 `json:"max_remittance_amount"`
}

// TenantContact holds contact information for a tenant
type TenantContact struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
	Role  string `json:"role"`
}

// ProductEntitlement describes a tenant's access to a specific product
type ProductEntitlement struct {
	Product   Product   `json:"product"`
	Enabled   bool      `json:"enabled"`
	Tier      string    `json:"tier"`
	ExpiresAt time.Time `json:"expires_at,omitempty"`
	Features  []string  `json:"features,omitempty"`
}

// TenantService manages multi-tenant operations
type TenantService struct {
	tenants map[string]*Tenant
	mu      sync.RWMutex
}

// NewTenantService creates a new TenantService with seed data
func NewTenantService() *TenantService {
	svc := &TenantService{
		tenants: make(map[string]*Tenant),
	}
	svc.seedTenants()
	return svc
}

// seedTenants populates sample tenants demonstrating different product configurations
func (s *TenantService) seedTenants() {
	now := time.Now()

	// Tenant A: Full-suite bank (Core Banking + Agent Banking + Payments + Remittance)
	s.tenants["tenant-acme-bank"] = &Tenant{
		ID:   "tenant-acme-bank",
		Name: "Acme Microfinance Bank",
		Slug: "acme-bank",
		Status: StatusActive,
		Products: map[Product]bool{
			ProductCoreBanking:  true,
			ProductAgentBanking: true,
			ProductRemittance:   true,
			ProductPayments:     true,
			ProductLending:      true,
			ProductCards:        true,
			ProductInsurance:    false,
			ProductInvestments:  false,
		},
		Branding: TenantBranding{
			PrimaryColor: "#1E40AF",
			AccentColor:  "#7C3AED",
			CompanyName:  "Acme Microfinance Bank",
		},
		Settings: TenantSettings{
			DefaultCurrency:     "NGN",
			SupportedCurrencies: []string{"NGN", "USD", "GBP", "EUR"},
			Timezone:            "Africa/Lagos",
			Language:            "en",
			DataResidency:       "ng",
			APIRateLimit:        1000,
			MaxUsers:            500,
			MaxAgents:           2000,
			EnableAuditLog:      true,
			EnableWebhooks:      true,
		},
		Limits: TenantLimits{
			MaxCustomers:          500000,
			MaxTransactionsPerDay: 100000,
			MaxTransferAmount:     50000000,
			MaxAgentCashLimit:     5000000,
			MaxRemittanceAmount:   10000000,
		},
		Contacts: []TenantContact{
			{Name: "Adebayo Ogundimu", Email: "adebayo@acmebank.ng", Phone: "+234-801-234-5678", Role: "CTO"},
		},
		CreatedAt:        now.Add(-180 * 24 * time.Hour),
		UpdatedAt:        now,
		SubscriptionTier: "enterprise",
	}

	// Tenant B: Agent Banking only (mobile money operator)
	s.tenants["tenant-quickcash"] = &Tenant{
		ID:   "tenant-quickcash",
		Name: "QuickCash Mobile Money",
		Slug: "quickcash",
		Status: StatusActive,
		Products: map[Product]bool{
			ProductCoreBanking:  false,
			ProductAgentBanking: true,
			ProductRemittance:   false,
			ProductPayments:     true,
			ProductLending:      false,
			ProductCards:        false,
			ProductInsurance:    false,
			ProductInvestments:  false,
		},
		Branding: TenantBranding{
			PrimaryColor: "#059669",
			AccentColor:  "#F59E0B",
			CompanyName:  "QuickCash",
		},
		Settings: TenantSettings{
			DefaultCurrency:     "NGN",
			SupportedCurrencies: []string{"NGN"},
			Timezone:            "Africa/Lagos",
			Language:            "en",
			DataResidency:       "ng",
			APIRateLimit:        500,
			MaxUsers:            50,
			MaxAgents:           5000,
			EnableAuditLog:      true,
			EnableWebhooks:      false,
		},
		Limits: TenantLimits{
			MaxCustomers:          200000,
			MaxTransactionsPerDay: 50000,
			MaxTransferAmount:     1000000,
			MaxAgentCashLimit:     2000000,
		},
		Contacts: []TenantContact{
			{Name: "Halima Abubakar", Email: "halima@quickcash.ng", Phone: "+234-802-345-6789", Role: "CEO"},
		},
		CreatedAt:        now.Add(-90 * 24 * time.Hour),
		UpdatedAt:        now,
		SubscriptionTier: "growth",
	}

	// Tenant C: Remittance-focused (IMT operator)
	s.tenants["tenant-swiftremit"] = &Tenant{
		ID:   "tenant-swiftremit",
		Name: "SwiftRemit International",
		Slug: "swiftremit",
		Status: StatusActive,
		Products: map[Product]bool{
			ProductCoreBanking:  false,
			ProductAgentBanking: false,
			ProductRemittance:   true,
			ProductPayments:     true,
			ProductLending:      false,
			ProductCards:        false,
			ProductInsurance:    false,
			ProductInvestments:  false,
		},
		Branding: TenantBranding{
			PrimaryColor: "#7C3AED",
			AccentColor:  "#EC4899",
			CompanyName:  "SwiftRemit",
		},
		Settings: TenantSettings{
			DefaultCurrency:     "USD",
			SupportedCurrencies: []string{"USD", "NGN", "GBP", "EUR", "CAD", "GHS", "KES"},
			Timezone:            "UTC",
			Language:            "en",
			DataResidency:       "eu",
			APIRateLimit:        2000,
			MaxUsers:            100,
			EnableAuditLog:      true,
			EnableWebhooks:      true,
		},
		Limits: TenantLimits{
			MaxCustomers:          100000,
			MaxTransactionsPerDay: 25000,
			MaxRemittanceAmount:   50000000,
		},
		Contacts: []TenantContact{
			{Name: "Chidinma Okafor", Email: "chidinma@swiftremit.com", Phone: "+44-20-7946-0958", Role: "COO"},
		},
		CreatedAt:        now.Add(-60 * 24 * time.Hour),
		UpdatedAt:        now,
		SubscriptionTier: "enterprise",
	}

	// Tenant D: Trial tenant (exploring platform)
	s.tenants["tenant-nextgen-mfb"] = &Tenant{
		ID:   "tenant-nextgen-mfb",
		Name: "NextGen MFB",
		Slug: "nextgen-mfb",
		Status: StatusTrial,
		Products: map[Product]bool{
			ProductCoreBanking:  true,
			ProductAgentBanking: true,
			ProductRemittance:   false,
			ProductPayments:     false,
			ProductLending:      false,
			ProductCards:        false,
			ProductInsurance:    false,
			ProductInvestments:  false,
		},
		Branding: TenantBranding{
			PrimaryColor: "#DC2626",
			AccentColor:  "#EA580C",
			CompanyName:  "NextGen MFB",
		},
		Settings: TenantSettings{
			DefaultCurrency:     "NGN",
			SupportedCurrencies: []string{"NGN"},
			Timezone:            "Africa/Lagos",
			Language:            "en",
			DataResidency:       "ng",
			APIRateLimit:        100,
			MaxUsers:            10,
			MaxAgents:           50,
			EnableAuditLog:      false,
			EnableWebhooks:      false,
		},
		Limits: TenantLimits{
			MaxCustomers:          1000,
			MaxTransactionsPerDay: 500,
			MaxTransferAmount:     500000,
			MaxAgentCashLimit:     100000,
		},
		Contacts: []TenantContact{
			{Name: "Musa Abdullahi", Email: "musa@nextgenmfb.ng", Phone: "+234-803-456-7890", Role: "MD"},
		},
		CreatedAt:        now.Add(-7 * 24 * time.Hour),
		UpdatedAt:        now,
		SubscriptionTier: "trial",
	}
}

// GetTenant retrieves a tenant by ID
func (s *TenantService) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tenant, ok := s.tenants[id]
	if !ok {
		return nil, fmt.Errorf("tenant not found: %s", id)
	}
	return tenant, nil
}

// ListTenants returns all tenants
func (s *TenantService) ListTenants(ctx context.Context) []*Tenant {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Tenant, 0, len(s.tenants))
	for _, t := range s.tenants {
		result = append(result, t)
	}
	return result
}

// GetTenantBySlug resolves a tenant by its URL slug
func (s *TenantService) GetTenantBySlug(ctx context.Context, slug string) (*Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, t := range s.tenants {
		if t.Slug == slug {
			return t, nil
		}
	}
	return nil, fmt.Errorf("tenant not found for slug: %s", slug)
}

// HasProduct checks if a tenant has access to a specific product
func (s *TenantService) HasProduct(ctx context.Context, tenantID string, product Product) (bool, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return false, err
	}
	if tenant.Status == StatusSuspended {
		return false, nil
	}
	return tenant.Products[product], nil
}

// GetEnabledProducts returns the list of enabled products for a tenant
func (s *TenantService) GetEnabledProducts(ctx context.Context, tenantID string) ([]Product, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var enabled []Product
	for product, active := range tenant.Products {
		if active {
			enabled = append(enabled, product)
		}
	}
	return enabled, nil
}

// UpdateProducts enables or disables products for a tenant
func (s *TenantService) UpdateProducts(ctx context.Context, tenantID string, products map[Product]bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tenant, ok := s.tenants[tenantID]
	if !ok {
		return fmt.Errorf("tenant not found: %s", tenantID)
	}

	for product, enabled := range products {
		tenant.Products[product] = enabled
	}
	tenant.UpdatedAt = time.Now()
	return nil
}

// CreateTenant provisions a new tenant
func (s *TenantService) CreateTenant(ctx context.Context, t *Tenant) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.tenants[t.ID]; exists {
		return fmt.Errorf("tenant already exists: %s", t.ID)
	}

	t.CreatedAt = time.Now()
	t.UpdatedAt = t.CreatedAt
	if t.Products == nil {
		t.Products = make(map[Product]bool)
	}
	s.tenants[t.ID] = t
	return nil
}

// RegisterHTTPHandlers registers tenant API endpoints on the given mux
func (s *TenantService) RegisterHTTPHandlers(mux *http.ServeMux) {
	mux.HandleFunc("/api/tenants", s.handleListTenants)
	mux.HandleFunc("/api/tenants/", s.handleTenantByID)
	mux.HandleFunc("/api/tenants/resolve", s.handleResolveTenant)
	mux.HandleFunc("/api/tenant-config", s.handleTenantConfig)
}

func (s *TenantService) handleListTenants(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	tenants := s.ListTenants(r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenants)
}

func (s *TenantService) handleTenantByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/tenants/")
	if id == "" {
		http.Error(w, "missing tenant id", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		tenant, err := s.GetTenant(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tenant)

	case http.MethodPut:
		var updates map[Product]bool
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if err := s.UpdateProducts(r.Context(), id, updates); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		tenant, _ := s.GetTenant(r.Context(), id)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tenant)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *TenantService) handleResolveTenant(w http.ResponseWriter, r *http.Request) {
	slug := r.URL.Query().Get("slug")
	if slug == "" {
		http.Error(w, "missing slug parameter", http.StatusBadRequest)
		return
	}
	tenant, err := s.GetTenantBySlug(r.Context(), slug)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tenant)
}

// handleTenantConfig returns the current tenant's configuration for the frontend
// Tenant is resolved from X-Tenant-ID header or defaults to demo tenant
func (s *TenantService) handleTenantConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "tenant-acme-bank" // Default for dev mode
	}

	tenant, err := s.GetTenant(r.Context(), tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	config := map[string]interface{}{
		"tenant_id":         tenant.ID,
		"name":              tenant.Name,
		"slug":              tenant.Slug,
		"status":            tenant.Status,
		"subscription_tier": tenant.SubscriptionTier,
		"products":          tenant.Products,
		"branding":          tenant.Branding,
		"settings":          tenant.Settings,
		"limits":            tenant.Limits,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}
