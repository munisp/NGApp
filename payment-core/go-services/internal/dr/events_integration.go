package dr

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("dr-service")
}

func EmitDRFailoverInitiated(ctx context.Context, failoverID string, sourceRegion string, targetRegion string) error {
	return events.GetEmitter().Emit(ctx, "dr.failover.initiated", "failover", failoverID, map[string]interface{}{
		"source_region": sourceRegion,
		"target_region": targetRegion,
	})
}

func EmitDRFailoverCompleted(ctx context.Context, failoverID string, sourceRegion string, targetRegion string, durationMs int64) error {
	return events.GetEmitter().Emit(ctx, "dr.failover.completed", "failover", failoverID, map[string]interface{}{
		"source_region": sourceRegion,
		"target_region": targetRegion,
		"duration_ms":   durationMs,
	})
}

func EmitDRHealthCheckCompleted(ctx context.Context, checkID string, region string, status string) error {
	return events.GetEmitter().Emit(ctx, "dr.health.check.completed", "health_check", checkID, map[string]interface{}{
		"region": region,
		"status": status,
	})
}
