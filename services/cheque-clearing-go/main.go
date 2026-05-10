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

// A7: Cheque Clearing & MICR Processing — full cheque lifecycle

type ChequeBook struct {
	ID           string    `json:"id"`
	CustomerId   string    `json:"customerId"`
	AccountNum   string    `json:"accountNumber"`
	SeriesStart  string    `json:"seriesStart"`
	SeriesEnd    string    `json:"seriesEnd"`
	LeafCount    int       `json:"leafCount"`
	IssuedAt     time.Time `json:"issuedAt"`
	Status       string    `json:"status"`
	CollectedAt  *string   `json:"collectedAt"`
}

type Cheque struct {
	ID              string    `json:"id"`
	ChequeNumber    string    `json:"chequeNumber"`
	DrawerAccount   string    `json:"drawerAccount"`
	DrawerName      string    `json:"drawerName"`
	PayeeName       string    `json:"payeeName"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	IssueDate       string    `json:"issueDate"`
	PresentedAt     string    `json:"presentedAt"`
	ClearingStatus  string    `json:"clearingStatus"`
	MICRCode        string    `json:"micrCode"`
	ReturnReason    string    `json:"returnReason,omitempty"`
	SettledAt       *string   `json:"settledAt"`
	PresentingBank  string    `json:"presentingBank"`
	BranchCode      string    `json:"branchCode"`
	CreatedAt       time.Time `json:"createdAt"`
}

var (
	mu         sync.RWMutex
	chequeBooks []ChequeBook
	cheques    []Cheque
)

func init() {
	now := time.Now()
	chequeBooks = []ChequeBook{
		{ID: "CB-001", CustomerId: "CUST-001", AccountNum: "0012345678", SeriesStart: "000001", SeriesEnd: "000025", LeafCount: 25, IssuedAt: now, Status: "active"},
		{ID: "CB-002", CustomerId: "CUST-002", AccountNum: "3034567890", SeriesStart: "100001", SeriesEnd: "100050", LeafCount: 50, IssuedAt: now, Status: "active"},
	}
	cheques = []Cheque{
		{ID: "CHQ-001", ChequeNumber: "000012", DrawerAccount: "0012345678", DrawerName: "Fatima Abdullahi", PayeeName: "Dangote Cement", Amount: 2500000, Currency: "NGN", IssueDate: "2026-01-10", PresentedAt: "2026-01-12", ClearingStatus: "cleared", MICRCode: "C000012C 001234567A 01100", PresentingBank: "Access Bank", BranchCode: "BR-LOS-001", CreatedAt: now},
		{ID: "CHQ-002", ChequeNumber: "100015", DrawerAccount: "3034567890", DrawerName: "Ibrahim Musa", PayeeName: "Office Supplies Ltd", Amount: 450000, Currency: "NGN", IssueDate: "2026-01-14", PresentedAt: "2026-01-15", ClearingStatus: "presented", MICRCode: "C100015C 303456789A 01100", PresentingBank: "GTBank", BranchCode: "BR-ABJ-001", CreatedAt: now},
		{ID: "CHQ-003", ChequeNumber: "000005", DrawerAccount: "0012345678", DrawerName: "Fatima Abdullahi", PayeeName: "Lagos Water Corp", Amount: 85000, Currency: "NGN", IssueDate: "2025-05-10", PresentedAt: "2026-01-16", ClearingStatus: "returned", MICRCode: "C000005C 001234567A 01100", ReturnReason: "stale_cheque", PresentingBank: "First Bank", BranchCode: "BR-LOS-001", CreatedAt: now},
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8132"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "cheque-clearing", "port": port})
	})
	mux.HandleFunc("/v1/cheques/books", handleChequeBooks)
	mux.HandleFunc("/v1/cheques", handleCheques)
	mux.HandleFunc("/v1/cheques/present", handlePresent)
	mux.HandleFunc("/v1/cheques/clear", handleClear)
	mux.HandleFunc("/v1/cheques/return", handleReturn)

	log.Printf("Cheque Clearing Service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func handleChequeBooks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	if r.Method == http.MethodPost {
		var cb ChequeBook
		if err := json.NewDecoder(r.Body).Decode(&cb); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		cb.ID = fmt.Sprintf("CB-%03d", len(chequeBooks)+1)
		cb.IssuedAt = time.Now()
		cb.Status = "active"
		mu.RUnlock()
		mu.Lock()
		chequeBooks = append(chequeBooks, cb)
		mu.Unlock()
		mu.RLock()
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(cb)
		return
	}
	json.NewEncoder(w).Encode(map[string]interface{}{"items": chequeBooks, "total": len(chequeBooks)})
}

func handleCheques(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	defer mu.RUnlock()
	json.NewEncoder(w).Encode(map[string]interface{}{"items": cheques, "total": len(cheques)})
}

func handlePresent(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ChequeNumber  string  `json:"chequeNumber"`
		DrawerAccount string  `json:"drawerAccount"`
		PayeeName     string  `json:"payeeName"`
		Amount        float64 `json:"amount"`
		PresentingBank string `json:"presentingBank"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	chq := Cheque{
		ID:             fmt.Sprintf("CHQ-%03d", len(cheques)+1),
		ChequeNumber:   req.ChequeNumber,
		DrawerAccount:  req.DrawerAccount,
		PayeeName:      req.PayeeName,
		Amount:         req.Amount,
		Currency:       "NGN",
		PresentedAt:    time.Now().Format("2006-01-02"),
		ClearingStatus: "presented",
		MICRCode:       fmt.Sprintf("C%sC %sA 01100", req.ChequeNumber, req.DrawerAccount),
		PresentingBank: req.PresentingBank,
		CreatedAt:      time.Now(),
	}
	cheques = append(cheques, chq)
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(chq)
}

func handleClear(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ChequeID string `json:"chequeId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	for i, c := range cheques {
		if c.ID == req.ChequeID {
			if c.ClearingStatus != "presented" {
				http.Error(w, fmt.Sprintf(`{"error":"cheque status is '%s', expected 'presented'"}`, c.ClearingStatus), 400)
				return
			}
			now := time.Now().Format("2006-01-02T15:04:05Z")
			cheques[i].ClearingStatus = "cleared"
			cheques[i].SettledAt = &now
			json.NewEncoder(w).Encode(cheques[i])
			return
		}
	}
	http.Error(w, `{"error":"cheque not found"}`, 404)
}

func handleReturn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"POST required"}`, 405)
		return
	}
	var req struct {
		ChequeID     string `json:"chequeId"`
		ReturnReason string `json:"returnReason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}

	validReasons := map[string]bool{
		"insufficient_funds": true, "signature_mismatch": true, "stale_cheque": true,
		"post_dated": true, "amount_mismatch": true, "account_closed": true,
		"payment_stopped": true, "refer_to_drawer": true,
	}
	if !validReasons[req.ReturnReason] {
		http.Error(w, `{"error":"invalid return reason","validReasons":["insufficient_funds","signature_mismatch","stale_cheque","post_dated","amount_mismatch","account_closed","payment_stopped","refer_to_drawer"]}`, 400)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	for i, c := range cheques {
		if c.ID == req.ChequeID {
			cheques[i].ClearingStatus = "returned"
			cheques[i].ReturnReason = req.ReturnReason
			json.NewEncoder(w).Encode(cheques[i])
			return
		}
	}
	http.Error(w, `{"error":"cheque not found"}`, 404)
}
