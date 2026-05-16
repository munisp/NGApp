package handlers

import (
	"encoding/json"
	"multi-country-regulatory/internal/service"
	"net/http"
	"strings"
)

type Handler struct { svc *service.RegulatoryService }
func NewHandler(svc *service.RegulatoryService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/regulatory/countries", h.GetCountries)
	mux.HandleFunc("/api/v1/regulatory/country/", h.GetCountry)
	mux.HandleFunc("/api/v1/regulatory/check", h.RunCheck)
	mux.HandleFunc("/api/v1/regulatory/checks", h.GetChecks)
	mux.HandleFunc("/api/v1/regulatory/reports", h.GetReports)
	mux.HandleFunc("/api/v1/regulatory/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) GetCountries(w http.ResponseWriter, r *http.Request) { rj(w, 200, map[string]interface{}{"countries": h.svc.GetCountries()}) }
func (h *Handler) GetCountry(w http.ResponseWriter, r *http.Request) {
	code := strings.TrimPrefix(r.URL.Path, "/api/v1/regulatory/country/")
	c, err := h.svc.GetCountry(code)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, c)
}
func (h *Handler) RunCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.CheckRequest
	json.NewDecoder(r.Body).Decode(&req)
	c, err := h.svc.RunComplianceCheck(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 200, c)
}
func (h *Handler) GetChecks(w http.ResponseWriter, r *http.Request) {
	tid := r.URL.Query().Get("tenant_id"); country := r.URL.Query().Get("country")
	rj(w, 200, map[string]interface{}{"checks": h.svc.GetChecks(tid, country)})
}
func (h *Handler) GetReports(w http.ResponseWriter, r *http.Request) {
	tid := r.URL.Query().Get("tenant_id")
	rj(w, 200, map[string]interface{}{"reports": h.svc.GetReports(tid)})
}
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
