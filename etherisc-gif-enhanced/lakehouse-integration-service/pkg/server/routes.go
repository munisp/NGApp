package server

import (
	"encoding/json"
	"net/http"

	"github.com/etherisc/lakehouse-integration-service/pkg/metrics"
	"github.com/etherisc/lakehouse-integration-service/pkg/service"
	"github.com/etherisc/lakehouse-integration-service/pkg/temporal"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// SetupRoutes configures the HTTP routes for the service.
func SetupRoutes(r *mux.Router, svc service.LakehouseService, temporalClient temporal.Client) {
	r.HandleFunc("/health", healthCheckHandler).Methods("GET")
	r.HandleFunc("/v1/events/policy", handlePolicyEvent(svc)).Methods("POST")
	r.HandleFunc("/v1/events/claim", handleClaimEvent(svc)).Methods("POST")
	r.HandleFunc("/v1/analytics/{viewName}", handleAnalyticsView(svc)).Methods("GET")
	r.HandleFunc("/v1/sync/start", handleStartSyncWorkflow(temporalClient)).Methods("POST")
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// handlePolicyEvent simulates the endpoint receiving a CDC event for blockchain_policies.
func handlePolicyEvent(svc service.LakehouseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
		var event service.PolicyEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "400").Inc()
			return
		}

		if err := svc.ProcessPolicyEvent(r.Context(), event); err != nil {
			logrus.Errorf("Error processing policy event: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "500").Inc()
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "event processed", "policy_id": event.PolicyID})
	}
}

// handleClaimEvent simulates the endpoint receiving a CDC event for blockchain_claims.
func handleClaimEvent(svc service.LakehouseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
		var event service.ClaimEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "400").Inc()
			return
		}

		if err := svc.ProcessClaimEvent(r.Context(), event); err != nil {
			logrus.Errorf("Error processing claim event: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "500").Inc()
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "event processed", "claim_id": event.ClaimID})
	}
}

// handleAnalyticsView provides a simulated analytics view endpoint.
func handleAnalyticsView(svc service.LakehouseService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		viewName := vars["viewName"]

		data, err := svc.GetAnalyticsView(r.Context(), viewName)
		if err != nil {
			logrus.Errorf("Error getting analytics view %s: %v", viewName, err)
			http.Error(w, err.Error(), http.StatusNotFound)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "404").Inc()
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(data)
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "200").Inc()
	}
}

// handleStartSyncWorkflow starts a Temporal workflow for a full data sync.
func handleStartSyncWorkflow(temporalClient temporal.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// In a real scenario, this would trigger a Temporal workflow to perform a full,
		// non-CDC-based sync of all data to the lakehouse, perhaps for backfilling.
		workflowID, err := temporalClient.StartFullSyncWorkflow(r.Context())
		if err != nil {
			logrus.Errorf("Error starting full sync workflow: %v", err)
			http.Error(w, "Failed to start sync workflow", http.StatusInternalServerError)
			metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "500").Inc()
			return
		}

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "full sync workflow started", "workflow_id": workflowID})
		metrics.HTTPRequestsTotal.WithLabelValues(r.Method, r.URL.Path, "202").Inc()
	}
}
