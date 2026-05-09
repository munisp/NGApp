// 54Bank Virtual Accounts Service
//
// Implements VAN (Virtual Account Number) management:
//   - VAN generation with scheme-based numbering
//   - Sub-account creation and management
//   - Balance tracking per virtual account
//   - Transaction posting (credits/debits) with reconciliation
//   - Account closure and reallocation
//
// Middleware: Kafka, Redis, TigerBeetle, Postgres, APISIX, Permify
package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	mw "github.com/54bank/middleware-go"
)

type VirtualAccount struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenantId"`
	VAN             string  `json:"van"` // Virtual Account Number
	ParentAccountID string  `json:"parentAccountId"`
	OwnerID         string  `json:"ownerId"`
	OwnerName       string  `json:"ownerName"`
	OwnerType       string  `json:"ownerType"` // customer, merchant, corporate, collection
	Purpose         string  `json:"purpose"`
	Currency        string  `json:"currency"`
	Balance         float64 `json:"balance"`
	AvailableBalance float64 `json:"availableBalance"`
	HoldAmount      float64 `json:"holdAmount"`
	DailyLimit      float64 `json:"dailyLimit"`
	MonthlyLimit    float64 `json:"monthlyLimit"`
	Status          string  `json:"status"` // active, frozen, closed
	ExpiryDate      string  `json:"expiryDate,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
}

type VANTransaction struct {
	ID        string  `json:"id"`
	VANID     string  `json:"vanId"`
	Type      string  `json:"type"` // credit, debit, hold, release
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
	Reference string  `json:"reference"`
	Narration string  `json:"narration"`
	CounterpartyName string `json:"counterpartyName,omitempty"`
	BalanceBefore float64 `json:"balanceBefore"`
	BalanceAfter  float64 `json:"balanceAfter"`
	Status    string  `json:"status"`
	CreatedAt string  `json:"createdAt"`
}

var (
	accounts     = make(map[string]*VirtualAccount)
	transactions []VANTransaction
	mu           sync.RWMutex
	bundle       *mw.Bundle
	vanCounter   int64
)

func generateVAN() string {
	vanCounter++
	return fmt.Sprintf("54%010d%02d", time.Now().UnixMilli()%10000000000, rand.Intn(99))
}

func main() {
	bundle = mw.NewBundle()
	addr := mw.EnvOr("ADDR", ":8096")

	mx := http.NewServeMux()

	mx.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		mw.RespondJSON(w, 200, map[string]any{
			"status":    "ok",
			"service":   "virtual-accounts-go",
			"timestamp": mw.NowISO(),
			"middleware": []string{"Kafka", "Redis", "TigerBeetle", "Postgres", "APISIX", "Permify"},
			"health":    bundle.HealthMap(),
		})
	})

	mx.HandleFunc("/v1/virtual-accounts/accounts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			mu.RLock()
			items := make([]*VirtualAccount, 0, len(accounts))
			for _, a := range accounts {
				items = append(items, a)
			}
			mu.RUnlock()
			mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
		case "POST":
			createAccount(w, r)
		default:
			mw.RespondJSON(w, 405, map[string]string{"message": "Method not allowed"})
		}
	})

	mx.HandleFunc("/v1/virtual-accounts/accounts/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/virtual-accounts/accounts/"), "/")
		id := parts[0]
		if len(parts) == 1 {
			switch r.Method {
			case "GET":
				mu.RLock()
				a, ok := accounts[id]
				mu.RUnlock()
				if !ok {
					mw.RespondJSON(w, 404, map[string]string{"message": "Virtual account not found"})
					return
				}
				mw.RespondJSON(w, 200, a)
			case "PUT":
				updateAccount(w, r, id)
			}
		} else {
			switch parts[1] {
			case "credit":
				postTransaction(w, r, id, "credit")
			case "debit":
				postTransaction(w, r, id, "debit")
			case "hold":
				postTransaction(w, r, id, "hold")
			case "release":
				postTransaction(w, r, id, "release")
			case "close":
				closeAccount(w, id)
			case "transactions":
				listAccountTransactions(w, id)
			}
		}
	})

	mx.HandleFunc("/v1/virtual-accounts/transactions", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		mw.RespondJSON(w, 200, map[string]any{"items": transactions, "total": len(transactions)})
	})

	fmt.Printf("Virtual Accounts service listening on %s\n", addr)
	http.ListenAndServe(addr, mw.CORSMiddleware(mx))
}

func createAccount(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ParentAccountID string            `json:"parentAccountId"`
		OwnerID         string            `json:"ownerId"`
		OwnerName       string            `json:"ownerName"`
		OwnerType       string            `json:"ownerType"`
		Purpose         string            `json:"purpose"`
		Currency        string            `json:"currency"`
		DailyLimit      float64           `json:"dailyLimit"`
		MonthlyLimit    float64           `json:"monthlyLimit"`
		ExpiryDate      string            `json:"expiryDate"`
		Metadata        map[string]string `json:"metadata"`
	}
	if err := mw.DecodeBody(r, &req); err != nil {
		mw.RespondJSON(w, 400, map[string]string{"message": "Invalid request body"})
		return
	}
	if req.OwnerID == "" || req.OwnerName == "" {
		mw.RespondJSON(w, 400, map[string]string{"message": "ownerId and ownerName required"})
		return
	}
	if req.Currency == "" {
		req.Currency = "NGN"
	}
	if req.OwnerType == "" {
		req.OwnerType = "customer"
	}
	if req.DailyLimit == 0 {
		req.DailyLimit = 10000000 // ₦10M default
	}
	if req.MonthlyLimit == 0 {
		req.MonthlyLimit = 100000000 // ₦100M default
	}

	a := &VirtualAccount{
		ID:               mw.GenID("VAN"),
		TenantID:         mw.DefaultTenant(),
		VAN:              generateVAN(),
		ParentAccountID:  req.ParentAccountID,
		OwnerID:          req.OwnerID,
		OwnerName:        req.OwnerName,
		OwnerType:        req.OwnerType,
		Purpose:          req.Purpose,
		Currency:         req.Currency,
		Balance:          0,
		AvailableBalance: 0,
		HoldAmount:       0,
		DailyLimit:       req.DailyLimit,
		MonthlyLimit:     req.MonthlyLimit,
		Status:           "active",
		ExpiryDate:       req.ExpiryDate,
		Metadata:         req.Metadata,
		CreatedAt:        mw.NowISO(),
		UpdatedAt:        mw.NowISO(),
	}

	mu.Lock()
	accounts[a.ID] = a
	mu.Unlock()

	bundle.Kafka.Publish("virtual-accounts.created", a.ID, a)
	bundle.Redis.Set(r_ctx(), "van:"+a.VAN, a.ID, 0)
	mw.RespondJSON(w, 201, a)
}

func updateAccount(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := accounts[id]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Virtual account not found"})
		return
	}
	var req map[string]any
	mw.DecodeBody(r, &req)
	if v, ok := req["purpose"].(string); ok {
		a.Purpose = v
	}
	if v, ok := req["dailyLimit"].(float64); ok {
		a.DailyLimit = v
	}
	if v, ok := req["monthlyLimit"].(float64); ok {
		a.MonthlyLimit = v
	}
	if v, ok := req["status"].(string); ok && (v == "active" || v == "frozen") {
		a.Status = v
	}
	a.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 200, a)
}

func postTransaction(w http.ResponseWriter, r *http.Request, id string, txnType string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := accounts[id]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Virtual account not found"})
		return
	}
	if a.Status != "active" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Account is not active"})
		return
	}

	var req struct {
		Amount           float64 `json:"amount"`
		Reference        string  `json:"reference"`
		Narration        string  `json:"narration"`
		CounterpartyName string  `json:"counterpartyName"`
	}
	mw.DecodeBody(r, &req)
	if req.Amount <= 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "amount must be positive"})
		return
	}

	balBefore := a.Balance
	switch txnType {
	case "credit":
		a.Balance += req.Amount
		a.AvailableBalance += req.Amount
	case "debit":
		if a.AvailableBalance < req.Amount {
			mw.RespondJSON(w, 400, map[string]string{"message": "Insufficient available balance"})
			return
		}
		a.Balance -= req.Amount
		a.AvailableBalance -= req.Amount
	case "hold":
		if a.AvailableBalance < req.Amount {
			mw.RespondJSON(w, 400, map[string]string{"message": "Insufficient available balance for hold"})
			return
		}
		a.AvailableBalance -= req.Amount
		a.HoldAmount += req.Amount
	case "release":
		if a.HoldAmount < req.Amount {
			mw.RespondJSON(w, 400, map[string]string{"message": "Hold amount less than release amount"})
			return
		}
		a.AvailableBalance += req.Amount
		a.HoldAmount -= req.Amount
	}

	txn := VANTransaction{
		ID:               mw.GenID("VTX"),
		VANID:            id,
		Type:             txnType,
		Amount:           req.Amount,
		Currency:         a.Currency,
		Reference:        req.Reference,
		Narration:        req.Narration,
		CounterpartyName: req.CounterpartyName,
		BalanceBefore:    balBefore,
		BalanceAfter:     a.Balance,
		Status:           "completed",
		CreatedAt:        mw.NowISO(),
	}
	transactions = append(transactions, txn)
	a.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount:  "van:" + id,
		CreditAccount: "settlement:" + a.ParentAccountID,
		Amount:        req.Amount,
		Code:          "van-" + txnType,
	})
	bundle.Kafka.Publish("virtual-accounts.transaction", txn.ID, txn)
	mw.RespondJSON(w, 201, map[string]any{"transaction": txn, "account": a})
}

func closeAccount(w http.ResponseWriter, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := accounts[id]
	if !ok {
		mw.RespondJSON(w, 404, map[string]string{"message": "Virtual account not found"})
		return
	}
	if a.Balance != 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "Account balance must be zero to close"})
		return
	}
	a.Status = "closed"
	a.UpdatedAt = mw.NowISO()
	bundle.Kafka.Publish("virtual-accounts.closed", a.ID, a)
	mw.RespondJSON(w, 200, a)
}

func listAccountTransactions(w http.ResponseWriter, id string) {
	mu.RLock()
	defer mu.RUnlock()
	var items []VANTransaction
	for _, t := range transactions {
		if t.VANID == id {
			items = append(items, t)
		}
	}
	mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
}

func r_ctx() __context { return __context{} }
type __context struct{}
func (_ __context) Deadline() (time.Time, bool) { return time.Time{}, false }
func (_ __context) Done() <-chan struct{}        { return nil }
func (_ __context) Err() error                   { return nil }
func (_ __context) Value(any) any                { return nil }
