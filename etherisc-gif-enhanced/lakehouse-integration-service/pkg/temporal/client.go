package temporal

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// Client simulates the Temporal client interface.
type Client interface {
	StartFullSyncWorkflow(ctx context.Context) (string, error)
	Close()
}

type temporalClientImpl struct {
	// In a real implementation, this would hold the temporal.Client
}

// NewClient creates a new simulated Temporal client.
func NewClient() (Client, error) {
	logrus.Info("Temporal client simulation initialized.")
	return &temporalClientImpl{}, nil
}

// StartFullSyncWorkflow simulates starting a Temporal workflow for a full data sync.
func (c *temporalClientImpl) StartFullSyncWorkflow(ctx context.Context) (string, error) {
	workflowID := fmt.Sprintf("full-sync-%d", time.Now().UnixNano())
	logrus.WithField("workflow_id", workflowID).Info("Simulating start of FullSyncWorkflow.")

	// In a real scenario, this would call:
	// temporalClient.ExecuteWorkflow(ctx, options, FullSyncWorkflow, args)

	// Simulate the workflow running in the background
	go func() {
		logrus.WithField("workflow_id", workflowID).Info("FullSyncWorkflow simulation started.")
		time.Sleep(5 * time.Second) // Simulate work being done
		logrus.WithField("workflow_id", workflowID).Info("FullSyncWorkflow simulation completed successfully.")
	}()

	return workflowID, nil
}

// Close simulates closing the Temporal client connection.
func (c *temporalClientImpl) Close() {
	logrus.Info("Temporal client simulation closed.")
}
