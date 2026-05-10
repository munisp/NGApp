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

type UtilityPayment struct {
	ID string `json:"id"`
	BillerName string `json:"biller_name"`
	BillerCategory string `json:"biller_category"`
	CustomerRef string `json:"customer_ref"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	Channel string `json:"channel"`
	PaymentDate string `json:"payment_date"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []UtilityPayment{
		{ID: "UTL-001", BillerName: "IKEDC", BillerCategory: "electricity", CustomerRef: "04-1234-5678-01", Amount: 25000.0, Currency: "NGN", Channel: "mobile", PaymentDate: "2026-05-09", Status: "successful"},
		{ID: "UTL-002", BillerName: "Lagos Water Corporation", BillerCategory: "water", CustomerRef: "LWC-2026-00456", Amount: 15000.0, Currency: "NGN", Channel: "ussd", PaymentDate: "2026-05-09", Status: "successful"},
		{ID: "UTL-003", BillerName: "DSTV", BillerCategory: "cable_tv", CustomerRef: "7012345678", Amount: 24500.0, Currency: "NGN", Channel: "online", PaymentDate: "2026-05-08", Status: "successful"},
		{ID: "UTL-004", BillerName: "MTN Nigeria", BillerCategory: "airtime", CustomerRef: "08031234567", Amount: 5000.0, Currency: "NGN", Channel: "ussd", PaymentDate: "2026-05-09", Status: "successful"},
		{ID: "UTL-005", BillerName: "LAWMA", BillerCategory: "waste_management", CustomerRef: "LAWMA-LGA-00789", Amount: 8500.0, Currency: "NGN", Channel: "pos", PaymentDate: "2026-05-07", Status: "successful"},
		{ID: "UTL-006", BillerName: "EKEDC", BillerCategory: "electricity", CustomerRef: "01-9876-5432-01", Amount: 50000.0, Currency: "NGN", Channel: "agent", PaymentDate: "2026-05-09", Status: "pending"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "utility-payments-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"utility.payments","utility.billers","utility.reconciliation"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"utility-payments-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"utility_payments","billers","payment_reconciliation"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"utility-payments","utility-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "utility-payments-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"utility-payments-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "utility-payments-go", "pubsub": "utility-payments-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"utility-payments-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"PaymentProcessingWorkflow","BillerReconciliationWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"utility_collections","utility_settlements"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"utility-payments-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/utility-payments/transactions"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "utility-payments-go-waf"},
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
succ := 0
for _, d := range items { total += d.Amount; if d.Status == "successful" { succ++ } }
stats := map[string]interface{}{"total_transactions": len(items), "successful": succ, "total_value": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8183")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/utility-payments/transactions", listItems)
	http.HandleFunc("/v1/utility-payments/stats", getStats)
	fmt.Printf("Utility Payments Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
