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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agri_input_marketplace.events", "agri_input_marketplace.audit"]}, "dapr": {"status": "connected", "appId": "agri-input-marketplace-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_input_marketplace-stream"}, "temporal": {"status": "connected", "namespace": "agri_input_marketplace"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_input_marketplace"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_input_marketplace_authz"}, "redis": {"status": "connected", "prefix": "agri_input_marketplace:"}, "mojaloop": {"status": "connected", "participant": "agri_input_marketplace"}, "opensearch": {"status": "connected", "index": "agri_input_marketplace-*"}, "openappsec": {"status": "connected", "policy": "agri-input-marketplace-go-protection"}, "apisix": {"status": "connected", "upstream": "agri_input_marketplace"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_input_marketplace_iceberg"}}`)

var seedData = `[
  {
    "id": "INP-001",
    "name": "NPK 15-15-15 Fertilizer (50kg)",
    "category": "fertilizer",
    "description": "Premium compound fertilizer for cereal crops",
    "status": "available",
    "amount": 22000,
    "region": "nationwide",
    "reference": "FMARD/2026/FRT/001"
  },
  {
    "id": "INP-002",
    "name": "WACOT Rice Seedlings (Faro 44)",
    "category": "seed",
    "description": "Certified improved rice variety for lowland cultivation",
    "status": "available",
    "amount": 15000,
    "region": "North-Central",
    "reference": "NASC/2026/RICE/044"
  },
  {
    "id": "INP-003",
    "name": "Glyphosate Herbicide (5L)",
    "category": "agrochemical",
    "description": "Non-selective systemic herbicide for land preparation",
    "status": "available",
    "amount": 8500,
    "region": "nationwide",
    "reference": "NAFDAC/2026/AGR/112"
  },
  {
    "id": "INP-004",
    "name": "Solar-Powered Irrigation Pump Kit",
    "category": "equipment",
    "description": "2HP solar pump with 50m drip irrigation lines",
    "status": "available",
    "amount": 450000,
    "region": "nationwide",
    "reference": "SON/2026/AGR/078"
  },
  {
    "id": "INP-005",
    "name": "Maize Hybrid Seed (SAMMAZ 15)",
    "category": "seed",
    "description": "Drought-tolerant maize variety by IAR Zaria",
    "status": "available",
    "amount": 12000,
    "region": "North-West",
    "reference": "NASC/2026/MZ/015"
  }
]`

func main() {
	port := envOr("PORT", "8591")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agri-input-marketplace-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agri_input_marketplace/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agri-input-marketplace-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
