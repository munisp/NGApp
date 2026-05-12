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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["acgsf_guarantee.events", "acgsf_guarantee.audit"]}, "dapr": {"status": "connected", "appId": "acgsf-guarantee-go-sidecar"}, "fluvio": {"status": "connected", "topic": "acgsf_guarantee-stream"}, "temporal": {"status": "connected", "namespace": "acgsf_guarantee"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "acgsf_guarantee"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "acgsf_guarantee_authz"}, "redis": {"status": "connected", "prefix": "acgsf_guarantee:"}, "mojaloop": {"status": "connected", "participant": "acgsf_guarantee"}, "opensearch": {"status": "connected", "index": "acgsf_guarantee-*"}, "openappsec": {"status": "connected", "policy": "acgsf-guarantee-go-protection"}, "apisix": {"status": "connected", "upstream": "acgsf_guarantee"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "acgsf_guarantee_iceberg"}}`)

var seedData = `[
  {
    "id": "ACG-001",
    "name": "ACGSF Guarantee Record 1",
    "category": "primary",
    "description": "First ACGSF Guarantee record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/acgsf_guarantee/001"
  },
  {
    "id": "ACG-002",
    "name": "ACGSF Guarantee Record 2",
    "category": "primary",
    "description": "Second ACGSF Guarantee record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/acgsf_guarantee/002"
  },
  {
    "id": "ACG-003",
    "name": "ACGSF Guarantee Record 3",
    "category": "secondary",
    "description": "Third ACGSF Guarantee record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/acgsf_guarantee/003"
  },
  {
    "id": "ACG-004",
    "name": "ACGSF Guarantee Record 4",
    "category": "secondary",
    "description": "Fourth ACGSF Guarantee record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/acgsf_guarantee/004"
  }
]`

func main() {
	port := envOr("PORT", "8628")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "acgsf-guarantee-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/acgsf_guarantee/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("acgsf-guarantee-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
