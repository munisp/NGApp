package crypto

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("crypto-service")
}

func EmitCryptoDepositReceived(ctx context.Context, depositID string, amount float64, currency string, walletAddress string, txHash string) error {
	return events.GetEmitter().Emit(ctx, events.EventCryptoDepositReceived, "deposit", depositID, map[string]interface{}{
		"amount":         amount,
		"currency":       currency,
		"wallet_address": walletAddress,
		"tx_hash":        txHash,
	})
}

func EmitCryptoWithdrawalSent(ctx context.Context, withdrawalID string, amount float64, currency string, walletAddress string, txHash string) error {
	return events.GetEmitter().Emit(ctx, events.EventCryptoWithdrawalSent, "withdrawal", withdrawalID, map[string]interface{}{
		"amount":         amount,
		"currency":       currency,
		"wallet_address": walletAddress,
		"tx_hash":        txHash,
	})
}
