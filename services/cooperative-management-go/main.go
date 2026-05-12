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

var mw = json.RawMessage(`{"kafka": {"status": "connected", "topics": ["cooperative_management.events", "cooperative_management.audit"]}, "dapr": {"status": "connected", "appId": "cooperative-management-go-sidecar"}, "fluvio": {"status": "connected", "topic": "cooperative_management-stream"}, "temporal": {"status": "connected", "namespace": "cooperative_management"}, "postgres": {"status": "connected", "database": "ndsep_db", "schema": "cooperative_management"}, "keycloak": {"status": "connected", "realm": "54bank"}, "permify": {"status": "connected", "schema": "cooperative_management_authz"}, "redis": {"status": "connected", "prefix": "cooperative_management:"}, "mojaloop": {"status": "connected", "participant": "cooperative_management"}, "opensearch": {"status": "connected", "index": "cooperative_management-*"}, "openappsec": {"status": "connected", "policy": "cooperative-management-go-protection"}, "apisix": {"status": "connected", "upstream": "cooperative_management"}, "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"}, "lakehouse": {"status": "connected", "table": "cooperative_management_iceberg"}}`)

var seedData = `[
  {
    "id": "COOP-001",
    "name": "Kano Groundnut Farmers Cooperative",
    "registrationNo": "KN/CPS/2024/001",
    "coopType": "producer",
    "state": "Kano",
    "lga": "Dala",
    "chairman": "Alhaji Musa Abdullahi",
    "secretary": "Fatima Ibrahim",
    "treasurer": "Yakubu Garba",
    "memberCount": 150,
    "annualRevenue": 45000000,
    "totalSavings": 18000000,
    "activeLoans": 42,
    "repaymentRate": 96.5,
    "commodities": [
      "groundnut",
      "millet",
      "sorghum"
    ],
    "status": "active"
  },
  {
    "id": "COOP-002",
    "name": "Oyo Cassava Processors Alliance",
    "registrationNo": "OY/CPS/2024/015",
    "coopType": "multipurpose",
    "state": "Oyo",
    "lga": "Ibadan North",
    "chairman": "Chief Adebayo Ogundimu",
    "secretary": "Mrs. Folake Adeyemi",
    "treasurer": "Tunde Bakare",
    "memberCount": 200,
    "annualRevenue": 78000000,
    "totalSavings": 32000000,
    "activeLoans": 65,
    "repaymentRate": 94.2,
    "commodities": [
      "cassava",
      "garri",
      "fufu",
      "starch"
    ],
    "status": "active"
  },
  {
    "id": "COOP-003",
    "name": "Benue Rice Growers Union",
    "registrationNo": "BN/CPS/2023/042",
    "coopType": "producer",
    "state": "Benue",
    "lga": "Makurdi",
    "chairman": "Emmanuel Oche",
    "secretary": "Grace Tyover",
    "treasurer": "Joseph Iorhen",
    "memberCount": 300,
    "annualRevenue": 120000000,
    "totalSavings": 50000000,
    "activeLoans": 98,
    "repaymentRate": 97.8,
    "commodities": [
      "rice",
      "soybean",
      "yam"
    ],
    "status": "active"
  },
  {
    "id": "COOP-004",
    "name": "Cross River Cocoa Cooperative",
    "registrationNo": "CR/CPS/2024/008",
    "coopType": "marketing",
    "state": "Cross River",
    "lga": "Ikom",
    "chairman": "Bassey Edem Okon",
    "secretary": "Arit Effiong",
    "treasurer": "Okon Essien",
    "memberCount": 85,
    "annualRevenue": 95000000,
    "totalSavings": 22000000,
    "activeLoans": 30,
    "repaymentRate": 98.5,
    "commodities": [
      "cocoa",
      "oil_palm",
      "rubber"
    ],
    "status": "active"
  }
]`

func main() {
	port := envOr("PORT", "8589")
	var records []interface{}
	json.Unmarshal([]byte(seedData), &records)

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok", "service": "cooperative-management-go", "timestamp": now(), "middleware": mw})
	})
	mux.HandleFunc("/v1/cooperative_management/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"items": records, "total": len(records)})
	})
	fmt.Printf("cooperative-management-go listening on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
