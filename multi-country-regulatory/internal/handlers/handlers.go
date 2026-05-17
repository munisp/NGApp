package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"multi-country-regulatory/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {}

func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	rules := []map[string]interface{}{
		{"id": "NG-NAICOM-001", "country": "NG", "regulator": "NAICOM", "rule": "Minimum capital requirement", "status": "compliant"},
		{"id": "NG-NDPR-001", "country": "NG", "regulator": "NITDA", "rule": "Data protection", "status": "compliant"},
		{"id": "KE-IRA-001", "country": "KE", "regulator": "IRA", "rule": "Solvency margin", "status": "compliant"},
		{"id": "GH-NIC-001", "country": "GH", "regulator": "NIC", "rule": "Premium reporting", "status": "pending_review"},
		{"id": "ZA-FSCA-001", "country": "ZA", "regulator": "FSCA", "rule": "TCF compliance", "status": "compliant"},
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"rules": rules})
}

func (h *Handler) RunComplianceCheck(w http.ResponseWriter, r *http.Request) {
	checkID := fmt.Sprintf("CHK-%d", time.Now().UnixNano()%10000000)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"check_id": checkID, "status": "passed", "score": 0.94,
		"issues": []map[string]interface{}{
			{"severity": "low", "rule": "GH-NIC-001", "message": "Q2 premium report due in 14 days"},
		},
	})
}

func (h *Handler) ListChecks(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{"checks": []interface{}{}, "total": 0})
}

func (h *Handler) ListReports(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"reports": []map[string]interface{}{
			{"id": "RPT-001", "type": "NAICOM Quarterly", "period": "2026-Q1", "status": "submitted"},
			{"id": "RPT-002", "type": "IRA Annual", "period": "2025", "status": "submitted"},
		},
	})
}

func (h *Handler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusAccepted, map[string]interface{}{"status": "generating", "estimated_time": "5 minutes"})
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

func (h *Handler) ComplianceDashboard(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"overall_score": 0.94, "countries": 6, "rules_compliant": 47, "rules_total": 50,
		"next_filing": "2026-06-30", "alerts": 1,
	})
}
