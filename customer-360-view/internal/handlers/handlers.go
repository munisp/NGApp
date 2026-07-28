package handlers

import (
	"customer-360-view/internal/service"
	"encoding/json"
	"net/http"
)

type Customer360Handler struct{ svc *service.Customer360Service }

func NewCustomer360Handler(svc *service.Customer360Service) *Customer360Handler {
	return &Customer360Handler{svc: svc}
}

func (h *Customer360Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/customers", h.CreateProfile)
	mux.HandleFunc("GET /api/v1/customers", h.SearchCustomers)
	mux.HandleFunc("GET /api/v1/customers/{ref}/dashboard", h.GetDashboard)
	mux.HandleFunc("POST /api/v1/customers/{ref}/policies", h.AddPolicy)
	mux.HandleFunc("POST /api/v1/customers/{ref}/interactions", h.AddInteraction)
	mux.HandleFunc("POST /api/v1/customers/{ref}/risk-profile", h.CalculateRisk)
	mux.HandleFunc("POST /api/v1/customers/{ref}/segment", h.UpdateSegment)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *Customer360Handler) CreateProfile(w http.ResponseWriter, r *http.Request) {
	var req service.CreateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateProfile(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *Customer360Handler) SearchCustomers(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.SearchCustomers(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("segment"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *Customer360Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	result, err := h.svc.GetFullDashboard(r.Context(), ref)
	if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *Customer360Handler) AddPolicy(w http.ResponseWriter, r *http.Request) {
	var req service.AddPolicyRequest
	req.CustomerRef = r.PathValue("ref")
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.AddPolicy(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *Customer360Handler) AddInteraction(w http.ResponseWriter, r *http.Request) {
	var req service.AddInteractionRequest
	req.CustomerRef = r.PathValue("ref")
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.AddInteraction(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *Customer360Handler) CalculateRisk(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	result, err := h.svc.CalculateRiskProfile(r.Context(), ref)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *Customer360Handler) UpdateSegment(w http.ResponseWriter, r *http.Request) {
	ref := r.PathValue("ref")
	result, err := h.svc.UpdateSegment(r.Context(), ref)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *Customer360Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "customer-360-view"})
}

func (h *Customer360Handler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "customer-360-view"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
