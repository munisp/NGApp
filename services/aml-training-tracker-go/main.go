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
	data = [{"id": "TRN-001", "staffId": "EMP-001", "staffName": "Adewale Ogundimu", "role": "Compliance Officer", "department": "Compliance", "trainingModule": "CBN AML/CFT Guidelines 2024", "completedDate": "2026-04-15", "score": 92, "passThreshold": 80, "certificateId": "CERT-AML-001", "validUntil": "2027-04-15", "status": "certified"}, {"id": "TRN-002", "staffId": "EMP-002", "staffName": "Fatima Abdullahi", "role": "Branch Manager", "department": "Retail Banking", "trainingModule": "Suspicious Transaction Identification", "completedDate": "2026-03-20", "score": 88, "passThreshold": 80, "certificateId": "CERT-AML-002", "validUntil": "2027-03-20", "status": "certified"}, {"id": "TRN-003", "staffId": "EMP-003", "staffName": "Chukwuemeka Nwosu", "role": "Teller", "department": "Branch Operations", "trainingModule": "KYC Procedures & Red Flags", "completedDate": null, "score": null, "passThreshold": 80, "certificateId": null, "validUntil": null, "status": "overdue"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8585" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "aml-training-tracker",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "aml-training-tracker-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "aml-training-tracker-go", "route": "/v1/aml-training-tracker"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}`),
		})
	})

	mux.HandleFunc("/v1/aml-training-tracker/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "training_records": data})
	})

	mux.HandleFunc("/v1/aml-training-tracker/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "AML Training & Awareness Tracker", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("AML Training & Awareness Tracker running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
