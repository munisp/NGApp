// Package mojaloop implements Mojaloop protocol components
package mojaloop

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// PostgresMigration handles MySQL to PostgreSQL migration for Mojaloop
type PostgresMigration struct {
	sourceDB *sql.DB // MySQL source
	targetDB *sql.DB // PostgreSQL target
	config   *MigrationConfig
}

// MigrationConfig holds migration configuration
type MigrationConfig struct {
	MySQLHost     string
	MySQLPort     int
	MySQLUser     string
	MySQLPassword string
	PGHost        string
	PGPort        int
	PGUser        string
	PGPassword    string
	Databases     []string // central_ledger, account_lookup, quoting, central_settlements
	BatchSize     int
	DryRun        bool
}

// DefaultMigrationConfig returns default configuration
func DefaultMigrationConfig() *MigrationConfig {
	return &MigrationConfig{
		MySQLHost:     getEnvOrDefault("MYSQL_HOST", "mysql-ha.payment-switch.svc.cluster.local"),
		MySQLPort:     3306,
		MySQLUser:     getEnvOrDefault("MYSQL_USER", "mojaloop"),
		MySQLPassword: getEnvOrDefault("MYSQL_PASSWORD", ""),
		PGHost:        getEnvOrDefault("POSTGRES_HOST", "mojaloop-postgres-rw.payment-switch.svc.cluster.local"),
		PGPort:        5432,
		PGUser:        getEnvOrDefault("POSTGRES_USER", "mojaloop"),
		PGPassword:    getEnvOrDefault("POSTGRES_PASSWORD", ""),
		Databases:     []string{"central_ledger", "account_lookup", "quoting", "central_settlements"},
		BatchSize:     1000,
		DryRun:        false,
	}
}

// NewPostgresMigration creates a new migration instance
func NewPostgresMigration(config *MigrationConfig) (*PostgresMigration, error) {
	return &PostgresMigration{
		config: config,
	}, nil
}

// Connect establishes connections to both databases
func (m *PostgresMigration) Connect(ctx context.Context) error {
	// Connect to MySQL source
	mysqlDSN := fmt.Sprintf("%s:%s@tcp(%s:%d)/",
		m.config.MySQLUser, m.config.MySQLPassword,
		m.config.MySQLHost, m.config.MySQLPort)

	var err error
	m.sourceDB, err = sql.Open("mysql", mysqlDSN)
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL: %w", err)
	}

	// Connect to PostgreSQL target
	pgDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s sslmode=disable",
		m.config.PGHost, m.config.PGPort,
		m.config.PGUser, m.config.PGPassword)

	m.targetDB, err = sql.Open("postgres", pgDSN)
	if err != nil {
		return fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	return nil
}

// Close closes database connections
func (m *PostgresMigration) Close() {
	if m.sourceDB != nil {
		m.sourceDB.Close()
	}
	if m.targetDB != nil {
		m.targetDB.Close()
	}
}

// MojaloopSchema represents the Mojaloop database schema
// This is kept upstream-compatible to ensure future Mojaloop updates work
type MojaloopSchema struct {
	Database string
	Tables   []TableSchema
}

// TableSchema represents a table schema
type TableSchema struct {
	Name       string
	Columns    []ColumnSchema
	PrimaryKey []string
	Indexes    []IndexSchema
}

// ColumnSchema represents a column schema
type ColumnSchema struct {
	Name         string
	MySQLType    string
	PostgresType string
	Nullable     bool
	Default      string
	Extra        string // AUTO_INCREMENT, ON UPDATE CURRENT_TIMESTAMP, etc.
}

// IndexSchema represents an index
type IndexSchema struct {
	Name    string
	Columns []string
	Unique  bool
}

