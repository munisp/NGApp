package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type MerchantStatus string

const (
	MerchantPending  MerchantStatus = "pending"
	MerchantActive   MerchantStatus = "active"
	MerchantSuspended MerchantStatus = "suspended"
)

type Merchant struct {
	ID              string         `json:"id"`
	UserID          string         `json:"user_id"`
	BusinessName    string         `json:"business_name"`
	BusinessType    string         `json:"business_type"`
	RegistrationNum string         `json:"registration_number"`
	TaxID           string         `json:"tax_id"`
	Email           string         `json:"email"`
	Phone           string         `json:"phone"`
	Address         string         `json:"address"`
	Country         string         `json:"country"`
	Currency        string         `json:"currency"`
	Status          MerchantStatus `json:"status"`
	KYBStatus       string         `json:"kyb_status"`
	SettlementAcct  string         `json:"settlement_account"`
	FeeRate         float64        `json:"fee_rate"`
	CreatedAt       time.Time      `json:"created_at"`
}

type POSTerminal struct {
	ID         string    `json:"id"`
	MerchantID string    `json:"merchant_id"`
	SerialNum  string    `json:"serial_number"`
	Model      string    `json:"model"`
	Location   string    `json:"location"`
	Status     string    `json:"status"`
	LastActive time.Time `json:"last_active"`
	CreatedAt  time.Time `json:"created_at"`
}

type Invoice struct {
	ID          string        `json:"id"`
	MerchantID  string        `json:"merchant_id"`
	CustomerID  string        `json:"customer_id"`
	Items       []InvoiceItem `json:"items"`
	Subtotal    float64       `json:"subtotal"`
	Tax         float64       `json:"tax"`
	Total       float64       `json:"total"`
	Currency    string        `json:"currency"`
	Status      string        `json:"status"`
	DueDate     time.Time     `json:"due_date"`
	PaidAt      *time.Time    `json:"paid_at,omitempty"`
	InvoiceNum  string        `json:"invoice_number"`
	Notes       string        `json:"notes"`
	CreatedAt   time.Time     `json:"created_at"`
}

type InvoiceItem struct {
	Description string  `json:"description"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Total       float64 `json:"total"`
}

type Settlement struct {
	ID          string    `json:"id"`
	MerchantID  string    `json:"merchant_id"`
	Amount      float64   `json:"amount"`
	Fee         float64   `json:"fee"`
	NetAmount   float64   `json:"net_amount"`
	Currency    string    `json:"currency"`
	TxnCount    int       `json:"transaction_count"`
	Period      string    `json:"period"`
	Status      string    `json:"status"`
	AccountNum  string    `json:"account_number"`
	SettledAt   time.Time `json:"settled_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type MerchantTxn struct {
	ID          string    `json:"id"`
	MerchantID  string    `json:"merchant_id"`
	CustomerID  string    `json:"customer_id"`
	Amount      float64   `json:"amount"`
	Fee         float64   `json:"fee"`
	Net         float64   `json:"net"`
	Currency    string    `json:"currency"`
	Method      string    `json:"method"`
	Status      string    `json:"status"`
	Reference   string    `json:"reference"`
	POSTerminal string    `json:"pos_terminal,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type MerchantAnalytics struct {
	MerchantID    string    `json:"merchant_id"`
	Period        string    `json:"period"`
	TotalRevenue  float64   `json:"total_revenue"`
	TotalFees     float64   `json:"total_fees"`
	NetRevenue    float64   `json:"net_revenue"`
	TxnCount      int       `json:"transaction_count"`
	AvgTxnSize    float64   `json:"avg_transaction_size"`
	TopProducts   []string  `json:"top_products"`
	GrowthRate    float64   `json:"growth_rate"`
	GeneratedAt   time.Time `json:"generated_at"`
}

var (
	merchants    = make(map[string]*Merchant)
	terminals    = make(map[string]*POSTerminal)
	invoices     = make(map[string]*Invoice)
	settlements  = make(map[string]*Settlement)
	merchantTxns = make(map[string]*MerchantTxn)
	mu           sync.RWMutex
	idCounter    int64
	invoiceCount int64
)

func generateID(prefix string) string {
	mu.Lock()
	idCounter++
	id := idCounter
	mu.Unlock()
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), id)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func readJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" { w.WriteHeader(200); return }
		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"status": "healthy", "service": "merchant-business", "version": "1.0.0",
		"merchants": len(merchants), "terminals": len(terminals),
	})
}

func handleOnboardMerchant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID          string `json:"user_id"`
		BusinessName    string `json:"business_name"`
		BusinessType    string `json:"business_type"`
		RegistrationNum string `json:"registration_number"`
		TaxID           string `json:"tax_id"`
		Email           string `json:"email"`
		Phone           string `json:"phone"`
		Address         string `json:"address"`
		Country         string `json:"country"`
		SettlementAcct  string `json:"settlement_account"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	currency := "NGN"
	switch req.Country {
	case "KE": currency = "KES"
	case "GH": currency = "GHS"
	case "ZA": currency = "ZAR"
	}

	m := &Merchant{
		ID: generateID("merch"), UserID: req.UserID,
		BusinessName: req.BusinessName, BusinessType: req.BusinessType,
		RegistrationNum: req.RegistrationNum, TaxID: req.TaxID,
		Email: req.Email, Phone: req.Phone, Address: req.Address,
		Country: req.Country, Currency: currency,
		Status: MerchantPending, KYBStatus: "pending",
		SettlementAcct: req.SettlementAcct, FeeRate: 0.015,
		CreatedAt: time.Now(),
	}

	mu.Lock()
	merchants[m.ID] = m
	mu.Unlock()

	writeJSON(w, 201, m)
}

