package temporal

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
	"underwriting-risk-integrator/pkg/models"
)

// UnderwritingRiskAssessmentWorkflow is the main workflow for risk assessment.
func UnderwritingRiskAssessmentWorkflow(ctx workflow.Context, input models.UnderwritingCase) (*models.UnderwritingDecision, error) {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    10 * time.Second,
			MaximumAttempts:    5,
			NonRetryableErrorTypes: []string{"ValidationError"}, // Custom error type for non-retryable errors
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	logger := workflow.GetLogger(ctx)
	logger.Info("UnderwritingRiskAssessmentWorkflow started", "case_id", input.CaseID)

	var activities *ActivityContext // Activities are invoked via an interface

	// 1. Assess Risk with OpenIMIS
	var riskResult models.RiskAssessmentResult
	err := workflow.ExecuteActivity(ctx, activities.AssessRiskActivity, input).Get(ctx, &riskResult)
	if err != nil {
		logger.Error("Failed to assess risk", "error", err)
		return nil, err
	}
	logger.Info("Risk assessment completed", "risk_score", riskResult.RiskScore)

	// 2. Lookup Mortality Table
	var mortalityRate models.MortalityTableEntry
	// Assuming gender is 'M' for simplicity in this mock, but it should come from the input
	err = workflow.ExecuteActivity(ctx, activities.LookupMortalityTableActivity, input.ApplicantAge, "M").Get(ctx, &mortalityRate)
	if err != nil {
		logger.Error("Failed to lookup mortality table", "error", err)
		return nil, err
	}
	logger.Info("Mortality table lookup completed", "mortality_rate", mortalityRate.MortalityRate)

	// 3. Validate Actuarial Guidelines
	var isValid bool
	var validationReason string
	err = workflow.ExecuteActivity(ctx, activities.ValidateActuarialGuidelinesActivity, input, &mortalityRate, &riskResult).Get(ctx, &isValid, &validationReason)
	if err != nil {
		logger.Error("Failed to validate actuarial guidelines", "error", err)
		return nil, err
	}
	logger.Info("Actuarial validation completed", "is_valid", isValid, "reason", validationReason)

	// 4. Determine Final Decision
	var finalDecision models.UnderwritingDecision
	err = workflow.ExecuteActivity(ctx, activities.DetermineFinalDecisionActivity, input, isValid, validationReason, &riskResult).Get(ctx, &finalDecision)
	if err != nil {
		logger.Error("Failed to determine final decision", "error", err)
		return nil, err
	}
	logger.Info("Final decision determined", "decision", finalDecision.Decision)

	// 5. Sync Underwriting Decision (Bidirectional Sync)
	err = workflow.ExecuteActivity(ctx, activities.SyncUnderwritingDecisionActivity, finalDecision).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to sync underwriting decision", "error", err)
		// Depending on business logic, this might be a non-fatal error, but we treat it as fatal for this example.
		return nil, err
	}
	logger.Info("Underwriting decision synced successfully")

	return &finalDecision, nil
}
