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

type DepositBox struct {
	ID string `json:"id"`
	BoxSize string `json:"box_size"`
	CustomerName string `json:"customer_name"`
	Branch string `json:"branch"`
	AnnualRent float64 `json:"annual_rent"`
	Currency string `json:"currency"`
	RenewalDate string `json:"renewal_date"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []DepositBox{
		{ID: "SDB-001", BoxSize: "large", CustomerName: "Dangote Industries Ltd", Branch: "Victoria Island", AnnualRent: 500000.0, Currency: "NGN", RenewalDate: "2027-01-15", Status: "occupied"},
		{ID: "SDB-002", BoxSize: "medium", CustomerName: "Adenuga Family Office", Branch: "Ikoyi", AnnualRent: 350000.0, Currency: "NGN", RenewalDate: "2026-08-01", Status: "occupied"},
		{ID: "SDB-003", BoxSize: "small", CustomerName: "Emeka Obi", Branch: "Ikeja", AnnualRent: 150000.0, Currency: "NGN", RenewalDate: "2026-12-31", Status: "occupied"},
		{ID: "SDB-004", BoxSize: "large", CustomerName: "", Branch: "Abuja Main", AnnualRent: 450000.0, Currency: "NGN", RenewalDate: "", Status: "available"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "safe-deposit-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "safe-deposit-go"},
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
	occ := 0
for _, d := range items { if d.Status == "occupied" { occ++ } }
stats := map[string]interface{}{"total_boxes": len(items), "occupied": occ, "available": len(items) - occ}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8190")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/safe-deposit-go/list", listItems)
	http.HandleFunc("/v1/safe-deposit-go/stats", getStats)
	fmt.Printf("Safe Deposit Box Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
