// Package kyb provides HTTP API handlers for KYB verification
package kyb

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// KYBAPIHandler handles HTTP requests for KYB operations
type KYBAPIHandler struct {
	service *KYBService
}

// NewKYBAPIHandler creates a new KYB API handler
func NewKYBAPIHandler(service *KYBService) *KYBAPIHandler {
	return &KYBAPIHandler{service: service}
}

// RegisterRoutes registers KYB API routes
func (h *KYBAPIHandler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/kyb/cases", h.InitiateKYB).Methods("POST")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}", h.GetKYBStatus).Methods("GET")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/documents", h.SubmitDocument).Methods("POST")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/documents", h.GetDocuments).Methods("GET")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/screenings", h.RunScreening).Methods("POST")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/screenings", h.GetScreenings).Methods("GET")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/evaluate", h.EvaluateKYB).Methods("GET")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/approve", h.ApproveKYB).Methods("POST")
	r.HandleFunc("/api/v1/kyb/cases/{caseId}/reject", h.RejectKYB).Methods("POST")
	r.HandleFunc("/api/v1/kyb/webhook", h.HandleWebhook).Methods("POST")
}

// InitiateKYBRequest represents a request to initiate KYB
type InitiateKYBRequest struct {
	OnboardingCaseID string       `json:"onboarding_case_id"`
	StakeholderType  string       `json:"stakeholder_type"`
	BusinessInfo     BusinessInfo `json:"business_info"`
}

// InitiateKYB initiates KYB verification for an onboarding case
func (h *KYBAPIHandler) InitiateKYB(w http.ResponseWriter, r *http.Request) {
	var req InitiateKYBRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	kybCase, err := h.service.InitiateKYB(r.Context(), req.OnboardingCaseID, req.StakeholderType, req.BusinessInfo)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(kybCase)
}

// GetKYBStatus returns the status of a KYB case
func (h *KYBAPIHandler) GetKYBStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	status, err := h.service.GetKYBStatus(r.Context(), caseID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// SubmitDocumentRequest represents a document submission request

// SubmitDocument submits a document for KYB verification
func (h *KYBAPIHandler) SubmitDocument(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	var req SubmitDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	doc, err := h.service.SubmitDocument(r.Context(), caseID, req.Type, req.S3Key, req.ContentHash, req.FileName)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(doc)
}

// GetDocuments returns all documents for a KYB case
func (h *KYBAPIHandler) GetDocuments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	documents, err := h.service.store.GetDocuments(r.Context(), caseID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"documents": documents,
		"count":     len(documents),
	})
}

// RunScreening runs screening checks for a KYB case
func (h *KYBAPIHandler) RunScreening(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	results, err := h.service.RunScreening(r.Context(), caseID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"screenings": results,
		"count":      len(results),
	})
}

// GetScreenings returns all screening results for a KYB case
func (h *KYBAPIHandler) GetScreenings(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	screenings, err := h.service.store.GetScreeningResults(r.Context(), caseID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"screenings": screenings,
		"count":      len(screenings),
	})
}

// EvaluateKYB evaluates a KYB case and returns recommendations
func (h *KYBAPIHandler) EvaluateKYB(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	evaluation, err := h.service.EvaluateKYB(r.Context(), caseID)
	if err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(evaluation)
}

// ApproveKYBRequest represents a KYB approval request
type ApproveKYBRequest struct {
	ApproverID string `json:"approver_id"`
	Notes      string `json:"notes"`
}

// ApproveKYB approves a KYB case
func (h *KYBAPIHandler) ApproveKYB(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	var req ApproveKYBRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.ApproveKYB(r.Context(), caseID, req.ApproverID, req.Notes); err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "approved",
		"case_id": caseID,
	})
}

// RejectKYBRequest represents a KYB rejection request
type RejectKYBRequest struct {
	ApproverID  string   `json:"approver_id"`
	ReasonCodes []string `json:"reason_codes"`
	Notes       string   `json:"notes"`
}

