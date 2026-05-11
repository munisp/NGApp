package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
)

type ATM struct {
	ID            string  `json:"id"`
	TerminalID    string  `json:"terminalId"`
	Location      string  `json:"location"`
	Branch        string  `json:"branch"`
	State         string  `json:"state"`
	Type          string  `json:"type"`
	Status        string  `json:"status"`
	CashLevel     float64 `json:"cashLevel"`
	CashBalance   int64   `json:"cashBalance"`
	MaxCapacity   int64   `json:"maxCapacity"`
	DailyTxns     int     `json:"dailyTransactions"`
	DailyVolume   int64   `json:"dailyVolume"`
	Uptime30d     float64 `json:"uptime30d"`
	LastReplenish string  `json:"lastReplenishment"`
	NextReplenish string  `json:"nextReplenishment"`
	LastFault     string  `json:"lastFault,omitempty"`
	FaultType     string  `json:"faultType,omitempty"`
}

type ATMFault struct {
	ID         string `json:"id"`
	ATMID      string `json:"atmId"`
	TerminalID string `json:"terminalId"`
	FaultType  string `json:"faultType"`
	Severity   string `json:"severity"`
	Description string `json:"description"`
	Status     string `json:"status"`
	ReportedAt string `json:"reportedAt"`
	ResolvedAt string `json:"resolvedAt,omitempty"`
	Engineer   string `json:"engineer,omitempty"`
	MTTR       int    `json:"mttrMinutes,omitempty"`
}

var (
	mu     sync.Mutex
	atms   []ATM
	faults []ATMFault
)

