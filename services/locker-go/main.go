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

type LockerItem struct {
	ID string `json:"id"`
	CustomerName string `json:"customer_name"`
	ItemType string `json:"item_type"`
	Description string `json:"description"`
	StoredDate string `json:"stored_date"`
	ExpiryDate string `json:"expiry_date"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []LockerItem{
		{ID: "DL-001", CustomerName: "Dangote Industries", ItemType: "share_certificate", Description: "DANGCEM 10M shares certificate", StoredDate: "2024-01-15", ExpiryDate: "", Status: "active"},
		{ID: "DL-002", CustomerName: "BUA Group", ItemType: "title_deed", Description: "Lekki Phase 2 property title", StoredDate: "2023-06-01", ExpiryDate: "", Status: "active"},
		{ID: "DL-003", CustomerName: "Emeka Obi", ItemType: "will", Description: "Last will and testament", StoredDate: "2025-03-15", ExpiryDate: "", Status: "active"},
		{ID: "DL-004", CustomerName: "MTN Nigeria", ItemType: "license", Description: "NCC Spectrum License", StoredDate: "2024-09-01", ExpiryDate: "2034-09-01", Status: "active"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "locker-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "locker-go"},
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
	stats := map[string]interface{}{"total_items": len(items)}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8196")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/locker-go/list", listItems)
	http.HandleFunc("/v1/locker-go/stats", getStats)
	fmt.Printf("Digital Locker Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
