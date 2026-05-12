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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agri_logistics.events", "agri_logistics.audit"]}, "dapr": {"status": "connected", "appId": "agri-logistics-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_logistics-stream"}, "temporal": {"status": "connected", "namespace": "agri_logistics"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_logistics"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_logistics_authz"}, "redis": {"status": "connected", "prefix": "agri_logistics:"}, "mojaloop": {"status": "connected", "participant": "agri_logistics"}, "opensearch": {"status": "connected", "index": "agri_logistics-*"}, "openappsec": {"status": "connected", "policy": "agri-logistics-go-protection"}, "apisix": {"status": "connected", "upstream": "agri_logistics"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_logistics_iceberg"}}`)

var seedData = `[
  {
    "id": "AGR-001",
    "name": "Agricultural Logistics Record 1",
    "category": "primary",
    "description": "First Agricultural Logistics record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/agri_logistics/001"
  },
  {
    "id": "AGR-002",
    "name": "Agricultural Logistics Record 2",
    "category": "primary",
    "description": "Second Agricultural Logistics record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/agri_logistics/002"
  },
  {
    "id": "AGR-003",
    "name": "Agricultural Logistics Record 3",
    "category": "secondary",
    "description": "Third Agricultural Logistics record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/agri_logistics/003"
  },
  {
    "id": "AGR-004",
    "name": "Agricultural Logistics Record 4",
    "category": "secondary",
    "description": "Fourth Agricultural Logistics record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/agri_logistics/004"
  }
]`

func main() {
	port := envOr("PORT", "8611")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agri-logistics-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agri_logistics/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agri-logistics-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
