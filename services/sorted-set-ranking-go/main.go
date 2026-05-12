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
	data = [{"id": "SR-001", "name": "transaction_volume_daily", "members": 15000, "topScore": 45230000, "updateFrequency": "real-time", "queryLatencyMs": 0.3, "memoryMB": 4.2, "status": "active"}, {"id": "SR-002", "name": "fraud_risk_score", "members": 8500, "topScore": 99.8, "updateFrequency": "per-event", "queryLatencyMs": 0.2, "memoryMB": 2.1, "status": "active"}, {"id": "SR-003", "name": "customer_360_score", "members": 25000, "topScore": 985, "updateFrequency": "hourly", "queryLatencyMs": 0.4, "memoryMB": 6.8, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8538" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "sorted-set-ranking",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "sorted-set-ranking-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "sorted-set-ranking-go", "route": "/v1/sorted-set-ranking"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/sorted-set-ranking/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "rankings": data})
	})

	mux.HandleFunc("/v1/sorted-set-ranking/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Redis Sorted Set Rankings", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Redis Sorted Set Rankings running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
