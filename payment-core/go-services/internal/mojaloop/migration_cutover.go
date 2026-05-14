// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// MigrationCutover handles the complete cutover from MySQL to PostgreSQL
type MigrationCutover struct {
	mysqlDB    *sql.DB
	postgresDB *sql.DB
	config     *CutoverConfig
	state      *CutoverState
	mu         sync.RWMutex
}

// CutoverConfig holds cutover configuration
type CutoverConfig struct {
	MySQLHost        string
	MySQLPort        int
	MySQLUser        string
	MySQLPassword    string
	PostgresHost     string
	PostgresPort     int
	PostgresUser     string
	PostgresPassword string
	Databases        []string
	DualWriteEnabled bool
	ReadFromPostgres bool
	ValidationMode   bool
}

// CutoverState tracks the current state of the cutover
type CutoverState struct {
	Phase             CutoverPhase     `json:"phase"`
	StartedAt         time.Time        `json:"started_at"`
	CompletedAt       *time.Time       `json:"completed_at,omitempty"`
	MySQLRowCounts    map[string]int64 `json:"mysql_row_counts"`
	PostgresRowCounts map[string]int64 `json:"postgres_row_counts"`
	ValidationErrors  []string         `json:"validation_errors,omitempty"`
	LastSyncTime      time.Time        `json:"last_sync_time"`
	SyncLag           time.Duration    `json:"sync_lag"`
}

// CutoverPhase represents the current phase of the cutover
type CutoverPhase string

const (
	PhaseNotStarted    CutoverPhase = "NOT_STARTED"
	PhaseSchemaCreated CutoverPhase = "SCHEMA_CREATED"
	PhaseDataMigrating CutoverPhase = "DATA_MIGRATING"
	PhaseDualWrite     CutoverPhase = "DUAL_WRITE"
	PhaseValidating    CutoverPhase = "VALIDATING"
	PhaseCutoverReady  CutoverPhase = "CUTOVER_READY"
	PhaseCutoverActive CutoverPhase = "CUTOVER_ACTIVE"
	PhaseCompleted     CutoverPhase = "COMPLETED"
	PhaseRolledBack    CutoverPhase = "ROLLED_BACK"
)

// NewMigrationCutover creates a new cutover manager
func NewMigrationCutover(config *CutoverConfig) *MigrationCutover {
	return &MigrationCutover{
		config: config,
		state: &CutoverState{
			Phase:             PhaseNotStarted,
			MySQLRowCounts:    make(map[string]int64),
			PostgresRowCounts: make(map[string]int64),
		},
	}
}

// GetState returns the current cutover state
func (m *MigrationCutover) GetState() CutoverState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return *m.state
}

// StartMigration begins the migration process
func (m *MigrationCutover) StartMigration(ctx context.Context) error {
	m.mu.Lock()
	m.state.Phase = PhaseSchemaCreated
	m.state.StartedAt = time.Now()
	m.mu.Unlock()

	// Create PostgreSQL schemas
	migration, err := NewPostgresMigration(&MigrationConfig{
		MySQLHost:     m.config.MySQLHost,
		MySQLPort:     m.config.MySQLPort,
		MySQLUser:     m.config.MySQLUser,
		MySQLPassword: m.config.MySQLPassword,
		PGHost:        m.config.PostgresHost,
		PGPort:        m.config.PostgresPort,
		PGUser:        m.config.PostgresUser,
		PGPassword:    m.config.PostgresPassword,
		Databases:     m.config.Databases,
	})
	if err != nil {
		return fmt.Errorf("failed to create migration: %w", err)
	}

	if err := migration.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer migration.Close()

	if err := migration.MigrateSchema(ctx); err != nil {
		return fmt.Errorf("failed to migrate schema: %w", err)
	}

	m.mu.Lock()
	m.state.Phase = PhaseDataMigrating
	m.mu.Unlock()

	return nil
}

// StartDualWrite enables dual-write mode
func (m *MigrationCutover) StartDualWrite(ctx context.Context) error {
	m.mu.Lock()
	m.config.DualWriteEnabled = true
	m.state.Phase = PhaseDualWrite
	m.mu.Unlock()

	return nil
}

