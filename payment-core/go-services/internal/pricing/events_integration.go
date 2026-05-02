package pricing

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("pricing-service")
}

func EmitPricingTierUpdated(ctx context.Context, merchantID string, oldTier string, newTier string) error {
	return events.GetEmitter().Emit(ctx, "pricing.tier.updated", "merchant", merchantID, map[string]interface{}{
		"old_tier": oldTier,
		"new_tier": newTier,
	})
}

func EmitPricingCalculated(ctx context.Context, transactionID string, baseFee float64, percentageFee float64, totalFee float64) error {
	return events.GetEmitter().Emit(ctx, "pricing.calculated", "transaction", transactionID, map[string]interface{}{
		"base_fee":       baseFee,
		"percentage_fee": percentageFee,
		"total_fee":      totalFee,
	})
}
