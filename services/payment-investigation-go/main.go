package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

type Investigation struct {
	ID string `json:"id"`
	OriginalRef string `json:"original_ref"`
	PaymentType string `json:"payment_type"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	SenderBank string `json:"sender_bank"`
	ReceiverBank string `json:"receiver_bank"`
	Reason string `json:"reason"`
	Priority string `json:"priority"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []Investigation{
		{ID: "INV-001", OriginalRef: "NIP-2026050900001", PaymentType: "NIP", Amount: 50000000.0, Currency: "NGN", SenderBank: "54Bank Nigeria", ReceiverBank: "First Bank", Reason: "beneficiary_claims_non_receipt", Priority: "high", Status: "investigating"},
		{ID: "INV-002", OriginalRef: "RTGS-2026050800015", PaymentType: "RTGS", Amount: 1500000000.0, Currency: "NGN", SenderBank: "Access Bank", ReceiverBank: "54Bank Nigeria", Reason: "duplicate_payment", Priority: "critical", Status: "resolved"},
		{ID: "INV-003", OriginalRef: "SWIFT-MT103-2026050700042", PaymentType: "SWIFT", Amount: 250000.0, Currency: "USD", SenderBank: "54Bank Nigeria", ReceiverBank: "Citibank NY", Reason: "missing_credit", Priority: "high", Status: "pending_response"},
		{ID: "INV-004", OriginalRef: "NIP-2026050600123", PaymentType: "NIP", Amount: 5000000.0, Currency: "NGN", SenderBank: "GTBank", ReceiverBank: "54Bank Nigeria", Reason: "wrong_beneficiary", Priority: "medium", Status: "return_initiated"},
		{ID: "INV-005", OriginalRef: "NEFT-2026050500089", PaymentType: "NEFT", Amount: 25000000.0, Currency: "NGN", SenderBank: "54Bank Nigeria", ReceiverBank: "Zenith Bank", Reason: "amount_discrepancy", Priority: "low", Status: "closed"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "payment-investigation-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"payment.investigations","payment.traces","payment.returns"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"payment-investigation-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"payment_investigations","investigation_traces","investigation_resolutions"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"payment-investigations","investigation-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "payment-investigation-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"payment-investigation-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "payment-investigation-go", "pubsub": "payment-investigation-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"payment-investigation-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"InvestigationWorkflow","TraceWorkflow","ReturnWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"investigation_suspense","investigation_returns"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"payment-investigation-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/investigations"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "payment-investigation-go-waf"},
		},
	})
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
}

func getStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var total float64
for _, d := range items { total += d.Amount }
open := 0
for _, d := range items { if d.Status != "closed" && d.Status != "resolved" { open++ } }
stats := map[string]interface{}{"total_investigations": len(items), "open_cases": open, "total_value": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8176")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/investigations", listItems)
	http.HandleFunc("/v1/investigations/stats", getStats)
	fmt.Printf("Payment Investigation Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
