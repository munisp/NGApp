// Package onboarding provides PostgreSQL storage for onboarding data
package onboarding

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// PostgresConfig holds database configuration
type PostgresConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
}

// DefaultPostgresConfig returns default configuration from environment
func DefaultPostgresConfig() *PostgresConfig {
	return &PostgresConfig{
		Host:     getEnv("POSTGRES_HOST", "localhost"),
		Port:     5432,
		User:     getEnv("POSTGRES_USER", "onboarding"),
		Password: getEnv("POSTGRES_PASSWORD", "onboarding"),
		Database: getEnv("POSTGRES_DB", "onboarding"),
		SSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
	}
}

// PostgresStore implements persistent storage for onboarding
type PostgresStore struct {
	db *sql.DB
}

// NewPostgresStore creates a new PostgreSQL store
func NewPostgresStore(config *PostgresConfig) (*PostgresStore, error) {
	if config == nil {
		config = DefaultPostgresConfig()
	}

	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		config.Host, config.Port, config.User, config.Password, config.Database, config.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &PostgresStore{db: db}

	if err := store.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return store, nil
}

// migrate runs database migrations
func (s *PostgresStore) migrate() error {
	migrations := []string{
		// Cases table
		`CREATE TABLE IF NOT EXISTS onboarding_cases (
			id VARCHAR(50) PRIMARY KEY,
			stakeholder_type VARCHAR(50) NOT NULL,
			organization_name VARCHAR(255) NOT NULL,
			country VARCHAR(100) NOT NULL,
			contact_email VARCHAR(255) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
			assigned_reviewer VARCHAR(100),
			risk_score INTEGER DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			submitted_at TIMESTAMP WITH TIME ZONE,
			completed_at TIMESTAMP WITH TIME ZONE,
			metadata JSONB DEFAULT '{}'
		)`,

		// Requirements table
		`CREATE TABLE IF NOT EXISTS onboarding_requirements (
			id VARCHAR(50) PRIMARY KEY,
			case_id VARCHAR(50) NOT NULL REFERENCES onboarding_cases(id),
			name VARCHAR(255) NOT NULL,
			description TEXT,
			category VARCHAR(100) NOT NULL,
			mandatory BOOLEAN DEFAULT true,
			status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
			reviewed_by VARCHAR(100),
			reviewed_at TIMESTAMP WITH TIME ZONE,
			evidence_ids TEXT[],
			notes TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,

		// Technical profiles table
		`CREATE TABLE IF NOT EXISTS onboarding_technical_profiles (
			case_id VARCHAR(50) PRIMARY KEY REFERENCES onboarding_cases(id),
			api_endpoint VARCHAR(500),
			callback_url VARCHAR(500),
			ip_whitelist TEXT[],
			mtls_cert TEXT,
			mtls_key_hash VARCHAR(64),
			sandbox_client_id VARCHAR(100),
			sandbox_client_secret_hash VARCHAR(64),
			production_client_id VARCHAR(100),
			production_client_secret_hash VARCHAR(64),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,

		// Approvals table (for multi-party approval)
		`CREATE TABLE IF NOT EXISTS onboarding_approvals (
			id VARCHAR(50) PRIMARY KEY,
			case_id VARCHAR(50) NOT NULL REFERENCES onboarding_cases(id),
			action VARCHAR(100) NOT NULL,
			user_id VARCHAR(100) NOT NULL,
			username VARCHAR(100) NOT NULL,
			role VARCHAR(50) NOT NULL,
			approved BOOLEAN NOT NULL,
			reason TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(case_id, action, user_id)
		)`,

		// Audit log table (immutable)
		`CREATE TABLE IF NOT EXISTS onboarding_audit_log (
			id VARCHAR(50) PRIMARY KEY,
			case_id VARCHAR(50) NOT NULL,
			action VARCHAR(100) NOT NULL,
			user_id VARCHAR(100) NOT NULL,
			username VARCHAR(100) NOT NULL,
			role VARCHAR(50),
			details JSONB DEFAULT '{}',
			ip_address VARCHAR(45),
			user_agent TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,

		// Outbox table (for transactional events)
		`CREATE TABLE IF NOT EXISTS onboarding_outbox (
			id VARCHAR(50) PRIMARY KEY,
			aggregate_type VARCHAR(50) NOT NULL,
			aggregate_id VARCHAR(50) NOT NULL,
			event_type VARCHAR(100) NOT NULL,
			payload JSONB NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			published_at TIMESTAMP WITH TIME ZONE,
			retry_count INTEGER DEFAULT 0,
			last_error TEXT
		)`,

		// Provisioning records table
		`CREATE TABLE IF NOT EXISTS onboarding_provisioning (
			id VARCHAR(50) PRIMARY KEY,
			case_id VARCHAR(50) NOT NULL REFERENCES onboarding_cases(id),
			environment VARCHAR(20) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
			keycloak_client_id VARCHAR(100),
			apisix_route_id VARCHAR(100),
			apisix_upstream_id VARCHAR(100),
			tigerbeetle_account_id VARCHAR(100),
			error_message TEXT,
			started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			completed_at TIMESTAMP WITH TIME ZONE,
			rollback_at TIMESTAMP WITH TIME ZONE,
			UNIQUE(case_id, environment)
		)`,

		// Reviewer assignments table
		`CREATE TABLE IF NOT EXISTS onboarding_reviewer_assignments (
			id VARCHAR(50) PRIMARY KEY,
			case_id VARCHAR(50) NOT NULL REFERENCES onboarding_cases(id),
			reviewer_id VARCHAR(100) NOT NULL,
			reviewer_name VARCHAR(100) NOT NULL,
			assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			due_at TIMESTAMP WITH TIME ZONE,
			completed_at TIMESTAMP WITH TIME ZONE,
			sla_breached BOOLEAN DEFAULT false
		)`,

		// Indexes
		`CREATE INDEX IF NOT EXISTS idx_cases_status ON onboarding_cases(status)`,
		`CREATE INDEX IF NOT EXISTS idx_cases_stakeholder_type ON onboarding_cases(stakeholder_type)`,
		`CREATE INDEX IF NOT EXISTS idx_cases_assigned_reviewer ON onboarding_cases(assigned_reviewer)`,
		`CREATE INDEX IF NOT EXISTS idx_requirements_case_id ON onboarding_requirements(case_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON onboarding_audit_log(case_id)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON onboarding_audit_log(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_outbox_published_at ON onboarding_outbox(published_at) WHERE published_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_provisioning_case_id ON onboarding_provisioning(case_id)`,
	}

	for _, migration := range migrations {
		if _, err := s.db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}

// Close closes the database connection
func (s *PostgresStore) Close() error {
	return s.db.Close()
}

// CreateCase creates a new onboarding case
func (s *PostgresStore) CreateCase(ctx context.Context, c *OnboardingCase) error {
	metadata, _ := json.Marshal(c.Metadata)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_cases (id, stakeholder_type, organization_name, country, contact_email, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, c.ID, c.StakeholderType, c.OrganizationName, c.Country, c.ContactEmail, c.Status, metadata)

	return err
}

// GetCase retrieves a case by ID
func (s *PostgresStore) GetCase(ctx context.Context, id string) (*OnboardingCase, error) {
	var c OnboardingCase
	var metadata []byte
	var submittedAt, completedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, stakeholder_type, organization_name, country, contact_email, status, 
		       assigned_reviewer, risk_score, created_at, updated_at, submitted_at, completed_at, metadata
		FROM onboarding_cases WHERE id = $1
	`, id).Scan(
		&c.ID, &c.StakeholderType, &c.OrganizationName, &c.Country, &c.ContactEmail, &c.Status,
		&c.AssignedReviewer, &c.RiskScore, &c.CreatedAt, &c.UpdatedAt, &submittedAt, &completedAt, &metadata,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("case not found: %s", id)
	}
	if err != nil {
		return nil, err
	}

	if submittedAt.Valid {
		t := submittedAt.Time
		c.SubmittedAt = &t
	}
	if completedAt.Valid {
		t := completedAt.Time
		c.CompletedAt = &t
	}

	json.Unmarshal(metadata, &c.Metadata)

	// Load requirements
	reqs, _ := s.GetRequirements(ctx, id)
	for _, r := range reqs {
		c.Requirements = append(c.Requirements, *r)
	}

	// Load technical profile
	c.TechnicalProfile, _ = s.GetTechnicalProfile(ctx, id)

	return &c, nil
}

// UpdateCase updates a case
func (s *PostgresStore) UpdateCase(ctx context.Context, c *OnboardingCase) error {
	metadata, _ := json.Marshal(c.Metadata)

	_, err := s.db.ExecContext(ctx, `
		UPDATE onboarding_cases 
		SET status = $2, assigned_reviewer = $3, risk_score = $4, updated_at = NOW(), 
		    submitted_at = $5, completed_at = $6, metadata = $7
		WHERE id = $1
	`, c.ID, c.Status, c.AssignedReviewer, c.RiskScore, 
	   nullTime(c.SubmittedAt), nullTime(c.CompletedAt), metadata)

	return err
}

// ListCases lists cases with optional filters
func (s *PostgresStore) ListCases(ctx context.Context, filters map[string]string, limit, offset int) ([]*OnboardingCase, int, error) {
	query := `SELECT id, stakeholder_type, organization_name, country, contact_email, status, 
	                 assigned_reviewer, risk_score, created_at, updated_at
	          FROM onboarding_cases WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM onboarding_cases WHERE 1=1`
	
	var args []interface{}
	argNum := 1

	if status, ok := filters["status"]; ok && status != "" {
		query += fmt.Sprintf(" AND status = $%d", argNum)
		countQuery += fmt.Sprintf(" AND status = $%d", argNum)
		args = append(args, status)
		argNum++
	}

	if stakeholderType, ok := filters["stakeholder_type"]; ok && stakeholderType != "" {
		query += fmt.Sprintf(" AND stakeholder_type = $%d", argNum)
		countQuery += fmt.Sprintf(" AND stakeholder_type = $%d", argNum)
		args = append(args, stakeholderType)
		argNum++
	}

	if reviewer, ok := filters["assigned_reviewer"]; ok && reviewer != "" {
		query += fmt.Sprintf(" AND assigned_reviewer = $%d", argNum)
		countQuery += fmt.Sprintf(" AND assigned_reviewer = $%d", argNum)
		args = append(args, reviewer)
		argNum++
	}

	// Get total count
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add pagination
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var cases []*OnboardingCase
	for rows.Next() {
		var c OnboardingCase
		err := rows.Scan(
			&c.ID, &c.StakeholderType, &c.OrganizationName, &c.Country, &c.ContactEmail, &c.Status,
			&c.AssignedReviewer, &c.RiskScore, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		cases = append(cases, &c)
	}

	return cases, total, nil
}

// CreateRequirement creates a new requirement
func (s *PostgresStore) CreateRequirement(ctx context.Context, r *Requirement) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_requirements (id, case_id, name, description, category, mandatory, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, r.ID, r.CaseID, r.Name, r.Description, r.Category, r.Mandatory, r.Status)

	return err
}

// GetRequirements retrieves all requirements for a case
func (s *PostgresStore) GetRequirements(ctx context.Context, caseID string) ([]*Requirement, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, case_id, name, description, category, mandatory, status, 
		       reviewed_by, reviewed_at, evidence_ids, notes
		FROM onboarding_requirements WHERE case_id = $1
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requirements []*Requirement
	for rows.Next() {
		var r Requirement
		var reviewedAt sql.NullTime
		var evidenceIDs []string

		err := rows.Scan(
			&r.ID, &r.CaseID, &r.Name, &r.Description, &r.Category, &r.Mandatory, &r.Status,
			&r.ReviewedBy, &reviewedAt, &evidenceIDs, &r.Notes,
		)
		if err != nil {
			return nil, err
		}

		if reviewedAt.Valid {
			t := reviewedAt.Time
			r.ReviewedAt = &t
		}
		r.EvidenceIDs = evidenceIDs

		requirements = append(requirements, &r)
	}

	return requirements, nil
}

// UpdateRequirement updates a requirement
func (s *PostgresStore) UpdateRequirement(ctx context.Context, r *Requirement) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE onboarding_requirements 
		SET status = $2, reviewed_by = $3, reviewed_at = $4, evidence_ids = $5, notes = $6, updated_at = NOW()
		WHERE id = $1
	`, r.ID, r.Status, r.ReviewedBy, nullTime(r.ReviewedAt), r.EvidenceIDs, r.Notes)

	return err
}

// GetTechnicalProfile retrieves the technical profile for a case
func (s *PostgresStore) GetTechnicalProfile(ctx context.Context, caseID string) (*TechnicalProfile, error) {
	var tp TechnicalProfile
	var ipWhitelist []string

	err := s.db.QueryRowContext(ctx, `
		SELECT case_id, api_endpoint, callback_url, ip_whitelist, mtls_cert,
		       sandbox_client_id, production_client_id
		FROM onboarding_technical_profiles WHERE case_id = $1
	`, caseID).Scan(
		&tp.CaseID, &tp.APIEndpoint, &tp.CallbackURL, &ipWhitelist, &tp.MTLSCert,
		&tp.SandboxClientID, &tp.ProductionClientID,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	tp.IPWhitelist = ipWhitelist
	return &tp, nil
}

// SaveTechnicalProfile saves or updates a technical profile
func (s *PostgresStore) SaveTechnicalProfile(ctx context.Context, tp *TechnicalProfile) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_technical_profiles (case_id, api_endpoint, callback_url, ip_whitelist, mtls_cert)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (case_id) DO UPDATE SET
			api_endpoint = EXCLUDED.api_endpoint,
			callback_url = EXCLUDED.callback_url,
			ip_whitelist = EXCLUDED.ip_whitelist,
			mtls_cert = EXCLUDED.mtls_cert,
			updated_at = NOW()
	`, tp.CaseID, tp.APIEndpoint, tp.CallbackURL, tp.IPWhitelist, tp.MTLSCert)

	return err
}

// AddApproval adds an approval record
func (s *PostgresStore) AddApproval(ctx context.Context, record ApprovalRecord) error {
	if record.ID == "" {
		record.ID = uuid.New().String()
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_approvals (id, case_id, action, user_id, username, role, approved, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (case_id, action, user_id) DO UPDATE SET
			approved = EXCLUDED.approved,
			reason = EXCLUDED.reason
	`, record.ID, record.CaseID, record.Action, record.UserID, record.Username, record.Role, record.Approved, record.Reason)

	return err
}

// GetApprovals retrieves approvals for a case and action
func (s *PostgresStore) GetApprovals(ctx context.Context, caseID string, action string) ([]ApprovalRecord, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, case_id, action, user_id, username, role, approved, reason, created_at
		FROM onboarding_approvals WHERE case_id = $1 AND action = $2
	`, caseID, action)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var approvals []ApprovalRecord
	for rows.Next() {
		var a ApprovalRecord
		err := rows.Scan(&a.ID, &a.CaseID, &a.Action, &a.UserID, &a.Username, &a.Role, &a.Approved, &a.Reason, &a.Timestamp)
		if err != nil {
			return nil, err
		}
		approvals = append(approvals, a)
	}

	return approvals, nil
}

// AddAuditEntry adds an immutable audit log entry
func (s *PostgresStore) AddAuditEntry(ctx context.Context, entry AuditEntry) error {
	if entry.ID == "" {
		entry.ID = uuid.New().String()
	}

	details, _ := json.Marshal(entry.Details)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_audit_log (id, case_id, action, user_id, username, role, details, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, entry.ID, entry.CaseID, entry.Action, entry.UserID, entry.Username, entry.Role, details, entry.IPAddress, entry.UserAgent)

	return err
}

// GetCaseActions retrieves all actions for a case (for separation of duties)
func (s *PostgresStore) GetCaseActions(ctx context.Context, caseID string) ([]AuditEntry, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, case_id, action, user_id, username, role, details, ip_address, user_agent, created_at
		FROM onboarding_audit_log WHERE case_id = $1 ORDER BY created_at
	`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var details []byte
		err := rows.Scan(&e.ID, &e.CaseID, &e.Action, &e.UserID, &e.Username, &e.Role, &details, &e.IPAddress, &e.UserAgent, &e.Timestamp)
		if err != nil {
			return nil, err
		}
		json.Unmarshal(details, &e.Details)
		entries = append(entries, e)
	}

	return entries, nil
}

// AddOutboxEvent adds an event to the outbox for reliable publishing
func (s *PostgresStore) AddOutboxEvent(ctx context.Context, aggregateType, aggregateID, eventType string, payload interface{}) error {
	id := uuid.New().String()
	payloadJSON, _ := json.Marshal(payload)

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_outbox (id, aggregate_type, aggregate_id, event_type, payload)
		VALUES ($1, $2, $3, $4, $5)
	`, id, aggregateType, aggregateID, eventType, payloadJSON)

	return err
}

// GetUnpublishedEvents retrieves events that haven't been published yet
func (s *PostgresStore) GetUnpublishedEvents(ctx context.Context, limit int) ([]OutboxEvent, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, aggregate_type, aggregate_id, event_type, payload, created_at, retry_count
		FROM onboarding_outbox 
		WHERE published_at IS NULL AND retry_count < 5
		ORDER BY created_at
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []OutboxEvent
	for rows.Next() {
		var e OutboxEvent
		err := rows.Scan(&e.ID, &e.AggregateType, &e.AggregateID, &e.EventType, &e.Payload, &e.CreatedAt, &e.RetryCount)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}

	return events, nil
}

// MarkEventPublished marks an event as published
func (s *PostgresStore) MarkEventPublished(ctx context.Context, eventID string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE onboarding_outbox SET published_at = NOW() WHERE id = $1
	`, eventID)
	return err
}

// MarkEventFailed marks an event as failed with error
func (s *PostgresStore) MarkEventFailed(ctx context.Context, eventID string, errMsg string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE onboarding_outbox SET retry_count = retry_count + 1, last_error = $2 WHERE id = $1
	`, eventID, errMsg)
	return err
}