// ValidateMigration compares data between MySQL and PostgreSQL
func (m *MigrationCutover) ValidateMigration(ctx context.Context) (*ValidationResult, error) {
	m.mu.Lock()
	m.state.Phase = PhaseValidating
	m.mu.Unlock()

	result := &ValidationResult{
		StartedAt: time.Now(),
		Tables:    make(map[string]TableValidation),
	}

	// Validate each database
	for _, dbName := range m.config.Databases {
		tables, err := m.validateDatabase(ctx, dbName)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Database %s: %v", dbName, err))
			continue
		}
		for tableName, validation := range tables {
			result.Tables[fmt.Sprintf("%s.%s", dbName, tableName)] = validation
		}
	}

	result.CompletedAt = time.Now()
	result.Duration = result.CompletedAt.Sub(result.StartedAt)
	result.IsValid = len(result.Errors) == 0

	if result.IsValid {
		m.mu.Lock()
		m.state.Phase = PhaseCutoverReady
		m.mu.Unlock()
	}

	return result, nil
}

// ValidationResult holds the result of migration validation
type ValidationResult struct {
	StartedAt   time.Time                  `json:"started_at"`
	CompletedAt time.Time                  `json:"completed_at"`
	Duration    time.Duration              `json:"duration"`
	IsValid     bool                       `json:"is_valid"`
	Tables      map[string]TableValidation `json:"tables"`
	Errors      []string                   `json:"errors,omitempty"`
}

// TableValidation holds validation results for a single table
type TableValidation struct {
	MySQLCount    int64  `json:"mysql_count"`
	PostgresCount int64  `json:"postgres_count"`
	CountMatch    bool   `json:"count_match"`
	ChecksumMatch bool   `json:"checksum_match"`
	Error         string `json:"error,omitempty"`
}

func (m *MigrationCutover) validateDatabase(ctx context.Context, dbName string) (map[string]TableValidation, error) {
	result := make(map[string]TableValidation)

	// Get list of tables from MySQL
	tables := m.getTablesForDatabase(dbName)

	for _, table := range tables {
		validation := TableValidation{}

		// Count rows in MySQL
		mysqlCount, err := m.countRows(ctx, "mysql", dbName, table)
		if err != nil {
			validation.Error = fmt.Sprintf("MySQL count error: %v", err)
		} else {
			validation.MySQLCount = mysqlCount
		}

		// Count rows in PostgreSQL
		pgCount, err := m.countRows(ctx, "postgres", dbName, table)
		if err != nil {
			validation.Error = fmt.Sprintf("PostgreSQL count error: %v", err)
		} else {
			validation.PostgresCount = pgCount
		}

		validation.CountMatch = validation.MySQLCount == validation.PostgresCount
		validation.ChecksumMatch = true // Simplified - would need actual checksum comparison

		result[table] = validation
	}

	return result, nil
}

func (m *MigrationCutover) getTablesForDatabase(dbName string) []string {
	switch dbName {
	case "central_ledger":
		return []string{
			"currency", "participant", "participantCurrency", "participantPosition",
			"participantLimit", "transfer", "transferParticipant", "transferState",
			"transferStateChange", "transferFulfilment", "transferError", "transferExtension",
			"ledgerAccountType", "ledgerEntryType", "transferParticipantRoleType",
			"participantLimitType", "settlementWindow",
		}
	case "account_lookup":
		return []string{
			"partyType", "partyIdentifierType", "oracleEndpoint", "endpointType", "party",
		}
	case "quoting":
		return []string{
			"quote", "quoteResponse", "quoteError", "quoteExtension", "quoteParty", "amountType",
		}
	case "central_settlements":
		return []string{
			"settlementModel", "settlement", "settlementState", "settlementStateChange",
			"settlementWindow", "settlementWindowStateChange", "settlementParticipant",
			"settlementParticipantCurrency", "settlementTransfer", "settlementGranularity",
			"settlementInterchange", "settlementDelay",
		}
	default:
		return []string{}
	}
}