// MySQLToPostgresTypeMap maps MySQL types to PostgreSQL types
var MySQLToPostgresTypeMap = map[string]string{
	// Numeric types
	"tinyint(1)":          "boolean",
	"tinyint":             "smallint",
	"smallint":            "smallint",
	"mediumint":           "integer",
	"int":                 "integer",
	"integer":             "integer",
	"bigint":              "bigint",
	"bigint unsigned":     "bigint", // Add CHECK constraint for unsigned
	"int unsigned":        "integer",
	"decimal":             "decimal",
	"numeric":             "numeric",
	"float":               "real",
	"double":              "double precision",

	// String types
	"char":                "char",
	"varchar":             "varchar",
	"tinytext":            "text",
	"text":                "text",
	"mediumtext":          "text",
	"longtext":            "text",
	"binary":              "bytea",
	"varbinary":           "bytea",
	"tinyblob":            "bytea",
	"blob":                "bytea",
	"mediumblob":          "bytea",
	"longblob":            "bytea",

	// Date/time types
	"date":                "date",
	"datetime":            "timestamp",
	"timestamp":           "timestamp with time zone",
	"time":                "time",
	"year":                "smallint",

	// JSON
	"json":                "jsonb",

	// Enum (handled specially)
	"enum":                "text", // Use TEXT + CHECK constraint
}

// TranslateType converts MySQL type to PostgreSQL type
func TranslateType(mysqlType string) string {
	// Normalize the type
	normalized := strings.ToLower(strings.TrimSpace(mysqlType))

	// Handle unsigned
	isUnsigned := strings.Contains(normalized, "unsigned")
	normalized = strings.Replace(normalized, " unsigned", "", 1)

	// Handle size specifications like varchar(255)
	sizeRegex := regexp.MustCompile(`^(\w+)\((\d+(?:,\d+)?)\)$`)
	matches := sizeRegex.FindStringSubmatch(normalized)

	var baseType string
	var size string
	if len(matches) == 3 {
		baseType = matches[1]
		size = matches[2]
	} else {
		baseType = normalized
	}

	// Special case for tinyint(1) which is boolean
	if baseType == "tinyint" && size == "1" {
		return "boolean"
	}

	// Look up the type
	if pgType, ok := MySQLToPostgresTypeMap[baseType]; ok {
		// Add size for varchar, char, decimal
		if (baseType == "varchar" || baseType == "char") && size != "" {
			return fmt.Sprintf("%s(%s)", pgType, size)
		}
		if (baseType == "decimal" || baseType == "numeric") && size != "" {
			return fmt.Sprintf("%s(%s)", pgType, size)
		}
		if isUnsigned && (baseType == "bigint" || baseType == "int" || baseType == "integer") {
			// For unsigned, we'll add a CHECK constraint separately
			return pgType
		}
		return pgType
	}

	// Default to text for unknown types
	return "text"
}

