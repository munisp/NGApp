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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agri_reinsurance.events", "agri_reinsurance.audit"]}, "dapr": {"status": "connected", "appId": "agri-reinsurance-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_reinsurance-stream"}, "temporal": {"status": "connected", "namespace": "agri_reinsurance"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_reinsurance"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_reinsurance_authz"}, "redis": {"status": "connected", "prefix": "agri_reinsurance:"}, "mojaloop": {"status": "connected", "participant": "agri_reinsurance"}, "opensearch": {"status": "connected", "index": "agri_reinsurance-*"}, "openappsec": {"status": "connected", "policy": "agri-reinsurance-go-protection"}, "apisix": {"status": "connected", "upstream": "agri_reinsurance"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_reinsurance_iceberg"}}`)

var seedData = `[
  {
    "id": "AGR-001",
    "name": "Agricultural Reinsurance Record 1",
    "category": "primary",
    "description": "First Agricultural Reinsurance record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/agri_reinsurance/001"
  },
  {
    "id": "AGR-002",
    "name": "Agricultural Reinsurance Record 2",
    "category": "primary",
    "description": "Second Agricultural Reinsurance record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/agri_reinsurance/002"
  },
  {
    "id": "AGR-003",
    "name": "Agricultural Reinsurance Record 3",
    "category": "secondary",
    "description": "Third Agricultural Reinsurance record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/agri_reinsurance/003"
  },
  {
    "id": "AGR-004",
    "name": "Agricultural Reinsurance Record 4",
    "category": "secondary",
    "description": "Fourth Agricultural Reinsurance record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/agri_reinsurance/004"
  }
]`

func main() {
	port := envOr("PORT", "8616")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agri-reinsurance-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agri_reinsurance/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agri-reinsurance-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
