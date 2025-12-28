package workflows

import (
	"fmt"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// EscrowHappyPathInput represents input for the happy path workflow
type EscrowHappyPathInput struct {
	BuyerID     string  `json:"buyer_id"`
	SellerID    string  `json:"seller_id,omitempty"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Description string  `json:"description"`
	ProductURL  string  `json:"product_url,omitempty"`
	Platform    string  `json:"platform,omitempty"`
}

// EscrowHappyPathOutput represents output from the happy path workflow
type EscrowHappyPathOutput struct {
	EscrowID    string    `json:"escrow_id"`
	Status      string    `json:"status"`
	CompletedAt time.Time `json:"completed_at"`
	PayoutAmount float64  `json:"payout_amount,omitempty"`
}

// EscrowHappyPathSignals defines signals for the workflow
type EscrowHappyPathSignals struct {
	SellerAccepted  bool   `json:"seller_accepted"`
	SellerID        string `json:"seller_id"`
	BankCode        string `json:"bank_code"`
	AccountNumber   string `json:"account_number"`
	Shipped         bool   `json:"shipped"`
	TrackingNumber  string `json:"tracking_number"`
	Carrier         string `json:"carrier"`
	DeliveryConfirmed bool `json:"delivery_confirmed"`
	Rating          int    `json:"rating"`
	Feedback        string `json:"feedback"`
	DisputeOpened   bool   `json:"dispute_opened"`
	DisputeReason   string `json:"dispute_reason"`
	Cancelled       bool   `json:"cancelled"`
}

// EscrowHappyPathWorkflow orchestrates the complete escrow lifecycle
// User Story 1: Buyer creates escrow -> Seller accepts -> Seller ships -> Buyer confirms -> Funds released
func EscrowHappyPathWorkflow(ctx workflow.Context, input EscrowHappyPathInput) (*EscrowHappyPathOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting EscrowHappyPathWorkflow", "buyer_id", input.BuyerID, "amount", input.Amount)

	// Activity options with retry policy
	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    time.Minute,
			MaximumAttempts:    3,
		},
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var a *activities.Activities

	// Step 1: Fraud check before creating escrow
	logger.Info("Step 1: Running fraud check")
	var fraudResult *activities.FraudCheckResponse
	err := workflow.ExecuteActivity(ctx, a.CheckFraudActivity, activities.FraudCheckRequest{
		TransactionID: workflow.GetInfo(ctx).WorkflowExecution.ID,
		Amount:        input.Amount,
		BuyerID:       input.BuyerID,
		SellerID:      input.SellerID,
		Platform:      input.Platform,
	}).Get(ctx, &fraudResult)
	if err != nil {
		logger.Error("Fraud check failed", "error", err)
		return nil, fmt.Errorf("fraud check failed: %w", err)
	}

	if !fraudResult.Approved {
		logger.Warn("Transaction rejected by fraud check", "risk_score", fraudResult.RiskScore)
		return &EscrowHappyPathOutput{
			Status:      "rejected_fraud",
			CompletedAt: workflow.Now(ctx),
		}, nil
	}

	// Step 2: KYC check for buyer
	logger.Info("Step 2: Running KYC check")
	var kycResult *activities.KYCCheckResponse
	err = workflow.ExecuteActivity(ctx, a.CheckKYCActivity, activities.KYCCheckRequest{
		UserID: input.BuyerID,
		Amount: input.Amount,
	}).Get(ctx, &kycResult)
	if err != nil {
		logger.Warn("KYC check failed, continuing", "error", err)
	}

	if kycResult != nil && kycResult.RequiresKYC {
		logger.Info("KYC upgrade required", "current_level", kycResult.Level, "next_level", kycResult.NextLevel)
		// In production, this would wait for KYC completion signal
	}

	// Step 3: Create escrow
	logger.Info("Step 3: Creating escrow")
	var createResult *activities.CreateEscrowResponse
	err = workflow.ExecuteActivity(ctx, a.CreateEscrowActivity, activities.CreateEscrowRequest{
		BuyerID:     input.BuyerID,
		SellerID:    input.SellerID,
		Amount:      input.Amount,
		Currency:    input.Currency,
		Description: input.Description,
		ProductURL:  input.ProductURL,
		Platform:    input.Platform,
	}).Get(ctx, &createResult)
	if err != nil {
		logger.Error("Failed to create escrow", "error", err)
		return nil, fmt.Errorf("failed to create escrow: %w", err)
	}

	escrowID := createResult.EscrowID
	logger.Info("Escrow created", "escrow_id", escrowID)

	// Cache workflow ID for this escrow
	err = workflow.ExecuteActivity(ctx, a.CacheWorkflowIDActivity, escrowID, workflow.GetInfo(ctx).WorkflowExecution.ID).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to cache workflow ID", "error", err)
	}

	// Step 4: Wait for seller to accept (with timeout)
	logger.Info("Step 4: Waiting for seller acceptance")
	sellerAcceptedCh := workflow.GetSignalChannel(ctx, "seller_accepted")
	
	var sellerSignal struct {
		SellerID      string `json:"seller_id"`
		BankCode      string `json:"bank_code"`
		AccountNumber string `json:"account_number"`
	}

	// Wait up to 72 hours for seller acceptance
	acceptCtx, cancelAccept := workflow.WithCancel(ctx)
	acceptTimer := workflow.NewTimer(acceptCtx, 72*time.Hour)

	selector := workflow.NewSelector(ctx)
	var sellerAccepted bool

	selector.AddReceive(sellerAcceptedCh, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &sellerSignal)
		sellerAccepted = true
		cancelAccept()
	})

	selector.AddFuture(acceptTimer, func(f workflow.Future) {
		// Timer fired - seller didn't accept in time
		sellerAccepted = false
	})

	selector.Select(ctx)

	if !sellerAccepted {
		logger.Info("Seller did not accept in time, auto-refunding")
		// Auto-refund buyer
		err = workflow.ExecuteActivity(ctx, a.RefundEscrowActivity, activities.RefundRequest{
			EscrowID: escrowID,
			Reason:   "seller_timeout",
		}).Get(ctx, nil)
		if err != nil {
			logger.Error("Auto-refund failed", "error", err)
		}
		return &EscrowHappyPathOutput{
			EscrowID:    escrowID,
			Status:      "expired_refunded",
			CompletedAt: workflow.Now(ctx),
		}, nil
	}

	// Step 5: Verify seller's bank account
	logger.Info("Step 5: Verifying seller bank account")
	var bankResult map[string]interface{}
	err = workflow.ExecuteActivity(ctx, a.VerifyBankActivity, sellerSignal.BankCode, sellerSignal.AccountNumber).Get(ctx, &bankResult)
	if err != nil {
		logger.Error("Bank verification failed", "error", err)
		return nil, fmt.Errorf("bank verification failed: %w", err)
	}

	// Step 6: Accept escrow
	logger.Info("Step 6: Accepting escrow")
	err = workflow.ExecuteActivity(ctx, a.AcceptEscrowActivity, activities.AcceptEscrowRequest{
		EscrowID:      escrowID,
		SellerID:      sellerSignal.SellerID,
		BankCode:      sellerSignal.BankCode,
		AccountNumber: sellerSignal.AccountNumber,
	}).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to accept escrow", "error", err)
		return nil, fmt.Errorf("failed to accept escrow: %w", err)
	}

	// Step 7: Wait for shipping (with timeout)
	logger.Info("Step 7: Waiting for shipping")
	shippedCh := workflow.GetSignalChannel(ctx, "shipped")
	disputeCh := workflow.GetSignalChannel(ctx, "dispute_opened")

	var shippingSignal struct {
		TrackingNumber string `json:"tracking_number"`
		Carrier        string `json:"carrier"`
	}
	var disputeSignal struct {
		Reason string `json:"reason"`
	}

	// Wait up to 7 days for shipping
	shipCtx, cancelShip := workflow.WithCancel(ctx)
	shipTimer := workflow.NewTimer(shipCtx, 7*24*time.Hour)

	selector = workflow.NewSelector(ctx)
	var shipped, disputeOpened bool

	selector.AddReceive(shippedCh, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &shippingSignal)
		shipped = true
		cancelShip()
	})

	selector.AddReceive(disputeCh, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &disputeSignal)
		disputeOpened = true
		cancelShip()
	})

	selector.AddFuture(shipTimer, func(f workflow.Future) {
		shipped = false
	})

	selector.Select(ctx)

	if disputeOpened {
		// Transition to dispute workflow
		logger.Info("Dispute opened, transitioning to dispute workflow")
		var disputeID string
		err = workflow.ExecuteActivity(ctx, a.OpenDisputeActivity, activities.DisputeRequest{
			EscrowID: escrowID,
			Reason:   disputeSignal.Reason,
		}).Get(ctx, &disputeID)
		if err != nil {
			logger.Error("Failed to open dispute", "error", err)
		}
		return &EscrowHappyPathOutput{
			EscrowID:    escrowID,
			Status:      "disputed",
			CompletedAt: workflow.Now(ctx),
		}, nil
	}

	if !shipped {
		logger.Info("Seller did not ship in time, auto-refunding")
		err = workflow.ExecuteActivity(ctx, a.RefundEscrowActivity, activities.RefundRequest{
			EscrowID: escrowID,
			Reason:   "shipping_timeout",
		}).Get(ctx, nil)
		if err != nil {
			logger.Error("Auto-refund failed", "error", err)
		}
		return &EscrowHappyPathOutput{
			EscrowID:    escrowID,
			Status:      "expired_refunded",
			CompletedAt: workflow.Now(ctx),
		}, nil
	}

	// Step 8: Mark as shipped
	logger.Info("Step 8: Marking as shipped")
	err = workflow.ExecuteActivity(ctx, a.ShipEscrowActivity, activities.ShipEscrowRequest{
		EscrowID:       escrowID,
		TrackingNumber: shippingSignal.TrackingNumber,
		Carrier:        shippingSignal.Carrier,
	}).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to mark as shipped", "error", err)
		return nil, fmt.Errorf("failed to mark as shipped: %w", err)
	}

	// Step 9: Wait for delivery confirmation (with timeout)
	logger.Info("Step 9: Waiting for delivery confirmation")
	deliveredCh := workflow.GetSignalChannel(ctx, "delivery_confirmed")

	var deliverySignal struct {
		Rating   int    `json:"rating"`
		Feedback string `json:"feedback"`
	}

	// Wait up to 14 days for delivery confirmation
	deliverCtx, cancelDeliver := workflow.WithCancel(ctx)
	deliverTimer := workflow.NewTimer(deliverCtx, 14*24*time.Hour)

	selector = workflow.NewSelector(ctx)
	var delivered bool

	selector.AddReceive(deliveredCh, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &deliverySignal)
		delivered = true
		cancelDeliver()
	})

	selector.AddReceive(disputeCh, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &disputeSignal)
		disputeOpened = true
		cancelDeliver()
	})

	selector.AddFuture(deliverTimer, func(f workflow.Future) {
		// Auto-release after timeout (buyer didn't dispute)
		delivered = true
	})

	selector.Select(ctx)

	if disputeOpened {
		logger.Info("Dispute opened during delivery, transitioning to dispute workflow")
		var disputeID string
		err = workflow.ExecuteActivity(ctx, a.OpenDisputeActivity, activities.DisputeRequest{
			EscrowID: escrowID,
			Reason:   disputeSignal.Reason,
		}).Get(ctx, &disputeID)
		if err != nil {
			logger.Error("Failed to open dispute", "error", err)
		}
		return &EscrowHappyPathOutput{
			EscrowID:    escrowID,
			Status:      "disputed",
			CompletedAt: workflow.Now(ctx),
		}, nil
	}

	// Step 10: Confirm delivery and release funds
	logger.Info("Step 10: Confirming delivery and releasing funds")
	err = workflow.ExecuteActivity(ctx, a.ConfirmDeliveryActivity, activities.ConfirmDeliveryRequest{
		EscrowID: escrowID,
		Rating:   deliverySignal.Rating,
		Feedback: deliverySignal.Feedback,
	}).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to confirm delivery", "error", err)
		return nil, fmt.Errorf("failed to confirm delivery: %w", err)
	}

	// Step 11: Initiate payout to seller
	logger.Info("Step 11: Initiating payout to seller")
	payoutAmount := input.Amount * 0.97 // 3% platform fee
	err = workflow.ExecuteActivity(ctx, a.InitiatePayoutActivity, escrowID, sellerSignal.SellerID, payoutAmount).Get(ctx, nil)
	if err != nil {
		logger.Error("Failed to initiate payout", "error", err)
		return nil, fmt.Errorf("failed to initiate payout: %w", err)
	}

	// Step 12: Publish completion event
	logger.Info("Step 12: Publishing completion event")
	err = workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "escrow.completed",
		AggregateID: escrowID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"buyer_id":      input.BuyerID,
			"seller_id":     sellerSignal.SellerID,
			"amount":        input.Amount,
			"payout_amount": payoutAmount,
			"rating":        deliverySignal.Rating,
		},
	}).Get(ctx, nil)
	if err != nil {
		logger.Warn("Failed to publish completion event", "error", err)
	}

	logger.Info("EscrowHappyPathWorkflow completed successfully", "escrow_id", escrowID)

	return &EscrowHappyPathOutput{
		EscrowID:     escrowID,
		Status:       "completed",
		CompletedAt:  workflow.Now(ctx),
		PayoutAmount: payoutAmount,
	}, nil
}