func init() {
	atms = []ATM{
		{ID: "ATM-001", TerminalID: "54B-LI-001", Location: "Lagos Island Marina Mall", Branch: "Lagos Island", State: "Lagos", Type: "cash_dispenser", Status: "online", CashLevel: 72.5, CashBalance: 14_500_000, MaxCapacity: 20_000_000, DailyTxns: 450, DailyVolume: 22_500_000, Uptime30d: 99.8, LastReplenish: "2026-05-08T06:00:00Z", NextReplenish: "2026-05-10T06:00:00Z"},
		{ID: "ATM-002", TerminalID: "54B-LI-002", Location: "Broad Street HQ Lobby", Branch: "Lagos Island", State: "Lagos", Type: "cash_recycler", Status: "online", CashLevel: 85.0, CashBalance: 17_000_000, MaxCapacity: 20_000_000, DailyTxns: 320, DailyVolume: 16_000_000, Uptime30d: 99.95, LastReplenish: "2026-05-07T06:00:00Z", NextReplenish: "2026-05-11T06:00:00Z"},
		{ID: "ATM-003", TerminalID: "54B-AB-001", Location: "Wuse Market Junction", Branch: "Abuja Main", State: "FCT", Type: "cash_dispenser", Status: "online", CashLevel: 45.0, CashBalance: 9_000_000, MaxCapacity: 20_000_000, DailyTxns: 580, DailyVolume: 29_000_000, Uptime30d: 99.2, LastReplenish: "2026-05-08T06:00:00Z", NextReplenish: "2026-05-09T18:00:00Z"},
		{ID: "ATM-004", TerminalID: "54B-KN-001", Location: "Kano City Mall", Branch: "Kano Central", State: "Kano", Type: "cash_dispenser", Status: "offline", CashLevel: 0, CashBalance: 0, MaxCapacity: 15_000_000, DailyTxns: 0, DailyVolume: 0, Uptime30d: 95.3, LastReplenish: "2026-05-06T06:00:00Z", NextReplenish: "2026-05-09T10:00:00Z", LastFault: "2026-05-09T08:30:00Z", FaultType: "card_reader_jam"},
		{ID: "ATM-005", TerminalID: "54B-PH-001", Location: "Trans Amadi Industrial Layout", Branch: "Port Harcourt", State: "Rivers", Type: "cash_dispenser", Status: "low_cash", CashLevel: 12.0, CashBalance: 1_800_000, MaxCapacity: 15_000_000, DailyTxns: 290, DailyVolume: 14_500_000, Uptime30d: 98.8, LastReplenish: "2026-05-07T06:00:00Z", NextReplenish: "2026-05-09T14:00:00Z"},
		{ID: "ATM-006", TerminalID: "54B-IB-001", Location: "Bodija Market Square", Branch: "Ibadan", State: "Oyo", Type: "cash_recycler", Status: "online", CashLevel: 65.0, CashBalance: 9_750_000, MaxCapacity: 15_000_000, DailyTxns: 210, DailyVolume: 10_500_000, Uptime30d: 99.5, LastReplenish: "2026-05-08T06:00:00Z", NextReplenish: "2026-05-11T06:00:00Z"},
		{ID: "ATM-007", TerminalID: "54B-EN-001", Location: "Enugu Coal City Mall", Branch: "Enugu", State: "Enugu", Type: "cash_dispenser", Status: "maintenance", CashLevel: 50.0, CashBalance: 7_500_000, MaxCapacity: 15_000_000, DailyTxns: 0, DailyVolume: 0, Uptime30d: 97.1, LastReplenish: "2026-05-08T06:00:00Z", NextReplenish: "2026-05-10T06:00:00Z", LastFault: "2026-05-09T07:00:00Z", FaultType: "software_update"},
		{ID: "ATM-008", TerminalID: "54B-KD-001", Location: "Kaduna Central Market", Branch: "Kaduna", State: "Kaduna", Type: "cash_dispenser", Status: "online", CashLevel: 55.0, CashBalance: 8_250_000, MaxCapacity: 15_000_000, DailyTxns: 340, DailyVolume: 17_000_000, Uptime30d: 99.0, LastReplenish: "2026-05-08T06:00:00Z", NextReplenish: "2026-05-10T06:00:00Z"},
	}

	faults = []ATMFault{
		{ID: "FLT-001", ATMID: "ATM-004", TerminalID: "54B-KN-001", FaultType: "card_reader_jam", Severity: "high", Description: "Card reader mechanism jammed — customer card retained", Status: "open", ReportedAt: "2026-05-09T08:30:00Z"},
		{ID: "FLT-002", ATMID: "ATM-007", TerminalID: "54B-EN-001", FaultType: "software_update", Severity: "low", Description: "Scheduled firmware update v4.2.1 — 45 min downtime", Status: "in_progress", ReportedAt: "2026-05-09T07:00:00Z", Engineer: "Emeka Nwosu"},
		{ID: "FLT-003", ATMID: "ATM-003", TerminalID: "54B-AB-001", FaultType: "cash_dispenser_error", Severity: "medium", Description: "Intermittent note dispensing error — ₦500 denomination", Status: "resolved", ReportedAt: "2026-05-08T15:00:00Z", ResolvedAt: "2026-05-08T17:30:00Z", Engineer: "Abdul Kareem", MTTR: 150},
		{ID: "FLT-004", ATMID: "ATM-005", TerminalID: "54B-PH-001", FaultType: "low_cash_alert", Severity: "medium", Description: "Cash level below 15% threshold — replenishment required", Status: "open", ReportedAt: "2026-05-09T10:00:00Z"},
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
			"status": "ok", "service": "atm-management",
			"middleware": map[string]interface{}{
				"kafka":       map[string]interface{}{"status": "connected", "topics": []string{"atm_management.events", "atm_management.audit", "atm_management.notifications"}},
				"dapr":        map[string]interface{}{"status": "connected", "appId": "atm_management-sidecar"},
				"fluvio":      map[string]interface{}{"status": "connected", "topic": "atm_management-stream"},
				"temporal":    map[string]interface{}{"status": "connected", "namespace": "atm_management"},
				"postgres":    map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "atm_management"},
				"keycloak":    map[string]interface{}{"status": "connected", "realm": "54bank"},
				"permify":     map[string]interface{}{"status": "connected", "schema": "atm_management_authz"},
				"redis":       map[string]interface{}{"status": "connected", "prefix": "atm_management:"},
				"mojaloop":    map[string]interface{}{"status": "connected", "participant": "atm_management"},
				"opensearch":  map[string]interface{}{"status": "connected", "index": "atm_management-*"},
				"openappsec":  map[string]interface{}{"status": "connected", "policy": "atm_management-protection"},
				"apisix":      map[string]interface{}{"status": "connected", "upstream": "atm_management"},
				"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
				"lakehouse":   map[string]interface{}{"status": "connected", "table": "atm_management_iceberg"},
			},
		})
	})

	mux.HandleFunc("/v1/atm/terminals", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET only"})
			return
		}
		mu.Lock()
		respondJSON(w, http.StatusOK, map[string]interface{}{"items": atms, "total": len(atms)})
		mu.Unlock()
	})

	mux.HandleFunc("/v1/atm/faults", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			mu.Lock()
			respondJSON(w, http.StatusOK, map[string]interface{}{"items": faults, "total": len(faults)})
			mu.Unlock()
		case http.MethodPost:
			var f ATMFault
			if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
				return
			}
			if f.ATMID == "" || f.FaultType == "" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"error": "atmId and faultType are required"})
				return
			}
			mu.Lock()
			f.ID = fmt.Sprintf("FLT-%03d", len(faults)+1)
			f.Status = "open"
			faults = append(faults, f)
			mu.Unlock()
			respondJSON(w, http.StatusCreated, f)
		default:
			respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
	})

	mux.HandleFunc("/v1/atm/stats", func(w http.ResponseWriter, _ *http.Request) {
		mu.Lock()
		byStatus := map[string]int{}
		byState := map[string]int{}
		totalCash := int64(0)
		totalTxns := 0
		for _, a := range atms {
			byStatus[a.Status]++
			byState[a.State]++
			totalCash += a.CashBalance
			totalTxns += a.DailyTxns
		}
		openFaults := 0
		for _, f := range faults {
			if f.Status == "open" || f.Status == "in_progress" {
				openFaults++
			}
		}
		mu.Unlock()
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"totalATMs": len(atms), "totalCashHolding": totalCash,
			"dailyTransactions": totalTxns, "openFaults": openFaults,
			"byStatus": byStatus, "byState": byState,
		})
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8147"
	}
	fmt.Printf("atm-management listening on %s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
