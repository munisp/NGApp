-- Next-Generation Payment Switch - Database Schema
-- PostgreSQL Schema for all services

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- ============================================================================
-- CORE PAYMENT TABLES
-- ============================================================================

-- Participants (DFSPs, Banks, Mobile Money Operators)
CREATE TABLE participants (
    participant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('DFSP', 'BANK', 'MOBILE_MONEY', 'PAYMENT_GATEWAY')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    currency VARCHAR(3) NOT NULL,
    account_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_code ON participants(participant_code);
CREATE INDEX idx_participants_type ON participants(type);

-- Accounts
CREATE TABLE accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID REFERENCES participants(participant_id),
    account_number VARCHAR(100) UNIQUE NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('SAVINGS', 'CURRENT', 'WALLET', 'MERCHANT')),
    currency VARCHAR(3) NOT NULL,
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    available_balance DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'FROZEN', 'CLOSED')),
    customer_id VARCHAR(100),
    customer_name VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_balance CHECK (balance >= 0),
    CONSTRAINT available_balance_check CHECK (available_balance >= 0 AND available_balance <= balance)
);

CREATE INDEX idx_accounts_participant ON accounts(participant_id);
CREATE INDEX idx_accounts_number ON accounts(account_number);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);

-- Transactions
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_transaction_id VARCHAR(100) UNIQUE,
    source_account_id UUID REFERENCES accounts(account_id),
    destination_account_id UUID REFERENCES accounts(account_id),
    amount DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('P2P', 'P2M', 'P2B', 'B2P', 'B2B', 'REFUND', 'REVERSAL')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('MOBILE', 'WEB', 'POS', 'ATM', 'QR_CODE', 'API', 'USSD')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT')),
    workflow_id VARCHAR(200),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_transactions_external ON transactions(external_transaction_id);
CREATE INDEX idx_transactions_source ON transactions(source_account_id);
CREATE INDEX idx_transactions_destination ON transactions(destination_account_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_workflow ON transactions(workflow_id);

-- ============================================================================
-- FRAUD DETECTION TABLES
-- ============================================================================

-- Fraud Checks
CREATE TABLE fraud_checks (
    fraud_check_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(transaction_id),
    fraud_score DECIMAL(5, 4) NOT NULL CHECK (fraud_score >= 0 AND fraud_score <= 1),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    gnn_score DECIMAL(5, 4),
    ml_score DECIMAL(5, 4),
    rule_score DECIMAL(5, 4),
    rules_triggered TEXT[],
    recommendation VARCHAR(50) NOT NULL,
    features JSONB,
    explanation TEXT[],
    processing_time_ms DECIMAL(10, 2),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_checks_transaction ON fraud_checks(transaction_id);
CREATE INDEX idx_fraud_checks_risk_level ON fraud_checks(risk_level);
CREATE INDEX idx_fraud_checks_checked_at ON fraud_checks(checked_at);

-- Fraud Rules
CREATE TABLE fraud_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    condition JSONB NOT NULL,
    action VARCHAR(50) NOT NULL,
    weight DECIMAL(3, 2) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_rules_active ON fraud_rules(is_active);

-- ============================================================================
-- SETTLEMENT TABLES
-- ============================================================================

-- Settlement Windows
CREATE TABLE settlement_windows (
    window_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    window_code VARCHAR(100) UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED', 'CANCELLED')),
    currency VARCHAR(3) NOT NULL,
    settlement_model VARCHAR(50) NOT NULL CHECK (settlement_model IN ('DEFERRED_NET', 'IMMEDIATE_GROSS', 'MULTILATERAL_NET')),
    total_transactions INTEGER DEFAULT 0,
    total_amount DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settlement_windows_code ON settlement_windows(window_code);
CREATE INDEX idx_settlement_windows_status ON settlement_windows(status);
CREATE INDEX idx_settlement_windows_start ON settlement_windows(start_time);

-- Participant Positions
CREATE TABLE participant_positions (
    position_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    window_id UUID REFERENCES settlement_windows(window_id),
    participant_id UUID REFERENCES participants(participant_id),
    currency VARCHAR(3) NOT NULL,
    net_position DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    debit_amount DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    credit_amount DECIMAL(20, 2) NOT NULL DEFAULT 0.00,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(window_id, participant_id, currency)
);

CREATE INDEX idx_positions_window ON participant_positions(window_id);
CREATE INDEX idx_positions_participant ON participant_positions(participant_id);

-- Settlements
CREATE TABLE settlements (
    settlement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    window_id UUID REFERENCES settlement_windows(window_id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED')),
    currency VARCHAR(3) NOT NULL,
    total_amount DECIMAL(20, 2) NOT NULL,
    participant_count INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_settlements_window ON settlements(window_id);
CREATE INDEX idx_settlements_status ON settlements(status);

-- ============================================================================
-- OFFLINE PAYMENTS TABLES
-- ============================================================================

-- Offline Transactions
CREATE TABLE offline_transactions (
    offline_transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payer_id VARCHAR(100) NOT NULL,
    payee_id VARCHAR(100) NOT NULL,
    amount DECIMAL(20, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    offline_signature TEXT NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE INDEX idx_offline_transactions_device ON offline_transactions(device_id);
CREATE INDEX idx_offline_transactions_sync_status ON offline_transactions(sync_status);
CREATE INDEX idx_offline_transactions_created ON offline_transactions(created_at);

-- ============================================================================
-- AUDIT AND LOGGING TABLES
-- ============================================================================

-- Audit Log
CREATE TABLE audit_log (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- System Events
CREATE TABLE system_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    service_name VARCHAR(100),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_severity ON system_events(severity);
CREATE INDEX idx_system_events_created ON system_events(created_at);

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

-- Apply updated_at trigger to tables
CREATE TRIGGER update_participants_updated_at BEFORE UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_windows_updated_at BEFORE UPDATE ON settlement_windows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_participant_positions_updated_at BEFORE UPDATE ON participant_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update account balance
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        -- Debit source account
        UPDATE accounts
        SET balance = balance - NEW.amount,
            available_balance = available_balance - NEW.amount
        WHERE account_id = NEW.source_account_id;
        
        -- Credit destination account
        UPDATE accounts
        SET balance = balance + NEW.amount,
            available_balance = available_balance + NEW.amount
        WHERE account_id = NEW.destination_account_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply balance update trigger
CREATE TRIGGER update_balances_on_transaction AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default fraud rules
INSERT INTO fraud_rules (rule_name, rule_type, condition, action, weight) VALUES
('LARGE_AMOUNT', 'THRESHOLD', '{"field": "amount", "operator": ">", "value": 10000}', 'FLAG', 0.3),
('HIGH_VELOCITY', 'VELOCITY', '{"window": "1h", "max_count": 10}', 'FLAG', 0.4),
('UNUSUAL_CHANNEL', 'PATTERN', '{"channels": ["API", "USSD"]}', 'FLAG', 0.2),
('ROUND_AMOUNT', 'PATTERN', '{"field": "amount", "pattern": "round"}', 'FLAG', 0.1);

