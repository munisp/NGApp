package handlers

import (
	"encoding/json"
	"microinsurance-engine/internal/service"
	"net/http"
	"strings"
)

type Handler struct {
	svc *service.MicroService
}

func NewHandler(svc *service.MicroService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/microinsurance/products", h.GetProducts)
	mux.HandleFunc("/api/v1/microinsurance/product/", h.GetProduct)
	mux.HandleFunc("/api/v1/microinsurance/enroll", h.Enroll)
	mux.HandleFunc("/api/v1/microinsurance/policy/", h.GetPolicy)
	mux.HandleFunc("/api/v1/microinsurance/policies", h.ListPolicies)
	mux.HandleFunc("/api/v1/microinsurance/claim", h.FileClaim)
	mux.HandleFunc("/api/v1/microinsurance/claim/", h.GetClaim)
	mux.HandleFunc("/api/v1/microinsurance/stats", h.GetStats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) GetProducts(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"products": h.svc.GetProducts()})
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/microinsurance/product/")
	p, err := h.svc.GetProduct(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, p)
}

func (h *Handler) Enroll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.EnrollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	policy, err := h.svc.Enroll(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, policy)
}

func (h *Handler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/microinsurance/policy/")
	p, err := h.svc.GetPolicy(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, p)
}

func (h *Handler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	customerID := r.URL.Query().Get("customer_id")
	policies := h.svc.ListPolicies(customerID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"policies": policies, "count": len(policies)})
}

func (h *Handler) FileClaim(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.ClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	claim, err := h.svc.FileClaim(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, claim)
}

func (h *Handler) GetClaim(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/microinsurance/claim/")
	c, err := h.svc.GetClaim(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, c)
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, h.svc.GetStats())
}
