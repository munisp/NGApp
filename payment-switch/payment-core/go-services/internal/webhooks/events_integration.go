package webhooks

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("webhooks-service")
}

func EmitWebhookDelivered(ctx context.Context, webhookID string, merchantID string, eventType string, url string, statusCode int) error {
	return events.GetEmitter().Emit(ctx, "webhook.delivered", "webhook", webhookID, map[string]interface{}{
		"merchant_id": merchantID,
		"event_type":  eventType,
		"url":         url,
		"status_code": statusCode,
	})
}

func EmitWebhookFailed(ctx context.Context, webhookID string, merchantID string, eventType string, url string, errorMessage string, retryCount int) error {
	return events.GetEmitter().Emit(ctx, "webhook.failed", "webhook", webhookID, map[string]interface{}{
		"merchant_id":   merchantID,
		"event_type":    eventType,
		"url":           url,
		"error_message": errorMessage,
		"retry_count":   retryCount,
	})
}

func EmitWebhookRetryScheduled(ctx context.Context, webhookID string, retryAt string, retryCount int) error {
	return events.GetEmitter().Emit(ctx, "webhook.retry.scheduled", "webhook", webhookID, map[string]interface{}{
		"retry_at":    retryAt,
		"retry_count": retryCount,
	})
}
