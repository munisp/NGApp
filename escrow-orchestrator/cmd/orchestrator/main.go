package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"github.com/escrowprotect/orchestrator/internal/workflows"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting EscrowProtect Orchestrator")

	// Load configuration
	cfg := config.Load()

	// Initialize middleware
	ctx := context.Background()
	mw := middleware.NewManager(cfg)
	if err := mw.Initialize(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize middleware")
	}
	defer mw.Close()

	// Create Temporal client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHost,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		log.Warn().Err(err).Msg("Failed to connect to Temporal, running in standalone mode")
		temporalClient = nil
	}
	if temporalClient != nil {
		defer temporalClient.Close()
	}

	// Create activities
	acts := activities.NewActivities(cfg, mw)

	// Create and start Temporal worker
	var w worker.Worker
	if temporalClient != nil {
		w = worker.New(temporalClient, cfg.TemporalTaskQueue, worker.Options{})
		
		// Register workflows
		workflows.RegisterWorkflows(w)
		
		// Register activities
		w.RegisterActivity(acts.CreateEscrowActivity)
		w.RegisterActivity(acts.GetEscrowActivity)
		w.RegisterActivity(acts.AcceptEscrowActivity)
		w.RegisterActivity(acts.ShipEscrowActivity)
		w.RegisterActivity(acts.ConfirmDeliveryActivity)
		w.RegisterActivity(acts.OpenDisputeActivity)
		w.RegisterActivity(acts.RefundEscrowActivity)
		w.RegisterActivity(acts.CheckFraudActivity)
		w.RegisterActivity(acts.CheckKYCActivity)
		w.RegisterActivity(acts.VerifyBankActivity)
		w.RegisterActivity(acts.InitiatePayoutActivity)
		w.RegisterActivity(acts.SendNotificationActivity)
		w.RegisterActivity(acts.CacheWorkflowIDActivity)
		w.RegisterActivity(acts.PublishEventActivity)

		// Start worker in background
		go func() {
			if err := w.Run(worker.InterruptCh()); err != nil {
				log.Error().Err(err).Msg("Temporal worker failed")
			}
		}()
		log.Info().Str("task_queue", cfg.TemporalTaskQueue).Msg("Temporal worker started")
	}

	// Create HTTP server
	router := mux.NewRouter()
	
	// Health endpoints
	router.HandleFunc("/healthz", healthHandler(mw)).Methods("GET")
	router.HandleFunc("/readyz", readyHandler(mw, temporalClient)).Methods("GET")
	
	// Workflow endpoints
	router.HandleFunc("/api/v1/workflows/escrow/start", startEscrowWorkflowHandler(temporalClient, cfg)).Methods("POST")
	router.HandleFunc("/api/v1/workflows/escrow/{workflow_id}/signal/{signal_name}", signalWorkflowHandler(temporalClient)).Methods("POST")
	router.HandleFunc("/api/v1/workflows/escrow/{workflow_id}/status", getWorkflowStatusHandler(temporalClient)).Methods("GET")
	router.HandleFunc("/api/v1/workflows/dispute/start", startDisputeWorkflowHandler(temporalClient, cfg)).Methods("POST")
	router.HandleFunc("/api/v1/workflows/refund/start", startRefundWorkflowHandler(temporalClient, cfg)).Methods("POST")
	router.HandleFunc("/api/v1/workflows/payout/start", startPayoutWorkflowHandler(temporalClient, cfg)).Methods("POST")
	router.HandleFunc("/api/v1/workflows/agent-cash/start", startAgentCashWorkflowHandler(temporalClient, cfg)).Methods("POST")
	
	// Middleware status
	router.HandleFunc("/api/v1/middleware/status", middlewareStatusHandler(mw)).Methods("GET")

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Start HTTP server
	go func() {
		log.Info().Int("port", cfg.HTTPPort).Msg("HTTP server starting")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server failed")
		}
	}()

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("HTTP server shutdown error")
	}

	if w != nil {
		w.Stop()
	}

	log.Info().Msg("Orchestrator stopped")
}

func healthHandler(mw *middleware.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}
}

func readyHandler(mw *middleware.Manager, tc client.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := mw.HealthCheck(r.Context())
		status["temporal"] = tc != nil
		
		allReady := true
		for _, ready := range status {
			if !ready {
				allReady = false
				break
			}
		}

		if allReady {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(status)
	}
}

func middlewareStatusHandler(mw *middleware.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := mw.HealthCheck(r.Context())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(status)
	}
}

func startEscrowWorkflowHandler(tc client.Client, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		var input workflows.EscrowHappyPathInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		workflowID := fmt.Sprintf("escrow-%d", time.Now().UnixNano())
		options := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: cfg.TemporalTaskQueue,
		}

		we, err := tc.ExecuteWorkflow(r.Context(), options, workflows.EscrowHappyPathWorkflow, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"workflow_id": we.GetID(),
			"run_id":      we.GetRunID(),
		})
	}
}

func signalWorkflowHandler(tc client.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		workflowID := vars["workflow_id"]
		signalName := vars["signal_name"]

		var signalData interface{}
		if err := json.NewDecoder(r.Body).Decode(&signalData); err != nil {
			signalData = nil
		}

		err := tc.SignalWorkflow(r.Context(), workflowID, "", signalName, signalData)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "signaled"})
	}
}

func getWorkflowStatusHandler(tc client.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		vars := mux.Vars(r)
		workflowID := vars["workflow_id"]

		desc, err := tc.DescribeWorkflowExecution(r.Context(), workflowID, "")
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"workflow_id": workflowID,
			"status":      desc.WorkflowExecutionInfo.Status.String(),
			"start_time":  desc.WorkflowExecutionInfo.StartTime,
		})
	}
}

func startDisputeWorkflowHandler(tc client.Client, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		var input workflows.DisputeWorkflowInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		workflowID := fmt.Sprintf("dispute-%d", time.Now().UnixNano())
		options := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: cfg.TemporalTaskQueue,
		}

		we, err := tc.ExecuteWorkflow(r.Context(), options, workflows.DisputeWorkflow, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"workflow_id": we.GetID(),
			"run_id":      we.GetRunID(),
		})
	}
}

func startRefundWorkflowHandler(tc client.Client, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		var input workflows.RefundWorkflowInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		workflowID := fmt.Sprintf("refund-%d", time.Now().UnixNano())
		options := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: cfg.TemporalTaskQueue,
		}

		we, err := tc.ExecuteWorkflow(r.Context(), options, workflows.RefundWorkflow, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"workflow_id": we.GetID(),
			"run_id":      we.GetRunID(),
		})
	}
}

func startPayoutWorkflowHandler(tc client.Client, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		var input workflows.PayoutWorkflowInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		workflowID := fmt.Sprintf("payout-%d", time.Now().UnixNano())
		options := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: cfg.TemporalTaskQueue,
		}

		we, err := tc.ExecuteWorkflow(r.Context(), options, workflows.PayoutWorkflow, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"workflow_id": we.GetID(),
			"run_id":      we.GetRunID(),
		})
	}
}

func startAgentCashWorkflowHandler(tc client.Client, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if tc == nil {
			http.Error(w, "Temporal not connected", http.StatusServiceUnavailable)
			return
		}

		var input workflows.AgentCashWorkflowInput
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		workflowID := fmt.Sprintf("agent-cash-%d", time.Now().UnixNano())
		options := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: cfg.TemporalTaskQueue,
		}

		we, err := tc.ExecuteWorkflow(r.Context(), options, workflows.AgentCashWorkflow, input)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"workflow_id": we.GetID(),
			"run_id":      we.GetRunID(),
		})
	}
}
