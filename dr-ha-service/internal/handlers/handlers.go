package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"dr-ha-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) GetHealthStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"primary": map[string]interface{}{"region": "Lagos", "status": "healthy", "latency_ms": 12},
		"secondary": map[string]interface{}{"region": "Nairobi", "status": "standby", "latency_ms": 145},
		"replication_lag_ms": 23, "last_sync": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) InitiateFailover(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"failover_id": fmt.Sprintf("FO-%d", time.Now().UnixNano()%10000000),
		"status": "initiated", "from": "Lagos", "to": "Nairobi", "estimated_time": "30 seconds",
	})
}

func (h *Handler) GetFailoverStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"status": "completed", "downtime_seconds": 12})
}

func (h *Handler) ListBackups(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"backups": []map[string]interface{}{
			{"id": "BK-001", "type": "full", "size_gb": 45.2, "created": "2026-05-16T04:00:00Z", "status": "completed"},
			{"id": "BK-002", "type": "incremental", "size_gb": 2.1, "created": "2026-05-16T16:00:00Z", "status": "completed"},
		},
	})
}

func (h *Handler) CreateBackup(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"backup_id": fmt.Sprintf("BK-%d", time.Now().UnixNano()%10000000), "status": "in_progress",
	})
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

func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"primary_status": "healthy", "secondary_status": "standby",
		"rpo_seconds": 30, "rto_seconds": 60, "last_test": "2026-05-15T04:00:00Z",
	})
}
