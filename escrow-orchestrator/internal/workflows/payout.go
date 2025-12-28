package workflows

import (
	"fmt"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// PayoutWorkflowInput represents input for the payout workflow
type PayoutWorkflowInput struct {
	EscrowID  string  `json:"escrow_id"`
	SellerID  string  `json:"seller_id"`
	Amount    float64 `json:"amount"`
	BankCode  string  `json:"bank_code"`
	AccountNumber string `json:"account_number"`
}

// PayoutWorkflowOutput represents output from the payout workflow
type PayoutWorkflowOutput struct {
	EscrowID     string    `json:"escrow_id"`
	SellerID     string    `json:"seller_id"`
	PayoutAmount float64   `json:"payout_amount"`
	Status       string    `json:"status"`
	KYCLevel     string    `json:"kyc_level,omitempty"`
	PaidAt       time.Time `json:"paid_at"`
}

// PayoutWorkflow orchestrates seller payout with KYC checks
// User Story 8: Payout triggers progressive KYC if thresholds hit
// User Story 9: Seller loyalty/tiers update after successful transaction
func PayoutWorkflow(ctx workflow.Context, input PayoutWorkflowInput) (*PayoutWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting PayoutWorkflow", "escrow_id", input.EscrowID, "seller_id", input.SellerID, "amount", input.Amount)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    5,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var a *activities.Activities

	// Step 1: Check KYC requirements for payout amount
	logger.Info("Step 1: Checking KYC requirements")
	var kycResult *activities.KYCCheckResponse
	err := workflow.ExecuteActivity(ctx, a.CheckKYCActivity, activities.KYCCheckRequest{
		UserID: input.SellerID,
		Amount: input.Amount,
	}).Get(ctx, &kycResult)
	if err != nil {
		logger.Warn("KYC check failed, continuing with caution", "error", err)
	}

	// Step 2: If KYC upgrade required, wait for completion
	if kycResult != nil && kycResult.RequiresKYC {
		logger.Info("Step 2: KYC upgrade required", "current_level", kycResult.Level, "next_level", kycResult.NextLevel)
		
		// Notify seller about KYC requirement
		workflow.ExecuteActivity(ctx, a.SendNotificationActivity, input.SellerID, "push",
			fmt.Sprintf("Please complete KYC level %s to receive your payout of %.2f", kycResult.NextLevel, input.Amount)).Get(ctx, nil)

		// Publish KYC required event
		workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
			EventType:   "kyc.required",
			AggregateID: input.SellerID,
			Timestamp:   workflow.Now(ctx),
			Version:     1,
			Data: map[string]interface{}{
				"escrow_id":     input.EscrowID,
				"current_level": kycResult.Level,
				"next_level":    kycResult.NextLevel,
				"amount":        input.Amount,
			},
		}).Get(ctx, nil)

		// Wait for KYC completion signal (up to 7 days)
		kycCompletedCh := workflow.GetSignalChannel(ctx, "kyc_completed")
		kycCtx, cancelKYC := workflow.WithCancel(ctx)
		kycTimer := workflow.NewTimer(kycCtx, 7*24*time.Hour)

		selector := workflow.NewSelector(ctx)
		var kycCompleted bool

		selector.AddReceive(kycCompletedCh, func(c workflow.ReceiveChannel, more bool) {
			var signal struct {
				Level string `json:"level"`
			}
			c.Receive(ctx, &signal)
			kycCompleted = true
			cancelKYC()
		})

		selector.AddFuture(kycTimer, func(f workflow.Future) {
			kycCompleted = false
		})

		selector.Select(ctx)

		if !kycCompleted {
			logger.Warn("KYC not completed in time, holding payout")
			return &PayoutWorkflowOutput{
				EscrowID:     input.EscrowID,
				SellerID:     input.SellerID,
				PayoutAmount: input.Amount,
				Status:       "pending_kyc",
				KYCLevel:     kycResult.Level,
				PaidAt:       workflow.Now(ctx),
			}, nil
		}
	}

	// Step 3: Verify bank account
	logger.Info("Step 3: Verifying bank account")
	var bankResult map[string]interface{}
	err = workflow.ExecuteActivity(ctx, a.VerifyBankActivity, input.BankCode, input.AccountNumber).Get(ctx, &bankResult)
	if err != nil {
		logger.Error("Bank verification failed", "error", err)
		return nil, fmt.Errorf("bank verification failed: %w", err)
	}

	// Step 4: Initiate payout
	logger.Info("Step 4: Initiating payout")
	err = workflow.ExecuteActivity(ctx, a.InitiatePayoutActivity, input.EscrowID, input.SellerID, input.Amount).Get(ctx, nil)
	if err != nil {
		logger.Error("Payout initiation failed", "error", err)
		return nil, fmt.Errorf("payout initiation failed: %w", err)
	}

	// Step 5: Publish payout completed event
	logger.Info("Step 5: Publishing payout completed event")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "payout.completed",
		AggregateID: input.EscrowID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"seller_id": input.SellerID,
			"amount":    input.Amount,
			"bank_code": input.BankCode,
		},
	}).Get(ctx, nil)

	// Step 6: Update seller loyalty/tier
	logger.Info("Step 6: Updating seller loyalty")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "seller.transaction_completed",
		AggregateID: input.SellerID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"escrow_id": input.EscrowID,
			"amount":    input.Amount,
		},
	}).Get(ctx, nil)

	// Step 7: Notify seller
	logger.Info("Step 7: Notifying seller")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, input.SellerID, "push",
		fmt.Sprintf("Your payout of %.2f has been sent to your bank account", input.Amount)).Get(ctx, nil)

	kycLevel := "basic"
	if kycResult != nil {
		kycLevel = kycResult.Level
	}

	logger.Info("PayoutWorkflow completed", "escrow_id", input.EscrowID, "amount", input.Amount)

	return &PayoutWorkflowOutput{
		EscrowID:     input.EscrowID,
		SellerID:     input.SellerID,
		PayoutAmount: input.Amount,
		Status:       "completed",
		KYCLevel:     kycLevel,
		PaidAt:       workflow.Now(ctx),
	}, nil
}
