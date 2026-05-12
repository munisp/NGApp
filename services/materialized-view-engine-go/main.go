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
	data = [{"id": "MV-001", "name": "daily_transaction_summary", "refreshIntervalSec": 60, "lastRefreshMs": 230, "rowCount": 365, "dependsOn": ["transactions"], "autoRefresh": true, "status": "active"}, {"id": "MV-002", "name": "customer_balance_snapshot", "refreshIntervalSec": 30, "lastRefreshMs": 450, "rowCount": 25000, "dependsOn": ["accounts", "transactions"], "autoRefresh": true, "status": "active"}, {"id": "MV-003", "name": "fraud_score_aggregates", "refreshIntervalSec": 15, "lastRefreshMs": 120, "rowCount": 8500, "dependsOn": ["fraud_events", "transactions"], "autoRefresh": true, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8543" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "materialized-views",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "materialized-view-engine-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "materialized-view-engine-go", "route": "/v1/materialized-views"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/materialized-views/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "materialized_views": data})
	})

	mux.HandleFunc("/v1/materialized-views/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Materialized View Refresh Engine", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Materialized View Refresh Engine running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
