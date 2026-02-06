package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type PaymentStatus string

const (
	PaymentPending    PaymentStatus = "pending"
	PaymentProcessing PaymentStatus = "processing"
	PaymentCompleted  PaymentStatus = "completed"
	PaymentFailed     PaymentStatus = "failed"
	PaymentRefunded   PaymentStatus = "refunded"
)

type PaymentMethod string

const (
	MethodCard        PaymentMethod = "card"
	MethodBankTransfer PaymentMethod = "bank_transfer"
	MethodMobileMoney PaymentMethod = "mobile_money"
	MethodUSSD        PaymentMethod = "ussd"
	MethodQR          PaymentMethod = "qr"
	MethodWallet      PaymentMethod = "wallet"
)

type Payment struct {
	ID            string        `json:"id"`
	UserID        string        `json:"user_id"`
	Amount        float64       `json:"amount"`
	Currency      string        `json:"currency"`
	Method        PaymentMethod `json:"method"`
	Status        PaymentStatus `json:"status"`
	Description   string        `json:"description"`
	Reference     string        `json:"reference"`
	Gateway       string        `json:"gateway"`
	GatewayRef    string        `json:"gateway_ref"`
	RecipientID   string        `json:"recipient_id,omitempty"`
	RecipientName string        `json:"recipient_name,omitempty"`
	Fee           float64       `json:"fee"`
	Metadata      map[string]string `json:"metadata,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	CompletedAt   *time.Time    `json:"completed_at,omitempty"`
}

type MobileMoneyTxn struct {
	ID          string        `json:"id"`
	UserID      string        `json:"user_id"`
	Provider    string        `json:"provider"`
	PhoneNumber string        `json:"phone_number"`
	Amount      float64       `json:"amount"`
	Currency    string        `json:"currency"`
	Direction   string        `json:"direction"`
	Status      PaymentStatus `json:"status"`
	Reference   string        `json:"reference"`
	CreatedAt   time.Time     `json:"created_at"`
}

type QRPayment struct {
	ID          string        `json:"id"`
	MerchantID  string        `json:"merchant_id"`
	Amount      float64       `json:"amount"`
	Currency    string        `json:"currency"`
	QRData      string        `json:"qr_data"`
	Status      PaymentStatus `json:"status"`
	PayerID     string        `json:"payer_id,omitempty"`
	ExpiresAt   time.Time     `json:"expires_at"`
	CreatedAt   time.Time     `json:"created_at"`
}

type BillSplit struct {
	ID           string         `json:"id"`
	CreatorID    string         `json:"creator_id"`
	Title        string         `json:"title"`
	TotalAmount  float64        `json:"total_amount"`
	Currency     string         `json:"currency"`
	Participants []SplitShare   `json:"participants"`
	Status       string         `json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
}

type SplitShare struct {
	UserID   string  `json:"user_id"`
	Amount   float64 `json:"amount"`
	Paid     bool    `json:"paid"`
	PaidAt   *time.Time `json:"paid_at,omitempty"`
}

type Reconciliation struct {
	ID              string    `json:"id"`
	Period          string    `json:"period"`
	TotalPayments   int       `json:"total_payments"`
	TotalAmount     float64   `json:"total_amount"`
	TotalFees       float64   `json:"total_fees"`
	Matched         int       `json:"matched"`
	Unmatched       int       `json:"unmatched"`
	Discrepancies   []string  `json:"discrepancies"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"created_at"`
}

type Refund struct {
	ID          string    `json:"id"`
	PaymentID   string    `json:"payment_id"`
	Amount      float64   `json:"amount"`
	Reason      string    `json:"reason"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
}

type PaymentSchedule struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	RecipientID string    `json:"recipient_id"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	Frequency   string    `json:"frequency"`
	NextRunAt   time.Time `json:"next_run_at"`
	Description string    `json:"description"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at"`
}

var (
	payments       = make(map[string]*Payment)
	mobileMoneyTxns = make(map[string]*MobileMoneyTxn)
	qrPayments     = make(map[string]*QRPayment)
	billSplits     = make(map[string]*BillSplit)
	refunds        = make(map[string]*Refund)
	reconciliations = make(map[string]*Reconciliation)
	schedules      = make(map[string]*PaymentSchedule)
	mu             sync.RWMutex
	idCounter      int64
)

