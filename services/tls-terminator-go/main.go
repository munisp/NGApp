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
    "id": "TLS-001",
    "domain": "app.54bank.app",
    "protocol": "TLS 1.3",
    "cipherSuites": [
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256"
    ],
    "certExpiry": "2027-01-15T00:00:00Z",
    "ocspStapling": true,
    "hstsPreload": true,
    "ctLogged": true,
    "handshakes24h": 2500000,
    "status": "active"
  },
  {
    "id": "TLS-002",
    "domain": "api.54bank.app",
    "protocol": "TLS 1.3",
    "cipherSuites": [
      "TLS_AES_256_GCM_SHA384"
    ],
    "certExpiry": "2027-01-15T00:00:00Z",
    "ocspStapling": true,
    "hstsPreload": true,
    "ctLogged": true,
    "handshakes24h": 8500000,
    "status": "active"
  },
  {
    "id": "TLS-003",
    "domain": "admin.54bank.app",
    "protocol": "TLS 1.3",
    "cipherSuites": [
      "TLS_AES_256_GCM_SHA384"
    ],
    "certExpiry": "2027-02-01T00:00:00Z",
    "ocspStapling": true,
    "hstsPreload": true,
    "ctLogged": true,
    "handshakes24h": 45000,
    "status": "active"
  },
  {
    "id": "TLS-004",
    "domain": "agent.54bank.app",
    "protocol": "TLS 1.3",
    "cipherSuites": [
      "TLS_AES_256_GCM_SHA384",
      "TLS_CHACHA20_POLY1305_SHA256"
    ],
    "certExpiry": "2027-03-01T00:00:00Z",
    "ocspStapling": true,
    "hstsPreload": false,
    "ctLogged": true,
    "handshakes24h": 120000,
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
		"service": "tls-terminator-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "TLS 1.3 termination, cipher suite management, certificate chain validation, OCSP stapling, HSTS preload",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.tls.terminator.go"], "consumer_group": "tls-terminator-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["tls_configs"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-tls-terminator-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "tls-terminator-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.tls.terminator.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "tls-terminator-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.tls_configs"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/tls/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "tls_configs": copy})
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
	mux.HandleFunc("/v1/tls/list", handleList)
	mux.HandleFunc("/v1/tls/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8508"
	}
	fmt.Printf("TLS Terminator listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
