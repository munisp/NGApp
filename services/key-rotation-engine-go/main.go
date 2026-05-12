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
    "id": "ROT-001",
    "keyId": "card-encryption-master",
    "algorithm": "AES-256-GCM",
    "rotationInterval": "7d",
    "gracePeriod": "24h",
    "activeVersion": 47,
    "previousVersion": 46,
    "nextRotation": "2026-05-16T00:00:00Z",
    "rotationsCompleted": 47,
    "failedRotations": 0,
    "status": "scheduled"
  },
  {
    "id": "ROT-002",
    "keyId": "jwt-signing-key",
    "algorithm": "RS256",
    "rotationInterval": "30d",
    "gracePeriod": "48h",
    "activeVersion": 12,
    "previousVersion": 11,
    "nextRotation": "2026-06-01T00:00:00Z",
    "rotationsCompleted": 12,
    "failedRotations": 1,
    "status": "scheduled"
  },
  {
    "id": "ROT-003",
    "keyId": "database-encryption-key",
    "algorithm": "AES-256-CBC",
    "rotationInterval": "90d",
    "gracePeriod": "72h",
    "activeVersion": 4,
    "previousVersion": 3,
    "nextRotation": "2026-07-15T00:00:00Z",
    "rotationsCompleted": 4,
    "failedRotations": 0,
    "status": "scheduled"
  },
  {
    "id": "ROT-004",
    "keyId": "api-hmac-key",
    "algorithm": "HMAC-SHA256",
    "rotationInterval": "14d",
    "gracePeriod": "12h",
    "activeVersion": 25,
    "previousVersion": 24,
    "nextRotation": "2026-05-23T00:00:00Z",
    "rotationsCompleted": 25,
    "failedRotations": 0,
    "status": "scheduled"
  },
  {
    "id": "ROT-005",
    "keyId": "pin-encryption-key",
    "algorithm": "3DES",
    "rotationInterval": "1d",
    "gracePeriod": "6h",
    "activeVersion": 156,
    "previousVersion": 155,
    "nextRotation": "2026-05-10T00:00:00Z",
    "rotationsCompleted": 156,
    "failedRotations": 2,
    "status": "scheduled"
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "key-rotation-engine-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Automated key rotation scheduler, grace period management, multi-key decryption, zero-downtime rotation",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.key.rotation.engine.go"], "consumer_group": "key-rotation-engine-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["rotation_schedules"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-key-rotation-engine-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "key-rotation-engine-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.key.rotation.engine.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "key-rotation-engine-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.rotation_schedules"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/rotations/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "rotation_schedules": copy})
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
	mux.HandleFunc("/v1/rotations/list", handleList)
	mux.HandleFunc("/v1/rotations/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8513"
	}
	fmt.Printf("Key Rotation Engine listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
