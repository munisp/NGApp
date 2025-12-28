package activities

import (
	"context"

	"github.com/escrowprotect/orchestrator/internal/config"
	"github.com/escrowprotect/orchestrator/internal/middleware"
	"go.temporal.io/sdk/activity"
)

// Activities holds all activity implementations
type Activities struct {
	cfg        *config.Config
	escrowAPI  *EscrowAPIClient
	middleware *middleware.Manager
}

// NewActivities creates a new Activities instance
func NewActivities(cfg *config.Config, mw *middleware.Manager) *Activities {
	return &Activities{
		cfg:        cfg,
		escrowAPI:  NewEscrowAPIClient(cfg, mw),
		middleware: mw,
	}
}

// CreateEscrowActivity creates a new escrow
func (a *Activities) CreateEscrowActivity(ctx context.Context, req CreateEscrowRequest) (*CreateEscrowResponse, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Creating escrow", "buyer_id", req.BuyerID, "amount", req.Amount)

	result, err := a.escrowAPI.CreateEscrow(ctx, req)
	if err != nil {
		logger.Error("Failed to create escrow", "error", err)
		return nil, err
	}

	logger.Info("Escrow created", "escrow_id", result.EscrowID)
	return result, nil
}

// GetEscrowActivity retrieves escrow details
func (a *Activities) GetEscrowActivity(ctx context.Context, escrowID string) (*EscrowDetails, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Getting escrow", "escrow_id", escrowID)

	return a.escrowAPI.GetEscrow(ctx, escrowID)
}

// AcceptEscrowActivity accepts an escrow
func (a *Activities) AcceptEscrowActivity(ctx context.Context, req AcceptEscrowRequest) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Accepting escrow", "escrow_id", req.EscrowID, "seller_id", req.SellerID)

	return a.escrowAPI.AcceptEscrow(ctx, req)
}

// ShipEscrowActivity marks escrow as shipped
func (a *Activities) ShipEscrowActivity(ctx context.Context, req ShipEscrowRequest) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Shipping escrow", "escrow_id", req.EscrowID)

	return a.escrowAPI.ShipEscrow(ctx, req)
}

// ConfirmDeliveryActivity confirms delivery
func (a *Activities) ConfirmDeliveryActivity(ctx context.Context, req ConfirmDeliveryRequest) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Confirming delivery", "escrow_id", req.EscrowID)

	return a.escrowAPI.ConfirmDelivery(ctx, req)
}

// OpenDisputeActivity opens a dispute
func (a *Activities) OpenDisputeActivity(ctx context.Context, req DisputeRequest) (string, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Opening dispute", "escrow_id", req.EscrowID, "reason", req.Reason)

	return a.escrowAPI.OpenDispute(ctx, req)
}

// RefundEscrowActivity initiates a refund
func (a *Activities) RefundEscrowActivity(ctx context.Context, req RefundRequest) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Refunding escrow", "escrow_id", req.EscrowID)

	return a.escrowAPI.RefundEscrow(ctx, req)
}

// CheckFraudActivity performs fraud assessment
func (a *Activities) CheckFraudActivity(ctx context.Context, req FraudCheckRequest) (*FraudCheckResponse, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Checking fraud", "transaction_id", req.TransactionID)

	return a.escrowAPI.CheckFraud(ctx, req)
}

// CheckKYCActivity checks KYC requirements
func (a *Activities) CheckKYCActivity(ctx context.Context, req KYCCheckRequest) (*KYCCheckResponse, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Checking KYC", "user_id", req.UserID, "amount", req.Amount)

	return a.escrowAPI.CheckKYC(ctx, req)
}

// VerifyBankActivity verifies bank account
func (a *Activities) VerifyBankActivity(ctx context.Context, bankCode, accountNumber string) (map[string]interface{}, error) {
	logger := activity.GetLogger(ctx)
	logger.Info("Verifying bank", "bank_code", bankCode)

	return a.escrowAPI.VerifyBank(ctx, bankCode, accountNumber)
}

// InitiatePayoutActivity initiates seller payout
func (a *Activities) InitiatePayoutActivity(ctx context.Context, escrowID, sellerID string, amount float64) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Initiating payout", "escrow_id", escrowID, "seller_id", sellerID, "amount", amount)

	return a.escrowAPI.InitiatePayout(ctx, escrowID, sellerID, amount)
}

// SendNotificationActivity sends a notification
func (a *Activities) SendNotificationActivity(ctx context.Context, userID, channel, message string) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Sending notification", "user_id", userID, "channel", channel)

	// Publish via Dapr if connected
	if a.middleware.Dapr().IsConnected() {
		return a.middleware.Dapr().PublishEvent(ctx, "notifications", "notification.send", map[string]string{
			"user_id": userID,
			"channel": channel,
			"message": message,
		})
	}

	return nil
}

// CacheWorkflowIDActivity caches workflow ID for an escrow
func (a *Activities) CacheWorkflowIDActivity(ctx context.Context, escrowID, workflowID string) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Caching workflow ID", "escrow_id", escrowID, "workflow_id", workflowID)

	return a.middleware.Redis().CacheWorkflowID(ctx, escrowID, workflowID)
}

// PublishEventActivity publishes an event to Kafka
func (a *Activities) PublishEventActivity(ctx context.Context, event middleware.EscrowEvent) error {
	logger := activity.GetLogger(ctx)
	logger.Info("Publishing event", "event_type", event.EventType, "aggregate_id", event.AggregateID)

	return a.middleware.Kafka().PublishEvent(ctx, event)
}
