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
    "id": "IMG-001",
    "image": "54bank/core-banking:latest",
    "registry": "ghcr.io",
    "baseImage": "node:22-slim",
    "totalVulns": 12,
    "critical": 0,
    "high": 2,
    "medium": 7,
    "low": 3,
    "sbomArtifacts": 456,
    "lastScanned": "2026-05-09T12:00:00Z",
    "scanDuration": "45s",
    "status": "passed"
  },
  {
    "id": "IMG-002",
    "image": "54bank/scratch-card-pin-go:latest",
    "registry": "ghcr.io",
    "baseImage": "alpine:3.19",
    "totalVulns": 3,
    "critical": 0,
    "high": 0,
    "medium": 2,
    "low": 1,
    "sbomArtifacts": 23,
    "lastScanned": "2026-05-09T12:05:00Z",
    "scanDuration": "12s",
    "status": "passed"
  },
  {
    "id": "IMG-003",
    "image": "54bank/hsm-key-manager-rs:latest",
    "registry": "ghcr.io",
    "baseImage": "debian:bookworm-slim",
    "totalVulns": 8,
    "critical": 0,
    "high": 1,
    "medium": 4,
    "low": 3,
    "sbomArtifacts": 89,
    "lastScanned": "2026-05-09T12:10:00Z",
    "scanDuration": "28s",
    "status": "passed"
  },
  {
    "id": "IMG-004",
    "image": "54bank/kyc-engine-py:latest",
    "registry": "ghcr.io",
    "baseImage": "python:3.11-slim",
    "totalVulns": 15,
    "critical": 1,
    "high": 3,
    "medium": 8,
    "low": 3,
    "sbomArtifacts": 234,
    "lastScanned": "2026-05-09T12:15:00Z",
    "scanDuration": "38s",
    "status": "failed"
  },
  {
    "id": "IMG-005",
    "image": "54bank/fraud-detection-rs:latest",
    "registry": "ghcr.io",
    "baseImage": "debian:bookworm-slim",
    "totalVulns": 5,
    "critical": 0,
    "high": 0,
    "medium": 3,
    "low": 2,
    "sbomArtifacts": 67,
    "lastScanned": "2026-05-09T12:20:00Z",
    "scanDuration": "22s",
    "status": "passed"
  }
]`

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"service": "image-scanner-go",
		"status":  "healthy",
		"version": "1.0.0",
		"uptime":  time.Now().Format(time.RFC3339),
		"description": "Trivy/Grype integration, CVE database, base image tracking, SBOM generation, vulnerability prioritization",
		"middleware": json.RawMessage(`{
    "kafka": {"broker": "kafka:9092", "topics": ["security.image.scanner.go"], "consumer_group": "image-scanner-go-cg"},
    "redis": {"url": "redis://redis:6379/0", "usage": "Session cache, rate limiting, blacklists"},
    "postgres": {"url": "postgresql://postgres:54bank@postgres:5432/banking", "tables": ["image_scans"]},
    "opensearch": {"url": "https://opensearch:9200", "indices": ["security-image-scanner-go"]},
    "keycloak": {"issuer": "https://auth.54bank.app/realms/54bank", "realm": "54bank"},
    "permify": {"endpoint": "permify:3476", "schema": "security"},
    "dapr": {"appId": "image-scanner-go", "pubsub": "54bank-pubsub"},
    "fluvio": {"endpoint": "fluvio:9003", "topics": ["security.image.scanner.go"]},
    "temporal": {"namespace": "54bank-security", "taskQueue": "image-scanner-go-queue"},
    "mojaloop": {"hub": "mojaloop:4000", "usage": "Payment security correlation"},
    "tigerbeetle": {"cluster": "tigerbeetle:3000", "ledger": 27},
    "lakehouse": {"endpoint": "lakehouse:8080", "tables": ["security.image_scans"]},
    "apisix": {"admin": "apisix:9180", "routes": ["/v1/scans/*"]},
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

	writeJSON(w, 200, map[string]interface{}{"total": len(copy), "image_scans": copy})
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
	mux.HandleFunc("/v1/scans/list", handleList)
	mux.HandleFunc("/v1/scans/stats", handleStats)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8519"
	}
	fmt.Printf("Container Image Scanner listening on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
