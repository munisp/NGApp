package disputes

import (
	"context"
	"log"
	"time"

	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("dispute-service")
}

func EmitDisputeOpened(ctx context.Context, disputeID, transactionID, customerID, reason string, amount float64) error {
	return events.EmitDisputeOpened(ctx, disputeID, transactionID, customerID, reason, amount)
}

func EmitDisputeResolved(ctx context.Context, disputeID, resolution string, refundAmount float64) error {
	return events.GetEmitter().Emit(ctx, events.EventDisputeResolved, "dispute", disputeID, map[string]interface{}{
		"resolution":    resolution,
		"refund_amount": refundAmount,
		"resolved_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitDisputeEscalated(ctx context.Context, disputeID, escalationLevel, reason string) error {
	return events.GetEmitter().Emit(ctx, events.EventDisputeEscalated, "dispute", disputeID, map[string]interface{}{
		"escalation_level": escalationLevel,
		"reason":           reason,
		"escalated_at":     time.Now().UTC().Format(time.RFC3339),
	})
}

func EmitDisputeEvidenceSubmitted(ctx context.Context, disputeID, evidenceType string) error {
	return events.GetEmitter().Emit(ctx, "dispute.evidence.submitted", "dispute", disputeID, map[string]interface{}{
		"evidence_type": evidenceType,
		"submitted_at":  time.Now().UTC().Format(time.RFC3339),
	})
}

type DisputeServiceWithEvents struct {
	service interface{}
}

func NewDisputeServiceWithEvents(service interface{}) *DisputeServiceWithEvents {
	return &DisputeServiceWithEvents{service: service}
}

func (s *DisputeServiceWithEvents) OpenDispute(ctx context.Context, transactionID, customerID, reason string, amount float64) (string, error) {
	disputeID := generateDisputeID()
	
	if err := EmitDisputeOpened(ctx, disputeID, transactionID, customerID, reason, amount); err != nil {
		log.Printf("Failed to emit dispute opened event: %v", err)
	}
	
	return disputeID, nil
}

func (s *DisputeServiceWithEvents) ResolveDispute(ctx context.Context, disputeID, resolution string, refundAmount float64) error {
	if err := EmitDisputeResolved(ctx, disputeID, resolution, refundAmount); err != nil {
		log.Printf("Failed to emit dispute resolved event: %v", err)
	}
	return nil
}

func (s *DisputeServiceWithEvents) EscalateDispute(ctx context.Context, disputeID, escalationLevel, reason string) error {
	if err := EmitDisputeEscalated(ctx, disputeID, escalationLevel, reason); err != nil {
		log.Printf("Failed to emit dispute escalated event: %v", err)
	}
	return nil
}

func generateDisputeID() string {
	return "disp_" + time.Now().Format("20060102150405")
}
