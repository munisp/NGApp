package export

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("export-service")
}

func EmitExportStarted(ctx context.Context, exportID string, exportType string, format string, userID string) error {
	return events.GetEmitter().Emit(ctx, "export.started", "export", exportID, map[string]interface{}{
		"export_type": exportType,
		"format":      format,
		"user_id":     userID,
	})
}

func EmitExportCompleted(ctx context.Context, exportID string, exportType string, recordCount int, fileSize int64, downloadURL string) error {
	return events.GetEmitter().Emit(ctx, "export.completed", "export", exportID, map[string]interface{}{
		"export_type":  exportType,
		"record_count": recordCount,
		"file_size":    fileSize,
		"download_url": downloadURL,
	})
}

func EmitExportFailed(ctx context.Context, exportID string, exportType string, errorMessage string) error {
	return events.GetEmitter().Emit(ctx, "export.failed", "export", exportID, map[string]interface{}{
		"export_type":   exportType,
		"error_message": errorMessage,
	})
}
