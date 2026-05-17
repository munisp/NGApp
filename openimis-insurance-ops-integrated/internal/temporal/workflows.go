package temporal

import (
	"time"

	"claims-reserve-service/internal/model"
	"claims-reserve-service/pkg/log"

	"github.com/google/uuid"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
	"go.uber.org/zap"
)

// ReserveAdjustmentWorkflow is the main workflow for claims reserve adjustment
func ReserveAdjustmentWorkflow(ctx workflow.Context, request model.ReserveAdjustmentRequest) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("ReserveAdjustmentWorkflow started", zap.Any("request", request))

	// 1. Define Activity Options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// 2. Fetch Claim Details
	var claim *model.Claim
	err := workflow.ExecuteActivity(ctx, (*Activities).FetchClaimActivity, request.ClaimID).Get(ctx, &claim)
	if err != nil {
		logger.Error("FetchClaimActivity failed", zap.Error(err))
		return err
	}

	// 3. Calculate Reserve
	var reserve *model.Reserve
	err = workflow.ExecuteActivity(ctx, (*Activities).CalculateReserveActivity, *claim).Get(ctx, &reserve)
	if err != nil {
		logger.Error("CalculateReserveActivity failed", zap.Error(err))
		return err
	}

	// 4. Persist Reserve
	err = workflow.ExecuteActivity(ctx, (*Activities).PersistReserveActivity, *reserve).Get(ctx, nil)
	if err != nil {
		logger.Error("PersistReserveActivity failed", zap.Error(err))
		return err
	}

	// 5. Sync Reserve back to OpenIMIS
	err = workflow.ExecuteActivity(ctx, (*Activities).SyncReserveToOpenIMISActivity, *reserve).Get(ctx, nil)
	if err != nil {
		logger.Error("SyncReserveToOpenIMISActivity failed", zap.Error(err))
		return err
	}

	logger.Info("ReserveAdjustmentWorkflow completed successfully", zap.String("claimID", request.ClaimID.String()))
	return nil
}

// IBNRCalculationWorkflow is a scheduled workflow for IBNR calculation
func IBNRCalculationWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("IBNRCalculationWorkflow started")

	// 1. Define Activity Options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second, // IBNR calculation might take longer
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    5 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    5 * time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	// 2. Execute IBNR Calculation Activity
	err := workflow.ExecuteActivity(ctx, (*Activities).CalculateIBNRActivity).Get(ctx, nil)
	if err != nil {
		logger.Error("CalculateIBNRActivity failed", zap.Error(err))
		return err
	}

	logger.Info("IBNRCalculationWorkflow completed successfully")
	return nil
}

// Signal to trigger the IBNR calculation on claim creation
const IBNRCalculationSignal = "ibnr_calculation_trigger"

// IBNRTriggerWorkflow is a simple workflow to trigger IBNR calculation
func IBNRTriggerWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("IBNRTriggerWorkflow started")

	// Wait for the signal
	signalChan := workflow.GetSignalChannel(ctx, IBNRCalculationSignal)
	
	// Block until a signal is received
	var claimID uuid.UUID
	signalChan.Receive(ctx, &claimID)

	logger.Info("IBNR calculation signal received", zap.String("claimID", claimID.String()))

	// Start the IBNR calculation workflow as a child workflow
	childWorkflowOptions := workflow.ChildWorkflowOptions{
		WorkflowID: "ibnr-calculation-" + workflow.GetInfo(ctx).WorkflowExecution.RunID,
	}
	childCtx := workflow.WithChildOptions(ctx, childWorkflowOptions)

	err := workflow.ExecuteChildWorkflow(childCtx, IBNRCalculationWorkflow).Get(childCtx, nil)
	if err != nil {
		logger.Error("Failed to start IBNRCalculationWorkflow as child", zap.Error(err))
		return err
	}

	logger.Info("IBNRTriggerWorkflow completed after triggering child workflow")
	return nil
}
