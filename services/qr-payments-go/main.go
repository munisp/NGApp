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

type QRTransaction struct {
	ID string `json:"id"`
	MerchantName string `json:"merchant_name"`
	MerchantID string `json:"merchant_id"`
	Amount float64 `json:"amount"`
	Currency string `json:"currency"`
	QRType string `json:"qr_type"`
	Channel string `json:"channel"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []QRTransaction{
		{ID: "QR-001", MerchantName: "ShopRite Ikeja", MerchantID: "MER-001", Amount: 45000.0, Currency: "NGN", QRType: "dynamic", Channel: "nibss_qr", Status: "successful"},
		{ID: "QR-002", MerchantName: "Chicken Republic VI", MerchantID: "MER-002", Amount: 8500.0, Currency: "NGN", QRType: "static", Channel: "nibss_qr", Status: "successful"},
		{ID: "QR-003", MerchantName: "FilmHouse Cinemas", MerchantID: "MER-003", Amount: 12000.0, Currency: "NGN", QRType: "dynamic", Channel: "mastercard_qr", Status: "successful"},
		{ID: "QR-004", MerchantName: "Uber Nigeria", MerchantID: "MER-004", Amount: 3500.0, Currency: "NGN", QRType: "dynamic", Channel: "visa_qr", Status: "pending"},
		{ID: "QR-005", MerchantName: "Total Energies", MerchantID: "MER-005", Amount: 25000.0, Currency: "NGN", QRType: "static", Channel: "nibss_qr", Status: "successful"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "qr-payments-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
			"redis": map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379")},
			"postgres": map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
			"opensearch": map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
			"keycloak": map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
			"permify": map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
			"dapr": map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "qr-payments-go"},
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
succ := 0
for _, d := range items { t += d.Amount; if d.Status == "successful" { succ++ } }
stats := map[string]interface{}{"total_transactions": len(items), "successful": succ, "total_value": t}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8187")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/qr-payments-go/list", listItems)
	http.HandleFunc("/v1/qr-payments-go/stats", getStats)
	fmt.Printf("QR Payments Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
