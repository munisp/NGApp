package handlers

import (
	"encoding/json"
	"net/http"
	"strategic-implementations/internal/service"
)

type StrategyHandler struct{ svc *service.StrategyService }
func NewStrategyHandler(svc *service.StrategyService) *StrategyHandler { return &StrategyHandler{svc: svc} }

func (h *StrategyHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/strategy/initiatives", h.CreateInitiative)
	mux.HandleFunc("GET /api/v1/strategy/initiatives", h.ListInitiatives)
	mux.HandleFunc("GET /api/v1/strategy/initiatives/{ref}", h.GetInitiative)
	mux.HandleFunc("POST /api/v1/strategy/initiatives/{ref}/progress", h.UpdateProgress)
	mux.HandleFunc("POST /api/v1/strategy/milestones", h.AddMilestone)
	mux.HandleFunc("GET /api/v1/strategy/initiatives/{ref}/milestones", h.GetMilestones)
	mux.HandleFunc("POST /api/v1/strategy/kpis", h.CreateKPI)
	mux.HandleFunc("GET /api/v1/strategy/kpis", h.GetKPIs)
	mux.HandleFunc("POST /api/v1/strategy/risks", h.AddRisk)
	mux.HandleFunc("GET /api/v1/strategy/risks", h.GetRisks)
	mux.HandleFunc("POST /api/v1/strategy/reports", h.GenerateReport)
	mux.HandleFunc("GET /api/v1/strategy/reports", h.GetReports)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *StrategyHandler) CreateInitiative(w http.ResponseWriter, r *http.Request) {
	var req service.CreateInitiativeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.CreateInitiative(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *StrategyHandler) ListInitiatives(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.ListInitiatives(r.Context(), r.URL.Query().Get("status"), r.URL.Query().Get("category"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) GetInitiative(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetInitiative(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) UpdateProgress(w http.ResponseWriter, r *http.Request) {
	var req struct { Progress float64 `json:"progress"`; Spent float64 `json:"spent_amount"` }
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.svc.UpdateProgress(r.Context(), r.PathValue("ref"), req.Progress, req.Spent); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "updated"})
}
func (h *StrategyHandler) AddMilestone(w http.ResponseWriter, r *http.Request) {
	var req service.AddMilestoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.AddMilestone(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *StrategyHandler) GetMilestones(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetMilestones(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) CreateKPI(w http.ResponseWriter, r *http.Request) {
	var req service.CreateKPIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.CreateKPI(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *StrategyHandler) GetKPIs(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetKPIs(r.Context(), r.URL.Query().Get("initiative"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) AddRisk(w http.ResponseWriter, r *http.Request) {
	var req service.AddRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.AddRisk(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *StrategyHandler) GetRisks(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetRisks(r.Context(), r.URL.Query().Get("initiative"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	var req struct { ReportType string `json:"report_type"`; Period string `json:"period"` }
	json.NewDecoder(r.Body).Decode(&req)
	res, err := h.svc.GenerateReport(r.Context(), req.ReportType, req.Period)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *StrategyHandler) GetReports(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetReports(r.Context(), r.URL.Query().Get("type"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *StrategyHandler) HealthCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "healthy", "service": "strategic-implementations"}) }
func (h *StrategyHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "ready", "service": "strategic-implementations"}) }

func wj(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}
func we(w http.ResponseWriter, status int, msg string) { wj(w, status, map[string]string{"error": msg}) }
