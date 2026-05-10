package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8214")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "facility.created,facility.utilized,facility.limit-breached,facility.expired"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "limit-cache,utilization-tracker"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "credit_facilities,sub_facilities,collateral_links,utilization_history"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "facility-utilization"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "credit-officer,risk-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "facility:create,facility:approve,facility:utilize,facility:renew"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "facility-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "facility-changes"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "FacilityApprovalWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "disbursement-settlement"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "limit-ledger"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "facility_history,utilization_trends"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/facilities/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090"), "policy": "credit-facility-protection"},
}

type Facility struct {
	ID              string  `json:"id"`
	CustomerID      string  `json:"customerId"`
	CustomerName    string  `json:"customerName"`
	Type            string  `json:"type"`
	Limit           float64 `json:"limit"`
	Currency        string  `json:"currency"`
	Utilized        float64 `json:"utilized"`
	Available       float64 `json:"available"`
	UtilizationPct  float64 `json:"utilizationPct"`
	Status          string  `json:"status"`
	ExpiryDate      string  `json:"expiryDate"`
	SubFacilities   []SubFacility `json:"subFacilities"`
	Collaterals     []CollateralLink `json:"collaterals"`
	CollateralCoverage float64 `json:"collateralCoveragePct"`
	ApprovedBy      string  `json:"approvedBy"`
	RiskRating      string  `json:"riskRating"`
}

type SubFacility struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Limit    float64 `json:"limit"`
	Utilized float64 `json:"utilized"`
	Accounts []string `json:"linkedAccounts"`
}

type CollateralLink struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Description string  `json:"description"`
	MarketValue float64 `json:"marketValue"`
	FSV         float64 `json:"forcedSaleValue"`
	Haircut     float64 `json:"haircutPct"`
}

var (
	facilities []Facility
	mu         sync.RWMutex
)