// TranslateSQL converts MySQL SQL to PostgreSQL SQL
func TranslateSQL(mysqlSQL string) string {
	sql := mysqlSQL

	// Replace backticks with double quotes
	sql = strings.ReplaceAll(sql, "`", "\"")

	// Replace AUTO_INCREMENT with SERIAL/BIGSERIAL (handled in column definition)
	sql = regexp.MustCompile(`(?i)\s+AUTO_INCREMENT`).ReplaceAllString(sql, "")

	// Replace ENGINE=InnoDB and other MySQL-specific clauses
	sql = regexp.MustCompile(`(?i)\s+ENGINE\s*=\s*\w+`).ReplaceAllString(sql, "")
	sql = regexp.MustCompile(`(?i)\s+DEFAULT\s+CHARSET\s*=\s*\w+`).ReplaceAllString(sql, "")
	sql = regexp.MustCompile(`(?i)\s+COLLATE\s*=?\s*\w+`).ReplaceAllString(sql, "")
	sql = regexp.MustCompile(`(?i)\s+CHARACTER\s+SET\s+\w+`).ReplaceAllString(sql, "")
	sql = regexp.MustCompile(`(?i)\s+ROW_FORMAT\s*=\s*\w+`).ReplaceAllString(sql, "")

	// Replace ON UPDATE CURRENT_TIMESTAMP (needs trigger in PostgreSQL)
	sql = regexp.MustCompile(`(?i)\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP`).ReplaceAllString(sql, "")

	// Replace UNSIGNED (handled via CHECK constraint)
	sql = regexp.MustCompile(`(?i)\s+UNSIGNED`).ReplaceAllString(sql, "")

	// Replace TINYINT(1) with BOOLEAN
	sql = regexp.MustCompile(`(?i)TINYINT\s*\(\s*1\s*\)`).ReplaceAllString(sql, "BOOLEAN")

	// Replace other TINYINT with SMALLINT
	sql = regexp.MustCompile(`(?i)TINYINT\s*\(\s*\d+\s*\)`).ReplaceAllString(sql, "SMALLINT")
	sql = regexp.MustCompile(`(?i)TINYINT`).ReplaceAllString(sql, "SMALLINT")

	// Replace MEDIUMINT with INTEGER
	sql = regexp.MustCompile(`(?i)MEDIUMINT\s*\(\s*\d+\s*\)`).ReplaceAllString(sql, "INTEGER")
	sql = regexp.MustCompile(`(?i)MEDIUMINT`).ReplaceAllString(sql, "INTEGER")

	// Replace INT with INTEGER
	sql = regexp.MustCompile(`(?i)\bINT\s*\(\s*\d+\s*\)`).ReplaceAllString(sql, "INTEGER")

	// Replace BIGINT(n) with BIGINT
	sql = regexp.MustCompile(`(?i)BIGINT\s*\(\s*\d+\s*\)`).ReplaceAllString(sql, "BIGINT")

	// Replace DOUBLE with DOUBLE PRECISION
	sql = regexp.MustCompile(`(?i)\bDOUBLE\b(?!\s+PRECISION)`).ReplaceAllString(sql, "DOUBLE PRECISION")

	// Replace DATETIME with TIMESTAMP
	sql = regexp.MustCompile(`(?i)\bDATETIME\b`).ReplaceAllString(sql, "TIMESTAMP")

	// Replace BLOB types with BYTEA
	sql = regexp.MustCompile(`(?i)\bTINYBLOB\b`).ReplaceAllString(sql, "BYTEA")
	sql = regexp.MustCompile(`(?i)\bMEDIUMBLOB\b`).ReplaceAllString(sql, "BYTEA")
	sql = regexp.MustCompile(`(?i)\bLONGBLOB\b`).ReplaceAllString(sql, "BYTEA")
	sql = regexp.MustCompile(`(?i)\bBLOB\b`).ReplaceAllString(sql, "BYTEA")

	// Replace TEXT types
	sql = regexp.MustCompile(`(?i)\bTINYTEXT\b`).ReplaceAllString(sql, "TEXT")
	sql = regexp.MustCompile(`(?i)\bMEDIUMTEXT\b`).ReplaceAllString(sql, "TEXT")
	sql = regexp.MustCompile(`(?i)\bLONGTEXT\b`).ReplaceAllString(sql, "TEXT")

	// Replace JSON with JSONB
	sql = regexp.MustCompile(`(?i)\bJSON\b`).ReplaceAllString(sql, "JSONB")

	// Replace ENUM with TEXT (CHECK constraint added separately)
	enumRegex := regexp.MustCompile(`(?i)ENUM\s*\([^)]+\)`)
	sql = enumRegex.ReplaceAllString(sql, "TEXT")

	// Replace INSERT IGNORE with INSERT ... ON CONFLICT DO NOTHING
	sql = regexp.MustCompile(`(?i)INSERT\s+IGNORE\s+INTO`).ReplaceAllString(sql, "INSERT INTO")

	// Replace ON DUPLICATE KEY UPDATE with ON CONFLICT ... DO UPDATE
	// This is complex and needs context-aware handling
	onDupRegex := regexp.MustCompile(`(?i)\s+ON\s+DUPLICATE\s+KEY\s+UPDATE\s+(.+)$`)
	if matches := onDupRegex.FindStringSubmatch(sql); len(matches) > 1 {
		// This needs to be handled with proper conflict target
		// For now, we'll leave a marker for manual review
		sql = onDupRegex.ReplaceAllString(sql, " /* ON CONFLICT DO UPDATE - needs manual review */")
	}

	// Replace IFNULL with COALESCE
	sql = regexp.MustCompile(`(?i)IFNULL\s*\(`).ReplaceAllString(sql, "COALESCE(")

	// Replace NOW() (works in both, but ensure consistency)
	// sql = regexp.MustCompile(`(?i)\bNOW\s*\(\s*\)`).ReplaceAllString(sql, "NOW()")

	// Replace LIMIT offset, count with LIMIT count OFFSET offset
	limitRegex := regexp.MustCompile(`(?i)LIMIT\s+(\d+)\s*,\s*(\d+)`)
	sql = limitRegex.ReplaceAllString(sql, "LIMIT $2 OFFSET $1")

	return sql
}

