package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

// Account Statement Service — statement generation, balance computation, transaction history

type Transaction struct {
	ID          string    `json:"id"`
	AccountNum  string    `json:"accountNumber"`
	Date        string    `json:"date"`
	ValueDate   string    `json:"valueDate"`
	Description string    `json:"description"`
	Reference   string    `json:"reference"`
	Debit       float64   `json:"debit"`
	Credit      float64   `json:"credit"`
	Balance     float64   `json:"balance"`
	Channel     string    `json:"channel"`
	Category    string    `json:"category"`
}

type Account struct {
	AccountNumber string  `json:"accountNumber"`
	AccountName   string  `json:"accountName"`
	AccountType   string  `json:"accountType"`
	Currency      string  `json:"currency"`
	OpeningDate   string  `json:"openingDate"`
	CurrentBalance float64 `json:"currentBalance"`
	AvailableBalance float64 `json:"availableBalance"`
	LienAmount    float64 `json:"lienAmount"`
	Status        string  `json:"status"`
	BranchCode    string  `json:"branchCode"`
}

var (
	mu           sync.RWMutex
	accounts     []Account
	transactions []Transaction
)

func init() {
	accounts = []Account{
		{AccountNumber: "0012345678", AccountName: "Fatima Abdullahi", AccountType: "savings", Currency: "NGN", OpeningDate: "2024-03-15", CurrentBalance: 8750000.00, AvailableBalance: 8250000.00, LienAmount: 500000, Status: "active", BranchCode: "BR-LOS-001"},
		{AccountNumber: "3034567890", AccountName: "Ibrahim Musa", AccountType: "current", Currency: "NGN", OpeningDate: "2023-08-10", CurrentBalance: 15200000.00, AvailableBalance: 15200000.00, LienAmount: 0, Status: "active", BranchCode: "BR-ABJ-001"},
		{AccountNumber: "2098765432", AccountName: "Chioma Okafor", AccountType: "savings", Currency: "NGN", OpeningDate: "2025-01-20", CurrentBalance: 2350000.00, AvailableBalance: 2350000.00, LienAmount: 0, Status: "active", BranchCode: "BR-PHC-001"},
	}

	// Seeded transactions for 0012345678
	transactions = []Transaction{
		{ID: "TXN-001", AccountNum: "0012345678", Date: "2026-01-02", ValueDate: "2026-01-02", Description: "Opening Balance B/F", Reference: "SYS/OB/2026", Debit: 0, Credit: 0, Balance: 5000000, Channel: "system", Category: "system"},
		{ID: "TXN-002", AccountNum: "0012345678", Date: "2026-01-05", ValueDate: "2026-01-05", Description: "Salary Credit - Tech Solutions Ltd", Reference: "NIP/SAL/00123", Debit: 0, Credit: 2500000, Balance: 7500000, Channel: "nip", Category: "salary"},
		{ID: "TXN-003", AccountNum: "0012345678", Date: "2026-01-10", ValueDate: "2026-01-10", Description: "ATM Withdrawal - Adeola Odeku", Reference: "ATM/LOS/4521", Debit: 200000, Credit: 0, Balance: 7300000, Channel: "atm", Category: "cash"},
		{ID: "TXN-004", AccountNum: "0012345678", Date: "2026-01-15", ValueDate: "2026-01-15", Description: "POS Purchase - Shoprite VI", Reference: "POS/MCH/8832", Debit: 85000, Credit: 0, Balance: 7215000, Channel: "pos", Category: "purchase"},
		{ID: "TXN-005", AccountNum: "0012345678", Date: "2026-01-20", ValueDate: "2026-01-20", Description: "Transfer to Ibrahim Musa", Reference: "NIP/TRF/55012", Debit: 1500000, Credit: 0, Balance: 5715000, Channel: "mobile", Category: "transfer"},
		{ID: "TXN-006", AccountNum: "0012345678", Date: "2026-02-01", ValueDate: "2026-02-01", Description: "Interest Credit - Jan 2026", Reference: "INT/SAV/0012", Debit: 0, Credit: 35000, Balance: 5750000, Channel: "system", Category: "interest"},
		{ID: "TXN-007", AccountNum: "0012345678", Date: "2026-02-05", ValueDate: "2026-02-05", Description: "Salary Credit - Tech Solutions Ltd", Reference: "NIP/SAL/00456", Debit: 0, Credit: 2500000, Balance: 8250000, Channel: "nip", Category: "salary"},
		{ID: "TXN-008", AccountNum: "0012345678", Date: "2026-02-10", ValueDate: "2026-02-10", Description: "DSTV Subscription - Direct Debit", Reference: "DD/DSTV/2026", Debit: 21000, Credit: 0, Balance: 8229000, Channel: "direct_debit", Category: "subscription"},
		{ID: "TXN-009", AccountNum: "0012345678", Date: "2026-02-15", ValueDate: "2026-02-15", Description: "EKEDC Electricity - Direct Debit", Reference: "DD/EKEDC/2026", Debit: 35000, Credit: 0, Balance: 8194000, Channel: "direct_debit", Category: "utility"},
		{ID: "TXN-010", AccountNum: "0012345678", Date: "2026-03-01", ValueDate: "2026-03-01", Description: "Interest Credit - Feb 2026", Reference: "INT/SAV/0013", Debit: 0, Credit: 56000, Balance: 8250000, Channel: "system", Category: "interest"},
		{ID: "TXN-011", AccountNum: "0012345678", Date: "2026-03-05", ValueDate: "2026-03-05", Description: "Inward Transfer from Chioma Okafor", Reference: "NIP/TRF/77012", Debit: 0, Credit: 500000, Balance: 8750000, Channel: "nip", Category: "transfer"},
		// Transactions for 3034567890
		{ID: "TXN-101", AccountNum: "3034567890", Date: "2026-01-02", ValueDate: "2026-01-02", Description: "Opening Balance B/F", Reference: "SYS/OB/2026", Debit: 0, Credit: 0, Balance: 12000000, Channel: "system", Category: "system"},
		{ID: "TXN-102", AccountNum: "3034567890", Date: "2026-01-15", ValueDate: "2026-01-15", Description: "Client Payment - Dangote Cement", Reference: "NIP/CLT/9981", Debit: 0, Credit: 4500000, Balance: 16500000, Channel: "nip", Category: "business"},
		{ID: "TXN-103", AccountNum: "3034567890", Date: "2026-02-01", ValueDate: "2026-02-01", Description: "Office Rent Payment", Reference: "NIP/RNT/1122", Debit: 1500000, Credit: 0, Balance: 15000000, Channel: "mobile", Category: "rent"},
		{ID: "TXN-104", AccountNum: "3034567890", Date: "2026-02-15", ValueDate: "2026-02-15", Description: "Supplier Payment - Office Supplies", Reference: "NIP/SUP/3344", Debit: 300000, Credit: 0, Balance: 14700000, Channel: "web", Category: "business"},
		{ID: "TXN-105", AccountNum: "3034567890", Date: "2026-03-01", ValueDate: "2026-03-01", Description: "Client Payment - NNPC", Reference: "NIP/CLT/5566", Debit: 0, Credit: 500000, Balance: 15200000, Channel: "nip", Category: "business"},
	}
}

