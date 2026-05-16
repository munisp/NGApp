package handlers

import (
	"api-marketplace/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct { svc *service.MarketplaceService }
func NewHandler(svc *service.MarketplaceService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/marketplace/products", h.GetProducts)
	mux.HandleFunc("/api/v1/marketplace/product/", h.GetProduct)
	mux.HandleFunc("/api/v1/marketplace/subscribe", h.Subscribe)
	mux.HandleFunc("/api/v1/marketplace/subscriptions/", h.GetSubscriptions)
	mux.HandleFunc("/api/v1/marketplace/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) GetProducts(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("category")
	rj(w, 200, map[string]interface{}{"products": h.svc.GetProducts(cat)})
}

func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/marketplace/product/")
	p, err := h.svc.GetProduct(id)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, p)
}

func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.SubscribeRequest
	json.NewDecoder(r.Body).Decode(&req)
	sub, err := h.svc.Subscribe(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, sub)
}

func (h *Handler) GetSubscriptions(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/marketplace/subscriptions/")
	rj(w, 200, map[string]interface{}{"subscriptions": h.svc.GetSubscriptions(id)})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
