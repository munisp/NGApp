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
    "id": "DDOS-001",
    "name": "SYN Flood Protection",
    "layer": "L4",
    "threshold": "100000 pps",
    "action": "drop",
    "mitigated24h": 45000,
    "falsePositives": 12,
    "status": "active"
  },
  {
    "id": "DDOS-002",
    "name": "HTTP Flood Protection",
    "layer": "L7",
    "threshold": "10000 rps",
    "action": "challenge",
    "mitigated24h": 23000,
    "falsePositives": 45,
    "status": "active"
  },
  {
    "id": "DDOS-003",
    "name": "DNS Amplification Block",
    "layer": "L3",
    "threshold": "50000 pps",
    "action": "drop",
    "mitigated24h": 8900,
    "falsePositives": 0,
    "status": "active"
  },
  {
    "id": "DDOS-004",
    "name": "Slowloris Prevention",
    "layer": "L7",
    "threshold": "30s timeout",
    "action": "close",
    "mitigated24h": 1200,
    "falsePositives": 3,
    "status": "active"
  },
  {
    "id": "DDOS-005",
    "name": "Geo-Rate Limiting",
    "layer": "L7",
    "threshold": "1000 rps/country",
    "action": "throttle",
    "mitigated24h": 5600,
    "falsePositives": 89,
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
		"service": "ddos-shield-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "L3/L4/L7 DDoS mitigation, SYN flood protection, amplification detection, traffic scrubbing, geo-blocking",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.ddos.shield.go"], "consumer_group": "ddos-shield-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["ddos_rules"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-ddos-shield-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "ddos-shield-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.ddos.shield.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "ddos-shield-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.ddos_rules"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/rules/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "ddos_rules": copy})
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
	mux.HandleFunc("/v1/rules/list", handleList)
	mux.HandleFunc("/v1/rules/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8521"
	}
	fmt.Printf("DDoS Shield listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
