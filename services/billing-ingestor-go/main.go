package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

type UsageEvent struct {
	TenantID        string                 `json:"tenantId"`
	IdempotencyKey  string                 `json:"idempotencyKey"`
	SourceService   string                 `json:"sourceService"`
	SourceEventType string                 `json:"sourceEventType"`
	MeterKey        string                 `json:"meterKey"`
	ProductKey      string                 `json:"productKey"`
	Quantity        int                    `json:"quantity"`
	Currency        string                 `json:"currency"`
	EventTimestamp  string                 `json:"eventTimestamp"`
	Payload         map[string]interface{} `json:"payload"`
}

type healthResponse struct {
	Status     string   `json:"status"`
	Middleware []string `json:"middleware"`
	Timestamp  string   `json:"timestamp"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, healthResponse{
			Status:     "ok",
			Middleware: []string{"Kafka", "Dapr", "Redis", "APISIX", "OpenAppSec"},
			Timestamp:  time.Now().UTC().Format(time.RFC3339),
		})
	})
	mux.HandleFunc("/v1/billing/usage-events", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var event UsageEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
			return
		}
		if event.TenantID == "" || event.MeterKey == "" || event.SourceService == "" {
			respondJSON(w, http.StatusBadRequest, map[string]string{"message": "tenantId, meterKey, and sourceService are required"})
			return
		}

		// Reference implementation notes:
		// 1. Validate idempotency against Redis or Postgres.
		// 2. Publish canonical event to Kafka or Dapr pub/sub.
		// 3. Forward accepted event to the TypeScript billing gateway or Rust rating worker.
		respondJSON(w, http.StatusAccepted, map[string]interface{}{
			"status":     "accepted",
			"next":       []string{"redis-idempotency-check", "kafka-publish", "typescript-billing-gateway"},
			"middleware": []string{"Kafka", "Dapr", "Redis", "APISIX", "OpenAppSec"},
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8085"
	}
	log.Printf("billing ingestor listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
