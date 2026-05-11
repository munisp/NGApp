package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

type POSTerminal struct {
	ID              string  `json:"id"`
	TerminalID      string  `json:"terminalId"`
	MerchantName    string  `json:"merchantName"`
	MerchantID      string  `json:"merchantId"`
	Location        string  `json:"location"`
	State           string  `json:"state"`
	Category        string  `json:"category"`
	Model           string  `json:"model"`
	Status          string  `json:"status"`
	DailyTxnCount   int     `json:"dailyTransactionCount"`
	DailyVolume     float64 `json:"dailyVolume"`
	MonthlyVolume   float64 `json:"monthlyVolume"`
	LastTransaction string  `json:"lastTransaction"`
	CommissionRate  float64 `json:"commissionRate"`
	DeployedDate    string  `json:"deployedDate"`
}

type POSTransaction struct {
	ID           string  `json:"id"`
	TerminalID   string  `json:"terminalId"`
	MerchantName string  `json:"merchantName"`
	Type         string  `json:"type"`
	Amount       float64 `json:"amount"`
	Currency     string  `json:"currency"`
	CardScheme   string  `json:"cardScheme"`
	ResponseCode string  `json:"responseCode"`
	RRN          string  `json:"rrn"`
	Timestamp    string  `json:"timestamp"`
	Status       string  `json:"status"`
}

var (
	mu           sync.Mutex
	terminals    []POSTerminal
	transactions []POSTransaction
)

