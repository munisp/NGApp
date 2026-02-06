-- Iroh P2P Lakehouse Analytics Tables

CREATE TABLE IF NOT EXISTS iroh_p2p_transfers (
    transfer_id VARCHAR(64) PRIMARY KEY,
    sender_id VARCHAR(128),
    recipient_id VARCHAR(128),
    amount DECIMAL(18, 4),
    currency VARCHAR(8),
    connection_type VARCHAR(16),
    status VARCHAR(16),
    latency_ms INT,
    created_at TIMESTAMP,
    confirmed_at TIMESTAMP,
    INDEX idx_sender (sender_id),
    INDEX idx_recipient (recipient_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS iroh_wallet_sync_events (
    sync_id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(128),
    sync_type VARCHAR(32),
    entries_synced INT,
    conflicts_resolved INT,
    sync_duration_ms INT,
    wallet_version BIGINT,
    synced_at TIMESTAMP,
    INDEX idx_device (device_id),
    INDEX idx_synced (synced_at)
);

CREATE TABLE IF NOT EXISTS iroh_agent_transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(128),
    customer_id VARCHAR(128),
    transaction_type VARCHAR(32),
    amount DECIMAL(18, 4),
    currency VARCHAR(8),
    latitude DOUBLE,
    longitude DOUBLE,
    was_offline BOOLEAN,
    queue_duration_ms BIGINT,
    processed_at TIMESTAMP,
    INDEX idx_agent (agent_id),
    INDEX idx_type (transaction_type),
    INDEX idx_processed (processed_at)
);

CREATE TABLE IF NOT EXISTS iroh_fraud_alerts (
    alert_id VARCHAR(64) PRIMARY KEY,
    alert_type VARCHAR(32),
    severity VARCHAR(16),
    transaction_id VARCHAR(64),
    user_id VARCHAR(128),
    confidence_score DECIMAL(5, 4),
    source_node VARCHAR(128),
    broadcast_count INT,
    acknowledged_count INT,
    propagation_time_ms INT,
    created_at TIMESTAMP,
    INDEX idx_severity (severity),
    INDEX idx_type (alert_type),
    INDEX idx_confidence (confidence_score),
    INDEX idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS iroh_fraud_indicators (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id VARCHAR(64),
    indicator_type VARCHAR(64),
    indicator_value TEXT,
    weight DECIMAL(5, 4),
    FOREIGN KEY (alert_id) REFERENCES iroh_fraud_alerts(alert_id),
    INDEX idx_alert (alert_id),
    INDEX idx_type (indicator_type)
);

CREATE TABLE IF NOT EXISTS iroh_kyc_transfers (
    transfer_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128),
    document_type VARCHAR(32),
    document_hash VARCHAR(128),
    total_bytes BIGINT,
    transfer_duration_ms BIGINT,
    is_resumable BOOLEAN,
    resume_count INT DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP,
    verified_at TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_hash (document_hash),
    INDEX idx_uploaded (uploaded_at)
);

CREATE TABLE IF NOT EXISTS iroh_merchant_registry (
    merchant_id VARCHAR(64) PRIMARY KEY,
    public_key VARCHAR(256),
    business_name VARCHAR(256),
    business_type VARCHAR(64),
    latitude DOUBLE,
    longitude DOUBLE,
    supported_currencies JSON,
    services JSON,
    rating DECIMAL(3, 2),
    transaction_count BIGINT,
    is_online BOOLEAN,
    registered_at TIMESTAMP,
    last_seen TIMESTAMP,
    INDEX idx_type (business_type),
    INDEX idx_online (is_online),
    INDEX idx_location (latitude, longitude)
);

CREATE TABLE IF NOT EXISTS iroh_merchant_transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    sender_merchant_id VARCHAR(64),
    recipient_merchant_id VARCHAR(64),
    amount DECIMAL(18, 4),
    currency VARCHAR(8),
    connection_type VARCHAR(16),
    settlement_time_ms INT,
    invoice_id VARCHAR(64),
    created_at TIMESTAMP,
    FOREIGN KEY (sender_merchant_id) REFERENCES iroh_merchant_registry(merchant_id),
    FOREIGN KEY (recipient_merchant_id) REFERENCES iroh_merchant_registry(merchant_id),
    INDEX idx_sender (sender_merchant_id),
    INDEX idx_recipient (recipient_merchant_id),
    INDEX idx_created (created_at)
);

-- Analytics Views

CREATE OR REPLACE VIEW iroh_p2p_daily_stats AS
SELECT
    DATE(created_at) AS day,
    connection_type,
    COUNT(*) AS transfer_count,
    SUM(amount) AS total_volume,
    AVG(latency_ms) AS avg_latency,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count
FROM iroh_p2p_transfers
GROUP BY DATE(created_at), connection_type;

CREATE OR REPLACE VIEW iroh_fraud_severity_summary AS
SELECT
    severity,
    alert_type,
    COUNT(*) AS alert_count,
    AVG(confidence_score) AS avg_confidence,
    AVG(propagation_time_ms) AS avg_propagation_ms
FROM iroh_fraud_alerts
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY severity, alert_type;

CREATE OR REPLACE VIEW iroh_merchant_network_health AS
SELECT
    business_type,
    COUNT(*) AS merchant_count,
    COUNT(CASE WHEN is_online THEN 1 END) AS online_count,
    AVG(rating) AS avg_rating,
    SUM(transaction_count) AS total_transactions
FROM iroh_merchant_registry
GROUP BY business_type;

CREATE OR REPLACE VIEW iroh_agent_offline_analytics AS
SELECT
    DATE(processed_at) AS day,
    agent_id,
    COUNT(*) AS total_transactions,
    COUNT(CASE WHEN was_offline THEN 1 END) AS offline_count,
    AVG(queue_duration_ms) AS avg_queue_time,
    SUM(amount) AS total_volume
FROM iroh_agent_transactions
GROUP BY DATE(processed_at), agent_id;
