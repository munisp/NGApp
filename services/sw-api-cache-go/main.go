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
	data = [{"id": "SW-001", "pattern": "/api/accounts/*", "strategy": "stale-while-revalidate", "maxAge": 30, "staleWhileRevalidate": 60, "cacheHitRate": "89.3%", "offlineCapable": true, "status": "active"}, {"id": "SW-002", "pattern": "/api/dashboard/*", "strategy": "network-first", "maxAge": 15, "staleWhileRevalidate": 30, "cacheHitRate": "72.1%", "offlineCapable": true, "status": "active"}, {"id": "SW-003", "pattern": "/api/static/*", "strategy": "cache-first", "maxAge": 86400, "staleWhileRevalidate": 0, "cacheHitRate": "99.1%", "offlineCapable": true, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8554" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "sw-api-cache",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "sw-api-cache-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "sw-api-cache-go", "route": "/v1/sw-api-cache"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/sw-api-cache/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "cache_strategies": data})
	})

	mux.HandleFunc("/v1/sw-api-cache/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Service Worker API Cache Manager", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Service Worker API Cache Manager running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