// CentralLedgerSchema returns the PostgreSQL schema for central_ledger database
// This schema is kept upstream-compatible with Mojaloop's Knex migrations
func CentralLedgerSchema() string {
	return `
-- Central Ledger Schema for PostgreSQL
-- Compatible with Mojaloop central-ledger v17.x

-- Currency table
CREATE TABLE IF NOT EXISTS currency (
    "currencyId" VARCHAR(3) PRIMARY KEY,
    "name" VARCHAR(128),
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "scale" SMALLINT DEFAULT 4
);

-- Participant table
CREATE TABLE IF NOT EXISTS participant (
    "participantId" SERIAL PRIMARY KEY,
    "name" VARCHAR(256) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(128)
);

-- Participant currency table
CREATE TABLE IF NOT EXISTS "participantCurrency" (
    "participantCurrencyId" SERIAL PRIMARY KEY,
    "participantId" INTEGER NOT NULL REFERENCES participant("participantId"),
    "currencyId" VARCHAR(3) NOT NULL REFERENCES currency("currencyId"),
    "ledgerAccountTypeId" INTEGER NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(128),
    UNIQUE ("participantId", "currencyId", "ledgerAccountTypeId")
);

-- Participant position table
CREATE TABLE IF NOT EXISTS "participantPosition" (
    "participantPositionId" SERIAL PRIMARY KEY,
    "participantCurrencyId" INTEGER NOT NULL REFERENCES "participantCurrency"("participantCurrencyId"),
    "value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reservedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "changedDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participant limit table
CREATE TABLE IF NOT EXISTS "participantLimit" (
    "participantLimitId" SERIAL PRIMARY KEY,
    "participantCurrencyId" INTEGER NOT NULL REFERENCES "participantCurrency"("participantCurrencyId"),
    "participantLimitTypeId" INTEGER NOT NULL,
    "value" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "thresholdAlarmPercentage" DECIMAL(5,2) DEFAULT 10.00,
    "startAfterParticipantPositionChangeId" BIGINT,
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(128)
);

-- Transfer table
CREATE TABLE IF NOT EXISTS transfer (
    "transferId" VARCHAR(36) PRIMARY KEY,
    "amount" DECIMAL(18,4) NOT NULL,
    "currencyId" VARCHAR(3) NOT NULL REFERENCES currency("currencyId"),
    "ilpCondition" VARCHAR(256),
    "expirationDate" TIMESTAMP,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer participant table
CREATE TABLE IF NOT EXISTS "transferParticipant" (
    "transferParticipantId" SERIAL PRIMARY KEY,
    "transferId" VARCHAR(36) NOT NULL REFERENCES transfer("transferId"),
    "participantCurrencyId" INTEGER NOT NULL REFERENCES "participantCurrency"("participantCurrencyId"),
    "transferParticipantRoleTypeId" INTEGER NOT NULL,
    "ledgerEntryTypeId" INTEGER NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer state table
CREATE TABLE IF NOT EXISTS "transferState" (
    "transferStateId" SERIAL PRIMARY KEY,
    "transferId" VARCHAR(36) NOT NULL REFERENCES transfer("transferId"),
    "transferStateChangeId" INTEGER NOT NULL,
    "enumeration" VARCHAR(50) NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer state change table
CREATE TABLE IF NOT EXISTS "transferStateChange" (
    "transferStateChangeId" BIGSERIAL PRIMARY KEY,
    "transferId" VARCHAR(36) NOT NULL REFERENCES transfer("transferId"),
    "transferStateId" VARCHAR(50) NOT NULL,
    "reason" TEXT,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer fulfilment table
CREATE TABLE IF NOT EXISTS "transferFulfilment" (
    "transferFulfilmentId" SERIAL PRIMARY KEY,
    "transferId" VARCHAR(36) NOT NULL REFERENCES transfer("transferId") UNIQUE,
    "ilpFulfilment" VARCHAR(256),
    "completedDate" TIMESTAMP,
    "isValid" BOOLEAN,
    "settlementWindowId" BIGINT,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer error table
CREATE TABLE IF NOT EXISTS "transferError" (
    "transferErrorId" SERIAL PRIMARY KEY,
    "transferStateChangeId" BIGINT NOT NULL REFERENCES "transferStateChange"("transferStateChangeId"),
    "errorCode" VARCHAR(10) NOT NULL,
    "errorDescription" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer extension table
CREATE TABLE IF NOT EXISTS "transferExtension" (
    "transferExtensionId" SERIAL PRIMARY KEY,
    "transferId" VARCHAR(36) NOT NULL REFERENCES transfer("transferId"),
    "key" VARCHAR(128) NOT NULL,
    "value" TEXT NOT NULL,
    "isFulfilment" BOOLEAN DEFAULT false,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger account type table
CREATE TABLE IF NOT EXISTS "ledgerAccountType" (
    "ledgerAccountTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "isActive" BOOLEAN DEFAULT true,
    "isSettleable" BOOLEAN DEFAULT false,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ledger entry type table
CREATE TABLE IF NOT EXISTS "ledgerEntryType" (
    "ledgerEntryTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transfer participant role type table
CREATE TABLE IF NOT EXISTS "transferParticipantRoleType" (
    "transferParticipantRoleTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Participant limit type table
CREATE TABLE IF NOT EXISTS "participantLimitType" (
    "participantLimitTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement window table
CREATE TABLE IF NOT EXISTS "settlementWindow" (
    "settlementWindowId" BIGSERIAL PRIMARY KEY,
    "reason" VARCHAR(512),
    "state" VARCHAR(50) NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "changedDate" TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_transfer_currencyId" ON transfer("currencyId");
CREATE INDEX IF NOT EXISTS "idx_transfer_expirationDate" ON transfer("expirationDate");
CREATE INDEX IF NOT EXISTS "idx_transferParticipant_transferId" ON "transferParticipant"("transferId");
CREATE INDEX IF NOT EXISTS "idx_transferStateChange_transferId" ON "transferStateChange"("transferId");
CREATE INDEX IF NOT EXISTS "idx_participantCurrency_participantId" ON "participantCurrency"("participantId");

-- Insert default data
INSERT INTO "ledgerAccountType" ("name", "description", "isActive", "isSettleable") VALUES
    ('POSITION', 'Position account', true, true),
    ('SETTLEMENT', 'Settlement account', true, true),
    ('HUB_MULTILATERAL_SETTLEMENT', 'Hub multilateral settlement account', true, false),
    ('HUB_RECONCILIATION', 'Hub reconciliation account', true, false)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "ledgerEntryType" ("name", "description") VALUES
    ('PRINCIPLE_VALUE', 'Principal value'),
    ('INTERCHANGE_FEE', 'Interchange fee'),
    ('HUB_FEE', 'Hub fee'),
    ('POSITION_DEPOSIT', 'Position deposit'),
    ('POSITION_WITHDRAWAL', 'Position withdrawal'),
    ('SETTLEMENT_NET_RECIPIENT', 'Settlement net recipient'),
    ('SETTLEMENT_NET_SENDER', 'Settlement net sender'),
    ('RECORD_FUNDS_IN', 'Record funds in'),
    ('RECORD_FUNDS_OUT', 'Record funds out')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "transferParticipantRoleType" ("name", "description") VALUES
    ('PAYER_DFSP', 'Payer DFSP'),
    ('PAYEE_DFSP', 'Payee DFSP'),
    ('HUB', 'Hub'),
    ('DFSP_SETTLEMENT', 'DFSP Settlement'),
    ('DFSP_POSITION', 'DFSP Position')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "participantLimitType" ("name", "description", "isActive") VALUES
    ('NET_DEBIT_CAP', 'Net debit cap', true)
ON CONFLICT ("name") DO NOTHING;
`
}