func envOr(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

var middlewareConfig = map[string]interface{}{
	"kafka":       map[string]string{"broker": envOr("KAFKA_BROKER", "localhost:9092")},
	"redis":       map[string]string{"url": envOr("REDIS_URL", "redis://localhost:6379")},
	"postgres":    map[string]string{"url": envOr("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
	"opensearch":  map[string]string{"url": envOr("OPENSEARCH_URL", "http://localhost:9200")},
	"keycloak":    map[string]string{"url": envOr("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
	"permify":     map[string]string{"url": envOr("PERMIFY_URL", "http://localhost:3476")},
	"dapr":        map[string]string{"url": envOr("DAPR_URL", "http://localhost:3500")},
	"fluvio":      map[string]string{"url": envOr("FLUVIO_URL", "localhost:9003")},
	"temporal":    map[string]string{"url": envOr("TEMPORAL_URL", "localhost:7233")},
	"mojaloop":    map[string]string{"url": envOr("MOJALOOP_URL", "http://localhost:3002")},
	"tigerbeetle": map[string]string{"url": envOr("TIGERBEETLE_URL", "localhost:3000")},
	"lakehouse":   map[string]string{"url": envOr("LAKEHOUSE_URL", "http://localhost:8181")},
	"apisix":      map[string]string{"url": envOr("APISIX_URL", "http://localhost:9080")},
	"openappsec":  map[string]string{"url": envOr("OPENAPPSEC_URL", "http://localhost:4000")},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8138"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "account-statement", "port": port})
	})
	mux.HandleFunc("/v1/statements/accounts", handleAccounts)
	mux.HandleFunc("/v1/statements/generate", handleGenerate)
	mux.HandleFunc("/v1/statements/transactions", handleTransactions)
	mux.HandleFunc("/v1/statements/summary", handleSummary)
	mux.HandleFunc("/v1/statements/balance-trend", handleBalanceTrend)

	log.Printf("Account Statement Service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleAccounts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": accounts, "total": len(accounts)})
}

func handleGenerate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AccountNumber string `json:"accountNumber"`
		StartDate     string `json:"startDate"`
		EndDate       string `json:"endDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.RLock()
	defer mu.RUnlock()

	acct := findAccount(req.AccountNumber)
	if acct == nil {
		http.Error(w, `{"error":"account not found"}`, 404)
		return
	}

	filtered := filterTransactions(req.AccountNumber, req.StartDate, req.EndDate)
	sort.Slice(filtered, func(i, j int) bool { return filtered[i].Date < filtered[j].Date })

	totalDebit, totalCredit := 0.0, 0.0
	for _, t := range filtered {
		totalDebit += t.Debit
		totalCredit += t.Credit
	}

	openingBal := 0.0
	if len(filtered) > 0 {
		openingBal = filtered[0].Balance
		if filtered[0].Debit > 0 {
			openingBal += filtered[0].Debit
		} else {
			openingBal -= filtered[0].Credit
		}
	}
	closingBal := 0.0
	if len(filtered) > 0 {
		closingBal = filtered[len(filtered)-1].Balance
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"account":        acct,
		"period":         map[string]string{"from": req.StartDate, "to": req.EndDate},
		"openingBalance": openingBal,
		"closingBalance": closingBal,
		"totalDebit":     math.Round(totalDebit*100) / 100,
		"totalCredit":    math.Round(totalCredit*100) / 100,
		"transactionCount": len(filtered),
		"transactions":   filtered,
		"generatedAt":    time.Now().Format(time.RFC3339),
	})
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()

	acctNum := r.URL.Query().Get("accountNumber")
	if acctNum == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": transactions, "total": len(transactions)})
		return
	}

	var filtered []Transaction
	for _, t := range transactions {
		if t.AccountNum == acctNum {
			filtered = append(filtered, t)
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": filtered, "total": len(filtered)})
}

func handleSummary(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AccountNumber string `json:"accountNumber"`
		StartDate     string `json:"startDate"`
		EndDate       string `json:"endDate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.RLock()
	defer mu.RUnlock()

	filtered := filterTransactions(req.AccountNumber, req.StartDate, req.EndDate)

	categoryTotals := map[string]map[string]float64{}
	channelCounts := map[string]int{}
	for _, t := range filtered {
		if _, ok := categoryTotals[t.Category]; !ok {
			categoryTotals[t.Category] = map[string]float64{"debit": 0, "credit": 0}
		}
		categoryTotals[t.Category]["debit"] += t.Debit
		categoryTotals[t.Category]["credit"] += t.Credit
		channelCounts[t.Channel]++
	}

	totalDebit, totalCredit := 0.0, 0.0
	for _, t := range filtered {
		totalDebit += t.Debit
		totalCredit += t.Credit
	}

	avgBal := 0.0
	if len(filtered) > 0 {
		sum := 0.0
		for _, t := range filtered {
			sum += t.Balance
		}
		avgBal = math.Round(sum/float64(len(filtered))*100) / 100
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"accountNumber":    req.AccountNumber,
		"period":           map[string]string{"from": req.StartDate, "to": req.EndDate},
		"totalDebit":       math.Round(totalDebit*100) / 100,
		"totalCredit":      math.Round(totalCredit*100) / 100,
		"netMovement":      math.Round((totalCredit-totalDebit)*100) / 100,
		"transactionCount": len(filtered),
		"averageBalance":   avgBal,
		"categoryBreakdown": categoryTotals,
		"channelBreakdown":  channelCounts,
	})
}

func handleBalanceTrend(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AccountNumber string `json:"accountNumber"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.RLock()
	defer mu.RUnlock()

	var acctTxns []Transaction
	for _, t := range transactions {
		if t.AccountNum == req.AccountNumber {
			acctTxns = append(acctTxns, t)
		}
	}
	sort.Slice(acctTxns, func(i, j int) bool { return acctTxns[i].Date < acctTxns[j].Date })

	type Point struct {
		Date    string  `json:"date"`
		Balance float64 `json:"balance"`
	}
	var trend []Point
	for _, t := range acctTxns {
		trend = append(trend, Point{t.Date, t.Balance})
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"accountNumber": req.AccountNumber,
		"dataPoints":    trend,
		"count":         len(trend),
	})
}

func findAccount(num string) *Account {
	for _, a := range accounts {
		if a.AccountNumber == num {
			return &a
		}
	}
	return nil
}

func filterTransactions(acctNum, start, end string) []Transaction {
	var result []Transaction
	for _, t := range transactions {
		if t.AccountNum != acctNum {
			continue
		}
		if start != "" && t.Date < start {
			continue
		}
		if end != "" && t.Date > end {
			continue
		}
		result = append(result, t)
	}
	return result
}
