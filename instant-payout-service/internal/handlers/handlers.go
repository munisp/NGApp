package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"instant-payout-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	channels := []map[string]interface{}{
		{"channel": "mobile_money", "provider": "OPay", "active": true, "max_amount": 5000000, "fee_pct": 0.5, "estimated_time": "< 30 seconds", "currencies": []string{"NGN"}},
		{"channel": "mobile_money", "provider": "Paystack", "active": true, "max_amount": 10000000, "fee_pct": 0.4, "estimated_time": "< 1 minute", "currencies": []string{"NGN", "GHS", "KES"}},
		{"channel": "bank_transfer", "provider": "NIBSS", "active": true, "max_amount": 50000000, "fee_pct": 0.1, "estimated_time": "< 5 minutes", "currencies": []string{"NGN"}},
		{"channel": "bank_transfer", "provider": "Flutterwave", "active": true, "max_amount": 25000000, "fee_pct": 0.3, "estimated_time": "< 10 minutes", "currencies": []string{"NGN", "GHS", "KES", "ZAR"}},
		{"channel": "wallet", "provider": "Internal", "active": true, "max_amount": 1000000, "fee_pct": 0, "estimated_time": "instant", "currencies": []string{"NGN", "USD"}},
		{"channel": "ussd", "provider": "AfricasTalking", "active": true, "max_amount": 500000, "fee_pct": 0.8, "estimated_time": "< 2 minutes", "currencies": []string{"NGN", "KES"}},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"channels": channels})
}

func (h *Handler) InitiatePayout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "INVALID_INPUT", "Invalid request body")
		return
	}
	payoutID := fmt.Sprintf("PYT-%d", time.Now().UnixNano()%10000000)
	amount, _ := req["amount"].(float64)
	channel, _ := req["channel"].(string)
	currency := "NGN"
	if c, ok := req["currency"].(string); ok && c != "" {
		currency = c
	}
	feeRate := 0.005
	feeAmount := amount * feeRate
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"payout_id": payoutID, "status": "processing", "amount": amount,
		"fee_amount": feeAmount, "net_amount": amount - feeAmount,
		"currency": currency, "channel": channel,
		"reference": fmt.Sprintf("NGA-%s", payoutID),
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) GetPayoutStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		id = "PYT-0000001"
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"payout_id": id, "status": "completed", "completed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) PayoutWebhook(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"accepted": true})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{"code": code, "message": message},
	})
}
