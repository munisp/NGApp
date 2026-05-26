// Insurance Operations gateway — consolidates Actuarial, Underwriting, Claims Adjudication, Reinsurance
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"time"
)

func main() {
	port := envOr("HTTP_PORT", "8400")

	mux := http.NewServeMux()
	started := time.Now()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "healthy",
			"service":        "insurance-ops",
			"group":          "actuarial,underwriting,claims-adjudication,reinsurance",
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

	// Actuarial
	mux.HandleFunc("/api/v1/actuarial/mortality-table", handleMortalityTable)
	mux.HandleFunc("/api/v1/actuarial/premium-calculation", handlePremiumCalc)
	// Underwriting
	mux.HandleFunc("/api/v1/underwriting/assess", handleUnderwritingAssess)
	mux.HandleFunc("/api/v1/underwriting/rules", handleUnderwritingRules)
	// Claims Adjudication
	mux.HandleFunc("/api/v1/adjudication/evaluate", handleAdjudicationEvaluate)
	// Reinsurance
	mux.HandleFunc("/api/v1/reinsurance/treaties", handleReinsuranceTreaties)
	mux.HandleFunc("/api/v1/reinsurance/cessions", handleReinsuranceCessions)

	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprintf(w, "# TYPE insurance_ops_http_requests_total counter\ninsurance_ops_http_requests_total 0\n")
	})

	fmt.Printf("[insurance-ops] Starting on :%s\n", port)
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

func handleMortalityTable(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"table":   "nigeria-2023",
		"ages":    []int{25, 30, 35, 40, 45, 50},
		"rates":   []float64{0.0012, 0.0015, 0.0020, 0.0028, 0.0040, 0.0058},
		"version": "2.0",
	})
}

func handlePremiumCalc(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	basePremium := 12000.0
	riskFactor := 1.15
	json.NewEncoder(w).Encode(map[string]interface{}{
		"base_premium":     basePremium,
		"risk_factor":      riskFactor,
		"adjusted_premium": math.Round(basePremium*riskFactor*100) / 100,
		"currency":         "NGN",
		"frequency":        "monthly",
	})
}

func handleUnderwritingAssess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"decision":    "standard",
		"risk_class":  "preferred",
		"score":       82,
		"max_score":   100,
		"conditions":  []string{},
		"exclusions":  []string{},
		"valid_until": time.Now().Add(90 * 24 * time.Hour).Format(time.RFC3339),
	})
}

func handleUnderwritingRules(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rules": []map[string]interface{}{
			{"id": "age-limit", "description": "Max age 65 for new policies", "active": true},
			{"id": "sum-assured-limit", "description": "Max sum assured 50M NGN", "active": true},
			{"id": "medical-required", "description": "Medical exam required for sum > 10M NGN", "active": true},
		},
	})
}

func handleAdjudicationEvaluate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"decision":    "approve",
		"confidence":  0.94,
		"amount":      500000.00,
		"currency":    "NGN",
		"rule_hits":   []string{"valid_policy", "active_coverage", "within_limits"},
		"fraud_score": 0.05,
	})
}

func handleReinsuranceTreaties(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"treaties": []map[string]interface{}{
			{"id": "QS-2024", "type": "quota_share", "retention": 0.60, "cession": 0.40, "reinsurer": "Africa Re"},
			{"id": "XL-2024", "type": "excess_of_loss", "retention": 5000000, "limit": 50000000, "reinsurer": "Swiss Re"},
		},
	})
}

func handleReinsuranceCessions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"cessions": []interface{}{},
		"total":    0,
		"period":   time.Now().Format("2006-01"),
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
