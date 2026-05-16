package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/etherisc/reinsurance-accounting-service/internal/api"
	"github.com/etherisc/reinsurance-accounting-service/internal/config"
	"github.com/etherisc/reinsurance-accounting-service/internal/core"
	"github.com/etherisc/reinsurance-accounting-service/internal/db"
	"github.com/etherisc/reinsurance-accounting-service/internal/metrics"
	"github.com/etherisc/reinsurance-accounting-service/internal/temporal"
	"github.com/etherisc/reinsurance-accounting-service/internal/tigerbeetle"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"go.temporal.io/sdk/client"
)

func main() {
	// 1. Setup Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// 2. Load Configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		logger.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	// 3. Initialize Metrics
	m := metrics.NewMetrics()

	// 4. Initialize TigerBeetle Client
	tbClient, err := tigerbeetle.NewClient(cfg.TigerBeetleAddresses, logger)
	if err != nil {
		logger.Error("Failed to initialize TigerBeetle client", "error", err)
		os.Exit(1)
	}
	defer tbClient.Close()

	// 5. Initialize Temporal Client (Mock for now)
	var temporalClient core.TemporalClient = temporal.NewMockTemporalClient(logger)
	// In a real system, we would initialize the real client:
	// temporalClient, err := client.Dial(client.Options{HostPort: cfg.TemporalHostPort})
	// if err != nil {
	// 	logger.Error("Failed to initialize Temporal client", "error", err)
	// 	os.Exit(1)
	// }
	// defer temporalClient.Close()

	// 6. Initialize Repository and Core Service
	repo := db.NewMockRepository()
	service := core.NewService(repo, tbClient, temporalClient, logger)

	// 7. Initialize API Handler
	handler := api.NewHandler(service, logger)

	// 8. Setup HTTP Router
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// API Routes
	r.Route("/api/v1/reinsurance", func(r chi.Router) {
		handler.RegisterRoutes(r)
	})

	// 9. Setup Metrics Server
	metricsRouter := chi.NewRouter()
	metricsRouter.Handle("/metrics", metrics.PrometheusHandler())
	metricsServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.MetricsPort),
		Handler: metricsRouter,
	}

	// 10. Setup Main HTTP Server
	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: r,
	}

	// 11. Start Servers
	go func() {
		logger.Info("Starting main server", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Main server failed", "error", err)
		}
	}()

	go func() {
		logger.Info("Starting metrics server", "port", cfg.MetricsPort)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Metrics server failed", "error", err)
		}
	}()

	// 12. Start Temporal Worker (Mock for now)
	// In a real system, we would start the worker:
	// go func() {
	// 	activities := temporal.Activities{Service: service, Logger: logger}
	// 	temporal.StartWorker(temporalClient.(client.Client), &activities, cfg.TemporalTaskQueue)
	// }()

	// 13. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Main server shutdown failed", "error", err)
	}
	if err := metricsServer.Shutdown(ctx); err != nil {
		logger.Error("Metrics server shutdown failed", "error", err)
	}

	logger.Info("Server stopped")
}
