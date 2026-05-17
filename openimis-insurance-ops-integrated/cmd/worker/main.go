package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"claims-openimis-sync/activity"
	"claims-openimis-sync/client"
	"claims-openimis-sync/config"
	"claims-openimis-sync/workflow"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// 1. Initialize Temporal Client
	c, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHostPort,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	// 2. Initialize Clients and Activities
	claimsClient := client.NewClaimsClient(cfg)
	openIMISClient := client.NewOpenIMISClient(cfg)
	activities := activity.NewActivities(claimsClient, openIMISClient)

	// 3. Start Temporal Worker
	w := worker.New(c, cfg.TaskQueue, worker.Options{})
	w.RegisterWorkflow(workflow.ClaimsSyncWorkflow)
	w.RegisterWorkflow(workflow.LossRatioReconciliationWorkflow)
	w.RegisterActivity(activities.SyncClaimsToOpenIMIS)
	w.RegisterActivity(activities.ReverseSyncReserveAdjustments)
	w.RegisterActivity(activities.ReconcileLossRatio)

	go func() {
		if err := w.Run(worker.InterruptCh()); err != nil {
			log.Printf("Temporal worker failed: %v", err)
		}
	}()

	// 4. Start Prometheus Metrics Server
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Println("Starting metrics server on :9090")
		if err := http.ListenAndServe(":9090", nil); err != nil {
			log.Fatalf("Metrics server failed: %v", err)
		}
	}()

	// 5. Start the main periodic workflow (ClaimsSyncWorkflow)
	go func() {
		// Start the first run immediately
		startWorkflow(c, cfg, workflow.ClaimsSyncWorkflow, "claims-sync-workflow")

		// Schedule subsequent runs
		ticker := time.NewTicker(cfg.SyncInterval)
		defer ticker.Stop()

		for range ticker.C {
			startWorkflow(c, cfg, workflow.ClaimsSyncWorkflow, "claims-sync-workflow")
		}
	}()

	// 6. Start the periodic reconciliation workflow (LossRatioReconciliationWorkflow)
	go func() {
		// In a real system, this would iterate over all policies.
		// For this example, we'll hardcode a policy ID.
		policyID := "POLICY-A"

		// Start the first run immediately
		startWorkflow(c, cfg, workflow.LossRatioReconciliationWorkflow, "loss-ratio-reconciliation-workflow", policyID)

		// Schedule subsequent runs
		ticker := time.NewTicker(cfg.LossRatioReconciliationInterval)
		defer ticker.Stop()

		for range ticker.C {
			startWorkflow(c, cfg, workflow.LossRatioReconciliationWorkflow, "loss-ratio-reconciliation-workflow", policyID)
		}
	}()

	// Block main goroutine forever
	select {}
}

func startWorkflow(c client.Client, cfg *config.Config, wf interface{}, wfID string, args ...interface{}) {
	// Use a unique ID for each run to avoid "Workflow already started" error
	runID := wfID + "-" + time.Now().Format("20060102150405")
	
	options := client.StartWorkflowOptions{
		ID:        runID,
		TaskQueue: cfg.TaskQueue,
	}

	_, err := c.ExecuteWorkflow(context.Background(), options, wf, args...)
	if err != nil {
		log.Printf("Failed to start workflow %s: %v", wfID, err)
	} else {
		log.Printf("Started workflow %s with ID: %s", wfID, runID)
	}
}
