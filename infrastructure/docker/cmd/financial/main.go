// Financial Services gateway — consolidates Payment, Premium Finance, Multi-Currency, Reconciliation
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	port := envOr("HTTP_PORT", "8500")

	mux := http.NewServeMux()
	started := time.Now()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"service":        "financial",
			"group":          "payment,premium-finance,multi-currency,reconciliation",
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

	// Payment
	mux.HandleFunc("/api/v1/payments", handlePayments)
	mux.HandleFunc("/api/v1/payments/mobile-money", handleMobileMoney)
	// Premium Finance
	mux.HandleFunc("/api/v1/premium-finance/plans", handlePremiumFinancePlans)
	// Multi-Currency
	mux.HandleFunc("/api/v1/currency/rates", handleCurrencyRates)
	mux.HandleFunc("/api/v1/currency/convert", handleCurrencyConvert)
	// Reconciliation
	mux.HandleFunc("/api/v1/reconciliation/status", handleReconciliationStatus)

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# TYPE financial_http_requests_total counter\nfinancial_http_requests_total 0\n")
	})

	fmt.Printf("[financial] Starting on :%s\n", port)
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

func handlePayments(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(map[string]interface{}{"payments": []interface{}{}, "total": 0})
	case http.MethodPost:
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		body["id"] = fmt.Sprintf("PAY-%d", time.Now().UnixMilli())
		body["status"] = "pending"
		body["created_at"] = time.Now().UTC().Format(time.RFC3339)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(body)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleMobileMoney(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"providers": []map[string]interface{}{
			{"name": "MTN Mobile Money", "code": "MTN_MOMO", "active": true, "countries": []string{"NG", "GH", "CM"}},
			{"name": "Airtel Money", "code": "AIRTEL_MONEY", "active": true, "countries": []string{"NG", "KE", "UG"}},
			{"name": "M-Pesa", "code": "MPESA", "active": true, "countries": []string{"KE", "TZ"}},
		},
	})
}

func handlePremiumFinancePlans(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"plans": []map[string]interface{}{
			{"id": "monthly-12", "installments": 12, "interest_rate": 0.05, "min_premium": 50000},
			{"id": "quarterly-4", "installments": 4, "interest_rate": 0.03, "min_premium": 100000},
			{"id": "biannual-2", "installments": 2, "interest_rate": 0.02, "min_premium": 200000},
		},
	})
}

func handleCurrencyRates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"base":       "NGN",
		"updated_at": time.Now().UTC().Format(time.RFC3339),
		"rates": map[string]float64{
			"USD": 0.00065, "GBP": 0.00052, "EUR": 0.00060,
			"GHS": 0.0078, "KES": 0.089, "ZAR": 0.012,
			"XOF": 0.39, "XAF": 0.39,
		},
	})
}

func handleCurrencyConvert(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"from":     "NGN",
		"to":       "USD",
		"amount":   1000000,
		"result":   650.00,
		"rate":     0.00065,
		"fee":      5.00,
		"currency": "USD",
	})
}

func handleReconciliationStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":           "balanced",
		"last_run":         time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
		"matched":          1250,
		"unmatched":        3,
		"pending_review":   1,
		"total_amount_ngn": 45000000.00,
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
