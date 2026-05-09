// 54Bank Agent Banking Service
//
// Implements agent/POS banking operations:
//   - Agent registration and KYC management
//   - Float management (top-up, deduction, balance)
//   - POS transaction processing (cash-in, cash-out, bill payment, transfer)
//   - Commission calculation and settlement
//   - Territory and super-agent hierarchy management
//
// Middleware: Kafka, Redis, TigerBeetle, Postgres, Mojaloop, APISIX, Permify, Keycloak
package main

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	mw "github.com/54bank/middleware-go"
)

type Agent struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenantId"`
	AgentCode       string  `json:"agentCode"`
	BusinessName    string  `json:"businessName"`
	OwnerName       string  `json:"ownerName"`
	PhoneNumber     string  `json:"phoneNumber"`
	Email           string  `json:"email"`
	BVN             string  `json:"bvn"`
	LGA             string  `json:"lga"`
	State           string  `json:"state"`
	Address         string  `json:"address"`
	AgentType       string  `json:"agentType"` // individual, super_agent, corporate
	SuperAgentID    string  `json:"superAgentId,omitempty"`
	FloatBalance    float64 `json:"floatBalance"`
	CommissionEarned float64 `json:"commissionEarned"`
	TransactionCount int    `json:"transactionCount"`
	KYCStatus       string  `json:"kycStatus"` // pending, verified, rejected
	Status          string  `json:"status"`    // active, suspended, deactivated
	Terminals       []Terminal `json:"terminals"`
	CreatedAt       string  `json:"createdAt"`
	UpdatedAt       string  `json:"updatedAt"`
}

type Terminal struct {
	TerminalID string `json:"terminalId"`
	DeviceType string `json:"deviceType"` // pos, mobile, mpos
	SerialNo   string `json:"serialNo"`
	Status     string `json:"status"` // active, inactive, faulty
	AssignedAt string `json:"assignedAt"`
}

type AgentTransaction struct {
	ID              string  `json:"id"`
	AgentID         string  `json:"agentId"`
	TerminalID      string  `json:"terminalId"`
	Type            string  `json:"type"` // cash_in, cash_out, bill_payment, transfer, airtime
	CustomerAccount string  `json:"customerAccount"`
	Amount          float64 `json:"amount"`
	Fee             float64 `json:"fee"`
	Commission      float64 `json:"commission"`
	FloatBefore     float64 `json:"floatBefore"`
	FloatAfter      float64 `json:"floatAfter"`
	Reference       string  `json:"reference"`
	Status          string  `json:"status"` // completed, failed, reversed
	CreatedAt       string  `json:"createdAt"`
}

var (
	agents       = make(map[string]*Agent)
	agentTxns    []AgentTransaction
	mu           sync.RWMutex
	bundle       *mw.Bundle
)

func commissionRate(txnType string, amount float64) float64 {
	switch txnType {
	case "cash_in":
		if amount >= 100000 { return 0.005 }
		return 0.0075
	case "cash_out":
		if amount >= 100000 { return 0.0075 }
		return 0.01
	case "bill_payment":
		return 0.003
	case "transfer":
		return 0.002
	case "airtime":
		return 0.025
	default:
		return 0.005
	}
}

