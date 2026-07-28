package handlers

import (
	"digital-consumer-products/internal/service"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/consumer").Subrouter()
	api.HandleFunc("/products", h.listProducts).Methods("GET")
	api.HandleFunc("/products/{id}", h.getProduct).Methods("GET")
	api.HandleFunc("/activate", h.activate).Methods("POST")
	api.HandleFunc("/policies", h.listPolicies).Methods("GET")
	api.HandleFunc("/cyber/assess", h.cyberAssess).Methods("POST")
	api.HandleFunc("/hospicash/claim", h.hospiCashClaim).Methods("POST")
	api.HandleFunc("/claims", h.listClaims).Methods("GET")
}

func (h *Handler) listProducts(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetProducts()
	json.NewEncoder(w).Encode(map[string]interface{}{"products": p, "count": len(p)})
}

func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	p := h.svc.GetProduct(mux.Vars(r)["id"])
	if p == nil {
		http.Error(w, `{"error":"not found"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) activate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductID    string `json:"product_id"`
		CustomerID   string `json:"customer_id"`
		CustomerName string `json:"customer_name"`
		Days         int    `json:"days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	if req.Days <= 0 {
		req.Days = 1
	}
	p, err := h.svc.ActivatePolicy(req.ProductID, req.CustomerID, req.CustomerName, req.Days)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) listPolicies(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetPolicies()
	json.NewEncoder(w).Encode(map[string]interface{}{"policies": p, "count": len(p)})
}

func (h *Handler) cyberAssess(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BusinessName  string `json:"business_name"`
		Industry      string `json:"industry"`
		EmployeeCount int    `json:"employee_count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(h.svc.AssessCyberRisk(req.BusinessName, req.Industry, req.EmployeeCount))
}

func (h *Handler) hospiCashClaim(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PolicyID      string `json:"policy_id"`
		HospitalName  string `json:"hospital_name"`
		AdmissionDate string `json:"admission_date"`
		DischargeDate string `json:"discharge_date"`
		DaysAdmitted  int    `json:"days_admitted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	c, err := h.svc.ProcessHospiCashClaim(req.PolicyID, req.HospitalName, req.AdmissionDate, req.DischargeDate, req.DaysAdmitted)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(c)
}

func (h *Handler) listClaims(w http.ResponseWriter, _ *http.Request) {
	c := h.svc.GetClaims()
	json.NewEncoder(w).Encode(map[string]interface{}{"claims": c, "count": len(c)})
}
