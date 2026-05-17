package handlers

import (
	"encoding/json"
	"ndpr-compliance/internal/service"
	"net/http"
)

type NDPRHandler struct{ svc *service.NDPRService }
func NewNDPRHandler(svc *service.NDPRService) *NDPRHandler { return &NDPRHandler{svc: svc} }

func (h *NDPRHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/ndpr/controllers", h.RegisterController)
	mux.HandleFunc("POST /api/v1/ndpr/consent", h.RecordConsent)
	mux.HandleFunc("GET /api/v1/ndpr/consent/{subjectId}", h.GetConsents)
	mux.HandleFunc("POST /api/v1/ndpr/requests", h.SubmitRequest)
	mux.HandleFunc("GET /api/v1/ndpr/requests", h.ListRequests)
	mux.HandleFunc("POST /api/v1/ndpr/requests/{ref}/process", h.ProcessRequest)
	mux.HandleFunc("POST /api/v1/ndpr/audit", h.LogProcessing)
	mux.HandleFunc("GET /api/v1/ndpr/audit/{subjectId}", h.GetAuditLogs)
	mux.HandleFunc("POST /api/v1/ndpr/breaches", h.ReportBreach)
	mux.HandleFunc("GET /api/v1/ndpr/breaches", h.ListBreaches)
	mux.HandleFunc("POST /api/v1/ndpr/breaches/{ref}/notify-nitda", h.NotifyNITDA)
	mux.HandleFunc("POST /api/v1/ndpr/assessments", h.CreateAssessment)
	mux.HandleFunc("GET /api/v1/ndpr/assessments", h.ListAssessments)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *NDPRHandler) RegisterController(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterControllerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.RegisterController(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *NDPRHandler) RecordConsent(w http.ResponseWriter, r *http.Request) {
	var req service.NDPRConsentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.RecordConsent(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *NDPRHandler) GetConsents(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetConsents(r.Context(), r.PathValue("subjectId"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *NDPRHandler) SubmitRequest(w http.ResponseWriter, r *http.Request) {
	var req service.NDPRRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.SubmitRequest(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *NDPRHandler) ListRequests(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetRequests(r.Context(), r.URL.Query().Get("status"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *NDPRHandler) ProcessRequest(w http.ResponseWriter, r *http.Request) {
	var resp map[string]interface{}
	json.NewDecoder(r.Body).Decode(&resp)
	if err := h.svc.ProcessRequest(r.Context(), r.PathValue("ref"), resp); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "completed"})
}
func (h *NDPRHandler) LogProcessing(w http.ResponseWriter, r *http.Request) {
	var req service.NDPRAuditInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.LogDataProcessing(r.Context(), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, map[string]string{"status": "logged"})
}
func (h *NDPRHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetAuditLogs(r.Context(), r.PathValue("subjectId"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *NDPRHandler) ReportBreach(w http.ResponseWriter, r *http.Request) {
	var req service.NDPRBreachInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.ReportBreach(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *NDPRHandler) ListBreaches(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetBreaches(r.Context())
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *NDPRHandler) NotifyNITDA(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.NotifyNITDA(r.Context(), r.PathValue("ref")); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "nitda_notified"})
}
func (h *NDPRHandler) CreateAssessment(w http.ResponseWriter, r *http.Request) {
	var req service.NDPRAssessmentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.CreateAssessment(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *NDPRHandler) ListAssessments(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetAssessments(r.Context())
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *NDPRHandler) HealthCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "healthy", "service": "ndpr-compliance"}) }
func (h *NDPRHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "ready", "service": "ndpr-compliance"}) }

func wj(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}
func we(w http.ResponseWriter, status int, msg string) { wj(w, status, map[string]string{"error": msg}) }
