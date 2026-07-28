package handlers

import (
	"encoding/json"
	"net/http"
	"niira-compulsory-insurance/internal/service"
	"strconv"

	"github.com/gorilla/mux"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/niira").Subrouter()
	api.HandleFunc("/classes", h.listClasses).Methods("GET")
	api.HandleFunc("/classes/{id}", h.getClass).Methods("GET")
	api.HandleFunc("/compliance/check", h.checkCompliance).Methods("POST")
	api.HandleFunc("/policies", h.listPolicies).Methods("GET")
	api.HandleFunc("/policies/issue", h.issuePolicy).Methods("POST")
	api.HandleFunc("/certificates", h.listCertificates).Methods("GET")
}

func (h *Handler) listClasses(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetProducts()
	json.NewEncoder(w).Encode(map[string]interface{}{"classes": p, "count": len(p), "compliance_deadline": "2026-07-30", "regulatory_framework": "NIIRA 2025"})
}

func (h *Handler) getClass(w http.ResponseWriter, r *http.Request) {
	p := h.svc.GetProduct(mux.Vars(r)["id"])
	if p == nil {
		http.Error(w, `{"error":"not found"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) checkCompliance(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BusinessName    string   `json:"business_name"`
		BusinessType    string   `json:"business_type"`
		EmployeeCount   string   `json:"employee_count"`
		ExistingClasses []string `json:"existing_classes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	emp, _ := strconv.Atoi(req.EmployeeCount)
	json.NewEncoder(w).Encode(h.svc.CheckCompliance(req.BusinessName, req.BusinessType, emp, req.ExistingClasses))
}

func (h *Handler) listPolicies(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetPolicies()
	json.NewEncoder(w).Encode(map[string]interface{}{"policies": p, "count": len(p)})
}

func (h *Handler) issuePolicy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductID    string `json:"product_id"`
		BusinessName string `json:"business_name"`
		RCNumber     string `json:"rc_number"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	p, err := h.svc.IssuePolicy(req.ProductID, req.BusinessName, req.RCNumber)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) listCertificates(w http.ResponseWriter, _ *http.Request) {
	c := h.svc.GetCertificates()
	json.NewEncoder(w).Encode(map[string]interface{}{"certificates": c, "count": len(c)})
}
