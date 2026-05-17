package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"insurance-platform/payment-service/internal/ledger"
	"insurance-platform/payment-service/internal/models"
	"insurance-platform/payment-service/internal/repository"

	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
	"github.com/tigerbeetle/tigerbeetle-go/pkg/types"
)

// PaymentService handles payment business logic
type PaymentService struct {
	repo           *repository.PaymentRepository
	ledgerClient   *ledger.TigerBeetleClient
	kafkaWriter    *kafka.Writer
}

// NewPaymentService creates a new payment service
func NewPaymentService(
	repo *repository.PaymentRepository,
	ledgerClient *ledger.TigerBeetleClient,
	kafkaWriter *kafka.Writer,
) *PaymentService {
	return &PaymentService{
		repo:         repo,
		ledgerClient: ledgerClient,
		kafkaWriter:  kafkaWriter,
	}
}

// CreatePayment creates a new payment
func (s *PaymentService) CreatePayment(ctx context.Context, req *models.CreatePaymentRequest) (*models.Payment, error) {
	// Generate unique IDs
	paymentID := uuid.New()
	transactionID := fmt.Sprintf("TXN-%d-%s", time.Now().Unix(), paymentID.String()[:8])

	// Convert metadata to JSON
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Create payment record
	payment := &models.Payment{
		ID:              paymentID,
		TransactionID:   transactionID,
		PolicyID:        req.PolicyID,
		CustomerID:      req.CustomerID,
		Amount:          req.Amount,
		Currency:        req.Currency,
		PaymentType:     req.PaymentType,
		PaymentMethod:   req.PaymentMethod,
		Status:          models.PaymentStatusPending,
		DebitAccountID:  req.DebitAccountID,
		CreditAccountID: req.CreditAccountID,
		Metadata:        string(metadataJSON),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save to database
	if err := s.repo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// Publish payment created event
	if err := s.publishPaymentEvent(ctx, "payment.created", payment); err != nil {
		log.Printf("Failed to publish payment created event: %v", err)
	}

	return payment, nil
}

// ProcessPayment processes a payment through the payment gateway and ledger
func (s *PaymentService) ProcessPayment(ctx context.Context, paymentID uuid.UUID, gatewayReference string) error {
	// Get payment
	payment, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("failed to get payment: %w", err)
	}

	// Update status to processing
	if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusProcessing, ""); err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}

	// Simulate payment gateway processing
	// In production, this would integrate with Paystack, Flutterwave, etc.
	gatewaySuccess := true // Replace with actual gateway call

	if !gatewaySuccess {
		if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusFailed, "Gateway declined"); err != nil {
			log.Printf("Failed to update payment status: %v", err)
		}
		if err := s.publishPaymentEvent(ctx, "payment.failed", payment); err != nil {
			log.Printf("Failed to publish payment failed event: %v", err)
		}
		return fmt.Errorf("payment gateway declined")
	}

	// Create transfer in TigerBeetle ledger
	transferID := s.generateTransferID(paymentID)
	debitAccountID := s.parseAccountID(payment.DebitAccountID)
	creditAccountID := s.parseAccountID(payment.CreditAccountID)

	err = s.ledgerClient.CreateTransfer(
		ctx,
		transferID,
		debitAccountID,
		creditAccountID,
		uint64(payment.Amount),
		1, // Ledger ID
		uint16(payment.PaymentType == models.PaymentTypePremium), // Code
	)

	if err != nil {
		// Rollback: Update payment status to failed
		if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusFailed, fmt.Sprintf("Ledger error: %v", err)); err != nil {
			log.Printf("Failed to update payment status: %v", err)
		}
		if err := s.publishPaymentEvent(ctx, "payment.failed", payment); err != nil {
			log.Printf("Failed to publish payment failed event: %v", err)
		}
		return fmt.Errorf("failed to create ledger transfer: %w", err)
	}

	// Mark payment as completed
	transferIDStr := fmt.Sprintf("%d-%d", transferID.High, transferID.Low)
	if err := s.repo.Complete(ctx, paymentID, transferIDStr); err != nil {
		return fmt.Errorf("failed to complete payment: %w", err)
	}

	// Publish payment completed event
	payment.Status = models.PaymentStatusCompleted
	payment.LedgerTransferID = transferIDStr
	if err := s.publishPaymentEvent(ctx, "payment.completed", payment); err != nil {
		log.Printf("Failed to publish payment completed event: %v", err)
	}

	log.Printf("Payment processed successfully: %s", paymentID)
	return nil
}

