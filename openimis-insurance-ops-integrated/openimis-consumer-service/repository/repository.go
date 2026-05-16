package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"openimis-consumer-service/config"
	"openimis-consumer-service/metrics"

	_ "github.com/lib/pq"
)

// Repository handles database operations for OpenIMIS.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(cfg *config.Config) (*Repository, error) {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("error opening database: %w", err)
	}

	// Set connection pool parameters
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err = db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("error connecting to database: %w", err)
	}

	log.Println("Successfully connected to PostgreSQL database.")
	return &Repository{db: db}, nil
}

// Close closes the database connection.
func (r *Repository) Close() {
	r.db.Close()
}

// ClaimEvent is the structure of the event received from Kafka.
type ClaimEvent struct {
	ClaimID        string
	PolicyID       string
	EventType      string
	EventTimestamp int64
	ClaimAmount    float64
	LossRatio      float64
}

// UpdateLossRatioAndReserves updates the OpenIMIS records based on the claim event.
// This is a simplified mock of the complex OpenIMIS database logic.
func (r *Repository) UpdateLossRatioAndReserves(ctx context.Context, event ClaimEvent) error {
	// Extract trace ID for structured logging
	traceID := ctx.Value("X-Request-ID")
	if traceID == nil {
		traceID = "no-trace-id"
	}

	// Start a transaction for atomicity
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		metrics.DBErrors.WithLabelValues("UpdateLossRatioAndReserves").Inc()
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		} else if err != nil {
			tx.Rollback()
		} else {
			err = tx.Commit()
			if err != nil {
				metrics.DBErrors.WithLabelValues("UpdateLossRatioAndReserves").Inc()
				log.Printf("TRACE_ID=%v | Failed to commit transaction: %v", traceID, err)
			}
		}
	}()

	// 1. Update Loss Ratio (Mock: update a policy's loss ratio in a mock table)
	// In a real OpenIMIS, this would involve complex aggregation logic.
	updateLossRatioSQL := `
		INSERT INTO policy_metrics (policy_id, current_loss_ratio, last_updated)
		VALUES ($1, $2, NOW())
		ON CONFLICT (policy_id) DO UPDATE
		SET current_loss_ratio = $2, last_updated = NOW();
	`
	_, err = tx.ExecContext(ctx, updateLossRatioSQL, event.PolicyID, event.LossRatio)
	if err != nil {
		metrics.DBErrors.WithLabelValues("UpdateLossRatio").Inc()
		return fmt.Errorf("failed to update loss ratio for policy %s: %w", event.PolicyID, err)
	}
	log.Printf("TRACE_ID=%v | Updated loss ratio for policy %s to %.4f", traceID, event.PolicyID, event.LossRatio)

	// 2. Update Reserves (Mock: update a reserve amount based on claim status)
	// Only update reserves if the claim is PAID or APPROVED (pending payment).
	if event.EventType == "PAID" || event.EventType == "APPROVED" {
		reserveChange := event.ClaimAmount
		if event.EventType == "PAID" {
			// If paid, the reserve is released (or reduced by the paid amount)
			reserveChange = -event.ClaimAmount
		}

		updateReserveSQL := `
			INSERT INTO financial_reserves (policy_id, reserve_amount, last_updated)
			VALUES ($1, $2, NOW())
			ON CONFLICT (policy_id) DO UPDATE
			SET reserve_amount = financial_reserves.reserve_amount + $2, last_updated = NOW();
		`
		_, err = tx.ExecContext(ctx, updateReserveSQL, event.PolicyID, reserveChange)
		if err != nil {
			metrics.DBErrors.WithLabelValues("UpdateReserves").Inc()
			return fmt.Errorf("failed to update reserves for policy %s: %w", event.PolicyID, err)
		}
		log.Printf("TRACE_ID=%v | Updated reserves for policy %s by %.2f due to event %s", traceID, event.PolicyID, reserveChange, event.EventType)
	}

	// 3. Log the claim event in OpenIMIS (Mock: log to a claim_events_log table)
	logEventSQL := `
		INSERT INTO claim_events_log (claim_id, policy_id, event_type, event_timestamp, loss_ratio)
		VALUES ($1, $2, $3, $4, $5);
	`
	_, err = tx.ExecContext(ctx, logEventSQL, event.ClaimID, event.PolicyID, event.EventType, time.UnixMilli(event.EventTimestamp), event.LossRatio)
	if err != nil {
		metrics.DBErrors.WithLabelValues("LogClaimEvent").Inc()
		return fmt.Errorf("failed to log claim event: %w", err)
	}
	log.Printf("TRACE_ID=%v | Logged claim event %s for claim %s", traceID, event.EventType, event.ClaimID)

	return nil
}

// MockMigration creates the necessary mock tables for the OpenIMIS database.
func (r *Repository) MockMigration(ctx context.Context) error {
	log.Println("Running mock database migration...")
	migrationSQL := `
	CREATE TABLE IF NOT EXISTS policy_metrics (
		policy_id VARCHAR(255) PRIMARY KEY,
		current_loss_ratio DOUBLE PRECISION NOT NULL,
		last_updated TIMESTAMP WITH TIME ZONE NOT NULL
	);

	CREATE TABLE IF NOT EXISTS financial_reserves (
		policy_id VARCHAR(255) PRIMARY KEY,
		reserve_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
		last_updated TIMESTAMP WITH TIME ZONE NOT NULL
	);

	CREATE TABLE IF NOT EXISTS claim_events_log (
		id SERIAL PRIMARY KEY,
		claim_id VARCHAR(255) NOT NULL,
		policy_id VARCHAR(255) NOT NULL,
		event_type VARCHAR(50) NOT NULL,
		event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
		loss_ratio DOUBLE PRECISION NOT NULL
	);
	`
	_, err := r.db.ExecContext(ctx, migrationSQL)
	if err != nil {
		return fmt.Errorf("mock migration failed: %w", err)
	}
	log.Println("Mock database migration completed successfully.")
	return nil
}
