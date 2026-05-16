package main

import (
	"log"
	"os"

	"kyc-orchestrator-service/internal/activities"
	"kyc-orchestrator-service/internal/workflows"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	temporalHost := os.Getenv("TEMPORAL_HOST")
	if temporalHost == "" {
		temporalHost = "temporal:7233"
	}

	c, err := client.Dial(client.Options{
		HostPort: temporalHost,
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	w := worker.New(c, "kyc-task-queue", worker.Options{})

	w.RegisterWorkflow(workflows.IndividualKYCWorkflow)
	w.RegisterWorkflow(workflows.BusinessKYBWorkflow)

	kycActivities := activities.NewKYCActivities()
	w.RegisterActivity(kycActivities.VerifyDocument)
	w.RegisterActivity(kycActivities.CheckLiveness)
	w.RegisterActivity(kycActivities.VerifyNIN)
	w.RegisterActivity(kycActivities.VerifyBVN)
	w.RegisterActivity(kycActivities.ScreenAML)
	w.RegisterActivity(kycActivities.CalculateRiskScore)
	w.RegisterActivity(kycActivities.VerifyCAC)
	w.RegisterActivity(kycActivities.NotifyKYCStarted)
	w.RegisterActivity(kycActivities.NotifyKYCCompleted)
	w.RegisterActivity(kycActivities.NotifyKYCFailed)
	w.RegisterActivity(kycActivities.PublishKYCEvent)
	w.RegisterActivity(kycActivities.PublishKYBEvent)

	log.Println("Starting KYC Orchestrator Worker...")
	err = w.Run(worker.InterruptCh())
	if err != nil {
		log.Fatalf("Unable to start worker: %v", err)
	}
}
