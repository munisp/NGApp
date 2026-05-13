-- Table Partitioning for High-Volume Tables
-- Partitions transaction tables by month for better query performance and data management

-- 1. Create partitioned transactions table
CREATE TABLE IF NOT EXISTS transactions_partitioned (
    id SERIAL,
    merchant_id INTEGER NOT NULL,
    session_id VARCHAR(255),
    amount DECIMAL(18,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(50) DEFAULT 'pending',
    type VARCHAR(50),
    reference VARCHAR(255),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (current year + next year)
CREATE TABLE IF NOT EXISTS transactions_y2026_q1 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS transactions_y2026_q2 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS transactions_y2026_q3 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS transactions_y2026_q4 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS transactions_y2027_q1 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS transactions_y2027_q2 PARTITION OF transactions_partitioned
    FOR VALUES FROM ('2027-04-01') TO ('2027-07-01');

-- Indexes on partitioned table
CREATE INDEX IF NOT EXISTS idx_txn_part_merchant ON transactions_partitioned (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_part_status ON transactions_partitioned (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_part_reference ON transactions_partitioned (reference);

-- 2. Create partitioned audit_log table
CREATE TABLE IF NOT EXISTS audit_log_partitioned (
    id SERIAL,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Quarterly partitions for audit logs
CREATE TABLE IF NOT EXISTS audit_log_y2026_q1 PARTITION OF audit_log_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026_q2 PARTITION OF audit_log_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026_q3 PARTITION OF audit_log_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_log_y2026_q4 PARTITION OF audit_log_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_audit_part_user ON audit_log_partitioned (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_part_action ON audit_log_partitioned (action, created_at DESC);

-- 3. Create partitioned webhook_logs table
CREATE TABLE IF NOT EXISTS webhook_logs_partitioned (
    id SERIAL,
    webhook_id INTEGER,
    event_type VARCHAR(100),
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    attempt_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS webhook_logs_y2026_q1 PARTITION OF webhook_logs_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS webhook_logs_y2026_q2 PARTITION OF webhook_logs_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS webhook_logs_y2026_q3 PARTITION OF webhook_logs_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS webhook_logs_y2026_q4 PARTITION OF webhook_logs_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_wh_log_part_webhook ON webhook_logs_partitioned (webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wh_log_part_status ON webhook_logs_partitioned (delivery_status, created_at DESC);

-- 4. Auto-partition creation function
CREATE OR REPLACE FUNCTION create_partition_if_not_exists(
    parent_table TEXT,
    partition_date DATE
) RETURNS VOID AS $$
DECLARE
    quarter_start DATE;
    quarter_end DATE;
    partition_name TEXT;
BEGIN
    quarter_start := date_trunc('quarter', partition_date)::DATE;
    quarter_end := (quarter_start + INTERVAL '3 months')::DATE;
    partition_name := parent_table || '_y' || EXTRACT(YEAR FROM quarter_start) || '_q' || EXTRACT(QUARTER FROM quarter_start);
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, parent_table, quarter_start, quarter_end
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;
