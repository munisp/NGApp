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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["nirsal_agro_geocoop.events", "nirsal_agro_geocoop.audit"]}, "dapr": {"status": "connected", "appId": "nirsal-agro-geocoop-go-sidecar"}, "fluvio": {"status": "connected", "topic": "nirsal_agro_geocoop-stream"}, "temporal": {"status": "connected", "namespace": "nirsal_agro_geocoop"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "nirsal_agro_geocoop"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "nirsal_agro_geocoop_authz"}, "redis": {"status": "connected", "prefix": "nirsal_agro_geocoop:"}, "mojaloop": {"status": "connected", "participant": "nirsal_agro_geocoop"}, "opensearch": {"status": "connected", "index": "nirsal_agro_geocoop-*"}, "openappsec": {"status": "connected", "policy": "nirsal-agro-geocoop-go-protection"}, "apisix": {"status": "connected", "upstream": "nirsal_agro_geocoop"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "nirsal_agro_geocoop_iceberg"}}`)

var seedData = `[
  {
    "id": "NIR-001",
    "name": "NIRSAL Agro Geo-Cooperative Record 1",
    "category": "primary",
    "description": "First NIRSAL Agro Geo-Cooperative record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/nirsal_agro_geocoop/001"
  },
  {
    "id": "NIR-002",
    "name": "NIRSAL Agro Geo-Cooperative Record 2",
    "category": "primary",
    "description": "Second NIRSAL Agro Geo-Cooperative record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/nirsal_agro_geocoop/002"
  },
  {
    "id": "NIR-003",
    "name": "NIRSAL Agro Geo-Cooperative Record 3",
    "category": "secondary",
    "description": "Third NIRSAL Agro Geo-Cooperative record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/nirsal_agro_geocoop/003"
  },
  {
    "id": "NIR-004",
    "name": "NIRSAL Agro Geo-Cooperative Record 4",
    "category": "secondary",
    "description": "Fourth NIRSAL Agro Geo-Cooperative record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/nirsal_agro_geocoop/004"
  }
]`

func main() {
	port := envOr("PORT", "8614")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "nirsal-agro-geocoop-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/nirsal_agro_geocoop/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("nirsal-agro-geocoop-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
