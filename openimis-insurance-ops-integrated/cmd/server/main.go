package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"actuarial-lake-service/pkg/config"
	"actuarial-lake-service/pkg/iceberg"
	"actuarial-lake-service/pkg/kafka"
	"actuarial-lake-service/pkg/metrics"
	"actuarial-lake-service/pkg/temporal"

	dapr "github.com/dapr/go-sdk/client"
	"github.com/dapr/go-sdk/service/common"
	daprd "github.com/dapr/go-sdk/service/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
)

var logger *zap.Logger
var icebergClient *iceberg.Client
var temporalClient *temporal.Client

func init() {
	// Initialize structured logger
	var err error
	if os.Getenv("ENV") == "production" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		log.Fatalf("can't initialize zap logger: %v", err)
	}
	defer logger.Sync()
}

func main() {
	cfg := config.LoadConfig()

	// 1. Initialize Iceberg Client
	var err error
	icebergClient, err = iceberg.NewClient(cfg.Iceberg)
	if err != nil {
		logger.Fatal("failed to create iceberg client", zap.Error(err))
	}

	// 2. Initialize Temporal Client
	temporalClient, err = temporal.NewClient(cfg.Temporal)
	if err != nil {
		logger.Fatal("failed to create temporal client", zap.Error(err))
	}

	// 3. Setup Iceberg Tables (Idempotent)
	err = icebergClient.SetupTables(context.Background())
	if err != nil {
		logger.Fatal("failed to setup iceberg tables", zap.Error(err))
	}

	// 4. Start Temporal Worker in a goroutine
	go temporalClient.StartWorker()

	// 5. Setup Dapr Service
	s := daprd.NewService(cfg.Dapr.ListenAddress)

	// 5.1. Dapr Pub/Sub (Kafka) Subscription
	sub := &common.Subscription{
		PubsubName: cfg.Kafka.PubsubName,
		Topic:      cfg.Kafka.PremiumTopic,
		Route:      "/premium-calculated-event",
	}
	if err := s.AddTopicEventHandler(sub, kafka.PremiumCalculatedHandler(logger, icebergClient)); err != nil {
		logger.Fatal("error adding topic event handler", zap.Error(err))
	}

	// 5.2. Dapr Service Invocation (REST API)
	if err := s.AddServiceInvocationHandler("/v1/data/premium", handlePremiumIngestion(logger, icebergClient)); err != nil {
		logger.Fatal("error adding service invocation handler", zap.Error(err))
	}
	if err := s.AddServiceInvocationHandler("/v1/data/loss-ratio", handleLossRatioQuery(logger, icebergClient)); err != nil {
		logger.Fatal("error adding service invocation handler", zap.Error(err))
	}
	if err := s.AddServiceInvocationHandler("/v1/temporal/start-loss-ratio-workflow", handleStartLossRatioWorkflow(logger, temporalClient)); err != nil {
		logger.Fatal("error adding service invocation handler", zap.Error(err))
	}

	// 6. Start Prometheus Metrics Server in a goroutine
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		logger.Info("starting metrics server", zap.String("address", cfg.Metrics.ListenAddress))
		if err := http.ListenAndServe(cfg.Metrics.ListenAddress, nil); err != nil && err != http.ErrServerClosed {
			logger.Fatal("metrics server failed", zap.Error(err))
		}
	}()

	// 7. Start Dapr Service
	logger.Info("starting Dapr service", zap.String("address", cfg.Dapr.ListenAddress))
	go func() {
		if err := s.Start(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("dapr service failed", zap.Error(err))
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("shutting down service...")

	// Stop Temporal Worker
	temporalClient.StopWorker()

	// Close Dapr Client
	daprClient, _ := dapr.NewClient(context.Background())
	daprClient.Close()

	logger.Info("service stopped gracefully")
}

// Dapr Service Invocation Handlers (Simplified for brevity, full implementation in pkg/service)

func handlePremiumIngestion(logger *zap.Logger, ic *iceberg.Client) func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
	return func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
		metrics.IngestionCounter.WithLabelValues("premium").Inc()
		logger.Info("received premium ingestion request", zap.String("trace_id", in.TraceID))

		// In a real scenario, we would unmarshal the data and call ic.IngestPremiumCalculation
		// For this implementation, we just simulate the ingestion.
		// ic.IngestPremiumCalculation(ctx, data)

		return &common.Content{
			ContentType: "application/json",
			Data:        []byte(`{"status": "ingestion simulated"}`),
		}, nil
	}
}

func handleLossRatioQuery(logger *zap.Logger, ic *iceberg.Client) func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
	return func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
		metrics.QueryCounter.WithLabelValues("loss_ratio").Inc()
		logger.Info("received loss ratio query", zap.String("trace_id", in.TraceID))

		// In a real scenario, we would query the Iceberg table (or a materialized view)
		// For this implementation, we just simulate the query.
		// ratio, err := ic.QueryLossRatio(ctx, in.Data)

		return &common.Content{
			ContentType: "application/json",
			Data:        []byte(`{"product_id": 1, "month": "2024-01", "loss_ratio": 0.55}`),
		}, nil
	}
}

func handleStartLossRatioWorkflow(logger *zap.Logger, tc *temporal.Client) func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
	return func(ctx context.Context, in *common.InvocationEvent) (out *common.Content, err error) {
		logger.Info("received request to start loss ratio workflow", zap.String("trace_id", in.TraceID))

		// Start the Temporal Workflow
		workflowID := "loss-ratio-workflow-2024-01" // Example ID
		run, err := tc.StartLossRatioWorkflow(ctx, workflowID)
		if err != nil {
			logger.Error("failed to start workflow", zap.Error(err))
			return nil, err
		}

		return &common.Content{
			ContentType: "application/json",
			Data:        []byte(`{"status": "workflow started", "workflow_id": "` + run.GetID() + `", "run_id": "` + run.GetRunID() + `"}`),
		}, nil
	}
}
