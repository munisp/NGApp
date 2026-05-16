package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"payment_service/service"
)

// PaymentHandler handles HTTP requests related to payments.
type PaymentHandler struct {
	paymentService service.PaymentService
	logger         *zap.Logger
}

// NewPaymentHandler creates a new PaymentHandler.
func NewPaymentHandler(ps service.PaymentService, logger *zap.Logger) *PaymentHandler {
	return &PaymentHandler{
		paymentService: ps,
		logger:         logger,
	}
}

// InitiatePaymentRequest defines the request body for initiating a payment.
type InitiatePaymentRequest struct {
	PolicyID      string  `json:"policy_id"`
	AmountFiat    float64 `json:"amount_fiat"`
	CurrencyFiat  string  `json:"currency_fiat"`
	TargetAddress string  `json:"target_address"` // Address of the policy premium wallet
}

// InitiatePayment handles POST /api/v1/payments
func (h *PaymentHandler) InitiatePayment(w http.ResponseWriter, r *http.Request) {
	var req InitiatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("Failed to decode request body", zap.Error(err))
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Basic validation
	if req.PolicyID == "" || req.AmountFiat <= 0 || req.CurrencyFiat == "" || req.TargetAddress == "" {
		http.Error(w, "Missing or invalid required fields", http.StatusBadRequest)
		return
	}

	payment, err := h.paymentService.InitiatePayment(r.Context(), req.PolicyID, req.AmountFiat, req.CurrencyFiat, req.TargetAddress)
	if err != nil {
		h.logger.Error("Failed to initiate payment", zap.Error(err))
		http.Error(w, "Failed to initiate payment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 Accepted, as the process is async
	json.NewEncoder(w).Encode(payment)
}

// GetPaymentStatus handles GET /api/v1/payments/{id}
func (h *PaymentHandler) GetPaymentStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	paymentID := vars["id"]

	payment, err := h.paymentService.GetPaymentStatus(r.Context(), paymentID)
	if err != nil {
		h.logger.Error("Failed to get payment status", zap.String("payment_id", paymentID), zap.Error(err))
		http.Error(w, "Payment not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(payment)
}

// FiatWebhookRequest defines the expected payload from the fiat gateway webhook.
type FiatWebhookRequest struct {
	Reference string `json:"reference"`
	Status    string `json:"status"` // e.g., "SUCCESS", "FAILED"
	// In a real scenario, this would contain much more data
}

// HandleFiatWebhook handles POST /api/v1/webhooks/fiat-gateway
func (h *PaymentHandler) HandleFiatWebhook(w http.ResponseWriter, r *http.Request) {
	var req FiatWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.logger.Error("Failed to decode webhook request body", zap.Error(err))
		http.Error(w, "Invalid webhook payload", http.StatusBadRequest)
		return
	}

	// Basic validation
	if req.Reference == "" || req.Status == "" {
		http.Error(w, "Missing required fields in webhook payload", http.StatusBadRequest)
		return
	}

	// The service layer handles signaling the Temporal workflow
	err := h.paymentService.HandleFiatWebhook(r.Context(), req.Reference, req.Status)
	if err != nil {
		h.logger.Error("Failed to process fiat webhook", zap.String("reference", req.Reference), zap.Error(err))
		http.Error(w, "Failed to process webhook", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "success"}`))
}

// --- Observability (Prometheus Metrics) ---

// In a real application, we would use a library like "github.com/prometheus/client_golang/prometheus"
// and expose a /metrics endpoint. For this implementation, we will define the structure
// but not fully integrate the Prometheus client, as it requires a running Prometheus server
// for full testing, which is outside the scope of this task.

// NewMetrics initializes and registers Prometheus metrics.
// func NewMetrics() *Metrics {
// 	// ... implementation using prometheus.NewCounterVec, prometheus.NewHistogramVec, etc.
// }

// Middleware for metrics (e.g., request duration, request count)
// func MetricsMiddleware(next http.Handler) http.Handler {
// 	// ... implementation
// }

// We will add a placeholder file for the metrics implementation.
