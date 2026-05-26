package remittance

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("remittance-service")
}

func EmitRemittanceInitiated(ctx context.Context, remittanceID string, senderID string, recipientID string, amount float64, currency string, corridor string) error {
	return events.GetEmitter().Emit(ctx, events.EventRemittanceInitiated, "remittance", remittanceID, map[string]interface{}{
		"sender_id":    senderID,
		"recipient_id": recipientID,
		"amount":       amount,
		"currency":     currency,
		"corridor":     corridor,
	})
}

func EmitRemittanceCompleted(ctx context.Context, remittanceID string, senderID string, recipientID string, amount float64, currency string, corridor string) error {
	return events.GetEmitter().Emit(ctx, events.EventRemittanceCompleted, "remittance", remittanceID, map[string]interface{}{
		"sender_id":    senderID,
		"recipient_id": recipientID,
		"amount":       amount,
		"currency":     currency,
		"corridor":     corridor,
	})
}

func EmitRemittanceFailed(ctx context.Context, remittanceID string, errorCode string, errorMessage string) error {
	return events.GetEmitter().Emit(ctx, events.EventRemittanceFailed, "remittance", remittanceID, map[string]interface{}{
		"error_code":    errorCode,
		"error_message": errorMessage,
	})
}
