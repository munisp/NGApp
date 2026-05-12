package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

type APIKey struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	KeyPrefix   string   `json:"keyPrefix"` // first 8 chars only
	TenantID    string   `json:"tenantId"`
	Scopes      []string `json:"scopes"`
	RateLimit   int      `json:"rateLimit"` // per minute
	Status      string   `json:"status"`    // active, revoked, expired, rate_limited
	IPWhitelist []string `json:"ipWhitelist,omitempty"`
	ExpiresAt   string   `json:"expiresAt"`
	LastUsedAt  string   `json:"lastUsedAt,omitempty"`
	UsageCount  int64    `json:"usageCount"`
	CreatedBy   string   `json:"createdBy"`
	CreatedAt   string   `json:"createdAt"`
}

type KeyUsageLog struct {
	ID        string `json:"id"`
	KeyID     string `json:"keyId"`
	Endpoint  string `json:"endpoint"`
	Method    string `json:"method"`
	IPAddress string `json:"ipAddress"`
	StatusCode int   `json:"statusCode"`
	Latency   int    `json:"latencyMs"`
	Timestamp string `json:"timestamp"`
}

var (
	mu       sync.RWMutex
	apiKeys  []APIKey
	usageLogs []KeyUsageLog
)

func init() {
	apiKeys = []APIKey{
		{ID: "AK-001", Name: "Mobile App Production", KeyPrefix: "54b_live_", TenantID: "T-001", Scopes: []string{"accounts:read", "transfers:write", "balance:read"}, RateLimit: 1000, Status: "active", ExpiresAt: "2027-01-01T00:00:00Z", LastUsedAt: "2026-05-09T15:10:00Z", UsageCount: 4500000, CreatedBy: "CTO", CreatedAt: "2026-01-01T00:00:00Z"},
		{ID: "AK-002", Name: "Partner Integration - PayStack", KeyPrefix: "54b_prtn_", TenantID: "T-001", Scopes: []string{"payments:write", "webhooks:read"}, RateLimit: 500, Status: "active", IPWhitelist: []string{"52.31.139.75", "52.49.173.169"}, ExpiresAt: "2026-12-31T00:00:00Z", LastUsedAt: "2026-05-09T15:05:00Z", UsageCount: 1200000, CreatedBy: "Integration Team", CreatedAt: "2026-02-01T00:00:00Z"},
		{ID: "AK-003", Name: "Internal Analytics", KeyPrefix: "54b_intl_", TenantID: "T-001", Scopes: []string{"analytics:read", "reports:read"}, RateLimit: 100, Status: "active", ExpiresAt: "2027-06-01T00:00:00Z", UsageCount: 89000, CreatedBy: "Data Team", CreatedAt: "2026-03-01T00:00:00Z"},
		{ID: "AK-004", Name: "Sandbox Testing", KeyPrefix: "54b_test_", TenantID: "T-SANDBOX", Scopes: []string{"*"}, RateLimit: 50, Status: "active", ExpiresAt: "2026-12-31T00:00:00Z", UsageCount: 340000, CreatedBy: "DevOps", CreatedAt: "2026-01-15T00:00:00Z"},
		{ID: "AK-005", Name: "Deprecated V1 Key", KeyPrefix: "54b_dep1_", TenantID: "T-001", Scopes: []string{"accounts:read"}, RateLimit: 10, Status: "revoked", ExpiresAt: "2026-03-01T00:00:00Z", UsageCount: 50000, CreatedBy: "Legacy", CreatedAt: "2025-06-01T00:00:00Z"},
	}

	usageLogs = []KeyUsageLog{
		{ID: "UL-001", KeyID: "AK-001", Endpoint: "/api/v2/accounts", Method: "GET", IPAddress: "105.112.45.67", StatusCode: 200, Latency: 45, Timestamp: "2026-05-09T15:10:00Z"},
		{ID: "UL-002", KeyID: "AK-002", Endpoint: "/api/v2/payments/initiate", Method: "POST", IPAddress: "52.31.139.75", StatusCode: 201, Latency: 230, Timestamp: "2026-05-09T15:05:00Z"},
		{ID: "UL-003", KeyID: "AK-001", Endpoint: "/api/v2/transfers", Method: "POST", IPAddress: "105.112.45.67", StatusCode: 200, Latency: 380, Timestamp: "2026-05-09T15:08:00Z"},
		{ID: "UL-004", KeyID: "AK-004", Endpoint: "/api/v2/sandbox/accounts", Method: "GET", IPAddress: "192.168.1.1", StatusCode: 200, Latency: 12, Timestamp: "2026-05-09T14:00:00Z"},
		{ID: "UL-005", KeyID: "AK-005", Endpoint: "/api/v1/accounts", Method: "GET", IPAddress: "10.0.0.5", StatusCode: 403, Latency: 5, Timestamp: "2026-05-09T10:00:00Z"},
	}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "api-key-vault-go", "version": "3.0.0", "status": "healthy", "port": 8492,
		"description": "API Key Vault — Key lifecycle, scoping, IP whitelisting, rate limiting, usage analytics",
		"features": []string{"key_generation", "key_rotation", "key_revocation", "scope_management", "ip_whitelisting", "rate_limiting", "usage_tracking", "expiry_management", "tenant_isolation"},
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"topics": []string{"api-key.created", "api-key.rotated", "api-key.revoked", "api-key.rate-limited"}},
			"redis": map[string]interface{}{"usage": "Key lookup cache, rate limit counters"},
			"postgres": map[string]interface{}{"tables": []string{"api_keys", "key_usage_logs"}},
			"opensearch": map[string]interface{}{"indices": []string{"api-key-usage"}},
			"keycloak": map[string]interface{}{"realm": "54bank"}, "permify": map[string]interface{}{"schema": "api_key"},
			"dapr": map[string]interface{}{"appId": "api-key-vault-go"}, "fluvio": map[string]interface{}{"topics": []string{"api-key-events"}},
			"temporal": map[string]interface{}{"workflows": []string{"key-rotation-schedule", "key-expiry-notification"}},
			"mojaloop": map[string]interface{}{"usage": "Partner API key management"},
			"tigerbeetle": map[string]interface{}{"ledger": 22}, "lakehouse": map[string]interface{}{"tables": []string{"api_key_analytics"}},
			"apisix": map[string]interface{}{"routes": []string{"/v1/api-keys/*"}}, "openappsec": map[string]interface{}{"policy": "api-key-protection"},
		},
	})
}

func handleKeys(w http.ResponseWriter, _ *http.Request) { mu.RLock(); defer mu.RUnlock(); respond(w, 200, map[string]interface{}{"items": apiKeys, "total": len(apiKeys)}) }
func handleUsage(w http.ResponseWriter, _ *http.Request) { mu.RLock(); defer mu.RUnlock(); respond(w, 200, map[string]interface{}{"items": usageLogs, "total": len(usageLogs)}) }
func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock(); defer mu.RUnlock()
	byStatus := map[string]int{}
	for _, k := range apiKeys { byStatus[k.Status]++ }
	respond(w, 200, map[string]interface{}{"totalKeys": len(apiKeys), "totalUsageLogs": len(usageLogs), "byStatus": byStatus})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8492" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/api-keys", handleKeys)
	mux.HandleFunc("/v1/api-keys/usage", handleUsage)
	mux.HandleFunc("/v1/api-keys/stats", handleStats)
	fmt.Printf("api-key-vault-go on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
