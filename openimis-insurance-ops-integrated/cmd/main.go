package main

import (

	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"

	"openimis-underwriting-sync/internal/clients"
	"openimis-underwriting-sync/internal/config"
	"openimis-underwriting-sync/internal/temporal"
	"openimis-underwriting-sync/internal/logger"
)

func main() {
		// 2. Setup Logger
		log := logrus.New()
		log.SetFormatter(&logrus.JSONFormatter{})
		log.SetOutput(os.Stdout)
		log.SetLevel(logrus.InfoLevel)

		// 1. Load Configuration
		cfg, err := config.LoadConfig()
		if err != nil {
			log.Fatalf("Failed to load configuration: %v", err)
		}

	// 3. Setup Temporal Client
	c, err := client.Dial(client.Options{
		HostPort:  cfg.Temporal.HostPort,
		Namespace: cfg.Temporal.Namespace,
		Logger:    logger.NewTemporalLogger(log), // Use custom logger wrapper
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	// 4. Setup Worker
	w := worker.New(c, cfg.Temporal.TaskQueue, worker.Options{})

	// 5. Register Workflows and Activities
	w.RegisterWorkflow(temporal.WorkflowSyncUnderwritingData)
	w.RegisterWorkflow(temporal.WorkflowSyncActuarialGuidelines)
	w.RegisterWorkflow(temporal.WorkflowReconcileRiskScores)
	w.RegisterWorkflow(temporal.WorkflowAutomatedGuidelineUpdate)

	
	openIMISClient := clients.NewOpenIMISClient()
	underwritingClient := clients.NewUnderwritingClient()

	activities := &temporal.Activities{
		OpenIMISClient: openIMISClient,
		UnderwritingClient: underwritingClient,
		Logger: log,
	}
	w.RegisterActivity(activities)

	// 6. Start Worker in a goroutine
	go func() {
		log.Infof("Starting Temporal Worker on Task Queue: %s", cfg.Temporal.TaskQueue)
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Fatalf("Temporal Worker failed: %v", err)
		}
	}()

	// 7. Start Prometheus Metrics Server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		addr := fmt.Sprintf(":%d", cfg.Server.Port)
		log.Infof("Starting Metrics Server on %s/metrics", addr)
		if err := http.ListenAndServe(addr, nil); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Metrics server failed: %v", err)
		}
	}()

	// 8. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("Shutting down worker...")

	// Worker will stop gracefully after receiving the interrupt signal
	w.Stop()
	log.Info("Worker stopped.")
}


