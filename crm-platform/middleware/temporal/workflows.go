package temporal

import (
	"fmt"
	"time"

	"go.temporal.io/sdk/workflow"
)

// CustomerOnboardingInput contains data for the onboarding workflow.
type CustomerOnboardingInput struct {
	TenantID    string
	CustomerID  string
	Email       string
	Phone       string
	FullName    string
	Vertical    string // banking, telco, commodity, cpaas
}

// CustomerOnboardingWorkflow orchestrates the multi-step onboarding process.
func CustomerOnboardingWorkflow(ctx workflow.Context, input CustomerOnboardingInput) error {
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

	// Step 1: Validate customer data
	var validationResult ValidationResult
	err := workflow.ExecuteActivity(ctx, ValidateCustomerActivity, input).Get(ctx, &validationResult)
	if err != nil {
		return fmt.Errorf("validation: %w", err)
	}

	// Step 2: KYC/compliance check (vertical-specific)
	var kycResult KYCResult
	err = workflow.ExecuteActivity(ctx, RunKYCCheckActivity, input).Get(ctx, &kycResult)
	if err != nil {
		return fmt.Errorf("kyc: %w", err)
	}

	// Step 3: Create customer record
	var customerID string
	err = workflow.ExecuteActivity(ctx, CreateCustomerRecordActivity, input).Get(ctx, &customerID)
	if err != nil {
		return fmt.Errorf("create customer: %w", err)
	}

	// Step 4: Send welcome notification
	err = workflow.ExecuteActivity(ctx, SendWelcomeNotificationActivity, input).Get(ctx, nil)
	if err != nil {
		return fmt.Errorf("welcome notification: %w", err)
	}

	// Step 5: Emit onboarding event to Kafka
	err = workflow.ExecuteActivity(ctx, EmitOnboardingEventActivity, input).Get(ctx, nil)
	if err != nil {
		return fmt.Errorf("emit event: %w", err)
	}

	return nil
}

// CampaignExecutionWorkflow orchestrates multi-channel campaign delivery.
func CampaignExecutionWorkflow(ctx workflow.Context, input CampaignInput) error {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Minute,
		HeartbeatTimeout:    time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Step 1: Resolve target audience
	var audience []string
	err := workflow.ExecuteActivity(ctx, ResolveAudienceActivity, input).Get(ctx, &audience)
	if err != nil {
		return err
	}

	// Step 2: Generate personalized content per channel
	var contents map[string]string
	err = workflow.ExecuteActivity(ctx, GenerateContentActivity, input, audience).Get(ctx, &contents)
	if err != nil {
		return err
	}

	// Step 3: Send via channels (parallel)
	var futures []workflow.Future
	for channel, content := range contents {
		f := workflow.ExecuteActivity(ctx, SendChannelMessageActivity, channel, content, audience)
		futures = append(futures, f)
	}
	for _, f := range futures {
		if err := f.Get(ctx, nil); err != nil {
			return err
		}
	}

	// Step 4: Record analytics
	return workflow.ExecuteActivity(ctx, RecordCampaignAnalyticsActivity, input).Get(ctx, nil)
}

// TradeSettlementWorkflow handles commodity trade settlement lifecycle.
func TradeSettlementWorkflow(ctx workflow.Context, input TradeInput) error {
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Minute,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	// Validate -> Match -> Clear -> Settle -> Confirm
	err := workflow.ExecuteActivity(ctx, ValidateTradeActivity, input).Get(ctx, nil)
	if err != nil {
		return err
	}
	err = workflow.ExecuteActivity(ctx, MatchTradeActivity, input).Get(ctx, nil)
	if err != nil {
		return err
	}
	err = workflow.ExecuteActivity(ctx, ClearTradeActivity, input).Get(ctx, nil)
	if err != nil {
		return err
	}
	err = workflow.ExecuteActivity(ctx, SettleTradeActivity, input).Get(ctx, nil)
	if err != nil {
		return err
	}
	return workflow.ExecuteActivity(ctx, ConfirmSettlementActivity, input).Get(ctx, nil)
}
