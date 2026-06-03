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
		CREATE TABLE IF NOT EXISTS api_products (
			id VARCHAR(100) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			version VARCHAR(20) DEFAULT 'v1',
			category VARCHAR(50),
			base_url VARCHAR(255),
			endpoints JSONB DEFAULT '[]',
			rate_limit INT DEFAULT 100,
			pricing JSONB DEFAULT '{}',
			status VARCHAR(20) DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS api_developers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			company VARCHAR(255),
			plan VARCHAR(50) DEFAULT 'free',
			status VARCHAR(20) DEFAULT 'active',
			joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS api_keys (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			developer_id UUID REFERENCES api_developers(id),
			key_hash VARCHAR(64) NOT NULL UNIQUE,
			key_prefix VARCHAR(20) NOT NULL,
			name VARCHAR(100),
			permissions TEXT[],
			rate_limit INT DEFAULT 100,
			status VARCHAR(20) DEFAULT 'active',
			last_used_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS api_subscriptions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			developer_id UUID REFERENCES api_developers(id),
			product_id VARCHAR(100) REFERENCES api_products(id),
			plan VARCHAR(50) DEFAULT 'free',
			status VARCHAR(20) DEFAULT 'active',
			subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS api_usage_daily (
			date DATE NOT NULL,
			developer_id UUID NOT NULL,
			product_id VARCHAR(100) NOT NULL,
			total_calls INT DEFAULT 0,
			successful_calls INT DEFAULT 0,
			failed_calls INT DEFAULT 0,
			avg_latency_ms DECIMAL(10,2) DEFAULT 0,
			total_data_bytes BIGINT DEFAULT 0,
			PRIMARY KEY (date, developer_id, product_id)
		);

		CREATE TABLE IF NOT EXISTS api_billing_invoices (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			developer_id UUID REFERENCES api_developers(id),
			period_start DATE NOT NULL,
			period_end DATE NOT NULL,
			total_calls INT DEFAULT 0,
			amount_ngn DECIMAL(18,2) DEFAULT 0,
			status VARCHAR(20) DEFAULT 'pending',
			tigerbeetle_transfer_id VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_api_keys_developer ON api_keys(developer_id);
		CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage_daily(date, developer_id);
		CREATE INDEX IF NOT EXISTS idx_api_subs_developer ON api_subscriptions(developer_id, status);
	`)
	return err
}