func main() {
	bundle = mw.NewBundle()
	addr := mw.EnvOr("ADDR", ":8097")
	mx := http.NewServeMux()

	mx.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		mw.RespondJSON(w, 200, map[string]any{
			"status":    "ok",
			"service":   "agent-banking-go",
			"timestamp": mw.NowISO(),
			"middleware": []string{"Kafka", "Redis", "TigerBeetle", "Postgres", "Mojaloop", "APISIX", "Permify", "Keycloak"},
			"health":    bundle.HealthMap(),
		})
	})

	mx.HandleFunc("/v1/agent-banking/agents", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			mu.RLock()
			items := make([]*Agent, 0, len(agents))
			for _, a := range agents { items = append(items, a) }
			mu.RUnlock()
			mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
		case "POST":
			createAgent(w, r)
		}
	})

	mx.HandleFunc("/v1/agent-banking/agents/", func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/agent-banking/agents/"), "/")
		id := parts[0]
		if len(parts) == 1 {
			switch r.Method {
			case "GET":
				mu.RLock()
				a, ok := agents[id]
				mu.RUnlock()
				if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }
				mw.RespondJSON(w, 200, a)
			case "PUT":
				updateAgent(w, r, id)
			}
		} else {
			switch parts[1] {
			case "float-topup":
				floatTopup(w, r, id)
			case "transaction":
				processTransaction(w, r, id)
			case "terminals":
				assignTerminal(w, r, id)
			case "transactions":
				listAgentTxns(w, id)
			case "verify-kyc":
				verifyKYC(w, id)
			}
		}
	})

	mx.HandleFunc("/v1/agent-banking/transactions", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		mw.RespondJSON(w, 200, map[string]any{"items": agentTxns, "total": len(agentTxns)})
	})

	fmt.Printf("Agent Banking service listening on %s\n", addr)
	http.ListenAndServe(addr, mw.CORSMiddleware(mx))
}

func createAgent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BusinessName string `json:"businessName"`
		OwnerName    string `json:"ownerName"`
		PhoneNumber  string `json:"phoneNumber"`
		Email        string `json:"email"`
		BVN          string `json:"bvn"`
		LGA          string `json:"lga"`
		State        string `json:"state"`
		Address      string `json:"address"`
		AgentType    string `json:"agentType"`
		SuperAgentID string `json:"superAgentId"`
	}
	mw.DecodeBody(r, &req)
	if req.BusinessName == "" || req.OwnerName == "" || req.PhoneNumber == "" {
		mw.RespondJSON(w, 400, map[string]string{"message": "businessName, ownerName, and phoneNumber required"})
		return
	}
	if req.AgentType == "" { req.AgentType = "individual" }

	a := &Agent{
		ID:           mw.GenID("AGT"),
		TenantID:     mw.DefaultTenant(),
		AgentCode:    fmt.Sprintf("54AGT%06d", time.Now().UnixMilli()%1000000),
		BusinessName: req.BusinessName,
		OwnerName:    req.OwnerName,
		PhoneNumber:  req.PhoneNumber,
		Email:        req.Email,
		BVN:          req.BVN,
		LGA:          req.LGA,
		State:        req.State,
		Address:      req.Address,
		AgentType:    req.AgentType,
		SuperAgentID: req.SuperAgentID,
		FloatBalance: 0,
		KYCStatus:    "pending",
		Status:       "active",
		Terminals:    []Terminal{},
		CreatedAt:    mw.NowISO(),
		UpdatedAt:    mw.NowISO(),
	}

	mu.Lock()
	agents[a.ID] = a
	mu.Unlock()

	bundle.Kafka.Publish("agent-banking.agent.created", a.ID, a)
	mw.RespondJSON(w, 201, a)
}

func updateAgent(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := agents[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }
	var req map[string]any
	mw.DecodeBody(r, &req)
	if v, ok := req["businessName"].(string); ok { a.BusinessName = v }
	if v, ok := req["status"].(string); ok { a.Status = v }
	a.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 200, a)
}

func verifyKYC(w http.ResponseWriter, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := agents[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }
	a.KYCStatus = "verified"
	a.UpdatedAt = mw.NowISO()
	bundle.Kafka.Publish("agent-banking.kyc.verified", a.ID, a)
	mw.RespondJSON(w, 200, map[string]any{"agent": a, "kycStatus": "verified"})
}

func floatTopup(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := agents[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }

	var req struct {
		Amount    float64 `json:"amount"`
		Reference string  `json:"reference"`
	}
	mw.DecodeBody(r, &req)
	if req.Amount <= 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "amount must be positive"})
		return
	}
	a.FloatBalance += req.Amount
	a.UpdatedAt = mw.NowISO()

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount: "agent-float-funding", CreditAccount: "agent:" + id,
		Amount: req.Amount, Code: "float-topup",
	})
	mw.RespondJSON(w, 200, map[string]any{"agent": a, "floatBalance": a.FloatBalance})
}

