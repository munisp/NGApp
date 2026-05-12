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
    "id": "INC-001",
    "title": "Brute Force Attack on Mobile Banking",
    "severity": "high",
    "category": "credential_attack",
    "status": "contained",
    "affectedSystems": [
      "mobile-auth",
      "session-service"
    ],
    "containmentActions": [
      "IP block",
      "account lockout"
    ],
    "escalationLevel": 2,
    "assignee": "soc-team-alpha",
    "detectedAt": "2026-05-09T08:15:00Z",
    "containedAt": "2026-05-09T08:22:00Z",
    "ttdMinutes": 7,
    "ttcMinutes": 7
  },
  {
    "id": "INC-002",
    "title": "Suspicious Data Exfiltration Attempt",
    "severity": "critical",
    "category": "data_exfiltration",
    "status": "investigating",
    "affectedSystems": [
      "customer-db",
      "api-gateway"
    ],
    "containmentActions": [
      "egress block",
      "session revoke"
    ],
    "escalationLevel": 3,
    "assignee": "csirt-lead",
    "detectedAt": "2026-05-09T10:30:00Z",
    "containedAt": "",
    "ttdMinutes": 15,
    "ttcMinutes": 0
  },
  {
    "id": "INC-003",
    "title": "Expired TLS Certificate on Agent Portal",
    "severity": "medium",
    "category": "configuration",
    "status": "resolved",
    "affectedSystems": [
      "agent-portal",
      "tls-terminator"
    ],
    "containmentActions": [
      "cert renewal",
      "cache flush"
    ],
    "escalationLevel": 1,
    "assignee": "infra-team",
    "detectedAt": "2026-05-08T14:00:00Z",
    "containedAt": "2026-05-08T14:15:00Z",
    "ttdMinutes": 5,
    "ttcMinutes": 15
  },
  {
    "id": "INC-004",
    "title": "Card Skimming Pattern Detected",
    "severity": "critical",
    "category": "fraud",
    "status": "contained",
    "affectedSystems": [
      "pos-network",
      "card-processing"
    ],
    "containmentActions": [
      "terminal block",
      "card reissue"
    ],
    "escalationLevel": 3,
    "assignee": "fraud-ops",
    "detectedAt": "2026-05-07T16:00:00Z",
    "containedAt": "2026-05-07T16:45:00Z",
    "ttdMinutes": 30,
    "ttcMinutes": 45
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "incident-responder-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Security incident workflow, escalation management, containment actions, forensic evidence, NIST 800-61",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.incident.responder.go"], "consumer_group": "incident-responder-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["incidents"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-incident-responder-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "incident-responder-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.incident.responder.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "incident-responder-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.incidents"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/incidents/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "incidents": copy})
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
	mux.HandleFunc("/v1/incidents/list", handleList)
	mux.HandleFunc("/v1/incidents/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8526"
	}
	fmt.Printf("Incident Responder listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
