package handlers

import (
	"encoding/json"
	"net/http"
	"notification-service/internal/models"
	"notification-service/internal/service"
	"strconv"
	"strings"
)

type Handler struct { svc *service.NotificationService }
func NewHandler(svc *service.NotificationService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/notifications/send", h.Send)
	mux.HandleFunc("/api/v1/notifications/bulk", h.SendBulk)
	mux.HandleFunc("/api/v1/notifications/notification/", h.Get)
	mux.HandleFunc("/api/v1/notifications/list", h.List)
	mux.HandleFunc("/api/v1/notifications/read/", h.MarkRead)
	mux.HandleFunc("/api/v1/notifications/templates", h.GetTemplates)
	mux.HandleFunc("/api/v1/notifications/preferences/", h.Preferences)
	mux.HandleFunc("/api/v1/notifications/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.SendRequest
	json.NewDecoder(r.Body).Decode(&req)
	n, err := h.svc.Send(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, n)
}

func (h *Handler) SendBulk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.BulkRequest
	json.NewDecoder(r.Body).Decode(&req)
	success, fail, err := h.svc.SendBulk(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 200, map[string]interface{}{"success": success, "failed": fail})
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/notification/")
	n, err := h.svc.Get(id)
	if err != nil { re(w, 404, err.Error()); return }
	rj(w, 200, n)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rid := r.URL.Query().Get("recipient_id"); status := r.URL.Query().Get("status")
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" { if v, err := strconv.Atoi(l); err == nil { limit = v } }
	notifs := h.svc.List(rid, status, limit)
	rj(w, 200, map[string]interface{}{"notifications": notifs, "count": len(notifs)})
}

func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/read/")
	if err := h.svc.MarkRead(id); err != nil { re(w, 400, err.Error()); return }
	rj(w, 200, map[string]string{"status": "read"})
}

func (h *Handler) GetTemplates(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("category")
	rj(w, 200, map[string]interface{}{"templates": h.svc.GetTemplates(cat)})
}

func (h *Handler) Preferences(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/notifications/preferences/")
	if r.Method == http.MethodGet {
		rj(w, 200, h.svc.GetPreference(id))
		return
	}
	if r.Method == http.MethodPut {
		var pref models.NotificationPreference
		json.NewDecoder(r.Body).Decode(&pref)
		pref.RecipientID = id
		h.svc.SetPreference(&pref)
		rj(w, 200, map[string]string{"status": "updated"})
		return
	}
	re(w, 405, "Method not allowed")
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
