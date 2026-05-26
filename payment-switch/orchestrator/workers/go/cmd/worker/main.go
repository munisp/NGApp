package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"

	"github.com/payment-switch/orchestrator/internal/activities"
	"github.com/payment-switch/orchestrator/internal/workflows"
	"github.com/payment-switch/orchestrator/pkg/config"
	"github.com/payment-switch/orchestrator/pkg/middleware"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found: %v", err)
	}

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize middleware connections
	mw, err := middleware.NewMiddleware(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize middleware: %v", err)
	}
	defer mw.Close()

	// Create Temporal client
	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHost,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		log.Fatalf("Failed to create Temporal client: %v", err)
	}
	defer temporalClient.Close()

	// Create worker
	w := worker.New(temporalClient, cfg.TaskQueue, worker.Options{})

	// Register workflows
	w.RegisterWorkflow(workflows.PaymentProcessingWorkflow)
	w.RegisterWorkflow(workflows.MerchantOnboardingWorkflow)
	w.RegisterWorkflow(workflows.RefundProcessingWorkflow)
	w.RegisterWorkflow(workflows.WebhookDeliveryWorkflow)
	w.RegisterWorkflow(workflows.NotificationDeliveryWorkflow)
	w.RegisterWorkflow(workflows.ComplianceCheckWorkflow)
	w.RegisterWorkflow(workflows.SettlementProcessingWorkflow)

	// Register activities
	activityHandler := activities.NewActivityHandler(mw)
	w.RegisterActivity(activityHandler.ValidatePaymentSession)
	w.RegisterActivity(activityHandler.AuthorizePayment)
	w.RegisterActivity(activityHandler.CapturePayment)
	w.RegisterActivity(activityHandler.VoidAuthorization)
	w.RegisterActivity(activityHandler.RefundPayment)
	w.RegisterActivity(activityHandler.RecordLedgerEntry)
	w.RegisterActivity(activityHandler.ReverseLedgerEntry)
	w.RegisterActivity(activityHandler.SendWebhook)
	w.RegisterActivity(activityHandler.PublishToKafka)
	w.RegisterActivity(activityHandler.SendNotification)
	w.RegisterActivity(activityHandler.ValidateCompliance)
	w.RegisterActivity(activityHandler.GenerateAPICredentials)
	w.RegisterActivity(activityHandler.CreateMerchantAccount)
	w.RegisterActivity(activityHandler.SendEmail)
	w.RegisterActivity(activityHandler.CheckPermission)
	w.RegisterActivity(activityHandler.CacheSet)
	w.RegisterActivity(activityHandler.CacheGet)

	// Start worker
	log.Printf("Starting Temporal worker on task queue: %s", cfg.TaskQueue)
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalf("Worker failed: %v", err)
	}

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down worker...")
	w.Stop()
}
