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
	data = [{"id": "AP-001", "route": "/api/accounts/*", "plugins": ["auth", "rate-limit", "cors", "response-rewrite"], "avgLatencyMs": 2.3, "conditionalPlugins": ["waf", "ip-restrict"], "skipCondition": "internal-traffic", "latencySaving": "1.2ms", "status": "active"}, {"id": "AP-002", "route": "/api/public/*", "plugins": ["rate-limit", "cors"], "avgLatencyMs": 0.8, "conditionalPlugins": ["auth"], "skipCondition": "public-endpoint", "latencySaving": "3.4ms", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8573" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "apisix-plugin",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "apisix-plugin-optimizer-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "apisix-plugin-optimizer-go", "route": "/v1/apisix-plugin"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/apisix-plugin/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "plugin_chains": data})
	})

	mux.HandleFunc("/v1/apisix-plugin/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "APISIX Plugin Chain Optimizer", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("APISIX Plugin Chain Optimizer running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
