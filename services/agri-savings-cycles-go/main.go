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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["agri_savings_cycles.events", "agri_savings_cycles.audit"]}, "dapr": {"status": "connected", "appId": "agri-savings-cycles-go-sidecar"}, "fluvio": {"status": "connected", "topic": "agri_savings_cycles-stream"}, "temporal": {"status": "connected", "namespace": "agri_savings_cycles"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "agri_savings_cycles"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "agri_savings_cycles_authz"}, "redis": {"status": "connected", "prefix": "agri_savings_cycles:"}, "mojaloop": {"status": "connected", "participant": "agri_savings_cycles"}, "opensearch": {"status": "connected", "index": "agri_savings_cycles-*"}, "openappsec": {"status": "connected", "policy": "agri-savings-cycles-go-protection"}, "apisix": {"status": "connected", "upstream": "agri_savings_cycles"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "agri_savings_cycles_iceberg"}}`)

var seedData = `[
  {
    "id": "VSL-001",
    "name": "Iya Oloja Market Women VSLA Cycle 3",
    "category": "vsla",
    "description": "Weekly N5,000 contribution, 25 members, 12-month cycle",
    "status": "active",
    "amount": 6500000,
    "region": "Lagos",
    "reference": "VSLA/2026/LG/001"
  },
  {
    "id": "VSL-002",
    "name": "Kano Farmers Rotating Savings",
    "category": "rosca",
    "description": "Monthly N20,000, 15 members, rotating payout",
    "status": "active",
    "amount": 3600000,
    "region": "Kano",
    "reference": "ROSCA/2026/KN/001"
  },
  {
    "id": "VSL-003",
    "name": "Benue Rice Growers Emergency Fund",
    "category": "emergency_fund",
    "description": "5% of weekly contributions, 300 members",
    "status": "active",
    "amount": 2400000,
    "region": "Benue",
    "reference": "EMG/2026/BN/001"
  },
  {
    "id": "VSL-004",
    "name": "Oyo Cassava Cooperative Thrift",
    "category": "thrift",
    "description": "Daily N500 collection by agent, 200 members",
    "status": "active",
    "amount": 9000000,
    "region": "Oyo",
    "reference": "THR/2026/OY/001"
  }
]`

func main() {
	port := envOr("PORT", "8595")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "agri-savings-cycles-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/agri_savings_cycles/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("agri-savings-cycles-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
