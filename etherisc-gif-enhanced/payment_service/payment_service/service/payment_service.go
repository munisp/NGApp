package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.temporal.io/sdk/client"
	"go.uber.org/zap"
	"payment_service/domain"
	"payment_service/workflow"
	"payment_service/observability"
)

// PaymentService defines the business logic interface.
type PaymentService interface {
	InitiatePayment(ctx context.Context, policyID string, amountFiat float64, currencyFiat string, targetAddress string) (*domain.Payment, error)
	GetPaymentStatus(ctx context.Context, paymentID string) (*domain.Payment, error)
	HandleFiatWebhook(ctx context.Context, reference string, status string) error
}

// paymentService implements the PaymentService interface.
type paymentService struct {
	repo              domain.PaymentRepository
	temporalClient    client.Client
	logger            *zap.Logger
	metrics           *observability.Metrics
	cryptoCurrency    string
	serviceWalletID   string
}

// NewPaymentService creates a new instance of PaymentService.
func NewPaymentService(repo domain.PaymentRepository, tc *TemporalClient, logger *zap.Logger, metrics *observability.Metrics, cryptoCurrency, serviceWalletID string) PaymentService {
	if cryptoCurrency == "" {
		cryptoCurrency = "USDC"
	}
	return &paymentService{
		repo:            repo,
		temporalClient:  tc.Client,
		logger:          logger,
		metrics:         metrics,
		cryptoCurrency:  cryptoCurrency,
		serviceWalletID: serviceWalletID,
	}
}

// InitiatePayment creates a new payment record and starts the Temporal workflow.
func (s *paymentService) InitiatePayment(ctx context.Context, policyID string, amountFiat float64, currencyFiat string, targetAddress string) (*domain.Payment, error) {
	// 1. Create initial Payment record
	s.metrics.PaymentInitiatedCounter.Inc()
	payment := &domain.Payment{
		ID:             uuid.New().String(),
		PolicyID:       policyID,
		AmountFiat:     amountFiat,
		CurrencyFiat:   currencyFiat,
		CurrencyCrypto: s.cryptoCurrency,
		Status:         domain.PaymentStatusPendingFiat,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.repo.SavePayment(ctx, payment); err != nil {
		s.logger.Error("Failed to save initial payment", zap.Error(err))
		return nil, err
	}

	// 2. Start Temporal Workflow
	workflowID := "payment-workflow-" + payment.ID
	workflowOptions := client.StartWorkflowOptions{
		ID:        workflowID,
		TaskQueue: "payment-task-queue",
	}

	workflowInput := workflow.PremiumPaymentWorkflowInput{
		PaymentID:      payment.ID,
		PolicyID:       policyID,
		AmountFiat:     amountFiat,
		CurrencyFiat:   currencyFiat,
		CurrencyCrypto: s.cryptoCurrency,
		TargetAddress:  targetAddress,
	}

	we, err := s.temporalClient.ExecuteWorkflow(ctx, workflowOptions, workflow.PremiumPaymentWorkflow, workflowInput)
	if err != nil {
		s.logger.Error("Failed to start payment workflow", zap.Error(err))
		return nil, err
	}

	s.logger.Info("Payment workflow started", zap.String("workflow_id", we.GetID()), zap.String("run_id", we.GetRunID()))

	// Update payment with workflow run ID
	payment.WorkflowRunID = we.GetRunID()
	if err := s.repo.SavePayment(ctx, payment); err != nil {
		s.logger.Error("Failed to update payment with workflow run ID", zap.Error(err))
		// Non-critical error, workflow is already running
	}

	return payment, nil
}

// GetPaymentStatus retrieves the current status of a payment.
func (s *paymentService) GetPaymentStatus(ctx context.Context, paymentID string) (*domain.Payment, error) {
	return s.repo.GetPaymentByID(ctx, paymentID)
}

// HandleFiatWebhook processes the webhook from the fiat gateway and signals the Temporal workflow.
func (s *paymentService) HandleFiatWebhook(ctx context.Context, reference string, status string) error {
	// 1. Find the payment associated with the reference (in a real scenario, this would require a Transaction lookup)
	// For this mock, we'll assume the reference is the PaymentID for simplicity in finding the workflow.
	// In a real system, the webhook payload would contain a reference that maps back to the PaymentID.
	var targetPayment *domain.Payment
	for _, p := range s.repo.payments {
		// This is a highly simplified mock lookup.
		// A real implementation would need a proper transaction/reference mapping.
		if p.ID == reference {
			targetPayment = p
			break
		}
	}

	if targetPayment == nil {
		s.logger.Warn("Payment not found for webhook reference", zap.String("reference", reference))
		return errors.New("payment not found")
	}

	// 2. Signal the Temporal Workflow
	workflowID := "payment-workflow-" + targetPayment.ID
	runID := targetPayment.WorkflowRunID // Use the stored run ID

	signalInput := struct {
		Status    string
		Reference string
	}{
		Status:    status,
		Reference: reference,
	}

	err := s.temporalClient.SignalWorkflow(ctx, workflowID, runID, "fiat_payment_confirmed", signalInput)
	if err != nil {
		s.logger.Error("Failed to signal workflow", zap.String("workflow_id", workflowID), zap.Error(err))
		return err
	}

	s.logger.Info("Successfully signaled workflow for fiat payment confirmation", zap.String("workflow_id", workflowID), zap.String("status", status))
	return nil
}
