package temporal

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.temporal.io/sdk/client"
)

// MockTemporalClient implements the core.TemporalClient interface.
type MockTemporalClient struct {
	logger *slog.Logger
	// In a real implementation, this would hold the actual Temporal client
	// client.Client
}

// NewMockTemporalClient creates a new mock Temporal client.
func NewMockTemporalClient(logger *slog.Logger) *MockTemporalClient {
	return &MockTemporalClient{
		logger: logger,
	}
}

// StartSettlementWorkflow simulates starting the Temporal workflow.
func (c *MockTemporalClient) StartSettlementWorkflow(ctx context.Context, reinsurerID uint64) (string, error) {
	// In a real implementation:
	// workflowOptions := client.StartWorkflowOptions{
	// 	ID:        fmt.Sprintf("reinsurance-settlement-%d-%d", reinsurerID, time.Now().Unix()),
	// 	TaskQueue: "reinsurance-accounting-task-queue",
	// }
	// we, err := c.client.ExecuteWorkflow(ctx, workflowOptions, ReinsuranceSettlementWorkflowName, reinsurerID)
	// if err != nil {
	// 	return "", err
	// }
	// return we.GetID(), nil

	// Mock implementation:
	workflowID := fmt.Sprintf("mock-settlement-wf-%d-%d", reinsurerID, time.Now().Unix())
	c.logger.Info("Simulating Temporal workflow start", "workflow_id", workflowID, "reinsurer_id", reinsurerID)
	return workflowID, nil
}

// StartWorker is a placeholder for starting the Temporal worker.
func StartWorker(c client.Client, a *Activities, taskQueue string) {
	// w := worker.New(c, taskQueue, worker.Options{})
	// w.RegisterWorkflow(ReinsuranceSettlementWorkflow)
	// w.RegisterActivity(a)
	// err := w.Run(worker.InterruptCh())
	// if err != nil {
	// 	log.Fatalf("Unable to start worker: %v", err)
	// }
}
