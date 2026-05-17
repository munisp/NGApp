package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"premium-finance-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans := []map[string]interface{}{
		{"id": "PF-001", "policy_id": "POL-001", "total": 120000, "installments": 12, "monthly": 10500, "interest_rate": 0.05, "status": "active"},
		{"id": "PF-002", "policy_id": "POL-002", "total": 85000, "installments": 6, "monthly": 14800, "interest_rate": 0.04, "status": "active"},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

func (h *Handler) CreatePlan(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	planID := fmt.Sprintf("PF-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"plan_id": planID, "status": "created", "policy_id": req["policy_id"],
	})
}

func (h *Handler) MakePayment(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"payment_id": fmt.Sprintf("PAY-%d", time.Now().UnixNano()%10000000), "status": "completed"})
}

func (h *Handler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"schedule": []map[string]interface{}{
			{"installment": 1, "amount": 10500, "due_date": "2026-06-01", "status": "paid"},
			{"installment": 2, "amount": 10500, "due_date": "2026-07-01", "status": "upcoming"},
		},
	})
}

func (h *Handler) GetOverdue(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"overdue": []interface{}{}, "total_overdue_amount": 0})
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
