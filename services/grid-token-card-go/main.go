package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

type GridCard struct {
	ID           string            `json:"id"`
	CustomerID   string            `json:"customerId"`
	CustomerName string            `json:"customerName"`
	CardSerial   string            `json:"cardSerial"`
	GridSize     string            `json:"gridSize"` // 5x5, 8x4, 10x5
	GridValues   map[string]string `json:"gridValues"`
	Status       string            `json:"status"` // active, suspended, expired, replaced
	IssuedAt     string            `json:"issuedAt"`
	ExpiresAt    string            `json:"expiresAt"`
	UsageCount   int               `json:"usageCount"`
	LastUsedAt   string            `json:"lastUsedAt,omitempty"`
	BranchCode   string            `json:"branchCode"`
}

type GridChallenge struct {
	ID         string   `json:"id"`
	CardID     string   `json:"cardId"`
	CustomerID string   `json:"customerId"`
	Positions  []string `json:"positions"` // e.g. ["B3", "D1", "A5"]
	Purpose    string   `json:"purpose"`
	Status     string   `json:"status"`
	CreatedAt  string   `json:"createdAt"`
	VerifiedAt string   `json:"verifiedAt,omitempty"`
}

var (
	mu         sync.RWMutex
	gridCards  []GridCard
	challenges []GridChallenge
)

