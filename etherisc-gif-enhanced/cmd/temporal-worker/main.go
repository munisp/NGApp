package main

import (
	"log"
	"os"

	"policy-service-integration/pkg/gif"
	"policy-service-integration/pkg/repo"
	"policy-service-integration/pkg/temporal"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

func main() {
	// 1. Setup Dependencies (Mocked for this implementation)
	mockRepo := repo.NewMockRepository()
	mockGIFClient := gif.NewMockGIFClient()
	activities := &temporal.Activities{
		Repo: mockRepo,
		GIF:  mockGIFClient,
	}

	// 2. Create the Temporal Client
	// In a real application, this would read configuration for the Temporal server address.
	c, err := client.Dial(client.Options{
		HostPort:  os.Getenv("TEMPORAL_HOST_PORT"), // Use environment variable
		Namespace: os.Getenv("TEMPORAL_NAMESPACE"), // Use environment variable
	})
	if err != nil {
		log.Fatalf("Unable to create Temporal client: %v", err)
	}
	defer c.Close()

	// 3. Create the Worker
	// Task Queue name should be consistent between the API server and the worker.
	w := worker.New(c, "policy-service-task-queue", worker.Options{})

	// 4. Register Workflow and Activities
	w.RegisterWorkflow(temporal.CreateParametricPolicyWorkflow)
	w.RegisterActivity(activities)

	// 5. Start the Worker
	log.Println("Starting Temporal Worker...")
	err = w.Run(worker.InterruptCh())
	if err != nil {
		log.Fatalf("Temporal Worker failed: %v", err)
	}
}
