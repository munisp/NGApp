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
	data = [{"id": "UBO-001", "entityId": "CUS-3021", "entityName": "ABC Import Export Ltd", "entityType": "company", "rcNumber": "RC-456789", "jurisdiction": "Nigeria", "ultimateBeneficialOwners": [{"name": "Ahmed Ibrahim", "ownership": 35, "nationality": "Nigerian", "pep": false, "sanctioned": false}, {"name": "XYZ Holdings BVI", "ownership": 40, "nationality": "BVI", "pep": false, "sanctioned": false, "note": "Offshore shell \u2014 requires enhanced scrutiny"}, {"name": "Sarah Okonkwo", "ownership": 25, "nationality": "Nigerian", "pep": true, "sanctioned": false}], "totalLayers": 3, "highRiskFlags": ["offshore_structure", "pep_ownership", "complex_layering"], "lastVerified": "2026-05-12", "verificationSource": "CAC_API+manual", "status": "flagged"}, {"id": "UBO-002", "entityId": "CUS-2089", "entityName": "BUA Group Holdings", "entityType": "conglomerate", "rcNumber": "RC-123456", "jurisdiction": "Nigeria", "ultimateBeneficialOwners": [{"name": "Abdulsamad Rabiu", "ownership": 100, "nationality": "Nigerian", "pep": false, "sanctioned": false}], "totalLayers": 1, "highRiskFlags": [], "lastVerified": "2026-05-10", "verificationSource": "CAC_API", "status": "verified"}]
)

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8580" }
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "beneficial-ownership",
			"status":  "healthy",
			"version": "1.0.0",
			"uptime":  time.Now().Format(time.RFC3339),
			"middleware": json.RawMessage(`{"kafka": {"broker": "kafka:9092", "topics": ["aml-events", "kyc-screening", "compliance-alerts"]}, "dapr": {"appId": "beneficial-ownership-go", "pubsub": "redis-pubsub"}, "fluvio": {"topic": "aml-stream", "partitions": 6}, "temporal": {"namespace": "aml-compliance", "taskQueue": "aml-tasks"}, "postgres": {"host": "postgres", "port": 5432, "database": "bank54"}, "keycloak": {"realm": "54bank", "clientId": "aml-service"}, "permify": {"schema": "aml-compliance", "version": "v1"}, "redis": {"host": "redis", "port": 6379, "db": 3}, "mojaloop": {"hub": "http://mojaloop:4000"}, "opensearch": {"host": "opensearch", "index": "aml-events"}, "openappsec": {"policy": "aml-protection"}, "apisix": {"upstream": "beneficial-ownership-go", "route": "/v1/beneficial-ownership"}, "tigerbeetle": {"cluster": "0", "addresses": ["tigerbeetle:3001"]}, "lakehouse": {"catalog": "aml_catalog", "warehouse": "s3://54bank-aml"}}`),
		})
	})

	mux.HandleFunc("/v1/beneficial-ownership/list", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"total": len(data), "ownership_chains": data})
	})

	mux.HandleFunc("/v1/beneficial-ownership/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"total": len(data), "active": len(data),
			"service": "Beneficial Ownership Registry", "lastUpdated": time.Now().Format(time.RFC3339),
		})
	})

	fmt.Printf("Beneficial Ownership Registry running on :%s\n", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal(err)
	}
}
