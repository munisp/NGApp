package handlers

import (
	"actuarial-module/internal/service"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
)

type ActuarialHandler struct {
	svc *service.ActuarialService
}

func NewActuarialHandler(svc *service.ActuarialService) *ActuarialHandler {
	return &ActuarialHandler{svc: svc}
}

func (h *ActuarialHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/actuarial/premium/life", h.CalculateLifePremium)
	mux.HandleFunc("POST /api/v1/actuarial/premium/motor", h.CalculateMotorPremium)
	mux.HandleFunc("POST /api/v1/actuarial/reserves", h.CalculateReserves)
	mux.HandleFunc("GET /api/v1/actuarial/reserves/{policyId}", h.GetReservesByPolicy)
	mux.HandleFunc("POST /api/v1/actuarial/ibnr", h.CalculateIBNR)
	mux.HandleFunc("POST /api/v1/actuarial/rbc", h.CalculateRBC)
	mux.HandleFunc("GET /api/v1/actuarial/rbc/latest", h.GetLatestRBC)
	mux.HandleFunc("POST /api/v1/actuarial/solvency", h.CalculateSolvency)
	mux.HandleFunc("POST /api/v1/actuarial/loss-ratio", h.CalculateLossRatio)
	mux.HandleFunc("GET /api/v1/actuarial/loss-ratio/{productLine}", h.GetLossRatioTrend)
	mux.HandleFunc("POST /api/v1/actuarial/experience-study", h.RunExperienceStudy)
	mux.HandleFunc("GET /api/v1/actuarial/experience-studies", h.ListExperienceStudies)
	mux.HandleFunc("POST /api/v1/actuarial/naicom/reports", h.GenerateNAICOMReport)
	mux.HandleFunc("GET /api/v1/actuarial/naicom/reports", h.ListNAICOMReports)
	mux.HandleFunc("GET /api/v1/actuarial/naicom/reports/{id}", h.GetNAICOMReport)
	mux.HandleFunc("POST /api/v1/actuarial/naicom/reports/{id}/submit", h.SubmitNAICOMReport)
	mux.HandleFunc("GET /api/v1/actuarial/mortality-tables", h.ListMortalityTables)
	mux.HandleFunc("GET /api/v1/actuarial/pricing-configs", h.ListPricingConfigs)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *ActuarialHandler) CalculateLifePremium(w http.ResponseWriter, r *http.Request) {
	var req service.LifePremiumRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateLifePremium(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) CalculateMotorPremium(w http.ResponseWriter, r *http.Request) {
	var req service.MotorPremiumRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateMotorPremium(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) CalculateReserves(w http.ResponseWriter, r *http.Request) {
	var req service.ReserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateReserves(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) GetReservesByPolicy(w http.ResponseWriter, r *http.Request) {
	policyID := r.PathValue("policyId")
	if policyID == "" {
		writeError(w, http.StatusBadRequest, "policy ID required")
		return
	}
	results, err := h.svc.GetReservesByPolicy(r.Context(), policyID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) CalculateIBNR(w http.ResponseWriter, r *http.Request) {
	var req service.IBNRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateIBNR(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) CalculateRBC(w http.ResponseWriter, r *http.Request) {
	var req service.RBCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateRBC(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) GetLatestRBC(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.GetLatestRBC(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) CalculateSolvency(w http.ResponseWriter, r *http.Request) {
	var req service.SolvencyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateSolvency(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) CalculateLossRatio(w http.ResponseWriter, r *http.Request) {
	var req service.LossRatioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.CalculateLossRatio(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) GetLossRatioTrend(w http.ResponseWriter, r *http.Request) {
	productLine := r.PathValue("productLine")
	results, err := h.svc.GetLossRatioTrend(r.Context(), productLine, 12)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) RunExperienceStudy(w http.ResponseWriter, r *http.Request) {
	var req service.ExperienceStudyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.RunExperienceStudy(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) ListExperienceStudies(w http.ResponseWriter, r *http.Request) {
	studyType := r.URL.Query().Get("type")
	results, err := h.svc.GetExperienceStudies(r.Context(), studyType)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) GenerateNAICOMReport(w http.ResponseWriter, r *http.Request) {
	var req service.NAICOMReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	result, err := h.svc.GenerateNAICOMReport(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (h *ActuarialHandler) ListNAICOMReports(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("type")
	period := r.URL.Query().Get("period")
	results, err := h.svc.ListNAICOMReports(r.Context(), reportType, period)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) GetNAICOMReport(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid report ID")
		return
	}
	result, err := h.svc.GetNAICOMReport(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "report not found")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ActuarialHandler) SubmitNAICOMReport(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid report ID")
		return
	}
	submitterID := uuid.New() // In production, extract from auth context
	if err := h.svc.SubmitNAICOMReport(r.Context(), id, submitterID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "submitted"})
}

func (h *ActuarialHandler) ListMortalityTables(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetMortalityTables(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) ListPricingConfigs(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetPricingConfigs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *ActuarialHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "actuarial-module"})
}

func (h *ActuarialHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "actuarial-module"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
