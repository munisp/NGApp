package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"devops-platform/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListPipelines(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"pipelines": []map[string]interface{}{
			{"id": "PL-001", "name": "platform-ci", "status": "success", "duration": "4m 32s", "trigger": "push"},
			{"id": "PL-002", "name": "deploy-staging", "status": "success", "duration": "2m 15s", "trigger": "manual"},
		},
	})
}

func (h *Handler) RunPipeline(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"run_id": fmt.Sprintf("RUN-%d", time.Now().UnixNano()%10000000), "status": "queued",
	})
}

func (h *Handler) ListDeployments(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"deployments": []map[string]interface{}{
			{"id": "DEP-001", "environment": "staging", "version": "3.0.0", "status": "running", "services": 33},
		},
	})
}

func (h *Handler) Deploy(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"deployment_id": fmt.Sprintf("DEP-%d", time.Now().UnixNano()%10000000), "status": "deploying",
	})
}

func (h *Handler) Rollback(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"status": "rolled_back", "version": "2.9.0"})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{"code": code, "message": message},
	})
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"services_total": 33, "services_healthy": 31, "services_degraded": 2,
		"deployments_today": 3, "pipeline_success_rate": 0.96,
	})
}