// OutboxEvent represents an event in the outbox
type OutboxEvent struct {
	ID            string          `json:"id"`
	AggregateType string          `json:"aggregate_type"`
	AggregateID   string          `json:"aggregate_id"`
	EventType     string          `json:"event_type"`
	Payload       json.RawMessage `json:"payload"`
	CreatedAt     time.Time       `json:"created_at"`
	PublishedAt   *time.Time      `json:"published_at"`
	RetryCount    int             `json:"retry_count"`
}

// SaveProvisioningRecord saves a provisioning record
func (s *PostgresStore) SaveProvisioningRecord(ctx context.Context, record *ProvisioningRecord) error {
	if record.ID == "" {
		record.ID = uuid.New().String()
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO onboarding_provisioning (id, case_id, environment, status, keycloak_client_id, 
		                                     apisix_route_id, apisix_upstream_id, tigerbeetle_account_id, error_message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (case_id, environment) DO UPDATE SET
			status = EXCLUDED.status,
			keycloak_client_id = EXCLUDED.keycloak_client_id,
			apisix_route_id = EXCLUDED.apisix_route_id,
			apisix_upstream_id = EXCLUDED.apisix_upstream_id,
			tigerbeetle_account_id = EXCLUDED.tigerbeetle_account_id,
			error_message = EXCLUDED.error_message,
			completed_at = CASE WHEN EXCLUDED.status IN ('COMPLETED', 'FAILED', 'ROLLED_BACK') THEN NOW() ELSE NULL END
	`, record.ID, record.CaseID, record.Environment, record.Status, record.KeycloakClientID,
	   record.APISIXRouteID, record.APISIXUpstreamID, record.TigerBeetleAccountID, record.ErrorMessage)

	return err
}

// GetProvisioningRecord retrieves a provisioning record
func (s *PostgresStore) GetProvisioningRecord(ctx context.Context, caseID, environment string) (*ProvisioningRecord, error) {
	var r ProvisioningRecord
	var completedAt, rollbackAt sql.NullTime

	err := s.db.QueryRowContext(ctx, `
		SELECT id, case_id, environment, status, keycloak_client_id, apisix_route_id, 
		       apisix_upstream_id, tigerbeetle_account_id, error_message, started_at, completed_at, rollback_at
		FROM onboarding_provisioning WHERE case_id = $1 AND environment = $2
	`, caseID, environment).Scan(
		&r.ID, &r.CaseID, &r.Environment, &r.Status, &r.KeycloakClientID, &r.APISIXRouteID,
		&r.APISIXUpstreamID, &r.TigerBeetleAccountID, &r.ErrorMessage, &r.StartedAt, &completedAt, &rollbackAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if completedAt.Valid {
		r.CompletedAt = completedAt.Time
	}
	if rollbackAt.Valid {
		r.RollbackAt = rollbackAt.Time
	}

	return &r, nil
}

// ProvisioningRecord represents a provisioning attempt
type ProvisioningRecord struct {
	ID                   string    `json:"id"`
	CaseID               string    `json:"case_id"`
	Environment          string    `json:"environment"`
	Status               string    `json:"status"`
	KeycloakClientID     string    `json:"keycloak_client_id"`
	APISIXRouteID        string    `json:"apisix_route_id"`
	APISIXUpstreamID     string    `json:"apisix_upstream_id"`
	TigerBeetleAccountID string    `json:"tigerbeetle_account_id"`
	ErrorMessage         string    `json:"error_message"`
	StartedAt            time.Time `json:"started_at"`
	CompletedAt          time.Time `json:"completed_at"`
	RollbackAt           time.Time `json:"rollback_at"`
}

// TechnicalProfile represents technical configuration for a participant

// Requirement represents an onboarding requirement

// Helper function to convert pointer time to null
func nullTime(t *time.Time) sql.NullTime {
	if t == nil || t.IsZero() {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

// WithTransaction executes a function within a transaction
func (s *PostgresStore) WithTransaction(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