func generateID(prefix string) string {
	mu.Lock()
	idCounter++
	id := idCounter
	mu.Unlock()
	return fmt.Sprintf("%s_%d_%d", prefix, time.Now().UnixMilli(), id)
}

func computeHMAC(data, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
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
		if r.Method == "OPTIONS" {
			w.WriteHeader(200)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func calculateFee(amount float64, method PaymentMethod, currency string) float64 {
	switch method {
	case MethodCard:
		fee := amount * 0.015
		if fee > 2000 { fee = 2000 }
		return fee
	case MethodBankTransfer:
		if amount <= 5000 { return 10 }
		if amount <= 50000 { return 25 }
		return 50
	case MethodMobileMoney:
		return amount * 0.01
	case MethodUSSD:
		return amount * 0.0075
	case MethodQR:
		return amount * 0.005
	case MethodWallet:
		return 0
	}
	return amount * 0.015
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]interface{}{
		"status":  "healthy",
		"service": "payment-processing",
		"version": "1.0.0",
		"time":    time.Now().UTC(),
	})
}

func handleInitiatePayment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string            `json:"user_id"`
		Amount      float64           `json:"amount"`
		Currency    string            `json:"currency"`
		Method      PaymentMethod     `json:"method"`
		Description string            `json:"description"`
		Gateway     string            `json:"gateway"`
		RecipientID string            `json:"recipient_id"`
		RecipientName string          `json:"recipient_name"`
		Metadata    map[string]string `json:"metadata"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	if req.Currency == "" { req.Currency = "NGN" }
	if req.Gateway == "" { req.Gateway = "paystack" }

	fee := calculateFee(req.Amount, req.Method, req.Currency)
	ref := generateID("pay")

	payment := &Payment{
		ID:            ref,
		UserID:        req.UserID,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Method:        req.Method,
		Status:        PaymentPending,
		Description:   req.Description,
		Reference:     ref,
		Gateway:       req.Gateway,
		GatewayRef:    computeHMAC(ref, "payment-secret")[:16],
		RecipientID:   req.RecipientID,
		RecipientName: req.RecipientName,
		Fee:           fee,
		Metadata:      req.Metadata,
		CreatedAt:     time.Now(),
	}

	mu.Lock()
	payments[ref] = payment
	mu.Unlock()

	writeJSON(w, 201, map[string]interface{}{
		"payment":    payment,
		"total":      req.Amount + fee,
		"fee":        fee,
		"gateway_url": fmt.Sprintf("https://%s.com/pay/%s", req.Gateway, payment.GatewayRef),
	})
}

func handleVerifyPayment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PaymentID  string `json:"payment_id"`
		GatewayRef string `json:"gateway_ref"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.Lock()
	payment := payments[req.PaymentID]
	if payment != nil && payment.Status == PaymentPending {
		payment.Status = PaymentCompleted
		now := time.Now()
		payment.CompletedAt = &now
	}
	mu.Unlock()

	if payment == nil {
		writeJSON(w, 404, map[string]string{"error": "payment not found"})
		return
	}

	writeJSON(w, 200, payment)
}

