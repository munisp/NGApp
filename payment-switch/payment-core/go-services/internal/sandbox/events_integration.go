package sandbox

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("sandbox-service")
}

func EmitSandboxCreated(ctx context.Context, sandboxID string, merchantID string, tier string) error {
	return events.GetEmitter().Emit(ctx, events.EventSandboxCreated, "sandbox", sandboxID, map[string]interface{}{
		"merchant_id": merchantID,
		"tier":        tier,
	})
}

func EmitSandboxTransactionSimulated(ctx context.Context, transactionID string, sandboxID string, transactionType string, amount float64, status string) error {
	return events.GetEmitter().Emit(ctx, events.EventSandboxTransactionSimulated, "transaction", transactionID, map[string]interface{}{
		"sandbox_id":       sandboxID,
		"transaction_type": transactionType,
		"amount":           amount,
		"status":           status,
	})
}

func EmitSandboxWebhookSent(ctx context.Context, webhookID string, sandboxID string, eventType string, url string) error {
	return events.GetEmitter().Emit(ctx, "sandbox.webhook.sent", "webhook", webhookID, map[string]interface{}{
		"sandbox_id": sandboxID,
		"event_type": eventType,
		"url":        url,
	})
}