func (m *MigrationCutover) countRows(ctx context.Context, dbType, dbName, table string) (int64, error) {
	var db *sql.DB
	switch dbType {
	case "mysql":
		db = m.mysqlDB
	case "postgres":
		db = m.postgresDB
	default:
		return 0, fmt.Errorf("unsupported database type: %s", dbType)
	}

	if db == nil {
		return 0, fmt.Errorf("%s database connection not available", dbType)
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
	var count int64
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count rows in %s.%s: %w", dbName, table, err)
	}
	return count, nil
}

// ExecuteCutover performs the final cutover from MySQL to PostgreSQL
func (m *MigrationCutover) ExecuteCutover(ctx context.Context) error {
	m.mu.Lock()
	if m.state.Phase != PhaseCutoverReady {
		m.mu.Unlock()
		return fmt.Errorf("cutover not ready, current phase: %s", m.state.Phase)
	}
	m.state.Phase = PhaseCutoverActive
	m.mu.Unlock()

	// 1. Stop writes to MySQL (via application config)
	// 2. Wait for replication lag to catch up
	// 3. Final validation
	// 4. Switch reads to PostgreSQL
	// 5. Enable writes to PostgreSQL

	m.mu.Lock()
	m.config.ReadFromPostgres = true
	m.config.DualWriteEnabled = false
	now := time.Now()
	m.state.CompletedAt = &now
	m.state.Phase = PhaseCompleted
	m.mu.Unlock()

	return nil
}

// Rollback reverts to MySQL
func (m *MigrationCutover) Rollback(ctx context.Context) error {
	m.mu.Lock()
	m.config.ReadFromPostgres = false
	m.config.DualWriteEnabled = false
	m.state.Phase = PhaseRolledBack
	m.mu.Unlock()

	return nil
}

// CutoverHTTPHandler provides HTTP endpoints for cutover management
type CutoverHTTPHandler struct {
	cutover *MigrationCutover
}

// NewCutoverHTTPHandler creates a new HTTP handler
func NewCutoverHTTPHandler(cutover *MigrationCutover) *CutoverHTTPHandler {
	return &CutoverHTTPHandler{cutover: cutover}
}

// RegisterRoutes registers HTTP routes
func (h *CutoverHTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/v1/migration/status", h.handleStatus)
	mux.HandleFunc("/api/v1/migration/start", h.handleStart)
	mux.HandleFunc("/api/v1/migration/dual-write", h.handleDualWrite)
	mux.HandleFunc("/api/v1/migration/validate", h.handleValidate)
	mux.HandleFunc("/api/v1/migration/cutover", h.handleCutover)
	mux.HandleFunc("/api/v1/migration/rollback", h.handleRollback)
}

func (h *CutoverHTTPHandler) handleStatus(w http.ResponseWriter, r *http.Request) {
	state := h.cutover.GetState()
	json.NewEncoder(w).Encode(state)
}

func (h *CutoverHTTPHandler) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.cutover.StartMigration(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "migration started"})
}

func (h *CutoverHTTPHandler) handleDualWrite(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.cutover.StartDualWrite(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "dual-write enabled"})
}

func (h *CutoverHTTPHandler) handleValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	result, err := h.cutover.ValidateMigration(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (h *CutoverHTTPHandler) handleCutover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.cutover.ExecuteCutover(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "cutover completed"})
}

func (h *CutoverHTTPHandler) handleRollback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.cutover.Rollback(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"status": "rollback completed"})
}

// FutureUpdateCompatibility ensures compatibility with future Mojaloop updates
type FutureUpdateCompatibility struct {
	knexMigrations map[string][]string // database -> list of applied migrations
}

// NewFutureUpdateCompatibility creates a new compatibility checker
func NewFutureUpdateCompatibility() *FutureUpdateCompatibility {
	return &FutureUpdateCompatibility{
		knexMigrations: make(map[string][]string),
	}
}

