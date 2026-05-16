package handlers

import (
	"encoding/json"
	"net/http"
	"pan-african-ekyc/internal/service"
	"strings"
)

type Handler struct { svc *service.EKYCService }
func NewHandler(svc *service.EKYCService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/ekyc/verify", h.Verify)
	mux.HandleFunc("/api/v1/ekyc/verification/", h.GetVerification)
	mux.HandleFunc("/api/v1/ekyc/verifications", h.ListVerifications)
	mux.HandleFunc("/api/v1/ekyc/profile/", h.GetProfile)
	mux.HandleFunc("/api/v1/ekyc/documents", h.GetDocuments)
	mux.HandleFunc("/api/v1/ekyc/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) Verify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.VerifyRequest
	json.NewDecoder(r.Body).Decode(&req)
	v, err := h.svc.Verify(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 200, v)
}
func (h *Handler) GetVerification(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ekyc/verification/")
	v, err := h.svc.GetVerification(id)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, v)
}
func (h *Handler) ListVerifications(w http.ResponseWriter, r *http.Request) {
	cid := r.URL.Query().Get("customer_id")
	rj(w, 200, map[string]interface{}{"verifications": h.svc.ListVerifications(cid)})
}
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	cid := strings.TrimPrefix(r.URL.Path, "/api/v1/ekyc/profile/")
	p, err := h.svc.GetProfile(cid)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, p)
}
func (h *Handler) GetDocuments(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country")
	rj(w, 200, map[string]interface{}{"documents": h.svc.GetSupportedDocuments(country)})
}
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