func handleApproveMerchant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MerchantID string `json:"merchant_id"`
		FeeRate    float64 `json:"fee_rate"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.Lock()
	m := merchants[req.MerchantID]
	if m != nil {
		m.Status = MerchantActive
		m.KYBStatus = "approved"
		if req.FeeRate > 0 { m.FeeRate = req.FeeRate }
	}
	mu.Unlock()

	if m == nil {
		writeJSON(w, 404, map[string]string{"error": "merchant not found"}); return
	}
	writeJSON(w, 200, m)
}

func handleRegisterTerminal(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MerchantID string `json:"merchant_id"`
		SerialNum  string `json:"serial_number"`
		Model      string `json:"model"`
		Location   string `json:"location"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	terminal := &POSTerminal{
		ID: generateID("pos"), MerchantID: req.MerchantID,
		SerialNum: req.SerialNum, Model: req.Model,
		Location: req.Location, Status: "active",
		LastActive: time.Now(), CreatedAt: time.Now(),
	}

	mu.Lock()
	terminals[terminal.ID] = terminal
	mu.Unlock()

	writeJSON(w, 201, terminal)
}

func handleCreateInvoice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MerchantID string        `json:"merchant_id"`
		CustomerID string        `json:"customer_id"`
		Items      []InvoiceItem `json:"items"`
		TaxRate    float64       `json:"tax_rate"`
		DueDays    int           `json:"due_days"`
		Notes      string        `json:"notes"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.RLock()
	m := merchants[req.MerchantID]
	mu.RUnlock()
	if m == nil {
		writeJSON(w, 404, map[string]string{"error": "merchant not found"}); return
	}

	subtotal := 0.0
	for i := range req.Items {
		req.Items[i].Total = float64(req.Items[i].Quantity) * req.Items[i].UnitPrice
		subtotal += req.Items[i].Total
	}
	tax := subtotal * req.TaxRate
	if req.DueDays == 0 { req.DueDays = 30 }

	mu.Lock()
	invoiceCount++
	invNum := fmt.Sprintf("INV-%06d", invoiceCount)
	mu.Unlock()

	inv := &Invoice{
		ID: generateID("inv"), MerchantID: req.MerchantID,
		CustomerID: req.CustomerID, Items: req.Items,
		Subtotal: subtotal, Tax: tax, Total: subtotal + tax,
		Currency: m.Currency, Status: "pending",
		DueDate: time.Now().AddDate(0, 0, req.DueDays),
		InvoiceNum: invNum, Notes: req.Notes, CreatedAt: time.Now(),
	}

	mu.Lock()
	invoices[inv.ID] = inv
	mu.Unlock()

	writeJSON(w, 201, inv)
}

func handlePayInvoice(w http.ResponseWriter, r *http.Request) {
	var req struct {
		InvoiceID string `json:"invoice_id"`
		Method    string `json:"method"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.Lock()
	inv := invoices[req.InvoiceID]
	if inv != nil {
		inv.Status = "paid"
		now := time.Now()
		inv.PaidAt = &now

		m := merchants[inv.MerchantID]
		fee := inv.Total * m.FeeRate
		txn := &MerchantTxn{
			ID: generateID("mtxn"), MerchantID: inv.MerchantID,
			CustomerID: inv.CustomerID, Amount: inv.Total,
			Fee: fee, Net: inv.Total - fee, Currency: inv.Currency,
			Method: req.Method, Status: "completed",
			Reference: inv.InvoiceNum, CreatedAt: time.Now(),
		}
		merchantTxns[txn.ID] = txn
	}
	mu.Unlock()

	if inv == nil {
		writeJSON(w, 404, map[string]string{"error": "invoice not found"}); return
	}
	writeJSON(w, 200, inv)
}

