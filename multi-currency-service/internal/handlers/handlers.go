package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"multi-currency-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) GetRates(w http.ResponseWriter, r *http.Request) {
	rates := []map[string]interface{}{
		{"from": "USD", "to": "NGN", "rate": 1580.50, "updated": "2026-05-16T20:00:00Z"},
		{"from": "GBP", "to": "NGN", "rate": 1995.75, "updated": "2026-05-16T20:00:00Z"},
		{"from": "EUR", "to": "NGN", "rate": 1723.30, "updated": "2026-05-16T20:00:00Z"},
		{"from": "GHS", "to": "NGN", "rate": 105.20, "updated": "2026-05-16T20:00:00Z"},
		{"from": "KES", "to": "NGN", "rate": 11.85, "updated": "2026-05-16T20:00:00Z"},
		{"from": "ZAR", "to": "NGN", "rate": 86.40, "updated": "2026-05-16T20:00:00Z"},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"rates": rates})
}

func (h *Handler) Convert(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	amountStr := r.URL.Query().Get("amount")
	amount, _ := strconv.ParseFloat(amountStr, 64)
	if amount == 0 { amount = 1000 }
	if from == "" { from = "USD" }
	if to == "" { to = "NGN" }
	rate := 1580.50
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"from": from, "to": to, "amount": amount,
		"converted": amount * rate, "rate": rate,
	})
}

func (h *Handler) RateHistory(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"history": []interface{}{}, "pair": "USD/NGN"})
}

func (h *Handler) SupportedCurrencies(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"currencies": []map[string]string{
			{"code": "NGN", "name": "Nigerian Naira", "symbol": "₦"},
			{"code": "USD", "name": "US Dollar", "symbol": "$"},
			{"code": "GBP", "name": "British Pound", "symbol": "£"},
			{"code": "EUR", "name": "Euro", "symbol": "€"},
			{"code": "GHS", "name": "Ghanaian Cedi", "symbol": "₵"},
			{"code": "KES", "name": "Kenyan Shilling", "symbol": "KSh"},
			{"code": "ZAR", "name": "South African Rand", "symbol": "R"},
		},
	})
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
