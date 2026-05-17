package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"takaful-module/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListPools(w http.ResponseWriter, r *http.Request) {
	pools := []map[string]interface{}{
		{"id": "POOL-001", "name": "Family Takaful Pool", "type": "family", "total_contributions": 45000000, "members": 2340, "surplus": 5200000},
		{"id": "POOL-002", "name": "General Takaful Pool", "type": "general", "total_contributions": 28000000, "members": 1560, "surplus": 3100000},
		{"id": "POOL-003", "name": "Health Takaful Pool", "type": "health", "total_contributions": 18000000, "members": 890, "surplus": 1800000},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"pools": pools})
}

func (h *Handler) CreatePool(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	poolID := fmt.Sprintf("POOL-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"pool_id": poolID, "name": req["name"], "type": req["type"], "status": "active",
	})
}

func (h *Handler) JoinPool(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"joined": true, "membership_id": fmt.Sprintf("MEM-%d", time.Now().UnixNano()%10000000)})
}

func (h *Handler) MakeContribution(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"contribution_id": fmt.Sprintf("CTR-%d", time.Now().UnixNano()%10000000), "status": "received",
	})
}

func (h *Handler) GetSurplus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"pool_id": "POOL-001", "surplus": 5200000, "currency": "NGN",
		"distribution_eligible": true, "per_member_share": 2222,
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

func (h *Handler) DistributeSurplus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"distributed": true, "total_surplus": 5200000, "members": 2340,
		"per_member": 2222, "currency": "NGN",
	})
}
