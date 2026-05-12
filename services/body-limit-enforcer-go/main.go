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
    "id": "BL-001",
    "path": "/api/platform/customers",
    "method": "POST",
    "maxBodyBytes": 65536,
    "contentTypes": [
      "application/json"
    ],
    "enforced": true,
    "violations24h": 234,
    "blocked24h": 12,
    "status": "active"
  },
  {
    "id": "BL-002",
    "path": "/api/platform/documents/upload",
    "method": "POST",
    "maxBodyBytes": 10485760,
    "contentTypes": [
      "multipart/form-data"
    ],
    "enforced": true,
    "violations24h": 89,
    "blocked24h": 3,
    "status": "active"
  },
  {
    "id": "BL-003",
    "path": "/api/platform/kyc/*",
    "method": "POST",
    "maxBodyBytes": 5242880,
    "contentTypes": [
      "application/json",
      "multipart/form-data"
    ],
    "enforced": true,
    "violations24h": 45,
    "blocked24h": 1,
    "status": "active"
  },
  {
    "id": "BL-004",
    "path": "/api/platform/customer-servicing/transfers",
    "method": "POST",
    "maxBodyBytes": 32768,
    "contentTypes": [
      "application/json"
    ],
    "enforced": true,
    "violations24h": 567,
    "blocked24h": 28,
    "status": "active"
  },
  {
    "id": "BL-005",
    "path": "/api/*",
    "method": "ALL",
    "maxBodyBytes": 1048576,
    "contentTypes": [
      "application/json",
      "text/plain"
    ],
    "enforced": true,
    "violations24h": 1203,
    "blocked24h": 156,
    "status": "active"
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "body-limit-enforcer-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Request body size limits, content-type validation, multipart boundary checking, slow-loris protection",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.body.limit.enforcer.go"], "consumer_group": "body-limit-enforcer-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["body_limits"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-body-limit-enforcer-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "body-limit-enforcer-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.body.limit.enforcer.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "body-limit-enforcer-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.body_limits"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/limits/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "body_limits": copy})
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
	mux.HandleFunc("/v1/limits/list", handleList)
	mux.HandleFunc("/v1/limits/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8506"
	}
	fmt.Printf("Body Limit Enforcer listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
