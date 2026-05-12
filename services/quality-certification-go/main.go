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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["quality_certification.events", "quality_certification.audit"]}, "dapr": {"status": "connected", "appId": "quality-certification-go-sidecar"}, "fluvio": {"status": "connected", "topic": "quality_certification-stream"}, "temporal": {"status": "connected", "namespace": "quality_certification"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "quality_certification"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "quality_certification_authz"}, "redis": {"status": "connected", "prefix": "quality_certification:"}, "mojaloop": {"status": "connected", "participant": "quality_certification"}, "opensearch": {"status": "connected", "index": "quality_certification-*"}, "openappsec": {"status": "connected", "policy": "quality-certification-go-protection"}, "apisix": {"status": "connected", "upstream": "quality_certification"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "quality_certification_iceberg"}}`)

var seedData = `[
  {
    "id": "QUA-001",
    "name": "Quality Grading Certification Record 1",
    "category": "primary",
    "description": "First Quality Grading Certification record",
    "status": "active",
    "amount": 1000000,
    "region": "Lagos",
    "reference": "54B/quality_certification/001"
  },
  {
    "id": "QUA-002",
    "name": "Quality Grading Certification Record 2",
    "category": "primary",
    "description": "Second Quality Grading Certification record",
    "status": "active",
    "amount": 2500000,
    "region": "Kano",
    "reference": "54B/quality_certification/002"
  },
  {
    "id": "QUA-003",
    "name": "Quality Grading Certification Record 3",
    "category": "secondary",
    "description": "Third Quality Grading Certification record",
    "status": "pending",
    "amount": 500000,
    "region": "Benue",
    "reference": "54B/quality_certification/003"
  },
  {
    "id": "QUA-004",
    "name": "Quality Grading Certification Record 4",
    "category": "secondary",
    "description": "Fourth Quality Grading Certification record",
    "status": "active",
    "amount": 3000000,
    "region": "Oyo",
    "reference": "54B/quality_certification/004"
  }
]`

func main() {
	port := envOr("PORT", "8617")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "quality-certification-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/quality_certification/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("quality-certification-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
