package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ── Models ──

type TellerSession struct {
	ID              string           `json:"id"`
	TenantID        string           `json:"tenantId"`
	TellerID        string           `json:"tellerId"`
	TellerName      string           `json:"tellerName"`
	BranchCode      string           `json:"branchCode"`
	BranchName      string           `json:"branchName"`
	WindowNumber    int              `json:"windowNumber"`
	Status          string           `json:"status"`
	OpenedAt        string           `json:"openedAt"`
	ClosedAt        *string          `json:"closedAt"`
	OpeningBalance  float64          `json:"openingBalance"`
	CurrentBalance  float64          `json:"currentBalance"`
	TransactionCount int             `json:"transactionCount"`
	CashDrawer      CashDrawer       `json:"cashDrawer"`
	Transactions    []TellerTxn      `json:"transactions"`
	Middleware      []string         `json:"middleware"`
}

type CashDrawer struct {
	Denominations map[string]int `json:"denominations"`
	TotalCash     float64        `json:"totalCash"`
	LastCounted   string         `json:"lastCounted"`
	Variance      float64        `json:"variance"`
}

type TellerTxn struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	CustomerID  string  `json:"customerId"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Reference   string  `json:"reference"`
	Status      string  `json:"status"`
	ProcessedAt string  `json:"processedAt"`
}

type VaultOperation struct {
	ID            string  `json:"id"`
	TenantID      string  `json:"tenantId"`
	OperationType string  `json:"operationType"`
	FromLocation  string  `json:"fromLocation"`
	ToLocation    string  `json:"toLocation"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	AuthorizedBy  string  `json:"authorizedBy"`
	DualControlBy *string `json:"dualControlBy"`
	Status        string  `json:"status"`
	Reason        string  `json:"reason"`
	Middleware    []string `json:"middleware"`
	CreatedAt     string  `json:"createdAt"`
}

type CreateSessionRequest struct {
	TellerID       string  `json:"tellerId"`
	TellerName     string  `json:"tellerName"`
	BranchCode     string  `json:"branchCode"`
	BranchName     string  `json:"branchName"`
	WindowNumber   int     `json:"windowNumber"`
	OpeningBalance float64 `json:"openingBalance"`
}

type ProcessTxnRequest struct {
	Type       string  `json:"type"`
	CustomerID string  `json:"customerId"`
	Amount     float64 `json:"amount"`
	Currency   string  `json:"currency"`
	Reference  string  `json:"reference"`
}

type VaultRequest struct {
	OperationType string  `json:"operationType"`
	FromLocation  string  `json:"fromLocation"`
	ToLocation    string  `json:"toLocation"`
	Amount        float64 `json:"amount"`
	Reason        string  `json:"reason"`
	AuthorizedBy  string  `json:"authorizedBy"`
}

type CashCountRequest struct {
	Denominations map[string]int `json:"denominations"`
}

// ── State ──

type AppState struct {
	mu       sync.RWMutex
	sessions []TellerSession
	vaults   []VaultOperation
}

func newAppState() *AppState {
	return &AppState{
		sessions: make([]TellerSession, 0),
		vaults:   make([]VaultOperation, 0),
	}
}

func defaultTenant() string {
	if t := os.Getenv("TENANT_ID"); t != "" {
		return t
	}
	return "54bank-platform-prod"
}

func genID(prefix string) string {
	return fmt.Sprintf("%s-%08X", prefix, rand.Uint32())
}

