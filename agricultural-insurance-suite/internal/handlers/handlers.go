package handlers

import (
	"agricultural-insurance-suite/internal/models"
	"agricultural-insurance-suite/internal/service"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/agricultural").Subrouter()
	api.HandleFunc("/products", h.listProducts).Methods("GET")
	api.HandleFunc("/products/{id}", h.getProduct).Methods("GET")
	api.HandleFunc("/products/category/{category}", h.getByCategory).Methods("GET")
	api.HandleFunc("/enroll", h.enrollPolicy).Methods("POST")
	api.HandleFunc("/policies", h.listPolicies).Methods("GET")
	api.HandleFunc("/trigger/evaluate", h.evaluateTrigger).Methods("POST")
	api.HandleFunc("/triggers", h.listTriggers).Methods("GET")
	api.HandleFunc("/payouts", h.listPayouts).Methods("GET")
	api.HandleFunc("/ndvi/assess", h.ndviAssess).Methods("POST")
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"products": h.svc.GetAllProducts(), "count": len(h.svc.GetAllProducts())})
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	p := h.svc.GetProduct(id)
	if p == nil {
		http.Error(w, `{"error":"product not found"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) getByCategory(w http.ResponseWriter, r *http.Request) {
	cat := mux.Vars(r)["category"]
	products := h.svc.GetProductsByCategory(cat)
	json.NewEncoder(w).Encode(map[string]interface{}{"category": cat, "products": products, "count": len(products)})
}

func (h *Handler) enrollPolicy(w http.ResponseWriter, r *http.Request) {
	var req models.EnrollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}
	policy, err := h.svc.EnrollPolicy(req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(policy)
}

func (h *Handler) listPolicies(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"policies": h.svc.GetAllPolicies()})
}

func (h *Handler) evaluateTrigger(w http.ResponseWriter, r *http.Request) {
	var req models.TriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request body"}`, 400)
		return
	}
	event, err := h.svc.EvaluateTrigger(req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(event)
}

func (h *Handler) listTriggers(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"triggers": h.svc.GetAllTriggers()})
}

func (h *Handler) listPayouts(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{"payouts": h.svc.GetAllPayouts()})
}

func (h *Handler) ndviAssess(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Region string  `json:"region"`
		Value  float64 `json:"ndvi_value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.GetNDVIAssessment(req.Region, req.Value))
}
