package actuarial

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // PostgreSQL driver
	"github.com/sirupsen/logrus"
)

// ActuarialModelUpdater handles the business logic for updating OpenIMIS actuarial models.
type ActuarialModelUpdater struct {
	db  *sql.DB
	log *logrus.Entry
}

// NewActuarialModelUpdater creates a new instance of the updater backed by PostgreSQL.
func NewActuarialModelUpdater(dbConnStr string, log *logrus.Entry) (*ActuarialModelUpdater, error) {
	db, err := sql.Open("pgx", dbConnStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open PostgreSQL connection: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}
	if err := ensureActuarialSchema(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to ensure actuarial schema: %w", err)
	}

	return &ActuarialModelUpdater{
		db:  db,
		log: log,
	}, nil
}

// ensureActuarialSchema creates required tables if they do not exist.
func ensureActuarialSchema(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS actuarial_model_log (
			id              BIGSERIAL PRIMARY KEY,
			policy_id       VARCHAR(64)    NOT NULL,
			event_type      VARCHAR(32)    NOT NULL,
			risk_score      NUMERIC(10,4)  NOT NULL DEFAULT 0,
			reserve_change  NUMERIC(18,4)  NOT NULL DEFAULT 0,
			reserve_balance NUMERIC(18,4)  NOT NULL DEFAULT 0,
			processed_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
			trace_id        VARCHAR(128)
		);
		CREATE INDEX IF NOT EXISTS idx_aml_policy_id ON actuarial_model_log(policy_id);
		CREATE TABLE IF NOT EXISTS policy_reserve (
			policy_id       VARCHAR(64)    PRIMARY KEY,
			reserve_balance NUMERIC(18,4)  NOT NULL DEFAULT 0,
			last_updated    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
		);
	`)
	return err
}

// UpdateModel processes a PolicyEvent and updates the actuarial model in PostgreSQL.
func (a *ActuarialModelUpdater) UpdateModel(ctx context.Context, event PolicyEvent) error {
	traceID, _ := ctx.Value("trace_id").(string)
	logEntry := a.log.WithFields(logrus.Fields{
		"policy_id":  event.PolicyID,
		"event_type": event.EventType,
		"trace_id":   traceID,
	})
	logEntry.Info("Processing policy event to update actuarial model...")

	reserveChange := a.calculateReserveChange(event)

	tx, err := a.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	var newBalance float64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO policy_reserve (policy_id, reserve_balance, last_updated)
		VALUES ($1, $2, NOW())
		ON CONFLICT (policy_id) DO UPDATE
		  SET reserve_balance = policy_reserve.reserve_balance + $2,
		      last_updated    = NOW()
		RETURNING reserve_balance
	`, event.PolicyID, reserveChange).Scan(&newBalance)
	if err != nil {
		return fmt.Errorf("upsert policy reserve: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO actuarial_model_log
		  (policy_id, event_type, risk_score, reserve_change, reserve_balance, trace_id)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, event.PolicyID, string(event.EventType),
		event.PolicyData.ActuarialMetadata.RiskScore,
		reserveChange, newBalance, traceID)
	if err != nil {
		return fmt.Errorf("insert actuarial log: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit actuarial transaction: %w", err)
	}

	logEntry.WithFields(logrus.Fields{
		"risk_score":      event.PolicyData.ActuarialMetadata.RiskScore,
		"reserve_change":  reserveChange,
		"reserve_balance": newBalance,
	}).Info("Actuarial model updated successfully.")
	return nil
}

// calculateReserveChange returns the signed reserve delta for the given event.
func (a *ActuarialModelUpdater) calculateReserveChange(event PolicyEvent) float64 {
	required := event.PolicyData.ActuarialMetadata.ReserveRequired
	switch event.EventType {
	case PolicyEventTypeCREATED:
		return required
	case PolicyEventTypeRENEWED:
		return required * 0.10
	case PolicyEventTypeCANCELLED:
		return -required
	case PolicyEventTypeLAPSED:
		return -(required * 0.90)
	default:
		return 0
	}
}

// Close closes the database connection.
func (a *ActuarialModelUpdater) Close() {
	if a.db != nil {
		a.db.Close()
	}
}
