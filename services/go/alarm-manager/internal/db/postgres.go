// Package db provides PostgreSQL storage for the Alarm Manager.
// Implements ISA-18.2 alarm state machine: UNACKNOWLEDGED → ACKNOWLEDGED → RESOLVED.
// PostgreSQL exclusively — no MySQL or TiDB.
package db

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool creates a pgx connection pool.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("invalid DSN: %w", err)
	}
	config.MaxConns = 15
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping failed: %w", err)
	}
	return pool, nil
}

// RunMigrations creates the alarm management schema.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "alarm_rules",
			sql: `
CREATE TABLE IF NOT EXISTS alarm_rules (
    rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id         UUID,                    -- NULL = applies to all wells
    sensor_type     VARCHAR(50) NOT NULL,
    condition       VARCHAR(20) NOT NULL     -- GT, LT, EQ, GTE, LTE
                        CHECK (condition IN ('GT', 'LT', 'EQ', 'GTE', 'LTE')),
    threshold       DOUBLE PRECISION NOT NULL,
    severity        INTEGER NOT NULL         -- ISA-18.2: 1=Critical, 2=High, 3=Medium, 4=Low
                        CHECK (severity BETWEEN 1 AND 4),
    message_template TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    dead_band       DOUBLE PRECISION DEFAULT 0,  -- Hysteresis to prevent alarm chattering
    delay_seconds   INTEGER DEFAULT 0,           -- Delay before alarming
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarm_rules_well   ON alarm_rules(well_id);
CREATE INDEX IF NOT EXISTS idx_alarm_rules_sensor ON alarm_rules(sensor_type);`,
		},
		{
			name: "alarms",
			sql: `
CREATE TABLE IF NOT EXISTS alarms (
    alarm_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id         UUID NOT NULL,
    rule_id         UUID REFERENCES alarm_rules(rule_id),
    sensor_type     VARCHAR(50),
    severity        INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 4),
    severity_label  VARCHAR(20) GENERATED ALWAYS AS (
                        CASE severity
                            WHEN 1 THEN 'CRITICAL'
                            WHEN 2 THEN 'HIGH'
                            WHEN 3 THEN 'MEDIUM'
                            WHEN 4 THEN 'LOW'
                        END
                    ) STORED,
    message         TEXT NOT NULL,
    value           DOUBLE PRECISION,
    threshold       DOUBLE PRECISION,
    state           VARCHAR(20) NOT NULL DEFAULT 'UNACKNOWLEDGED'
                        CHECK (state IN ('UNACKNOWLEDGED', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED')),
    tenant_id       UUID,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMPTZ,
    resolved_by     VARCHAR(255),
    resolved_at     TIMESTAMPTZ,
    temporal_wf_id  VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alarms_well     ON alarms(well_id);
CREATE INDEX IF NOT EXISTS idx_alarms_state    ON alarms(state);
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity);
CREATE INDEX IF NOT EXISTS idx_alarms_time     ON alarms(created_at DESC);

-- Partial index for active alarms (most common query)
CREATE INDEX IF NOT EXISTS idx_alarms_active ON alarms(created_at DESC)
    WHERE state IN ('UNACKNOWLEDGED', 'ACKNOWLEDGED');`,
		},
		{
			name: "alarm_notifications",
			sql: `
CREATE TABLE IF NOT EXISTS alarm_notifications (
    notif_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alarm_id        UUID NOT NULL REFERENCES alarms(alarm_id),
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PUSH', 'PAGERDUTY', 'WEBHOOK')),
    recipient       VARCHAR(255) NOT NULL,
    sent_at         TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    error_message   TEXT
);
CREATE INDEX IF NOT EXISTS idx_notif_alarm ON alarm_notifications(alarm_id);`,
		},
	}

	for _, m := range migrations {
		slog.Info("running alarm migration", "name", m.name)
		if _, err := pool.Exec(ctx, m.sql); err != nil {
			return fmt.Errorf("migration %q failed: %w", m.name, err)
		}
	}
	slog.Info("alarm migrations completed")
	return nil
}
