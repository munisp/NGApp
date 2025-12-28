package workflows

import (
	"fmt"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// RefundWorkflowInput represents input for the refund workflow
type RefundWorkflowInput struct {
	EscrowID string  `json:"escrow_id"`
	Reason   string  `json:"reason"`
	Amount   float64 `json:"amount,omitempty"` // 0 means full refund
}

// RefundWorkflowOutput represents output from the refund workflow
type RefundWorkflowOutput struct {
	EscrowID     string    `json:"escrow_id"`
	RefundAmount float64   `json:"refund_amount"`
	Status       string    `json:"status"`
	RefundedAt   time.Time `json:"refunded_at"`
}

// RefundWorkflow orchestrates refund processing
// User Story 11: Returns/refunds requested by buyer
// User Story 12: Escrow expiry and auto-refund
func RefundWorkflow(ctx workflow.Context, input RefundWorkflowInput) (*RefundWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting RefundWorkflow", "escrow_id", input.EscrowID, "reason", input.Reason)

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

	// Step 1: Get escrow details
	logger.Info("Step 1: Getting escrow details")
	var escrow *activities.EscrowDetails
	err := workflow.ExecuteActivity(ctx, a.GetEscrowActivity, input.EscrowID).Get(ctx, &escrow)
	if err != nil {
		logger.Error("Failed to get escrow", "error", err)
		return nil, fmt.Errorf("failed to get escrow: %w", err)
	}

	// Determine refund amount
	refundAmount := input.Amount
	if refundAmount == 0 {
		refundAmount = escrow.Amount
	}

	// Step 2: Validate refund eligibility
	logger.Info("Step 2: Validating refund eligibility")
	validStatuses := map[string]bool{
		"created":  true,
		"funded":   true,
		"accepted": true,
		"expired":  true,
	}
	if !validStatuses[escrow.Status] {
		logger.Error("Escrow not eligible for refund", "status", escrow.Status)
		return &RefundWorkflowOutput{
			EscrowID:     input.EscrowID,
			RefundAmount: 0,
			Status:       "ineligible",
			RefundedAt:   workflow.Now(ctx),
		}, nil
	}

	// Step 3: Process refund
	logger.Info("Step 3: Processing refund", "amount", refundAmount)
	err = workflow.ExecuteActivity(ctx, a.RefundEscrowActivity, activities.RefundRequest{
		EscrowID: input.EscrowID,
		Amount:   refundAmount,
		Reason:   input.Reason,
	}).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to process refund", "error", err)
		return nil, fmt.Errorf("failed to process refund: %w", err)
	}

	// Step 4: Publish refund event
	logger.Info("Step 4: Publishing refund event")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "escrow.refunded",
		AggregateID: input.EscrowID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"buyer_id":      escrow.BuyerID,
			"refund_amount": refundAmount,
			"reason":        input.Reason,
		},
	}).Get(ctx, nil)

	// Step 5: Notify buyer
	logger.Info("Step 5: Notifying buyer")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.BuyerID, "push",
		fmt.Sprintf("Your refund of %.2f %s has been processed", refundAmount, escrow.Currency)).Get(ctx, nil)

	// Step 6: Notify seller if applicable
	if escrow.SellerID != "" {
		logger.Info("Step 6: Notifying seller")
		workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.SellerID, "push",
			fmt.Sprintf("Escrow %s has been refunded to buyer", input.EscrowID)).Get(ctx, nil)
	}

	logger.Info("RefundWorkflow completed", "escrow_id", input.EscrowID, "refund_amount", refundAmount)

	return &RefundWorkflowOutput{
		EscrowID:     input.EscrowID,
		RefundAmount: refundAmount,
		Status:       "refunded",
		RefundedAt:   workflow.Now(ctx),
	}, nil
}

// ExpiryCheckWorkflow checks for expired escrows and auto-refunds
// User Story 12: Escrow expiry and auto-refund if seller doesn't respond
func ExpiryCheckWorkflow(ctx workflow.Context) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting ExpiryCheckWorkflow")

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

	// This workflow runs periodically to check for expired escrows
	// In production, this would query the database for expired escrows
	// and trigger RefundWorkflow for each one

	logger.Info("ExpiryCheckWorkflow completed")
	return nil
}
