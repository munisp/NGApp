package handlers

import (
	"encoding/json"
	"net/http"

	"gamification-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"user_id": "USR-001", "level": 5, "xp": 2450, "xp_to_next": 3000,
		"title": "Insurance Champion", "badges": []string{"first_policy", "claim_warrior", "referral_king"},
		"streak_days": 12, "total_points": 15600,
	})
}

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"leaderboard": []map[string]interface{}{
			{"rank": 1, "user": "Adebayo O.", "xp": 45200, "level": 12},
			{"rank": 2, "user": "Chioma N.", "xp": 38900, "level": 10},
			{"rank": 3, "user": "Musa A.", "xp": 34500, "level": 9},
			{"rank": 4, "user": "Ngozi E.", "xp": 28700, "level": 8},
			{"rank": 5, "user": "Ibrahim K.", "xp": 22100, "level": 7},
		},
		"period": "monthly",
	})
}

func (h *Handler) ListAchievements(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"achievements": []map[string]interface{}{
			{"id": "first_policy", "name": "First Steps", "description": "Purchase your first policy", "xp": 100, "unlocked": true},
			{"id": "claim_warrior", "name": "Claim Warrior", "description": "Submit 5 claims", "xp": 500, "unlocked": true},
			{"id": "referral_king", "name": "Referral King", "description": "Refer 3 friends", "xp": 300, "unlocked": true},
			{"id": "loyalty_legend", "name": "Loyalty Legend", "description": "Maintain policy for 12 months", "xp": 1000, "unlocked": false},
			{"id": "full_coverage", "name": "Full Coverage", "description": "Have 5 active policies", "xp": 750, "unlocked": false},
		},
	})
}

func (h *Handler) GetRewards(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"rewards": []map[string]interface{}{
			{"id": "discount_10", "name": "10% Premium Discount", "cost_points": 5000, "available": true},
			{"id": "free_month", "name": "1 Month Free Cover", "cost_points": 10000, "available": true},
			{"id": "airtime_500", "name": "₦500 Airtime", "cost_points": 2000, "available": true},
		},
	})
}

func (h *Handler) ClaimReward(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"claimed": true, "message": "Reward claimed successfully"})
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

func (h *Handler) UpdateStreak(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"streak_days": 13, "xp_earned": 50, "updated": true})
}