func handleRefund(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PaymentID string  `json:"payment_id"`
		Amount    float64 `json:"amount"`
		Reason    string  `json:"reason"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.RLock()
	payment := payments[req.PaymentID]
	mu.RUnlock()

	if payment == nil {
		writeJSON(w, 404, map[string]string{"error": "payment not found"})
		return
	}
	if payment.Status != PaymentCompleted {
		writeJSON(w, 400, map[string]string{"error": "only completed payments can be refunded"})
		return
	}

	refundAmt := req.Amount
	if refundAmt == 0 { refundAmt = payment.Amount }

	refund := &Refund{
		ID:        generateID("ref"),
		PaymentID: req.PaymentID,
		Amount:    refundAmt,
		Reason:    req.Reason,
		Status:    "completed",
		CreatedAt: time.Now(),
	}

	mu.Lock()
	refunds[refund.ID] = refund
	payment.Status = PaymentRefunded
	mu.Unlock()

	writeJSON(w, 200, refund)
}

func handleMobileMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string  `json:"user_id"`
		Provider    string  `json:"provider"`
		PhoneNumber string  `json:"phone_number"`
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		Direction   string  `json:"direction"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	providers := map[string]bool{
		"mpesa": true, "mtn_momo": true, "airtel_money": true,
		"orange_money": true, "vodafone_cash": true, "tigo_pesa": true,
	}
	if !providers[req.Provider] {
		writeJSON(w, 400, map[string]string{"error": "unsupported provider"})
		return
	}

	txn := &MobileMoneyTxn{
		ID:          generateID("mm"),
		UserID:      req.UserID,
		Provider:    req.Provider,
		PhoneNumber: req.PhoneNumber,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Direction:   req.Direction,
		Status:      PaymentCompleted,
		Reference:   generateID("mmref"),
		CreatedAt:   time.Now(),
	}

	mu.Lock()
	mobileMoneyTxns[txn.ID] = txn
	mu.Unlock()

	writeJSON(w, 200, txn)
}

func handleGenerateQR(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MerchantID string  `json:"merchant_id"`
		Amount     float64 `json:"amount"`
		Currency   string  `json:"currency"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	qr := &QRPayment{
		ID:         generateID("qr"),
		MerchantID: req.MerchantID,
		Amount:     req.Amount,
		Currency:   req.Currency,
		QRData:     fmt.Sprintf("fintech://pay?id=%s&amount=%.2f&currency=%s", generateID("qr"), req.Amount, req.Currency),
		Status:     PaymentPending,
		ExpiresAt:  time.Now().Add(15 * time.Minute),
		CreatedAt:  time.Now(),
	}

	mu.Lock()
	qrPayments[qr.ID] = qr
	mu.Unlock()

	writeJSON(w, 201, qr)
}

func handlePayQR(w http.ResponseWriter, r *http.Request) {
	var req struct {
		QRID    string `json:"qr_id"`
		PayerID string `json:"payer_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.Lock()
	qr := qrPayments[req.QRID]
	if qr != nil {
		if time.Now().After(qr.ExpiresAt) {
			mu.Unlock()
			writeJSON(w, 400, map[string]string{"error": "QR code expired"})
			return
		}
		qr.PayerID = req.PayerID
		qr.Status = PaymentCompleted
	}
	mu.Unlock()

	if qr == nil {
		writeJSON(w, 404, map[string]string{"error": "QR payment not found"})
		return
	}

	writeJSON(w, 200, qr)
}

func handleCreateBillSplit(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CreatorID    string       `json:"creator_id"`
		Title        string       `json:"title"`
		TotalAmount  float64      `json:"total_amount"`
		Currency     string       `json:"currency"`
		Participants []struct {
			UserID string  `json:"user_id"`
			Amount float64 `json:"amount"`
		} `json:"participants"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	var shares []SplitShare
	for _, p := range req.Participants {
		shares = append(shares, SplitShare{
			UserID: p.UserID,
			Amount: p.Amount,
			Paid:   p.UserID == req.CreatorID,
		})
	}

	split := &BillSplit{
		ID:           generateID("split"),
		CreatorID:    req.CreatorID,
		Title:        req.Title,
		TotalAmount:  req.TotalAmount,
		Currency:     req.Currency,
		Participants: shares,
		Status:       "active",
		CreatedAt:    time.Now(),
	}

	mu.Lock()
	billSplits[split.ID] = split
	mu.Unlock()

	writeJSON(w, 201, split)
}

func handleSettleBillShare(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SplitID string `json:"split_id"`
		UserID  string `json:"user_id"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	mu.Lock()
	split := billSplits[req.SplitID]
	if split != nil {
		allPaid := true
		for i := range split.Participants {
			if split.Participants[i].UserID == req.UserID {
				split.Participants[i].Paid = true
				now := time.Now()
				split.Participants[i].PaidAt = &now
			}
			if !split.Participants[i].Paid {
				allPaid = false
			}
		}
		if allPaid {
			split.Status = "settled"
		}
	}
	mu.Unlock()

	if split == nil {
		writeJSON(w, 404, map[string]string{"error": "split not found"})
		return
	}

	writeJSON(w, 200, split)
}

