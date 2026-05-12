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
	data = [{"id": "CDN-001", "provider": "cloudflare", "origin": "54bank.ng", "zones": ["static", "api", "media"], "edgeLocations": ["Lagos", "Abuja", "PortHarcourt", "Kano", "London", "Amsterdam"], "ttlStatic": 604800, "ttlApi": 15, "brotliEnabled": true, "http2Push": true, "bandwidthSaved24h": "234GB", "status": "active"}, {"id": "CDN-002", "provider": "cloudfront", "origin": "api.54bank.ng", "zones": ["api-backup"], "edgeLocations": ["Lagos", "Johannesburg", "London", "Frankfurt"], "ttlStatic": 86400, "ttlApi": 5, "brotliEnabled": true, "http2Push": false, "bandwidthSaved24h": "89GB", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8567" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "cdn-edge-cache",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "cdn-edge-cache-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "cdn-edge-cache-go", "route": "/v1/cdn-edge-cache"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/cdn-edge-cache/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "cdn_configs": data})
	})

	mux.HandleFunc("/v1/cdn-edge-cache/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "CDN Edge Cache Manager", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("CDN Edge Cache Manager running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
