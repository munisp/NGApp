package handlers

import (
	"encoding/json"
	"instant-payout-service/internal/service"
	"net/http"
	"strings"
)

type Handler struct {
	svc *service.PayoutService
}

func NewHandler(svc *service.PayoutService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/payouts/initiate", h.InitiatePayout)
	mux.HandleFunc("/api/v1/payouts/batch", h.BatchPayout)
	mux.HandleFunc("/api/v1/payouts/status/", h.PayoutStatus)
	mux.HandleFunc("/api/v1/payouts/channels", h.PayoutChannels)
	mux.HandleFunc("/api/v1/payouts/list", h.ListPayouts)
	mux.HandleFunc("/api/v1/payouts/ledger/", h.PayoutLedger)
	mux.HandleFunc("/api/v1/payouts/stats", h.PayoutStats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) InitiatePayout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.InitiateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	payout, err := h.svc.InitiatePayout(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, payout)
}

func (h *Handler) BatchPayout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var requests []service.InitiateRequest
	if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	batch, err := h.svc.InitiateBatch(requests)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, batch)
}

func (h *Handler) PayoutStatus(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/payouts/status/")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Payout ID required")
		return
	}
	payout, err := h.svc.GetPayout(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, payout)
}

func (h *Handler) ListPayouts(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	payouts := h.svc.ListPayouts(status, 100)
	respondJSON(w, http.StatusOK, map[string]interface{}{"payouts": payouts, "count": len(payouts)})
}

func (h *Handler) PayoutChannels(w http.ResponseWriter, r *http.Request) {
	channels := h.svc.GetChannels()
	respondJSON(w, http.StatusOK, map[string]interface{}{"channels": channels})
}

func (h *Handler) PayoutLedger(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/payouts/ledger/")
	entries := h.svc.GetLedger(id)
	respondJSON(w, http.StatusOK, map[string]interface{}{"entries": entries})
}

func (h *Handler) PayoutStats(w http.ResponseWriter, r *http.Request) {
	stats := h.svc.GetStats()
	respondJSON(w, http.StatusOK, stats)
}
