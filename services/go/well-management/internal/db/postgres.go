// Package db provides PostgreSQL connection pooling and schema migrations.
// Uses pgx/v5 — the high-performance PostgreSQL driver for Go.
// All relational storage is PostgreSQL; no MySQL or TiDB.
package db

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool creates a pgx connection pool with sensible defaults.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("invalid DSN: %w", err)
	}
	config.MaxConns = 25
	config.MinConns = 5

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("pool creation failed: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("PostgreSQL ping failed: %w", err)
	}
	return pool, nil
}

// RunMigrations executes the DDL migrations to create the well management schema.
// Uses idempotent CREATE TABLE IF NOT EXISTS statements.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "create_operators",
			sql: `
CREATE TABLE IF NOT EXISTS operators (
    operator_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    country       VARCHAR(100),
    contact_email VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operators_name ON operators(name);`,
		},
		{
			name: "create_wells",
			sql: `
CREATE TABLE IF NOT EXISTS wells (
    well_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    api_number  VARCHAR(50) UNIQUE,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    depth_ft    DOUBLE PRECISION,
    formation   VARCHAR(255),
    operator_id UUID NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'SHUT_IN', 'ABANDONED', 'DRILLING', 'TESTING')),
    well_type   VARCHAR(20) NOT NULL DEFAULT 'OIL'
                    CHECK (well_type IN ('OIL', 'GAS', 'WATER_INJECTION', 'DISPOSAL')),
    spud_date   DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wells_operator   ON wells(operator_id);
CREATE INDEX IF NOT EXISTS idx_wells_status     ON wells(status);
CREATE INDEX IF NOT EXISTS idx_wells_location   ON wells(latitude, longitude);`,
		},
		{
			name: "create_equipment",
			sql: `
CREATE TABLE IF NOT EXISTS equipment (
    equipment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id        UUID NOT NULL REFERENCES wells(well_id) ON DELETE CASCADE,
    type           VARCHAR(100) NOT NULL,
    model          VARCHAR(255),
    serial_number  VARCHAR(100),
    manufacturer   VARCHAR(255),
    install_date   DATE,
    status         VARCHAR(20) NOT NULL DEFAULT 'OPERATIONAL'
                       CHECK (status IN ('OPERATIONAL', 'DEGRADED', 'FAILED', 'MAINTENANCE')),
    last_service   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipment_well   ON equipment(well_id);
CREATE INDEX IF NOT EXISTS idx_equipment_type   ON equipment(type);`,
		},
		{
			name: "create_well_events",
			sql: `
CREATE TABLE IF NOT EXISTS well_events (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id     UUID NOT NULL REFERENCES wells(well_id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    description TEXT,
    operator_id UUID REFERENCES operators(operator_id),
    created_by  VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_well_events_well ON well_events(well_id);
CREATE INDEX IF NOT EXISTS idx_well_events_time ON well_events(created_at DESC);`,
		},
		{
			name: "create_updated_at_trigger",
			sql: `
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wells_updated_at') THEN
        CREATE TRIGGER update_wells_updated_at
            BEFORE UPDATE ON wells
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_operators_updated_at') THEN
        CREATE TRIGGER update_operators_updated_at
            BEFORE UPDATE ON operators
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;`,
		},
	}

	for _, m := range migrations {
		slog.Info("running migration", "name", m.name)
		if _, err := pool.Exec(ctx, m.sql); err != nil {
			return fmt.Errorf("migration %q failed: %w", m.name, err)
		}
	}
	slog.Info("all migrations completed successfully")
	return nil
}
