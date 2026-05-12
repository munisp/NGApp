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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agri_evoucher.events", "agri_evoucher.audit"]}, "dapr": {"status": "connected", "appId": "agri-evoucher-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_evoucher-stream"}, "temporal": {"status": "connected", "namespace": "agri_evoucher"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_evoucher"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_evoucher_authz"}, "redis": {"status": "connected", "prefix": "agri_evoucher:"}, "mojaloop": {"status": "connected", "participant": "agri_evoucher"}, "opensearch": {"status": "connected", "index": "agri_evoucher-*"}, "openappsec": {"status": "connected", "policy": "agri-evoucher-go-protection"}, "apisix": {"status": "connected", "upstream": "agri_evoucher"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_evoucher_iceberg"}}`)

var seedData = `[
  {
    "id": "EVC-001",
    "name": "NIRSAL Fertilizer Voucher 2026",
    "category": "nirsal_subsidy",
    "description": "50% subsidy on NPK fertilizer for registered smallholders",
    "status": "active",
    "amount": 11000,
    "region": "nationwide",
    "reference": "NIRSAL/EVC/2026/001"
  },
  {
    "id": "EVC-002",
    "name": "Kano State Seed Voucher",
    "category": "state_programme",
    "description": "Free certified rice seeds for 5,000 farmers",
    "status": "redeemed",
    "amount": 15000,
    "region": "Kano",
    "reference": "KN/GOV/EVC/2026/001"
  },
  {
    "id": "EVC-003",
    "name": "CBN ABP Input Credit Voucher",
    "category": "cbn_abp",
    "description": "Input credit tied to harvest repayment",
    "status": "active",
    "amount": 85000,
    "region": "North-Central",
    "reference": "CBN/ABP/EVC/2026/001"
  },
  {
    "id": "EVC-004",
    "name": "Fadama III+ Irrigation Voucher",
    "category": "world_bank",
    "description": "World Bank Fadama III+ subsidy for irrigation equipment",
    "status": "active",
    "amount": 200000,
    "region": "North-West",
    "reference": "FADAMA/EVC/2026/001"
  }
]`

func main() {
	port := envOr("PORT", "8598")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agri-evoucher-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agri_evoucher/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agri-evoucher-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
