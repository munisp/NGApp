package workflow

import (
	"time"

	"go.temporal.io/sdk/workflow"

	"claims-openimis-sync/activity"
	"claims-openimis-sync/model"
)

type ClaimsSyncWorkflowInput struct {
	BatchSize int
}

type ClaimsSyncWorkflowResult struct {
	TotalClaims   int
	SyncedClaims  int
	FailedClaims  int
	Results       []model.SyncResult
}

func ClaimsSyncWorkflow(ctx workflow.Context, input ClaimsSyncWorkflowInput) (*ClaimsSyncWorkflowResult, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var activities *activity.Activities
	var claims []model.Claim
	
	err := workflow.ExecuteActivity(ctx, activities.FetchPendingClaimsActivity).Get(ctx, &claims)
	if err != nil {
		return nil, err
	}

	result := &ClaimsSyncWorkflowResult{
		TotalClaims: len(claims),
		Results:     make([]model.SyncResult, 0, len(claims)),
	}

	for _, claim := range claims {
		var syncResult model.SyncResult
		err := workflow.ExecuteActivity(ctx, activities.SyncClaimToOpenIMISActivity, claim).Get(ctx, &syncResult)
		if err != nil {
			result.FailedClaims++
			result.Results = append(result.Results, model.SyncResult{
				ClaimID:      claim.ID,
				Status:       "failed",
				ErrorMessage: err.Error(),
				SyncedAt:     time.Now(),
			})
			continue
		}

		if syncResult.Status == "synced" {
			result.SyncedClaims++
		} else {
			result.FailedClaims++
		}
		result.Results = append(result.Results, syncResult)
	}

	return result, nil
}

func SingleClaimSyncWorkflow(ctx workflow.Context, claim model.Claim) (*model.SyncResult, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var activities *activity.Activities
	var syncResult model.SyncResult
	
	err := workflow.ExecuteActivity(ctx, activities.SyncClaimToOpenIMISActivity, claim).Get(ctx, &syncResult)
	if err != nil {
		return &model.SyncResult{
			ClaimID:      claim.ID,
			Status:       "failed",
			ErrorMessage: err.Error(),
			SyncedAt:     time.Now(),
		}, nil
	}

	return &syncResult, nil
}
