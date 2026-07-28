package workflow

import (
	"time"

	"go.temporal.io/sdk/workflow"
)

// ClaimsSyncWorkflow is the main workflow that orchestrates the bidirectional sync.
func ClaimsSyncWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("ClaimsSyncWorkflow started")

	// 1. Configure Activity Options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// 2. Bidirectional Sync Activities (executed in parallel for efficiency)
	syncClaimsFuture := workflow.ExecuteActivity(ctx, "SyncClaimsToOpenIMIS")
	reverseSyncFuture := workflow.ExecuteActivity(ctx, "ReverseSyncReserveAdjustments")

	// Wait for both to complete
	syncClaimsErr := syncClaimsFuture.Get(ctx, nil)
	reverseSyncErr := reverseSyncFuture.Get(ctx, nil)

	if syncClaimsErr != nil {
		logger.Error("SyncClaimsToOpenIMIS failed", "Error", syncClaimsErr)
		// Non-fatal error, continue with the rest of the workflow
	}
	if reverseSyncErr != nil {
		logger.Error("ReverseSyncReserveAdjustments failed", "Error", reverseSyncErr)
		// Non-fatal error, continue with the rest of the workflow
	}

	// 3. Automated Reserve Adjustment Workflow (if needed, this would be a separate workflow)
	// For simplicity, we'll assume the reverse sync covers the automated adjustment for now.

	// 4. Reconciliation Workflow (Loss Ratio Update)
	// In a real scenario, we would get a list of policies to reconcile.
	// For this example, we'll hardcode a policy ID.
	policyID := "POLICY-A"
	reconciliationFuture := workflow.ExecuteActivity(ctx, "ReconcileLossRatio", policyID)

	reconciliationErr := reconciliationFuture.Get(ctx, nil)
	if reconciliationErr != nil {
		logger.Error("ReconcileLossRatio failed", "Error", reconciliationErr)
		// Non-fatal error, continue
	}

	logger.Info("ClaimsSyncWorkflow completed successfully")
	return nil
}

// LossRatioReconciliationWorkflow is a separate workflow for periodic reconciliation.
func LossRatioReconciliationWorkflow(ctx workflow.Context, policyID string) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("LossRatioReconciliationWorkflow started", "PolicyID", policyID)

	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &workflow.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	reconciliationFuture := workflow.ExecuteActivity(ctx, "ReconcileLossRatio", policyID)

	reconciliationErr := reconciliationFuture.Get(ctx, nil)
	if reconciliationErr != nil {
		logger.Error("ReconcileLossRatio failed", "Error", reconciliationErr)
		return reconciliationErr
	}

	logger.Info("LossRatioReconciliationWorkflow completed successfully")
	return nil
}
