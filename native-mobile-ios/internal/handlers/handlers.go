package handlers

import (
	"encoding/json"
	"native-mobile-ios/internal/service"
	"net/http"
)

type MobileHandler struct{ svc *service.MobileService }
func NewMobileHandler(svc *service.MobileService) *MobileHandler { return &MobileHandler{svc: svc} }

func (h *MobileHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/mobile/register", h.Register)
	mux.HandleFunc("GET /api/v1/mobile/users/{ref}/profile", h.GetProfile)
	mux.HandleFunc("PUT /api/v1/mobile/users/{ref}/preferences", h.UpdatePreferences)
	mux.HandleFunc("GET /api/v1/mobile/users/{ref}/policies", h.GetPolicies)
	mux.HandleFunc("POST /api/v1/mobile/claims", h.SubmitClaim)
	mux.HandleFunc("GET /api/v1/mobile/users/{ref}/claims", h.GetClaims)
	mux.HandleFunc("POST /api/v1/mobile/payments", h.MakePayment)
	mux.HandleFunc("GET /api/v1/mobile/users/{ref}/payments", h.GetPayments)
	mux.HandleFunc("GET /api/v1/mobile/users/{ref}/notifications", h.GetNotifications)
	mux.HandleFunc("POST /api/v1/mobile/notifications/{id}/read", h.MarkRead)
	mux.HandleFunc("GET /health", h.HealthCheck)
	mux.HandleFunc("GET /ready", h.ReadinessCheck)
}

func (h *MobileHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.RegisterUser(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *MobileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetProfile(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 404, err.Error()); return }
	wj(w, 200, res)
}
func (h *MobileHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	var req service.UpdatePrefsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	if err := h.svc.UpdatePreferences(r.Context(), r.PathValue("ref"), req); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "updated"})
}
func (h *MobileHandler) GetPolicies(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetPolicies(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *MobileHandler) SubmitClaim(w http.ResponseWriter, r *http.Request) {
	var req service.SubmitClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.SubmitClaim(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *MobileHandler) GetClaims(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetClaims(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *MobileHandler) MakePayment(w http.ResponseWriter, r *http.Request) {
	var req service.MakePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil { we(w, 400, err.Error()); return }
	res, err := h.svc.MakePayment(r.Context(), req)
	if err != nil { we(w, 422, err.Error()); return }
	wj(w, 201, res)
}
func (h *MobileHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetPayments(r.Context(), r.PathValue("ref"))
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *MobileHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	unreadOnly := r.URL.Query().Get("unread") == "true"
	res, err := h.svc.GetNotifications(r.Context(), r.PathValue("ref"), unreadOnly)
	if err != nil { we(w, 500, err.Error()); return }
	wj(w, 200, res)
}
func (h *MobileHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	ref := r.URL.Query().Get("user_ref")
	if err := h.svc.MarkNotificationRead(r.Context(), ref, r.PathValue("id")); err != nil { we(w, 422, err.Error()); return }
	wj(w, 200, map[string]string{"status": "read"})
}
func (h *MobileHandler) HealthCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "healthy", "service": "native-mobile-ios"}) }
func (h *MobileHandler) ReadinessCheck(w http.ResponseWriter, r *http.Request) { wj(w, 200, map[string]string{"status": "ready", "service": "native-mobile-ios"}) }

func wj(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json"); w.WriteHeader(status); json.NewEncoder(w).Encode(data)
}
func we(w http.ResponseWriter, status int, msg string) { wj(w, status, map[string]string{"error": msg}) }
