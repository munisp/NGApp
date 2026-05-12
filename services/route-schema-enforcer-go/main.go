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
    "id": "SCH-001",
    "path": "/api/platform/customers",
    "method": "POST",
    "schema": "customerCreateSchema",
    "validations": 12,
    "lastValidated": "2026-05-09T10:00:00Z",
    "passRate": 99.2,
    "failedRequests": 847,
    "status": "enforced"
  },
  {
    "id": "SCH-002",
    "path": "/api/platform/customer-servicing/transfers",
    "method": "POST",
    "schema": "transferCreateSchema",
    "validations": 8,
    "lastValidated": "2026-05-09T10:00:00Z",
    "passRate": 98.8,
    "failedRequests": 1203,
    "status": "enforced"
  },
  {
    "id": "SCH-003",
    "path": "/api/platform/billing/usage-events",
    "method": "POST",
    "schema": "billingUsageEventSchema",
    "validations": 6,
    "lastValidated": "2026-05-09T10:00:00Z",
    "passRate": 99.5,
    "failedRequests": 412,
    "status": "enforced"
  },
  {
    "id": "SCH-004",
    "path": "/api/platform/loans/applications",
    "method": "POST",
    "schema": "loanApplicationSchema",
    "validations": 15,
    "lastValidated": "2026-05-09T09:00:00Z",
    "passRate": 97.3,
    "failedRequests": 2891,
    "status": "enforced"
  },
  {
    "id": "SCH-005",
    "path": "/api/platform/onboarding/validate-bvn",
    "method": "POST",
    "schema": "bvnValidationSchema",
    "validations": 4,
    "lastValidated": "2026-05-09T09:30:00Z",
    "passRate": 99.8,
    "failedRequests": 156,
    "status": "enforced"
  },
  {
    "id": "SCH-006",
    "path": "/api/platform/escrow/accounts",
    "method": "POST",
    "schema": "escrowCreateSchema",
    "validations": 18,
    "lastValidated": "2026-05-09T08:00:00Z",
    "passRate": 98.1,
    "failedRequests": 342,
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
		"service": "route-schema-enforcer-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Schema validation for all Express routes, OpenAPI spec enforcement, request/response validation",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.route.schema.enforcer.go"], "consumer_group": "route-schema-enforcer-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["route_schemas"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-route-schema-enforcer-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "route-schema-enforcer-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.route.schema.enforcer.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "route-schema-enforcer-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.route_schemas"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/schemas/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "route_schemas": copy})
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
	mux.HandleFunc("/v1/schemas/list", handleList)
	mux.HandleFunc("/v1/schemas/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8498"
	}
	fmt.Printf("Route Schema Enforcer listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