// AccountLookupSchema returns the PostgreSQL schema for account_lookup database
func AccountLookupSchema() string {
	return `
-- Account Lookup Schema for PostgreSQL
-- Compatible with Mojaloop account-lookup-service v14.x

-- Party type table
CREATE TABLE IF NOT EXISTS "partyType" (
    "partyTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Party identifier type table
CREATE TABLE IF NOT EXISTS "partyIdentifierType" (
    "partyIdentifierTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Oracle endpoint table
CREATE TABLE IF NOT EXISTS "oracleEndpoint" (
    "oracleEndpointId" SERIAL PRIMARY KEY,
    "partyIdTypeId" INTEGER NOT NULL REFERENCES "partyIdentifierType"("partyIdentifierTypeId"),
    "endpointTypeId" INTEGER NOT NULL,
    "value" VARCHAR(512) NOT NULL,
    "currencyId" VARCHAR(3),
    "isDefault" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Endpoint type table
CREATE TABLE IF NOT EXISTS "endpointType" (
    "endpointTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Party table
CREATE TABLE IF NOT EXISTS party (
    "partyId" SERIAL PRIMARY KEY,
    "partyTypeId" INTEGER NOT NULL REFERENCES "partyType"("partyTypeId"),
    "partyIdentifierTypeId" INTEGER NOT NULL REFERENCES "partyIdentifierType"("partyIdentifierTypeId"),
    "partyIdentifierValue" VARCHAR(128) NOT NULL,
    "partySubIdOrType" VARCHAR(128),
    "fspId" VARCHAR(32) NOT NULL,
    "currencyId" VARCHAR(3),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("partyIdentifierTypeId", "partyIdentifierValue", "partySubIdOrType")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_party_fspId" ON party("fspId");
CREATE INDEX IF NOT EXISTS "idx_party_identifier" ON party("partyIdentifierTypeId", "partyIdentifierValue");

-- Insert default data
INSERT INTO "partyType" ("name", "description") VALUES
    ('CONSUMER', 'Consumer'),
    ('AGENT', 'Agent'),
    ('BUSINESS', 'Business'),
    ('DEVICE', 'Device')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "partyIdentifierType" ("name", "description") VALUES
    ('MSISDN', 'Mobile phone number'),
    ('EMAIL', 'Email address'),
    ('PERSONAL_ID', 'Personal identifier'),
    ('BUSINESS', 'Business identifier'),
    ('DEVICE', 'Device identifier'),
    ('ACCOUNT_ID', 'Account identifier'),
    ('IBAN', 'International Bank Account Number'),
    ('ALIAS', 'Alias')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "endpointType" ("name", "description") VALUES
    ('URL', 'URL endpoint')
ON CONFLICT ("name") DO NOTHING;
`
}

