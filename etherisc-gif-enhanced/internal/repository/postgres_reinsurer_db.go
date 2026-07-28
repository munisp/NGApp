package repository

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // PostgreSQL driver
	"reinsurer-api/internal/model"
)

// PostgresReinsurerDB is the production PostgreSQL-backed implementation of ReinsurerDB.
// It implements the same SaveQuote, SaveClaim, and GetReinsurerByAPIKey surface
// so that ReinsurerRepository can be wired to it without any other changes.
type PostgresReinsurerDB struct {
	db *sql.DB
}

// NewPostgresReinsurerDB opens a PostgreSQL connection, runs schema migrations,
// and returns a ready-to-use PostgresReinsurerDB.
func NewPostgresReinsurerDB(dsn string) (*PostgresReinsurerDB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	if err := migrateReinsurerSchema(db); err != nil {
		return nil, fmt.Errorf("migrate schema: %w", err)
	}
	return &PostgresReinsurerDB{db: db}, nil
}

// migrateReinsurerSchema creates the required tables if they do not exist.
func migrateReinsurerSchema(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS reinsurers (
			id          VARCHAR(64)  PRIMARY KEY,
			name        VARCHAR(255) NOT NULL,
			api_key     VARCHAR(255) NOT NULL UNIQUE,
			is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
			created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_reinsurers_api_key ON reinsurers(api_key);

		CREATE TABLE IF NOT EXISTS quote_submissions (
			quote_id         VARCHAR(64)   PRIMARY KEY,
			policy_id        VARCHAR(64)   NOT NULL,
			reinsurer_id     VARCHAR(64)   NOT NULL REFERENCES reinsurers(id),
			premium_share    NUMERIC(6,4)  NOT NULL,
			risk_share       NUMERIC(6,4)  NOT NULL,
			quote_amount     NUMERIC(18,4) NOT NULL,
			expiration_date  TIMESTAMPTZ   NOT NULL,
			status           VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
			created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS claim_notifications (
			claim_id          VARCHAR(64)   PRIMARY KEY,
			policy_id         VARCHAR(64)   NOT NULL,
			reinsurer_id      VARCHAR(64)   NOT NULL REFERENCES reinsurers(id),
			loss_amount       NUMERIC(18,4) NOT NULL,
			notification_date TIMESTAMPTZ   NOT NULL,
			status            VARCHAR(32)   NOT NULL DEFAULT 'OPEN',
			created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
		);
	`)
	return err
}

// SaveQuote persists a QuoteSubmission to PostgreSQL.
func (p *PostgresReinsurerDB) SaveQuote(quote model.QuoteSubmission) error {
	_, err := p.db.Exec(`
		INSERT INTO quote_submissions
		  (quote_id, policy_id, reinsurer_id, premium_share, risk_share, quote_amount, expiration_date, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (quote_id) DO UPDATE
		  SET status = EXCLUDED.status,
		      quote_amount = EXCLUDED.quote_amount
	`, quote.QuoteID, quote.PolicyID, quote.ReinsurerID,
		quote.PremiumShare, quote.RiskShare, quote.QuoteAmount,
		quote.ExpirationDate, quote.Status)
	if err != nil {
		return fmt.Errorf("save quote %s: %w", quote.QuoteID, err)
	}
	return nil
}

// SaveClaim persists a ClaimNotification to PostgreSQL.
func (p *PostgresReinsurerDB) SaveClaim(claim model.ClaimNotification) error {
	_, err := p.db.Exec(`
		INSERT INTO claim_notifications
		  (claim_id, policy_id, reinsurer_id, loss_amount, notification_date, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (claim_id) DO UPDATE
		  SET status = EXCLUDED.status,
		      loss_amount = EXCLUDED.loss_amount
	`, claim.ClaimID, claim.PolicyID, claim.ReinsurerID,
		claim.LossAmount, claim.NotificationDate, claim.Status)
	if err != nil {
		return fmt.Errorf("save claim %s: %w", claim.ClaimID, err)
	}
	return nil
}

// GetReinsurerByAPIKey retrieves a Reinsurer by their API key from PostgreSQL.
func (p *PostgresReinsurerDB) GetReinsurerByAPIKey(apiKey string) (*model.Reinsurer, error) {
	row := p.db.QueryRow(`
		SELECT id, name, api_key, is_active, created_at
		FROM reinsurers
		WHERE api_key = $1 AND is_active = TRUE
		LIMIT 1
	`, apiKey)

	var r model.Reinsurer
	if err := row.Scan(&r.ID, &r.Name, &r.APIKey, &r.IsActive, &r.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Not found — caller handles nil as unauthorized
		}
		return nil, fmt.Errorf("get reinsurer by api key: %w", err)
	}
	return &r, nil
}

// Close closes the underlying database connection pool.
func (p *PostgresReinsurerDB) Close() error {
	return p.db.Close()
}
