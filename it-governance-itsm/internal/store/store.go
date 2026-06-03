package store

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, connString string) (*Store, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	if err := runMigrations(ctx, pool); err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS itsm_changes (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			title VARCHAR(500) NOT NULL,
			description TEXT,
			type VARCHAR(20) NOT NULL DEFAULT 'normal',
			priority VARCHAR(20) NOT NULL DEFAULT 'medium',
			category VARCHAR(100),
			requester VARCHAR(255),
			assignee VARCHAR(255),
			status VARCHAR(30) NOT NULL DEFAULT 'draft',
			risk_level VARCHAR(20) DEFAULT 'medium',
			impact VARCHAR(20) DEFAULT 'medium',
			rollback_plan TEXT,
			cab_required BOOLEAN DEFAULT FALSE,
			scheduled_at TIMESTAMPTZ,
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS itsm_incidents (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			title VARCHAR(500) NOT NULL,
			description TEXT,
			priority VARCHAR(5) NOT NULL DEFAULT 'P3',
			category VARCHAR(100),
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			assigned_to VARCHAR(255),
			reporter VARCHAR(255),
			sla_target_minutes INT,
			sla_breached BOOLEAN DEFAULT FALSE,
			affected_ci TEXT[],
			root_cause TEXT,
			resolution TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			resolved_at TIMESTAMPTZ,
			closed_at TIMESTAMPTZ
		);

		CREATE TABLE IF NOT EXISTS itsm_problems (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			title VARCHAR(500) NOT NULL,
			description TEXT,
			status VARCHAR(30) NOT NULL DEFAULT 'open',
			priority VARCHAR(20) DEFAULT 'medium',
			root_cause TEXT,
			workaround TEXT,
			related_incidents UUID[],
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			resolved_at TIMESTAMPTZ
		);

		CREATE TABLE IF NOT EXISTS itsm_assets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			type VARCHAR(100) NOT NULL,
			status VARCHAR(30) DEFAULT 'active',
			owner VARCHAR(255),
			location VARCHAR(255),
			ip_address VARCHAR(50),
			configuration JSONB DEFAULT '{}',
			relationships JSONB DEFAULT '[]',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS itsm_sla_definitions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			priority VARCHAR(5) NOT NULL,
			response_time_minutes INT NOT NULL,
			resolution_time_minutes INT NOT NULL,
			availability_target DECIMAL(5,2) DEFAULT 99.5,
			active BOOLEAN DEFAULT TRUE
		);

		CREATE TABLE IF NOT EXISTS itsm_cab_meetings (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			scheduled_at TIMESTAMPTZ NOT NULL,
			attendees TEXT[],
			agenda_items UUID[],
			minutes TEXT,
			status VARCHAR(20) DEFAULT 'scheduled'
		);

		CREATE INDEX IF NOT EXISTS idx_changes_status ON itsm_changes(status, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_incidents_status ON itsm_incidents(status, priority);
		CREATE INDEX IF NOT EXISTS idx_incidents_sla ON itsm_incidents(sla_breached, status);
		CREATE INDEX IF NOT EXISTS idx_problems_status ON itsm_problems(status);
		CREATE INDEX IF NOT EXISTS idx_assets_type ON itsm_assets(type, status);
	`)
	return err
}
