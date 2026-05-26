package database

import (
	"context"
	"github.com/payment-switch/go-services/internal/events"
)

func init() {
	events.InitializeEmitter("database-service")
}

func EmitDatabaseMigrationCompleted(ctx context.Context, migrationID string, version string, direction string) error {
	return events.GetEmitter().Emit(ctx, "database.migration.completed", "migration", migrationID, map[string]interface{}{
		"version":   version,
		"direction": direction,
	})
}

func EmitDatabaseBackupCompleted(ctx context.Context, backupID string, size int64, location string) error {
	return events.GetEmitter().Emit(ctx, "database.backup.completed", "backup", backupID, map[string]interface{}{
		"size":     size,
		"location": location,
	})
}
