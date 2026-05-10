package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" { return v }
	return fallback
}

type SyndicatedLoan struct {
	ID string `json:"id"`
	FacilityName string `json:"facility_name"`
	Borrower string `json:"borrower"`
	TotalAmount float64 `json:"total_amount"`
	Currency string `json:"currency"`
	LeadArranger string `json:"lead_arranger"`
	ParticipantCount int `json:"participant_count"`
	InterestRate float64 `json:"interest_rate"`
	Tenor string `json:"tenor"`
	Status string `json:"status"`
}

var (
	mu    sync.RWMutex
	items = []SyndicatedLoan{
		{ID: "SL-001", FacilityName: "Lagos-Calabar Coastal Road", Borrower: "Federal Ministry of Works", TotalAmount: 50000000000.0, Currency: "NGN", LeadArranger: "54Bank Nigeria", ParticipantCount: 8, InterestRate: 16.5, Tenor: "7 years", Status: "active"},
		{ID: "SL-002", FacilityName: "Dangote Refinery Phase 2", Borrower: "Dangote Industries Ltd", TotalAmount: 500000000.0, Currency: "USD", LeadArranger: "Afreximbank", ParticipantCount: 12, InterestRate: 8.75, Tenor: "10 years", Status: "active"},
		{ID: "SL-003", FacilityName: "MTN Nigeria Network Expansion", Borrower: "MTN Nigeria Comms Plc", TotalAmount: 200000000000.0, Currency: "NGN", LeadArranger: "Stanbic IBTC", ParticipantCount: 6, InterestRate: 15.0, Tenor: "5 years", Status: "disbursing"},
		{ID: "SL-004", FacilityName: "NNPC Crude Oil Prepayment", Borrower: "NNPC Ltd", TotalAmount: 3000000000.0, Currency: "USD", LeadArranger: "54Bank Nigeria", ParticipantCount: 15, InterestRate: 7.5, Tenor: "3 years", Status: "active"},
	}
)

func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service": "syndicated-loans-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka":       map[string]interface{}{"broker": envOr("KAFKA_BROKER", "localhost:9092"), "topics": []string{"syndication.facilities","syndication.drawdowns","syndication.participations"}, "usage": "event streaming"},
			"redis":       map[string]interface{}{"url": envOr("REDIS_URL", "redis://localhost:6379"), "cache_keys": []string{"syndicated-loans-go:cache"}},
			"postgres":    map[string]interface{}{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": []string{"syndicated_facilities","loan_participants","drawdown_schedules"}},
			"opensearch":  map[string]interface{}{"url": envOr("OPENSEARCH_URL", "http://localhost:9200"), "indices": []string{"syndicated-loans","syndication-audit"}},
			"keycloak":    map[string]interface{}{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "syndicated-loans-go"},
			"permify":     map[string]interface{}{"url": envOr("PERMIFY_URL", "http://localhost:3476"), "resources": []string{"syndicated-loans-go"}},
			"dapr":        map[string]interface{}{"url": envOr("DAPR_URL", "http://localhost:3500"), "app_id": "syndicated-loans-go", "pubsub": "syndicated-loans-go-pubsub"},
			"fluvio":      map[string]interface{}{"url": envOr("FLUVIO_URL", "localhost:9003"), "topics": []string{"syndicated-loans-go-stream"}},
			"temporal":    map[string]interface{}{"url": envOr("TEMPORAL_URL", "localhost:7233"), "workflows": []string{"SyndicationWorkflow","DrawdownWorkflow","ParticipantSettlement"}},
			"mojaloop":    map[string]interface{}{"url": envOr("MOJALOOP_URL", "http://localhost:3002"), "usage": "settlement"},
			"tigerbeetle": map[string]interface{}{"url": envOr("TIGERBEETLE_URL", "localhost:3000"), "ledgers": []string{"syndication_principal","syndication_interest"}},
			"lakehouse":   map[string]interface{}{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181"), "tables": []string{"syndicated-loans-go_history"}},
			"apisix":      map[string]interface{}{"url": envOr("APISIX_URL", "http://localhost:9080"), "routes": []string{"/v1/syndicated-loans/facilities"}},
			"openappsec":  map[string]interface{}{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "syndicated-loans-go-waf"},
		},
	})
}

func listItems(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"items": items, "total": len(items)})
}

func getStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var total float64
for _, d := range items { total += d.TotalAmount }
stats := map[string]interface{}{"total_facilities": len(items), "total_committed": total}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func main() {
	port := envOr("PORT", "8171")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/syndicated-loans/facilities", listItems)
	http.HandleFunc("/v1/syndicated-loans/stats", getStats)
	fmt.Printf("Syndicated Loans Service running on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
