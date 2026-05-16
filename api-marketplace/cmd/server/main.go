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
		port = "8111"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/marketplace/apis", handleListAPIs)
	mux.HandleFunc("/api/v1/marketplace/subscribe", handleSubscribe)
	mux.HandleFunc("/api/v1/marketplace/usage", handleUsage)
	mux.HandleFunc("/api/v1/marketplace/partners", handlePartners)
	mux.HandleFunc("/api/v1/marketplace/sandbox", handleSandbox)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"api-marketplace"}`))
	})
	log.Printf("API Marketplace starting on port %s", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%s", port), mux); err != nil {
		log.Fatal(err)
	}
}

func handleListAPIs(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"apis": []map[string]interface{}{
			{
				"id": "api-quote", "name": "Quote API", "version": "v1",
				"description": "Get instant insurance quotes for all product types",
				"category": "core", "pricing": "free_tier_1000",
				"endpoints": []string{"POST /quotes", "GET /quotes/{id}"},
				"rate_limit": "1000/hour",
			},
			{
				"id": "api-policy", "name": "Policy Management API", "version": "v1",
				"description": "Create, manage, and query insurance policies",
				"category": "core", "pricing": "pay_per_use",
				"endpoints": []string{"POST /policies", "GET /policies/{id}", "PUT /policies/{id}", "POST /policies/{id}/renew"},
				"rate_limit": "500/hour",
			},
			{
				"id": "api-claims", "name": "Claims API", "version": "v1",
				"description": "File and track insurance claims with AI assessment",
				"category": "core", "pricing": "pay_per_use",
				"endpoints": []string{"POST /claims", "GET /claims/{id}", "POST /claims/{id}/documents"},
				"rate_limit": "200/hour",
			},
			{
				"id": "api-kyc", "name": "KYC Verification API", "version": "v1",
				"description": "Identity verification across African countries",
				"category": "verification", "pricing": "per_verification",
				"endpoints": []string{"POST /verify", "GET /verify/{id}"},
				"rate_limit": "100/hour",
			},
			{
				"id": "api-payments", "name": "Payment Integration API", "version": "v1",
				"description": "Mobile money, bank transfer, and card payment integration",
				"category": "financial", "pricing": "transaction_fee",
				"endpoints": []string{"POST /payments", "GET /payments/{id}", "POST /payouts"},
				"rate_limit": "500/hour",
			},
			{
				"id": "api-embedded", "name": "Embedded Insurance SDK API", "version": "v1",
				"description": "White-label insurance for B2B2C partners",
				"category": "partner", "pricing": "revenue_share",
				"endpoints": []string{"POST /embedded/quote", "POST /embedded/purchase", "GET /embedded/products"},
				"rate_limit": "2000/hour",
			},
		},
	})
}

func handleSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"subscription_id": fmt.Sprintf("SUB-%d", time.Now().UnixNano()%1000000),
		"api_key":         "ngp_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
		"status":          "active",
		"sandbox_url":     "https://sandbox.ngapp.ng/v1",
		"docs_url":        "https://docs.ngapp.ng",
	})
}

func handleUsage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"period": "2026-05",
		"partner_id": "PTR-001",
		"apis": []map[string]interface{}{
			{"api": "Quote API", "calls": 15420, "errors": 23, "avg_latency_ms": 85},
			{"api": "Policy API", "calls": 3200, "errors": 5, "avg_latency_ms": 120},
			{"api": "Claims API", "calls": 890, "errors": 2, "avg_latency_ms": 200},
		},
		"total_calls": 19510,
		"billing_amount": 45000,
		"currency": "NGN",
	})
}

func handlePartners(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"partners": []map[string]interface{}{
			{"id": "PTR-001", "name": "Kuda Bank", "type": "bank", "status": "active", "apis_subscribed": 4},
			{"id": "PTR-002", "name": "Jumia", "type": "e-commerce", "status": "active", "apis_subscribed": 2},
			{"id": "PTR-003", "name": "Gokada", "type": "ride-hailing", "status": "active", "apis_subscribed": 3},
			{"id": "PTR-004", "name": "PiggyVest", "type": "fintech", "status": "onboarding", "apis_subscribed": 1},
		},
	})
}

func handleSandbox(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sandbox_url": "https://sandbox.ngapp.ng/v1",
		"test_credentials": map[string]string{
			"api_key":    "ngp_test_sandbox_key",
			"partner_id": "PTR-SANDBOX",
		},
		"test_data": map[string]string{
			"test_customer_bvn": "12345678901",
			"test_vehicle_reg":  "LAG-TEST-001",
			"test_phone":        "+2348000000000",
		},
		"features": []string{"Full API access", "No rate limits", "Mock payments", "Test certificates"},
	})
}
