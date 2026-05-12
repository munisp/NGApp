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
	data = [{"id": "PS-001", "queryPattern": "SELECT * FROM transactions WHERE account_id = $1", "executions24h": 234560, "avgExecMs": 1.2, "planCacheHits": "99.1%", "paramTypes": "[uuid]", "status": "active"}, {"id": "PS-002", "queryPattern": "SELECT * FROM accounts WHERE customer_id = $1 LIMIT $2 OFFSET $3", "executions24h": 89120, "avgExecMs": 0.8, "planCacheHits": "99.5%", "paramTypes": "[uuid,int,int]", "status": "active"}, {"id": "PS-003", "queryPattern": "INSERT INTO audit_logs (event_type, actor, details) VALUES ($1, $2, $3)", "executions24h": 456230, "avgExecMs": 0.5, "planCacheHits": "99.8%", "paramTypes": "[text,text,jsonb]", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8541" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "prepared-stmt",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "prepared-stmt-cache-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "prepared-stmt-cache-go", "route": "/v1/prepared-stmt"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/prepared-stmt/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "cached_statements": data})
	})

	mux.HandleFunc("/v1/prepared-stmt/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Prepared Statement Cache", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Prepared Statement Cache running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
