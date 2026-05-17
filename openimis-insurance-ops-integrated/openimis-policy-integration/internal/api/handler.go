package api

import (
	"encoding/json"
	"net/http"
	"time"

	"go.uber.org/zap"

	"openimis-policy-integration/internal/policy"
)

// Handler holds dependencies for the HTTP handlers.
type Handler struct {
	PolicyService policy.Service
	Logger        *zap.Logger
}

// NewHandler creates a new API handler.
func NewHandler(policyService policy.Service, logger *zap.Logger) *Handler {
	return &Handler{
		PolicyService: policyService,
		Logger:        logger,
	}
}

// CreatePolicyHandler handles the POST request to create a new policy.
func (h *Handler) CreatePolicyHandler(w http.ResponseWriter, r *http.Request) {
	var req policy.Policy
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Logger.Error("Failed to decode request body", zap.Error(err))
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Simple validation for required fields
	if req.PolicyID == "" || req.EnrollmentDate == "" || req.SchemeID == "" {
		http.Error(w, "Missing required fields (policy_id, enrollment_date, scheme_id)", http.StatusBadRequest)
		return
	}

	// Mock policy ID if not provided for testing
	if req.PolicyID == "" {
		req.PolicyID = time.Now().Format("20060102150405")
	}

	// Call the service layer to create the policy
	createdPolicy, err := h.PolicyService.CreatePolicy(r.Context(), &req)
	if err != nil {
		h.Logger.Error("Policy creation failed", zap.Error(err), zap.String("policy_id", req.PolicyID))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(createdPolicy); err != nil {
		h.Logger.Error("Failed to encode response", zap.Error(err))
	}
}
