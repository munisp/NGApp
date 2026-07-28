package workflow

import (
	"time"

	"go.temporal.io/sdk/workflow"

	"policy-imis-sync/internal/app/activity"
	"policy-imis-sync/internal/model"
)

type PolicySyncWorkflowInput struct {
	BatchSize int
}

type PolicySyncWorkflowResult struct {
	TotalPolicies  int
	SyncedPolicies int
	FailedPolicies int
	Results        []model.SyncStatus
}

func PolicySyncWorkflow(ctx workflow.Context, input PolicySyncWorkflowInput) (*PolicySyncWorkflowResult, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var activities *activity.Activities
	var results []model.SyncStatus

	err := workflow.ExecuteActivity(ctx, activities.SyncPendingPoliciesActivity).Get(ctx, &results)
	if err != nil {
		return nil, err
	}

	result := &PolicySyncWorkflowResult{
		TotalPolicies: len(results),
		Results:       results,
	}

	for _, r := range results {
		if r.Status == "synced" {
			result.SyncedPolicies++
		} else {
			result.FailedPolicies++
		}
	}

	return result, nil
}

func SinglePolicySyncWorkflow(ctx workflow.Context, policy model.Policy) (*model.SyncStatus, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 2 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var activities *activity.Activities
	var status model.SyncStatus

	err := workflow.ExecuteActivity(ctx, activities.SyncPolicyActivity, policy).Get(ctx, &status)
	if err != nil {
		return nil, err
	}

	return &status, nil
}
