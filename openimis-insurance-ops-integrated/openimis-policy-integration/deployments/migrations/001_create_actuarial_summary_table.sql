-- 001_create_actuarial_summary_table.sql

-- Table to store the latest actuarial summary for each policy
CREATE TABLE IF NOT EXISTS actuarial_summary (
    policy_id VARCHAR(255) PRIMARY KEY,
    risk_score DECIMAL(10, 4) NOT NULL,
    expected_claims_ratio DECIMAL(10, 4) NOT NULL,
    reserve_required DECIMAL(10, 2) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for faster lookups
CREATE INDEX idx_actuarial_summary_last_updated ON actuarial_summary (last_updated);

-- Table to log all policy event updates for auditing
CREATE TABLE IF NOT EXISTS actuarial_event_log (
    log_id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    actuarial_metadata JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_actuarial_event_log_policy_id ON actuarial_event_log (policy_id);
CREATE INDEX idx_actuarial_event_log_event_id ON actuarial_event_log (event_id);
