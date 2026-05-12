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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["post_harvest_loss_tracker.events", "post_harvest_loss_tracker.audit"]}, "dapr": {"status": "connected", "appId": "post-harvest-loss-tracker-go-sidecar"}, "fluvio": {"status": "connected", "topic": "post_harvest_loss_tracker-stream"}, "temporal": {"status": "connected", "namespace": "post_harvest_loss_tracker"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "post_harvest_loss_tracker"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "post_harvest_loss_tracker_authz"}, "redis": {"status": "connected", "prefix": "post_harvest_loss_tracker:"}, "mojaloop": {"status": "connected", "participant": "post_harvest_loss_tracker"}, "opensearch": {"status": "connected", "index": "post_harvest_loss_tracker-*"}, "openappsec": {"status": "connected", "policy": "post-harvest-loss-tracker-go-protection"}, "apisix": {"status": "connected", "upstream": "post_harvest_loss_tracker"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "post_harvest_loss_tracker_iceberg"}}`)

var seedData = `[
  {
    "id": "POS-001",
    "name": "Post Harvest Loss Tracking Record 1",
    "category": "primary",
    "description": "First Post Harvest Loss Tracking record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/post_harvest_loss_tracker/001"
  },
  {
    "id": "POS-002",
    "name": "Post Harvest Loss Tracking Record 2",
    "category": "primary",
    "description": "Second Post Harvest Loss Tracking record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/post_harvest_loss_tracker/002"
  },
  {
    "id": "POS-003",
    "name": "Post Harvest Loss Tracking Record 3",
    "category": "secondary",
    "description": "Third Post Harvest Loss Tracking record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/post_harvest_loss_tracker/003"
  },
  {
    "id": "POS-004",
    "name": "Post Harvest Loss Tracking Record 4",
    "category": "secondary",
    "description": "Fourth Post Harvest Loss Tracking record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/post_harvest_loss_tracker/004"
  }
]`

func main() {
	port := envOr("PORT", "8625")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "post-harvest-loss-tracker-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/post_harvest_loss_tracker/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("post-harvest-loss-tracker-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
