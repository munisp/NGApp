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
		CREATE TABLE IF NOT EXISTS mdm_golden_records (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			entity_type VARCHAR(50) NOT NULL,
			name VARCHAR(500) NOT NULL,
			bvn VARCHAR(20),
			nin VARCHAR(20),
			phone VARCHAR(20),
			email VARCHAR(255),
			address TEXT,
			date_of_birth DATE,
			source_systems TEXT[],
			confidence_score DECIMAL(5,4) DEFAULT 0,
			quality_score DECIMAL(5,4) DEFAULT 0,
			attributes JSONB DEFAULT '{}',
			merged_from UUID[],
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS mdm_dedup_candidates (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			record_a UUID NOT NULL,
			record_b UUID NOT NULL,
			match_score DECIMAL(5,4) NOT NULL,
			match_fields TEXT[],
			status VARCHAR(20) DEFAULT 'pending',
			reviewed_by VARCHAR(255),
			reviewed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS mdm_quality_rules (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			domain VARCHAR(50) NOT NULL,
			field VARCHAR(100) NOT NULL,
			rule_type VARCHAR(50) NOT NULL,
			rule_definition JSONB NOT NULL,
			severity VARCHAR(20) DEFAULT 'warning',
			active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS mdm_data_lineage (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			entity_id UUID NOT NULL,
			source_system VARCHAR(100) NOT NULL,
			source_id VARCHAR(255) NOT NULL,
			field_name VARCHAR(100),
			field_value TEXT,
			action VARCHAR(20) NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_golden_bvn ON mdm_golden_records(bvn) WHERE bvn IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_golden_nin ON mdm_golden_records(nin) WHERE nin IS NOT NULL;
		CREATE INDEX IF NOT EXISTS idx_golden_phone ON mdm_golden_records(phone);
		CREATE INDEX IF NOT EXISTS idx_golden_type ON mdm_golden_records(entity_type);
		CREATE INDEX IF NOT EXISTS idx_dedup_status ON mdm_dedup_candidates(status);
		CREATE INDEX IF NOT EXISTS idx_lineage_entity ON mdm_data_lineage(entity_id, timestamp DESC);
	`)
	return err
}
