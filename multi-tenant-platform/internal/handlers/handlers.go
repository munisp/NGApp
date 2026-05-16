package handlers

import (
	"encoding/json"
	"multi-tenant-platform/internal/service"
	"net/http"
	"strings"
)

type Handler struct { svc *service.TenantService }
func NewHandler(svc *service.TenantService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/tenants/create", h.Create)
	mux.HandleFunc("/api/v1/tenants/tenant/", h.GetTenant)
	mux.HandleFunc("/api/v1/tenants/list", h.List)
	mux.HandleFunc("/api/v1/tenants/users/add", h.AddUser)
	mux.HandleFunc("/api/v1/tenants/users/", h.GetUsers)
	mux.HandleFunc("/api/v1/tenants/stats", h.GetStats)
}

func rj(w http.ResponseWriter, s int, d interface{}) { w.Header().Set("Content-Type","application/json"); w.WriteHeader(s); json.NewEncoder(w).Encode(d) }
func re(w http.ResponseWriter, s int, m string) { rj(w, s, map[string]string{"error": m}) }

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.CreateTenantRequest
	json.NewDecoder(r.Body).Decode(&req)
	t, err := h.svc.CreateTenant(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, t)
}

func (h *Handler) GetTenant(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/tenants/tenant/")
	t, err := h.svc.GetTenant(id)
	if err != nil {
		t2, err2 := h.svc.GetTenantBySlug(id)
		if err2 != nil { re(w, 404, err.Error()); return }
		t = t2
	}
	rj(w, 200, t)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	plan := r.URL.Query().Get("plan"); status := r.URL.Query().Get("status")
	tenants := h.svc.ListTenants(plan, status)
	rj(w, 200, map[string]interface{}{"tenants": tenants, "count": len(tenants)})
}

func (h *Handler) AddUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { re(w, 405, "Method not allowed"); return }
	var req service.AddUserRequest
	json.NewDecoder(r.Body).Decode(&req)
	u, err := h.svc.AddUser(req)
	if err != nil { re(w, 400, err.Error()); return }
	rj(w, 201, u)
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/tenants/users/")
	rj(w, 200, map[string]interface{}{"users": h.svc.GetUsers(id)})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) { rj(w, 200, h.svc.GetStats()) }
