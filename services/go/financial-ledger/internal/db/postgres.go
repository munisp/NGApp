// Package db provides PostgreSQL storage for financial audit trails.
// TigerBeetle is the source of truth for balances; PostgreSQL stores
// enriched metadata, royalty schedules, and payment history.
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
	config.MaxConns = 20
	config.MinConns = 3

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("pool creation failed: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("PostgreSQL ping failed: %w", err)
	}
	return pool, nil
}

// RunMigrations creates the financial schema in PostgreSQL.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "financial_accounts",
			sql: `
CREATE TABLE IF NOT EXISTS financial_accounts (
    account_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tb_account_id   BIGINT NOT NULL UNIQUE,  -- TigerBeetle account ID
    well_id         UUID,
    operator_id     UUID,
    account_type    VARCHAR(50) NOT NULL
                        CHECK (account_type IN ('WELL_INVENTORY', 'RESERVOIR_ASSET',
                                                'REVENUE', 'ROYALTY_LIABILITY',
                                                'TAX_LIABILITY', 'PARTNER_SHARE')),
    ledger          INTEGER NOT NULL,        -- 1=Production, 2=USD
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_well ON financial_accounts(well_id);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_tb   ON financial_accounts(tb_account_id);`,
		},
		{
			name: "production_records",
			sql: `
CREATE TABLE IF NOT EXISTS production_records (
    record_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id             UUID NOT NULL,
    production_date     DATE NOT NULL,
    oil_barrels         NUMERIC(12,3) NOT NULL DEFAULT 0,
    gas_mcf             NUMERIC(12,3) NOT NULL DEFAULT 0,
    water_barrels       NUMERIC(12,3) NOT NULL DEFAULT 0,
    oil_price_usd       NUMERIC(10,2),
    gross_revenue_cents BIGINT DEFAULT 0,
    tb_transfer_id      BIGINT,             -- TigerBeetle transfer reference
    verified            BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by         VARCHAR(255),
    verified_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(well_id, production_date)
);
CREATE INDEX IF NOT EXISTS idx_prod_records_well ON production_records(well_id);
CREATE INDEX IF NOT EXISTS idx_prod_records_date ON production_records(production_date DESC);`,
		},
		{
			name: "royalty_schedules",
			sql: `
CREATE TABLE IF NOT EXISTS royalty_schedules (
    schedule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id             UUID NOT NULL,
    owner_name          VARCHAR(255) NOT NULL,
    owner_msisdn        VARCHAR(50),
    owner_fsp           VARCHAR(100),
    tb_account_id       BIGINT,
    royalty_percentage  NUMERIC(5,4) NOT NULL CHECK (royalty_percentage > 0 AND royalty_percentage <= 1),
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_royalty_well ON royalty_schedules(well_id);`,
		},
		{
			name: "payment_history",
			sql: `
CREATE TABLE IF NOT EXISTS payment_history (
    payment_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    well_id             UUID NOT NULL,
    schedule_id         UUID REFERENCES royalty_schedules(schedule_id),
    amount_cents        BIGINT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    mojaloop_tx_id      VARCHAR(255),
    mojaloop_quote_id   VARCHAR(255),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'QUOTED', 'TRANSFERRED', 'SETTLED', 'FAILED')),
    initiated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at          TIMESTAMPTZ,
    error_message       TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_well   ON payment_history(well_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_history(status);`,
		},
	}

	for _, m := range migrations {
		slog.Info("running financial migration", "name", m.name)
		if _, err := pool.Exec(ctx, m.sql); err != nil {
			return fmt.Errorf("migration %q failed: %w", m.name, err)
		}
	}
	slog.Info("financial migrations completed")
	return nil
}
