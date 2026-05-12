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
	data = [{"id": "KC-001", "groupId": "transaction-processors", "topic": "transactions", "partitions": 12, "consumers": 6, "lag": 0, "avgProcessMs": 2.3, "throughputMps": 45000, "rebalanceCount24h": 0, "status": "active"}, {"id": "KC-002", "groupId": "fraud-detectors", "topic": "fraud-events", "partitions": 8, "consumers": 4, "lag": 12, "avgProcessMs": 5.6, "throughputMps": 12000, "rebalanceCount24h": 1, "status": "active"}, {"id": "KC-003", "groupId": "audit-writers", "topic": "audit-events", "partitions": 6, "consumers": 3, "lag": 0, "avgProcessMs": 1.1, "throughputMps": 67000, "rebalanceCount24h": 0, "status": "active"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8559" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "kafka-consumer",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["perf-metrics", "cache-events", "query-stats"]}, "dapr": {"appId": "kafka-consumer-optimizer-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "perf-stream", "partitions": 6}, "temporal": {"namespace": "performance", "taskQueue": "perf-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "perf-service"}, "permify": {"schema": "performance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 2}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "perf-metrics"}, "openappsec": {"policy": "perf-protection"}, "apisix": {"upstream": "kafka-consumer-optimizer-go", "route": "/v1/kafka-consumer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "perf_catalog", "warehouse": "s3://54bank-perf"}}`),
		})
	})

	mux.HandleFunc("/v1/kafka-consumer/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "consumer_groups": data})
	})

	mux.HandleFunc("/v1/kafka-consumer/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Kafka Consumer Group Optimizer", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Kafka Consumer Group Optimizer running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
