package domain

import (
	"time"
)

// PaymentStatus represents the current state of a payment workflow.
type PaymentStatus string

const (
	PaymentStatusPendingFiat PaymentStatus = "PENDING_FIAT"
	PaymentStatusFiatReceived PaymentStatus = "FIAT_RECEIVED"
	PaymentStatusCryptoPurchased PaymentStatus = "CRYPTO_PURCHASED"
	PaymentStatusPremiumPaid PaymentStatus = "PREMIUM_PAID"
	PaymentStatusFailed PaymentStatus = "FAILED"
)

// Payment represents the main record for a policy premium payment.
type Payment struct {
	ID             string        `json:"id"`
	PolicyID       string        `json:"policy_id"`
	AmountFiat     float64       `json:"amount_fiat"`
	CurrencyFiat   string        `json:"currency_fiat"` // e.g., "NGN", "USD"
	AmountCrypto   float64       `json:"amount_crypto"`
	CurrencyCrypto string        `json:"currency_crypto"` // e.g., "USDC"
	Status         PaymentStatus `json:"status"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	// Temporal Workflow Run ID for tracking
	WorkflowRunID  string        `json:"workflow_run_id"`
}

// TransactionType represents the type of financial operation.
type TransactionType string

const (
	TransactionTypeFiatIn TransactionType = "FIAT_IN"
	TransactionTypeCryptoPurchase TransactionType = "CRYPTO_PURCHASE"
	TransactionTypeCryptoTransfer TransactionType = "CRYPTO_TRANSFER"
)

// Transaction represents a step in the payment process.
type Transaction struct {
	ID            string          `json:"id"`
	PaymentID     string          `json:"payment_id"`
	Type          TransactionType `json:"type"`
	Status        string          `json:"status"` // e.g., "SUCCESS", "PENDING", "FAILED"
	Amount        float64         `json:"amount"`
	Currency      string          `json:"currency"`
	ExternalRef   string          `json:"external_ref"` // e.g., Paystack reference, blockchain tx hash
	CreatedAt     time.Time       `json:"created_at"`
}

// Wallet represents an internal crypto wallet managed by the service.
type Wallet struct {
	ID        string    `json:"id"`
	OwnerID   string    `json:"owner_id"` // e.g., "SERVICE_FEE_WALLET", "USER_DEPOSIT_WALLET"
	Address   string    `json:"address"`
	Balance   float64   `json:"balance"`
	Currency  string    `json:"currency"` // e.g., "USDC"
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
