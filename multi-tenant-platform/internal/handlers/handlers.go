package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"multi-tenant-platform/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListTenants(w http.ResponseWriter, r *http.Request) {
	tenants := []map[string]interface{}{
		{"id": "TEN-001", "name": "Lagos Insurance Co", "plan": "enterprise", "status": "active", "users": 45, "policies": 12500},
		{"id": "TEN-002", "name": "Abuja Micro Cover", "plan": "professional", "status": "active", "users": 12, "policies": 3400},
		{"id": "TEN-003", "name": "Kano Takaful", "plan": "starter", "status": "trial", "users": 3, "policies": 890},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"tenants": tenants, "total": len(tenants)})
}

func (h *Handler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	tenantID := fmt.Sprintf("TEN-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"tenant_id": tenantID, "name": req["name"], "plan": req["plan"], "status": "provisioning",
	})
}

func (h *Handler) ProvisionTenant(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"status": "provisioned", "database": "created", "schema": "migrated"})
}

func (h *Handler) ManageUsers(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"users": []map[string]interface{}{
			{"id": "USR-001", "email": "admin@tenant.com", "role": "admin"},
		},
	})
}

func (h *Handler) GetBilling(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"plan": "enterprise", "monthly_fee": 500000, "currency": "NGN",
		"current_usage": map[string]int{"users": 45, "policies": 12500, "api_calls": 847293},
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

func (h *Handler) UpdateFeatures(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"updated": true, "features_enabled": 12})
}
