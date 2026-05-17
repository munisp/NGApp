package temporal

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
)

// TemporalClient wraps the Temporal SDK client for reinsurance workflows.
type TemporalClient struct {
	logger *slog.Logger
	client client.Client
}

// NewTemporalClient creates a new Temporal client wrapper.
func NewTemporalClient(logger *slog.Logger, tc client.Client) *TemporalClient {
	return &TemporalClient{
		logger: logger,
		client: tc,
	}
}

// StartSettlementWorkflow starts the reinsurance settlement workflow in Temporal.
func (c *TemporalClient) StartSettlementWorkflow(ctx context.Context, reinsurerID uint64) (string, error) {
	workflowID := fmt.Sprintf("reinsurance-settlement-%d-%d", reinsurerID, time.Now().Unix())

	if c.client != nil {
		workflowOptions := client.StartWorkflowOptions{
			ID:        workflowID,
			TaskQueue: "reinsurance-accounting-task-queue",
		}
		we, err := c.client.ExecuteWorkflow(ctx, workflowOptions, ReinsuranceSettlementWorkflowName, reinsurerID)
		if err != nil {
			c.logger.Error("Failed to start settlement workflow", "error", err)
			return "", fmt.Errorf("failed to start settlement workflow: %w", err)
		}
		c.logger.Info("Settlement workflow started", "workflow_id", we.GetID(), "reinsurer_id", reinsurerID)
		return we.GetID(), nil
	}

	c.logger.Info("Temporal client not connected, returning local workflow ID", "workflow_id", workflowID)
	return workflowID, nil
}

// StartWorker registers workflows and activities with the Temporal worker and starts it.
func StartWorker(c client.Client, a *Activities, taskQueue string) error {
	if c == nil {
		a.Logger.Warn("Temporal client is nil, worker not started")
		return nil
	}

	w := worker.New(c, taskQueue, worker.Options{})
	w.RegisterWorkflow(ReinsuranceSettlementWorkflow)
	w.RegisterActivity(a)

	a.Logger.Info("Starting Temporal worker", "task_queue", taskQueue)
	if err := w.Run(worker.InterruptCh()); err != nil {
		return fmt.Errorf("temporal worker failed: %w", err)
	}
	return nil
}
