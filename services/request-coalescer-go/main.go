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
	data = [{"id": "RQ-001", "route": "/api/dashboard/kpis", "windowMs": 50, "coalescedRequests24h": 23450, "uniqueRequests24h": 8900, "savingsRatio": "2.6x", "avgWaiters": 3.2, "status": "active"}, {"id": "RQ-002", "route": "/api/accounts/balance", "windowMs": 25, "coalescedRequests24h": 45600, "uniqueRequests24h": 12300, "savingsRatio": "3.7x", "avgWaiters": 4.1, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8552" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "request-coalescer",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "request-coalescer-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "request-coalescer-go", "route": "/v1/request-coalescer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/request-coalescer/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "coalescing_rules": data})
	})

	mux.HandleFunc("/v1/request-coalescer/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Request Deduplication & Coalescing", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Request Deduplication & Coalescing running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
