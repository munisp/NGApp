package adapter

import (
	"context"
	"payment_service/domain"
)

// FiatGateway defines the interface for fiat payment providers (e.g., Paystack, Flutterwave).
type FiatGateway interface {
	// InitiatePayment creates a payment request and returns a reference and a payment URL.
	InitiatePayment(ctx context.Context, amount float64, currency string) (reference string, paymentURL string, err error)
	// VerifyPayment checks the status of a payment using the reference.
	VerifyPayment(ctx context.Context, reference string) (status string, err error)
}

// CryptoExchange defines the interface for crypto exchange services (e.g., Binance, Coinbase).
type CryptoExchange interface {
	// BuyCrypto purchases a specified amount of a target crypto using fiat.
	// Returns the amount of crypto purchased and an exchange transaction ID.
	BuyCrypto(ctx context.Context, fiatAmount float64, fiatCurrency string, cryptoCurrency string) (cryptoAmount float64, exchangeTxID string, err error)
}

// WalletManager defines the interface for managing internal crypto wallets and transfers.
type WalletManager interface {
	// Transfer sends crypto from an internal wallet to an external address.
	// Returns the blockchain transaction hash.
	Transfer(ctx context.Context, fromWalletID string, toAddress string, amount float64, currency string) (txHash string, err error)
	// GetWalletBalance retrieves the current balance of an internal wallet.
	GetWalletBalance(ctx context.Context, walletID string) (balance float64, err error)
}

// PolicyService defines the interface for interacting with the Etherisc GIF Policy Service.
type PolicyService interface {
	// NotifyPremiumPaid informs the Policy Service that a premium has been successfully paid.
	NotifyPremiumPaid(ctx context.Context, policyID string, amount float64, currency string) error
}