// ProcessPendingPayment creates a pending payment (two-phase commit)
func (s *PaymentService) ProcessPendingPayment(ctx context.Context, paymentID uuid.UUID, timeout uint32) error {
	// Get payment
	payment, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("failed to get payment: %w", err)
	}

	// Update status to processing
	if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusProcessing, ""); err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}

	// Create pending transfer in TigerBeetle
	transferID := s.generateTransferID(paymentID)
	debitAccountID := s.parseAccountID(payment.DebitAccountID)
	creditAccountID := s.parseAccountID(payment.CreditAccountID)

	err = s.ledgerClient.CreatePendingTransfer(
		ctx,
		transferID,
		debitAccountID,
		creditAccountID,
		uint64(payment.Amount),
		1, // Ledger ID
		uint16(payment.PaymentType == models.PaymentTypePremium),
		timeout,
	)

	if err != nil {
		if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusFailed, fmt.Sprintf("Ledger error: %v", err)); err != nil {
			log.Printf("Failed to update payment status: %v", err)
		}
		return fmt.Errorf("failed to create pending transfer: %w", err)
	}

	// Store pending transfer ID
	transferIDStr := fmt.Sprintf("%d-%d", transferID.High, transferID.Low)
	payment.LedgerTransferID = transferIDStr
	payment.Status = models.PaymentStatusProcessing

	log.Printf("Pending payment created: %s", paymentID)
	return nil
}

// CommitPendingPayment commits a pending payment
func (s *PaymentService) CommitPendingPayment(ctx context.Context, paymentID uuid.UUID) error {
	payment, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("failed to get payment: %w", err)
	}

	if payment.LedgerTransferID == "" {
		return fmt.Errorf("no pending transfer found for payment")
	}

	pendingTransferID := s.parseTransferID(payment.LedgerTransferID)
	postTransferID := s.generateTransferID(uuid.New())

	err = s.ledgerClient.PostPendingTransfer(
		ctx,
		postTransferID,
		pendingTransferID,
		1, // Ledger ID
		uint16(payment.PaymentType == models.PaymentTypePremium),
	)

	if err != nil {
		return fmt.Errorf("failed to commit pending transfer: %w", err)
	}

	// Mark payment as completed
	if err := s.repo.Complete(ctx, paymentID, payment.LedgerTransferID); err != nil {
		return fmt.Errorf("failed to complete payment: %w", err)
	}

	// Publish payment completed event
	payment.Status = models.PaymentStatusCompleted
	if err := s.publishPaymentEvent(ctx, "payment.completed", payment); err != nil {
		log.Printf("Failed to publish payment completed event: %v", err)
	}

	log.Printf("Pending payment committed: %s", paymentID)
	return nil
}

// CancelPendingPayment cancels a pending payment
func (s *PaymentService) CancelPendingPayment(ctx context.Context, paymentID uuid.UUID) error {
	payment, err := s.repo.GetByID(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("failed to get payment: %w", err)
	}

	if payment.LedgerTransferID == "" {
		return fmt.Errorf("no pending transfer found for payment")
	}

	pendingTransferID := s.parseTransferID(payment.LedgerTransferID)
	voidTransferID := s.generateTransferID(uuid.New())

	err = s.ledgerClient.VoidPendingTransfer(
		ctx,
		voidTransferID,
		pendingTransferID,
		1, // Ledger ID
		uint16(payment.PaymentType == models.PaymentTypePremium),
	)

	if err != nil {
		return fmt.Errorf("failed to void pending transfer: %w", err)
	}

	// Update payment status to failed
	if err := s.repo.UpdateStatus(ctx, paymentID, models.PaymentStatusFailed, "Payment cancelled"); err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}

	// Publish payment failed event
	payment.Status = models.PaymentStatusFailed
	if err := s.publishPaymentEvent(ctx, "payment.cancelled", payment); err != nil {
		log.Printf("Failed to publish payment cancelled event: %v", err)
	}

	log.Printf("Pending payment cancelled: %s", paymentID)
	return nil
}

// GetPayment retrieves a payment by ID
func (s *PaymentService) GetPayment(ctx context.Context, paymentID uuid.UUID) (*models.Payment, error) {
	return s.repo.GetByID(ctx, paymentID)
}

// GetPaymentsByPolicy retrieves all payments for a policy
func (s *PaymentService) GetPaymentsByPolicy(ctx context.Context, policyID uuid.UUID) ([]*models.Payment, error) {
	return s.repo.GetByPolicyID(ctx, policyID)
}

