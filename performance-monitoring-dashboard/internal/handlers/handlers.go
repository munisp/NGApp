package handlers

import (
	"encoding/json"
	"net/http"
	"performance-monitoring-dashboard/internal/service"
	"time"
)

type PerfMonHandler struct{ svc *service.PerfMonService }

func NewPerfMonHandler(svc *service.PerfMonService) *PerfMonHandler { return &PerfMonHandler{svc: svc} }

func (h *PerfMonHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/monitoring/health", h.ReportHealth)
	mux.HandleFunc("GET /api/v1/monitoring/overview", h.GetOverview)
	mux.HandleFunc("POST /api/v1/monitoring/metrics", h.RecordMetric)
	mux.HandleFunc("GET /api/v1/monitoring/metrics", h.GetMetrics)
	mux.HandleFunc("POST /api/v1/monitoring/alert-configs", h.CreateAlertConfig)
	mux.HandleFunc("GET /api/v1/monitoring/alerts", h.GetAlerts)
	mux.HandleFunc("POST /api/v1/monitoring/sla", h.SetSLA)
	mux.HandleFunc("POST /api/v1/monitoring/sla/report", h.GenerateSLAReport)
	mux.HandleFunc("GET /api/v1/monitoring/sla/reports", h.GetSLAReports)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *PerfMonHandler) ReportHealth(w http.ResponseWriter, r *http.Request) {
	var req service.ReportHealthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.ReportHealth(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *PerfMonHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.GetPlatformOverview(r.Context())
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *PerfMonHandler) RecordMetric(w http.ResponseWriter, r *http.Request) {
	var req service.RecordMetricRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	if err := h.svc.RecordMetric(r.Context(), req); err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, map[string]string{"status": "recorded"})
}

func (h *PerfMonHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	var from, to time.Time
	results, err := h.svc.GetMetrics(r.Context(), r.URL.Query().Get("service"), r.URL.Query().Get("metric"), from, to)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *PerfMonHandler) CreateAlertConfig(w http.ResponseWriter, r *http.Request) {
	var req service.CreateAlertConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateAlertConfig(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *PerfMonHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetAlerts(r.Context(), r.URL.Query().Get("status"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *PerfMonHandler) SetSLA(w http.ResponseWriter, r *http.Request) {
	var req service.SetSLARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.SetSLA(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *PerfMonHandler) GenerateSLAReport(w http.ResponseWriter, r *http.Request) {
	var req struct { ServiceName string `json:"service_name"`; Period string `json:"period"` }
	json.NewDecoder(r.Body).Decode(&req)
	result, err := h.svc.GenerateSLAReport(r.Context(), req.ServiceName, req.Period)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *PerfMonHandler) GetSLAReports(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetSLAReports(r.Context(), r.URL.Query().Get("service"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *PerfMonHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "performance-monitoring-dashboard"})
}

func (h *PerfMonHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "performance-monitoring-dashboard"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
