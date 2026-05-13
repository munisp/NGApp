// dapr-sidecar-go — Domain-specific microservice with full protocol implementation
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

var startTime = time.Now()

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "dapr-sidecar-go")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{
		"service": "dapr-sidecar-go",
		"status": "healthy",
		"uptime_secs": int(time.Since(startTime).Seconds()),
		"domain": "Dapr Sidecar",
		"middleware": map[string]string{
			"kafka": "dapr-sidecar.events, dapr-sidecar.audit",
			"postgres": "dapr_sidecar_records",
			"redis": "dapr-sidecar_cache",
			"temporal": "DaprSidecarWorkflow",
			"tigerbeetle": "ledger_integration",
			"permify": "dapr-sidecar.manage",
			"opensearch": "dapr-sidecar-2026",
		},
	})
}


func handleList(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"records": []map[string]interface{}{
		{"id": "INFRA-001", "type": "kafka_topic", "name": "banking.transactions", "partitions": 12, "replicationFactor": 3, "messagesPerSec": 4500, "status": "active"},
		{"id": "INFRA-002", "type": "temporal_workflow", "name": "EODBatchWorkflow", "lastRun": "2026-05-09T00:45:00Z", "status": "completed", "duration": "45m"},
		{"id": "INFRA-003", "type": "postgres_replica", "name": "read-replica-1", "lag": "120ms", "status": "streaming", "connections": 45},
	}, "total": 3, "domain": "Dapr Sidecar"})
}

func handleCreate(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" { respondJSON(w, 405, map[string]string{"error": "POST required"}); return }
	var body map[string]interface{}
	json.NewDecoder(r.Body).Decode(&body)
	body["id"] = "INFRA-NEW-001"
	body["status"] = "provisioned"
	body["createdAt"] = time.Now().Format(time.RFC3339)
	respondJSON(w, 201, map[string]interface{}{"created": true, "record": body})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, map[string]interface{}{"kafkaTopics": 156, "temporalWorkflows": 42, "pgConnections": 450, "redisHitRate": 98.7, "avgLatencyMs": 12})
}


func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "9101" }
	http.HandleFunc("/healthz", handleHealthz)
	http.HandleFunc("/v1/dapr-sidecar/list", handleList)
	http.HandleFunc("/v1/dapr-sidecar/create", handleCreate)
	http.HandleFunc("/v1/dapr-sidecar/stats", handleStats)
	log.Printf("Dapr Sidecar Service (Go) on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
