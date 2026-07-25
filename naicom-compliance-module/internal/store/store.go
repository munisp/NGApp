package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type QuarterlyReturn struct {
	ID              string    `json:"id"`
	Period          string    `json:"period"` // e.g., "2026-Q2"
	Type            string    `json:"type"`   // quarterly, annual
	Status          string    `json:"status"` // draft, submitted, accepted, rejected
	GrossWrittenPremium float64 `json:"gross_written_premium"`
	NetPremium      float64   `json:"net_premium"`
	ClaimsIncurred  float64   `json:"claims_incurred"`
	ClaimsPaid      float64   `json:"claims_paid"`
	ReinsuranceCeded float64  `json:"reinsurance_ceded"`
	InvestmentIncome float64  `json:"investment_income"`
	SolvencyRatio   float64   `json:"solvency_ratio"`
	SubmittedAt     *time.Time `json:"submitted_at,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type SolvencyMetrics struct {
	ID              string    `json:"id"`
	TotalAssets     float64   `json:"total_assets"`
	TotalLiabilities float64  `json:"total_liabilities"`
	RequiredCapital float64   `json:"required_capital"`
	AvailableCapital float64  `json:"available_capital"`
	SolvencyRatio   float64   `json:"solvency_ratio"`
	MinimumRatio    float64   `json:"minimum_ratio"` // NAICOM minimum: 1.0
	Status          string    `json:"status"` // compliant, warning, breach
	CalculatedAt    time.Time `json:"calculated_at"`
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, connString string) (*Store, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}
	config.MaxConns = 20
	config.MinConns = 5

	pool, err := pgxpool.NewWithConfig(ctx, config)
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
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS naicom_quarterly_returns (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			period VARCHAR(20) NOT NULL,
			type VARCHAR(20) NOT NULL DEFAULT 'quarterly',
			status VARCHAR(20) NOT NULL DEFAULT 'draft',
			gross_written_premium DECIMAL(18,2) DEFAULT 0,
			net_premium DECIMAL(18,2) DEFAULT 0,
			claims_incurred DECIMAL(18,2) DEFAULT 0,
			claims_paid DECIMAL(18,2) DEFAULT 0,
			reinsurance_ceded DECIMAL(18,2) DEFAULT 0,
			investment_income DECIMAL(18,2) DEFAULT 0,
			solvency_ratio DECIMAL(8,4) DEFAULT 0,
			report_data JSONB DEFAULT '{}',
			submitted_at TIMESTAMPTZ,
			naicom_reference VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS naicom_solvency_metrics (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			total_assets DECIMAL(18,2) NOT NULL,
			total_liabilities DECIMAL(18,2) NOT NULL,
			required_capital DECIMAL(18,2) NOT NULL,
			available_capital DECIMAL(18,2) NOT NULL,
			solvency_ratio DECIMAL(8,4) NOT NULL,
			minimum_ratio DECIMAL(8,4) NOT NULL DEFAULT 1.0,
			status VARCHAR(20) NOT NULL DEFAULT 'compliant',
			calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS naicom_filing_deadlines (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			filing_type VARCHAR(100) NOT NULL,
			description TEXT,
			deadline TIMESTAMPTZ NOT NULL,
			status VARCHAR(20) DEFAULT 'pending',
			submitted_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS naicom_compliance_directives (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			directive_code VARCHAR(50) NOT NULL,
			title VARCHAR(500) NOT NULL,
			description TEXT,
			category VARCHAR(100),
			compliance_status VARCHAR(20) DEFAULT 'pending',
			evidence TEXT,
			last_reviewed TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_returns_period ON naicom_quarterly_returns(period);
		CREATE INDEX IF NOT EXISTS idx_solvency_date ON naicom_solvency_metrics(calculated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_deadlines_date ON naicom_filing_deadlines(deadline);
	`)
	return err
}

func (s *Store) GetLatestSolvency(ctx context.Context) (*SolvencyMetrics, error) {
	var m SolvencyMetrics
	err := s.pool.QueryRow(ctx, `
		SELECT id, total_assets, total_liabilities, required_capital, available_capital,
		       solvency_ratio, minimum_ratio, status, calculated_at
		FROM naicom_solvency_metrics ORDER BY calculated_at DESC LIMIT 1
	`).Scan(&m.ID, &m.TotalAssets, &m.TotalLiabilities, &m.RequiredCapital,
		&m.AvailableCapital, &m.SolvencyRatio, &m.MinimumRatio, &m.Status, &m.CalculatedAt)
	return &m, err
}

func (s *Store) InsertReturn(ctx context.Context, ret *QuarterlyReturn) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO naicom_quarterly_returns (period, type, status, gross_written_premium, net_premium,
			claims_incurred, claims_paid, reinsurance_ceded, investment_income, solvency_ratio)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, ret.Period, ret.Type, ret.Status, ret.GrossWrittenPremium, ret.NetPremium,
		ret.ClaimsIncurred, ret.ClaimsPaid, ret.ReinsuranceCeded, ret.InvestmentIncome, ret.SolvencyRatio)
	return err
}

func (s *Store) InsertSolvencyMetric(ctx context.Context, m *SolvencyMetrics) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO naicom_solvency_metrics (total_assets, total_liabilities, required_capital, 
			available_capital, solvency_ratio, minimum_ratio, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, m.TotalAssets, m.TotalLiabilities, m.RequiredCapital, m.AvailableCapital,
		m.SolvencyRatio, m.MinimumRatio, m.Status)
	return err
}