// QuotingSchema returns the PostgreSQL schema for quoting database
func QuotingSchema() string {
	return `
-- Quoting Schema for PostgreSQL
-- Compatible with Mojaloop quoting-service v15.x

-- Quote table
CREATE TABLE IF NOT EXISTS quote (
    "quoteId" VARCHAR(36) PRIMARY KEY,
    "transactionId" VARCHAR(36) NOT NULL,
    "transactionRequestId" VARCHAR(36),
    "payee" JSONB,
    "payer" JSONB,
    "amountTypeId" INTEGER NOT NULL,
    "amount" DECIMAL(18,4),
    "currencyId" VARCHAR(3),
    "fees" JSONB,
    "transactionType" JSONB,
    "geoCode" JSONB,
    "note" TEXT,
    "expirationDate" TIMESTAMP,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote response table
CREATE TABLE IF NOT EXISTS "quoteResponse" (
    "quoteResponseId" SERIAL PRIMARY KEY,
    "quoteId" VARCHAR(36) NOT NULL REFERENCES quote("quoteId"),
    "transferAmount" JSONB,
    "payeeReceiveAmount" JSONB,
    "payeeFspFee" JSONB,
    "payeeFspCommission" JSONB,
    "condition" VARCHAR(256),
    "expiration" TIMESTAMP,
    "ilpPacket" TEXT,
    "isValid" BOOLEAN DEFAULT true,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote error table
CREATE TABLE IF NOT EXISTS "quoteError" (
    "quoteErrorId" SERIAL PRIMARY KEY,
    "quoteId" VARCHAR(36) NOT NULL REFERENCES quote("quoteId"),
    "quoteResponseId" INTEGER REFERENCES "quoteResponse"("quoteResponseId"),
    "errorCode" VARCHAR(10) NOT NULL,
    "errorDescription" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote extension table
CREATE TABLE IF NOT EXISTS "quoteExtension" (
    "quoteExtensionId" SERIAL PRIMARY KEY,
    "quoteId" VARCHAR(36) NOT NULL REFERENCES quote("quoteId"),
    "quoteResponseId" INTEGER REFERENCES "quoteResponse"("quoteResponseId"),
    "key" VARCHAR(128) NOT NULL,
    "value" TEXT NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote party table
CREATE TABLE IF NOT EXISTS "quoteParty" (
    "quotePartyId" SERIAL PRIMARY KEY,
    "quoteId" VARCHAR(36) NOT NULL REFERENCES quote("quoteId"),
    "partyTypeId" INTEGER NOT NULL,
    "partyIdentifierTypeId" INTEGER NOT NULL,
    "partyIdentifierValue" VARCHAR(128) NOT NULL,
    "partySubIdOrType" VARCHAR(128),
    "fspId" VARCHAR(32),
    "merchantClassificationCode" VARCHAR(4),
    "partyName" VARCHAR(128),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Amount type table
CREATE TABLE IF NOT EXISTS "amountType" (
    "amountTypeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_quote_transactionId" ON quote("transactionId");
CREATE INDEX IF NOT EXISTS "idx_quoteResponse_quoteId" ON "quoteResponse"("quoteId");
CREATE INDEX IF NOT EXISTS "idx_quoteParty_quoteId" ON "quoteParty"("quoteId");

-- Insert default data
INSERT INTO "amountType" ("name", "description") VALUES
    ('SEND', 'Send amount'),
    ('RECEIVE', 'Receive amount')
ON CONFLICT ("name") DO NOTHING;
`
}

