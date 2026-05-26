package audit

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("audit-service")
}

func EmitAuditLogCreated(ctx context.Context, logID string, action string, userID string, resourceType string, resourceID string) error {
	return events.GetEmitter().Emit(ctx, "audit.log.created", "audit_log", logID, map[string]interface{}{
		"action":        action,
		"user_id":       userID,
		"resource_type": resourceType,
		"resource_id":   resourceID,
	})
}

func EmitAuditExportCompleted(ctx context.Context, exportID string, recordCount int, format string) error {
	return events.GetEmitter().Emit(ctx, "audit.export.completed", "audit_export", exportID, map[string]interface{}{
		"record_count": recordCount,
		"format":       format,
	})
}
