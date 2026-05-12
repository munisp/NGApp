package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

var (
	mu   sync.RWMutex
	data = [{"id": "HPA-001", "deployment": "transaction-service", "minReplicas": 3, "maxReplicas": 50, "currentReplicas": 8, "cpuTargetPct": 70, "memoryTargetPct": 80, "customMetric": "p99_latency_ms < 50", "scaleUpCooldown": "60s", "status": "active"}, {"id": "HPA-002", "deployment": "fraud-scoring", "minReplicas": 2, "maxReplicas": 30, "currentReplicas": 5, "cpuTargetPct": 60, "memoryTargetPct": 70, "customMetric": "queue_depth < 100", "scaleUpCooldown": "30s", "status": "active"}, {"id": "HPA-003", "deployment": "express-gateway", "minReplicas": 5, "maxReplicas": 100, "currentReplicas": 12, "cpuTargetPct": 65, "memoryTargetPct": 75, "customMetric": "rps_per_pod < 500", "scaleUpCooldown": "45s", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8566" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "hpa-autoscaler",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "hpa-autoscaler-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "hpa-autoscaler-go", "route": "/v1/hpa-autoscaler"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/hpa-autoscaler/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "hpa_configs": data})
	})

	mux.HandleFunc("/v1/hpa-autoscaler/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Horizontal Pod Autoscaler Manager", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Horizontal Pod Autoscaler Manager running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
