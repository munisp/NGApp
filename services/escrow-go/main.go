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

type EscrowAccount struct {
	ID string `json:"id"`
	EscrowType string `json:"escrow_type"`
	Buyer string `json:"buyer"`
	Seller string `json:"seller"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	Condition string `json:"condition"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []EscrowAccount{
		{ID: "ESC-001", EscrowType: "property", Buyer: "BUA Properties Ltd", Seller: "FMBN", Amount: 15000000000.0, Currency: "NGN", Condition: "Title deed transfer verified", Status: "active"},
		{ID: "ESC-002", EscrowType: "m_and_a", Buyer: "Dangote Industries", Seller: "Lafarge Africa", Amount: 500000000.0, Currency: "USD", Condition: "Regulatory approval from SEC", Status: "pending_condition"},
		{ID: "ESC-003", EscrowType: "trade", Buyer: "Nigerian Breweries", Seller: "Cargill International", Amount: 2000000000.0, Currency: "NGN", Condition: "Goods inspection at Apapa Port", Status: "active"},
		{ID: "ESC-004", EscrowType: "litigation", Buyer: "Court Registry", Seller: "Multiple Parties", Amount: 5000000000.0, Currency: "NGN", Condition: "Final court judgment", Status: "held"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "escrow-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "escrow-go"},
			"fluvio": map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003")},
			"temporal": map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233")},
			"mojaloop": map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
			"lakehouse": map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
			"apisix": map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080")},
			"openappsec": map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
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
	var t float64
for _, d := range items { t += d.Amount }
stats := map[string]interface{}{"total_accounts": len(items), "total_held": t}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8186")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/escrow-go/list", listItems)
	http.HandleFunc("/v1/escrow-go/stats", getStats)
	fmt.Printf("Escrow Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
