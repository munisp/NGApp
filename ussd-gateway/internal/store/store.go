package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(ctx context.Context, connString string) (*Store, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}
	config.MaxConns = 30
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

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS ussd_sessions (
			id VARCHAR(100) PRIMARY KEY,
			phone_number VARCHAR(20) NOT NULL,
			service_code VARCHAR(20) DEFAULT '*919#',
			current_menu VARCHAR(50),
			state VARCHAR(20) DEFAULT 'active',
			data JSONB DEFAULT '{}',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			ended_at TIMESTAMPTZ,
			duration_seconds INT DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS ussd_transactions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			session_id VARCHAR(100) REFERENCES ussd_sessions(id),
			phone_number VARCHAR(20) NOT NULL,
			transaction_type VARCHAR(50) NOT NULL,
			product VARCHAR(100),
			amount DECIMAL(18,2) DEFAULT 0,
			status VARCHAR(20) DEFAULT 'pending',
			reference VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS ussd_analytics_daily (
			date DATE NOT NULL,
			state VARCHAR(50),
			total_sessions INT DEFAULT 0,
			unique_users INT DEFAULT 0,
			completed INT DEFAULT 0,
			abandoned INT DEFAULT 0,
			purchases INT DEFAULT 0,
			revenue DECIMAL(18,2) DEFAULT 0,
			PRIMARY KEY (date, state)
		);

		CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone ON ussd_sessions(phone_number);
		CREATE INDEX IF NOT EXISTS idx_ussd_sessions_state ON ussd_sessions(state, started_at DESC);
		CREATE INDEX IF NOT EXISTS idx_ussd_transactions_phone ON ussd_transactions(phone_number, created_at DESC);
	`)
	return err
}

func (s *Store) RecordSession(ctx context.Context, sessionID, phone, serviceCode string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO ussd_sessions (id, phone_number, service_code, current_menu, state)
		VALUES ($1, $2, $3, 'main', 'active')
		ON CONFLICT (id) DO NOTHING
	`, sessionID, phone, serviceCode)
	return err
}

func (s *Store) EndSession(ctx context.Context, sessionID string, duration int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE ussd_sessions SET state = 'completed', ended_at = NOW(), duration_seconds = $2
		WHERE id = $1
	`, sessionID, duration)
	return err
}

type DailyStats struct {
	Date          time.Time `json:"date"`
	TotalSessions int       `json:"total_sessions"`
	UniqueUsers   int       `json:"unique_users"`
	Completed     int       `json:"completed"`
	Abandoned     int       `json:"abandoned"`
}

func (s *Store) GetDailyStats(ctx context.Context, date time.Time) (*DailyStats, error) {
	var stats DailyStats
	err := s.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_sessions), 0), COALESCE(SUM(unique_users), 0),
		       COALESCE(SUM(completed), 0), COALESCE(SUM(abandoned), 0)
		FROM ussd_analytics_daily WHERE date = $1
	`, date).Scan(&stats.TotalSessions, &stats.UniqueUsers, &stats.Completed, &stats.Abandoned)
	stats.Date = date
	return &stats, err
}