func processTransaction(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := agents[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }
	if a.Status != "active" {
		mw.RespondJSON(w, 400, map[string]string{"message": "Agent is not active"})
		return
	}

	var req struct {
		Type            string  `json:"type"`
		CustomerAccount string  `json:"customerAccount"`
		Amount          float64 `json:"amount"`
		TerminalID      string  `json:"terminalId"`
		Reference       string  `json:"reference"`
	}
	mw.DecodeBody(r, &req)
	if req.Type == "" || req.Amount <= 0 {
		mw.RespondJSON(w, 400, map[string]string{"message": "type and amount (>0) required"})
		return
	}

	// Cash-out requires float
	if req.Type == "cash_out" && a.FloatBalance < req.Amount {
		mw.RespondJSON(w, 400, map[string]string{"message": "Insufficient float balance"})
		return
	}

	commission := req.Amount * commissionRate(req.Type, req.Amount)
	fee := commission * 0.3 // 30% of commission is fee to customer

	floatBefore := a.FloatBalance
	switch req.Type {
	case "cash_in":
		a.FloatBalance += req.Amount
	case "cash_out":
		a.FloatBalance -= req.Amount
	}
	a.CommissionEarned += commission
	a.TransactionCount++
	a.UpdatedAt = mw.NowISO()

	txn := AgentTransaction{
		ID: mw.GenID("ATX"), AgentID: id, TerminalID: req.TerminalID,
		Type: req.Type, CustomerAccount: req.CustomerAccount,
		Amount: req.Amount, Fee: fee, Commission: commission,
		FloatBefore: floatBefore, FloatAfter: a.FloatBalance,
		Reference: req.Reference, Status: "completed", CreatedAt: mw.NowISO(),
	}
	agentTxns = append(agentTxns, txn)

	bundle.TigerBeetle.CreateTransfer(r_ctx(), mw.LedgerEntry{
		DebitAccount: "agent:" + id, CreditAccount: "customer:" + req.CustomerAccount,
		Amount: req.Amount, Code: "agent-" + req.Type,
	})
	bundle.Kafka.Publish("agent-banking.transaction", txn.ID, txn)
	mw.RespondJSON(w, 201, map[string]any{"transaction": txn, "agent": a})
}

func assignTerminal(w http.ResponseWriter, r *http.Request, id string) {
	mu.Lock()
	defer mu.Unlock()
	a, ok := agents[id]
	if !ok { mw.RespondJSON(w, 404, map[string]string{"message": "Agent not found"}); return }

	var req struct {
		DeviceType string `json:"deviceType"`
		SerialNo   string `json:"serialNo"`
	}
	mw.DecodeBody(r, &req)
	if req.SerialNo == "" { mw.RespondJSON(w, 400, map[string]string{"message": "serialNo required"}); return }
	if req.DeviceType == "" { req.DeviceType = "pos" }

	t := Terminal{
		TerminalID: mw.GenID("TRM"), DeviceType: req.DeviceType,
		SerialNo: req.SerialNo, Status: "active", AssignedAt: mw.NowISO(),
	}
	a.Terminals = append(a.Terminals, t)
	a.UpdatedAt = mw.NowISO()
	mw.RespondJSON(w, 201, map[string]any{"terminal": t, "agent": a})
}

func listAgentTxns(w http.ResponseWriter, id string) {
	mu.RLock()
	defer mu.RUnlock()
	var items []AgentTransaction
	for _, t := range agentTxns { if t.AgentID == id { items = append(items, t) } }
	mw.RespondJSON(w, 200, map[string]any{"items": items, "total": len(items)})
}

func r_ctx() __context { return __context{} }
type __context struct{}
func (_ __context) Deadline() (time.Time, bool) { return time.Time{}, false }
func (_ __context) Done() <-chan struct{}        { return nil }
func (_ __context) Err() error                   { return nil }
func (_ __context) Value(any) any                { return nil }
