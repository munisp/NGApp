package temporal

import (
	"time"

	"go.temporal.io/sdk/workflow"
	"reinsurer-api/internal/model"
)

// QuoteSubmissionWorkflow orchestrates the quote submission process.
func QuoteSubmissionWorkflow(ctx workflow.Context, quote model.QuoteSubmission) (model.QuoteResponse, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("QuoteSubmissionWorkflow started", "quoteID", quote.QuoteID)

	// Define activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var activities *Activities
	var result model.QuoteResponse

	// 1. Process the quote (e.g., validate, calculate risk, integrate with policy service)
	err := workflow.ExecuteActivity(ctx, activities.ProcessQuoteActivity, quote).Get(ctx, &result)
	if err != nil {
		logger.Error("ProcessQuoteActivity failed", "error", err)
		return model.QuoteResponse{
			QuoteID: quote.QuoteID,
			Status:  "FAILURE",
			Message: "Internal processing error: " + err.Error(),
		}, err
	}

	logger.Info("QuoteSubmissionWorkflow completed", "status", result.Status)
	return result, nil
}

// ClaimNotificationWorkflow orchestrates the claim notification process.
func ClaimNotificationWorkflow(ctx workflow.Context, claim model.ClaimNotification) (model.ClaimResponse, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("ClaimNotificationWorkflow started", "claimID", claim.ClaimID)

	// Define activity options
	activityOptions := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, activityOptions)

	var activities *Activities
	var result model.ClaimResponse

	// 1. Notify the reinsurer (e.g., via webhook or API call)
	err := workflow.ExecuteActivity(ctx, activities.NotifyReinsurerActivity, claim).Get(ctx, &result)
	if err != nil {
		logger.Error("NotifyReinsurerActivity failed", "error", err)
		return model.ClaimResponse{
			ClaimID: claim.ClaimID,
			Status:  "ERROR",
			Message: "Internal notification error: " + err.Error(),
		}, err
	}

	logger.Info("ClaimNotificationWorkflow completed", "status", result.Status)
	return result, nil
}