func init() {
	gridCards = []GridCard{
		{ID: "GC-001", CustomerID: "CUST-1001", CustomerName: "Adewale Ogundimu", CardSerial: "54B-GRID-00001", GridSize: "5x5", GridValues: map[string]string{"A1": "472", "A2": "913", "A3": "658", "A4": "201", "A5": "847", "B1": "365", "B2": "729", "B3": "184", "B4": "596", "B5": "043", "C1": "817", "C2": "452", "C3": "690", "C4": "138", "C5": "574", "D1": "926", "D2": "381", "D3": "745", "D4": "069", "D5": "213", "E1": "598", "E2": "147", "E3": "862", "E4": "430", "E5": "715"}, Status: "active", IssuedAt: "2026-01-15T10:00:00Z", ExpiresAt: "2027-01-15T10:00:00Z", UsageCount: 45, LastUsedAt: "2026-05-09T14:00:00Z", BranchCode: "LOS-001"},
		{ID: "GC-002", CustomerID: "CUST-1002", CustomerName: "Ngozi Okafor", CardSerial: "54B-GRID-00002", GridSize: "5x5", GridValues: map[string]string{"A1": "319", "A2": "784", "A3": "562", "A4": "097", "A5": "421", "B1": "850", "B2": "673", "B3": "218", "B4": "946", "B5": "135", "C1": "604", "C2": "287", "C3": "951", "C4": "470", "C5": "863", "D1": "192", "D2": "548", "D3": "716", "D4": "329", "D5": "085", "E1": "467", "E2": "903", "E3": "251", "E4": "678", "E5": "140"}, Status: "active", IssuedAt: "2026-02-01T08:00:00Z", ExpiresAt: "2027-02-01T08:00:00Z", UsageCount: 32, LastUsedAt: "2026-05-09T11:30:00Z", BranchCode: "ABJ-001"},
		{ID: "GC-003", CustomerID: "CUST-1003", CustomerName: "Emeka Nwosu", CardSerial: "54B-GRID-00003", GridSize: "8x4", GridValues: map[string]string{"A1": "41", "A2": "79", "A3": "23", "A4": "85", "A5": "60", "A6": "14", "A7": "97", "A8": "52", "B1": "38", "B2": "65", "B3": "01", "B4": "74", "B5": "29", "B6": "86", "B7": "43", "B8": "17"}, Status: "active", IssuedAt: "2026-03-01T10:00:00Z", ExpiresAt: "2027-03-01T10:00:00Z", UsageCount: 18, LastUsedAt: "2026-05-08T16:45:00Z", BranchCode: "PHC-001"},
		{ID: "GC-004", CustomerID: "CUST-1004", CustomerName: "Fatima Abdullahi", CardSerial: "54B-GRID-00004", GridSize: "5x5", GridValues: map[string]string{"A1": "256", "A2": "891", "A3": "437", "A4": "012", "A5": "689"}, Status: "suspended", IssuedAt: "2026-01-20T09:00:00Z", ExpiresAt: "2027-01-20T09:00:00Z", UsageCount: 5, BranchCode: "KAN-001"},
	}

	challenges = []GridChallenge{
		{ID: "CH-001", CardID: "GC-001", CustomerID: "CUST-1001", Positions: []string{"B3", "D1", "A5"}, Purpose: "transfer_above_1m", Status: "verified", CreatedAt: "2026-05-09T14:00:00Z", VerifiedAt: "2026-05-09T14:00:45Z"},
		{ID: "CH-002", CardID: "GC-002", CustomerID: "CUST-1002", Positions: []string{"C4", "E2", "A1"}, Purpose: "beneficiary_addition", Status: "verified", CreatedAt: "2026-05-09T11:30:00Z", VerifiedAt: "2026-05-09T11:31:00Z"},
		{ID: "CH-003", CardID: "GC-003", CustomerID: "CUST-1003", Positions: []string{"A3", "B7"}, Purpose: "password_reset", Status: "pending", CreatedAt: "2026-05-09T15:00:00Z"},
		{ID: "CH-004", CardID: "GC-001", CustomerID: "CUST-1001", Positions: []string{"E4", "C2", "B5"}, Purpose: "international_transfer", Status: "failed", CreatedAt: "2026-05-08T10:00:00Z"},
	}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "grid-token-card-go", "version": "3.0.0", "status": "healthy", "port": 8488,
		"description": "Grid Token Card Service — Challenge-response authentication cards (Barclays PINsentry-style)",
		"features": []string{"grid_card_issuance", "challenge_generation", "response_verification", "card_lifecycle", "multi_grid_sizes", "branch_issuance", "usage_tracking", "suspension_revocation"},
		"gridSizes": []string{"5x5", "8x4", "10x5"},
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"topics": []string{"grid-card.issued", "grid-card.challenged", "grid-card.verified", "grid-card.suspended"}},
			"redis": map[string]interface{}{"usage": "Challenge session cache"}, "postgres": map[string]interface{}{"tables": []string{"grid_cards", "grid_challenges"}},
			"opensearch": map[string]interface{}{"indices": []string{"grid-card-events"}},
			"keycloak": map[string]interface{}{"realm": "54bank"}, "permify": map[string]interface{}{"schema": "grid_card"},
			"dapr": map[string]interface{}{"appId": "grid-token-card-go"}, "fluvio": map[string]interface{}{"topics": []string{"grid-card-stream"}},
			"temporal": map[string]interface{}{"workflows": []string{"card-expiry-notification", "card-replacement"}},
			"mojaloop": map[string]interface{}{"usage": "Payment grid challenge"}, "tigerbeetle": map[string]interface{}{"ledger": 20},
			"lakehouse": map[string]interface{}{"tables": []string{"grid_card_analytics"}},
			"apisix": map[string]interface{}{"routes": []string{"/v1/grid-cards/*"}}, "openappsec": map[string]interface{}{"policy": "grid-card-protection"},
		},
	})
}

func handleGridCards(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": gridCards, "total": len(gridCards)})
}

func handleChallenges(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": challenges, "total": len(challenges)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	byStatus := map[string]int{}
	for _, c := range gridCards { byStatus[c.Status]++ }
	chByStatus := map[string]int{}
	for _, c := range challenges { chByStatus[c.Status]++ }
	respond(w, 200, map[string]interface{}{"totalCards": len(gridCards), "totalChallenges": len(challenges), "cardsByStatus": byStatus, "challengesByStatus": chByStatus})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8488" }
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/grid-cards", handleGridCards)
	mux.HandleFunc("/v1/grid-cards/challenges", handleChallenges)
	mux.HandleFunc("/v1/grid-cards/stats", handleStats)
	fmt.Printf("grid-token-card-go on :%s\n", port)
	http.ListenAndServe(":"+port, mux)
}
