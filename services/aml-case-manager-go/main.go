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
	data = [{"id": "CASE-2026-001", "alertIds": ["ALT-001", "ALT-002"], "customerId": "CUS-1045", "customerName": "Suspicious Transfers Ltd", "caseType": "structuring", "riskLevel": "high", "status": "investigation", "assignedTo": "Investigation Officer A", "openedAt": "2026-04-16", "dueDate": "2026-05-16", "escalatedTo": null, "sarFiled": true, "sarId": "SAR-2026-001", "evidence": ["bank_statements", "cctv_records", "third_party_reports"], "notes": "Pattern of \u20a64.9M deposits across 3 branches within 5 days", "outcome": null}, {"id": "CASE-2026-002", "alertIds": ["ALT-005", "ALT-006", "ALT-007"], "customerId": "CUS-3021", "customerName": "ABC Import Export", "caseType": "trade_based_ml", "riskLevel": "critical", "status": "escalated_to_mlro", "assignedTo": "MLRO", "openedAt": "2026-03-21", "dueDate": "2026-04-21", "escalatedTo": "Board Compliance Committee", "sarFiled": true, "sarId": "SAR-2026-002", "evidence": ["trade_documents", "invoice_analysis", "shipping_records", "beneficiary_analysis"], "notes": "Over-invoicing on 12 LCs from high-risk jurisdictions. Shell company beneficiaries identified.", "outcome": null}, {"id": "CASE-2026-003", "alertIds": ["ALT-010"], "customerId": "CUS-4567", "customerName": "Ngozi Okafor", "caseType": "false_positive", "riskLevel": "low", "status": "closed_no_action", "assignedTo": "Investigation Officer B", "openedAt": "2026-04-01", "dueDate": "2026-05-01", "escalatedTo": null, "sarFiled": false, "sarId": null, "evidence": ["salary_verification", "employer_confirmation"], "notes": "Alert triggered by salary deposit + rent payment. Verified legitimate.", "outcome": "false_positive"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8577" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "aml-case-manager",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "aml-case-manager-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "aml-case-manager-go", "route": "/v1/aml-case-manager"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}`),
		})
	})

	mux.HandleFunc("/v1/aml-case-manager/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "aml_cases": data})
	})

	mux.HandleFunc("/v1/aml-case-manager/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "AML Case Management System", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("AML Case Management System running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
