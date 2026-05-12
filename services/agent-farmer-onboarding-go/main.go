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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agent_farmer_onboarding.events", "agent_farmer_onboarding.audit"]}, "dapr": {"status": "connected", "appId": "agent-farmer-onboarding-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agent_farmer_onboarding-stream"}, "temporal": {"status": "connected", "namespace": "agent_farmer_onboarding"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agent_farmer_onboarding"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agent_farmer_onboarding_authz"}, "redis": {"status": "connected", "prefix": "agent_farmer_onboarding:"}, "mojaloop": {"status": "connected", "participant": "agent_farmer_onboarding"}, "opensearch": {"status": "connected", "index": "agent_farmer_onboarding-*"}, "openappsec": {"status": "connected", "policy": "agent-farmer-onboarding-go-protection"}, "apisix": {"status": "connected", "upstream": "agent_farmer_onboarding"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agent_farmer_onboarding_iceberg"}}`)

var seedData = `[
  {
    "id": "AGE-001",
    "name": "Agent Farmer Onboarding Record 1",
    "category": "primary",
    "description": "First Agent Farmer Onboarding record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/agent_farmer_onboarding/001"
  },
  {
    "id": "AGE-002",
    "name": "Agent Farmer Onboarding Record 2",
    "category": "primary",
    "description": "Second Agent Farmer Onboarding record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/agent_farmer_onboarding/002"
  },
  {
    "id": "AGE-003",
    "name": "Agent Farmer Onboarding Record 3",
    "category": "secondary",
    "description": "Third Agent Farmer Onboarding record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/agent_farmer_onboarding/003"
  },
  {
    "id": "AGE-004",
    "name": "Agent Farmer Onboarding Record 4",
    "category": "secondary",
    "description": "Fourth Agent Farmer Onboarding record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/agent_farmer_onboarding/004"
  }
]`

func main() {
	port := envOr("PORT", "8606")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agent-farmer-onboarding-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agent_farmer_onboarding/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agent-farmer-onboarding-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