// RejectKYB rejects a KYB case
func (h *KYBAPIHandler) RejectKYB(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	caseID := vars["caseId"]

	var req RejectKYBRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	if err := h.service.RejectKYB(r.Context(), caseID, req.ApproverID, req.ReasonCodes, req.Notes); err != nil {
		http.Error(w, `{"error": "`+err.Error()+`"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "rejected",
		"case_id": caseID,
	})
}

// WebhookPayload represents a webhook payload from Ballerine
type WebhookPayload struct {
	EventType string                 `json:"event_type"`
	CaseID    string                 `json:"case_id"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// HandleWebhook handles webhooks from Ballerine
func (h *KYBAPIHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	var payload WebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error": "invalid webhook payload"}`, http.StatusBadRequest)
		return
	}

	// Process webhook based on event type
	switch payload.EventType {
	case "case.status_changed":
		// Update local case status
		if newStatus, ok := payload.Data["new_status"].(string); ok {
			kybCase, err := h.service.store.GetKYBCase(r.Context(), payload.CaseID)
			if err == nil {
				kybCase.Status = KYBStatus(newStatus)
				kybCase.UpdatedAt = time.Now()
				h.service.store.UpdateKYBCase(r.Context(), kybCase)
			}
		}

	case "document.verified":
		// Update document status
		// Implementation depends on document ID in payload

	case "screening.completed":
		// Store screening result
		// Implementation depends on screening data in payload

	case "decision.made":
		// Update case with decision
		if decision, ok := payload.Data["decision"].(string); ok {
			kybCase, err := h.service.store.GetKYBCase(r.Context(), payload.CaseID)
			if err == nil {
				kybCase.Status = KYBStatus(decision)
				now := time.Now()
				kybCase.CompletedAt = &now
				h.service.store.UpdateKYBCase(r.Context(), kybCase)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "received"})
}

// RequiredDocumentsByStakeholder returns required documents for each stakeholder type
var RequiredDocumentsByStakeholder = map[string][]DocumentType{
	"BANK": {
		DocTypeCertificateOfIncorporation,
		DocTypeBankingLicense,
		DocTypeMemorandumOfAssociation,
		DocTypeArticlesOfAssociation,
		DocTypeBoardResolution,
		DocTypeShareholderRegister,
		DocTypeDirectorID,
		DocTypeUBOID,
		DocTypeAMLPolicy,
		DocTypeFinancialStatements,
	},
	"MOBILE_MONEY_OPERATOR": {
		DocTypeCertificateOfIncorporation,
		DocTypeBankingLicense,
		DocTypeBoardResolution,
		DocTypeShareholderRegister,
		DocTypeDirectorID,
		DocTypeUBOID,
		DocTypeAMLPolicy,
		DocTypeFinancialStatements,
	},
	"FINTECH": {
		DocTypeCertificateOfIncorporation,
		DocTypeBankingLicense,
		DocTypeBoardResolution,
		DocTypeShareholderRegister,
		DocTypeDirectorID,
		DocTypeUBOID,
		DocTypeAMLPolicy,
		DocTypeFinancialStatements,
	},
	"MICROFINANCE": {
		DocTypeCertificateOfIncorporation,
		DocTypeBankingLicense,
		DocTypeBoardResolution,
		DocTypeDirectorID,
		DocTypeAMLPolicy,
		DocTypeFinancialStatements,
	},
	"MERCHANT": {
		DocTypeCertificateOfIncorporation,
		DocTypeBoardResolution,
		DocTypeDirectorID,
		DocTypeTaxCertificate,
		DocTypeBankStatement,
	},
	"DEVELOPER": {
		DocTypeDirectorID,
	},
	"REGULATOR": {
		DocTypeProofOfAddress,
		DocTypeDirectorID,
	},
	"GOVERNMENT_AGENCY": {
		DocTypeProofOfAddress,
		DocTypeDirectorID,
	},
}

// KYBReasonCodes defines standard reason codes for KYB decisions
var KYBReasonCodes = map[string]string{
	"KYB001": "Missing required document",
	"KYB002": "Document expired",
	"KYB003": "Document verification failed",
	"KYB004": "Sanctions screening match",
	"KYB005": "PEP screening match",
	"KYB006": "Adverse media found",
	"KYB007": "Invalid registration number",
	"KYB008": "License verification failed",
	"KYB009": "UBO verification failed",
	"KYB010": "High-risk jurisdiction",
	"KYB011": "Inconsistent information",
	"KYB012": "Insufficient capital",
	"KYB013": "AML policy inadequate",
	"KYB014": "Business activity not permitted",
	"KYB015": "Director disqualified",
}
