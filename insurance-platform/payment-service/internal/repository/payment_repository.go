package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"insurance-platform/payment-service/internal/models"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// PaymentRepository handles database operations for payments
type PaymentRepository struct {
	db *sql.DB
}

// NewPaymentRepository creates a new payment repository
func NewPaymentRepository(db *sql.DB) *PaymentRepository {
	return &PaymentRepository{
		db: db,
	}
}

// Create inserts a new payment into the database
func (r *PaymentRepository) Create(ctx context.Context, payment *models.Payment) error {
	query := `
		INSERT INTO payments (
			id, transaction_id, policy_id, customer_id, amount, currency,
			payment_type, payment_method, status, gateway_reference, gateway_response,
			ledger_transfer_id, debit_account_id, credit_account_id, metadata,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`

	_, err := r.db.ExecContext(ctx, query,
		payment.ID,
		payment.TransactionID,
		payment.PolicyID,
		payment.CustomerID,
		payment.Amount,
		payment.Currency,
		payment.PaymentType,
		payment.PaymentMethod,
		payment.Status,
		payment.GatewayReference,
		payment.GatewayResponse,
		payment.LedgerTransferID,
		payment.DebitAccountID,
		payment.CreditAccountID,
		payment.Metadata,
		payment.CreatedAt,
		payment.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create payment: %w", err)
	}

	return nil
}

