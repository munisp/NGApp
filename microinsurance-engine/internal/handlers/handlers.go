package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"microinsurance-engine/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	products := []map[string]interface{}{
		{"id": "micro-health", "name": "Micro Health Cover", "premium_ngn": 200, "coverage_ngn": 50000, "duration_days": 30, "category": "health"},
		{"id": "micro-crop", "name": "Crop Insurance", "premium_ngn": 500, "coverage_ngn": 200000, "duration_days": 180, "category": "crop"},
		{"id": "micro-livestock", "name": "Livestock Cover", "premium_ngn": 300, "coverage_ngn": 100000, "duration_days": 365, "category": "livestock"},
		{"id": "micro-funeral", "name": "Funeral Cover", "premium_ngn": 150, "coverage_ngn": 75000, "duration_days": 30, "category": "funeral"},
		{"id": "micro-accident", "name": "Personal Accident", "premium_ngn": 250, "coverage_ngn": 150000, "duration_days": 30, "category": "accident"},
		{"id": "micro-weather", "name": "Weather Index", "premium_ngn": 400, "coverage_ngn": 180000, "duration_days": 90, "category": "parametric"},
		{"id": "micro-device", "name": "Device Protection", "premium_ngn": 100, "coverage_ngn": 30000, "duration_days": 30, "category": "device"},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"products": products, "total": len(products)})
}

func (h *Handler) Enroll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	enrollID := fmt.Sprintf("ENR-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"enrollment_id": enrollID, "status": "active", "product_id": req["product_id"],
		"customer_id": req["customer_id"], "start_date": time.Now().UTC().Format("2006-01-02"),
		"premium_paid": true,
	})
}

func (h *Handler) ListEnrollments(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"enrollments": []interface{}{}, "total": 0})
}

func (h *Handler) SubmitClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	claimID := fmt.Sprintf("MCL-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"claim_id": claimID, "status": "submitted", "enrollment_id": req["enrollment_id"],
	})
}

func (h *Handler) GetClaimStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"claim_id": id, "status": "under_review", "updated_at": time.Now().UTC().Format(time.RFC3339),
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
