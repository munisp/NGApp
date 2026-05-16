package temporal

import (
	"time"

	"go.temporal.io/sdk/workflow"
	"openimis-insurance-integration/internal/events"
)

// ActuarialEventWorkflow is the main workflow that orchestrates the processing of actuarial events.
func ActuarialEventWorkflow(ctx workflow.Context, event events.ActuarialEvent) (string, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("ActuarialEventWorkflow started", "EventID", event.EventID, "EventType", event.EventType)

	// Define activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var result string
	var err error

	switch event.EventType {
	case events.PremiumAdjustment:
		// 1. Process the adjustment (complex logic)
		err = workflow.ExecuteActivity(ctx, (*Activities).ProcessPremiumAdjustmentActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("ProcessPremiumAdjustmentActivity failed", "Error", err)
			return "", err
		}
		logger.Info("ProcessPremiumAdjustmentActivity completed", "Result", result)

		// 2. Update Policy Service (Dapr/API call)
		err = workflow.ExecuteActivity(ctx, (*Activities).UpdatePolicyServiceActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("UpdatePolicyServiceActivity failed", "Error", err)
			// Decide on compensation/rollback logic here if needed
			return "", err
		}
		logger.Info("UpdatePolicyServiceActivity completed", "Result", result)

	case events.ReserveAdjustment:
		// 1. Process the adjustment (complex logic)
		err = workflow.ExecuteActivity(ctx, (*Activities).ProcessReserveAdjustmentActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("ProcessReserveAdjustmentActivity failed", "Error", err)
			return "", err
		}
		logger.Info("ProcessReserveAdjustmentActivity completed", "Result", result)

		// 2. Update Claims Service (API call)
		err = workflow.ExecuteActivity(ctx, (*Activities).UpdateClaimsServiceActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("UpdateClaimsServiceActivity failed", "Error", err)
			return "", err
		}
		logger.Info("UpdateClaimsServiceActivity completed", "Result", result)

	case events.ProductConfigUpdate:
		// 1. Notify Underwriting Service
		err = workflow.ExecuteActivity(ctx, (*Activities).NotifyUnderwritingActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("NotifyUnderwritingActivity failed", "Error", err)
			return "", err
		}
		logger.Info("NotifyUnderwritingActivity completed", "Result", result)

		// 2. Update Policy Service
		err = workflow.ExecuteActivity(ctx, (*Activities).UpdatePolicyServiceActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("UpdatePolicyServiceActivity failed", "Error", err)
			return "", err
		}
		logger.Info("UpdatePolicyServiceActivity completed", "Result", result)

	case events.LossRatioAlert:
		// 1. Notify Underwriting Service
		err = workflow.ExecuteActivity(ctx, (*Activities).NotifyUnderwritingActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("NotifyUnderwritingActivity failed", "Error", err)
			return "", err
		}
		logger.Info("NotifyUnderwritingActivity completed", "Result", result)

		// 2. Update Claims Service
		err = workflow.ExecuteActivity(ctx, (*Activities).UpdateClaimsServiceActivity, NewActivities(), event).Get(ctx, &result)
		if err != nil {
			logger.Error("UpdateClaimsServiceActivity failed", "Error", err)
			return "", err
		}
		logger.Info("UpdateClaimsServiceActivity completed", "Result", result)

	default:
		logger.Warn("Unknown event type received", "EventType", event.EventType)
		return "Unknown event type", nil
	}

	logger.Info("ActuarialEventWorkflow finished successfully", "EventID", event.EventID)
	return "Workflow completed for " + string(event.EventType), nil
}
