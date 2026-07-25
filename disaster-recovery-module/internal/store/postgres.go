package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type FailoverEvent struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // failover, rollback, test
	Status      string    `json:"status"` // initiated, in_progress, completed, failed
	InitiatedBy string    `json:"initiated_by"`
	SourceRegion string   `json:"source_region"`
	TargetRegion string   `json:"target_region"`
	RTOActual   int       `json:"rto_actual_seconds"`
	RPOActual   int       `json:"rpo_actual_seconds"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	Details     string    `json:"details"`
}

type HealthStatus struct {
	Service     string    `json:"service"`
	Region      string    `json:"region"`
	Status      string    `json:"status"` // healthy, degraded, down
	Latency     int64     `json:"latency_ms"`
	LastChecked time.Time `json:"last_checked"`
	Details     string    `json:"details"`
}

type BCPPlan struct {
	ID            string    `json:"id"`
	Version       string    `json:"version"`
	RTOTarget     int       `json:"rto_target_seconds"` // <4 hours = 14400
	RPOTarget     int       `json:"rpo_target_seconds"` // <1 hour = 3600
	LastTested    time.Time `json:"last_tested"`
	NextTestDue   time.Time `json:"next_test_due"`
	ApprovedBy    string    `json:"approved_by"`
	NAICOMStatus  string    `json:"naicom_status"` // compliant, non_compliant, pending_review
}

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, connString string) (*PostgresStore, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}
	config.MaxConns = 20
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

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

	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) Close() {
	s.pool.Close()
}

func (s *PostgresStore) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS dr_failover_events (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			type VARCHAR(50) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'initiated',
			initiated_by VARCHAR(255) NOT NULL,
			source_region VARCHAR(100) NOT NULL,
			target_region VARCHAR(100) NOT NULL,
			rto_actual_seconds INT DEFAULT 0,
			rpo_actual_seconds INT DEFAULT 0,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ,
			details JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS dr_health_status (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			service VARCHAR(255) NOT NULL,
			region VARCHAR(100) NOT NULL,
			status VARCHAR(50) NOT NULL,
			latency_ms BIGINT DEFAULT 0,
			last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			details JSONB DEFAULT '{}',
			UNIQUE(service, region)
		);

		CREATE TABLE IF NOT EXISTS dr_bcp_plans (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			version VARCHAR(50) NOT NULL,
			rto_target_seconds INT NOT NULL DEFAULT 14400,
			rpo_target_seconds INT NOT NULL DEFAULT 3600,
			last_tested TIMESTAMPTZ,
			next_test_due TIMESTAMPTZ,
			approved_by VARCHAR(255),
			naicom_status VARCHAR(50) DEFAULT 'pending_review',
			plan_document JSONB DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS dr_incident_log (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			severity VARCHAR(20) NOT NULL,
			title VARCHAR(500) NOT NULL,
			description TEXT,
			affected_services TEXT[],
			region VARCHAR(100),
			naicom_notified BOOLEAN DEFAULT FALSE,
			naicom_notification_time TIMESTAMPTZ,
			resolution_time TIMESTAMPTZ,
			root_cause TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_failover_events_status ON dr_failover_events(status);
		CREATE INDEX IF NOT EXISTS idx_failover_events_started ON dr_failover_events(started_at DESC);
		CREATE INDEX IF NOT EXISTS idx_health_status_service ON dr_health_status(service, region);
		CREATE INDEX IF NOT EXISTS idx_incident_log_severity ON dr_incident_log(severity, created_at DESC);
	`)
	return err
}

func (s *PostgresStore) RecordFailoverEvent(ctx context.Context, event *FailoverEvent) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO dr_failover_events (type, status, initiated_by, source_region, target_region, details)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, event.Type, event.Status, event.InitiatedBy, event.SourceRegion, event.TargetRegion, event.Details)
	return err
}

func (s *PostgresStore) UpdateFailoverStatus(ctx context.Context, id, status string, rtoActual, rpoActual int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dr_failover_events 
		SET status = $2, rto_actual_seconds = $3, rpo_actual_seconds = $4, completed_at = NOW()
		WHERE id = $1
	`, id, status, rtoActual, rpoActual)
	return err
}

func (s *PostgresStore) GetRecentFailovers(ctx context.Context, limit int) ([]FailoverEvent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, type, status, initiated_by, source_region, target_region, 
		       rto_actual_seconds, rpo_actual_seconds, started_at, completed_at
		FROM dr_failover_events ORDER BY started_at DESC LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []FailoverEvent
	for rows.Next() {
		var e FailoverEvent
		if err := rows.Scan(&e.ID, &e.Type, &e.Status, &e.InitiatedBy,
			&e.SourceRegion, &e.TargetRegion, &e.RTOActual, &e.RPOActual,
			&e.StartedAt, &e.CompletedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

func (s *PostgresStore) UpsertHealthStatus(ctx context.Context, hs *HealthStatus) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO dr_health_status (service, region, status, latency_ms, last_checked, details)
		VALUES ($1, $2, $3, $4, NOW(), $5)
		ON CONFLICT (service, region) DO UPDATE SET
			status = EXCLUDED.status,
			latency_ms = EXCLUDED.latency_ms,
			last_checked = NOW(),
			details = EXCLUDED.details
	`, hs.Service, hs.Region, hs.Status, hs.Latency, hs.Details)
	return err
}

func (s *PostgresStore) GetAllHealthStatuses(ctx context.Context) ([]HealthStatus, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT service, region, status, latency_ms, last_checked, details
		FROM dr_health_status ORDER BY service, region
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var statuses []HealthStatus
	for rows.Next() {
		var hs HealthStatus
		if err := rows.Scan(&hs.Service, &hs.Region, &hs.Status, &hs.Latency, &hs.LastChecked, &hs.Details); err != nil {
			return nil, err
		}
		statuses = append(statuses, hs)
	}
	return statuses, nil
}

func (s *PostgresStore) GetBCPPlan(ctx context.Context) (*BCPPlan, error) {
	var plan BCPPlan
	err := s.pool.QueryRow(ctx, `
		SELECT id, version, rto_target_seconds, rpo_target_seconds, 
		       last_tested, next_test_due, approved_by, naicom_status
		FROM dr_bcp_plans ORDER BY created_at DESC LIMIT 1
	`).Scan(&plan.ID, &plan.Version, &plan.RTOTarget, &plan.RPOTarget,
		&plan.LastTested, &plan.NextTestDue, &plan.ApprovedBy, &plan.NAICOMStatus)
	if err != nil {
		return nil, err
	}
	return &plan, nil
}
