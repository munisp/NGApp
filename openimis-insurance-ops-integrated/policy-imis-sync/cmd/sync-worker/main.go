package main

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"

	"policy-imis-sync/internal/app/activity"
	"policy-imis-sync/internal/app/service"
	"policy-imis-sync/internal/app/workflow"
	iclient "policy-imis-sync/internal/client"
	"policy-imis-sync/internal/config"
	"policy-imis-sync/internal/db"
)

func main() {
	cfg := config.LoadConfig()

	database, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalHost,
		Namespace: cfg.TemporalNamespace,
	})
	if err != nil {
		log.Fatalf("Failed to connect to Temporal: %v", err)
	}
	defer temporalClient.Close()

	openIMISClient := iclient.NewOpenIMISClient(cfg.OpenIMISBaseURL, cfg.OpenIMISAPIKey)
	policyClient := iclient.NewPolicyServiceClient(cfg.PolicyServiceURL)
	syncRepo := db.NewSyncStatusRepository(database)
	syncService := service.NewPolicySyncService(openIMISClient, policyClient, syncRepo)
	activities := activity.NewActivities(syncService)

	w := worker.New(temporalClient, "policy-sync-queue", worker.Options{})
	w.RegisterWorkflow(workflow.PolicySyncWorkflow)
	w.RegisterWorkflow(workflow.SinglePolicySyncWorkflow)
	w.RegisterActivity(activities.SyncPolicyActivity)
	w.RegisterActivity(activities.SyncPendingPoliciesActivity)

	log.Println("Starting policy sync worker...")
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalf("Worker failed: %v", err)
	}
}
