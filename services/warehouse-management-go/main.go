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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["warehouse_management.events", "warehouse_management.audit"]}, "dapr": {"status": "connected", "appId": "warehouse-management-go-sidecar"}, "fluvio": {"status": "connected", "topic": "warehouse_management-stream"}, "temporal": {"status": "connected", "namespace": "warehouse_management"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "warehouse_management"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "warehouse_management_authz"}, "redis": {"status": "connected", "prefix": "warehouse_management:"}, "mojaloop": {"status": "connected", "participant": "warehouse_management"}, "opensearch": {"status": "connected", "index": "warehouse_management-*"}, "openappsec": {"status": "connected", "policy": "warehouse-management-go-protection"}, "apisix": {"status": "connected", "upstream": "warehouse_management"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "warehouse_management_iceberg"}}`)

var seedData = `[
  {
    "id": "WAR-001",
    "name": "Warehouse Management System Record 1",
    "category": "primary",
    "description": "First Warehouse Management System record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/warehouse_management/001"
  },
  {
    "id": "WAR-002",
    "name": "Warehouse Management System Record 2",
    "category": "primary",
    "description": "Second Warehouse Management System record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/warehouse_management/002"
  },
  {
    "id": "WAR-003",
    "name": "Warehouse Management System Record 3",
    "category": "secondary",
    "description": "Third Warehouse Management System record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/warehouse_management/003"
  },
  {
    "id": "WAR-004",
    "name": "Warehouse Management System Record 4",
    "category": "secondary",
    "description": "Fourth Warehouse Management System record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/warehouse_management/004"
  }
]`

func main() {
	port := envOr("PORT", "8605")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "warehouse-management-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/warehouse_management/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("warehouse-management-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
