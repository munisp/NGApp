package handlers

import (
	"encoding/json"
	"net/http"
	"takaful-products-suite/internal/service"

	"github.com/gorilla/mux"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(r *mux.Router) {
	api := r.PathPrefix("/api/v1/takaful-products").Subrouter()
	api.HandleFunc("/products", h.listProducts).Methods("GET")
	api.HandleFunc("/products/{id}", h.getProduct).Methods("GET")
	api.HandleFunc("/products/{id}/compliance", h.checkCompliance).Methods("GET")
	api.HandleFunc("/pools", h.listPools).Methods("GET")
	api.HandleFunc("/pools/{id}", h.getPool).Methods("GET")
	api.HandleFunc("/pools/{id}/surplus/distribute", h.distributeSurplus).Methods("POST")
	api.HandleFunc("/join", h.joinPool).Methods("POST")
	api.HandleFunc("/memberships", h.listMemberships).Methods("GET")
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

func (h *Handler) checkCompliance(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(h.svc.CheckShariaCompliance(mux.Vars(r)["id"]))
}

func (h *Handler) listPools(w http.ResponseWriter, _ *http.Request) {
	p := h.svc.GetPools()
	json.NewEncoder(w).Encode(map[string]interface{}{"pools": p, "count": len(p)})
}

func (h *Handler) getPool(w http.ResponseWriter, r *http.Request) {
	p := h.svc.GetPool(mux.Vars(r)["id"])
	if p == nil {
		http.Error(w, `{"error":"not found"}`, 404)
		return
	}
	json.NewEncoder(w).Encode(p)
}

func (h *Handler) distributeSurplus(w http.ResponseWriter, r *http.Request) {
	d, err := h.svc.DistributeSurplus(mux.Vars(r)["id"])
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	json.NewEncoder(w).Encode(d)
}

func (h *Handler) joinPool(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProductID  string `json:"product_id"`
		MemberName string `json:"member_name"`
		MemberID   string `json:"member_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid body"}`, 400)
		return
	}
	m, err := h.svc.JoinPool(req.ProductID, req.MemberName, req.MemberID)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, 400)
		return
	}
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(m)
}

func (h *Handler) listMemberships(w http.ResponseWriter, _ *http.Request) {
	m := h.svc.GetMemberships()
	json.NewEncoder(w).Encode(map[string]interface{}{"memberships": m, "count": len(m)})
}
