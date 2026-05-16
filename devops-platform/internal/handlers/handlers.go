package handlers

import (
	"devops-platform/internal/service"
	"encoding/json"
	"net/http"
)

type Handler struct { svc *service.DevOpsService }
func NewHandler(svc *service.DevOpsService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/devops/services", h.GetServices)
	mux.HandleFunc("/api/v1/devops/metrics", h.GetMetrics)
	mux.HandleFunc("/api/v1/devops/deploy", h.Deploy)
	mux.HandleFunc("/api/v1/devops/pipelines", h.GetPipelines)
	mux.HandleFunc("/api/v1/devops/deployments", h.GetDeployments)
	mux.HandleFunc("/api/v1/devops/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) GetServices(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"services": h.svc.GetServices()}) }
func (h *Handler) GetMetrics(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"metrics": h.svc.GetMetrics()}) }
func (h *Handler) Deploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.DeployRequest
	json.NewDecoder(r.Body).Decode(&req)
	d, err := h.svc.Deploy(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, d)
}
func (h *Handler) GetPipelines(w http.ResponseWriter, r *http.Request) {
	svc := r.URL.Query().Get("service")
	rj(w, 200, map[string]interface{}{"pipelines": h.svc.GetPipelines(svc)})
}
func (h *Handler) GetDeployments(w http.ResponseWriter, r *http.Request) {
	svc := r.URL.Query().Get("service"); env := r.URL.Query().Get("environment")
	rj(w, 200, map[string]interface{}{"deployments": h.svc.GetDeployments(svc, env)})
}
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