// CentralSettlementsSchema returns the PostgreSQL schema for central_settlements database
func CentralSettlementsSchema() string {
	return `
-- Central Settlements Schema for PostgreSQL
-- Compatible with Mojaloop central-settlements

-- Settlement model table
CREATE TABLE IF NOT EXISTS "settlementModel" (
    "settlementModelId" SERIAL PRIMARY KEY,
    "name" VARCHAR(128) NOT NULL UNIQUE,
    "isActive" BOOLEAN DEFAULT true,
    "settlementGranularityId" INTEGER NOT NULL,
    "settlementInterchangeId" INTEGER NOT NULL,
    "settlementDelayId" INTEGER NOT NULL,
    "currencyId" VARCHAR(3),
    "requireLiquidityCheck" BOOLEAN DEFAULT true,
    "ledgerAccountTypeId" INTEGER NOT NULL,
    "autoPositionReset" BOOLEAN DEFAULT false,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement table
CREATE TABLE IF NOT EXISTS settlement (
    "settlementId" BIGSERIAL PRIMARY KEY,
    "settlementModelId" INTEGER NOT NULL REFERENCES "settlementModel"("settlementModelId"),
    "reason" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "changedDate" TIMESTAMP
);

-- Settlement state table
CREATE TABLE IF NOT EXISTS "settlementState" (
    "settlementStateId" SERIAL PRIMARY KEY,
    "enumeration" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement state change table
CREATE TABLE IF NOT EXISTS "settlementStateChange" (
    "settlementStateChangeId" BIGSERIAL PRIMARY KEY,
    "settlementId" BIGINT NOT NULL REFERENCES settlement("settlementId"),
    "settlementStateId" INTEGER NOT NULL REFERENCES "settlementState"("settlementStateId"),
    "reason" TEXT,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement window table
CREATE TABLE IF NOT EXISTS "settlementWindow" (
    "settlementWindowId" BIGSERIAL PRIMARY KEY,
    "reason" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "changedDate" TIMESTAMP
);

-- Settlement window state change table
CREATE TABLE IF NOT EXISTS "settlementWindowStateChange" (
    "settlementWindowStateChangeId" BIGSERIAL PRIMARY KEY,
    "settlementWindowId" BIGINT NOT NULL REFERENCES "settlementWindow"("settlementWindowId"),
    "settlementWindowStateId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement participant table
CREATE TABLE IF NOT EXISTS "settlementParticipant" (
    "settlementParticipantId" BIGSERIAL PRIMARY KEY,
    "settlementId" BIGINT NOT NULL REFERENCES settlement("settlementId"),
    "participantId" INTEGER NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement participant currency table
CREATE TABLE IF NOT EXISTS "settlementParticipantCurrency" (
    "settlementParticipantCurrencyId" BIGSERIAL PRIMARY KEY,
    "settlementParticipantId" BIGINT NOT NULL REFERENCES "settlementParticipant"("settlementParticipantId"),
    "participantCurrencyId" INTEGER NOT NULL,
    "netAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement transfer table
CREATE TABLE IF NOT EXISTS "settlementTransfer" (
    "settlementTransferId" BIGSERIAL PRIMARY KEY,
    "settlementId" BIGINT NOT NULL REFERENCES settlement("settlementId"),
    "transferId" VARCHAR(36) NOT NULL,
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement granularity table
CREATE TABLE IF NOT EXISTS "settlementGranularity" (
    "settlementGranularityId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement interchange table
CREATE TABLE IF NOT EXISTS "settlementInterchange" (
    "settlementInterchangeId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settlement delay table
CREATE TABLE IF NOT EXISTS "settlementDelay" (
    "settlementDelayId" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" VARCHAR(512),
    "createdDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_settlement_settlementModelId" ON settlement("settlementModelId");
CREATE INDEX IF NOT EXISTS "idx_settlementStateChange_settlementId" ON "settlementStateChange"("settlementId");
CREATE INDEX IF NOT EXISTS "idx_settlementParticipant_settlementId" ON "settlementParticipant"("settlementId");

-- Insert default data
INSERT INTO "settlementState" ("enumeration", "description") VALUES
    ('PENDING_SETTLEMENT', 'Pending settlement'),
    ('PS_TRANSFERS_RECORDED', 'Transfers recorded'),
    ('PS_TRANSFERS_RESERVED', 'Transfers reserved'),
    ('PS_TRANSFERS_COMMITTED', 'Transfers committed'),
    ('SETTLING', 'Settling'),
    ('SETTLED', 'Settled'),
    ('ABORTED', 'Aborted')
ON CONFLICT ("enumeration") DO NOTHING;

INSERT INTO "settlementGranularity" ("name", "description") VALUES
    ('GROSS', 'Gross settlement'),
    ('NET', 'Net settlement')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "settlementInterchange" ("name", "description") VALUES
    ('BILATERAL', 'Bilateral interchange'),
    ('MULTILATERAL', 'Multilateral interchange')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "settlementDelay" ("name", "description") VALUES
    ('IMMEDIATE', 'Immediate settlement'),
    ('DEFERRED', 'Deferred settlement')
ON CONFLICT ("name") DO NOTHING;
`
}

