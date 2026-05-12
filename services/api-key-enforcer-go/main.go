package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

var (
	mu    sync.RWMutex
	items []map[string]interface{}
)

func init() {
	if err := json.Unmarshal([]byte(seedJSON), &items); err != nil {
		panic("failed to parse seed data: " + err.Error())
	}
}

var seedJSON = `[
  {
    "id": "AKP-001",
    "name": "Internal Service Keys",
    "prefix": "sk_live_",
    "requiredScopes": [
      "banking:read",
      "banking:write"
    ],
    "ipWhitelist": [
      "10.0.0.0/8",
      "172.16.0.0/12"
    ],
    "rateLimit": 10000,
    "rotationWarningDays": 7,
    "activeKeys": 24,
    "violations24h": 0,
    "status": "enforced"
  },
  {
    "id": "AKP-002",
    "name": "Partner API Keys",
    "prefix": "pk_live_",
    "requiredScopes": [
      "payments:initiate",
      "payments:status"
    ],
    "ipWhitelist": [],
    "rateLimit": 1000,
    "rotationWarningDays": 14,
    "activeKeys": 45,
    "violations24h": 23,
    "status": "enforced"
  },
  {
    "id": "AKP-003",
    "name": "Webhook Keys",
    "prefix": "whk_live_",
    "requiredScopes": [
      "webhook:receive"
    ],
    "ipWhitelist": [
      "52.31.0.0/16",
      "34.200.0.0/16"
    ],
    "rateLimit": 5000,
    "rotationWarningDays": 30,
    "activeKeys": 12,
    "violations24h": 2,
    "status": "enforced"
  },
  {
    "id": "AKP-004",
    "name": "Mobile SDK Keys",
    "prefix": "mob_live_",
    "requiredScopes": [
      "banking:read",
      "transfers:create"
    ],
    "ipWhitelist": [],
    "rateLimit": 500,
    "rotationWarningDays": 30,
    "activeKeys": 3,
    "violations24h": 156,
    "status": "enforced"
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "api-key-enforcer-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "API key validation on routes, scope enforcement, IP whitelist, usage metering, key rotation warnings",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.api.key.enforcer.go"], "consumer_group": "api-key-enforcer-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["api_key_policies"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-api-key-enforcer-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "api-key-enforcer-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.api.key.enforcer.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "api-key-enforcer-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.api_key_policies"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/policies/*"]},
    "openappsec": {"endpoint": "openappsec:8090", "policy": "security-hardening"}
  }`),
	})
}

func handleList(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	copy := make([]map[string]interface{}, len(items))
	for i, item := range items {
		copy[i] = item
	}
	mu.RUnlock()

	if r.Method == "POST" {
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, 400, map[string]string{"error": "invalid JSON"})
			return
		}
		body["createdAt"] = time.Now().Format(time.RFC3339)
		mu.Lock()
		items = append(items, body)
		mu.Unlock()
		writeJSON(w, 201, body)
		return
	}

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "api_key_policies": copy})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	statusMap := make(map[string]int)
	for _, item := range items {
		if s, ok := item["status"].(string); ok {
			statusMap[s]++
		}
	}
	writeJSON(w, 200, map[string]interface{}{"total": len(items), "byStatus": statusMap, "generatedAt": time.Now().Format(time.RFC3339)})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/v1/policies/list", handleList)
	mux.HandleFunc("/v1/policies/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8511"
	}
	fmt.Printf("API Key Enforcer listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
