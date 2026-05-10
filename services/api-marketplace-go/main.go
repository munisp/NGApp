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

type APIProduct struct {
	ID string `json:"id"`
	APIName string `json:"api_name"`
	Version string `json:"version"`
	Category string `json:"category"`
	Provider string `json:"provider"`
	PricingModel string `json:"pricing_model"`
	RateLimit int `json:"rate_limit"`
	Subscribers int `json:"subscribers"`
	MonthlyCallVolume int64 `json:"monthly_call_volume"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []APIProduct{
		{ID: "API-001", APIName: "Account Information Service", Version: "v2.1", Category: "open_banking", Provider: "54Bank", PricingModel: "freemium", RateLimit: 1000, Subscribers: 45, MonthlyCallVolume: 2500000, Status: "published"},
		{ID: "API-002", APIName: "Payment Initiation Service", Version: "v1.3", Category: "payments", Provider: "54Bank", PricingModel: "per_call", RateLimit: 500, Subscribers: 32, MonthlyCallVolume: 1800000, Status: "published"},
		{ID: "API-003", APIName: "KYC Verification API", Version: "v3.0", Category: "identity", Provider: "54Bank", PricingModel: "tiered", RateLimit: 200, Subscribers: 28, MonthlyCallVolume: 500000, Status: "published"},
		{ID: "API-004", APIName: "FX Rates & Conversion", Version: "v1.1", Category: "treasury", Provider: "54Bank", PricingModel: "freemium", RateLimit: 2000, Subscribers: 67, MonthlyCallVolume: 5000000, Status: "published"},
		{ID: "API-005", APIName: "Credit Scoring API", Version: "v2.0", Category: "lending", Provider: "54Bank", PricingModel: "per_call", RateLimit: 100, Subscribers: 15, MonthlyCallVolume: 150000, Status: "beta"},
		{ID: "API-006", APIName: "BVN Validation Service", Version: "v1.0", Category: "identity", Provider: "NIBSS", PricingModel: "per_call", RateLimit: 300, Subscribers: 52, MonthlyCallVolume: 800000, Status: "published"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "api-marketplace-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"marketplace.subscriptions","marketplace.usage","marketplace.billing"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"api-marketplace-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"api_products","api_subscriptions","api_usage_logs","api_keys"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"api-marketplace","api-usage-analytics"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "api-marketplace-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"api-marketplace-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "api-marketplace-go", "pubsub": "api-marketplace-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"api-marketplace-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"APIProvisioningWorkflow","UsageBillingWorkflow"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"marketplace_revenue","marketplace_payouts"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"api-marketplace-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/marketplace/apis"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "api-marketplace-go-waf"},
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
	var totalSubs int
var totalCalls int64
for _, d := range items { totalSubs += d.Subscribers; totalCalls += d.MonthlyCallVolume }
stats := map[string]interface{}{"total_apis": len(items), "total_subscribers": totalSubs, "monthly_api_calls": totalCalls}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8178")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/marketplace/apis", listItems)
	http.HandleFunc("/v1/marketplace/stats", getStats)
	fmt.Printf("API Marketplace Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
