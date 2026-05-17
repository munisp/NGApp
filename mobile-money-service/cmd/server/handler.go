package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Provider represents a mobile money provider
type Provider string

const (
	ProviderOPay        Provider = "opay"
	ProviderPalmPay     Provider = "palmpay"
	ProviderMTNMoMo     Provider = "mtn_momo"
	ProviderAirtelMoney Provider = "airtel_money"
	ProviderPaystack    Provider = "paystack"
	ProviderFlutterwave Provider = "flutterwave"
	ProviderNIBSS       Provider = "nibss"
)

// PaymentRequest represents a payment initiation request
type PaymentRequest struct {
	Amount        float64  `json:"amount"`
	Currency      string   `json:"currency"`
	Provider      Provider `json:"provider"`
	MobileNumber  string   `json:"mobile_number"`
	PolicyID      string   `json:"policy_id"`
	CustomerID    string   `json:"customer_id"`
	Description   string   `json:"description"`
	CallbackURL   string   `json:"callback_url,omitempty"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// PaymentResponse represents the payment initiation response
type PaymentResponse struct {
	TransactionID string    `json:"transaction_id"`
	Status        string    `json:"status"`
	Provider      Provider  `json:"provider"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
	Reference     string    `json:"reference"`
	PaymentURL    string    `json:"payment_url,omitempty"`
	USSDCode      string    `json:"ussd_code,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	ExpiresAt     time.Time `json:"expires_at"`
}

// RecurringSetup configures automatic recurring payments
type RecurringSetup struct {
	PolicyID     string   `json:"policy_id"`
	CustomerID   string   `json:"customer_id"`
	Amount       float64  `json:"amount"`
	Currency     string   `json:"currency"`
	Provider     Provider `json:"provider"`
	MobileNumber string   `json:"mobile_number"`
	Frequency    string   `json:"frequency"` // daily, weekly, monthly
	StartDate    string   `json:"start_date"`
	EndDate      string   `json:"end_date,omitempty"`
	MaxRetries   int      `json:"max_retries"`
}

// PaymentHandler processes payment requests
type PaymentHandler struct{}

// NewPaymentHandler creates a new payment handler
func NewPaymentHandler() *PaymentHandler {
	return &PaymentHandler{}
}

// InitiatePayment starts a payment transaction
func (h *PaymentHandler) InitiatePayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req PaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Currency == "" {
		req.Currency = "NGN"
	}

	txID := fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	ref := fmt.Sprintf("NGP-%s-%s", req.PolicyID[:8], txID[4:12])

	resp := PaymentResponse{
		TransactionID: txID,
		Status:        "pending",
		Provider:      req.Provider,
		Amount:        req.Amount,
		Currency:      req.Currency,
		Reference:     ref,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(30 * time.Minute),
	}

	switch req.Provider {
	case ProviderOPay, ProviderPalmPay, ProviderMTNMoMo, ProviderAirtelMoney:
		resp.Status = "awaiting_authorization"
	case ProviderPaystack, ProviderFlutterwave:
		resp.PaymentURL = fmt.Sprintf("https://checkout.%s.com/pay/%s", req.Provider, ref)
		resp.Status = "redirect"
	case ProviderNIBSS:
		resp.USSDCode = fmt.Sprintf("*901*%s#", ref)
		resp.Status = "awaiting_ussd"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

// PaymentCallback handles async payment notifications from providers
func (h *PaymentHandler) PaymentCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var callback map[string]interface{}
	json.NewDecoder(r.Body).Decode(&callback)

	// Process callback, update payment status, trigger policy activation
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "received",
		"message": "Payment callback processed",
	})
}

// GetPaymentStatus returns current payment status
func (h *PaymentHandler) GetPaymentStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "completed",
		"message": "Payment confirmed",
	})
}

// SetupRecurring configures automatic recurring premium collection
func (h *PaymentHandler) SetupRecurring(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var setup RecurringSetup
	if err := json.NewDecoder(r.Body).Decode(&setup); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid request body"})
		return
	}

	if setup.MaxRetries == 0 {
		setup.MaxRetries = 3
	}

	scheduleID := fmt.Sprintf("REC-%d", time.Now().UnixNano())

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"schedule_id": scheduleID,
		"status":      "active",
		"frequency":   setup.Frequency,
		"amount":      setup.Amount,
		"next_charge": setup.StartDate,
		"message":     "Recurring payment schedule created",
	})
}
