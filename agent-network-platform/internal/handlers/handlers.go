package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"agent-network-platform/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListAgents(w http.ResponseWriter, r *http.Request) {
	agents := []map[string]interface{}{
		{"id": "AGT-001", "name": "Adebayo Store", "tier": "gold", "region": "Lagos", "active_policies": 145, "monthly_premium": 2500000},
		{"id": "AGT-002", "name": "Chioma Insurance Hub", "tier": "silver", "region": "Abuja", "active_policies": 89, "monthly_premium": 1200000},
		{"id": "AGT-003", "name": "Musa Mobile Agent", "tier": "bronze", "region": "Kano", "active_policies": 34, "monthly_premium": 450000},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"agents": agents, "total": len(agents)})
}

func (h *Handler) RegisterAgent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	agentID := fmt.Sprintf("AGT-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"agent_id": agentID, "status": "pending_verification", "tier": "bronze",
		"name": req["name"], "region": req["region"],
	})
}

func (h *Handler) GetCommissions(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"commissions": []map[string]interface{}{
			{"month": "2026-05", "earned": 125000, "paid": 100000, "pending": 25000, "policies_sold": 23},
			{"month": "2026-04", "earned": 98000, "paid": 98000, "pending": 0, "policies_sold": 18},
		},
		"total_earned": 223000,
	})
}

func (h *Handler) GetPerformance(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id": "AGT-001", "period": "2026-05",
		"policies_sold": 23, "premium_collected": 2500000, "claims_assisted": 5,
		"customer_satisfaction": 4.5, "target_achievement_pct": 85,
	})
}

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"leaderboard": []map[string]interface{}{
			{"rank": 1, "agent": "Adebayo Store", "premium_collected": 2500000, "policies": 145},
			{"rank": 2, "agent": "Chioma Hub", "premium_collected": 1200000, "policies": 89},
		},
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

func (h *Handler) GetWallet(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id": "AGT-001", "balance": 125000, "currency": "NGN",
		"pending_commissions": 25000, "last_payout": "2026-05-15",
	})
}
