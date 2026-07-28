package handlers

import (
	"encoding/json"
	"enhanced-kyc-kyb/internal/service"
	"net/http"
)

type KYCHandler struct{ svc *service.KYCService }
func NewKYCHandler(svc *service.KYCService) *KYCHandler { return &KYCHandler{svc: svc} }

func (h *KYCHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/kyc/submit", h.SubmitKYC)
	mux.HandleFunc("GET /api/v1/kyc/{ref}", h.GetKYC)
	mux.HandleFunc("GET /api/v1/kyc", h.ListKYC)
	mux.HandleFunc("POST /api/v1/kyc/{ref}/review", h.ReviewKYC)
	mux.HandleFunc("GET /api/v1/kyc/{ref}/checks", h.GetVerifications)
	mux.HandleFunc("POST /api/v1/kyb/submit", h.SubmitKYB)
	mux.HandleFunc("GET /api/v1/kyb/{ref}", h.GetKYB)
	mux.HandleFunc("GET /api/v1/kyb", h.ListKYB)
	mux.HandleFunc("POST /api/v1/kyb/{ref}/review", h.ReviewKYB)
	mux.HandleFunc("POST /api/v1/documents/upload", h.UploadDocument)
	mux.HandleFunc("GET /api/v1/documents/{ref}", h.GetDocuments)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *KYCHandler) SubmitKYC(w http.ResponseWriter, r *http.Request) {
	var req service.KYCSubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.SubmitKYC(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *KYCHandler) GetKYC(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetKYC(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) ListKYC(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.ListKYC(r.Context(), r.URL.Query().Get("status"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) ReviewKYC(w http.ResponseWriter, r *http.Request) {
	var req service.ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.ReviewKYC(r.Context(), r.PathValue("ref"), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "reviewed"})
}
func (h *KYCHandler) GetVerifications(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetVerifications(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) SubmitKYB(w http.ResponseWriter, r *http.Request) {
	var req service.KYBSubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.SubmitKYB(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *KYCHandler) GetKYB(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetKYB(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) ListKYB(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.ListKYB(r.Context(), r.URL.Query().Get("status"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) ReviewKYB(w http.ResponseWriter, r *http.Request) {
	var req service.ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.ReviewKYB(r.Context(), r.PathValue("ref"), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "reviewed"})
}
func (h *KYCHandler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	var req service.DocumentUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.UploadDocument(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *KYCHandler) GetDocuments(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetDocuments(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *KYCHandler) HealthCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "healthy", "service": "enhanced-kyc-kyb"}) }
func (h *KYCHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "ready", "service": "enhanced-kyc-kyb"}) }

func wj(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}
func we(w http.ResponseWriter, status int, msg string) { wj(w, status, map[string]string{"error": msg}) }