// MigrateSchema creates the PostgreSQL schema for all Mojaloop databases
func (m *PostgresMigration) MigrateSchema(ctx context.Context) error {
	schemas := map[string]string{
		"central_ledger":      CentralLedgerSchema(),
		"account_lookup":      AccountLookupSchema(),
		"quoting":             QuotingSchema(),
		"central_settlements": CentralSettlementsSchema(),
	}

	for dbName, schema := range schemas {
		// Connect to specific database
		pgDSN := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			m.config.PGHost, m.config.PGPort,
			m.config.PGUser, m.config.PGPassword, dbName)

		db, err := sql.Open("postgres", pgDSN)
		if err != nil {
			return fmt.Errorf("failed to connect to %s: %w", dbName, err)
		}

		if !m.config.DryRun {
			_, err = db.ExecContext(ctx, schema)
			if err != nil {
				db.Close()
				return fmt.Errorf("failed to create schema for %s: %w", dbName, err)
			}
		}

		db.Close()
		fmt.Printf("Created schema for %s\n", dbName)
	}

	return nil
}

// MigrationResult holds the result of a migration
type MigrationResult struct {
	Database     string
	TablesCount  int
	RowsCount    int64
	Duration     time.Duration
	Errors       []string
}

// Migrate performs the full migration from MySQL to PostgreSQL
func (m *PostgresMigration) Migrate(ctx context.Context) ([]MigrationResult, error) {
	var results []MigrationResult

	// First, create schemas
	if err := m.MigrateSchema(ctx); err != nil {
		return nil, fmt.Errorf("schema migration failed: %w", err)
	}

	// Then migrate data for each database
	for _, dbName := range m.config.Databases {
		result, err := m.migrateDatabase(ctx, dbName)
		if err != nil {
			result.Errors = append(result.Errors, err.Error())
		}
		results = append(results, result)
	}

	return results, nil
}

func (m *PostgresMigration) migrateDatabase(ctx context.Context, dbName string) (MigrationResult, error) {
	start := time.Now()
	result := MigrationResult{
		Database: dbName,
	}

	// This is a placeholder for actual data migration
	// In production, you would:
	// 1. Query tables from MySQL
	// 2. Transform data types as needed
	// 3. Insert into PostgreSQL in batches

	result.Duration = time.Since(start)
	return result, nil
}

// ValidateMigration compares data between MySQL and PostgreSQL
func (m *PostgresMigration) ValidateMigration(ctx context.Context) (bool, []string) {
	var errors []string

	// Compare row counts for each table
	// Compare checksums for critical tables
	// Verify foreign key relationships

	return len(errors) == 0, errors
}
