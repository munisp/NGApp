package handlers

import (
	"embedded-distribution-platform/internal/service"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/embedded").Subrouter()
	api.HandleFunc("/partners", h.listPartners).Methods("GET")
	api.HandleFunc("/partners/{id}", h.getPartner).Methods("GET")
	api.HandleFunc("/partners/{id}/revenue", h.getRevenue).Methods("GET")
	api.HandleFunc("/products", h.listProducts).Methods("GET")
	api.HandleFunc("/enroll", h.enroll).Methods("POST")
	api.HandleFunc("/enrollments", h.listEnrollments).Methods("GET")
}

func (h *Handler) listPartners(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetPartners()
	json.NewEncoder(w).Encode(map[string]interface{}{"partners": p, "count": len(p)})
}

func (h *Handler) getPartner(w http.ResponseWriter, r *http.Request) {
	p := h.svc.GetPartner(mux.Vars(r)["id"])
	if p == nil {
		http.Error(w, `{"error":"not found"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) getRevenue(w http.ResponseWriter, r *http.Request) {
	rs, err := h.svc.GetRevenueShare(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(rs)
}

func (h *Handler) listProducts(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetProducts()
	json.NewEncoder(w).Encode(map[string]interface{}{"products": p, "count": len(p)})
}

func (h *Handler) enroll(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PartnerID    string `json:"partner_id"`
		ProductID    string `json:"product_id"`
		CustomerRef  string `json:"customer_ref"`
		CustomerName string `json:"customer_name"`
		TransactionRef string `json:"transaction_ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	e, err := h.svc.Enroll(req.PartnerID, req.ProductID, req.CustomerRef, req.CustomerName, req.TransactionRef)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(e)
}

func (h *Handler) listEnrollments(w http.ResponseWriter, _ *http.Request) {
	e := h.svc.GetEnrollments()
	json.NewEncoder(w).Encode(map[string]interface{}{"enrollments": e, "count": len(e)})
}
