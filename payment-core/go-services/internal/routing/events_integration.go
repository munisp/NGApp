package routing

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("routing-service")
}

func EmitRouteSelected(ctx context.Context, transactionID string, providerID string, score float64, latencyMs int64) error {
	return events.GetEmitter().Emit(ctx, "routing.route.selected", "transaction", transactionID, map[string]interface{}{
		"provider_id": providerID,
		"score":       score,
		"latency_ms":  latencyMs,
	})
}

func EmitRouteFallback(ctx context.Context, transactionID string, originalProvider string, fallbackProvider string, reason string) error {
	return events.GetEmitter().Emit(ctx, "routing.fallback", "transaction", transactionID, map[string]interface{}{
		"original_provider": originalProvider,
		"fallback_provider": fallbackProvider,
		"reason":            reason,
	})
}
