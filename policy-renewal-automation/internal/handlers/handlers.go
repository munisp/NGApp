package handlers

import (
	"encoding/json"
	"net/http"
	"policy-renewal-automation/internal/service"
	"github.com/google/uuid"
)

type RenewalHandler struct{ svc *service.RenewalService }

func NewRenewalHandler(svc *service.RenewalService) *RenewalHandler { return &RenewalHandler{svc: svc} }

func (h *RenewalHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/renewals/policies", h.RegisterPolicy)
	mux.HandleFunc("GET /api/v1/renewals/policies", h.ListPolicies)
	mux.HandleFunc("GET /api/v1/renewals/policies/{id}", h.GetPolicy)
	mux.HandleFunc("POST /api/v1/renewals/policies/{id}/quote", h.GenerateQuote)
	mux.HandleFunc("GET /api/v1/renewals/policies/{id}/quotes", h.GetQuotes)
	mux.HandleFunc("POST /api/v1/renewals/policies/{id}/accept", h.AcceptRenewal)
	mux.HandleFunc("POST /api/v1/renewals/policies/{id}/decline", h.DeclineRenewal)
	mux.HandleFunc("POST /api/v1/renewals/process", h.ProcessDueRenewals)
	mux.HandleFunc("POST /api/v1/renewals/campaigns", h.CreateCampaign)
	mux.HandleFunc("GET /api/v1/renewals/campaigns", h.ListCampaigns)
	mux.HandleFunc("POST /api/v1/renewals/metrics", h.CalculateMetrics)
	mux.HandleFunc("GET /api/v1/renewals/metrics", h.GetMetrics)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *RenewalHandler) RegisterPolicy(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterPolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.RegisterPolicy(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *RenewalHandler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetPolicies(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("type"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *RenewalHandler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid ID"); return }
	result, err := h.svc.GetPolicy(r.Context(), id)
	if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *RenewalHandler) GenerateQuote(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid ID"); return }
	result, err := h.svc.GenerateQuote(r.Context(), id)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *RenewalHandler) GetQuotes(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid ID"); return }
	results, err := h.svc.GetQuotes(r.Context(), id)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *RenewalHandler) AcceptRenewal(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid ID"); return }
	if err := h.svc.AcceptRenewal(r.Context(), id); err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]string{"status": "accepted"})
}

func (h *RenewalHandler) DeclineRenewal(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid ID"); return }
	if err := h.svc.DeclineRenewal(r.Context(), id); err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]string{"status": "declined"})
}

func (h *RenewalHandler) ProcessDueRenewals(w http.ResponseWriter, r *http.Request) {
	var req struct { DaysAhead int `json:"days_ahead"` }
	json.NewDecoder(r.Body).Decode(&req)
	if req.DaysAhead == 0 { req.DaysAhead = 90 }
	count, err := h.svc.ProcessDueRenewals(r.Context(), req.DaysAhead)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]int{"processed": count})
}

func (h *RenewalHandler) CreateCampaign(w http.ResponseWriter, r *http.Request) {
	var req service.CreateCampaignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateCampaign(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *RenewalHandler) ListCampaigns(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetCampaigns(r.Context())
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *RenewalHandler) CalculateMetrics(w http.ResponseWriter, r *http.Request) {
	var req struct { Period string `json:"period"`; PolicyType string `json:"policy_type"` }
	json.NewDecoder(r.Body).Decode(&req)
	result, err := h.svc.CalculateMetrics(r.Context(), req.Period, req.PolicyType)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *RenewalHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetMetrics(r.Context(), r.URL.Query().Get("type"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *RenewalHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "policy-renewal-automation"})
}

func (h *RenewalHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "policy-renewal-automation"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
