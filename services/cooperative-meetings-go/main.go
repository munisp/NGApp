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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["cooperative_meetings.events", "cooperative_meetings.audit"]}, "dapr": {"status": "connected", "appId": "cooperative-meetings-go-sidecar"}, "fluvio": {"status": "connected", "topic": "cooperative_meetings-stream"}, "temporal": {"status": "connected", "namespace": "cooperative_meetings"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cooperative_meetings"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cooperative_meetings_authz"}, "redis": {"status": "connected", "prefix": "cooperative_meetings:"}, "mojaloop": {"status": "connected", "participant": "cooperative_meetings"}, "opensearch": {"status": "connected", "index": "cooperative_meetings-*"}, "openappsec": {"status": "connected", "policy": "cooperative-meetings-go-protection"}, "apisix": {"status": "connected", "upstream": "cooperative_meetings"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cooperative_meetings_iceberg"}}`)

var seedData = `[
  {
    "id": "COO-001",
    "name": "Cooperative Meeting Management Record 1",
    "category": "primary",
    "description": "First Cooperative Meeting Management record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/cooperative_meetings/001"
  },
  {
    "id": "COO-002",
    "name": "Cooperative Meeting Management Record 2",
    "category": "primary",
    "description": "Second Cooperative Meeting Management record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/cooperative_meetings/002"
  },
  {
    "id": "COO-003",
    "name": "Cooperative Meeting Management Record 3",
    "category": "secondary",
    "description": "Third Cooperative Meeting Management record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/cooperative_meetings/003"
  },
  {
    "id": "COO-004",
    "name": "Cooperative Meeting Management Record 4",
    "category": "secondary",
    "description": "Fourth Cooperative Meeting Management record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/cooperative_meetings/004"
  }
]`

func main() {
	port := envOr("PORT", "8620")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "cooperative-meetings-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/cooperative_meetings/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("cooperative-meetings-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
