package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

func envOr(k, f string) string { if v := os.Getenv(k); v != "" { return v }; return f }
func now() string { return time.Now().UTC().Format(time.RFC3339) }

type Branch struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Code        string  `json:"code"`
	Region      string  `json:"region"`
	State       string  `json:"state"`
	Address     string  `json:"address"`
	Manager     string  `json:"manager"`
	TellerCount int     `json:"tellerCount"`
	ATMCount    int     `json:"atmCount"`
	Status      string  `json:"status"`
	CashHolding float64 `json:"cashHolding"`
	DailyTxns   int     `json:"dailyTxns"`
}

type VaultOperation struct {
	ID        string  `json:"id"`
	BranchID  string  `json:"branchId"`
	Type      string  `json:"type"`
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
	ApprovedBy string `json:"approvedBy"`
	Status    string  `json:"status"`
	Timestamp string  `json:"timestamp"`
}

type TellerSession struct {
	ID       string  `json:"id"`
	BranchID string  `json:"branchId"`
	TellerID string  `json:"tellerId"`
	Name     string  `json:"name"`
	Status   string  `json:"status"`
	CashIn   float64 `json:"cashIn"`
	CashOut  float64 `json:"cashOut"`
	TxnCount int     `json:"txnCount"`
	OpenedAt string  `json:"openedAt"`
}

var (
	mu       sync.RWMutex
	branches []Branch
	vaultOps []VaultOperation
	tellers  []TellerSession
)

func init() {
	branches = []Branch{
		{ID: "BR-001", Name: "Lagos Marina Branch", Code: "001", Region: "South-West", State: "Lagos", Address: "25 Marina, Lagos Island", Manager: "Adebayo Ogundimu", TellerCount: 12, ATMCount: 4, Status: "open", CashHolding: 500000000.0, DailyTxns: 1250},
		{ID: "BR-002", Name: "Abuja Central Branch", Code: "002", Region: "North-Central", State: "FCT", Address: "1 Constitution Ave, Abuja", Manager: "Fatima Mohammed", TellerCount: 8, ATMCount: 3, Status: "open", CashHolding: 350000000.0, DailyTxns: 890},
		{ID: "BR-003", Name: "Port Harcourt GRA", Code: "003", Region: "South-South", State: "Rivers", Address: "15 Aba Road, GRA", Manager: "Chidi Okafor", TellerCount: 6, ATMCount: 2, Status: "open", CashHolding: 200000000.0, DailyTxns: 650},
		{ID: "BR-004", Name: "Kano Sabon Gari", Code: "004", Region: "North-West", State: "Kano", Address: "45 Bompai Road", Manager: "Abdulrahman Suleiman", TellerCount: 10, ATMCount: 3, Status: "open", CashHolding: 280000000.0, DailyTxns: 780},
		{ID: "BR-005", Name: "Ibadan Dugbe", Code: "005", Region: "South-West", State: "Oyo", Address: "12 Dugbe Road, Ibadan", Manager: "Oluwaseun Adeyemi", TellerCount: 5, ATMCount: 2, Status: "open", CashHolding: 150000000.0, DailyTxns: 420},
		{ID: "BR-006", Name: "Enugu Independence Layout", Code: "006", Region: "South-East", State: "Enugu", Address: "8 Okpara Ave", Manager: "Ngozi Eze", TellerCount: 4, ATMCount: 1, Status: "open", CashHolding: 100000000.0, DailyTxns: 310},
	}
	vaultOps = []VaultOperation{
		{ID: "VO-001", BranchID: "BR-001", Type: "cash_delivery", Amount: 200000000.0, Currency: "NGN", ApprovedBy: "HEAD-OFFICE", Status: "completed", Timestamp: "2026-05-11T07:00:00Z"},
		{ID: "VO-002", BranchID: "BR-001", Type: "cash_evacuation", Amount: 100000000.0, Currency: "NGN", ApprovedBy: "HEAD-OFFICE", Status: "completed", Timestamp: "2026-05-10T17:00:00Z"},
		{ID: "VO-003", BranchID: "BR-002", Type: "cash_delivery", Amount: 150000000.0, Currency: "NGN", ApprovedBy: "HEAD-OFFICE", Status: "in_transit", Timestamp: "2026-05-11T06:00:00Z"},
		{ID: "VO-004", BranchID: "BR-004", Type: "fx_cash_delivery", Amount: 50000.0, Currency: "USD", ApprovedBy: "TREASURY", Status: "completed", Timestamp: "2026-05-11T08:00:00Z"},
	}
	tellers = []TellerSession{
		{ID: "TS-001", BranchID: "BR-001", TellerID: "TLR-001", Name: "Bola Adekunle", Status: "active", CashIn: 25000000.0, CashOut: 18000000.0, TxnCount: 87, OpenedAt: "2026-05-11T08:00:00Z"},
		{ID: "TS-002", BranchID: "BR-001", TellerID: "TLR-002", Name: "Emeka Nwosu", Status: "active", CashIn: 32000000.0, CashOut: 22000000.0, TxnCount: 95, OpenedAt: "2026-05-11T08:00:00Z"},
		{ID: "TS-003", BranchID: "BR-002", TellerID: "TLR-003", Name: "Halima Garba", Status: "active", CashIn: 18000000.0, CashOut: 12000000.0, TxnCount: 63, OpenedAt: "2026-05-11T08:00:00Z"},
		{ID: "TS-004", BranchID: "BR-003", TellerID: "TLR-004", Name: "Obinna Nnamdi", Status: "break", CashIn: 15000000.0, CashOut: 10000000.0, TxnCount: 45, OpenedAt: "2026-05-11T08:00:00Z"},
	}
}

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	respond(w, 200, map[string]interface{}{
		"service": "branch-operations-go", "status": "healthy", "version": "1.0.0",
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"branch.operations", "branch.vault", "branch.teller"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "branch-operations-go"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "branch-realtime"},
			"temporal": map[string]interface{}{"status": "connected", "workflows": []string{"branch-eod", "vault-reconciliation"}},
			"postgres": map[string]interface{}{"status": "connected", "tables": []string{"branches", "vault_operations", "teller_sessions"}},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "branch_rbac"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "branch:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "branch-ops"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "branch-operations-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "branch-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "branch-operations"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "branch_ops_iceberg"},
		},
	})
}

