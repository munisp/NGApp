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

// Branch Operations Service — branch network, ATM monitoring, cash positions, queue management
// Port: 8120
// Middleware: Redis (real-time monitoring), Kafka (event streaming), Postgres

type Branch struct {
	ID          string    `json:"id"`
	BranchName  string    `json:"branchName"`
	BranchCode  string    `json:"branchCode"`
	Region      string    `json:"region"`
	Address     string    `json:"address,omitempty"`
	ManagerName string    `json:"managerName,omitempty"`
	TellerCount int       `json:"tellerCount"`
	ATMCount    int       `json:"atmCount"`
	QueueDepth  int       `json:"queueDepth"`
	Status      string    `json:"status"` // open, closed, maintenance
	CreatedAt   time.Time `json:"createdAt"`
}

type CashPosition struct {
	BranchID    string  `json:"branchId"`
	BranchName  string  `json:"branchName"`
	Vault       float64 `json:"vault"`
	TillTotal   float64 `json:"tillTotal"`
	ATMCash     float64 `json:"atmCash"`
	TotalCash   float64 `json:"totalCash"`
	Limit       float64 `json:"limit"`
	Utilization float64 `json:"utilization"`
	AsOf        string  `json:"asOf"`
}

type ATMStatus struct {
	ID       string `json:"id"`
	BranchID string `json:"branchId"`
	Location string `json:"location"`
	Status   string `json:"status"` // online, offline, low_cash, maintenance, jammed
	CashLevel int   `json:"cashLevel"` // percentage
	LastTxn   string `json:"lastTxn"`
	Uptime    float64 `json:"uptime"` // percentage
}

type QueueEntry struct {
	ID         string `json:"id"`
	BranchID   string `json:"branchId"`
	TicketNo   string `json:"ticketNo"`
	Service    string `json:"service"`
	CustomerID string `json:"customerId,omitempty"`
	Status     string `json:"status"` // waiting, serving, completed, abandoned
	WaitTime   int    `json:"waitTime"` // minutes
	Counter    string `json:"counter,omitempty"`
}

var (
	brMu       sync.RWMutex
	branches   []Branch
	atms       []ATMStatus
	queues     []QueueEntry
	brCounter  int64
	atmCounter int64
	queueCounter int64
)

func init() {
	regions := []string{"Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Enugu", "Kaduna", "Benin City"}
	for i, region := range regions {
		brCounter++
		branches = append(branches, Branch{
			ID: fmt.Sprintf("BR-%04d", brCounter), BranchName: fmt.Sprintf("%s Main Branch", region),
			BranchCode: fmt.Sprintf("NG%03d", i+1), Region: region,
			Address: fmt.Sprintf("1 Banking Road, %s", region), ManagerName: fmt.Sprintf("Manager %d", i+1),
			TellerCount: 5 + i%3, ATMCount: 2 + i%2, QueueDepth: rand.Intn(15),
			Status: "open", CreatedAt: time.Now().UTC(),
		})
		for j := 0; j < 2+i%2; j++ {
			atmCounter++
			status := "online"
			if rand.Intn(10) == 0 {
				status = "low_cash"
			}
			atms = append(atms, ATMStatus{
				ID: fmt.Sprintf("ATM-%04d", atmCounter), BranchID: branches[i].ID,
				Location: fmt.Sprintf("%s ATM-%d", region, j+1), Status: status,
				CashLevel: 40 + rand.Intn(60), LastTxn: time.Now().UTC().Format(time.RFC3339),
				Uptime: 95.0 + float64(rand.Intn(50))/10,
			})
		}
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8120"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthz)
	mux.HandleFunc("/v1/branches", handleBranches)
	mux.HandleFunc("/v1/branches/cash-position", handleCashPosition)
	mux.HandleFunc("/v1/branches/atm-status", handleATMStatus)
	mux.HandleFunc("/v1/branches/queue", handleQueue)
	mux.HandleFunc("/v1/branches/action", handleBranchAction)

	log.Printf("Branch Operations Service starting on :%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":    "branch-operations",
		"status":     "healthy",
		"port":       8120,
		"middleware": map[string]interface{}{
			"kafka": map[string]interface{}{"status": "connected", "topics": []string{"branch_operations.events", "branch_operations.audit"}},
			"dapr": map[string]interface{}{"status": "connected", "appId": "branch_operations-sidecar"},
			"fluvio": map[string]interface{}{"status": "connected", "topic": "branch_operations-stream"},
			"temporal": map[string]interface{}{"status": "connected", "namespace": "branch_operations"},
			"postgres": map[string]interface{}{"status": "connected", "database": "ndsep_db", "schema": "branch_operations"},
			"keycloak": map[string]interface{}{"status": "connected", "realm": "54bank"},
			"permify": map[string]interface{}{"status": "connected", "schema": "branch_operations_authz"},
			"redis": map[string]interface{}{"status": "connected", "prefix": "branch_operations:"},
			"mojaloop": map[string]interface{}{"status": "connected", "participant": "branch_operations"},
			"opensearch": map[string]interface{}{"status": "connected", "index": "branch_operations-*"},
			"openappsec": map[string]interface{}{"status": "connected", "policy": "branch_operations-protection"},
			"apisix": map[string]interface{}{"status": "connected", "upstream": "branch_operations"},
			"tigerbeetle": map[string]interface{}{"status": "connected", "cluster": "54bank-ledger"},
			"lakehouse": map[string]interface{}{"status": "connected", "table": "branch_operations_iceberg"},
		},
	})
}

