package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// A8: NIBSS Direct Debit — mandate management, debit instructions, settlement

type Mandate struct {
	ID               string    `json:"id"`
	MandateRef       string    `json:"mandateRef"`
	CustomerID       string    `json:"customerId"`
	AccountNumber    string    `json:"accountNumber"`
	BankCode         string    `json:"bankCode"`
	CreditorName     string    `json:"creditorName"`
	CreditorAccount  string    `json:"creditorAccount"`
	CreditorBank     string    `json:"creditorBankCode"`
	MaxAmount        float64   `json:"maxAmount"`
	Frequency        string    `json:"frequency"`
	StartDate        string    `json:"startDate"`
	EndDate          string    `json:"endDate,omitempty"`
	Status           string    `json:"status"`
	NIBSSRef         string    `json:"nibssRef"`
	CreatedAt        time.Time `json:"createdAt"`
}

type DebitInstruction struct {
	ID          string    `json:"id"`
	MandateRef  string    `json:"mandateRef"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	ValueDate   string    `json:"valueDate"`
	Narration   string    `json:"narration"`
	Status      string    `json:"status"`
	FailReason  string    `json:"failReason,omitempty"`
	NIBSSRef    string    `json:"nibssRef"`
	SettledAt   *string   `json:"settledAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

var (
	mu           sync.RWMutex
	mandates     []Mandate
	instructions []DebitInstruction
)

func init() {
	now := time.Now()
	mandates = []Mandate{
		{ID: "MND-001", MandateRef: "NIBSS-MND-2026-0001", CustomerID: "CUST-001", AccountNumber: "0012345678", BankCode: "054", CreditorName: "DSTV Nigeria", CreditorAccount: "1234567890", CreditorBank: "011", MaxAmount: 25000, Frequency: "monthly", StartDate: "2026-01-01", Status: "active", NIBSSRef: "NIBSS-REF-001", CreatedAt: now},
		{ID: "MND-002", MandateRef: "NIBSS-MND-2026-0002", CustomerID: "CUST-002", AccountNumber: "3034567890", BankCode: "054", CreditorName: "EKEDC", CreditorAccount: "9876543210", CreditorBank: "058", MaxAmount: 50000, Frequency: "monthly", StartDate: "2026-01-01", Status: "active", NIBSSRef: "NIBSS-REF-002", CreatedAt: now},
		{ID: "MND-003", MandateRef: "NIBSS-MND-2026-0003", CustomerID: "CUST-003", AccountNumber: "2098765432", BankCode: "054", CreditorName: "ARM Pension", CreditorAccount: "5555666677", CreditorBank: "033", MaxAmount: 100000, Frequency: "monthly", StartDate: "2025-06-01", Status: "active", NIBSSRef: "NIBSS-REF-003", CreatedAt: now},
	}
	instructions = []DebitInstruction{
		{ID: "DDI-001", MandateRef: "NIBSS-MND-2026-0001", Amount: 21000, Currency: "NGN", ValueDate: "2026-01-15", Narration: "DSTV Premium Jan 2026", Status: "settled", NIBSSRef: "NIBSS-TXN-001", CreatedAt: now},
		{ID: "DDI-002", MandateRef: "NIBSS-MND-2026-0002", Amount: 35000, Currency: "NGN", ValueDate: "2026-01-15", Narration: "EKEDC Electricity Jan 2026", Status: "settled", NIBSSRef: "NIBSS-TXN-002", CreatedAt: now},
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8134"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "nibss-direct-debit", "port": port})
	})
	mux.HandleFunc("/v1/nibss/mandates", handleMandates)
	mux.HandleFunc("/v1/nibss/mandates/cancel", handleCancelMandate)
	mux.HandleFunc("/v1/nibss/instructions", handleInstructions)
	mux.HandleFunc("/v1/nibss/instructions/execute", handleExecute)

	log.Printf("NIBSS Direct Debit Service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleMandates(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		var m Mandate
		if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		mu.Lock()
		m.ID = fmt.Sprintf("MND-%03d", len(mandates)+1)
		m.MandateRef = fmt.Sprintf("NIBSS-MND-2026-%04d", len(mandates)+1)
		m.NIBSSRef = fmt.Sprintf("NIBSS-REF-%03d", len(mandates)+1)
		m.Status = "pending_approval"
		m.CreatedAt = time.Now()
		mandates = append(mandates, m)
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(m)
		return
	}
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(mandates)
}

func handleCancelMandate(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		MandateRef string `json:"mandateRef"`
		Reason     string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, m := range mandates {
		if m.MandateRef == req.MandateRef {
			mandates[i].Status = "cancelled"
			json.NewEncoder(w).Encode(mandates[i])
			return
		}
	}
	http.Error(w, `{"error":"mandate not found"}`, 404)
}

func handleInstructions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodPost {
		var di DebitInstruction
		if err := json.NewDecoder(r.Body).Decode(&di); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}

		mu.RLock()
		var mandate *Mandate
		for _, m := range mandates {
			if m.MandateRef == di.MandateRef {
				mandate = &m
				break
			}
		}
		mu.RUnlock()

		if mandate == nil {
			http.Error(w, `{"error":"mandate not found"}`, 404)
			return
		}
		if mandate.Status != "active" {
			http.Error(w, fmt.Sprintf(`{"error":"mandate status is '%s', must be 'active'"}`, mandate.Status), 400)
			return
		}
		if di.Amount > mandate.MaxAmount {
			http.Error(w, fmt.Sprintf(`{"error":"amount %.2f exceeds mandate max %.2f"}`, di.Amount, mandate.MaxAmount), 400)
			return
		}

		mu.Lock()
		di.ID = fmt.Sprintf("DDI-%03d", len(instructions)+1)
		di.NIBSSRef = fmt.Sprintf("NIBSS-TXN-%03d", len(instructions)+1)
		di.Status = "pending"
		di.Currency = "NGN"
		di.CreatedAt = time.Now()
		instructions = append(instructions, di)
		mu.Unlock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(di)
		return
	}
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(instructions)
}

func handleExecute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		InstructionID string `json:"instructionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, di := range instructions {
		if di.ID == req.InstructionID {
			if di.Status != "pending" {
				http.Error(w, fmt.Sprintf(`{"error":"instruction status is '%s', must be 'pending'"}`, di.Status), 400)
				return
			}
			now := time.Now().Format("2006-01-02T15:04:05Z")
			instructions[i].Status = "settled"
			instructions[i].SettledAt = &now
			json.NewEncoder(w).Encode(instructions[i])
			return
		}
	}
	http.Error(w, `{"error":"instruction not found"}`, 404)
}