// GetPaymentsByCustomer retrieves all payments for a customer
func (s *PaymentService) GetPaymentsByCustomer(ctx context.Context, customerID uuid.UUID) ([]*models.Payment, error) {
	return s.repo.GetByCustomerID(ctx, customerID)
}

// publishPaymentEvent publishes a payment event to Kafka
func (s *PaymentService) publishPaymentEvent(ctx context.Context, eventType string, payment *models.Payment) error {
	var metadata map[string]interface{}
	if payment.Metadata != "" {
		if err := json.Unmarshal([]byte(payment.Metadata), &metadata); err != nil {
			metadata = make(map[string]interface{})
		}
	}

	event := models.PaymentEvent{
		EventID:       uuid.New(),
		EventType:     eventType,
		PaymentID:     payment.ID,
		TransactionID: payment.TransactionID,
		PolicyID:      payment.PolicyID,
		CustomerID:    payment.CustomerID,
		Amount:        payment.Amount,
		Currency:      payment.Currency,
		PaymentType:   payment.PaymentType,
		Status:        payment.Status,
		Timestamp:     time.Now(),
		Metadata:      metadata,
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	err = s.kafkaWriter.WriteMessages(ctx, kafka.Message{
		Key:   []byte(payment.ID.String()),
		Value: eventJSON,
		Time:  time.Now(),
	})

	if err != nil {
		return fmt.Errorf("failed to publish event to Kafka: %w", err)
	}

	log.Printf("Published event: %s for payment: %s", eventType, payment.ID)
	return nil
}

// Helper functions
func (s *PaymentService) generateTransferID(paymentID uuid.UUID) types.Uint128 {
	// Convert UUID to Uint128
	// In production, use a more robust conversion
	return types.Uint128{
		High: uint64(paymentID.ID()),
		Low:  uint64(time.Now().UnixNano()),
	}
}

func (s *PaymentService) parseAccountID(accountIDStr string) types.Uint128 {
	// Parse account ID string to Uint128
	// Format: "high-low"
	var high, low uint64
	fmt.Sscanf(accountIDStr, "%d-%d", &high, &low)
	return types.Uint128{High: high, Low: low}
}

func (s *PaymentService) parseTransferID(transferIDStr string) types.Uint128 {
	// Parse transfer ID string to Uint128
	var high, low uint64
	fmt.Sscanf(transferIDStr, "%d-%d", &high, &low)
	return types.Uint128{High: high, Low: low}
}

// RefundPayment processes a refund for a payment
func (s *PaymentService) RefundPayment(ctx context.Context, req *models.RefundRequest) error {
	// Get original payment
	originalPayment, err := s.repo.GetByID(ctx, req.PaymentID)
	if err != nil {
		return fmt.Errorf("failed to get original payment: %w", err)
	}

	if originalPayment.Status != models.PaymentStatusCompleted {
		return fmt.Errorf("cannot refund payment that is not completed")
	}

	if req.Amount > originalPayment.Amount {
		return fmt.Errorf("refund amount cannot exceed original payment amount")
	}

	// Create refund payment
	refundID := uuid.New()
	refundTransactionID := fmt.Sprintf("REFUND-%d-%s", time.Now().Unix(), refundID.String()[:8])

	metadata := map[string]interface{}{
		"original_payment_id": originalPayment.ID.String(),
		"reason":              req.Reason,
	}
	metadataJSON, _ := json.Marshal(metadata)

	refundPayment := &models.Payment{
		ID:              refundID,
		TransactionID:   refundTransactionID,
		PolicyID:        originalPayment.PolicyID,
		CustomerID:      originalPayment.CustomerID,
		Amount:          req.Amount,
		Currency:        originalPayment.Currency,
		PaymentType:     models.PaymentTypeRefund,
		PaymentMethod:   originalPayment.PaymentMethod,
		Status:          models.PaymentStatusPending,
		DebitAccountID:  originalPayment.CreditAccountID, // Reverse
		CreditAccountID: originalPayment.DebitAccountID,  // Reverse
		Metadata:        string(metadataJSON),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// Save refund to database
	if err := s.repo.Create(ctx, refundPayment); err != nil {
		return fmt.Errorf("failed to create refund payment: %w", err)
	}

	// Process refund through ledger
	if err := s.ProcessPayment(ctx, refundID, ""); err != nil {
		return fmt.Errorf("failed to process refund: %w", err)
	}

	// Update original payment status
	if err := s.repo.UpdateStatus(ctx, req.PaymentID, models.PaymentStatusRefunded, "Payment refunded"); err != nil {
		log.Printf("Failed to update original payment status: %v", err)
	}

	log.Printf("Refund processed successfully: %s", refundID)
	return nil
}