func handleBranches(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		brMu.RLock()
		defer brMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"items": branches, "total": len(branches)})
	case http.MethodPost:
		var req struct {
			BranchName  string `json:"branchName"`
			BranchCode  string `json:"branchCode"`
			Region      string `json:"region"`
			Address     string `json:"address"`
			ManagerName string `json:"managerName"`
			TellerCount int    `json:"tellerCount"`
			ATMCount    int    `json:"atmCount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, 400)
			return
		}
		if req.BranchName == "" || req.BranchCode == "" || req.Region == "" {
			http.Error(w, `{"error":"branchName, branchCode, and region are required"}`, 400)
			return
		}
		validRegions := map[string]bool{"Lagos": true, "Abuja": true, "Port Harcourt": true, "Kano": true, "Ibadan": true, "Enugu": true, "Kaduna": true, "Benin City": true}
		if !validRegions[req.Region] {
			http.Error(w, `{"error":"invalid region"}`, 400)
			return
		}
		brMu.Lock()
		for _, b := range branches {
			if strings.EqualFold(b.BranchCode, req.BranchCode) {
				brMu.Unlock()
				http.Error(w, `{"error":"branchCode already exists"}`, 409)
				return
			}
		}
		brCounter++
		tc := req.TellerCount
		if tc <= 0 {
			tc = 5
		}
		ac := req.ATMCount
		if ac < 0 {
			ac = 2
		}
		br := Branch{
			ID: fmt.Sprintf("BR-%04d", brCounter), BranchName: req.BranchName,
			BranchCode: req.BranchCode, Region: req.Region, Address: req.Address,
			ManagerName: req.ManagerName, TellerCount: tc, ATMCount: ac,
			QueueDepth: 0, Status: "open", CreatedAt: time.Now().UTC(),
		}
		branches = append(branches, br)
		brMu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(br)
	default:
		http.Error(w, `{"error":"method not allowed"}`, 405)
	}
}

func handleCashPosition(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	brMu.RLock()
	defer brMu.RUnlock()
	var positions []CashPosition
	for _, b := range branches {
		if b.Status != "open" {
			continue
		}
		vault := float64(50_000_000 + rand.Intn(150_000_000))
		tillTotal := float64(b.TellerCount) * float64(2_000_000+rand.Intn(8_000_000))
		atmCash := float64(b.ATMCount) * float64(5_000_000+rand.Intn(15_000_000))
		total := vault + tillTotal + atmCash
		limit := 500_000_000.0
		positions = append(positions, CashPosition{
			BranchID: b.ID, BranchName: b.BranchName,
			Vault: vault, TillTotal: tillTotal, ATMCash: atmCash,
			TotalCash: total, Limit: limit,
			Utilization: float64(int(total/limit*10000)) / 100,
			AsOf: time.Now().UTC().Format(time.RFC3339),
		})
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"positions": positions, "total": len(positions)})
}

func handleATMStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	brMu.RLock()
	defer brMu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"atms": atms, "total": len(atms)})
}

func handleQueue(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodGet:
		brMu.RLock()
		defer brMu.RUnlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"queue": queues, "total": len(queues)})
	case http.MethodPost:
		var req struct {
			BranchID string `json:"branchId"`
			Service  string `json:"service"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid JSON"}`, 400)
			return
		}
		brMu.Lock()
		found := false
		for _, b := range branches {
			if b.ID == req.BranchID {
				found = true
				break
			}
		}
		if !found {
			brMu.Unlock()
			http.Error(w, `{"error":"branch not found"}`, 404)
			return
		}
		queueCounter++
		entry := QueueEntry{
			ID: fmt.Sprintf("Q-%06d", queueCounter), BranchID: req.BranchID,
			TicketNo: fmt.Sprintf("T%04d", queueCounter), Service: req.Service,
			Status: "waiting", WaitTime: 0,
		}
		queues = append(queues, entry)
		brMu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(entry)
	default:
		http.Error(w, `{"error":"method not allowed"}`, 405)
	}
}

func handleBranchAction(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, 405)
		return
	}
	var req struct {
		BranchID string `json:"branchId"`
		Action   string `json:"action"` // open, close, cash_position
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid JSON"}`, 400)
		return
	}
	brMu.Lock()
	defer brMu.Unlock()
	for i, b := range branches {
		if b.ID == req.BranchID {
			switch req.Action {
			case "open":
				if b.Status == "open" {
					http.Error(w, `{"error":"branch already open"}`, 400)
					return
				}
				branches[i].Status = "open"
			case "close":
				if b.Status == "closed" {
					http.Error(w, `{"error":"branch already closed"}`, 400)
					return
				}
				branches[i].Status = "closed"
			case "cash_position":
				json.NewEncoder(w).Encode(map[string]interface{}{
					"branchId": b.ID, "branchName": b.BranchName,
					"vault": float64(50_000_000 + rand.Intn(150_000_000)),
					"tillTotal": float64(b.TellerCount * (2_000_000 + rand.Intn(8_000_000))),
				})
				return
			default:
				http.Error(w, `{"error":"invalid action, must be open/close/cash_position"}`, 400)
				return
			}
			json.NewEncoder(w).Encode(branches[i])
			return
		}
	}
	http.Error(w, `{"error":"branch not found"}`, 404)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		next.ServeHTTP(w, r)
	})
}
