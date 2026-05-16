package handlers

import (
	"agent-network-platform/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct {
	svc *service.AgentService
}

func NewHandler(svc *service.AgentService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/agents/register", h.Register)
	mux.HandleFunc("/api/v1/agents/verify/", h.Verify)
	mux.HandleFunc("/api/v1/agents/agent/", h.GetAgent)
	mux.HandleFunc("/api/v1/agents/list", h.ListAgents)
	mux.HandleFunc("/api/v1/agents/sale", h.RecordSale)
	mux.HandleFunc("/api/v1/agents/sales/", h.GetSales)
	mux.HandleFunc("/api/v1/agents/stats", h.GetStats)
}

func respondJSON(w http.ResponseWriter, s int, d interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d)
}
func respondError(w http.ResponseWriter, s int, m string) {
	respondJSON(w, s, map[string]string{"error": m})
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, 405, "Method not allowed"); return }
	var req service.RegisterRequest
	json.NewDecoder(r.Body).Decode(&req)
	a, err := h.svc.Register(req)
	if err != nil { respondError(w, 400, err.Error()); return }
	respondJSON(w, 201, a)
}

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, 405, "Method not allowed"); return }
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/agents/verify/")
	if err := h.svc.VerifyAgent(id); err != nil { respondError(w, 400, err.Error()); return }
	respondJSON(w, 200, map[string]string{"status": "verified"})
}

func (h *Handler) GetAgent(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/agents/agent/")
	a, err := h.svc.GetAgent(id)
	if err != nil { respondError(w, 404, err.Error()); return }
	respondJSON(w, 200, a)
}

func (h *Handler) ListAgents(w http.ResponseWriter, r *http.Request) {
	region := r.URL.Query().Get("region"); status := r.URL.Query().Get("status")
	agents := h.svc.ListAgents(region, status)
	respondJSON(w, 200, map[string]interface{}{"agents": agents, "count": len(agents)})
}

func (h *Handler) RecordSale(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { respondError(w, 405, "Method not allowed"); return }
	var req service.SaleRequest
	json.NewDecoder(r.Body).Decode(&req)
	sale, err := h.svc.RecordSale(req)
	if err != nil { respondError(w, 400, err.Error()); return }
	respondJSON(w, 201, sale)
}

func (h *Handler) GetSales(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/agents/sales/")
	respondJSON(w, 200, map[string]interface{}{"sales": h.svc.GetSales(id)})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, 200, h.svc.GetStats())
}
