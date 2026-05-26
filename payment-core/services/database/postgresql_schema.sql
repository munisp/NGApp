-- PostgreSQL Schema for Next Generation Payment Switch
-- This schema supports the dual-ledger architecture with TigerBeetle
-- Optimized for 20 billion transactions per month

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- ============================================================================
-- TRANSACTION HISTORY (Partitioned by date)
-- ============================================================================

CREATE TABLE transaction_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    tigerbeetle_transfer_id VARCHAR(255),
    
    -- Party information
    payer_id VARCHAR(255) NOT NULL,
    payer_participant_id VARCHAR(255) NOT NULL,
    payee_id VARCHAR(255) NOT NULL,
    payee_participant_id VARCHAR(255) NOT NULL,
    
    -- Transaction details
    amount NUMERIC(20, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL,
    error_code VARCHAR(50),
    error_description TEXT,
    
    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (initiated_at);

-- Create partitions for the next 12 months
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'transaction_history_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF transaction_history
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

-- Indexes for transaction_history
CREATE INDEX idx_transaction_history_transaction_id ON transaction_history(transaction_id);
CREATE INDEX idx_transaction_history_payer_id ON transaction_history(payer_id);
CREATE INDEX idx_transaction_history_payee_id ON transaction_history(payee_id);
CREATE INDEX idx_transaction_history_status ON transaction_history(status);
CREATE INDEX idx_transaction_history_initiated_at ON transaction_history(initiated_at);
CREATE INDEX idx_transaction_history_metadata ON transaction_history USING GIN(metadata);

-- ============================================================================
-- ACCOUNT BALANCES (Synchronized from TigerBeetle)
-- ============================================================================

CREATE TABLE account_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255) NOT NULL UNIQUE,
    tigerbeetle_account_id VARCHAR(255) NOT NULL UNIQUE,
    participant_id VARCHAR(255) NOT NULL,
    
    -- Balance information
    currency VARCHAR(3) NOT NULL,
    available_balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
    pending_balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
    total_balance NUMERIC(20, 2) GENERATED ALWAYS AS (available_balance + pending_balance) STORED,
    
    -- Ledger information
    ledger_id INTEGER NOT NULL,
    code INTEGER NOT NULL,
    
    -- Timestamps
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_account_balances_account_id ON account_balances(account_id);
CREATE INDEX idx_account_balances_participant_id ON account_balances(participant_id);
CREATE INDEX idx_account_balances_tigerbeetle_account_id ON account_balances(tigerbeetle_account_id);

-- ============================================================================
-- MOJALOOP PARTICIPANTS
-- ============================================================================

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    currency_codes VARCHAR(3)[] NOT NULL,
    
    -- Settlement accounts
    settlement_account_id VARCHAR(255),
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_participant_id ON participants(participant_id);
CREATE INDEX idx_participants_type ON participants(type);
CREATE INDEX idx_participants_is_active ON participants(is_active);

-- ============================================================================
-- PARTY REGISTRY (Mojaloop Account Lookup)
-- ============================================================================

CREATE TABLE party_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    party_type VARCHAR(50) NOT NULL,
    party_identifier VARCHAR(255) NOT NULL,
    
    -- Participant mapping
    participant_id VARCHAR(255) NOT NULL REFERENCES participants(participant_id),
    account_id VARCHAR(255) NOT NULL,
    
    -- Party details
    display_name VARCHAR(255),
    first_name VARCHAR(255),
    middle_name VARCHAR(255),
    last_name VARCHAR(255),
    date_of_birth DATE,
    
    -- Contact information
    merchant_classification_code VARCHAR(4),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(party_type, party_identifier)
);

CREATE INDEX idx_party_registry_party_type_identifier ON party_registry(party_type, party_identifier);
CREATE INDEX idx_party_registry_participant_id ON party_registry(participant_id);
CREATE INDEX idx_party_registry_account_id ON party_registry(account_id);

