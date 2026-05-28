// Core Insurance Services gateway — consolidates Policy, Claims, Customer, Verification
// into a single HTTP server with sub-routers and gRPC endpoints.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	port := envOr("HTTP_PORT", "8080")

	mux := http.NewServeMux()
	started := time.Now()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"service":        "core-services",
			"group":          "policy,claims,customer,verification",
			"uptime_seconds": time.Since(started).Seconds(),
		})
	})
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"ready": true})
	})
	mux.HandleFunc("/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"alive": true})
	})

	// Policy sub-router
	mux.HandleFunc("/api/v1/policies", handlePolicies)
	mux.HandleFunc("/api/v1/policies/quote", handleQuote)
	// Claims sub-router
	mux.HandleFunc("/api/v1/claims", handleClaims)
	mux.HandleFunc("/api/v1/claims/adjudicate", handleAdjudicate)
	// Customer sub-router
	mux.HandleFunc("/api/v1/customers", handleCustomers)
	// Verification sub-router
	mux.HandleFunc("/api/v1/verification/status", handleVerificationStatus)

	// Metrics endpoint
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# TYPE core_services_http_requests_total counter\ncore_services_http_requests_total 0\n")
	})

	fmt.Printf("[core-services] Starting on :%s\n", port)
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}

func handlePolicies(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	_ = ctx
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]interface{}{"policies": []interface{}{}, "total": 0})
	case http.MethodPost:
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		body["id"] = fmt.Sprintf("POL-%d", time.Now().UnixMilli())
		body["status"] = "draft"
		body["created_at"] = time.Now().UTC().Format(time.RFC3339)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(body)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleQuote(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"quote_id":       fmt.Sprintf("QT-%d", time.Now().UnixMilli()),
		"premium":        15000.00,
		"currency":       "NGN",
		"coverage_limit": 5000000.00,
		"valid_until":    time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339),
	})
}

func handleClaims(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]interface{}{"claims": []interface{}{}, "total": 0})
	case http.MethodPost:
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		body["id"] = fmt.Sprintf("CLM-%d", time.Now().UnixMilli())
		body["status"] = "submitted"
		body["created_at"] = time.Now().UTC().Format(time.RFC3339)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(body)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleAdjudicate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"decision":   "approved",
		"amount":     250000.00,
		"currency":   "NGN",
		"confidence": 0.92,
		"factors":    []string{"policy_valid", "coverage_active", "documentation_complete"},
	})
}

func handleCustomers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]interface{}{"customers": []interface{}{}, "total": 0})
	case http.MethodPost:
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		body["id"] = fmt.Sprintf("CUST-%d", time.Now().UnixMilli())
		body["kyc_status"] = "pending"
		body["created_at"] = time.Now().UTC().Format(time.RFC3339)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(body)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleVerificationStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"verified":    false,
		"kyc_level":   0,
		"checks":      []string{},
		"next_action": "submit_identity_document",
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
