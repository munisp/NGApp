package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/etherisc/logging-integration-service/pkg/gifclient"
	"github.com/etherisc/logging-integration-service/pkg/logger"
	"github.com/etherisc/logging-integration-service/pkg/metrics"
	"github.com/gorilla/mux"
)

// PolicyHandler encapsulates dependencies for policy-related handlers.
type PolicyHandler struct {
	GIFClient *gifclient.Client
	Metrics   *metrics.Metrics
}

// NewPolicyHandler creates a new PolicyHandler.
func NewPolicyHandler(client *gifclient.Client, m *metrics.Metrics) *PolicyHandler {
	return &PolicyHandler{
		GIFClient: client,
		Metrics:   m,
	}
}

// GetPolicyByID handles the request to fetch a policy and logs the operation.
func (h *PolicyHandler) GetPolicyByID(w http.ResponseWriter, r *http.Request) {
	// Start timer for request duration metric
	start := time.Now()
	path := r.URL.Path
	method := r.Method
	
	log := logger.GetLoggerFromContext(r.Context())
	vars := mux.Vars(r)
	policyID := vars["policyID"]

	if policyID == "" {
		log.Error().Msg("Missing policyID in request path")
		http.Error(w, "Missing policyID", http.StatusBadRequest)
		h.Metrics.HTTPRequestsTotal.WithLabelValues(method, path, "400").Inc()
		return
	}

	log.Info().Str("policy_id", policyID).Msg("Received request to fetch policy")

	// 1. Call the GIF client (simulated integration)
	gifStart := time.Now()
	policy, err := h.GIFClient.GetPolicy(r.Context(), policyID)
	gifDuration := time.Since(gifStart).Seconds()
	
	// 2. Update GIF client metrics
	gifSuccess := "true"
	if err != nil {
		gifSuccess = "false"
	}
	h.Metrics.GIFClientCallsTotal.WithLabelValues("GetPolicy", gifSuccess).Inc()
	h.Metrics.GIFClientDuration.WithLabelValues("GetPolicy").Observe(gifDuration)

	// 3. Handle errors
	if err != nil {
		log.Error().Err(err).Str("policy_id", policyID).Msg("Failed to fetch policy from GIF service")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		h.Metrics.HTTPRequestsTotal.WithLabelValues(method, path, "500").Inc()
		return
	}

	// 4. Handle policy not found
	if policy == nil {
		log.Warn().Str("policy_id", policyID).Msg("Policy not found")
		http.Error(w, "Policy not found", http.StatusNotFound)
		h.Metrics.HTTPRequestsTotal.WithLabelValues(method, path, "404").Inc()
		return
	}

	// 5. Successful response and logging
	log.Info().
		Str("policy_id", policyID).
		Str("product", policy.Product).
		Msg("Successfully processed policy request")

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Policy ID: %s, Product: %s, Status: %s", policy.PolicyID, policy.Product, policy.Status)
	h.Metrics.HTTPRequestsTotal.WithLabelValues(method, path, "200").Inc()
	h.Metrics.HTTPRequestDuration.WithLabelValues(method, path).Observe(time.Since(start).Seconds())
}
