package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	frauddetection "fraud-detection-go"

	_ "github.com/lib/pq"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8131"
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=ngapp password=ngapp dbname=ngapp port=5432 sslmode=disable"
	}

	var db *sql.DB
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("WARNING: Failed to open database: %v (running in degraded mode)", err)
		db = nil
	} else if err = db.Ping(); err != nil {
		log.Printf("WARNING: Failed to ping database: %v (running in degraded mode)", err)
		db = nil
	}

	svc := frauddetection.NewFraudDetectionService(db)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		status := "healthy"
		if db == nil {
			status = "degraded"
		}
		json.NewEncoder(w).Encode(map[string]string{
			"status":  status,
			"service": "fraud-detection-go",
		})
	})

	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})

	mux.HandleFunc("/api/v1/fraud/detect", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req frauddetection.FraudDetectionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": map[string]interface{}{
					"code":    400,
					"message": "invalid request body: " + err.Error(),
				},
			})
			return
		}

		if req.ClaimID == "" || req.PolicyID == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": map[string]interface{}{
					"code":    400,
					"message": "claim_id and policy_id are required",
				},
			})
			return
		}

		if db == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": map[string]interface{}{
					"code":    503,
					"message": "database unavailable - fraud detection requires database access",
				},
			})
			return
		}

		result, err := svc.DetectFraud(r.Context(), req)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"error": map[string]interface{}{
					"code":    500,
					"message": err.Error(),
				},
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})

	mux.HandleFunc("/api/v1/fraud/rules", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"rules": []map[string]interface{}{
				{"name": "claim_amount_vs_sum_assured", "weight": 30, "description": "Checks if claim amount is close to or exceeds sum assured"},
				{"name": "claim_frequency", "weight": 25, "description": "Checks for multiple claims in a short period"},
				{"name": "claim_timing", "weight": 20, "description": "Checks if claim was filed shortly after policy start"},
				{"name": "missing_documents", "weight": 15, "description": "Checks for missing required documents based on claim type"},
				{"name": "beneficiary_history", "weight": 10, "description": "Checks beneficiary claim patterns across policies"},
			},
			"risk_levels": map[string]string{
				"HIGH":    "Score >= 70: Recommend REJECT",
				"MEDIUM":  "Score 40-69: Recommend MANUAL_REVIEW",
				"LOW":     "Score 20-39: Recommend APPROVE_WITH_CAUTION",
				"MINIMAL": "Score < 20: Recommend APPROVE",
			},
		})
	})

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("Fraud Detection Service starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if db != nil {
		db.Close()
	}
	srv.Shutdown(ctx)
}
