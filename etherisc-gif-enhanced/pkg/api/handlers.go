package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"policy-service-integration/pkg/metrics"
	"policy-service-integration/pkg/models"
	"policy-service-integration/pkg/repo"
	"policy-service-integration/pkg/temporal"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
	"go.uber.org/zap"
)

// Handler is the structure that holds dependencies for HTTP handlers.
type Handler struct {
	Logger *zap.Logger
	TemporalClient client.Client
	Repo repo.Repository
}

// NewHandler creates a new Handler instance.
func NewHandler(logger *zap.Logger, tc client.Client, r repo.Repository) *Handler {
	return &Handler{
		Logger: logger,
		TemporalClient: tc,
		Repo: r,
	}
}

// CreateParametricPolicyHandler handles POST /v1/policies/parametric requests.
func (h *Handler) CreateParametricPolicyHandler(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	path := r.URL.Path
	method := r.Method
	status := http.StatusAccepted

	defer func() {
		metrics.HTTPRequestDurationSeconds.WithLabelValues(path, method, fmt.Sprintf("%d", status)).Observe(time.Since(start).Seconds())
	}()

	var req models.PolicyCreationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.Logger.Error("Failed to decode request body", zap.Error(err))
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		status = http.StatusBadRequest
		return
	}

	// Input validation
	if req.GIFProductID == "" {
		h.Logger.Error("Validation failed: GIFProductID is required")
		http.Error(w, "GIFProductID is required", http.StatusBadRequest)
		status = http.StatusBadRequest
		return
	}

	// Start Temporal Workflow
	options := client.StartWorkflowOptions{
		ID:        fmt.Sprintf("parametric-policy-%s", uuid.New().String()),
		TaskQueue: "policy-service-task-queue",
	}

	we, err := h.TemporalClient.ExecuteWorkflow(r.Context(), options, temporal.CreateParametricPolicyWorkflow, req)
	if err != nil {
		h.Logger.Error("Failed to start Temporal workflow", zap.Error(err))
		http.Error(w, "Failed to start policy creation workflow", http.StatusInternalServerError)
		status = http.StatusInternalServerError
		metrics.PolicyCreationTotal.WithLabelValues(string(models.Parametric), "failed_start").Inc()
		return
	}

	h.Logger.Info("Temporal workflow started", zap.String("WorkflowID", we.GetID()), zap.String("RunID", we.GetRunID()))
	metrics.PolicyCreationTotal.WithLabelValues(string(models.Parametric), "started").Inc()

	// Respond with 202 Accepted
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Policy creation workflow started",
		"workflow_id": we.GetID(),
		"run_id": we.GetRunID(),
	})
}

// GetPolicyHandler handles GET /v1/policies/{id} requests.
func (h *Handler) GetPolicyHandler(w http.ResponseWriter, r *http.Request) {
	// Implementation for retrieving a policy by ID (traditional or parametric)
	// This would typically involve extracting the ID from the URL path (using gorilla/mux vars)
	// and calling h.Repo.GetPolicyByID.
	// Mock implementation for simplicity:
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Mock GetPolicyHandler - ID retrieval not fully implemented in mock",
	})
}

// GetParametricPolicyDetailsHandler handles GET /v1/policies/parametric/{id} requests.
func (h *Handler) GetParametricPolicyDetailsHandler(w http.ResponseWriter, r *http.Request) {
	// Implementation for retrieving parametric policy details
	// Mock implementation for simplicity:
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Mock GetParametricPolicyDetailsHandler - ID retrieval not fully implemented in mock",
	})
}
