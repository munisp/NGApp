package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"notification-service/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) SendNotification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	notifID := fmt.Sprintf("NOT-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"notification_id": notifID, "status": "sent", "channel": req["channel"],
		"recipient": req["recipient"], "sent_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) BulkSend(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{"status": "queued", "batch_id": fmt.Sprintf("BATCH-%d", time.Now().UnixNano()%1000000)})
}

func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	templates := []map[string]interface{}{
		{"id": "welcome", "name": "Welcome Message", "channels": []string{"sms", "email", "whatsapp"}, "languages": []string{"en", "ha", "yo", "ig"}},
		{"id": "policy_created", "name": "Policy Created", "channels": []string{"sms", "email"}, "languages": []string{"en", "ha", "yo"}},
		{"id": "claim_submitted", "name": "Claim Submitted", "channels": []string{"sms", "email", "push"}, "languages": []string{"en", "ha", "yo", "ig"}},
		{"id": "claim_approved", "name": "Claim Approved", "channels": []string{"sms", "email", "whatsapp"}, "languages": []string{"en", "ha", "yo"}},
		{"id": "payout_completed", "name": "Payout Completed", "channels": []string{"sms", "push"}, "languages": []string{"en", "ha", "yo", "ig"}},
		{"id": "renewal_reminder", "name": "Renewal Reminder", "channels": []string{"sms", "email", "whatsapp"}, "languages": []string{"en", "ha"}},
		{"id": "kyc_verified", "name": "KYC Verified", "channels": []string{"sms", "email"}, "languages": []string{"en"}},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"templates": templates})
}

func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"notifications": []interface{}{}, "total": 0})
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"sms_provider": "connected", "email_provider": "connected",
		"whatsapp_provider": "connected", "push_provider": "connected",
		"queue_depth": 0,
	})
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{"code": code, "message": message},
	})
}
