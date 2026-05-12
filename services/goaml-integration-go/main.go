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
	data = [{"id": "GOAML-2026-001", "reportType": "STR", "reportCode": "STRNFI001", "submitterId": "54BANK", "submitterName": "54Bank Nigeria", "reportDate": "2026-05-01", "subject": "John Doe", "subjectId": "CUS-2089", "amount": 25000000, "currency": "NGN", "narrativeDescription": "Rapid movement of funds through multiple accounts within 6 hours", "transactionDates": ["2026-04-28"], "xmlGenerated": true, "xmlValidated": true, "submittedToNFIU": true, "nfiuAcknowledgement": "ACK-2026-05-01-0512", "status": "acknowledged"}, {"id": "GOAML-2026-002", "reportType": "CTR", "reportCode": "CTRNFI001", "submitterId": "54BANK", "submitterName": "54Bank Nigeria", "reportDate": "2026-05-13", "subject": "Lagos Trading Co", "subjectId": "CUS-5678", "amount": 15000000, "currency": "NGN", "narrativeDescription": "Cash deposit exceeding \u20a65M threshold", "transactionDates": ["2026-05-13"], "xmlGenerated": true, "xmlValidated": true, "submittedToNFIU": true, "nfiuAcknowledgement": "ACK-2026-05-13-0451", "status": "acknowledged"}, {"id": "GOAML-2026-003", "reportType": "SAR", "reportCode": "SARNFI003", "submitterId": "54BANK", "submitterName": "54Bank Nigeria", "reportDate": "2026-03-21", "subject": "ABC Import Export", "subjectId": "CUS-3021", "amount": 150000000, "currency": "NGN", "narrativeDescription": "Trade-based money laundering indicators - over-invoicing on LCs", "transactionDates": ["2026-03-01", "2026-03-05", "2026-03-10", "2026-03-15", "2026-03-20"], "xmlGenerated": true, "xmlValidated": true, "submittedToNFIU": true, "nfiuAcknowledgement": "ACK-2026-03-22-0321", "status": "escalated_by_nfiu"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8582" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "goaml-integration",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "goaml-integration-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "goaml-integration-go", "route": "/v1/goaml-integration"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}`),
		})
	})

	mux.HandleFunc("/v1/goaml-integration/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "goaml_reports": data})
	})

	mux.HandleFunc("/v1/goaml-integration/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "goAML NFIU Integration", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("goAML NFIU Integration running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