func handleReconcile(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	totalPayments := 0
	totalAmount := 0.0
	totalFees := 0.0
	var discrepancies []string

	for _, p := range payments {
		totalPayments++
		totalAmount += p.Amount
		totalFees += p.Fee
		if p.Status == PaymentCompleted && p.CompletedAt == nil {
			discrepancies = append(discrepancies, fmt.Sprintf("Payment %s completed but no timestamp", p.ID))
		}
	}
	mu.RUnlock()

	recon := &Reconciliation{
		ID:            generateID("recon"),
		Period:        time.Now().Format("2006-01"),
		TotalPayments: totalPayments,
		TotalAmount:   totalAmount,
		TotalFees:     totalFees,
		Matched:       totalPayments - len(discrepancies),
		Unmatched:     len(discrepancies),
		Discrepancies: discrepancies,
		Status:        "completed",
		CreatedAt:     time.Now(),
	}

	mu.Lock()
	reconciliations[recon.ID] = recon
	mu.Unlock()

	writeJSON(w, 200, recon)
}

func handleSchedulePayment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID      string  `json:"user_id"`
		RecipientID string  `json:"recipient_id"`
		Amount      float64 `json:"amount"`
		Currency    string  `json:"currency"`
		Frequency   string  `json:"frequency"`
		Description string  `json:"description"`
	}
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid request"})
		return
	}

	var nextRun time.Time
	switch req.Frequency {
	case "daily":
		nextRun = time.Now().Add(24 * time.Hour)
	case "weekly":
		nextRun = time.Now().Add(7 * 24 * time.Hour)
	case "monthly":
		nextRun = time.Now().AddDate(0, 1, 0)
	default:
		writeJSON(w, 400, map[string]string{"error": "invalid frequency"})
		return
	}

	schedule := &PaymentSchedule{
		ID:          generateID("sched"),
		UserID:      req.UserID,
		RecipientID: req.RecipientID,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Frequency:   req.Frequency,
		NextRunAt:   nextRun,
		Description: req.Description,
		Active:      true,
		CreatedAt:   time.Now(),
	}

	mu.Lock()
	schedules[schedule.ID] = schedule
	mu.Unlock()

	writeJSON(w, 201, schedule)
}

func handleGetPaymentHistory(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mu.RLock()
	var userPayments []*Payment
	for _, p := range payments {
		if p.UserID == userID {
			userPayments = append(userPayments, p)
		}
	}
	mu.RUnlock()

	writeJSON(w, 200, map[string]interface{}{
		"payments": userPayments,
		"total":    len(userPayments),
	})
}

func handleGetPayment(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/payments/")
	mu.RLock()
	p := payments[id]
	mu.RUnlock()
	if p == nil {
		writeJSON(w, 404, map[string]string{"error": "payment not found"})
		return
	}
	writeJSON(w, 200, p)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/payments/initiate", handleInitiatePayment)
	mux.HandleFunc("/payments/verify", handleVerifyPayment)
	mux.HandleFunc("/payments/refund", handleRefund)
	mux.HandleFunc("/payments/history", handleGetPaymentHistory)
	mux.HandleFunc("/payments/", handleGetPayment)
	mux.HandleFunc("/mobile-money/transfer", handleMobileMoneyTransfer)
	mux.HandleFunc("/qr/generate", handleGenerateQR)
	mux.HandleFunc("/qr/pay", handlePayQR)
	mux.HandleFunc("/bill-split/create", handleCreateBillSplit)
	mux.HandleFunc("/bill-split/settle", handleSettleBillShare)
	mux.HandleFunc("/reconciliation/run", handleReconcile)
	mux.HandleFunc("/schedule/create", handleSchedulePayment)

	handler := corsMiddleware(mux)
	port := "8114"
	log.Printf("Payment Processing service starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
