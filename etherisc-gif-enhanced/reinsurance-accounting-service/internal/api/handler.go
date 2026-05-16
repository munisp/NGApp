package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/etherisc/reinsurance-accounting-service/internal/core"
	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
)

// Service defines the interface for the core business logic.
type Service interface {
	CreateReinsurer(ctx context.Context, name string) (*core.Reinsurer, error)
	CreateReinsuranceContract(ctx context.Context, reinsurerID, policyID uint64, cessionRate float64) (*core.ReinsuranceContract, error)
	RecordCededPremium(ctx context.Context, policyID uint64, totalPremium uint64, currency uint16, sourceEventID uint64) (*core.ReinsuranceTransaction, error)
	RecordClaimRecovery(ctx context.Context, policyID uint64, totalClaimAmount uint64, currency uint16, sourceEventID uint64) (*core.ReinsuranceTransaction, error)
	GenerateReconciliationReport(ctx context.Context, reinsurerID uint64) (*core.ReconciliationReport, error)
	StartSettlementWorkflow(ctx context.Context, reinsurerID uint64) (string, error)
}

// Handler handles HTTP requests for the reinsurance accounting service.
type Handler struct {
	service Service
	logger  *slog.Logger
	validate *validator.Validate
}

// NewHandler creates a new API handler.
func NewHandler(service Service, logger *slog.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
		validate: validator.New(),
	}
}

// RegisterRoutes registers all API routes with the router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/health", h.HealthCheck) // Health check endpoint
	r.Post("/reinsurers", h.CreateReinsurer)
	r.Post("/contracts", h.CreateContract)
	r.Post("/transactions/premium", h.RecordCededPremium)
	r.Post("/transactions/claim", h.RecordClaimRecovery)
	r.Get("/reports/reconciliation/{reinsurerID}", h.GenerateReconciliationReport)
	r.Post("/settlement/{reinsurerID}", h.InitiateSettlement)
}

func (h *Handler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		h.logger.Error("Failed to write JSON response", "error", err)
	}
}

func (h *Handler) handleError(w http.ResponseWriter, err error, status int) {
	h.logger.Error("API error", "error", err, "status", status)
	h.writeJSON(w, status, map[string]string{"error": err.Error()})
}

// HealthCheck returns a simple status response.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "reinsurance-accounting-service"})
}

// CreateReinsurer handles the creation of a new reinsurer.
func (h *Handler) CreateReinsurer(w http.ResponseWriter, r *http.Request) {
	var req CreateReinsurerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.handleError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.handleError(w, fmt.Errorf("validation failed: %w", err), http.StatusBadRequest)
		return
	}

	reinsurer, err := h.service.CreateReinsurer(r.Context(), req.Name)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to create reinsurer: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusCreated, ToReinsurerResponse(reinsurer))
}

// CreateContract handles the creation of a new reinsurance contract.
func (h *Handler) CreateContract(w http.ResponseWriter, r *http.Request) {
	var req CreateContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.handleError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.handleError(w, fmt.Errorf("validation failed: %w", err), http.StatusBadRequest)
		return
	}

	contract, err := h.service.CreateReinsuranceContract(r.Context(), req.ReinsurerID, req.PolicyID, req.CessionRate)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to create contract: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusCreated, ToContractResponse(contract))
}

// RecordCededPremium handles the recording of a ceded premium transaction.
func (h *Handler) RecordCededPremium(w http.ResponseWriter, r *http.Request) {
	var req RecordPremiumRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.handleError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.handleError(w, fmt.Errorf("validation failed: %w", err), http.StatusBadRequest)
		return
	}

	tx, err := h.service.RecordCededPremium(r.Context(), req.PolicyID, req.TotalPremium, req.Currency, req.SourceEventID)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to record ceded premium: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusCreated, ToTransactionResponse(tx))
}

// RecordClaimRecovery handles the recording of a claim recovery transaction.
func (h *Handler) RecordClaimRecovery(w http.ResponseWriter, r *http.Request) {
	var req RecordClaimRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.handleError(w, fmt.Errorf("invalid request body: %w", err), http.StatusBadRequest)
		return
	}

	if err := h.validate.Struct(req); err != nil {
		h.handleError(w, fmt.Errorf("validation failed: %w", err), http.StatusBadRequest)
		return
	}

	tx, err := h.service.RecordClaimRecovery(r.Context(), req.PolicyID, req.TotalClaimAmount, req.Currency, req.SourceEventID)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to record claim recovery: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusCreated, ToTransactionResponse(tx))
}

// GenerateReconciliationReport handles the request for a reconciliation report.
func (h *Handler) GenerateReconciliationReport(w http.ResponseWriter, r *http.Request) {
	reinsurerIDStr := chi.URLParam(r, "reinsurerID")
	reinsurerID, err := strconv.ParseUint(reinsurerIDStr, 10, 64)
	if err != nil {
		h.handleError(w, fmt.Errorf("invalid reinsurer ID: %w", err), http.StatusBadRequest)
		return
	}

	report, err := h.service.GenerateReconciliationReport(r.Context(), reinsurerID)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to generate report: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusOK, ToReconciliationReportResponse(report))
}

// InitiateSettlement handles the request to initiate the settlement workflow.
func (h *Handler) InitiateSettlement(w http.ResponseWriter, r *http.Request) {
	reinsurerIDStr := chi.URLParam(r, "reinsurerID")
	reinsurerID, err := strconv.ParseUint(reinsurerIDStr, 10, 64)
	if err != nil {
		h.handleError(w, fmt.Errorf("invalid reinsurer ID: %w", err), http.StatusBadRequest)
		return
	}

	workflowID, err := h.service.StartSettlementWorkflow(r.Context(), reinsurerID)
	if err != nil {
		h.handleError(w, fmt.Errorf("failed to start settlement workflow: %w", err), http.StatusInternalServerError)
		return
	}

	h.writeJSON(w, http.StatusAccepted, map[string]string{"message": "Settlement workflow started", "workflow_id": workflowID})
}
