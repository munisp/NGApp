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
	data = [{"id": "SS-001", "sessionId": "sess_abc123def", "userId": "USR-001", "deviceType": "web", "ipAddress": "102.89.45.12", "expiresIn": "3600s", "slidingTTL": true, "lastActivity": "2026-05-13T10:30:00Z", "status": "active"}, {"id": "SS-002", "sessionId": "sess_ghi789jkl", "userId": "USR-002", "deviceType": "mobile", "ipAddress": "105.112.78.34", "expiresIn": "7200s", "slidingTTL": true, "lastActivity": "2026-05-13T10:25:00Z", "status": "active"}, {"id": "SS-003", "sessionId": "sess_mno456pqr", "userId": "USR-003", "deviceType": "tablet", "ipAddress": "41.58.190.22", "expiresIn": "1800s", "slidingTTL": false, "lastActivity": "2026-05-13T09:45:00Z", "status": "expired"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8535" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "redis-session",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "redis-session-store-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "redis-session-store-go", "route": "/v1/redis-session"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/redis-session/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "sessions": data})
	})

	mux.HandleFunc("/v1/redis-session/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Redis Session Store", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Redis Session Store running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
