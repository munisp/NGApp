package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
)

var port = getEnv("PORT", "8221")

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": getEnv("KAFKA_BROKER", "localhost:9092"), "topics": "mandate.created,mandate.activated,mandate.executed,mandate.cancelled"},
	"redis":       map[string]string{"url": getEnv("REDIS_URL", "redis://localhost:6379"), "purpose": "mandate-cache,execution-tracker"},
	"postgres":    map[string]string{"url": getEnv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": "mandates,mandate_executions,mandate_disputes"},
	"opensearch":  map[string]string{"url": getEnv("OPENSEARCH_URL", "http://localhost:9200"), "index": "mandate-history"},
	"keycloak":    map[string]string{"url": getEnv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "role": "operations-officer"},
	"permify":     map[string]string{"url": getEnv("PERMIFY_URL", "http://localhost:3476"), "schema": "mandate:create,mandate:activate,mandate:cancel,mandate:dispute"},
	"dapr":        map[string]string{"url": getEnv("DAPR_URL", "http://localhost:3500"), "pubsub": "mandate-events"},
	"fluvio":      map[string]string{"url": getEnv("FLUVIO_URL", "localhost:9003"), "topic": "mandate-executions"},
	"temporal":    map[string]string{"url": getEnv("TEMPORAL_URL", "localhost:7233"), "workflow": "MandateExecutionWorkflow"},
	"mojaloop":    map[string]string{"url": getEnv("MOJALOOP_URL", "http://localhost:4000"), "purpose": "nibss-mandate-sync"},
	"tigerbeetle": map[string]string{"url": getEnv("TIGERBEETLE_URL", "localhost:3000"), "purpose": "mandate-debit-ledger"},
	"lakehouse":   map[string]string{"url": getEnv("LAKEHOUSE_URL", "http://localhost:8206"), "tables": "mandate_analytics"},
	"apisix":      map[string]string{"url": getEnv("APISIX_URL", "http://localhost:9080"), "route": "/mandates/*"},
	"openappsec":  map[string]string{"url": getEnv("OPENAPPSEC_URL", "http://localhost:8090")},
}

type Mandate struct {
	ID           string  `json:"id"`
	AccountNo    string  `json:"accountNumber"`
	AccountName  string  `json:"accountName"`
	Beneficiary  string  `json:"beneficiary"`
	MandateRef   string  `json:"nibssMandateRef"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	Frequency    string  `json:"frequency"`
	Status       string  `json:"status"`
	StartDate    string  `json:"startDate"`
	EndDate      string  `json:"endDate"`
	NextExec     string  `json:"nextExecutionDate"`
	TotalExec    int     `json:"totalExecutions"`
	TotalDebited float64 `json:"totalDebited"`
}

var (
	mandates []Mandate
	mu       sync.RWMutex
)

func init() {
	mandates = []Mandate{
		{ID: "MND-001", AccountNo: "0012345678", AccountName: "Adebayo Olumide", Beneficiary: "DSTV Nigeria", MandateRef: "NIBSS-DD-001234", Type: "direct-debit", Amount: 29800, Currency: "NGN", Frequency: "monthly", Status: "active", StartDate: "2025-01-15", EndDate: "2027-01-15", NextExec: "2026-06-15", TotalExec: 16, TotalDebited: 476800},
		{ID: "MND-002", AccountNo: "0012345678", AccountName: "Adebayo Olumide", Beneficiary: "Ikeja Electric", MandateRef: "NIBSS-DD-005678", Type: "direct-debit", Amount: 0, Currency: "NGN", Frequency: "monthly", Status: "active", StartDate: "2025-06-01", EndDate: "2027-06-01", NextExec: "2026-06-01", TotalExec: 11, TotalDebited: 385000},
		{ID: "MND-003", AccountNo: "0098765432", AccountName: "BUA Group - OpEx", Beneficiary: "FIRS", MandateRef: "NIBSS-DD-009012", Type: "direct-debit", Amount: 125000000, Currency: "NGN", Frequency: "monthly", Status: "active", StartDate: "2026-01-01", EndDate: "2026-12-31", NextExec: "2026-06-01", TotalExec: 4, TotalDebited: 500000000},
		{ID: "MND-004", AccountNo: "0055443322", AccountName: "Ngozi Eze", Beneficiary: "Mortgage Bank", MandateRef: "NIBSS-DD-003456", Type: "standing-order", Amount: 250000, Currency: "NGN", Frequency: "monthly", Status: "active", StartDate: "2024-06-01", EndDate: "2044-06-01", NextExec: "2026-06-01", TotalExec: 23, TotalDebited: 5750000},
		{ID: "MND-005", AccountNo: "0012345678", AccountName: "Adebayo Olumide", Beneficiary: "Gym Membership", MandateRef: "NIBSS-DD-007890", Type: "direct-debit", Amount: 15000, Currency: "NGN", Frequency: "monthly", Status: "suspended", StartDate: "2025-09-01", EndDate: "2026-09-01", NextExec: "", TotalExec: 7, TotalDebited: 105000},
		{ID: "MND-006", AccountNo: "0098765432", AccountName: "BUA Group - OpEx", Beneficiary: "Insurance Broker", MandateRef: "NIBSS-DD-001111", Type: "direct-debit", Amount: 45000000, Currency: "NGN", Frequency: "quarterly", Status: "active", StartDate: "2026-01-01", EndDate: "2027-12-31", NextExec: "2026-07-01", TotalExec: 1, TotalDebited: 45000000},
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

func jsonResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Service", "mandate-management")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		active := 0; for _, m := range mandates { if m.Status == "active" { active++ } }
		jsonResponse(w, 200, map[string]interface{}{
			"status": "healthy", "service": "mandate-management",
			"mandates": map[string]int{"total": len(mandates), "active": active},
			"middleware": middlewareConfig,
		})
	})
	mux.HandleFunc("/v1/mandates", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]interface{}{"items": mandates, "total": len(mandates)}) })
	mux.HandleFunc("/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		active, suspended := 0, 0; totalDebited := 0.0; totalExec := 0
		for _, m := range mandates {
			if m.Status == "active" { active++ }
			if m.Status == "suspended" { suspended++ }
			totalDebited += m.TotalDebited; totalExec += m.TotalExec
		}
		jsonResponse(w, 200, map[string]interface{}{
			"totalMandates": len(mandates), "active": active, "suspended": suspended,
			"totalDebited": totalDebited, "totalExecutions": totalExec,
			"types": map[string]int{"direct-debit": 5, "standing-order": 1},
		})
	})

	log.Printf("[mandate-management] Listening on :%s with %d mandates\n", port, len(mandates))
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
