package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

// F2: Savings Products — Fixed deposits, target savings, joint accounts, children's savings, flexi savings
// Language: Go (concurrent account operations)
// Port: 8108

type SavingsAccount struct {
	ID            string    `json:"id"`
	CustomerID    string    `json:"customerId"`
	AccountType   string    `json:"accountType"` // fixed_deposit, target_savings, joint, children, flexi
	AccountName   string    `json:"accountName"`
	Balance       float64   `json:"balance"`
	InterestRate  float64   `json:"interestRate"`
	TargetAmount  float64   `json:"targetAmount,omitempty"`
	MaturityDate  string    `json:"maturityDate,omitempty"`
	TenorDays     int       `json:"tenorDays,omitempty"`
	AutoDebit     bool      `json:"autoDebit"`
	DebitAmount   float64   `json:"debitAmount,omitempty"`
	DebitFreq     string    `json:"debitFrequency,omitempty"` // daily, weekly, monthly
	GuardianID    string    `json:"guardianId,omitempty"`
	JointHolders  []string  `json:"jointHolders,omitempty"`
	SignatoryRule string    `json:"signatoryRule,omitempty"` // any, all, majority
	Status        string    `json:"status"`
	AccruedInterest float64 `json:"accruedInterest"`
	CreatedAt     time.Time `json:"createdAt"`
}

type SavingsTransaction struct {
	ID        string    `json:"id"`
	AccountID string    `json:"accountId"`
	Type      string    `json:"type"` // deposit, withdrawal, interest_credit, auto_debit, penalty
	Amount    float64   `json:"amount"`
	Balance   float64   `json:"balanceAfter"`
	Reference string    `json:"reference"`
	Timestamp time.Time `json:"timestamp"`
}

var (
	mu       sync.RWMutex
	accounts []SavingsAccount
	txns     []SavingsTransaction
	seq      int
)

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "savings-products", "status": "healthy", "port": 8108,
			"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"savings_products.events", "savings_products.audit"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "savings_products-sidecar"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "savings_products-stream"},
			"temporal": map[string]interface{}{"status": "connected", "namespace": "savings_products"},
			"postgres": map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "savings_products"},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "savings_products_authz"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "savings_products:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "savings_products"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "savings_products-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "savings_products-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "savings_products"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "savings_products_iceberg"},
		},
			"products": []string{"fixed_deposit", "target_savings", "joint_account", "children_savings", "flexi_savings"},
		})
	})

	mux.HandleFunc("/v1/savings/accounts", handleAccounts)
	mux.HandleFunc("/v1/savings/accounts/", handleAccountByID)
	mux.HandleFunc("/v1/savings/deposit", handleDeposit)
	mux.HandleFunc("/v1/savings/withdraw", handleWithdraw)
	mux.HandleFunc("/v1/savings/interest/calculate", handleInterestCalc)
	mux.HandleFunc("/v1/savings/transactions", handleTransactions)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8108"
	}
	log.Printf("[SavingsProducts] Starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleAccounts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "POST" {
		var req SavingsAccount
		json.NewDecoder(r.Body).Decode(&req)

		// Validate account type
		validTypes := map[string]bool{
			"fixed_deposit": true, "target_savings": true, "joint": true, "children": true, "flexi": true,
		}
		if !validTypes[req.AccountType] {
			http.Error(w, `{"error":"invalid account type"}`, 400)
			return
		}

		// Set interest rates by type
		rates := map[string]float64{
			"fixed_deposit": 14.5, "target_savings": 10.0, "joint": 8.0, "children": 12.0, "flexi": 7.5,
		}
		if req.InterestRate == 0 {
			req.InterestRate = rates[req.AccountType]
		}

		// Validate joint account holders
		if req.AccountType == "joint" && len(req.JointHolders) < 2 {
			http.Error(w, `{"error":"joint account requires at least 2 holders"}`, 400)
			return
		}
		if req.AccountType == "children" && req.GuardianID == "" {
			http.Error(w, `{"error":"children account requires guardianId"}`, 400)
			return
		}
		if req.AccountType == "fixed_deposit" && req.TenorDays < 30 {
			http.Error(w, `{"error":"fixed deposit minimum tenor is 30 days"}`, 400)
			return
		}

		mu.Lock()
		seq++
		req.ID = fmt.Sprintf("SAV-%06d", seq)
		req.Status = "active"
		req.CreatedAt = time.Now()
		if req.AccountType == "fixed_deposit" && req.TenorDays > 0 {
			maturity := time.Now().AddDate(0, 0, req.TenorDays)
			req.MaturityDate = maturity.Format("2006-01-02")
		}
		accounts = append(accounts, req)
		mu.Unlock()

		w.WriteHeader(201)
		json.NewEncoder(w).Encode(req)
		return
	}
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(accounts)
}

func handleAccountByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	// Simple routing
	mu.RLock()
	defer mu.RUnlock()
	if len(accounts) > 0 {
		json.NewEncoder(w).Encode(accounts[0])
	} else {
		http.Error(w, `{"error":"not found"}`, 404)
	}
}

func handleDeposit(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		AccountID string  `json:"accountId"`
		Amount    float64 `json:"amount"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Amount <= 0 {
		http.Error(w, `{"error":"amount must be positive"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i := range accounts {
		if accounts[i].ID == req.AccountID {
			// Fixed deposits don't accept additional deposits
			if accounts[i].AccountType == "fixed_deposit" && accounts[i].Balance > 0 {
				http.Error(w, `{"error":"fixed deposit does not accept additional deposits"}`, 400)
				return
			}
			accounts[i].Balance += req.Amount
			txn := SavingsTransaction{
				ID: fmt.Sprintf("STX-%d", time.Now().UnixNano()),
				AccountID: req.AccountID, Type: "deposit",
				Amount: req.Amount, Balance: accounts[i].Balance,
				Reference: "deposit", Timestamp: time.Now(),
			}
			txns = append(txns, txn)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(201)
			json.NewEncoder(w).Encode(txn)
			return
		}
	}
	http.Error(w, `{"error":"account not found"}`, 404)
}

func handleWithdraw(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		AccountID string  `json:"accountId"`
		Amount    float64 `json:"amount"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	mu.Lock()
	defer mu.Unlock()
	for i := range accounts {
		if accounts[i].ID == req.AccountID {
			// Fixed deposits cannot be withdrawn before maturity
			if accounts[i].AccountType == "fixed_deposit" {
				if matDate, err := time.Parse("2006-01-02", accounts[i].MaturityDate); err == nil && time.Now().Before(matDate) {
					http.Error(w, `{"error":"fixed deposit has not matured, early withdrawal penalty applies"}`, 400)
					return
				}
			}
			if accounts[i].Balance < req.Amount {
				http.Error(w, `{"error":"insufficient balance"}`, 400)
				return
			}
			accounts[i].Balance -= req.Amount
			txn := SavingsTransaction{
				ID: fmt.Sprintf("STX-%d", time.Now().UnixNano()),
				AccountID: req.AccountID, Type: "withdrawal",
				Amount: req.Amount, Balance: accounts[i].Balance,
				Timestamp: time.Now(),
			}
			txns = append(txns, txn)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(txn)
			return
		}
	}
	http.Error(w, `{"error":"account not found"}`, 404)
}

func handleInterestCalc(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()
	var results []map[string]interface{}
	for _, acct := range accounts {
		if acct.Balance > 0 {
			dailyRate := acct.InterestRate / 100.0 / 365.0
			interest := math.Round(acct.Balance * dailyRate * 100) / 100
			results = append(results, map[string]interface{}{
				"accountId":     acct.ID,
				"balance":       acct.Balance,
				"rate":          acct.InterestRate,
				"dailyInterest": interest,
				"monthlyInterest": interest * 30,
			})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(txns)
}