func init() {
	facilities = []Facility{
		{ID: "FAC-001", CustomerID: "CIF-001", CustomerName: "Dangote Industries Ltd", Type: "revolving", Limit: 50000000000, Currency: "NGN", Utilized: 32000000000, Available: 18000000000, UtilizationPct: 64.0, Status: "active", ExpiryDate: "2027-03-31", ApprovedBy: "chief-risk-officer", RiskRating: "A+",
			SubFacilities: []SubFacility{
				{ID: "SUB-001a", Type: "working-capital", Limit: 25000000000, Utilized: 18000000000, Accounts: []string{"LN-DAN-001", "LN-DAN-002"}},
				{ID: "SUB-001b", Type: "trade-finance-lc", Limit: 15000000000, Utilized: 9000000000, Accounts: []string{"LC-DAN-001"}},
				{ID: "SUB-001c", Type: "bank-guarantee", Limit: 10000000000, Utilized: 5000000000, Accounts: []string{"BG-DAN-001"}},
			},
			Collaterals: []CollateralLink{
				{ID: "COL-001a", Type: "property", Description: "Factory complex, Apapa", MarketValue: 35000000000, FSV: 24500000000, Haircut: 30},
				{ID: "COL-001b", Type: "inventory", Description: "Cement stock (rotating)", MarketValue: 15000000000, FSV: 9000000000, Haircut: 40},
			},
			CollateralCoverage: 67.0,
		},
		{ID: "FAC-002", CustomerID: "CIF-002", CustomerName: "BUA Group", Type: "non-revolving", Limit: 25000000000, Currency: "NGN", Utilized: 20000000000, Available: 5000000000, UtilizationPct: 80.0, Status: "active", ExpiryDate: "2027-12-31", ApprovedBy: "md-ceo", RiskRating: "A",
			SubFacilities: []SubFacility{
				{ID: "SUB-002a", Type: "term-loan", Limit: 20000000000, Utilized: 20000000000, Accounts: []string{"LN-BUA-001"}},
				{ID: "SUB-002b", Type: "overdraft", Limit: 5000000000, Utilized: 0, Accounts: []string{"OD-BUA-001"}},
			},
			Collaterals: []CollateralLink{
				{ID: "COL-002a", Type: "property", Description: "Sugar refinery, Port Harcourt", MarketValue: 28000000000, FSV: 19600000000, Haircut: 30},
				{ID: "COL-002b", Type: "equipment", Description: "Production machinery", MarketValue: 8000000000, FSV: 4000000000, Haircut: 50},
			},
			CollateralCoverage: 94.4,
		},
		{ID: "FAC-003", CustomerID: "CIF-003", CustomerName: "Zenith Plastics Nig Ltd", Type: "revolving", Limit: 500000000, Currency: "NGN", Utilized: 480000000, Available: 20000000, UtilizationPct: 96.0, Status: "near-breach", ExpiryDate: "2026-09-30", ApprovedBy: "regional-head-lagos", RiskRating: "BB",
			SubFacilities: []SubFacility{
				{ID: "SUB-003a", Type: "invoice-discounting", Limit: 300000000, Utilized: 290000000, Accounts: []string{"LN-ZP-001"}},
				{ID: "SUB-003b", Type: "overdraft", Limit: 200000000, Utilized: 190000000, Accounts: []string{"OD-ZP-001"}},
			},
			Collaterals: []CollateralLink{
				{ID: "COL-003a", Type: "debenture", Description: "Fixed/floating charge over assets", MarketValue: 350000000, FSV: 210000000, Haircut: 40},
			},
			CollateralCoverage: 42.0,
		},
		{ID: "FAC-004", CustomerID: "CIF-004", CustomerName: "Alhaji Musa Trading Co", Type: "revolving", Limit: 100000000, Currency: "NGN", Utilized: 105000000, Available: -5000000, UtilizationPct: 105.0, Status: "breached", ExpiryDate: "2026-06-30", ApprovedBy: "branch-manager-kano", RiskRating: "CCC",
			SubFacilities: []SubFacility{
				{ID: "SUB-004a", Type: "overdraft", Limit: 100000000, Utilized: 105000000, Accounts: []string{"OD-AMT-001"}},
			},
			Collaterals: []CollateralLink{
				{ID: "COL-004a", Type: "vehicle", Description: "Fleet of 12 trucks", MarketValue: 60000000, FSV: 30000000, Haircut: 50},
			},
			CollateralCoverage: 28.6,
		},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "credit-facility")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "credit-facility",
			"facilities": map[string]int{"total": len(facilities), "breached": 1, "nearBreach": 1},
			"middleware": middlewareConfig,
		})
	})

	mux.HandleFunc("/v1/facilities", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		jsonResponse(w, 200, map[string]interface{}{"items": facilities, "total": len(facilities)})
	})

	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		totalLimit := 0.0
		totalUtilized := 0.0
		breached := 0
		nearBreach := 0
		for _, f := range facilities {
			totalLimit += f.Limit
			totalUtilized += f.Utilized
			if f.Status == "breached" { breached++ }
			if f.Status == "near-breach" { nearBreach++ }
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalFacilities": len(facilities), "totalLimit": totalLimit,
			"totalUtilized": totalUtilized, "totalAvailable": totalLimit - totalUtilized,
			"avgUtilization": (totalUtilized / totalLimit) * 100,
			"breached": breached, "nearBreach": nearBreach,
			"byType": map[string]int{"revolving": 3, "non-revolving": 1},
		})
	})

	mux.HandleFunc("/v1/facilities/", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Path[len("/v1/facilities/"):]
		mu.RLock()
		defer mu.RUnlock()
		for _, f := range facilities {
			if f.ID == id {
				jsonResponse(w, 200, f)
				return
			}
		}
		jsonResponse(w, 404, map[string]string{"error": "Facility not found"})
	})

	log.Printf("[credit-facility] Listening on :%s with %d facilities\n", port, len(facilities))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