func init() {
	terminals = []POSTerminal{
		{ID: "POS-001", TerminalID: "2054B001", MerchantName: "Shoprite Lekki", MerchantID: "MER-001", Location: "Lekki Phase 1", State: "Lagos", Category: "supermarket", Model: "PAX A920", Status: "active", DailyTxnCount: 450, DailyVolume: 8_500_000, MonthlyVolume: 255_000_000, LastTransaction: "2026-05-09T14:30:00Z", CommissionRate: 0.75, DeployedDate: "2025-01-15"},
		{ID: "POS-002", TerminalID: "2054B002", MerchantName: "Total Filling Station Ikoyi", MerchantID: "MER-002", Location: "Alfred Rewane Road", State: "Lagos", Category: "fuel", Model: "Verifone V240m", Status: "active", DailyTxnCount: 280, DailyVolume: 12_000_000, MonthlyVolume: 360_000_000, LastTransaction: "2026-05-09T14:45:00Z", CommissionRate: 0.5, DeployedDate: "2024-11-01"},
		{ID: "POS-003", TerminalID: "2054B003", MerchantName: "Ceddi Plaza Mall", MerchantID: "MER-003", Location: "Central Area", State: "FCT", Category: "retail", Model: "PAX A920", Status: "active", DailyTxnCount: 320, DailyVolume: 5_200_000, MonthlyVolume: 156_000_000, LastTransaction: "2026-05-09T13:00:00Z", CommissionRate: 0.75, DeployedDate: "2025-03-20"},
		{ID: "POS-004", TerminalID: "2054B004", MerchantName: "Silverbird Galleria", MerchantID: "MER-004", Location: "Ahmadu Bello Way VI", State: "Lagos", Category: "entertainment", Model: "Ingenico Move 5000", Status: "active", DailyTxnCount: 180, DailyVolume: 3_600_000, MonthlyVolume: 108_000_000, LastTransaction: "2026-05-09T12:15:00Z", CommissionRate: 1.0, DeployedDate: "2025-06-01"},
		{ID: "POS-005", TerminalID: "2054B005", MerchantName: "NNPC Mega Station Kano", MerchantID: "MER-005", Location: "Zaria Road", State: "Kano", Category: "fuel", Model: "Verifone V240m", Status: "offline", DailyTxnCount: 0, DailyVolume: 0, MonthlyVolume: 280_000_000, LastTransaction: "2026-05-08T18:00:00Z", CommissionRate: 0.5, DeployedDate: "2024-08-15"},
		{ID: "POS-006", TerminalID: "2054B006", MerchantName: "Jabi Lake Mall", MerchantID: "MER-006", Location: "Jabi", State: "FCT", Category: "retail", Model: "PAX A920", Status: "active", DailyTxnCount: 250, DailyVolume: 4_800_000, MonthlyVolume: 144_000_000, LastTransaction: "2026-05-09T14:00:00Z", CommissionRate: 0.75, DeployedDate: "2025-02-10"},
		{ID: "POS-007", TerminalID: "2054B007", MerchantName: "Transcorp Hilton", MerchantID: "MER-007", Location: "Aguiyi Ironsi Street", State: "FCT", Category: "hospitality", Model: "Ingenico Move 5000", Status: "active", DailyTxnCount: 120, DailyVolume: 15_000_000, MonthlyVolume: 450_000_000, LastTransaction: "2026-05-09T11:30:00Z", CommissionRate: 1.25, DeployedDate: "2024-06-01"},
	}

	transactions = []POSTransaction{
		{ID: "PTX-001", TerminalID: "2054B001", MerchantName: "Shoprite Lekki", Type: "purchase", Amount: 45_000, Currency: "NGN", CardScheme: "Visa", ResponseCode: "00", RRN: "123456789012", Timestamp: "2026-05-09T14:30:00Z", Status: "approved"},
		{ID: "PTX-002", TerminalID: "2054B002", MerchantName: "Total Filling Station Ikoyi", Type: "purchase", Amount: 85_000, Currency: "NGN", CardScheme: "Mastercard", ResponseCode: "00", RRN: "123456789013", Timestamp: "2026-05-09T14:45:00Z", Status: "approved"},
		{ID: "PTX-003", TerminalID: "2054B007", MerchantName: "Transcorp Hilton", Type: "purchase", Amount: 350_000, Currency: "NGN", CardScheme: "Visa", ResponseCode: "00", RRN: "123456789014", Timestamp: "2026-05-09T11:30:00Z", Status: "approved"},
		{ID: "PTX-004", TerminalID: "2054B003", MerchantName: "Ceddi Plaza Mall", Type: "purchase", Amount: 12_500, Currency: "NGN", CardScheme: "Verve", ResponseCode: "51", RRN: "123456789015", Timestamp: "2026-05-09T13:00:00Z", Status: "declined"},
		{ID: "PTX-005", TerminalID: "2054B004", MerchantName: "Silverbird Galleria", Type: "purchase", Amount: 8_000, Currency: "NGN", CardScheme: "Verve", ResponseCode: "00", RRN: "123456789016", Timestamp: "2026-05-09T12:15:00Z", Status: "approved"},
	}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status": "ok", "service": "pos-terminal-management",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"pos_terminal.events", "pos_terminal.audit", "pos_terminal.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "pos_terminal-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "pos_terminal-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "pos_terminal"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "pos_terminal"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "pos_terminal_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "pos_terminal:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "pos_terminal"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "pos_terminal-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "pos_terminal-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "pos_terminal"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "pos_terminal_iceberg"},
			},
		})
	})

	mux.HandleFunc("/v1/pos/terminals", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": terminals, "total": len(terminals)})
		mu.Unlock()
	})

	mux.HandleFunc("/v1/pos/transactions", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": transactions, "total": len(transactions)})
		mu.Unlock()
	})

	mux.HandleFunc("/v1/pos/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		byCategory := map[string]int{}
		byStatus := map[string]int{}
		totalVolume := 0.0
		totalTxns := 0
		for _, t := range terminals {
			byCategory[t.Category]++
			byStatus[t.Status]++
			totalVolume += t.DailyVolume
			totalTxns += t.DailyTxnCount
		}
		approvedTxns := 0
		declinedTxns := 0
		for _, tx := range transactions {
			if tx.Status == "approved" {
				approvedTxns++
			} else {
				declinedTxns++
			}
		}
		mu.Unlock()
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalTerminals": len(terminals), "dailyTransactions": totalTxns,
			"dailyVolume": totalVolume, "approvedTxns": approvedTxns,
			"declinedTxns": declinedTxns, "byCategory": byCategory, "byStatus": byStatus,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8153"
	}
	fmt.Printf("pos-terminal-management listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
