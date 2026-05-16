package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8112"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/tenants", handleListTenants)
	mux.HandleFunc("/api/v1/tenants/create", handleCreateTenant)
	mux.HandleFunc("/api/v1/tenants/config/", handleTenantConfig)
	mux.HandleFunc("/api/v1/tenants/billing/", handleTenantBilling)
	mux.HandleFunc("/api/v1/tenants/usage/", handleTenantUsage)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"multi-tenant-platform"}`))
	})
	log.Printf("Multi-Tenant Platform starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

type Tenant struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Country      string    `json:"country"`
	Plan         string    `json:"plan"`
	Status       string    `json:"status"`
	Domain       string    `json:"custom_domain,omitempty"`
	Branding     Branding  `json:"branding"`
	CreatedAt    time.Time `json:"created_at"`
	Policies     int       `json:"total_policies"`
	MRR          float64   `json:"mrr_usd"`
}

type Branding struct {
	LogoURL      string `json:"logo_url"`
	PrimaryColor string `json:"primary_color"`
	CompanyName  string `json:"company_name"`
}

func handleListTenants(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenants": []Tenant{
			{
				ID: "TNT-001", Name: "SafeGuard Insurance", Country: "NG",
				Plan: "enterprise", Status: "active",
				Domain: "safeguard.ngapp.ng",
				Branding: Branding{LogoURL: "/logos/safeguard.png", PrimaryColor: "#1E40AF", CompanyName: "SafeGuard Insurance Ltd"},
				CreatedAt: time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC),
				Policies: 45000, MRR: 5000,
			},
			{
				ID: "TNT-002", Name: "Bima Kenya", Country: "KE",
				Plan: "growth", Status: "active",
				Domain: "bima-ke.ngapp.ng",
				Branding: Branding{LogoURL: "/logos/bima-ke.png", PrimaryColor: "#059669", CompanyName: "Bima Kenya Insurance"},
				CreatedAt: time.Date(2025, 9, 15, 0, 0, 0, 0, time.UTC),
				Policies: 12000, MRR: 2000,
			},
			{
				ID: "TNT-003", Name: "AmanaCover", Country: "NG",
				Plan: "starter", Status: "active",
				Branding: Branding{LogoURL: "/logos/amana.png", PrimaryColor: "#7C3AED", CompanyName: "AmanaCover Takaful"},
				CreatedAt: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC),
				Policies: 3500, MRR: 500,
			},
		},
		"total_tenants": 3,
		"total_mrr_usd": 7500,
	})
}

func handleCreateTenant(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Name    string `json:"name"`
		Country string `json:"country"`
		Plan    string `json:"plan"`
		Email   string `json:"admin_email"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id":   fmt.Sprintf("TNT-%d", time.Now().UnixNano()%100000),
		"status":      "provisioning",
		"message":     "Tenant environment being provisioned. Ready in ~2 minutes.",
		"admin_url":   fmt.Sprintf("https://%s.ngapp.ng/admin", "new-tenant"),
		"setup_steps": []string{
			"Database schema created",
			"Default products configured",
			"Admin user invitation sent",
			"Payment gateway sandbox configured",
			"Custom domain DNS instructions sent",
		},
	})
}

func handleTenantConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": "TNT-001",
		"config": map[string]interface{}{
			"products_enabled":   []string{"motor_tp", "motor_comp", "term_life", "hospital_cash", "funeral_cover"},
			"payment_providers":  []string{"paystack", "flutterwave", "opay"},
			"kyc_provider":       "verifyMe",
			"sms_provider":       "africas_talking",
			"whatsapp_enabled":   true,
			"ussd_code":          "*384*001#",
			"max_users":          50,
			"max_agents":         200,
			"api_rate_limit":     5000,
			"data_retention_days": 2555,
			"backup_frequency":   "daily",
		},
	})
}

func handleTenantBilling(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": []map[string]interface{}{
			{"name": "Starter", "price_usd": 500, "policies_included": 5000, "users": 10, "agents": 50, "features": []string{"Core products", "SMS notifications", "Basic analytics"}},
			{"name": "Growth", "price_usd": 2000, "policies_included": 25000, "users": 25, "agents": 200, "features": []string{"All products", "WhatsApp + USSD", "AI claims", "Advanced analytics", "API access"}},
			{"name": "Enterprise", "price_usd": 5000, "policies_included": 100000, "users": -1, "agents": -1, "features": []string{"Everything", "Custom domain", "SLA 99.9%", "Dedicated support", "Custom integrations", "Multi-country"}},
		},
	})
}

func handleTenantUsage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tenant_id": "TNT-001",
		"period":    "2026-05",
		"usage": map[string]interface{}{
			"policies_created":   1250,
			"claims_processed":   340,
			"api_calls":          85000,
			"sms_sent":           4500,
			"whatsapp_messages":  2800,
			"storage_used_gb":    4.5,
			"active_users":       35,
			"active_agents":      120,
		},
	})
}
