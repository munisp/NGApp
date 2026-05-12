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
	data = [{"id": "AS-001", "subject": "transactions-value", "version": 3, "schema": "avro", "compatibilityMode": "BACKWARD", "serializedSizeBytes": 156, "jsonEquivalentBytes": 1230, "compressionRatio": "7.9x", "status": "active"}, {"id": "AS-002", "subject": "fraud-events-value", "version": 2, "schema": "avro", "compatibilityMode": "FULL", "serializedSizeBytes": 89, "jsonEquivalentBytes": 567, "compressionRatio": "6.4x", "status": "active"}, {"id": "AS-003", "subject": "audit-events-value", "version": 1, "schema": "avro", "compatibilityMode": "BACKWARD", "serializedSizeBytes": 67, "jsonEquivalentBytes": 345, "compressionRatio": "5.1x", "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8561" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "avro-schema",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "avro-schema-registry-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "avro-schema-registry-go", "route": "/v1/avro-schema"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/avro-schema/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "schema_registry": data})
	})

	mux.HandleFunc("/v1/avro-schema/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Avro Schema Registry & Encoder", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Avro Schema Registry & Encoder running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
