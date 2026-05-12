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
    "id": "PKCE-001",
    "clientId": "54bank-pwa",
    "grantType": "authorization_code",
    "codeChallengeMethod": "S256",
    "redirectUri": "https://app.54bank.app/callback",
    "scopes": [
      "openid",
      "profile",
      "email",
      "banking:read",
      "banking:write"
    ],
    "tokenLifetime": 300,
    "refreshLifetime": 1800,
    "activeFlows": 45000,
    "status": "active"
  },
  {
    "id": "PKCE-002",
    "clientId": "54bank-mobile",
    "grantType": "authorization_code",
    "codeChallengeMethod": "S256",
    "redirectUri": "app.54bank://callback",
    "scopes": [
      "openid",
      "profile",
      "email",
      "banking:read",
      "banking:write",
      "offline_access"
    ],
    "tokenLifetime": 600,
    "refreshLifetime": 86400,
    "activeFlows": 120000,
    "status": "active"
  },
  {
    "id": "PKCE-003",
    "clientId": "54bank-agent",
    "grantType": "authorization_code",
    "codeChallengeMethod": "S256",
    "redirectUri": "https://agent.54bank.app/callback",
    "scopes": [
      "openid",
      "agent:read",
      "agent:write",
      "kyc:capture"
    ],
    "tokenLifetime": 900,
    "refreshLifetime": 3600,
    "activeFlows": 3500,
    "status": "active"
  },
  {
    "id": "PKCE-004",
    "clientId": "54bank-admin",
    "grantType": "authorization_code",
    "codeChallengeMethod": "S256",
    "redirectUri": "https://admin.54bank.app/callback",
    "scopes": [
      "openid",
      "admin:read",
      "admin:write",
      "compliance:manage"
    ],
    "tokenLifetime": 180,
    "refreshLifetime": 900,
    "activeFlows": 120,
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
		"service": "pkce-auth-flow-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "OAuth2 PKCE for SPAs, authorization code flow with code verifier/challenge, state parameter CSRF protection",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.pkce.auth.flow.go"], "consumer_group": "pkce-auth-flow-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["pkce_flows"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-pkce-auth-flow-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "pkce-auth-flow-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.pkce.auth.flow.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "pkce-auth-flow-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.pkce_flows"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/pkce/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "pkce_flows": copy})
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
	mux.HandleFunc("/v1/pkce/list", handleList)
	mux.HandleFunc("/v1/pkce/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8503"
	}
	fmt.Printf("PKCE Auth Flow listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
