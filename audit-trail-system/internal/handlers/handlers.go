package handlers

import (
	"encoding/json"
	"net/http"
	"audit-trail-system/internal/service"

	"github.com/google/uuid"
)

type AuditHandler struct{ svc *service.AuditService }

func NewAuditHandler(svc *service.AuditService) *AuditHandler { return &AuditHandler{svc: svc} }

func (h *AuditHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/audit/events", h.RecordEvent)
	mux.HandleFunc("GET /api/v1/audit/events", h.SearchEvents)
	mux.HandleFunc("GET /api/v1/audit/events/{id}", h.GetEvent)
	mux.HandleFunc("GET /api/v1/audit/events/correlation/{correlationId}", h.GetByCorrelation)
	mux.HandleFunc("POST /api/v1/audit/policies", h.CreatePolicy)
	mux.HandleFunc("GET /api/v1/audit/policies", h.GetPolicies)
	mux.HandleFunc("POST /api/v1/audit/reports", h.GenerateReport)
	mux.HandleFunc("GET /api/v1/audit/reports", h.GetReports)
	mux.HandleFunc("POST /api/v1/audit/alert-rules", h.CreateAlertRule)
	mux.HandleFunc("GET /api/v1/audit/alerts", h.GetAlerts)
	mux.HandleFunc("POST /api/v1/audit/alerts/{id}/acknowledge", h.AcknowledgeAlert)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *AuditHandler) RecordEvent(w http.ResponseWriter, r *http.Request) {
	var req service.RecordEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.RecordEvent(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *AuditHandler) SearchEvents(w http.ResponseWriter, r *http.Request) {
	req := service.SearchEventsRequest{
		EntityType: r.URL.Query().Get("entity_type"), EntityID: r.URL.Query().Get("entity_id"),
		ActorID: r.URL.Query().Get("actor_id"), EventType: r.URL.Query().Get("event_type"),
		Module: r.URL.Query().Get("module"),
	}
	results, err := h.svc.SearchEvents(r.Context(), req)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *AuditHandler) GetEvent(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuditHandler) GetByCorrelation(w http.ResponseWriter, r *http.Request) {
	correlationID := r.PathValue("correlationId")
	results, err := h.svc.GetEventsByCorrelation(r.Context(), correlationID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *AuditHandler) CreatePolicy(w http.ResponseWriter, r *http.Request) {
	var req service.CreatePolicyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreatePolicy(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *AuditHandler) GetPolicies(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetPolicies(r.Context())
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *AuditHandler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	var req service.GenerateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.GenerateComplianceReport(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *AuditHandler) GetReports(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetReports(r.Context(), r.URL.Query().Get("type"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *AuditHandler) CreateAlertRule(w http.ResponseWriter, r *http.Request) {
	var req service.CreateAlertRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateAlertRule(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *AuditHandler) GetAlerts(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetAlerts(r.Context(), r.URL.Query().Get("status"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *AuditHandler) AcknowledgeAlert(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid alert ID"); return }
	var req struct { By string `json:"by"` }
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.svc.AcknowledgeAlert(r.Context(), id, req.By); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error()); return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "acknowledged"})
}

func (h *AuditHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "audit-trail-system"})
}

func (h *AuditHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "audit-trail-system"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
