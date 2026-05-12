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
	data = [{"id": "CTR-2026-0451", "customerId": "CUS-5678", "customerName": "Lagos Trading Co", "transactionId": "TXN-890123", "amount": 15000000, "currency": "NGN", "transactionType": "cash_deposit", "branchCode": "LAG-001", "branchName": "Victoria Island Branch", "tellerName": "Aisha Mohammed", "identificationUsed": "BVN-22334455667", "filedTo": "NFIU", "nfiuReference": "NFIU/CTR/2026/0451", "status": "filed", "filedDate": "2026-05-13T10:30:00Z", "autoFiled": true, "threshold": 5000000}, {"id": "CTR-2026-0452", "customerId": "CUS-6789", "customerName": "Dangote Industries", "transactionId": "TXN-890124", "amount": 250000000, "currency": "NGN", "transactionType": "wire_transfer", "branchCode": "ABJ-001", "branchName": "Abuja Main Branch", "tellerName": "System Auto", "identificationUsed": "RC-12345", "filedTo": "NFIU", "nfiuReference": "NFIU/CTR/2026/0452", "status": "filed", "filedDate": "2026-05-13T11:00:00Z", "autoFiled": true, "threshold": 5000000}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8576" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "ctr-auto-filer",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "ctr-auto-filer-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "ctr-auto-filer-go", "route": "/v1/ctr-auto-filer"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}`),
		})
	})

	mux.HandleFunc("/v1/ctr-auto-filer/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "ctr_reports": data})
	})

	mux.HandleFunc("/v1/ctr-auto-filer/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "CTR Auto-Filing Engine", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("CTR Auto-Filing Engine running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
