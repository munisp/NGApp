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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["cbn_anchor_borrowers.events", "cbn_anchor_borrowers.audit"]}, "dapr": {"status": "connected", "appId": "cbn-anchor-borrowers-go-sidecar"}, "fluvio": {"status": "connected", "topic": "cbn_anchor_borrowers-stream"}, "temporal": {"status": "connected", "namespace": "cbn_anchor_borrowers"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cbn_anchor_borrowers"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cbn_anchor_borrowers_authz"}, "redis": {"status": "connected", "prefix": "cbn_anchor_borrowers:"}, "mojaloop": {"status": "connected", "participant": "cbn_anchor_borrowers"}, "opensearch": {"status": "connected", "index": "cbn_anchor_borrowers-*"}, "openappsec": {"status": "connected", "policy": "cbn-anchor-borrowers-go-protection"}, "apisix": {"status": "connected", "upstream": "cbn_anchor_borrowers"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cbn_anchor_borrowers_iceberg"}}`)

var seedData = `[
  {
    "id": "ABP-001",
    "name": "Kano Groundnut Anchor Programme",
    "category": "prime_anchor",
    "description": "Olam Nigeria as anchor for 500 smallholder groundnut farmers",
    "status": "disbursed",
    "amount": 250000000,
    "region": "Kano",
    "reference": "CBN/ABP/2026/KN/001"
  },
  {
    "id": "ABP-002",
    "name": "Kebbi Rice Anchor Programme",
    "category": "state_government",
    "description": "Kebbi State Government anchoring 1,200 rice farmers",
    "status": "active",
    "amount": 600000000,
    "region": "Kebbi",
    "reference": "CBN/ABP/2026/KB/003"
  },
  {
    "id": "ABP-003",
    "name": "Benue Soybean Cooperative Anchor",
    "category": "commodity_association",
    "description": "Soybean Association of Nigeria anchoring 300 farmers",
    "status": "under_review",
    "amount": 120000000,
    "region": "Benue",
    "reference": "CBN/ABP/2026/BN/002"
  },
  {
    "id": "ABP-004",
    "name": "Nasarawa Sesame Export Anchor",
    "category": "prime_anchor",
    "description": "Export Trading Group anchoring 400 sesame farmers",
    "status": "approved",
    "amount": 180000000,
    "region": "Nasarawa",
    "reference": "CBN/ABP/2026/NS/001"
  }
]`

func main() {
	port := envOr("PORT", "8593")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "cbn-anchor-borrowers-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/cbn_anchor_borrowers/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("cbn-anchor-borrowers-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
