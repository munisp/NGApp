package reconciliation

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("reconciliation-service")
}

func EmitReconciliationStarted(ctx context.Context, reconciliationID, source, target string, recordCount int) error {
	return events.GetEmitter().Emit(ctx, events.EventReconciliationStarted, "reconciliation", reconciliationID, map[string]interface{}{
		"source":       source,
		"target":       target,
		"record_count": recordCount,
		"started_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitReconciliationCompleted(ctx context.Context, reconciliationID string, matchedCount, mismatchCount int, status string) error {
	return events.EmitReconciliationCompleted(ctx, reconciliationID, matchedCount, mismatchCount, status)
}

func EmitReconciliationMismatch(ctx context.Context, reconciliationID, recordID, mismatchType string, sourceValue, targetValue interface{}) error {
	return events.GetEmitter().Emit(ctx, events.EventReconciliationMismatch, "reconciliation", reconciliationID, map[string]interface{}{
		"record_id":     recordID,
		"mismatch_type": mismatchType,
		"source_value":  sourceValue,
		"target_value":  targetValue,
		"detected_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitReconciliationFailed(ctx context.Context, reconciliationID, reason string) error {
	return events.GetEmitter().Emit(ctx, "reconciliation.failed", "reconciliation", reconciliationID, map[string]interface{}{
		"reason":    reason,
		"failed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

type ReconciliationServiceWithEvents struct {
	service interface{}
}

func NewReconciliationServiceWithEvents(service interface{}) *ReconciliationServiceWithEvents {
	return &ReconciliationServiceWithEvents{service: service}
}

func (s *ReconciliationServiceWithEvents) StartReconciliation(ctx context.Context, source, target string, recordCount int) (string, error) {
	reconciliationID := generateReconciliationID()

	if err := EmitReconciliationStarted(ctx, reconciliationID, source, target, recordCount); err != nil {
		log.Printf("Failed to emit reconciliation started event: %v", err)
	}

	return reconciliationID, nil
}

func (s *ReconciliationServiceWithEvents) CompleteReconciliation(ctx context.Context, reconciliationID string, matchedCount, mismatchCount int, status string) error {
	if err := EmitReconciliationCompleted(ctx, reconciliationID, matchedCount, mismatchCount, status); err != nil {
		log.Printf("Failed to emit reconciliation completed event: %v", err)
	}
	return nil
}

func (s *ReconciliationServiceWithEvents) ReportMismatch(ctx context.Context, reconciliationID, recordID, mismatchType string, sourceValue, targetValue interface{}) error {
	if err := EmitReconciliationMismatch(ctx, reconciliationID, recordID, mismatchType, sourceValue, targetValue); err != nil {
		log.Printf("Failed to emit reconciliation mismatch event: %v", err)
	}
	return nil
}

func generateReconciliationID() string {
	return "recon_" + time.Now().Format("20060102150405")
}
