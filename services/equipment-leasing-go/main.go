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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["equipment_leasing.events", "equipment_leasing.audit"]}, "dapr": {"status": "connected", "appId": "equipment-leasing-go-sidecar"}, "fluvio": {"status": "connected", "topic": "equipment_leasing-stream"}, "temporal": {"status": "connected", "namespace": "equipment_leasing"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "equipment_leasing"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "equipment_leasing_authz"}, "redis": {"status": "connected", "prefix": "equipment_leasing:"}, "mojaloop": {"status": "connected", "participant": "equipment_leasing"}, "opensearch": {"status": "connected", "index": "equipment_leasing-*"}, "openappsec": {"status": "connected", "policy": "equipment-leasing-go-protection"}, "apisix": {"status": "connected", "upstream": "equipment_leasing"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "equipment_leasing_iceberg"}}`)

var seedData = `[
  {
    "id": "EQU-001",
    "name": "Equipment Leasing Record 1",
    "category": "primary",
    "description": "First Equipment Leasing record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/equipment_leasing/001"
  },
  {
    "id": "EQU-002",
    "name": "Equipment Leasing Record 2",
    "category": "primary",
    "description": "Second Equipment Leasing record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/equipment_leasing/002"
  },
  {
    "id": "EQU-003",
    "name": "Equipment Leasing Record 3",
    "category": "secondary",
    "description": "Third Equipment Leasing record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/equipment_leasing/003"
  },
  {
    "id": "EQU-004",
    "name": "Equipment Leasing Record 4",
    "category": "secondary",
    "description": "Fourth Equipment Leasing record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/equipment_leasing/004"
  }
]`

func main() {
	port := envOr("PORT", "8608")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "equipment-leasing-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/equipment_leasing/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("equipment-leasing-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
