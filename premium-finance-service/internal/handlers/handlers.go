package handlers

import (
	"encoding/json"
	"net/http"
	"premium-finance-service/internal/models"
	"premium-finance-service/internal/service"
	"strconv"
	"strings"
)

type Handler struct {
	svc *service.FinanceService
}

func NewHandler(svc *service.FinanceService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/finance/apply", h.Apply)
	mux.HandleFunc("/api/v1/finance/loan/", h.GetLoan)
	mux.HandleFunc("/api/v1/finance/loans", h.ListLoans)
	mux.HandleFunc("/api/v1/finance/schedule/", h.GetSchedule)
	mux.HandleFunc("/api/v1/finance/payment", h.MakePayment)
	mux.HandleFunc("/api/v1/finance/stats", h.GetStats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) Apply(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var app models.LoanApplication
	if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	loan, err := h.svc.ApplyForLoan(app)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, loan)
}

func (h *Handler) GetLoan(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/finance/loan/")
	loan, err := h.svc.GetLoan(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, loan)
}

func (h *Handler) ListLoans(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	loans := h.svc.ListLoans(status)
	respondJSON(w, http.StatusOK, map[string]interface{}{"loans": loans, "count": len(loans)})
}

func (h *Handler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/finance/schedule/")
	schedule := h.svc.GetSchedule(id)
	respondJSON(w, http.StatusOK, map[string]interface{}{"schedule": schedule})
}

func (h *Handler) MakePayment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req struct {
		LoanID string `json:"loan_id"`
		Number int    `json:"installment_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	_ = strconv.Itoa(req.Number)
	inst, err := h.svc.MakePayment(req.LoanID, req.Number)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, inst)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, h.svc.GetStats())
}
