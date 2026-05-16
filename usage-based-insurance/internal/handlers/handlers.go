package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"usage-based-insurance/internal/models"
	"usage-based-insurance/internal/service"
)

type Handler struct {
	svc *service.UBIService
}

func NewHandler(svc *service.UBIService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/ubi/register", h.Register)
	mux.HandleFunc("/api/v1/ubi/policy/", h.GetPolicy)
	mux.HandleFunc("/api/v1/ubi/policies", h.ListPolicies)
	mux.HandleFunc("/api/v1/ubi/telemetry", h.IngestTelemetry)
	mux.HandleFunc("/api/v1/ubi/telemetry/", h.GetTelemetry)
	mux.HandleFunc("/api/v1/ubi/score/", h.CalculateScore)
	mux.HandleFunc("/api/v1/ubi/scores/", h.GetScores)
	mux.HandleFunc("/api/v1/ubi/trips/", h.GetTrips)
	mux.HandleFunc("/api/v1/ubi/stats", h.GetStats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var req service.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	p, err := h.svc.RegisterPolicy(req)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, p)
}

func (h *Handler) GetPolicy(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ubi/policy/")
	p, err := h.svc.GetPolicy(id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, p)
}

func (h *Handler) ListPolicies(w http.ResponseWriter, r *http.Request) {
	policies := h.svc.ListPolicies()
	respondJSON(w, http.StatusOK, map[string]interface{}{"policies": policies})
}

func (h *Handler) IngestTelemetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	var data models.TelematicsData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request")
		return
	}
	if err := h.svc.IngestTelemetry(data.PolicyID, data); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"status": "ingested"})
}

func (h *Handler) GetTelemetry(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ubi/telemetry/")
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}
	data := h.svc.GetTelemetry(id, limit)
	respondJSON(w, http.StatusOK, map[string]interface{}{"telemetry": data})
}

func (h *Handler) CalculateScore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ubi/score/")
	score, err := h.svc.CalculateScore(id)
	if err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, score)
}

func (h *Handler) GetScores(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ubi/scores/")
	scores := h.svc.GetScores(id)
	respondJSON(w, http.StatusOK, map[string]interface{}{"scores": scores})
}

func (h *Handler) GetTrips(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/ubi/trips/")
	trips := h.svc.GetTrips(id)
	respondJSON(w, http.StatusOK, map[string]interface{}{"trips": trips})
}

func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, h.svc.GetStats())
}