-- ============================================================================
-- QUOTES
-- ============================================================================

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id VARCHAR(255) NOT NULL UNIQUE,
    transaction_id VARCHAR(255) NOT NULL,
    
    -- Party information
    payer_participant_id VARCHAR(255) NOT NULL,
    payee_participant_id VARCHAR(255) NOT NULL,
    
    -- Amount details
    amount NUMERIC(20, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    -- Fee breakdown
    payee_receive_amount NUMERIC(20, 2) NOT NULL,
    payee_fee_amount NUMERIC(20, 2) DEFAULT 0,
    payee_commission NUMERIC(20, 2) DEFAULT 0,
    
    -- ILP packet
    ilp_packet TEXT,
    condition VARCHAR(255),
    
    -- Expiration
    expiration TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotes_quote_id ON quotes(quote_id);
CREATE INDEX idx_quotes_transaction_id ON quotes(transaction_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- ============================================================================
-- SETTLEMENT WINDOWS
-- ============================================================================

CREATE TABLE settlement_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    window_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Window details
    currency VARCHAR(3) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    
    -- Aggregates
    total_transactions INTEGER DEFAULT 0,
    total_amount NUMERIC(20, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settlement_windows_window_id ON settlement_windows(window_id);
CREATE INDEX idx_settlement_windows_status ON settlement_windows(status);
CREATE INDEX idx_settlement_windows_start_time ON settlement_windows(start_time);

-- ============================================================================
-- SETTLEMENT POSITIONS
-- ============================================================================

CREATE TABLE settlement_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    window_id VARCHAR(255) NOT NULL REFERENCES settlement_windows(window_id),
    participant_id VARCHAR(255) NOT NULL REFERENCES participants(participant_id),
    
    -- Position details
    currency VARCHAR(3) NOT NULL,
    net_position NUMERIC(20, 2) DEFAULT 0,
    debit_amount NUMERIC(20, 2) DEFAULT 0,
    credit_amount NUMERIC(20, 2) DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(window_id, participant_id, currency)
);

CREATE INDEX idx_settlement_positions_window_id ON settlement_positions(window_id);
CREATE INDEX idx_settlement_positions_participant_id ON settlement_positions(participant_id);

-- ============================================================================
-- FRAUD DETECTION RECORDS
-- ============================================================================

CREATE TABLE fraud_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(255) NOT NULL REFERENCES transaction_history(transaction_id),
    
    -- Risk assessment
    risk_score NUMERIC(3, 2) NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    blocked BOOLEAN DEFAULT false,
    
    -- Detection details
    rules_triggered TEXT[],
    reasons TEXT[],
    ml_score NUMERIC(3, 2),
    gnn_score NUMERIC(3, 2),
    
    -- Timestamps
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_checks_transaction_id ON fraud_checks(transaction_id);
CREATE INDEX idx_fraud_checks_risk_level ON fraud_checks(risk_level);
CREATE INDEX idx_fraud_checks_blocked ON fraud_checks(blocked);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    
    -- Actor information
    actor_id VARCHAR(255),
    actor_type VARCHAR(50),
    
    -- Changes
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create partitions for audit log (monthly)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'audit_log_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

CREATE INDEX idx_audit_log_entity_type_id ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Transaction volume by hour
CREATE MATERIALIZED VIEW mv_transaction_volume_hourly AS
SELECT 
    DATE_TRUNC('hour', initiated_at) AS hour,
    currency,
    status,
    COUNT(*) AS transaction_count,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount,
    MIN(amount) AS min_amount,
    MAX(amount) AS max_amount
FROM transaction_history
WHERE initiated_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', initiated_at), currency, status
WITH DATA;

CREATE UNIQUE INDEX idx_mv_transaction_volume_hourly ON mv_transaction_volume_hourly(hour, currency, status);

-- Participant transaction summary
CREATE MATERIALIZED VIEW mv_participant_summary AS
SELECT 
    payer_participant_id AS participant_id,
    currency,
    COUNT(*) AS total_transactions,
    SUM(amount) AS total_volume,
    AVG(amount) AS avg_transaction_amount,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS successful_transactions,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_transactions
FROM transaction_history
WHERE initiated_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY payer_participant_id, currency
WITH DATA;

CREATE UNIQUE INDEX idx_mv_participant_summary ON mv_participant_summary(participant_id, currency);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_transaction_history_updated_at BEFORE UPDATE ON transaction_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at BEFORE UPDATE ON account_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_party_registry_updated_at BEFORE UPDATE ON party_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_windows_updated_at BEFORE UPDATE ON settlement_windows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_positions_updated_at BEFORE UPDATE ON settlement_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_volume_hourly;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_participant_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze tables for query optimization
ANALYZE transaction_history;
ANALYZE account_balances;
ANALYZE participants;
ANALYZE party_registry;
ANALYZE quotes;
ANALYZE settlement_windows;
ANALYZE settlement_positions;
ANALYZE fraud_checks;
ANALYZE audit_log;

-- Vacuum tables
VACUUM ANALYZE;
