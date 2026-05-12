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
    "id": "DEV-001",
    "fingerprintHash": "a3f8c2e1d4b5",
    "userId": "USR-001",
    "deviceType": "desktop",
    "browser": "Chrome 125",
    "os": "Windows 11",
    "screenRes": "1920x1080",
    "timezone": "Africa/Lagos",
    "language": "en-NG",
    "trustScore": 95,
    "sessionsCount": 234,
    "lastSeen": "2026-05-09T14:00:00Z",
    "status": "trusted"
  },
  {
    "id": "DEV-002",
    "fingerprintHash": "b7d9e3f2c1a4",
    "userId": "USR-001",
    "deviceType": "mobile",
    "browser": "Chrome Mobile 125",
    "os": "Android 14",
    "screenRes": "412x915",
    "timezone": "Africa/Lagos",
    "language": "en-NG",
    "trustScore": 88,
    "sessionsCount": 567,
    "lastSeen": "2026-05-09T13:30:00Z",
    "status": "trusted"
  },
  {
    "id": "DEV-003",
    "fingerprintHash": "c4e1a8f3d2b7",
    "userId": "USR-002",
    "deviceType": "mobile",
    "browser": "Safari 17",
    "os": "iOS 17.5",
    "screenRes": "390x844",
    "timezone": "Africa/Lagos",
    "language": "en",
    "trustScore": 92,
    "sessionsCount": 123,
    "lastSeen": "2026-05-09T12:00:00Z",
    "status": "trusted"
  },
  {
    "id": "DEV-004",
    "fingerprintHash": "d5f2b9c3e1a8",
    "userId": "USR-003",
    "deviceType": "desktop",
    "browser": "Firefox 126",
    "os": "macOS 15",
    "screenRes": "2560x1440",
    "timezone": "Europe/London",
    "language": "en-GB",
    "trustScore": 45,
    "sessionsCount": 2,
    "lastSeen": "2026-05-09T11:00:00Z",
    "status": "suspicious"
  },
  {
    "id": "DEV-005",
    "fingerprintHash": "e6a3c1d4f2b9",
    "userId": "USR-004",
    "deviceType": "desktop",
    "browser": "Chrome 124",
    "os": "Linux",
    "screenRes": "1366x768",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN",
    "trustScore": 15,
    "sessionsCount": 1,
    "lastSeen": "2026-05-09T10:30:00Z",
    "status": "blocked"
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "browser-fingerprint-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Device fingerprint fraud detection, canvas/WebGL fingerprinting, behavioral biometrics, device trust scoring",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.browser.fingerprint.go"], "consumer_group": "browser-fingerprint-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["device_profiles"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-browser-fingerprint-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "browser-fingerprint-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.browser.fingerprint.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "browser-fingerprint-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.device_profiles"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/profiles/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "device_profiles": copy})
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
	mux.HandleFunc("/v1/profiles/list", handleList)
	mux.HandleFunc("/v1/profiles/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8533"
	}
	fmt.Printf("Browser Fingerprint Detector listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
