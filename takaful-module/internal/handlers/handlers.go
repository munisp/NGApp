package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"takaful-module/internal/service"
)

type Handler struct {
	svc *service.TakafulService
}

func NewHandler(svc *service.TakafulService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/takaful/funds", h.GetFunds)
	mux.HandleFunc("/api/v1/takaful/fund/", h.GetFund)
	mux.HandleFunc("/api/v1/takaful/join", h.JoinFund)
	mux.HandleFunc("/api/v1/takaful/participant/", h.GetParticipant)
	mux.HandleFunc("/api/v1/takaful/participants", h.ListParticipants)
	mux.HandleFunc("/api/v1/takaful/contributions/", h.GetContributions)
	mux.HandleFunc("/api/v1/takaful/surplus/distribute", h.DistributeSurplus)
	mux.HandleFunc("/api/v1/takaful/surplus/history/", h.GetDistributions)
	mux.HandleFunc("/api/v1/takaful/compliance/check", h.ComplianceCheck)
	mux.HandleFunc("/api/v1/takaful/compliance/", h.GetCompliance)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) GetFunds(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"funds": h.svc.GetFunds()})
}

func (h *Handler) GetFund(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/takaful/fund/")
	f, err := h.svc.GetFund(id)
	if err != nil { respondError(w, http.StatusNotFound, err.Error()); return }
	respondJSON(w, http.StatusOK, f)
}

func (h *Handler) JoinFund(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	var req service.JoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { respondError(w, http.StatusBadRequest, "Invalid request"); return }
	p, err := h.svc.JoinFund(req)
	if err != nil { respondError(w, http.StatusBadRequest, err.Error()); return }
	respondJSON(w, http.StatusCreated, p)
}

func (h *Handler) GetParticipant(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/takaful/participant/")
	p, err := h.svc.GetParticipant(id)
	if err != nil { respondError(w, http.StatusNotFound, err.Error()); return }
	respondJSON(w, http.StatusOK, p)
}

func (h *Handler) ListParticipants(w http.ResponseWriter, r *http.Request) {
	fundID := r.URL.Query().Get("fund_id")
	respondJSON(w, http.StatusOK, map[string]interface{}{"participants": h.svc.ListParticipants(fundID)})
}

func (h *Handler) GetContributions(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/takaful/contributions/")
	respondJSON(w, http.StatusOK, map[string]interface{}{"contributions": h.svc.GetContributions(id)})
}

func (h *Handler) DistributeSurplus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	var req struct { FundID string `json:"fund_id"`; Period string `json:"period"` }
	json.NewDecoder(r.Body).Decode(&req)
	dist, err := h.svc.DistributeSurplus(req.FundID, req.Period)
	if err != nil { respondError(w, http.StatusBadRequest, err.Error()); return }
	respondJSON(w, http.StatusOK, dist)
}

func (h *Handler) GetDistributions(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/takaful/surplus/history/")
	respondJSON(w, http.StatusOK, map[string]interface{}{"distributions": h.svc.GetDistributions(id)})
}

func (h *Handler) ComplianceCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	var req struct { FundID string `json:"fund_id"` }
	json.NewDecoder(r.Body).Decode(&req)
	check, err := h.svc.RunComplianceCheck(req.FundID)
	if err != nil { respondError(w, http.StatusBadRequest, err.Error()); return }
	respondJSON(w, http.StatusOK, check)
}

func (h *Handler) GetCompliance(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/takaful/compliance/")
	respondJSON(w, http.StatusOK, map[string]interface{}{"compliance": h.svc.GetCompliance(id)})
}
