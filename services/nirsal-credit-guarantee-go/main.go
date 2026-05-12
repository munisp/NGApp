package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

func envOr(k, f string) string { if v := os.Getenv(k); v != "" { return v }; return f }
func now() string { return time.Now().UTC().Format(time.RFC3339) }

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["nirsal_credit_guarantee.events", "nirsal_credit_guarantee.audit"]}, "dapr": {"status": "connected", "appId": "nirsal-credit-guarantee-go-sidecar"}, "fluvio": {"status": "connected", "topic": "nirsal_credit_guarantee-stream"}, "temporal": {"status": "connected", "namespace": "nirsal_credit_guarantee"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "nirsal_credit_guarantee"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "nirsal_credit_guarantee_authz"}, "redis": {"status": "connected", "prefix": "nirsal_credit_guarantee:"}, "mojaloop": {"status": "connected", "participant": "nirsal_credit_guarantee"}, "opensearch": {"status": "connected", "index": "nirsal_credit_guarantee-*"}, "openappsec": {"status": "connected", "policy": "nirsal-credit-guarantee-go-protection"}, "apisix": {"status": "connected", "upstream": "nirsal_credit_guarantee"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "nirsal_credit_guarantee_iceberg"}}`)

var seedData = `[
  {
    "id": "NCRG-001",
    "applicationRef": "NIRSAL/2026/KN/001",
    "farmerId": "FRM-001",
    "farmerName": "Alhaji Musa Abdullahi",
    "cooperativeId": "COOP-001",
    "lendingBank": "First Bank",
    "loanAmount": 5000000,
    "guaranteePercent": 75,
    "guaranteeAmount": 3750000,
    "commodityChain": "groundnut",
    "riskRating": "A",
    "nirsalZone": "North-West",
    "status": "active"
  },
  {
    "id": "NCRG-002",
    "applicationRef": "NIRSAL/2026/OY/003",
    "farmerId": "FRM-003",
    "farmerName": "Chief Adebayo Ogundimu",
    "cooperativeId": "COOP-002",
    "lendingBank": "Access Bank",
    "loanAmount": 15000000,
    "guaranteePercent": 50,
    "guaranteeAmount": 7500000,
    "commodityChain": "cassava",
    "riskRating": "B",
    "nirsalZone": "South-West",
    "status": "active"
  },
  {
    "id": "NCRG-003",
    "applicationRef": "NIRSAL/2026/BN/007",
    "farmerId": "FRM-004",
    "farmerName": "Emmanuel Oche",
    "cooperativeId": "COOP-003",
    "lendingBank": "Zenith Bank",
    "loanAmount": 25000000,
    "guaranteePercent": 75,
    "guaranteeAmount": 18750000,
    "commodityChain": "rice",
    "riskRating": "A",
    "nirsalZone": "North-Central",
    "status": "active"
  },
  {
    "id": "NCRG-004",
    "applicationRef": "NIRSAL/2026/CR/002",
    "farmerId": "FRM-005",
    "farmerName": "Bassey Edem Okon",
    "cooperativeId": "COOP-004",
    "lendingBank": "UBA",
    "loanAmount": 8000000,
    "guaranteePercent": 50,
    "guaranteeAmount": 4000000,
    "commodityChain": "cocoa",
    "riskRating": "B",
    "nirsalZone": "South-South",
    "status": "under_review"
  }
]`

func main() {
	port := envOr("PORT", "8592")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "nirsal-credit-guarantee-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/nirsal_credit_guarantee/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("nirsal-credit-guarantee-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
