package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
	"payment_service/domain"
)

// --- Mock Payment Repository (In-Memory) ---

type MockPaymentRepository struct {
	payments map[string]*domain.Payment
	logger   *zap.Logger
}

func NewMockPaymentRepository() *MockPaymentRepository {
	logger, _ := zap.NewDevelopment()
	return &MockPaymentRepository{
		payments: make(map[string]*domain.Payment),
		logger:   logger,
	}
}

func (r *MockPaymentRepository) SavePayment(ctx context.Context, p *domain.Payment) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
		p.CreatedAt = time.Now()
	}
	p.UpdatedAt = time.Now()
	r.payments[p.ID] = p
	r.logger.Info("Payment saved (mock)", zap.String("payment_id", p.ID), zap.String("status", string(p.Status)))
	return nil
}

func (r *MockPaymentRepository) GetPaymentByID(ctx context.Context, id string) (*domain.Payment, error) {
	p, ok := r.payments[id]
	if !ok {
		return nil, errors.New("payment not found")
	}
	return p, nil
}

// --- Mock Fiat Gateway Adapter (Paystack/Flutterwave) ---

type MockFiatGatewayAdapter struct {
	logger *zap.Logger
}

func NewMockFiatGatewayAdapter() *MockFiatGatewayAdapter {
	logger, _ := zap.NewDevelopment()
	return &MockFiatGatewayAdapter{logger: logger}
}

func (a *MockFiatGatewayAdapter) InitiatePayment(ctx context.Context, amount float64, currency string) (reference string, paymentURL string, err error) {
	ref := fmt.Sprintf("mock_fiat_ref_%s", uuid.New().String())
	url := fmt.Sprintf("https://mock-paystack.com/pay?ref=%s", ref)
	a.logger.Info("Initiated mock fiat payment", zap.Float64("amount", amount), zap.String("currency", currency), zap.String("reference", ref))
	return ref, url, nil
}

func (a *MockFiatGatewayAdapter) VerifyPayment(ctx context.Context, reference string) (status string, err error) {
	// Simulate successful verification
	a.logger.Info("Verified mock fiat payment", zap.String("reference", reference))
	return "SUCCESS", nil
}

// --- Mock Crypto Exchange Adapter (Binance/Coinbase) ---

type MockCryptoExchangeAdapter struct {
	logger *zap.Logger
}

func NewMockCryptoExchangeAdapter() *MockCryptoExchangeAdapter {
	logger, _ := zap.NewDevelopment()
	return &MockCryptoExchangeAdapter{logger: logger}
}

func (a *MockCryptoExchangeAdapter) BuyCrypto(ctx context.Context, fiatAmount float64, fiatCurrency string, cryptoCurrency string) (cryptoAmount float64, exchangeTxID string, err error) {
	// Simple mock conversion: 1 USD = 1 USDC (ignoring fees/slippage for simplicity)
	if fiatCurrency == "USD" && cryptoCurrency == "USDC" {
		cryptoAmount = fiatAmount * 0.99 // Simulate a small fee
	} else {
		cryptoAmount = fiatAmount / 1000 // Mock for other currencies
	}

	txID := fmt.Sprintf("mock_exchange_tx_%s", uuid.New().String())
	a.logger.Info("Purchased mock crypto", zap.Float64("fiat_amount", fiatAmount), zap.Float64("crypto_amount", cryptoAmount), zap.String("tx_id", txID))
	return cryptoAmount, txID, nil
}

// --- Mock Wallet Manager Adapter ---

type MockWalletManagerAdapter struct {
	logger *zap.Logger
}

func NewMockWalletManagerAdapter() *MockWalletManagerAdapter {
	logger, _ := zap.NewDevelopment()
	return &MockWalletManagerAdapter{logger: logger}
}

func (a *MockWalletManagerAdapter) Transfer(ctx context.Context, fromWalletID string, toAddress string, amount float64, currency string) (txHash string, err error) {
	txHash = fmt.Sprintf("mock_blockchain_tx_%s", uuid.New().String())
	a.logger.Info("Transferred mock crypto", zap.String("from", fromWalletID), zap.String("to_address", toAddress), zap.Float64("amount", amount), zap.String("tx_hash", txHash))
	return txHash, nil
}

func (a *MockWalletManagerAdapter) GetWalletBalance(ctx context.Context, walletID string) (balance float64, err error) {
	// Mock a large balance for the service wallet
	return 1000000.00, nil
}

// --- Mock Policy Service Adapter (Etherisc GIF) ---

type MockPolicyServiceAdapter struct {
	logger *zap.Logger
}

func NewMockPolicyServiceAdapter() *MockPolicyServiceAdapter {
	logger, _ := zap.NewDevelopment()
	return &MockPolicyServiceAdapter{logger: logger}
}

func (a *MockPolicyServiceAdapter) NotifyPremiumPaid(ctx context.Context, policyID string, amount float64, currency string) error {
	a.logger.Info("Notified Policy Service of premium payment (mock)", zap.String("policy_id", policyID), zap.Float64("amount", amount), zap.String("currency", currency))
	return nil
}
