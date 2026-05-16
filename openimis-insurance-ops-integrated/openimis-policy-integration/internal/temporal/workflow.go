package temporal

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// PolicyPremiumCalculationWorkflowName is the name of the workflow.
const PolicyPremiumCalculationWorkflowName = "PolicyPremiumCalculationWorkflow"

// PolicyPremiumCalculationWorkflow is the Temporal workflow that orchestrates the premium calculation.
func PolicyPremiumCalculationWorkflow(ctx workflow.Context, input PremiumCalculationInput) (*PremiumCalculationOutput, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
			NonRetryableErrorTypes: []string{"InvalidArgumentError"}, // Example non-retryable error
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	logger := workflow.GetLogger(ctx)
	logger.Info("Policy Premium Calculation Workflow started", "policy_id", input.PolicyID)

	var result *PremiumCalculationOutput
	err := workflow.ExecuteActivity(ctx, "CalculatePremiumActivity", input).Get(ctx, &result)
	if err != nil {
		logger.Error("Premium calculation activity failed", "error", err)
		return nil, err
	}

	logger.Info("Policy Premium Calculation Workflow completed successfully", "premium", result.CalculatedPremium)
	return result, nil
}
