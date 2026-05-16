package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"ussd-gateway/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) HandleUSSD(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "POST required")
		return
	}
	var req map[string]interface{}
	json.NewDecoder(r.Body).Decode(&req)
	sessionID := fmt.Sprintf("USSD-%d", time.Now().UnixNano()%10000000)
	phoneNumber, _ := req["phone_number"].(string)
	serviceCode, _ := req["service_code"].(string)
	input, _ := req["input"].(string)
	if serviceCode == "" {
		serviceCode = "*384#"
	}
	response := "Welcome to NGApp Insurance\n1. Buy Policy\n2. Check Claim\n3. Make Payment\n4. My Account"
	if input == "1" {
		response = "Select Product:\n1. Health Cover (₦200/mo)\n2. Crop Insurance (₦500/mo)\n3. Device Protection (₦100/mo)"
	} else if input == "2" {
		response = "Enter your Claim ID:"
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"session_id": sessionID, "phone_number": phoneNumber, "service_code": serviceCode,
		"response": response, "status": "active", "created_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) ListSessions(w http.ResponseWriter, r *http.Request) {
	sessions := []map[string]interface{}{
		{"session_id": "USSD-001", "phone": "+2348012345678", "service_code": "*384#", "status": "completed", "steps": 4, "duration_sec": 45},
		{"session_id": "USSD-002", "phone": "+2348087654321", "service_code": "*384#", "status": "active", "steps": 2, "duration_sec": 12},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"sessions": sessions, "total": len(sessions)})
}

func (h *Handler) SimulateSession(w http.ResponseWriter, r *http.Request) {
	sessionID := fmt.Sprintf("SIM-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"session_id": sessionID, "status": "simulated",
		"steps": []map[string]interface{}{
			{"step": 1, "input": "*384#", "response": "Welcome to NGApp Insurance\n1. Buy Policy\n2. Check Claim"},
			{"step": 2, "input": "1", "response": "Select Product:\n1. Health Cover\n2. Crop Insurance"},
			{"step": 3, "input": "1", "response": "Health Cover ₦200/mo. Confirm? 1=Yes 2=No"},
			{"step": 4, "input": "1", "response": "Policy activated! Reference: POL-1234567"},
		},
	})
}

func (h *Handler) GetMenuConfig(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"service_code": "*384#",
		"menu": map[string]interface{}{
			"title": "NGApp Insurance",
			"items": []map[string]interface{}{
				{"key": "1", "label": "Buy Policy"}, {"key": "2", "label": "Check Claim"},
				{"key": "3", "label": "Make Payment"}, {"key": "4", "label": "My Account"},
			},
		},
		"languages": []string{"en", "ha", "yo", "ig"},
	})
}

func (h *Handler) GetAnalytics(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"period": "2026-05", "total_sessions": 12450, "completed": 10890,
		"abandoned": 1560, "avg_duration_sec": 38, "completion_rate": 0.875,
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
