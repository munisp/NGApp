package handlers

import (
	"encoding/json"
	"mobile-money-service/internal/service"
	"net/http"
	"strings"
)

type Handler struct { svc *service.MoMoService }
func NewHandler(svc *service.MoMoService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/momo/pay", h.Pay)
	mux.HandleFunc("/api/v1/momo/disburse", h.Disburse)
	mux.HandleFunc("/api/v1/momo/transaction/", h.GetTransaction)
	mux.HandleFunc("/api/v1/momo/transactions", h.ListTransactions)
	mux.HandleFunc("/api/v1/momo/providers", h.GetProviders)
	mux.HandleFunc("/api/v1/momo/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) Pay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.PayRequest
	json.NewDecoder(r.Body).Decode(&req)
	tx, err := h.svc.InitiatePayment(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, tx)
}
func (h *Handler) Disburse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.DisbursementRequest
	json.NewDecoder(r.Body).Decode(&req)
	tx, err := h.svc.Disburse(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, tx)
}
func (h *Handler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/momo/transaction/")
	tx, err := h.svc.GetTransaction(id)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, tx)
}
func (h *Handler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	phone := r.URL.Query().Get("phone")
	rj(w, 200, map[string]interface{}{"transactions": h.svc.ListTransactions(phone)})
}
func (h *Handler) GetProviders(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	rj(w, 200, map[string]interface{}{"providers": h.svc.GetProviders(country)})
}
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
