package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"usage-based-insurance/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	policies := []map[string]interface{}{
		{"id": "UBI-001", "vehicle": "Toyota Camry 2024", "base_premium": 45000, "current_premium": 38250, "discount_pct": 15, "score": 82},
		{"id": "UBI-002", "vehicle": "Honda Civic 2023", "base_premium": 38000, "current_premium": 34200, "discount_pct": 10, "score": 75},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"policies": policies})
}

func (h *Handler) IngestTelemetry(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{
		"ingested": true, "batch_id": fmt.Sprintf("TEL-%d", time.Now().UnixNano()%10000000),
	})
}

func (h *Handler) GetDrivingProfile(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"driver_id": "DRV-001", "overall_score": 82,
		"metrics": map[string]interface{}{
			"hard_braking": 2.3, "rapid_acceleration": 1.8, "speeding_pct": 5.2,
			"night_driving_pct": 12, "avg_daily_km": 34.5, "phone_usage_pct": 0.8,
		},
		"trend": "improving",
	})
}

func (h *Handler) GetScore(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"score": 82, "grade": "B+", "percentile": 72,
		"breakdown": map[string]int{"safety": 85, "speed": 78, "time": 80, "distance": 84},
	})
}

func (h *Handler) CalculatePremium(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"base_premium": 45000, "score_discount": 6750, "final_premium": 38250,
		"discount_pct": 15, "currency": "NGN", "valid_until": "2026-06-16",
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

func (h *Handler) GetTrips(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"trips": []map[string]interface{}{
			{"id": "TRP-001", "date": "2026-05-16", "distance_km": 23.4, "duration_min": 35, "score": 88},
			{"id": "TRP-002", "date": "2026-05-15", "distance_km": 45.2, "duration_min": 62, "score": 76},
		},
		"total": 2,
	})
}
