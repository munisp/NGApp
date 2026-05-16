package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"pan-african-ekyc/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) VerifyNIN(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"verification_id": fmt.Sprintf("VER-%d", time.Now().UnixNano()%10000000),
		"document_type": "NIN", "status": "verified", "confidence": 0.888,
		"name": "Adebayo Ogunlesi", "date_of_birth": "1990-01-15", "gender": "M",
		"verified_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) VerifyBVN(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"verification_id": fmt.Sprintf("VER-%d", time.Now().UnixNano()%10000000),
		"document_type": "BVN", "status": "verified", "confidence": 0.923,
		"bank": "First Bank", "verified_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) VerifyLiveness(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"is_live": true, "confidence": 0.97, "model": "tinyliveness-v3",
		"processing_time_ms": 5, "verified_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) VerifyDocument(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"document_type": "national_id", "country": "NG", "status": "verified",
		"extracted_data": map[string]string{"name": "Adebayo Ogunlesi", "id_number": "12345678901"},
	})
}

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"customer_id": "USR-001", "kyc_level": "enhanced", "overall_score": 0.888,
		"verifications": []map[string]interface{}{
			{"type": "NIN", "status": "verified", "score": 0.888},
			{"type": "BVN", "status": "verified", "score": 0.923},
			{"type": "liveness", "status": "verified", "score": 0.97},
		},
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

func (h *Handler) ListProfiles(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"profiles": []interface{}{}, "total": 0})
}

func (h *Handler) AMLScreen(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"screening_id": fmt.Sprintf("AML-%d", time.Now().UnixNano()%10000000),
		"result": "clear", "risk_level": "low", "pep_match": false, "sanctions_match": false,
	})
}
