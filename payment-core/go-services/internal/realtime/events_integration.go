package realtime

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("realtime-service")
}

func EmitRealtimeMessageSent(ctx context.Context, messageID string, userID string, channel string, messageType string) error {
	return events.GetEmitter().Emit(ctx, "realtime.message.sent", "message", messageID, map[string]interface{}{
		"user_id":      userID,
		"channel":      channel,
		"message_type": messageType,
	})
}

func EmitRealtimeConnectionOpened(ctx context.Context, connectionID string, userID string, deviceID string) error {
	return events.GetEmitter().Emit(ctx, "realtime.connection.opened", "connection", connectionID, map[string]interface{}{
		"user_id":   userID,
		"device_id": deviceID,
	})
}

func EmitRealtimeConnectionClosed(ctx context.Context, connectionID string, userID string, reason string) error {
	return events.GetEmitter().Emit(ctx, "realtime.connection.closed", "connection", connectionID, map[string]interface{}{
		"user_id": userID,
		"reason":  reason,
	})
}
