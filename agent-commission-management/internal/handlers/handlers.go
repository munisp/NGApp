package handlers

import (
	"encoding/json"
	"net/http"
	"agent-commission-management/internal/service"

	"github.com/google/uuid"
)

type CommissionHandler struct{ svc *service.CommissionService }

func NewCommissionHandler(svc *service.CommissionService) *CommissionHandler {
	return &CommissionHandler{svc: svc}
}

func (h *CommissionHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/agents", h.RegisterAgent)
	mux.HandleFunc("GET /api/v1/agents", h.ListAgents)
	mux.HandleFunc("GET /api/v1/agents/{id}", h.GetAgent)
	mux.HandleFunc("POST /api/v1/commission/structures", h.CreateStructure)
	mux.HandleFunc("GET /api/v1/commission/structures", h.ListStructures)
	mux.HandleFunc("POST /api/v1/commission/calculate", h.CalculateCommission)
	mux.HandleFunc("GET /api/v1/commission/transactions/{agentId}", h.GetTransactions)
	mux.HandleFunc("POST /api/v1/commission/approve/{agentId}", h.ApproveCommissions)
	mux.HandleFunc("POST /api/v1/commission/pay/{agentId}", h.ProcessPayment)
	mux.HandleFunc("GET /api/v1/commission/payments/{agentId}", h.GetPayments)
	mux.HandleFunc("POST /api/v1/commission/clawback", h.ProcessClawback)
	mux.HandleFunc("GET /api/v1/commission/clawbacks/{agentId}", h.GetClawbacks)
	mux.HandleFunc("POST /api/v1/agents/{id}/performance", h.CalculatePerformance)
	mux.HandleFunc("GET /api/v1/agents/{id}/performance", h.GetPerformance)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *CommissionHandler) RegisterAgent(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.RegisterAgent(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetAgents(r.Context(), r.URL.Query().Get("status"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) GetAgent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	result, err := h.svc.GetAgent(r.Context(), id)
	if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *CommissionHandler) CreateStructure(w http.ResponseWriter, r *http.Request) {
	var req service.CreateStructureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateCommissionStructure(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) ListStructures(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetStructures(r.Context())
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) CalculateCommission(w http.ResponseWriter, r *http.Request) {
	var req service.CalculateCommissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CalculateCommission(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("agentId"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	results, err := h.svc.GetTransactions(r.Context(), agentID, r.URL.Query().Get("period"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) ApproveCommissions(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("agentId"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	var req struct { ApprovedBy string `json:"approved_by"` }
	json.NewDecoder(r.Body).Decode(&req)
	count, err := h.svc.ApproveCommissions(r.Context(), agentID, req.ApprovedBy)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]interface{}{"approved_count": count})
}

func (h *CommissionHandler) ProcessPayment(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("agentId"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	result, err := h.svc.ProcessPayment(r.Context(), agentID)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("agentId"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	results, err := h.svc.GetPayments(r.Context(), agentID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) ProcessClawback(w http.ResponseWriter, r *http.Request) {
	var req service.ClawbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.ProcessClawback(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) GetClawbacks(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("agentId"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	results, err := h.svc.GetClawbacks(r.Context(), agentID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) CalculatePerformance(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	var req struct { Period string `json:"period"` }
	json.NewDecoder(r.Body).Decode(&req)
	result, err := h.svc.CalculatePerformance(r.Context(), agentID, req.Period)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *CommissionHandler) GetPerformance(w http.ResponseWriter, r *http.Request) {
	agentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid agent ID"); return }
	results, err := h.svc.GetPerformance(r.Context(), agentID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *CommissionHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "agent-commission-management"})
}

func (h *CommissionHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "agent-commission-management"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
