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
	data = [{"id": "KD-001", "scaleObject": "transaction-consumer", "trigger": "kafka", "metric": "consumer_lag", "threshold": 100, "currentValue": 12, "minReplicas": 1, "maxReplicas": 20, "currentReplicas": 3, "cooldown": "60s", "status": "active"}, {"id": "KD-002", "scaleObject": "fraud-processor", "trigger": "redis", "metric": "queue_length", "threshold": 500, "currentValue": 23, "minReplicas": 1, "maxReplicas": 15, "currentReplicas": 2, "cooldown": "30s", "status": "active"}, {"id": "KD-003", "scaleObject": "report-generator", "trigger": "cron", "metric": "schedule", "threshold": 1, "currentValue": 0, "minReplicas": 0, "maxReplicas": 5, "currentReplicas": 0, "cooldown": "300s", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8569" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "keda-scaler",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "keda-scaler-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "keda-scaler-go", "route": "/v1/keda-scaler"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/keda-scaler/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "scale_triggers": data})
	})

	mux.HandleFunc("/v1/keda-scaler/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "KEDA Event-Driven Autoscaler", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("KEDA Event-Driven Autoscaler running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