func handleBranches(w http.ResponseWriter, r *http.Request) {
	mu.Lock()
	defer mu.Unlock()
	if r.Method == http.MethodPost {
		var b Branch
		json.NewDecoder(r.Body).Decode(&b)
		b.ID = fmt.Sprintf("BR-%03d", len(branches)+1)
		b.Status = "setup"
		branches = append(branches, b)
		respond(w, 201, b)
		return
	}
	respond(w, 200, map[string]interface{}{"items": branches, "total": len(branches)})
}

func handleVault(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": vaultOps, "total": len(vaultOps)})
}

func handleTellers(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	respond(w, 200, map[string]interface{}{"items": tellers, "total": len(tellers)})
}

func handleStats(w http.ResponseWriter, _ *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var totalCash float64; totalTxns := 0; totalTellers := 0; totalATMs := 0
	for _, b := range branches { totalCash += b.CashHolding; totalTxns += b.DailyTxns; totalTellers += b.TellerCount; totalATMs += b.ATMCount }
	respond(w, 200, map[string]interface{}{
		"totalBranches": len(branches), "totalCashHolding": totalCash, "totalDailyTxns": totalTxns,
		"totalTellers": totalTellers, "totalATMs": totalATMs,
		"totalVaultOps": len(vaultOps), "activeTellerSessions": len(tellers),
	})
}

func main() {
	port := envOr("PORT", "8250")
	http.HandleFunc("/healthz", healthz)
	http.HandleFunc("/v1/branch/branches", handleBranches)
	http.HandleFunc("/v1/branch/vault", handleVault)
	http.HandleFunc("/v1/branch/tellers", handleTellers)
	http.HandleFunc("/v1/branch/stats", handleStats)
	fmt.Printf("Branch Operations Service on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
