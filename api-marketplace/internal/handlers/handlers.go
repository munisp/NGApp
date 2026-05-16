package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"api-marketplace/internal/service"
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
		{"id": "claims-api", "name": "Claims Processing API", "version": "v1", "pricing": "₦50/request", "category": "core"},
		{"id": "kyc-api", "name": "KYC Verification API", "version": "v1", "pricing": "₦100/verification", "category": "identity"},
		{"id": "payments-api", "name": "Payments API", "version": "v1", "pricing": "₦25/transaction", "category": "financial"},
		{"id": "underwriting-api", "name": "AI Underwriting API", "version": "v1", "pricing": "₦200/assessment", "category": "ai"},
		{"id": "fraud-api", "name": "Fraud Detection API", "version": "v1", "pricing": "₦75/check", "category": "security"},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"products": products, "total": len(products)})
}

func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"subscription_id": fmt.Sprintf("SUB-%d", time.Now().UnixNano()%10000000),
		"product_id": req["product_id"], "status": "active",
		"api_key": fmt.Sprintf("ngapp_%d", time.Now().UnixNano()%100000000),
	})
}

func (h *Handler) ManageKeys(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"keys": []map[string]interface{}{
			{"id": "KEY-001", "prefix": "ngapp_live_", "created": "2026-05-01", "last_used": "2026-05-16", "requests_30d": 12450},
		},
	})
}

func (h *Handler) GetUsage(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"period": "2026-05", "total_requests": 12450, "successful": 12300,
		"failed": 150, "total_cost": 622500, "currency": "NGN",
	})
}

func (h *Handler) GetDocs(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"openapi_url": "/api/v1/marketplace/openapi.json",
		"endpoints": 45, "categories": []string{"core", "identity", "financial", "ai", "security"},
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
