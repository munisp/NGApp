package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.uber.org/zap"

	"openimis-policy-integration/internal/api"
	"openimis-policy-integration/internal/openimis"
	"openimis-policy-integration/internal/policy"
	"openimis-policy-integration/internal/temporal"
	"openimis-policy-integration/internal/utils"
)

func main() {
	logger := utils.InitLogger()
	defer logger.Sync()

	cfg, err := utils.LoadConfig()
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// 1. Initialize OpenIMIS Client
	openimisClient := openimis.NewClient(cfg.OpenIMIS, logger)

	// 2. Initialize Temporal Client
	c, err := client.Dial(client.Options{
		HostPort: cfg.Temporal.HostPort,
		Logger:   logger.Sugar(),
	})
	if err != nil {
		logger.Fatal("Unable to create Temporal client", zap.Error(err))
	}
	defer c.Close()

	// 3. Start Temporal Worker
	w := worker.New(c, cfg.Temporal.TaskQueue, worker.Options{})
	activities := &temporal.Activities{
		OpenIMISClient: openimisClient,
		Logger:         logger,
	}
	w.RegisterWorkflow(temporal.PolicyPremiumCalculationWorkflow)
	w.RegisterActivity(activities.CalculatePremiumActivity)

	go func() {
		if err := w.Run(worker.InterruptCh()); err != nil {
			logger.Error("Temporal worker failed to start", zap.Error(err))
		}
	}()
	logger.Info("Temporal Worker started", zap.String("task_queue", cfg.Temporal.TaskQueue))

	// 4. Initialize Policy Service and API Handler
	policyService := policy.NewService(c, logger)
	handler := api.NewHandler(policyService, logger)

	// 5. Setup HTTP Server (API and Metrics)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/policies", handler.CreatePolicyHandler)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.Handle("/metrics", promhttp.Handler())

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: mux,
	}

	// 6. Start HTTP Server
	go func() {
		logger.Info("Starting HTTP server", zap.Int("port", cfg.Server.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server failed to start", zap.Error(err))
		}
	}()

	// 7. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server gracefully stopped")
}
