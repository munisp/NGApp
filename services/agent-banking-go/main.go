package main

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

type Agent struct {
	ID              string  `json:"id"`
	BusinessName    string  `json:"businessName"`
	OwnerName       string  `json:"ownerName"`
	Location        string  `json:"location"`
	LGA             string  `json:"lga"`
	State           string  `json:"state"`
	TerminalID      string  `json:"terminalId"`
	FloatBalance    float64 `json:"floatBalance"`
	CommissionEarned float64 `json:"commissionEarned"`
	TransactionCount int    `json:"transactionCount"`
	Status          string  `json:"status"`
	Tier            string  `json:"tier"`
	OnboardedAt     string  `json:"onboardedAt"`
}

type AgentTransaction struct {
	ID          string  `json:"id"`
	AgentID     string  `json:"agentId"`
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Commission  float64 `json:"commission"`
	CustomerBVN string  `json:"customerBVN"`
	Status      string  `json:"status"`
	CreatedAt   string  `json:"createdAt"`
}

var (
	mu      sync.RWMutex
	agents  []Agent
	agentTx []AgentTransaction
)

func commissionRate(txType string, amount float64) float64 {
	switch txType {
	case "cash_in":
		if amount <= 5000 {
			return 25
		}
		if amount <= 50000 {
			return 50
		}
		return 100
	case "cash_out":
		if amount <= 5000 {
			return 30
		}
		if amount <= 50000 {
			return 75
		}
		return 150
	case "bills_payment":
		return math.Round(amount * 0.005)
	case "transfer":
		return 25
	default:
		return 0
	}
}

func init() {
	agents = []Agent{
		{ID: "AGT-001", BusinessName: "Mama Ngozi POS", OwnerName: "Ngozi Eze", Location: "Oshodi Market, Lagos", LGA: "Oshodi-Isolo", State: "Lagos", TerminalID: "TRM-001", FloatBalance: 2500000, CommissionEarned: 185000, TransactionCount: 3420, Status: "active", Tier: "super_agent", OnboardedAt: "2025-01-15T10:00:00Z"},
		{ID: "AGT-002", BusinessName: "Baba Audu Phones", OwnerName: "Audu Mohammed", Location: "Wuse Market, Abuja", LGA: "Municipal", State: "FCT", TerminalID: "TRM-002", FloatBalance: 850000, CommissionEarned: 72000, TransactionCount: 1205, Status: "active", Tier: "agent", OnboardedAt: "2025-06-20T09:00:00Z"},
		{ID: "AGT-003", BusinessName: "Sister's Shop", OwnerName: "Amina Yusuf", Location: "Sabon Gari, Kano", LGA: "Kano Municipal", State: "Kano", TerminalID: "TRM-003", FloatBalance: 150000, CommissionEarned: 12000, TransactionCount: 245, Status: "suspended", Tier: "agent", OnboardedAt: "2025-11-01T08:00:00Z"},
	}
	agentTx = []AgentTransaction{
		{ID: "ATX-001", AgentID: "AGT-001", Type: "cash_in", Amount: 50000, Commission: 50, CustomerBVN: "22012345678", Status: "completed", CreatedAt: "2026-04-01T10:00:00Z"},
		{ID: "ATX-002", AgentID: "AGT-001", Type: "cash_out", Amount: 100000, Commission: 150, CustomerBVN: "22087654321", Status: "completed", CreatedAt: "2026-04-01T10:15:00Z"},
		{ID: "ATX-003", AgentID: "AGT-002", Type: "bills_payment", Amount: 20000, Commission: 100, CustomerBVN: "22011223344", Status: "completed", CreatedAt: "2026-04-01T11:00:00Z"},
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8143"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "agent-banking", "port": port})
	})
	mux.HandleFunc("/v1/agents", handleAgents)
	mux.HandleFunc("/v1/agents/onboard", handleOnboard)
	mux.HandleFunc("/v1/agents/transactions", handleTransactions)
	mux.HandleFunc("/v1/agents/perform-transaction", handlePerformTx)
	mux.HandleFunc("/v1/agents/float-topup", handleFloatTopup)
	mux.HandleFunc("/v1/agents/commission-report", handleCommissionReport)
	mux.HandleFunc("/v1/agents/suspend", handleSuspend)
	mux.HandleFunc("/v1/agents/activate", handleActivate)

	log.Printf("Agent Banking Service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleAgents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": agents, "total": len(agents)})
}

func handleOnboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		BusinessName string `json:"businessName"`
		OwnerName    string `json:"ownerName"`
		Location     string `json:"location"`
		LGA          string `json:"lga"`
		State        string `json:"state"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.BusinessName == "" || req.OwnerName == "" || req.State == "" {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "businessName, ownerName, and state are required"})
		return
	}

	mu.Lock()
	defer mu.Unlock()
	agent := Agent{
		ID:           "AGT-" + time.Now().Format("20060102150405"),
		BusinessName: req.BusinessName,
		OwnerName:    req.OwnerName,
		Location:     req.Location,
		LGA:          req.LGA,
		State:        req.State,
		TerminalID:   "TRM-" + time.Now().Format("20060102150405"),
		FloatBalance: 0,
		Status:       "active",
		Tier:         "agent",
		OnboardedAt:  time.Now().Format(time.RFC3339),
	}
	agents = append(agents, agent)
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(agent)
}

func handleTransactions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{"items": agentTx, "total": len(agentTx)})
		return
	}
	var filtered []AgentTransaction
	for _, tx := range agentTx {
		if tx.AgentID == agentID {
			filtered = append(filtered, tx)
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": filtered, "total": len(filtered)})
}

func handlePerformTx(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AgentID     string  `json:"agentId"`
		Type        string  `json:"type"`
		Amount      float64 `json:"amount"`
		CustomerBVN string  `json:"customerBVN"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	validTypes := map[string]bool{"cash_in": true, "cash_out": true, "bills_payment": true, "transfer": true}
	if !validTypes[req.Type] {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "invalid transaction type", "valid": []string{"cash_in", "cash_out", "bills_payment", "transfer"}})
		return
	}
	if req.Amount <= 0 {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "amount must be positive"})
		return
	}

	mu.Lock()
	defer mu.Unlock()

	var agent *Agent
	for i := range agents {
		if agents[i].ID == req.AgentID {
			agent = &agents[i]
			break
		}
	}
	if agent == nil {
		http.Error(w, `{"error":"agent not found"}`, 404)
		return
	}
	if agent.Status != "active" {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "agent is " + agent.Status + ", must be active"})
		return
	}

	if req.Type == "cash_out" && agent.FloatBalance < req.Amount {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":        "insufficient float balance",
			"floatBalance": agent.FloatBalance,
			"requested":    req.Amount,
		})
		return
	}

	comm := commissionRate(req.Type, req.Amount)
	tx := AgentTransaction{
		ID:          "ATX-" + time.Now().Format("20060102150405"),
		AgentID:     req.AgentID,
		Type:        req.Type,
		Amount:      req.Amount,
		Commission:  comm,
		CustomerBVN: req.CustomerBVN,
		Status:      "completed",
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	if req.Type == "cash_in" {
		agent.FloatBalance += req.Amount
	} else if req.Type == "cash_out" {
		agent.FloatBalance -= req.Amount
	}
	agent.CommissionEarned += comm
	agent.TransactionCount++
	agentTx = append(agentTx, tx)

	json.NewEncoder(w).Encode(map[string]interface{}{"transaction": tx, "newFloatBalance": agent.FloatBalance})
}

func handleFloatTopup(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AgentID string  `json:"agentId"`
		Amount  float64 `json:"amount"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Amount <= 0 {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "amount must be positive"})
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for i := range agents {
		if agents[i].ID == req.AgentID {
			agents[i].FloatBalance += req.Amount
			json.NewEncoder(w).Encode(map[string]interface{}{"agent": agents[i], "topupAmount": req.Amount})
			return
		}
	}
	http.Error(w, `{"error":"agent not found"}`, 404)
}

func handleCommissionReport(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	agentID := r.URL.Query().Get("agentId")
	if agentID == "" {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "agentId required"})
		return
	}
	var total float64
	var count int
	for _, tx := range agentTx {
		if tx.AgentID == agentID {
			total += tx.Commission
			count++
		}
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"agentId": agentID, "totalCommission": total, "transactionCount": count})
}

func handleSuspend(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AgentID string `json:"agentId"`
		Reason  string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range agents {
		if agents[i].ID == req.AgentID {
			if agents[i].Status == "suspended" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "agent already suspended"})
				return
			}
			agents[i].Status = "suspended"
			json.NewEncoder(w).Encode(map[string]interface{}{"agent": agents[i], "reason": req.Reason})
			return
		}
	}
	http.Error(w, `{"error":"agent not found"}`, 404)
}

func handleActivate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		AgentID string `json:"agentId"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	mu.Lock()
	defer mu.Unlock()
	for i := range agents {
		if agents[i].ID == req.AgentID {
			if agents[i].Status != "suspended" {
				w.WriteHeader(400)
				json.NewEncoder(w).Encode(map[string]string{"error": "agent is not suspended"})
				return
			}
			agents[i].Status = "active"
			json.NewEncoder(w).Encode(map[string]interface{}{"agent": agents[i]})
			return
		}
	}
	http.Error(w, `{"error":"agent not found"}`, 404)
}
