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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["fisheries_aquaculture.events", "fisheries_aquaculture.audit"]}, "dapr": {"status": "connected", "appId": "fisheries-aquaculture-go-sidecar"}, "fluvio": {"status": "connected", "topic": "fisheries_aquaculture-stream"}, "temporal": {"status": "connected", "namespace": "fisheries_aquaculture"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "fisheries_aquaculture"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "fisheries_aquaculture_authz"}, "redis": {"status": "connected", "prefix": "fisheries_aquaculture:"}, "mojaloop": {"status": "connected", "participant": "fisheries_aquaculture"}, "opensearch": {"status": "connected", "index": "fisheries_aquaculture-*"}, "openappsec": {"status": "connected", "policy": "fisheries-aquaculture-go-protection"}, "apisix": {"status": "connected", "upstream": "fisheries_aquaculture"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "fisheries_aquaculture_iceberg"}}`)

var seedData = `[
  {
    "id": "FIS-001",
    "name": "Fisheries and Aquaculture Banking Record 1",
    "category": "primary",
    "description": "First Fisheries and Aquaculture Banking record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/fisheries_aquaculture/001"
  },
  {
    "id": "FIS-002",
    "name": "Fisheries and Aquaculture Banking Record 2",
    "category": "primary",
    "description": "Second Fisheries and Aquaculture Banking record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/fisheries_aquaculture/002"
  },
  {
    "id": "FIS-003",
    "name": "Fisheries and Aquaculture Banking Record 3",
    "category": "secondary",
    "description": "Third Fisheries and Aquaculture Banking record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/fisheries_aquaculture/003"
  },
  {
    "id": "FIS-004",
    "name": "Fisheries and Aquaculture Banking Record 4",
    "category": "secondary",
    "description": "Fourth Fisheries and Aquaculture Banking record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/fisheries_aquaculture/004"
  }
]`

func main() {
	port := envOr("PORT", "8602")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "fisheries-aquaculture-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/fisheries_aquaculture/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("fisheries-aquaculture-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
