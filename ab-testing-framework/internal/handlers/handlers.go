package handlers

import (
	"encoding/json"
	"net/http"
	"ab-testing-framework/internal/service"

	"github.com/google/uuid"
)

type ABTestHandler struct {
	svc *service.ABTestService
}

func NewABTestHandler(svc *service.ABTestService) *ABTestHandler {
	return &ABTestHandler{svc: svc}
}

func (h *ABTestHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/experiments", h.CreateExperiment)
	mux.HandleFunc("GET /api/v1/experiments", h.ListExperiments)
	mux.HandleFunc("GET /api/v1/experiments/{id}", h.GetExperiment)
	mux.HandleFunc("POST /api/v1/experiments/{id}/variants", h.AddVariant)
	mux.HandleFunc("GET /api/v1/experiments/{id}/variants", h.GetVariants)
	mux.HandleFunc("POST /api/v1/experiments/{id}/start", h.StartExperiment)
	mux.HandleFunc("POST /api/v1/experiments/{id}/stop", h.StopExperiment)
	mux.HandleFunc("POST /api/v1/experiments/{id}/assign", h.AssignUser)
	mux.HandleFunc("POST /api/v1/experiments/metrics", h.RecordMetric)
	mux.HandleFunc("POST /api/v1/experiments/{id}/results", h.CalculateResults)
	mux.HandleFunc("GET /api/v1/experiments/{id}/results", h.GetResults)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *ABTestHandler) CreateExperiment(w http.ResponseWriter, r *http.Request) {
	var req service.CreateExperimentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error()); return
	}
	result, err := h.svc.CreateExperiment(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *ABTestHandler) ListExperiments(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	module := r.URL.Query().Get("module")
	results, err := h.svc.GetExperiments(r.Context(), status, module)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *ABTestHandler) GetExperiment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	result, err := h.svc.GetExperiment(r.Context(), id)
	if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *ABTestHandler) AddVariant(w http.ResponseWriter, r *http.Request) {
	expID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	var req service.AddVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error()); return
	}
	result, err := h.svc.AddVariant(r.Context(), expID, req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *ABTestHandler) GetVariants(w http.ResponseWriter, r *http.Request) {
	expID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	results, err := h.svc.GetVariants(r.Context(), expID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *ABTestHandler) StartExperiment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	if err := h.svc.StartExperiment(r.Context(), id); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error()); return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "running"})
}

func (h *ABTestHandler) StopExperiment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	if err := h.svc.StopExperiment(r.Context(), id); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error()); return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "completed"})
}

func (h *ABTestHandler) AssignUser(w http.ResponseWriter, r *http.Request) {
	expID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	var req struct { UserID string `json:"user_id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error()); return
	}
	result, err := h.svc.AssignUser(r.Context(), expID, req.UserID)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *ABTestHandler) RecordMetric(w http.ResponseWriter, r *http.Request) {
	var req service.RecordMetricRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error()); return
	}
	if err := h.svc.RecordMetric(r.Context(), req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error()); return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "recorded"})
}

func (h *ABTestHandler) CalculateResults(w http.ResponseWriter, r *http.Request) {
	expID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	results, err := h.svc.CalculateResults(r.Context(), expID)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, results)
}

func (h *ABTestHandler) GetResults(w http.ResponseWriter, r *http.Request) {
	expID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid experiment ID"); return }
	results, err := h.svc.GetResults(r.Context(), expID)
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *ABTestHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "ab-testing-framework"})
}

func (h *ABTestHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "ab-testing-framework"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
