package alerts

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("rate-alert-service")
}

func EmitRateAlertCreated(ctx context.Context, alertID, userID, fromCurrency, toCurrency string, targetRate float64) error {
	return events.GetEmitter().Emit(ctx, events.EventRateAlertCreated, "rate_alert", alertID, map[string]interface{}{
		"user_id":       userID,
		"from_currency": fromCurrency,
		"to_currency":   toCurrency,
		"target_rate":   targetRate,
		"created_at":    time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitRateAlertTriggered(ctx context.Context, alertID, userID, fromCurrency, toCurrency string, targetRate, currentRate float64) error {
	return events.EmitRateAlertTriggered(ctx, alertID, userID, fromCurrency, toCurrency, targetRate, currentRate)
}

func EmitRateAlertDeleted(ctx context.Context, alertID, userID string) error {
	return events.GetEmitter().Emit(ctx, "rate.alert.deleted", "rate_alert", alertID, map[string]interface{}{
		"user_id":    userID,
		"deleted_at": time.Now().UTC().Format(time.RFC3339),
	})
}

type RateAlertServiceWithEvents struct {
	service interface{}
}

func NewRateAlertServiceWithEvents(service interface{}) *RateAlertServiceWithEvents {
	return &RateAlertServiceWithEvents{service: service}
}

func (s *RateAlertServiceWithEvents) CreateAlert(ctx context.Context, userID, fromCurrency, toCurrency string, targetRate float64) (string, error) {
	alertID := generateAlertID()

	if err := EmitRateAlertCreated(ctx, alertID, userID, fromCurrency, toCurrency, targetRate); err != nil {
		log.Printf("Failed to emit rate alert created event: %v", err)
	}

	return alertID, nil
}

func (s *RateAlertServiceWithEvents) TriggerAlert(ctx context.Context, alertID, userID, fromCurrency, toCurrency string, targetRate, currentRate float64) error {
	if err := EmitRateAlertTriggered(ctx, alertID, userID, fromCurrency, toCurrency, targetRate, currentRate); err != nil {
		log.Printf("Failed to emit rate alert triggered event: %v", err)
	}
	return nil
}

func generateAlertID() string {
	return "alert_" + time.Now().Format("20060102150405")
}
