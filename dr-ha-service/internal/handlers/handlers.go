package handlers

import (
	"dr-ha-service/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type Handler struct { svc *service.DRService }
func NewHandler(svc *service.DRService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/dr/nodes", h.GetNodes)
	mux.HandleFunc("/api/v1/dr/node/", h.GetNode)
	mux.HandleFunc("/api/v1/dr/failover", h.TriggerFailover)
	mux.HandleFunc("/api/v1/dr/failovers", h.GetFailovers)
	mux.HandleFunc("/api/v1/dr/backup", h.CreateBackup)
	mux.HandleFunc("/api/v1/dr/backups", h.GetBackups)
	mux.HandleFunc("/api/v1/dr/plans", h.GetPlans)
	mux.HandleFunc("/api/v1/dr/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) GetNodes(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"nodes": h.svc.GetNodes()}) }
func (h *Handler) GetNode(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/dr/node/")
	n, err := h.svc.GetNode(id)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, n)
}
func (h *Handler) TriggerFailover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req struct { SourceID string `json:"source_id"`; TargetID string `json:"target_id"`; Reason string `json:"reason"` }
	json.NewDecoder(r.Body).Decode(&req)
	f, err := h.svc.TriggerFailover(req.SourceID, req.TargetID, req.Reason)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 200, f)
}
func (h *Handler) GetFailovers(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"failovers": h.svc.GetFailovers()}) }
func (h *Handler) CreateBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req struct { NodeID string `json:"node_id"`; Type string `json:"type"` }
	json.NewDecoder(r.Body).Decode(&req)
	b, err := h.svc.CreateBackup(req.NodeID, req.Type)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, b)
}
func (h *Handler) GetBackups(w http.ResponseWriter, r *http.Request) {
	nid := r.URL.Query().Get("node_id")
	rj(w, 200, map[string]interface{}{"backups": h.svc.GetBackups(nid)})
}
func (h *Handler) GetPlans(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"plans": h.svc.GetPlans()}) }
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
