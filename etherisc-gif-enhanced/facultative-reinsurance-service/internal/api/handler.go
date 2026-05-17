package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/etherisc/facultative-reinsurance-service/internal/service"
	"github.com/gorilla/mux"
	"go.temporal.io/sdk/client"
)

// Handler holds the dependencies for the API handlers.
type Handler struct {
	Service service.Service
	TemporalClient client.Client
}

// NewRouter creates a new router with all API endpoints.
func NewRouter(svc service.Service, tc client.Client) *mux.Router {
	h := &Handler{
		Service: svc,
		TemporalClient: tc,
	}

	r := mux.NewRouter()
	r.HandleFunc("/health", h.HealthCheck).Methods("GET")
	r.HandleFunc("/policies/{policyID}/reinsurance", h.SubmitPolicyForReinsurance).Methods("POST")
	r.HandleFunc("/quotes/{quoteID}/accept", h.AcceptQuote).Methods("POST")
	r.HandleFunc("/quotes/{quoteID}/reject", h.RejectQuote).Methods("POST")
	r.HandleFunc("/claims/cession", h.SubmitClaimForCession).Methods("POST")

	return r
}

// HealthCheck provides a simple health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// SubmitPolicyForReinsurance handles the request to start the reinsurance workflow.
func (h *Handler) SubmitPolicyForReinsurance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	policyID := vars["policyID"]

	// In a real system, we would check if the policy exists and is eligible
	_, err := h.Service.GetPolicy(r.Context(), policyID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Policy check failed: %v", err), http.StatusNotFound)
		return
	}

	// Start the Temporal Workflow
	workflowID := fmt.Sprintf("facultative-reinsurance-%s", policyID)
	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: "FACULTATIVE_REINSURANCE_TASK_QUEUE",
	}

	we, err := h.TemporalClient.ExecuteWorkflow(r.Context(), options, "FacultativeReinsuranceWorkflow", policyID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to start workflow: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(SubmitPolicyResponse{
		WorkflowID: we.GetID(),
		RunID:      we.GetRunID(),
		Message:    "Facultative Reinsurance Workflow started",
	})
}

// AcceptQuote handles the request to accept a reinsurance quote.
func (h *Handler) AcceptQuote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	quoteID := vars["quoteID"]

	// Send a signal to the Temporal Workflow to accept the quote
	// We need to find the Workflow ID associated with this quote.
	// For simplicity in this mock, we'll assume the quoteID is part of the workflow ID or we know it.
	// In a real system, the quote would store the workflow ID.
	// Since we don't have a full DB, we'll assume the workflow ID is a fixed pattern for the policy.
	// This is a major simplification. In a real system, the quote object would be queried to find the workflow ID.
	// For now, we'll just call the service layer directly, bypassing the signal mechanism for simplicity,
	// as the service layer already implements the core logic.

	cededRe, err := h.Service.AcceptQuote(r.Context(), quoteID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to accept quote: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(QuoteActionResponse{
		ContractID: cededRe.ContractID,
		Message:    "Quote accepted and contract finalized",
	})
}

// RejectQuote handles the request to reject a reinsurance quote.
func (h *Handler) RejectQuote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	quoteID := vars["quoteID"]

	err := h.Service.RejectQuote(r.Context(), quoteID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to reject quote: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(QuoteActionResponse{
		Message: "Quote rejected",
	})
}

// SubmitClaimForCession handles the request to start the claim cession workflow.
func (h *Handler) SubmitClaimForCession(w http.ResponseWriter, r *http.Request) {
	var req SubmitClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Start the Temporal Workflow
	workflowID := fmt.Sprintf("claim-cession-%s", req.ClaimID)
	options := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: "FACULTATIVE_REINSURANCE_TASK_QUEUE",
	}

	we, err := h.TemporalClient.ExecuteWorkflow(r.Context(), options, "CedeClaimWorkflow", req.ClaimID, req.ContractID, req.ClaimAmount)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to start claim cession workflow: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(SubmitClaimResponse{
		WorkflowID: we.GetID(),
		RunID:      we.GetRunID(),
		Message:    "Claim Cession Workflow started",
	})
}
