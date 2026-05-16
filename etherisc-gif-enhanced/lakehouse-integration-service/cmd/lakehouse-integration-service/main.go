package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/etherisc/lakehouse-integration-service/pkg/config"
	"github.com/etherisc/lakehouse-integration-service/pkg/kafka"
	"github.com/etherisc/lakehouse-integration-service/pkg/metrics"
	"github.com/etherisc/lakehouse-integration-service/pkg/server"
	"github.com/etherisc/lakehouse-integration-service/pkg/service"
	"github.com/etherisc/lakehouse-integration-service/pkg/temporal"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

func main() {
	// 1. Load Configuration
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		logrus.Fatalf("Failed to load configuration: %v", err)
	}

	// 2. Initialize Components
	metrics.InitMetrics()

	// Kafka Producer/Consumer (Simulating Flink/Iceberg sync)
	kafkaClient, err := kafka.NewClient(cfg.Kafka.BootstrapServers)
	if err != nil {
		logrus.Fatalf("Failed to create Kafka client: %v", err)
	}
	defer kafkaClient.Close()

	// Service Layer
	lakehouseService := service.NewLakehouseService(kafkaClient, cfg)

	// Temporal Client (Placeholder for async operations)
	temporalClient, err := temporal.NewClient()
	if err != nil {
		logrus.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer temporalClient.Close()

	// 3. Setup HTTP Server and Routes
	r := mux.NewRouter()
	server.SetupRoutes(r, lakehouseService, temporalClient)

	// Add Prometheus metrics handler
	r.Handle(cfg.Observability.MetricsPath, metrics.Handler())

	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: r,
	}

	// 4. Start Server in a goroutine
	go func() {
		logrus.Infof("Starting server on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logrus.Fatalf("Could not listen on %s: %v", cfg.Server.Port, err)
		}
	}()

	// 5. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logrus.Info("Server is shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logrus.Fatalf("Server forced to shutdown: %v", err)
	}

	logrus.Info("Server exited gracefully")
}
