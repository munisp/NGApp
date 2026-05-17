package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"go.uber.org/zap"
	"payment_service/config"
	"payment_service/handler"
	"payment_service/service"
	"payment_service/workflow"
	"payment_service/observability"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	// 1. Load Configuration
	cfg := config.LoadConfig()

	// 2. Initialize Logger
	var logger *zap.Logger
	if cfg.Environment == "production" {
		logger, _ = zap.NewProduction()
	} else {
		logger, _ = zap.NewDevelopment()
	}
	defer logger.Sync()
	log.SetOutput(zap.NewStdLog(logger).Writer())

	logger.Info("Starting Payment Service", zap.String("environment", cfg.Environment), zap.String("port", cfg.ServerPort))

	// 3. Initialize Dependencies with real implementations
	repo, err := service.NewPaymentRepository(cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("Failed to initialize payment repository", zap.Error(err))
	}

	paystackAdapter := service.NewPaystackAdapter()
	flutterwaveAdapter := service.NewFlutterwaveAdapter()
	binanceAdapter := service.NewBinanceAdapter()
	walletAdapter := service.NewEthereumWalletAdapter()
	policyAdapter := service.NewEtheriscPolicyAdapter()

	_ = flutterwaveAdapter
	_ = binanceAdapter
	_ = walletAdapter

	// 4. Initialize Temporal Client and Worker
	temporalClient, err := workflow.NewTemporalClient(cfg.TemporalHostPort)
	if err != nil {
		logger.Fatal("Failed to create Temporal client", zap.Error(err))
	}
	defer temporalClient.Close()

	// 5. Initialize Services and Handlers
	metrics := observability.NewMetrics() // Initialize metrics
	paymentService := service.NewPaymentService(repo, temporalClient, logger, metrics)
	paymentHandler := handler.NewPaymentHandler(paymentService, logger)

	// 6. Start Temporal Worker
	worker := workflow.StartWorker(temporalClient, repo, paystackAdapter, binanceAdapter, walletAdapter, policyAdapter, logger)
	defer worker.Stop()

	// 7. Setup HTTP Router
	r := mux.NewRouter()
	r.HandleFunc("/api/v1/payments", paymentHandler.InitiatePayment).Methods("POST")
	r.HandleFunc("/api/v1/payments/{id}", paymentHandler.GetPaymentStatus).Methods("GET")
	r.HandleFunc("/api/v1/webhooks/fiat-gateway", paymentHandler.HandleFiatWebhook).Methods("POST")
	// 7.1. Observability Endpoints
	r.Handle("/metrics", promhttp.Handler())

	// 8. Start HTTP Server
	server := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Could not listen on", zap.String("port", cfg.ServerPort), zap.Error(err))
		}
	}()

	// 9. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Server is shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server stopped gracefully")
}
