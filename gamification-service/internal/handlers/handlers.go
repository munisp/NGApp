package handlers

import (
	"encoding/json"
	"gamification-service/internal/service"
	"net/http"
	"strconv"
	"strings"
)

type Handler struct {
	svc *service.GamificationService
}

func NewHandler(svc *service.GamificationService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/loyalty/profile/", h.GetProfile)
	mux.HandleFunc("/api/v1/loyalty/earn", h.Earn)
	mux.HandleFunc("/api/v1/loyalty/redeem", h.Redeem)
	mux.HandleFunc("/api/v1/loyalty/rewards", h.GetRewards)
	mux.HandleFunc("/api/v1/loyalty/challenges", h.GetChallenges)
	mux.HandleFunc("/api/v1/loyalty/leaderboard", h.GetLeaderboard)
	mux.HandleFunc("/api/v1/loyalty/tiers", h.GetTiers)
	mux.HandleFunc("/api/v1/loyalty/badges", h.GetBadges)
	mux.HandleFunc("/api/v1/loyalty/badges/", h.GetEarnedBadges)
	mux.HandleFunc("/api/v1/loyalty/history/", h.GetHistory)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/loyalty/profile/")
	p, err := h.svc.GetProfile(id)
	if err != nil { respondError(w, http.StatusNotFound, err.Error()); return }
	respondJSON(w, http.StatusOK, p)
}

func (h *Handler) Earn(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	var req service.EarnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { respondError(w, http.StatusBadRequest, "Invalid request"); return }
	profile, pts, err := h.svc.EarnPoints(req)
	if err != nil { respondError(w, http.StatusBadRequest, err.Error()); return }
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"points_earned": pts, "new_balance": profile.Points, "tier": profile.Tier, "message": "Points earned successfully!",
	})
}

func (h *Handler) Redeem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	var req service.RedeemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { respondError(w, http.StatusBadRequest, "Invalid request"); return }
	red, err := h.svc.RedeemReward(req)
	if err != nil { respondError(w, http.StatusBadRequest, err.Error()); return }
	respondJSON(w, http.StatusOK, red)
}

func (h *Handler) GetRewards(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"rewards": h.svc.GetRewards()})
}

func (h *Handler) GetChallenges(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"active_challenges": h.svc.GetChallenges()})
}

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil { limit = v }
	}
	leaders := h.svc.GetLeaderboard(limit)
	var board []map[string]interface{}
	for i, p := range leaders {
		board = append(board, map[string]interface{}{
			"rank": i + 1, "name": p.Name, "points": p.Points, "tier": p.Tier,
		})
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"period": "current", "leaderboard": board})
}

func (h *Handler) GetTiers(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"tiers": h.svc.GetTiers()})
}

func (h *Handler) GetBadges(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"badges": h.svc.GetBadges()})
}

func (h *Handler) GetEarnedBadges(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/loyalty/badges/")
	respondJSON(w, http.StatusOK, map[string]interface{}{"earned_badges": h.svc.GetEarnedBadges(id)})
}

func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/loyalty/history/")
	respondJSON(w, http.StatusOK, map[string]interface{}{"history": h.svc.GetPointsHistory(id)})
}
