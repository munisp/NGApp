package handlers

import (
	"encoding/json"
	"multi-currency-service/internal/service"
	"net/http"
	"strings"
)

type Handler struct {
	svc *service.CurrencyService
}

func NewHandler(svc *service.CurrencyService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/currency/rates", h.GetRates)
	mux.HandleFunc("/api/v1/currency/convert", h.Convert)
	mux.HandleFunc("/api/v1/currency/pairs", h.GetPairs)
	mux.HandleFunc("/api/v1/currency/list", h.GetCurrencies)
	mux.HandleFunc("/api/v1/currency/rate/", h.GetSingleRate)
	mux.HandleFunc("/api/v1/currency/conversion/", h.GetConversion)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) GetRates(w http.ResponseWriter, r *http.Request) {
	base := r.URL.Query().Get("base")
	rates := h.svc.GetAllRates(base)
	respondJSON(w, http.StatusOK, map[string]interface{}{"base": base, "rates": rates, "count": len(rates)})
}

func (h *Handler) Convert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.ConvertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	conv, err := h.svc.Convert(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, conv)
}

func (h *Handler) GetPairs(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"pairs": h.svc.GetPairs()})
}

func (h *Handler) GetCurrencies(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"currencies": h.svc.GetCurrencies()})
}

func (h *Handler) GetSingleRate(w http.ResponseWriter, r *http.Request) {
	pair := strings.TrimPrefix(r.URL.Path, "/api/v1/currency/rate/")
	parts := strings.Split(pair, "/")
	if len(parts) != 2 {
		respondError(w, http.StatusBadRequest, "Use /api/v1/currency/rate/{base}/{quote}")
		return
	}
	rate, err := h.svc.GetRate(parts[0], parts[1])
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, rate)
}

func (h *Handler) GetConversion(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/currency/conversion/")
	conv, err := h.svc.GetConversion(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, conv)
}
