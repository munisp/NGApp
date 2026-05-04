package notifications

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("notifications-service")
}

func EmitNotificationSent(ctx context.Context, notificationID string, userID string, channel string, templateID string) error {
	return events.GetEmitter().Emit(ctx, events.EventNotificationSent, "notification", notificationID, map[string]interface{}{
		"user_id":     userID,
		"channel":     channel,
		"template_id": templateID,
	})
}

func EmitNotificationFailed(ctx context.Context, notificationID string, userID string, channel string, errorMessage string) error {
	return events.GetEmitter().Emit(ctx, events.EventNotificationFailed, "notification", notificationID, map[string]interface{}{
		"user_id":       userID,
		"channel":       channel,
		"error_message": errorMessage,
	})
}

func EmitNotificationDelivered(ctx context.Context, notificationID string, userID string, channel string) error {
	return events.GetEmitter().Emit(ctx, "notification.delivered", "notification", notificationID, map[string]interface{}{
		"user_id": userID,
		"channel": channel,
	})
}
