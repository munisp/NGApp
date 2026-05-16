package models

import (
	"time"

	"github.com/google/uuid"
)

// PaymentStatus represents the status of a payment
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "PENDING"
	PaymentStatusProcessing PaymentStatus = "PROCESSING"
	PaymentStatusCompleted  PaymentStatus = "COMPLETED"
	PaymentStatusFailed     PaymentStatus = "FAILED"
	PaymentStatusRefunded   PaymentStatus = "REFUNDED"
)

// PaymentType represents the type of payment
type PaymentType string

const (
	PaymentTypePremium     PaymentType = "PREMIUM"
	PaymentTypeClaim       PaymentType = "CLAIM"
	PaymentTypeCommission  PaymentType = "COMMISSION"
	PaymentTypeRefund      PaymentType = "REFUND"
)

// PaymentMethod represents the payment method
type PaymentMethod string

const (
	PaymentMethodCard         PaymentMethod = "CARD"
	PaymentMethodBankTransfer PaymentMethod = "BANK_TRANSFER"
	PaymentMethodUSSD         PaymentMethod = "USSD"
	PaymentMethodMobileMoney  PaymentMethod = "MOBILE_MONEY"
)

// Payment represents a payment transaction
type Payment struct {
	ID                  uuid.UUID     `json:"id" db:"id"`
	TransactionID       string        `json:"transaction_id" db:"transaction_id"`
	PolicyID            uuid.UUID     `json:"policy_id" db:"policy_id"`
	CustomerID          uuid.UUID     `json:"customer_id" db:"customer_id"`
	Amount              int64         `json:"amount" db:"amount"`
	Currency            string        `json:"currency" db:"currency"`
	PaymentType         PaymentType   `json:"payment_type" db:"payment_type"`
	PaymentMethod       PaymentMethod `json:"payment_method" db:"payment_method"`
	Status              PaymentStatus `json:"status" db:"status"`
	GatewayReference    string        `json:"gateway_reference" db:"gateway_reference"`
	GatewayResponse     string        `json:"gateway_response" db:"gateway_response"`
	LedgerTransferID    string        `json:"ledger_transfer_id" db:"ledger_transfer_id"`
	DebitAccountID      string        `json:"debit_account_id" db:"debit_account_id"`
	CreditAccountID     string        `json:"credit_account_id" db:"credit_account_id"`
	Metadata            string        `json:"metadata" db:"metadata"`
	CreatedAt           time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time     `json:"updated_at" db:"updated_at"`
	CompletedAt         *time.Time    `json:"completed_at" db:"completed_at"`
}

// CreatePaymentRequest represents a request to create a payment
type CreatePaymentRequest struct {
	PolicyID        uuid.UUID     `json:"policy_id" binding:"required"`
	CustomerID      uuid.UUID     `json:"customer_id" binding:"required"`
	Amount          int64         `json:"amount" binding:"required,gt=0"`
	Currency        string        `json:"currency" binding:"required"`
	PaymentType     PaymentType   `json:"payment_type" binding:"required"`
	PaymentMethod   PaymentMethod `json:"payment_method" binding:"required"`
	DebitAccountID  string        `json:"debit_account_id" binding:"required"`
	CreditAccountID string        `json:"credit_account_id" binding:"required"`
	Metadata        map[string]interface{} `json:"metadata"`
}

// ProcessPaymentRequest represents a request to process a payment
type ProcessPaymentRequest struct {
	PaymentID        uuid.UUID `json:"payment_id" binding:"required"`
	GatewayReference string    `json:"gateway_reference"`
}

// PaymentResponse represents a payment response
type PaymentResponse struct {
	ID               uuid.UUID     `json:"id"`
	TransactionID    string        `json:"transaction_id"`
	Amount           int64         `json:"amount"`
	Currency         string        `json:"currency"`
	PaymentType      PaymentType   `json:"payment_type"`
	PaymentMethod    PaymentMethod `json:"payment_method"`
	Status           PaymentStatus `json:"status"`
	GatewayReference string        `json:"gateway_reference"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

// RefundRequest represents a request to refund a payment
type RefundRequest struct {
	PaymentID uuid.UUID `json:"payment_id" binding:"required"`
	Amount    int64     `json:"amount" binding:"required,gt=0"`
	Reason    string    `json:"reason" binding:"required"`
}

// PaymentEvent represents a payment event for Kafka
type PaymentEvent struct {
	EventID       uuid.UUID     `json:"event_id"`
	EventType     string        `json:"event_type"`
	PaymentID     uuid.UUID     `json:"payment_id"`
	TransactionID string        `json:"transaction_id"`
	PolicyID      uuid.UUID     `json:"policy_id"`
	CustomerID    uuid.UUID     `json:"customer_id"`
	Amount        int64         `json:"amount"`
	Currency      string        `json:"currency"`
	PaymentType   PaymentType   `json:"payment_type"`
	Status        PaymentStatus `json:"status"`
	Timestamp     time.Time     `json:"timestamp"`
	Metadata      map[string]interface{} `json:"metadata"`
}