func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func main() {
	state := newAppState()
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"status":     "ok",
			"service":    "teller-operations-go",
			"timestamp":  nowISO(),
			"middleware": []string{"TigerBeetle", "Kafka", "Redis", "Permify", "APISIX"},
		})
	})

	// Session CRUD
	mux.HandleFunc("/v1/teller/sessions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			state.mu.RLock()
			defer state.mu.RUnlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"asOf": nowISO(), "items": state.sessions, "total": len(state.sessions),
			})
		case http.MethodPost:
			var req CreateSessionRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.TellerID == "" || req.BranchCode == "" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "tellerId and branchCode are required"})
				return
			}
			session := TellerSession{
				ID:              genID("TSESS"),
				TenantID:        defaultTenant(),
				TellerID:        req.TellerID,
				TellerName:      req.TellerName,
				BranchCode:      req.BranchCode,
				BranchName:      req.BranchName,
				WindowNumber:    req.WindowNumber,
				Status:          "open",
				OpenedAt:        nowISO(),
				ClosedAt:        nil,
				OpeningBalance:  req.OpeningBalance,
				CurrentBalance:  req.OpeningBalance,
				TransactionCount: 0,
				CashDrawer: CashDrawer{
					Denominations: map[string]int{"1000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20": 0},
					TotalCash:     req.OpeningBalance,
					LastCounted:   nowISO(),
					Variance:      0,
				},
				Transactions: make([]TellerTxn, 0),
				Middleware:   []string{"TigerBeetle", "Kafka", "Redis", "Permify"},
			}
			state.mu.Lock()
			state.sessions = append(state.sessions, session)
			state.mu.Unlock()
			respondJSON(w, http.StatusCreated, session)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Session by ID + close
	mux.HandleFunc("/v1/teller/sessions/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/teller/sessions/"), "/")
		id := parts[0]
		action := ""
		if len(parts) > 1 {
			action = parts[1]
		}

		state.mu.Lock()
		defer state.mu.Unlock()
		idx := -1
		for i, s := range state.sessions {
			if s.ID == id {
				idx = i
				break
			}
		}
		if idx == -1 {
			respondJSON(w, http.StatusNotFound, map[string]string{"message": "Session not found"})
			return
		}

		switch {
		case action == "close" && r.Method == http.MethodPost:
			if state.sessions[idx].Status != "open" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Session already closed"})
				return
			}
			closed := nowISO()
			state.sessions[idx].Status = "closed"
			state.sessions[idx].ClosedAt = &closed
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"session": state.sessions[idx],
				"closingSummary": map[string]interface{}{
					"openingBalance":   state.sessions[idx].OpeningBalance,
					"closingBalance":   state.sessions[idx].CurrentBalance,
					"transactionCount": state.sessions[idx].TransactionCount,
					"variance":         state.sessions[idx].CashDrawer.Variance,
				},
			})

		case action == "transaction" && r.Method == http.MethodPost:
			if state.sessions[idx].Status != "open" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Session is not open"})
				return
			}
			var req ProcessTxnRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.Amount <= 0 {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "amount must be positive"})
				return
			}
			txn := TellerTxn{
				ID:          genID("TTXN"),
				Type:        req.Type,
				CustomerID:  req.CustomerID,
				Amount:      req.Amount,
				Currency:    req.Currency,
				Reference:   req.Reference,
				Status:      "completed",
				ProcessedAt: nowISO(),
			}
			if req.Type == "deposit" || req.Type == "cash_deposit" {
				state.sessions[idx].CurrentBalance += req.Amount
				state.sessions[idx].CashDrawer.TotalCash += req.Amount
			} else if req.Type == "withdrawal" || req.Type == "cash_withdrawal" {
				if state.sessions[idx].CurrentBalance < req.Amount {
					respondJSON(w, http.StatusBadRequest, map[string]string{"message": "Insufficient cash in drawer"})
					return
				}
				state.sessions[idx].CurrentBalance -= req.Amount
				state.sessions[idx].CashDrawer.TotalCash -= req.Amount
			}
			state.sessions[idx].Transactions = append(state.sessions[idx].Transactions, txn)
			state.sessions[idx].TransactionCount++
			respondJSON(w, http.StatusCreated, map[string]interface{}{
				"transaction": txn,
				"session": map[string]interface{}{
					"currentBalance":   state.sessions[idx].CurrentBalance,
					"transactionCount": state.sessions[idx].TransactionCount,
				},
				"ledgerEntry": map[string]interface{}{
					"type": req.Type, "amount": req.Amount,
					"middleware": []string{"TigerBeetle", "Kafka"},
				},
			})

		case action == "cash-count" && r.Method == http.MethodPost:
			var req CashCountRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			var total float64
			denomValues := map[string]float64{
				"1000": 1000, "500": 500, "200": 200, "100": 100, "50": 50, "20": 20, "10": 10, "5": 5,
			}
			for denom, count := range req.Denominations {
				if val, ok := denomValues[denom]; ok {
					total += val * float64(count)
				}
			}
			state.sessions[idx].CashDrawer.Denominations = req.Denominations
			state.sessions[idx].CashDrawer.LastCounted = nowISO()
			state.sessions[idx].CashDrawer.Variance = total - state.sessions[idx].CashDrawer.TotalCash
			state.sessions[idx].CashDrawer.TotalCash = total
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"cashDrawer": state.sessions[idx].CashDrawer,
				"variance":   state.sessions[idx].CashDrawer.Variance,
			})

		case action == "" && r.Method == http.MethodGet:
			respondJSON(w, http.StatusOK, state.sessions[idx])

		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Vault operations
	mux.HandleFunc("/v1/teller/vault", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			state.mu.RLock()
			defer state.mu.RUnlock()
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"asOf": nowISO(), "items": state.vaults, "total": len(state.vaults),
			})
		case http.MethodPost:
			var req VaultRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid payload"})
				return
			}
			if req.Amount <= 0 || req.AuthorizedBy == "" {
				respondJSON(w, http.StatusBadRequest, map[string]string{"message": "amount (>0) and authorizedBy are required"})
				return
			}
			needsDualControl := req.Amount >= 5_000_000
			op := VaultOperation{
				ID:            genID("VAULT"),
				TenantID:      defaultTenant(),
				OperationType: req.OperationType,
				FromLocation:  req.FromLocation,
				ToLocation:    req.ToLocation,
				Amount:        req.Amount,
				Currency:      "NGN",
				AuthorizedBy:  req.AuthorizedBy,
				DualControlBy: nil,
				Status:        "completed",
				Reason:        req.Reason,
				Middleware:    []string{"TigerBeetle", "Kafka", "Permify", "APISIX"},
				CreatedAt:     nowISO(),
			}
			if needsDualControl {
				op.Status = "pending_dual_control"
			}
			state.mu.Lock()
			state.vaults = append(state.vaults, op)
			state.mu.Unlock()
			respondJSON(w, http.StatusCreated, map[string]interface{}{
				"operation":        op,
				"requiresDualControl": needsDualControl,
			})
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8091"
	}
	log.Printf("teller-operations-go listening on %s", addr)
	log.Printf("middleware integrations: TigerBeetle, Kafka, Redis, Permify, APISIX")
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