// GetByID retrieves a payment by its ID
func (r *PaymentRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	query := `
		SELECT id, transaction_id, policy_id, customer_id, amount, currency,
		       payment_type, payment_method, status, gateway_reference, gateway_response,
		       ledger_transfer_id, debit_account_id, credit_account_id, metadata,
		       created_at, updated_at, completed_at
		FROM payments
		WHERE id = $1
	`

	payment := &models.Payment{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&payment.ID,
		&payment.TransactionID,
		&payment.PolicyID,
		&payment.CustomerID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentType,
		&payment.PaymentMethod,
		&payment.Status,
		&payment.GatewayReference,
		&payment.GatewayResponse,
		&payment.LedgerTransferID,
		&payment.DebitAccountID,
		&payment.CreditAccountID,
		&payment.Metadata,
		&payment.CreatedAt,
		&payment.UpdatedAt,
		&payment.CompletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("payment not found: %s", id)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	return payment, nil
}

// GetByTransactionID retrieves a payment by its transaction ID
func (r *PaymentRepository) GetByTransactionID(ctx context.Context, transactionID string) (*models.Payment, error) {
	query := `
		SELECT id, transaction_id, policy_id, customer_id, amount, currency,
		       payment_type, payment_method, status, gateway_reference, gateway_response,
		       ledger_transfer_id, debit_account_id, credit_account_id, metadata,
		       created_at, updated_at, completed_at
		FROM payments
		WHERE transaction_id = $1
	`

	payment := &models.Payment{}
	err := r.db.QueryRowContext(ctx, query, transactionID).Scan(
		&payment.ID,
		&payment.TransactionID,
		&payment.PolicyID,
		&payment.CustomerID,
		&payment.Amount,
		&payment.Currency,
		&payment.PaymentType,
		&payment.PaymentMethod,
		&payment.Status,
		&payment.GatewayReference,
		&payment.GatewayResponse,
		&payment.LedgerTransferID,
		&payment.DebitAccountID,
		&payment.CreditAccountID,
		&payment.Metadata,
		&payment.CreatedAt,
		&payment.UpdatedAt,
		&payment.CompletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("payment not found: %s", transactionID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	return payment, nil
}

// UpdateStatus updates the status of a payment
func (r *PaymentRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status models.PaymentStatus, gatewayResponse string) error {
	query := `
		UPDATE payments
		SET status = $1, gateway_response = $2, updated_at = $3
		WHERE id = $4
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, status, gatewayResponse, now, id)
	if err != nil {
		return fmt.Errorf("failed to update payment status: %w", err)
	}

	return nil
}

// Complete marks a payment as completed
func (r *PaymentRepository) Complete(ctx context.Context, id uuid.UUID, ledgerTransferID string) error {
	query := `
		UPDATE payments
		SET status = $1, ledger_transfer_id = $2, completed_at = $3, updated_at = $4
		WHERE id = $5
	`

	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, models.PaymentStatusCompleted, ledgerTransferID, now, now, id)
	if err != nil {
		return fmt.Errorf("failed to complete payment: %w", err)
	}

	return nil
}

// GetByPolicyID retrieves all payments for a policy
func (r *PaymentRepository) GetByPolicyID(ctx context.Context, policyID uuid.UUID) ([]*models.Payment, error) {
	query := `
		SELECT id, transaction_id, policy_id, customer_id, amount, currency,
		       payment_type, payment_method, status, gateway_reference, gateway_response,
		       ledger_transfer_id, debit_account_id, credit_account_id, metadata,
		       created_at, updated_at, completed_at
		FROM payments
		WHERE policy_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, policyID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payments by policy: %w", err)
	}
	defer rows.Close()

	var payments []*models.Payment
	for rows.Next() {
		payment := &models.Payment{}
		err := rows.Scan(
			&payment.ID,
			&payment.TransactionID,
			&payment.PolicyID,
			&payment.CustomerID,
			&payment.Amount,
			&payment.Currency,
			&payment.PaymentType,
			&payment.PaymentMethod,
			&payment.Status,
			&payment.GatewayReference,
			&payment.GatewayResponse,
			&payment.LedgerTransferID,
			&payment.DebitAccountID,
			&payment.CreditAccountID,
			&payment.Metadata,
			&payment.CreatedAt,
			&payment.UpdatedAt,
			&payment.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}
		payments = append(payments, payment)
	}

	return payments, nil
}

// GetByCustomerID retrieves all payments for a customer
func (r *PaymentRepository) GetByCustomerID(ctx context.Context, customerID uuid.UUID) ([]*models.Payment, error) {
	query := `
		SELECT id, transaction_id, policy_id, customer_id, amount, currency,
		       payment_type, payment_method, status, gateway_reference, gateway_response,
		       ledger_transfer_id, debit_account_id, credit_account_id, metadata,
		       created_at, updated_at, completed_at
		FROM payments
		WHERE customer_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.QueryContext(ctx, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get payments by customer: %w", err)
	}
	defer rows.Close()

	var payments []*models.Payment
	for rows.Next() {
		payment := &models.Payment{}
		err := rows.Scan(
			&payment.ID,
			&payment.TransactionID,
			&payment.PolicyID,
			&payment.CustomerID,
			&payment.Amount,
			&payment.Currency,
			&payment.PaymentType,
			&payment.PaymentMethod,
			&payment.Status,
			&payment.GatewayReference,
			&payment.GatewayResponse,
			&payment.LedgerTransferID,
			&payment.DebitAccountID,
			&payment.CreditAccountID,
			&payment.Metadata,
			&payment.CreatedAt,
			&payment.UpdatedAt,
			&payment.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}
		payments = append(payments, payment)
	}

	return payments, nil
}

// InitSchema creates the payments table
func (r *PaymentRepository) InitSchema(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS payments (
			id UUID PRIMARY KEY,
			transaction_id VARCHAR(255) UNIQUE NOT NULL,
			policy_id UUID NOT NULL,
			customer_id UUID NOT NULL,
			amount BIGINT NOT NULL,
			currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
			payment_type VARCHAR(50) NOT NULL,
			payment_method VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL,
			gateway_reference VARCHAR(255),
			gateway_response TEXT,
			ledger_transfer_id VARCHAR(255),
			debit_account_id VARCHAR(255) NOT NULL,
			credit_account_id VARCHAR(255) NOT NULL,
			metadata JSONB,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMP,
			INDEX idx_policy_id (policy_id),
			INDEX idx_customer_id (customer_id),
			INDEX idx_transaction_id (transaction_id),
			INDEX idx_status (status),
			INDEX idx_created_at (created_at)
		);
	`

	_, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create payments table: %w", err)
	}

	return nil
}
