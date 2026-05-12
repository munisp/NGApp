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
	data = [{"id": "OU-001", "action": "status_change", "endpoint": "/api/*/status", "rollbackOnError": true, "successRate": "99.7%", "avgRollbackMs": 45, "perceivedLatencyMs": 0, "status": "active"}, {"id": "OU-002", "action": "create", "endpoint": "/api/*/create", "rollbackOnError": true, "successRate": "98.9%", "avgRollbackMs": 120, "perceivedLatencyMs": 0, "status": "active"}, {"id": "OU-003", "action": "delete", "endpoint": "/api/*/delete", "rollbackOnError": true, "successRate": "99.5%", "avgRollbackMs": 67, "perceivedLatencyMs": 0, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8558" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "optimistic-ui",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "optimistic-ui-engine-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "optimistic-ui-engine-go", "route": "/v1/optimistic-ui"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/optimistic-ui/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "optimistic_configs": data})
	})

	mux.HandleFunc("/v1/optimistic-ui/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Optimistic UI Update Engine", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Optimistic UI Update Engine running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
