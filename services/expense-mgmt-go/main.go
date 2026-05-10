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

type Expense struct {
	ID string `json:"id"`
	Category string `json:"category"`
	Department string `json:"department"`
	Description string `json:"description"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	ApprovedBy string `json:"approved_by"`
	Date string `json:"date"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []Expense{
		{ID: "EXP-001", Category: "staff_cost", Department: "Technology", Description: "Monthly payroll - IT Division", Amount: 350000000.0, Currency: "NGN", ApprovedBy: "CFO", Date: "2026-05-01", Status: "paid"},
		{ID: "EXP-002", Category: "occupancy", Department: "Operations", Description: "Branch rent - Q2 2026", Amount: 180000000.0, Currency: "NGN", ApprovedBy: "COO", Date: "2026-04-01", Status: "paid"},
		{ID: "EXP-003", Category: "technology", Department: "Technology", Description: "Cloud infrastructure - AWS/Azure", Amount: 75000000.0, Currency: "NGN", ApprovedBy: "CTO", Date: "2026-05-01", Status: "paid"},
		{ID: "EXP-004", Category: "marketing", Department: "Marketing", Description: "Q2 brand campaign", Amount: 120000000.0, Currency: "NGN", ApprovedBy: "CMO", Date: "2026-04-15", Status: "approved"},
		{ID: "EXP-005", Category: "compliance", Department: "Legal", Description: "Regulatory filing fees - CBN/SEC", Amount: 25000000.0, Currency: "NGN", ApprovedBy: "CLO", Date: "2026-05-05", Status: "pending"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "expense-mgmt-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "expense-mgmt-go"},
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
	var total float64
for _, d := range items { total += d.Amount }
stats := map[string]interface{}{"total_expenses": len(items), "total_amount": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8192")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/expense-mgmt-go/list", listItems)
	http.HandleFunc("/v1/expense-mgmt-go/stats", getStats)
	fmt.Printf("Expense Management Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
