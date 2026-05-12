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
	data = [{"id": "PB-001", "database": "bank54", "poolMode": "transaction", "activeConnections": 45, "idleConnections": 80, "waitingClients": 0, "maxClientConn": 1000, "defaultPoolSize": 25, "avgQueryMs": 3.2, "totalQueries24h": 4523000, "status": "active"}, {"id": "PB-002", "database": "bank54_replica", "poolMode": "transaction", "activeConnections": 23, "idleConnections": 52, "waitingClients": 0, "maxClientConn": 500, "defaultPoolSize": 15, "avgQueryMs": 2.8, "totalQueries24h": 2341000, "status": "active"}, {"id": "PB-003", "database": "bank54_analytics", "poolMode": "session", "activeConnections": 8, "idleConnections": 17, "waitingClients": 0, "maxClientConn": 100, "defaultPoolSize": 10, "avgQueryMs": 45.6, "totalQueries24h": 89000, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8539" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "pgbouncer",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "pgbouncer-manager-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "pgbouncer-manager-go", "route": "/v1/pgbouncer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/pgbouncer/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "pool_stats": data})
	})

	mux.HandleFunc("/v1/pgbouncer/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "PgBouncer Connection Pool Manager", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("PgBouncer Connection Pool Manager running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