func handleProcessPOS(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TerminalID string  `json:"terminal_id"`
		Amount     float64 `json:"amount"`
		Method     string  `json:"method"`
		CustomerID string  `json:"customer_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.RLock()
	term := terminals[req.TerminalID]
	mu.RUnlock()
	if term == nil {
		writeJSON(w, 404, map[string]string{"error": "terminal not found"}); return
	}

	mu.RLock()
	m := merchants[term.MerchantID]
	mu.RUnlock()

	fee := req.Amount * m.FeeRate
	txn := &MerchantTxn{
		ID: generateID("pos_txn"), MerchantID: term.MerchantID,
		CustomerID: req.CustomerID, Amount: req.Amount,
		Fee: fee, Net: req.Amount - fee, Currency: m.Currency,
		Method: req.Method, Status: "completed",
		Reference: generateID("ref"), POSTerminal: term.ID,
		CreatedAt: time.Now(),
	}

	mu.Lock()
	merchantTxns[txn.ID] = txn
	term.LastActive = time.Now()
	mu.Unlock()

	writeJSON(w, 200, txn)
}

func handleRunSettlement(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MerchantID string `json:"merchant_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"}); return
	}

	mu.RLock()
	m := merchants[req.MerchantID]
	var unsettled []*MerchantTxn
	for _, txn := range merchantTxns {
		if txn.MerchantID == req.MerchantID && txn.Status == "completed" {
			unsettled = append(unsettled, txn)
		}
	}
	mu.RUnlock()

	if m == nil {
		writeJSON(w, 404, map[string]string{"error": "merchant not found"}); return
	}

	totalAmt := 0.0
	totalFee := 0.0
	for _, txn := range unsettled {
		totalAmt += txn.Amount
		totalFee += txn.Fee
	}

	settlement := &Settlement{
		ID: generateID("settle"), MerchantID: req.MerchantID,
		Amount: totalAmt, Fee: totalFee, NetAmount: totalAmt - totalFee,
		Currency: m.Currency, TxnCount: len(unsettled),
		Period: time.Now().Format("2006-01"), Status: "completed",
		AccountNum: m.SettlementAcct, SettledAt: time.Now(),
		CreatedAt: time.Now(),
	}

	mu.Lock()
	settlements[settlement.ID] = settlement
	for _, txn := range unsettled {
		txn.Status = "settled"
	}
	mu.Unlock()

	writeJSON(w, 200, settlement)
}

func handleGetMerchantAnalytics(w http.ResponseWriter, r *http.Request) {
	merchantID := r.URL.Query().Get("merchant_id")

	mu.RLock()
	m := merchants[merchantID]
	var txns []*MerchantTxn
	for _, txn := range merchantTxns {
		if txn.MerchantID == merchantID {
			txns = append(txns, txn)
		}
	}
	mu.RUnlock()

	if m == nil {
		writeJSON(w, 404, map[string]string{"error": "merchant not found"}); return
	}

	totalRev := 0.0
	totalFees := 0.0
	for _, txn := range txns {
		totalRev += txn.Amount
		totalFees += txn.Fee
	}
	avgTxn := 0.0
	if len(txns) > 0 { avgTxn = totalRev / float64(len(txns)) }

	analytics := MerchantAnalytics{
		MerchantID: merchantID, Period: time.Now().Format("2006-01"),
		TotalRevenue: totalRev, TotalFees: totalFees,
		NetRevenue: totalRev - totalFees, TxnCount: len(txns),
		AvgTxnSize: avgTxn, TopProducts: []string{},
		GrowthRate: 0.0, GeneratedAt: time.Now(),
	}

	writeJSON(w, 200, analytics)
}

func handleListMerchantTransactions(w http.ResponseWriter, r *http.Request) {
	merchantID := r.URL.Query().Get("merchant_id")
	mu.RLock()
	var txns []*MerchantTxn
	for _, txn := range merchantTxns {
		if txn.MerchantID == merchantID {
			txns = append(txns, txn)
		}
	}
	mu.RUnlock()
	writeJSON(w, 200, map[string]interface{}{"transactions": txns, "total": len(txns)})
}

func handleListInvoices(w http.ResponseWriter, r *http.Request) {
	merchantID := r.URL.Query().Get("merchant_id")
	mu.RLock()
	var invs []*Invoice
	for _, inv := range invoices {
		if inv.MerchantID == merchantID {
			invs = append(invs, inv)
		}
	}
	mu.RUnlock()
	writeJSON(w, 200, map[string]interface{}{"invoices": invs, "total": len(invs)})
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/merchants/onboard", handleOnboardMerchant)
	mux.HandleFunc("/merchants/approve", handleApproveMerchant)
	mux.HandleFunc("/pos/register", handleRegisterTerminal)
	mux.HandleFunc("/pos/process", handleProcessPOS)
	mux.HandleFunc("/invoices/create", handleCreateInvoice)
	mux.HandleFunc("/invoices/pay", handlePayInvoice)
	mux.HandleFunc("/invoices", handleListInvoices)
	mux.HandleFunc("/settlements/run", handleRunSettlement)
	mux.HandleFunc("/transactions", handleListMerchantTransactions)
	mux.HandleFunc("/analytics", handleGetMerchantAnalytics)

	handler := corsMiddleware(mux)
	port := "8117"
	log.Printf("Merchant & Business service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
