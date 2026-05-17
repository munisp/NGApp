package temporal

import (
	"context"
	"time"

	"github.com/etherisc/facultative-reinsurance-service/internal/model"
	"github.com/etherisc/facultative-reinsurance-service/internal/service"
	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	// TaskQueue is the name of the Temporal Task Queue for this service
	TaskQueue = "FACULTATIVE_REINSURANCE_TASK_QUEUE"
	// QuoteAcceptanceTimeout is the time to wait for a quote to be accepted
	QuoteAcceptanceTimeout = 72 * time.Hour
)

// Activities defines the set of activities that the workflow will execute.
type Activities struct {
	svc service.Service
}

// NewActivities creates a new instance of Activities.
func NewActivities(svc service.Service) *Activities {
	return &Activities{
		svc: svc,
	}
}

// FacultativeReinsuranceWorkflow is the main workflow for facultative reinsurance.
// It handles the entire lifecycle from policy submission to contract finalization.
func FacultativeReinsuranceWorkflow(ctx workflow.Context, policyID string) (*model.CededReinsurance, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("FacultativeReinsuranceWorkflow started", "policyID", policyID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 10 * time.Second,
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var a *Activities

	// 1. Select Reinsurer
	var selectionResult *model.ReinsurerSelectionResult
	err := workflow.ExecuteActivity(ctx, a.SelectReinsurerActivity, policyID).Get(ctx, &selectionResult)
	if err != nil {
		logger.Error("SelectReinsurerActivity failed", "error", err)
		return nil, err
	}
	logger.Info("Reinsurer selected", "reinsurerID", selectionResult.ReinsurerID, "cededShare", selectionResult.CededShare)

	// 2. Request Quote
	var quote *model.ReinsuranceQuote
	err = workflow.ExecuteActivity(ctx, a.RequestQuoteActivity, policyID, selectionResult.ReinsurerID, selectionResult.CededShare).Get(ctx, &quote)
	if err != nil {
		logger.Error("RequestQuoteActivity failed", "error", err)
		return nil, err
	}
	logger.Info("Quote requested", "quoteID", quote.QuoteID)

	// 3. Wait for Quote Acceptance (Signal)
	quoteAcceptedSignal := workflow.GetSignalChannel(ctx, "quoteAcceptedSignal")
	quoteRejectedSignal := workflow.GetSignalChannel(ctx, "quoteRejectedSignal")

	selector := workflow.NewSelector(ctx)
	var acceptedQuote *model.ReinsuranceQuote
	var rejectedQuote *model.ReinsuranceQuote

	selector.AddReceive(quoteAcceptedSignal, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &acceptedQuote)
	})
	selector.AddReceive(quoteRejectedSignal, func(c workflow.ReceiveChannel, more bool) {
		c.Receive(ctx, &rejectedQuote)
	})

	// Wait for signal or timeout
	timeoutCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: QuoteAcceptanceTimeout,
	})

	selector.Select(timeoutCtx)

	if acceptedQuote != nil {
		logger.Info("Quote accepted via signal", "quoteID", acceptedQuote.QuoteID)
		// 4. Finalize Contract
		var cededRe *model.CededReinsurance
		err = workflow.ExecuteActivity(ctx, a.FinalizeContractActivity, acceptedQuote).Get(ctx, &cededRe)
		if err != nil {
			logger.Error("FinalizeContractActivity failed", "error", err)
			return nil, err
		}
		logger.Info("Contract finalized", "contractID", cededRe.ContractID)
		return cededRe, nil
	} else if rejectedQuote != nil {
		logger.Info("Quote rejected via signal", "quoteID", rejectedQuote.QuoteID)
		return nil, temporal.NewApplicationError("Quote was explicitly rejected by the user/system", "quote_rejected", nil)
	} else {
		logger.Info("Quote acceptance timed out", "quoteID", quote.QuoteID)
		// Reject the quote in the system
		_ = workflow.ExecuteActivity(ctx, a.RejectQuoteActivity, quote.QuoteID).Get(ctx, nil)
		return nil, temporal.NewApplicationError("Quote acceptance timed out", "quote_timeout", nil)
	}
}

// SelectReinsurerActivity selects the best reinsurer based on policy data.
func (a *Activities) SelectReinsurerActivity(ctx context.Context, policyID string) (*model.ReinsurerSelectionResult, error) {
	activity.GetLogger(ctx).Info("SelectReinsurerActivity started", "policyID", policyID)
	return a.svc.SelectReinsurer(ctx, policyID)
}

// RequestQuoteActivity sends a quote request to the selected reinsurer.
func (a *Activities) RequestQuoteActivity(ctx context.Context, policyID string, reinsurerID string, cededShare float64) (*model.ReinsuranceQuote, error) {
	activity.GetLogger(ctx).Info("RequestQuoteActivity started", "policyID", policyID, "reinsurerID", reinsurerID)
	return a.svc.RequestQuote(ctx, policyID, reinsurerID, cededShare)
}

// FinalizeContractActivity creates the final CededReinsurance contract and integrates with GIF.
func (a *Activities) FinalizeContractActivity(ctx context.Context, quote *model.ReinsuranceQuote) (*model.CededReinsurance, error) {
	activity.GetLogger(ctx).Info("FinalizeContractActivity started", "quoteID", quote.QuoteID)
	return a.svc.FinalizeContract(ctx, quote)
}

// RejectQuoteActivity explicitly rejects a quote in the system.
func (a *Activities) RejectQuoteActivity(ctx context.Context, quoteID string) error {
	activity.GetLogger(ctx).Info("RejectQuoteActivity started", "quoteID", quoteID)
	return a.svc.RejectQuote(ctx, quoteID)
}

// CedeClaimWorkflow handles the cession of a claim to the reinsurer.
func CedeClaimWorkflow(ctx workflow.Context, claimID string, contractID string, claimAmount float64) (*model.ClaimCession, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("CedeClaimWorkflow started", "claimID", claimID, "contractID", contractID)

	ao := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second, // Give more time for GIF integration
	}
	ctx = workflow.WithActivityOptions(ctx, ao)

	var a *Activities
	var cession *model.ClaimCession

	err := workflow.ExecuteActivity(ctx, a.CedeClaimActivity, claimID, contractID, claimAmount).Get(ctx, &cession)
	if err != nil {
		logger.Error("CedeClaimActivity failed", "error", err)
		return nil, err
	}

	logger.Info("Claim cession processed", "cessionID", cession.CessionID, "status", cession.Status)
	return cession, nil
}

// CedeClaimActivity processes the claim cession and updates the GIF contract.
func (a *Activities) CedeClaimActivity(ctx context.Context, claimID string, contractID string, claimAmount float64) (*model.ClaimCession, error) {
	activity.GetLogger(ctx).Info("CedeClaimActivity started", "claimID", claimID, "contractID", contractID)
	return a.svc.ProcessClaimCession(ctx, claimID, contractID, claimAmount)
}
