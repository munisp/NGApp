package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"mobile-money-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListProviders(w http.ResponseWriter, r *http.Request) {
	providers := []map[string]interface{}{
		{"id": "opay", "name": "OPay", "country": "NG", "active": true, "channels": []string{"wallet", "bank"}, "fee_pct": 0.5},
		{"id": "paystack", "name": "Paystack", "country": "NG", "active": true, "channels": []string{"card", "bank", "ussd"}, "fee_pct": 1.5},
		{"id": "mpesa", "name": "M-Pesa", "country": "KE", "active": true, "channels": []string{"wallet"}, "fee_pct": 0.3},
		{"id": "mtn_momo", "name": "MTN MoMo", "country": "GH", "active": true, "channels": []string{"wallet"}, "fee_pct": 0.5},
		{"id": "flutterwave", "name": "Flutterwave", "country": "NG", "active": true, "channels": []string{"card", "bank", "mpesa"}, "fee_pct": 1.4},
		{"id": "nibss", "name": "NIBSS NIP", "country": "NG", "active": true, "channels": []string{"bank"}, "fee_pct": 0.1},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"providers": providers})
}

func (h *Handler) InitiateCollection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	txID := fmt.Sprintf("MM-COL-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"transaction_id": txID, "type": "collection", "status": "pending",
		"provider": req["provider"], "amount": req["amount"], "currency": "NGN",
		"created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) InitiateDisbursement(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	txID := fmt.Sprintf("MM-DIS-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"transaction_id": txID, "type": "disbursement", "status": "processing",
		"provider": req["provider"], "amount": req["amount"], "currency": "NGN",
	})
}

func (h *Handler) GetTransactionStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"transaction_id": id, "status": "completed", "completed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) ProviderCallback(w http.ResponseWriter, r *http.Request) {
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
