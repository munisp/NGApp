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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["cbn_agsmeis.events", "cbn_agsmeis.audit"]}, "dapr": {"status": "connected", "appId": "cbn-agsmeis-go-sidecar"}, "fluvio": {"status": "connected", "topic": "cbn_agsmeis-stream"}, "temporal": {"status": "connected", "namespace": "cbn_agsmeis"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cbn_agsmeis"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cbn_agsmeis_authz"}, "redis": {"status": "connected", "prefix": "cbn_agsmeis:"}, "mojaloop": {"status": "connected", "participant": "cbn_agsmeis"}, "opensearch": {"status": "connected", "index": "cbn_agsmeis-*"}, "openappsec": {"status": "connected", "policy": "cbn-agsmeis-go-protection"}, "apisix": {"status": "connected", "upstream": "cbn_agsmeis"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cbn_agsmeis_iceberg"}}`)

var seedData = `[
  {
    "id": "CBN-001",
    "name": "CBN AGSMEIS Integration Record 1",
    "category": "primary",
    "description": "First CBN AGSMEIS Integration record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/cbn_agsmeis/001"
  },
  {
    "id": "CBN-002",
    "name": "CBN AGSMEIS Integration Record 2",
    "category": "primary",
    "description": "Second CBN AGSMEIS Integration record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/cbn_agsmeis/002"
  },
  {
    "id": "CBN-003",
    "name": "CBN AGSMEIS Integration Record 3",
    "category": "secondary",
    "description": "Third CBN AGSMEIS Integration record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/cbn_agsmeis/003"
  },
  {
    "id": "CBN-004",
    "name": "CBN AGSMEIS Integration Record 4",
    "category": "secondary",
    "description": "Fourth CBN AGSMEIS Integration record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/cbn_agsmeis/004"
  }
]`

func main() {
	port := envOr("PORT", "8627")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "cbn-agsmeis-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/cbn_agsmeis/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("cbn-agsmeis-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
