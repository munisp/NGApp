package workflows

import (
	"fmt"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// DisputeWorkflowInput represents input for the dispute workflow
type DisputeWorkflowInput struct {
	EscrowID    string `json:"escrow_id"`
	InitiatorID string `json:"initiator_id"`
	Reason      string `json:"reason"`
	Evidence    string `json:"evidence,omitempty"`
}

// DisputeWorkflowOutput represents output from the dispute workflow
type DisputeWorkflowOutput struct {
	DisputeID    string    `json:"dispute_id"`
	EscrowID     string    `json:"escrow_id"`
	Resolution   string    `json:"resolution"`
	BuyerRefund  float64   `json:"buyer_refund,omitempty"`
	SellerPayout float64   `json:"seller_payout,omitempty"`
	ResolvedAt   time.Time `json:"resolved_at"`
}

// DisputeWorkflow orchestrates dispute resolution
// User Story 13: Dispute opened -> Evidence submitted -> Resolution applied
// User Story 14: Dispute escalated to arbiter -> Partial refund
func DisputeWorkflow(ctx workflow.Context, input DisputeWorkflowInput) (*DisputeWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting DisputeWorkflow", "escrow_id", input.EscrowID, "reason", input.Reason)

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

	// Step 1: Get escrow details
	logger.Info("Step 1: Getting escrow details")
	var escrow *activities.EscrowDetails
	err := workflow.ExecuteActivity(ctx, a.GetEscrowActivity, input.EscrowID).Get(ctx, &escrow)
	if err != nil {
		logger.Error("Failed to get escrow", "error", err)
		return nil, fmt.Errorf("failed to get escrow: %w", err)
	}

	// Step 2: Open dispute
	logger.Info("Step 2: Opening dispute")
	var disputeID string
	err = workflow.ExecuteActivity(ctx, a.OpenDisputeActivity, activities.DisputeRequest{
		EscrowID: input.EscrowID,
		Reason:   input.Reason,
		Evidence: input.Evidence,
	}).Get(ctx, &disputeID)
	if err != nil {
		logger.Error("Failed to open dispute", "error", err)
		return nil, fmt.Errorf("failed to open dispute: %w", err)
	}

	// Step 3: Notify both parties
	logger.Info("Step 3: Notifying parties")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.BuyerID, "push", "A dispute has been opened on your escrow").Get(ctx, nil)
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.SellerID, "push", "A dispute has been opened on your escrow").Get(ctx, nil)

	// Step 4: Wait for evidence from both parties (48 hours)
	logger.Info("Step 4: Waiting for evidence submission")
	evidenceCh := workflow.GetSignalChannel(ctx, "evidence_submitted")
	resolutionCh := workflow.GetSignalChannel(ctx, "resolution_proposed")
	escalateCh := workflow.GetSignalChannel(ctx, "escalate_to_arbiter")

	evidenceCtx, cancelEvidence := workflow.WithCancel(ctx)
	evidenceTimer := workflow.NewTimer(evidenceCtx, 48*time.Hour)

	var buyerEvidence, sellerEvidence string
	var evidenceCount int

	for evidenceCount < 2 {
		selector := workflow.NewSelector(ctx)
		
		selector.AddReceive(evidenceCh, func(c workflow.ReceiveChannel, more bool) {
			var evidence struct {
				UserID   string `json:"user_id"`
				Evidence string `json:"evidence"`
			}
			c.Receive(ctx, &evidence)
			if evidence.UserID == escrow.BuyerID {
				buyerEvidence = evidence.Evidence
			} else {
				sellerEvidence = evidence.Evidence
			}
			evidenceCount++
		})

		selector.AddFuture(evidenceTimer, func(f workflow.Future) {
			evidenceCount = 2 // Exit loop
		})

		selector.Select(ctx)
	}
	cancelEvidence()

	// Step 5: Auto-resolution attempt based on evidence
	logger.Info("Step 5: Attempting auto-resolution")
	var resolution string
	var buyerRefund, sellerPayout float64

	// Simple auto-resolution logic (in production, this would be more sophisticated)
	if buyerEvidence != "" && sellerEvidence == "" {
		// Only buyer provided evidence - favor buyer
		resolution = "buyer_favored"
		buyerRefund = escrow.Amount
		sellerPayout = 0
	} else if sellerEvidence != "" && buyerEvidence == "" {
		// Only seller provided evidence - favor seller
		resolution = "seller_favored"
		buyerRefund = 0
		sellerPayout = escrow.Amount * 0.97
	} else {
		// Both or neither provided evidence - escalate to arbiter
		resolution = "escalated"
	}

	// Step 6: If escalated, wait for arbiter decision
	if resolution == "escalated" {
		logger.Info("Step 6: Escalating to arbiter")
		
		// Publish escalation event
		workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
			EventType:   "dispute.escalated",
			AggregateID: input.EscrowID,
			Timestamp:   workflow.Now(ctx),
			Version:     1,
			Data:        map[string]interface{}{"dispute_id": disputeID},
		}).Get(ctx, nil)

		// Wait for arbiter decision (up to 7 days)
		arbiterCtx, cancelArbiter := workflow.WithCancel(ctx)
		arbiterTimer := workflow.NewTimer(arbiterCtx, 7*24*time.Hour)

		selector := workflow.NewSelector(ctx)
		var arbiterDecision struct {
			Resolution   string  `json:"resolution"`
			BuyerRefund  float64 `json:"buyer_refund"`
			SellerPayout float64 `json:"seller_payout"`
		}

		selector.AddReceive(resolutionCh, func(c workflow.ReceiveChannel, more bool) {
			c.Receive(ctx, &arbiterDecision)
			cancelArbiter()
		})

		selector.AddFuture(arbiterTimer, func(f workflow.Future) {
			// Default to 50/50 split if no arbiter decision
			arbiterDecision.Resolution = "split"
			arbiterDecision.BuyerRefund = escrow.Amount * 0.5
			arbiterDecision.SellerPayout = escrow.Amount * 0.47 // 3% fee
		})

		selector.Select(ctx)

		resolution = arbiterDecision.Resolution
		buyerRefund = arbiterDecision.BuyerRefund
		sellerPayout = arbiterDecision.SellerPayout
	}

	// Step 7: Execute resolution
	logger.Info("Step 7: Executing resolution", "resolution", resolution)

	if buyerRefund > 0 {
		err = workflow.ExecuteActivity(ctx, a.RefundEscrowActivity, activities.RefundRequest{
			EscrowID: input.EscrowID,
			Amount:   buyerRefund,
			Reason:   fmt.Sprintf("dispute_resolution_%s", resolution),
		}).Get(ctx, nil)
		if err != nil {
			logger.Error("Failed to refund buyer", "error", err)
		}
	}

	if sellerPayout > 0 {
		err = workflow.ExecuteActivity(ctx, a.InitiatePayoutActivity, input.EscrowID, escrow.SellerID, sellerPayout).Get(ctx, nil)
		if err != nil {
			logger.Error("Failed to payout seller", "error", err)
		}
	}

	// Step 8: Publish resolution event
	logger.Info("Step 8: Publishing resolution event")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "dispute.resolved",
		AggregateID: input.EscrowID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"dispute_id":    disputeID,
			"resolution":    resolution,
			"buyer_refund":  buyerRefund,
			"seller_payout": sellerPayout,
		},
	}).Get(ctx, nil)

	// Step 9: Notify parties of resolution
	logger.Info("Step 9: Notifying parties of resolution")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.BuyerID, "push", fmt.Sprintf("Dispute resolved: %s", resolution)).Get(ctx, nil)
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, escrow.SellerID, "push", fmt.Sprintf("Dispute resolved: %s", resolution)).Get(ctx, nil)

	logger.Info("DisputeWorkflow completed", "dispute_id", disputeID, "resolution", resolution)

	return &DisputeWorkflowOutput{
		DisputeID:    disputeID,
		EscrowID:     input.EscrowID,
		Resolution:   resolution,
		BuyerRefund:  buyerRefund,
		SellerPayout: sellerPayout,
		ResolvedAt:   workflow.Now(ctx),
	}, nil
}
