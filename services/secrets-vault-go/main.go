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
    "id": "SEC-001",
    "path": "secret/data/database/primary",
    "engine": "kv-v2",
    "version": 4,
    "rotationDays": 30,
    "lastRotated": "2026-04-15T00:00:00Z",
    "nextRotation": "2026-05-15T00:00:00Z",
    "accessCount": 45000,
    "status": "active"
  },
  {
    "id": "SEC-002",
    "path": "secret/data/api-keys/mojaloop",
    "engine": "kv-v2",
    "version": 2,
    "rotationDays": 90,
    "lastRotated": "2026-03-01T00:00:00Z",
    "nextRotation": "2026-06-01T00:00:00Z",
    "accessCount": 12000,
    "status": "active"
  },
  {
    "id": "SEC-003",
    "path": "transit/keys/card-encryption",
    "engine": "transit",
    "version": 3,
    "rotationDays": 7,
    "lastRotated": "2026-05-05T00:00:00Z",
    "nextRotation": "2026-05-12T00:00:00Z",
    "accessCount": 890000,
    "status": "active"
  },
  {
    "id": "SEC-004",
    "path": "pki/issue/service-mesh",
    "engine": "pki",
    "version": 1,
    "rotationDays": 1,
    "lastRotated": "2026-05-09T00:00:00Z",
    "nextRotation": "2026-05-10T00:00:00Z",
    "accessCount": 266,
    "status": "active"
  },
  {
    "id": "SEC-005",
    "path": "database/creds/banking-readonly",
    "engine": "database",
    "version": 1,
    "rotationDays": 0.04,
    "lastRotated": "2026-05-09T14:00:00Z",
    "nextRotation": "2026-05-09T15:00:00Z",
    "accessCount": 156000,
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
		"service": "secrets-vault-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "HashiCorp Vault integration, dynamic secrets, envelope encryption, transit engine, secret rotation",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.secrets.vault.go"], "consumer_group": "secrets-vault-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["vault_secrets"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-secrets-vault-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "secrets-vault-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.secrets.vault.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "secrets-vault-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.vault_secrets"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/secrets/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "vault_secrets": copy})
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
	mux.HandleFunc("/v1/secrets/list", handleList)
	mux.HandleFunc("/v1/secrets/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8500"
	}
	fmt.Printf("Secrets Vault Manager listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
