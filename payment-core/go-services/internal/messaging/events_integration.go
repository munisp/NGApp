package messaging

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("messaging-service")
}

func EmitMessagePublished(ctx context.Context, messageID string, topic string, partition int) error {
	return events.GetEmitter().Emit(ctx, "message.published", "message", messageID, map[string]interface{}{
		"topic":     topic,
		"partition": partition,
	})
}

func EmitOutboxEventProcessed(ctx context.Context, eventID string, topic string, retryCount int) error {
	return events.GetEmitter().Emit(ctx, "outbox.event.processed", "outbox_event", eventID, map[string]interface{}{
		"topic":       topic,
		"retry_count": retryCount,
	})
}

func EmitDeadLetterQueued(ctx context.Context, messageID string, originalTopic string, errorMessage string) error {
	return events.GetEmitter().Emit(ctx, "dead.letter.queued", "dead_letter", messageID, map[string]interface{}{
		"original_topic": originalTopic,
		"error_message":  errorMessage,
	})
}
