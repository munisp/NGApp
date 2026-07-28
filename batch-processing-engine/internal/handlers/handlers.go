package handlers

import (
	"encoding/json"
	"net/http"
	"batch-processing-engine/internal/service"

	"github.com/google/uuid"
)

type BatchHandler struct{ svc *service.BatchService }

func NewBatchHandler(svc *service.BatchService) *BatchHandler { return &BatchHandler{svc: svc} }

func (h *BatchHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/batch/jobs", h.CreateJob)
	mux.HandleFunc("GET /api/v1/batch/jobs", h.ListJobs)
	mux.HandleFunc("GET /api/v1/batch/jobs/{id}", h.GetJob)
	mux.HandleFunc("POST /api/v1/batch/jobs/{id}/items", h.AddItems)
	mux.HandleFunc("POST /api/v1/batch/jobs/{id}/start", h.StartJob)
	mux.HandleFunc("POST /api/v1/batch/jobs/{id}/process", h.ProcessBatch)
	mux.HandleFunc("POST /api/v1/batch/jobs/{id}/cancel", h.CancelJob)
	mux.HandleFunc("POST /api/v1/batch/schedules", h.CreateSchedule)
	mux.HandleFunc("GET /api/v1/batch/schedules", h.ListSchedules)
	mux.HandleFunc("GET /api/v1/batch/metrics", h.GetMetrics)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *BatchHandler) CreateJob(w http.ResponseWriter, r *http.Request) {
	var req service.CreateJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateJob(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *BatchHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetJobs(r.Context(), r.URL.Query().Get("type"), r.URL.Query().Get("status"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *BatchHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid job ID"); return }
	result, err := h.svc.GetJob(r.Context(), id)
	if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *BatchHandler) AddItems(w http.ResponseWriter, r *http.Request) {
	jobID, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid job ID"); return }
	var items []service.BatchItemInput
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	count, err := h.svc.AddItems(r.Context(), jobID, items)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, map[string]int{"items_added": count})
}

func (h *BatchHandler) StartJob(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid job ID"); return }
	if err := h.svc.StartJob(r.Context(), id); err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]string{"status": "running"})
}

func (h *BatchHandler) ProcessBatch(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid job ID"); return }
	var req struct { BatchSize int `json:"batch_size"` }
	json.NewDecoder(r.Body).Decode(&req)
	result, err := h.svc.ProcessBatch(r.Context(), id, req.BatchSize)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, result)
}

func (h *BatchHandler) CancelJob(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil { writeError(w, http.StatusBadRequest, "invalid job ID"); return }
	if err := h.svc.CancelJob(r.Context(), id); err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

func (h *BatchHandler) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	var req service.CreateScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
	result, err := h.svc.CreateSchedule(r.Context(), req)
	if err != nil { writeError(w, http.StatusUnprocessableEntity, err.Error()); return }
	writeJSON(w, http.StatusCreated, result)
}

func (h *BatchHandler) ListSchedules(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetSchedules(r.Context())
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *BatchHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {
	results, err := h.svc.GetMetrics(r.Context(), r.URL.Query().Get("type"))
	if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
	writeJSON(w, http.StatusOK, results)
}

func (h *BatchHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy", "service": "batch-processing-engine"})
}

func (h *BatchHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "batch-processing-engine"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