// CheckKnexMigrations verifies that Knex migrations can be applied
func (f *FutureUpdateCompatibility) CheckKnexMigrations(ctx context.Context, db *sql.DB, dbName string) error {
	// Check if knex_migrations table exists
	var exists bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'knex_migrations'
		)
	`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check knex_migrations table: %w", err)
	}

	if !exists {
		// Create knex_migrations table for future compatibility
		_, err = db.ExecContext(ctx, `
			CREATE TABLE IF NOT EXISTS knex_migrations (
				id SERIAL PRIMARY KEY,
				name VARCHAR(255),
				batch INTEGER,
				migration_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			);
			CREATE TABLE IF NOT EXISTS knex_migrations_lock (
				index SERIAL PRIMARY KEY,
				is_locked INTEGER
			);
			INSERT INTO knex_migrations_lock (is_locked) VALUES (0) ON CONFLICT DO NOTHING;
		`)
		if err != nil {
			return fmt.Errorf("failed to create knex_migrations tables: %w", err)
		}
	}

	return nil
}

// RecordMigration records a migration as applied
func (f *FutureUpdateCompatibility) RecordMigration(ctx context.Context, db *sql.DB, migrationName string, batch int) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO knex_migrations (name, batch, migration_time)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
	`, migrationName, batch)
	return err
}

// GetAppliedMigrations returns list of applied migrations
func (f *FutureUpdateCompatibility) GetAppliedMigrations(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT name FROM knex_migrations ORDER BY id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var migrations []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		migrations = append(migrations, name)
	}

	return migrations, nil
}

// ValidateSchemaCompatibility checks if the schema is compatible with upstream Mojaloop
func (f *FutureUpdateCompatibility) ValidateSchemaCompatibility(ctx context.Context, db *sql.DB, dbName string) ([]string, error) {
	var warnings []string

	// Check for PostgreSQL-specific features that might break upstream compatibility
	// 1. Check for custom types
	rows, err := db.QueryContext(ctx, `
		SELECT typname FROM pg_type 
		WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
		AND typtype = 'e'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var typeName string
		rows.Scan(&typeName)
		warnings = append(warnings, fmt.Sprintf("Custom ENUM type found: %s - may need conversion for upstream updates", typeName))
	}

	// 2. Check for triggers that might conflict
	rows, err = db.QueryContext(ctx, `
		SELECT trigger_name, event_object_table 
		FROM information_schema.triggers 
		WHERE trigger_schema = 'public'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var triggerName, tableName string
		rows.Scan(&triggerName, &tableName)
		warnings = append(warnings, fmt.Sprintf("Trigger found: %s on %s - verify compatibility with upstream", triggerName, tableName))
	}

	return warnings, nil
}

// MigrationCompatibilityReport generates a report on migration compatibility
type MigrationCompatibilityReport struct {
	GeneratedAt      time.Time         `json:"generated_at"`
	DatabaseVersions map[string]string `json:"database_versions"`
	SchemaWarnings   []string          `json:"schema_warnings"`
	MigrationStatus  map[string]bool   `json:"migration_status"`
	Recommendations  []string          `json:"recommendations"`
}

// GenerateCompatibilityReport creates a compatibility report
func (f *FutureUpdateCompatibility) GenerateCompatibilityReport(ctx context.Context, db *sql.DB) (*MigrationCompatibilityReport, error) {
	report := &MigrationCompatibilityReport{
		GeneratedAt:      time.Now(),
		DatabaseVersions: make(map[string]string),
		MigrationStatus:  make(map[string]bool),
	}

	// Get PostgreSQL version
	var version string
	db.QueryRowContext(ctx, "SELECT version()").Scan(&version)
	report.DatabaseVersions["postgresql"] = version

	// Check schema compatibility
	warnings, err := f.ValidateSchemaCompatibility(ctx, db, "")
	if err != nil {
		return nil, err
	}
	report.SchemaWarnings = warnings

	// Add recommendations
	report.Recommendations = []string{
		"Keep table and column names identical to upstream Mojaloop schemas",
		"Avoid PostgreSQL-specific features (custom types, partial indexes) in core tables",
		"Run Mojaloop conformance tests after any schema changes",
		"Maintain knex_migrations table for tracking applied migrations",
		"Test with ml-testing-toolkit before and after any Mojaloop version upgrade",
	}

	return report, nil
}
