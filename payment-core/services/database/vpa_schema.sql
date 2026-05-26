-- VPA (Virtual Payment Address) Schema

CREATE TABLE IF NOT EXISTS vpas (
    vpa_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    vpa_handle VARCHAR(128) NOT NULL,
    bank_code VARCHAR(32) NOT NULL,
    full_vpa VARCHAR(256) NOT NULL UNIQUE,
    display_name VARCHAR(256),
    vpa_type VARCHAR(32) NOT NULL DEFAULT 'PERSONAL',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX idx_vpas_account_id ON vpas(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_vpas_full_vpa ON vpas(full_vpa) WHERE deleted_at IS NULL;
CREATE INDEX idx_vpas_bank_code ON vpas(bank_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_vpas_status ON vpas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vpas_created_at ON vpas(created_at DESC);

-- VPA transfer history
CREATE TABLE IF NOT EXISTS vpa_transfers (
    transfer_id VARCHAR(64) PRIMARY KEY,
    vpa_id VARCHAR(64) NOT NULL REFERENCES vpas(vpa_id),
    from_bank_id VARCHAR(32) NOT NULL,
    to_bank_id VARCHAR(32) NOT NULL,
    old_vpa VARCHAR(256) NOT NULL,
    new_vpa VARCHAR(256) NOT NULL,
    authorization_code VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_vpa_transfers_vpa_id ON vpa_transfers(vpa_id);
CREATE INDEX idx_vpa_transfers_status ON vpa_transfers(status);

-- VPA resolution audit log
CREATE TABLE IF NOT EXISTS vpa_resolution_log (
    log_id BIGSERIAL PRIMARY KEY,
    vpa VARCHAR(256) NOT NULL,
    resolved_account_id VARCHAR(64),
    source_ip INET,
    user_agent TEXT,
    resolution_time_ms INTEGER,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partition by month for efficient querying
CREATE INDEX idx_vpa_resolution_log_timestamp ON vpa_resolution_log(timestamp DESC);
CREATE INDEX idx_vpa_resolution_log_vpa ON vpa_resolution_log(vpa);

-- VPA usage statistics (for analytics)
CREATE TABLE IF NOT EXISTS vpa_usage_stats (
    stat_id BIGSERIAL PRIMARY KEY,
    vpa_id VARCHAR(64) NOT NULL REFERENCES vpas(vpa_id),
    date DATE NOT NULL,
    resolution_count INTEGER DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    total_amount DECIMAL(20, 2) DEFAULT 0,
    unique_payers INTEGER DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vpa_id, date)
);

CREATE INDEX idx_vpa_usage_stats_vpa_id ON vpa_usage_stats(vpa_id);
CREATE INDEX idx_vpa_usage_stats_date ON vpa_usage_stats(date DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_vpas_updated_at BEFORE UPDATE ON vpas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE vpas IS 'Virtual Payment Addresses for simplified payment routing';
COMMENT ON COLUMN vpas.vpa_handle IS 'User-friendly handle part of VPA (e.g., "john" in john@bank)';
COMMENT ON COLUMN vpas.bank_code IS 'Bank identifier part of VPA (e.g., "bank" in john@bank)';
COMMENT ON COLUMN vpas.full_vpa IS 'Complete VPA in format handle@bank';
COMMENT ON COLUMN vpas.vpa_type IS 'Type: PERSONAL, BUSINESS, MERCHANT, or TEMPORARY';
COMMENT ON COLUMN vpas.status IS 'Status: ACTIVE, INACTIVE, SUSPENDED, or PENDING_VERIFICATION';
