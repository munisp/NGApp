package monetization

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("monetization-service")
}

func EmitAPIKeyCreated(ctx context.Context, keyID string, merchantID string, scopes []string, tier string) error {
	return events.GetEmitter().Emit(ctx, events.EventAPIKeyCreated, "api_key", keyID, map[string]interface{}{
		"merchant_id": merchantID,
		"scopes":      scopes,
		"tier":        tier,
	})
}

func EmitAPIKeyRevoked(ctx context.Context, keyID string, merchantID string, reason string) error {
	return events.GetEmitter().Emit(ctx, events.EventAPIKeyRevoked, "api_key", keyID, map[string]interface{}{
		"merchant_id": merchantID,
		"reason":      reason,
	})
}

func EmitUsageMetered(ctx context.Context, merchantID string, eventType string, quantity int, billableAmount float64) error {
	return events.GetEmitter().Emit(ctx, events.EventUsageMetered, "merchant", merchantID, map[string]interface{}{
		"event_type":      eventType,
		"quantity":        quantity,
		"billable_amount": billableAmount,
	})
}

func EmitInvoiceGenerated(ctx context.Context, invoiceID string, merchantID string, amount float64, currency string) error {
	return events.GetEmitter().Emit(ctx, events.EventInvoiceGenerated, "invoice", invoiceID, map[string]interface{}{
		"merchant_id": merchantID,
		"amount":      amount,
		"currency":    currency,
	})
}
