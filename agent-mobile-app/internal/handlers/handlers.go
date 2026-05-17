package handlers

import (
	"encoding/json"
	"agent-mobile-app/internal/service"
	"net/http"
)

type AgentMobileHandler struct{ svc *service.AgentMobileService }
func NewAgentMobileHandler(svc *service.AgentMobileService) *AgentMobileHandler { return &AgentMobileHandler{svc: svc} }

func (h *AgentMobileHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/agent/{code}/dashboard", h.GetDashboard)
	mux.HandleFunc("GET /api/v1/agent/{code}/profile", h.GetProfile)
	mux.HandleFunc("POST /api/v1/agent/device", h.RegisterDevice)
	mux.HandleFunc("POST /api/v1/agent/leads", h.CreateLead)
	mux.HandleFunc("GET /api/v1/agent/{code}/leads", h.GetLeads)
	mux.HandleFunc("PUT /api/v1/agent/leads/{id}", h.UpdateLead)
	mux.HandleFunc("POST /api/v1/agent/quotes", h.CreateQuote)
	mux.HandleFunc("GET /api/v1/agent/{code}/quotes", h.GetQuotes)
	mux.HandleFunc("GET /api/v1/agent/{code}/activities", h.GetActivities)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *AgentMobileHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetDashboard(r.Context(), r.PathValue("code"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *AgentMobileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetProfile(r.Context(), r.PathValue("code"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *AgentMobileHandler) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.RegisterDevice(r.Context(), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "registered"})
}
func (h *AgentMobileHandler) CreateLead(w http.ResponseWriter, r *http.Request) {
	var req service.CreateLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.CreateLead(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *AgentMobileHandler) GetLeads(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetLeads(r.Context(), r.PathValue("code"), r.URL.Query().Get("status"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *AgentMobileHandler) UpdateLead(w http.ResponseWriter, r *http.Request) {
	var req service.UpdateLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.UpdateLead(r.Context(), r.PathValue("id"), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "updated"})
}
func (h *AgentMobileHandler) CreateQuote(w http.ResponseWriter, r *http.Request) {
	var req service.CreateQuoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.CreateQuote(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *AgentMobileHandler) GetQuotes(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetQuotes(r.Context(), r.PathValue("code"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *AgentMobileHandler) GetActivities(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetActivities(r.Context(), r.PathValue("code"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *AgentMobileHandler) HealthCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "healthy", "service": "agent-mobile-app"}) }
func (h *AgentMobileHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "ready", "service": "agent-mobile-app"}) }

func wj(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}
func we(w http.ResponseWriter, status int, msg string) { wj(w, status, map[string]string{"error": msg}) }
