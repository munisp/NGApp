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
	data = [{"id": "GP-001", "service": "ledger", "proto": "ledger.proto", "methods": ["Transfer", "Balance", "Statement"], "avgLatencyMs": 0.8, "throughputRps": 45000, "protoSizeBytes": 234, "jsonSizeBytes": 1890, "compressionRatio": "8.1x", "status": "active"}, {"id": "GP-002", "service": "fraud-scoring", "proto": "fraud.proto", "methods": ["Score", "BatchScore", "RealTimeCheck"], "avgLatencyMs": 1.2, "throughputRps": 23000, "protoSizeBytes": 156, "jsonSizeBytes": 1230, "compressionRatio": "7.9x", "status": "active"}, {"id": "GP-003", "service": "auth", "proto": "auth.proto", "methods": ["Validate", "Refresh", "Revoke"], "avgLatencyMs": 0.5, "throughputRps": 67000, "protoSizeBytes": 89, "jsonSizeBytes": 567, "compressionRatio": "6.4x", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8548" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "grpc-hot-path",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "grpc-hot-path-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "grpc-hot-path-go", "route": "/v1/grpc-hot-path"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/grpc-hot-path/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "grpc_services": data})
	})

	mux.HandleFunc("/v1/grpc-hot-path/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "gRPC Hot Path Gateway", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("gRPC Hot Path Gateway running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
