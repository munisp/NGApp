package fxrisk

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("fx-risk-service")
}

func EmitFXLockCreated(ctx context.Context, lockID, userID, fromCurrency, toCurrency string, rate float64, expiresAt time.Time) error {
	return events.EmitFXLockCreated(ctx, lockID, userID, fromCurrency, toCurrency, rate, expiresAt)
}

func EmitFXLockExpired(ctx context.Context, lockID, userID string) error {
	return events.GetEmitter().Emit(ctx, events.EventFXLockExpired, "fx_lock", lockID, map[string]interface{}{
		"user_id":    userID,
		"expired_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitFXLockUsed(ctx context.Context, lockID, userID, transactionID string, amount float64) error {
	return events.GetEmitter().Emit(ctx, "fx.lock.used", "fx_lock", lockID, map[string]interface{}{
		"user_id":        userID,
		"transaction_id": transactionID,
		"amount":         amount,
		"used_at":        time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitHedgeExecuted(ctx context.Context, hedgeID, corridor string, amount float64, rate float64) error {
	return events.GetEmitter().Emit(ctx, events.EventFXHedgeExecuted, "hedge", hedgeID, map[string]interface{}{
		"corridor":    corridor,
		"amount":      amount,
		"rate":        rate,
		"executed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitExposureAlert(ctx context.Context, corridor string, exposure, threshold float64) error {
	return events.GetEmitter().Emit(ctx, "fx.exposure.alert", "corridor", corridor, map[string]interface{}{
		"exposure":   exposure,
		"threshold":  threshold,
		"alerted_at": time.Now().UTC().Format(time.RFC3339),
	})
}

type FXRiskServiceWithEvents struct {
	service interface{}
}

func NewFXRiskServiceWithEvents(service interface{}) *FXRiskServiceWithEvents {
	return &FXRiskServiceWithEvents{service: service}
}

func (s *FXRiskServiceWithEvents) CreateLock(ctx context.Context, userID, fromCurrency, toCurrency string, rate float64, durationMinutes int) (string, error) {
	lockID := generateLockID()
	expiresAt := time.Now().Add(time.Duration(durationMinutes) * time.Minute)

	if err := EmitFXLockCreated(ctx, lockID, userID, fromCurrency, toCurrency, rate, expiresAt); err != nil {
		log.Printf("Failed to emit FX lock created event: %v", err)
	}

	return lockID, nil
}

func (s *FXRiskServiceWithEvents) UseLock(ctx context.Context, lockID, userID, transactionID string, amount float64) error {
	if err := EmitFXLockUsed(ctx, lockID, userID, transactionID, amount); err != nil {
		log.Printf("Failed to emit FX lock used event: %v", err)
	}
	return nil
}

func (s *FXRiskServiceWithEvents) ExecuteHedge(ctx context.Context, corridor string, amount, rate float64) (string, error) {
	hedgeID := generateHedgeID()

	if err := EmitHedgeExecuted(ctx, hedgeID, corridor, amount, rate); err != nil {
		log.Printf("Failed to emit hedge executed event: %v", err)
	}

	return hedgeID, nil
}

func generateLockID() string {
	return "lock_" + time.Now().Format("20060102150405")
}

func generateHedgeID() string {
	return "hedge_" + time.Now().Format("20060102150405")
}
