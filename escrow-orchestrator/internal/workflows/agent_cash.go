package workflows

import (
	"fmt"
	"time"

	"github.com/escrowprotect/orchestrator/internal/activities"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// AgentCashWorkflowInput represents input for the agent cash workflow
type AgentCashWorkflowInput struct {
	EscrowID      string  `json:"escrow_id"`
	BuyerID       string  `json:"buyer_id"`
	SellerID      string  `json:"seller_id"`
	Amount        float64 `json:"amount"`
	Currency      string  `json:"currency"`
	TransactionType string `json:"transaction_type"` // "cash_in" or "cash_out"
	Location      struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"location"`
}

// AgentCashWorkflowOutput represents output from the agent cash workflow
type AgentCashWorkflowOutput struct {
	EscrowID      string    `json:"escrow_id"`
	AgentID       string    `json:"agent_id"`
	TransactionID string    `json:"transaction_id"`
	Status        string    `json:"status"`
	CompletedAt   time.Time `json:"completed_at"`
}

// AgentCashWorkflow orchestrates cash agent transactions for unbanked users
// User Story 15: Cash agent accepts cash-in/cash-out for unbanked buyer/seller
func AgentCashWorkflow(ctx workflow.Context, input AgentCashWorkflowInput) (*AgentCashWorkflowOutput, error) {
	logger := workflow.GetLogger(ctx)
	logger.Info("Starting AgentCashWorkflow", "escrow_id", input.EscrowID, "type", input.TransactionType, "amount", input.Amount)

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
	transactionID := fmt.Sprintf("txn_%d", workflow.Now(ctx).UnixNano())

	// Step 1: Find nearby agents
	logger.Info("Step 1: Finding nearby agents")
	// In production, this would call the agent_network.py endpoint
	// GET /api/v1/agents/nearby?lat={lat}&lng={lng}
	
	// Simulate agent assignment
	agentID := fmt.Sprintf("agent_%d", workflow.Now(ctx).UnixNano()%1000)

	// Step 2: Publish agent assignment event
	logger.Info("Step 2: Publishing agent assignment event")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "agent.assigned",
		AggregateID: input.EscrowID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"agent_id":         agentID,
			"transaction_type": input.TransactionType,
			"amount":           input.Amount,
			"location":         input.Location,
		},
	}).Get(ctx, nil)

	// Step 3: Notify agent
	logger.Info("Step 3: Notifying agent")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, agentID, "push",
		fmt.Sprintf("New %s request for %.2f %s", input.TransactionType, input.Amount, input.Currency)).Get(ctx, nil)

	// Step 4: Notify user
	userID := input.BuyerID
	if input.TransactionType == "cash_out" {
		userID = input.SellerID
	}
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, userID, "push",
		fmt.Sprintf("Agent assigned for your %s. Please proceed to the agent location.", input.TransactionType)).Get(ctx, nil)

	// Step 5: Wait for agent confirmation (up to 4 hours)
	logger.Info("Step 5: Waiting for agent confirmation")
	agentConfirmCh := workflow.GetSignalChannel(ctx, "agent_confirmed")
	agentCtx, cancelAgent := workflow.WithCancel(ctx)
	agentTimer := workflow.NewTimer(agentCtx, 4*time.Hour)

	selector := workflow.NewSelector(ctx)
	var agentConfirmed bool

	selector.AddReceive(agentConfirmCh, func(c workflow.ReceiveChannel, more bool) {
		var signal struct {
			Confirmed bool   `json:"confirmed"`
			AgentID   string `json:"agent_id"`
		}
		c.Receive(ctx, &signal)
		agentConfirmed = signal.Confirmed
		cancelAgent()
	})

	selector.AddFuture(agentTimer, func(f workflow.Future) {
		agentConfirmed = false
	})

	selector.Select(ctx)

	if !agentConfirmed {
		logger.Warn("Agent did not confirm in time")
		return &AgentCashWorkflowOutput{
			EscrowID:      input.EscrowID,
			AgentID:       agentID,
			TransactionID: transactionID,
			Status:        "agent_timeout",
			CompletedAt:   workflow.Now(ctx),
		}, nil
	}

	// Step 6: Wait for transaction completion
	logger.Info("Step 6: Waiting for transaction completion")
	txnCompleteCh := workflow.GetSignalChannel(ctx, "transaction_completed")
	txnCtx, cancelTxn := workflow.WithCancel(ctx)
	txnTimer := workflow.NewTimer(txnCtx, 1*time.Hour)

	selector = workflow.NewSelector(ctx)
	var txnCompleted bool

	selector.AddReceive(txnCompleteCh, func(c workflow.ReceiveChannel, more bool) {
		var signal struct {
			Completed bool   `json:"completed"`
			Receipt   string `json:"receipt"`
		}
		c.Receive(ctx, &signal)
		txnCompleted = signal.Completed
		cancelTxn()
	})

	selector.AddFuture(txnTimer, func(f workflow.Future) {
		txnCompleted = false
	})

	selector.Select(ctx)

	if !txnCompleted {
		logger.Warn("Transaction not completed in time")
		return &AgentCashWorkflowOutput{
			EscrowID:      input.EscrowID,
			AgentID:       agentID,
			TransactionID: transactionID,
			Status:        "transaction_timeout",
			CompletedAt:   workflow.Now(ctx),
		}, nil
	}

	// Step 7: Update escrow based on transaction type
	logger.Info("Step 7: Updating escrow")
	if input.TransactionType == "cash_in" {
		// Cash-in: buyer deposited cash, fund the escrow
		workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
			EventType:   "escrow.funded",
			AggregateID: input.EscrowID,
			Timestamp:   workflow.Now(ctx),
			Version:     1,
			Data: map[string]interface{}{
				"amount":         input.Amount,
				"funding_method": "agent_cash_in",
				"agent_id":       agentID,
			},
		}).Get(ctx, nil)
	} else {
		// Cash-out: seller received cash payout
		workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
			EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
			EventType:   "payout.completed",
			AggregateID: input.EscrowID,
			Timestamp:   workflow.Now(ctx),
			Version:     1,
			Data: map[string]interface{}{
				"amount":        input.Amount,
				"payout_method": "agent_cash_out",
				"agent_id":      agentID,
			},
		}).Get(ctx, nil)
	}

	// Step 8: Publish completion event
	logger.Info("Step 8: Publishing completion event")
	workflow.ExecuteActivity(ctx, a.PublishEventActivity, middleware.EscrowEvent{
		EventID:     fmt.Sprintf("evt_%d", workflow.Now(ctx).UnixNano()),
		EventType:   "agent.transaction_completed",
		AggregateID: transactionID,
		Timestamp:   workflow.Now(ctx),
		Version:     1,
		Data: map[string]interface{}{
			"escrow_id":        input.EscrowID,
			"agent_id":         agentID,
			"transaction_type": input.TransactionType,
			"amount":           input.Amount,
		},
	}).Get(ctx, nil)

	// Step 9: Notify parties
	logger.Info("Step 9: Notifying parties")
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, userID, "push",
		fmt.Sprintf("Your %s of %.2f %s has been completed", input.TransactionType, input.Amount, input.Currency)).Get(ctx, nil)
	workflow.ExecuteActivity(ctx, a.SendNotificationActivity, agentID, "push",
		fmt.Sprintf("Transaction %s completed successfully", transactionID)).Get(ctx, nil)

	logger.Info("AgentCashWorkflow completed", "transaction_id", transactionID)

	return &AgentCashWorkflowOutput{
		EscrowID:      input.EscrowID,
		AgentID:       agentID,
		TransactionID: transactionID,
		Status:        "completed",
		CompletedAt:   workflow.Now(ctx),
	}, nil
}
