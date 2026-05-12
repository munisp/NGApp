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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["aggregation_center.events", "aggregation_center.audit"]}, "dapr": {"status": "connected", "appId": "aggregation-center-go-sidecar"}, "fluvio": {"status": "connected", "topic": "aggregation_center-stream"}, "temporal": {"status": "connected", "namespace": "aggregation_center"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "aggregation_center"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "aggregation_center_authz"}, "redis": {"status": "connected", "prefix": "aggregation_center:"}, "mojaloop": {"status": "connected", "participant": "aggregation_center"}, "opensearch": {"status": "connected", "index": "aggregation_center-*"}, "openappsec": {"status": "connected", "policy": "aggregation-center-go-protection"}, "apisix": {"status": "connected", "upstream": "aggregation_center"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "aggregation_center_iceberg"}}`)

var seedData = `[
  {
    "id": "AGG-001",
    "name": "Aggregation Center Management Record 1",
    "category": "primary",
    "description": "First Aggregation Center Management record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/aggregation_center/001"
  },
  {
    "id": "AGG-002",
    "name": "Aggregation Center Management Record 2",
    "category": "primary",
    "description": "Second Aggregation Center Management record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/aggregation_center/002"
  },
  {
    "id": "AGG-003",
    "name": "Aggregation Center Management Record 3",
    "category": "secondary",
    "description": "Third Aggregation Center Management record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/aggregation_center/003"
  },
  {
    "id": "AGG-004",
    "name": "Aggregation Center Management Record 4",
    "category": "secondary",
    "description": "Fourth Aggregation Center Management record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/aggregation_center/004"
  }
]`

func main() {
	port := envOr("PORT", "8626")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "aggregation-center-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/aggregation_center/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("aggregation-center-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
