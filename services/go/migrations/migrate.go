// Package migrations provides golang-migrate integration for OG-RMM Go services.
// Each Go service that owns database tables should call RunMigrations() at startup.
//
// Migration files follow the naming convention:
//   {version}_{description}.up.sql   — forward migration
//   {version}_{description}.down.sql — rollback migration
//
// Example: 000001_create_telemetry_table.up.sql
//
// Usage:
//   if err := migrations.RunMigrations(db, "file://migrations/sql"); err != nil {
//       log.Fatalf("migration failed: %v", err)
//   }
package migrations

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// RunMigrations applies all pending migrations from the given source path.
// sourcePath should be a file:// URI pointing to the directory containing .sql files.
// Example: "file://services/go/telemetry-ingestion/migrations/sql"
func RunMigrations(db *sql.DB, sourcePath string) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return fmt.Errorf("migrate: create driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(sourcePath, "postgres", driver)
	if err != nil {
		return fmt.Errorf("migrate: create instance: %w", err)
	}

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			log.Println("[Migrate] Schema is up to date — no migrations applied")
			return nil
		}
		return fmt.Errorf("migrate: apply migrations: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil {
		log.Printf("[Migrate] Could not get version: %v", err)
	} else {
		log.Printf("[Migrate] Applied migrations — now at version %d (dirty=%v)", version, dirty)
	}
	return nil
}

// RollbackOne rolls back the most recently applied migration.
func RollbackOne(db *sql.DB, sourcePath string) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return fmt.Errorf("migrate: create driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(sourcePath, "postgres", driver)
	if err != nil {
		return fmt.Errorf("migrate: create instance: %w", err)
	}

	if err := m.Steps(-1); err != nil {
		return fmt.Errorf("migrate: rollback: %w", err)
	}
	log.Println("[Migrate] Rolled back one migration")
	return nil
}

// ForceVersion forces the migration version without running migrations.
// Use only for emergency recovery when the dirty flag is set.
func ForceVersion(db *sql.DB, sourcePath string, version int) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return fmt.Errorf("migrate: create driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(sourcePath, "postgres", driver)
	if err != nil {
		return fmt.Errorf("migrate: create instance: %w", err)
	}

	if err := m.Force(version); err != nil {
		return fmt.Errorf("migrate: force version: %w", err)
	}
	log.Printf("[Migrate] Forced version to %d", version)
	return nil
}

// GetVersion returns the current migration version and dirty state.
func GetVersion(db *sql.DB, sourcePath string) (uint, bool, error) {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return 0, false, fmt.Errorf("migrate: create driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(sourcePath, "postgres", driver)
	if err != nil {
		return 0, false, fmt.Errorf("migrate: create instance: %w", err)
	}

	return m.Version()
}

// MigrationSourceFromEnv returns the migration source path from environment variables.
// Falls back to the provided default path if the env var is not set.
func MigrationSourceFromEnv(defaultPath string) string {
	if path := os.Getenv("MIGRATION_SOURCE_PATH"); path != "" {
		return path
	}
	return defaultPath
}
