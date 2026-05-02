package banking

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("banking-service")
}

func EmitBankTransferInitiated(ctx context.Context, transferID string, amount float64, currency string, bankCode string) error {
	return events.GetEmitter().Emit(ctx, events.EventBankTransferInitiated, "transfer", transferID, map[string]interface{}{
		"amount":    amount,
		"currency":  currency,
		"bank_code": bankCode,
	})
}

func EmitBankTransferCompleted(ctx context.Context, transferID string, amount float64, currency string, bankCode string, accountNumber string) error {
	return events.GetEmitter().Emit(ctx, events.EventBankTransferCompleted, "transfer", transferID, map[string]interface{}{
		"amount":         amount,
		"currency":       currency,
		"bank_code":      bankCode,
		"account_number": accountNumber,
	})
}

func EmitMobileMoneyInitiated(ctx context.Context, transferID string, amount float64, currency string, provider string, phoneNumber string) error {
	return events.GetEmitter().Emit(ctx, events.EventMobileMoneyInitiated, "transfer", transferID, map[string]interface{}{
		"amount":       amount,
		"currency":     currency,
		"provider":     provider,
		"phone_number": phoneNumber,
	})
}

func EmitMobileMoneyCompleted(ctx context.Context, transferID string, amount float64, currency string, provider string) error {
	return events.GetEmitter().Emit(ctx, events.EventMobileMoneyCompleted, "transfer", transferID, map[string]interface{}{
		"amount":   amount,
		"currency": currency,
		"provider": provider,
	})
}
