package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type UsageEvent struct {
	ID              string                 `json:"id"`
	TenantID        string                 `json:"tenantId"`
	IdempotencyKey  string                 `json:"idempotencyKey"`
	SourceService   string                 `json:"sourceService"`
	SourceEventType string                 `json:"sourceEventType"`
	MeterKey        string                 `json:"meterKey"`
	ProductKey      string                 `json:"productKey"`
	Quantity        int                    `json:"quantity"`
	Currency        string                 `json:"currency"`
	EventTimestamp  string                 `json:"eventTimestamp"`
	Status          string                 `json:"status"`
	IngestedAt      string                 `json:"ingestedAt"`
	Payload         map[string]interface{} `json:"payload"`
}

var (
	events []UsageEvent
	idKeys = map[string]bool{}
	mu     sync.Mutex
	nextID = 1
)

func init() {
	events = []UsageEvent{
		{ID: "UE-001", TenantID: "54bank-platform-prod", IdempotencyKey: "idem-001", SourceService: "payments-hub", SourceEventType: "transfer.completed", MeterKey: "transfer_posted", ProductKey: "nip_payments", Quantity: 1, Currency: "NGN", EventTimestamp: "2026-05-09T08:00:00Z", Status: "ingested", IngestedAt: "2026-05-09T08:00:01Z"},
		{ID: "UE-002", TenantID: "54bank-platform-prod", IdempotencyKey: "idem-002", SourceService: "card-switch", SourceEventType: "card.authorized", MeterKey: "card_transaction", ProductKey: "card_processing", Quantity: 1, Currency: "NGN", EventTimestamp: "2026-05-09T09:15:00Z", Status: "ingested", IngestedAt: "2026-05-09T09:15:01Z"},
		{ID: "UE-003", TenantID: "54bank-platform-prod", IdempotencyKey: "idem-003", SourceService: "notification-service", SourceEventType: "sms.sent", MeterKey: "sms_sent", ProductKey: "notifications", Quantity: 1, Currency: "NGN", EventTimestamp: "2026-05-09T10:30:00Z", Status: "ingested", IngestedAt: "2026-05-09T10:30:01Z"},
		{ID: "UE-004", TenantID: "54bank-platform-prod", IdempotencyKey: "idem-004", SourceService: "open-banking-api", SourceEventType: "api.call", MeterKey: "api_call", ProductKey: "open_banking", Quantity: 10, Currency: "NGN", EventTimestamp: "2026-05-09T11:00:00Z", Status: "ingested", IngestedAt: "2026-05-09T11:00:01Z"},
	}
	for _, e := range events {
		idKeys[e.IdempotencyKey] = true
	}
	nextID = len(events) + 1
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":     "ok",
			"service":    "billing-ingestor-go",
			"middleware": []string{"Kafka", "Dapr", "Redis", "APISIX", "OpenAppSec"},
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/v1/billing/usage-events", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respondJSON(w, http.StatusOK, map[string]interface{}{"items": events, "total": len(events)})
			mu.Unlock()
		case http.MethodPost:
			var event UsageEvent
			if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
				return
			}
			if event.TenantID == "" || event.MeterKey == "" || event.SourceService == "" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "tenantId, meterKey, and sourceService are required"})
				return
			}
			mu.Lock()
			if event.IdempotencyKey != "" && idKeys[event.IdempotencyKey] {
				mu.Unlock()
				respondJSON(w, http.StatusConflict, map[string]string{"error": "duplicate idempotency key", "idempotencyKey": event.IdempotencyKey})
				return
			}
			event.ID = fmt.Sprintf("UE-%03d", nextID)
			event.Status = "ingested"
			event.IngestedAt = time.Now().UTC().Format(time.RFC3339)
			if event.IdempotencyKey != "" {
				idKeys[event.IdempotencyKey] = true
			}
			events = append(events, event)
			nextID++
			mu.Unlock()
			respondJSON(w, http.StatusAccepted, event)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/v1/billing/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		byMeter := map[string]int{}
		byService := map[string]int{}
		totalQty := 0
		for _, e := range events {
			byMeter[e.MeterKey]++
			byService[e.SourceService]++
			totalQty += e.Quantity
		}
		mu.Unlock()
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalEvents":   len(events),
			"totalQuantity": totalQty,
			"byMeter":       byMeter,
			"byService":     byService,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8085"
	}
	log.Printf("billing-ingestor-go listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
