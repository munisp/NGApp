-- Fraud Radar Lakehouse Tables
-- Analytics tables for Stripe Radar-inspired fraud detection

CREATE TABLE IF NOT EXISTS fraud_scores (
    transaction_id VARCHAR(64) PRIMARY KEY,
    score DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,
    confidence DECIMAL(4,2),
    model_version VARCHAR(20),
    inference_time_ms DECIMAL(6,2),
    top_feature_1 VARCHAR(50),
    top_feature_1_contribution DECIMAL(4,3),
    top_feature_2 VARCHAR(50),
    top_feature_2_contribution DECIMAL(4,3),
    top_feature_3 VARCHAR(50),
    top_feature_3_contribution DECIMAL(4,3),
    network_card_fraud BOOLEAN DEFAULT FALSE,
    network_email_fraud BOOLEAN DEFAULT FALSE,
    network_device_fraud BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_features (
    transaction_id VARCHAR(64) PRIMARY KEY,
    cards_per_ip_1h INT,
    txns_per_card_1h INT,
    txns_per_device_1h INT,
    amount_velocity_1h DECIMAL(12,2),
    device_fingerprint_hash VARCHAR(32),
    device_age_days INT,
    is_new_device BOOLEAN DEFAULT FALSE,
    is_emulator BOOLEAN DEFAULT FALSE,
    is_vpn BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    ip_country VARCHAR(3),
    card_country VARCHAR(3),
    country_mismatch BOOLEAN DEFAULT FALSE,
    impossible_travel BOOLEAN DEFAULT FALSE,
    distance_km DECIMAL(10,2),
    email_risk_score DECIMAL(4,3),
    is_throwaway_email BOOLEAN DEFAULT FALSE,
    bin_fraud_rate DECIMAL(6,4),
    extraction_time_ms DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_risk_insights (
    insight_id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL,
    score DECIMAL(5,2),
    action VARCHAR(20),
    insights_count INT,
    critical_count INT,
    warning_count INT,
    summary TEXT,
    recommendation TEXT,
    top_insight_category VARCHAR(30),
    top_insight_title VARCHAR(100),
    top_insight_contribution DECIMAL(4,3),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_investigations (
    investigation_id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL,
    assigned_to VARCHAR(100),
    resolution TEXT,
    notes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_attack_patterns (
    pattern_id VARCHAR(64) PRIMARY KEY,
    pattern_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    affected_merchants_count INT,
    indicators_json TEXT,
    status VARCHAR(20) DEFAULT 'active',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_rules (
    rule_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    conditions_json TEXT NOT NULL,
    logic_type VARCHAR(10) DEFAULT 'all',
    action VARCHAR(20) NOT NULL,
    priority INT DEFAULT 50,
    enabled BOOLEAN DEFAULT TRUE,
    merchant_id VARCHAR(64),
    match_count BIGINT DEFAULT 0,
    last_matched TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_rule_evaluations (
    eval_id VARCHAR(64) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL,
    rules_evaluated INT,
    rules_matched INT,
    final_action VARCHAR(20) NOT NULL,
    matched_rule_ids TEXT,
    eval_time_ms DECIMAL(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_model_versions (
    version_id VARCHAR(20) PRIMARY KEY,
    model_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    false_positive_rate DECIMAL(6,5),
    auc_roc DECIMAL(5,4),
    training_duration_sec DECIMAL(10,2),
    training_samples BIGINT,
    trigger_type VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deployed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_model_performance (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(20) NOT NULL,
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    false_positive_rate DECIMAL(6,5),
    sample_size INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_velocity_events (
    id SERIAL PRIMARY KEY,
    key_type VARCHAR(20) NOT NULL,
    key_value VARCHAR(200) NOT NULL,
    event_count INT,
    window_sec INT,
    threshold_exceeded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_device_fingerprints (
    device_id VARCHAR(32) PRIMARY KEY,
    user_agent_hash VARCHAR(64),
    screen_resolution VARCHAR(20),
    timezone VARCHAR(50),
    canvas_hash VARCHAR(64),
    webgl_hash VARCHAR(64),
    is_emulator BOOLEAN DEFAULT FALSE,
    is_rooted BOOLEAN DEFAULT FALSE,
    transaction_count INT DEFAULT 0,
    fraud_count INT DEFAULT 0,
    fraud_rate DECIMAL(6,4) DEFAULT 0,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_geo_events (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    ip_country VARCHAR(3),
    card_country VARCHAR(3),
    country_mismatch BOOLEAN DEFAULT FALSE,
    impossible_travel BOOLEAN DEFAULT FALSE,
    distance_km DECIMAL(10,2),
    speed_kmh DECIMAL(10,2),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prebuilt analytics queries
-- Q1: Fraud score distribution by risk level (last 24h)
-- SELECT risk_level, COUNT(*) as count, AVG(score) as avg_score FROM fraud_scores WHERE created_at > NOW() - INTERVAL '24 HOURS' GROUP BY risk_level;

-- Q2: Top attack patterns by severity
-- SELECT pattern_type, severity, COUNT(*) as count FROM fraud_attack_patterns WHERE status = 'active' GROUP BY pattern_type, severity ORDER BY count DESC;

-- Q3: Rule effectiveness (match rate by rule)
-- SELECT rule_id, name, match_count, action FROM fraud_rules WHERE enabled = TRUE ORDER BY match_count DESC LIMIT 20;

-- Q4: Model performance trend
-- SELECT model_version, precision_score, recall_score, f1_score, recorded_at FROM fraud_model_performance ORDER BY recorded_at DESC LIMIT 100;

-- Q5: Velocity alert hotspots (top IPs by event count)
-- SELECT key_value, SUM(event_count) as total_events FROM fraud_velocity_events WHERE key_type = 'ip' AND created_at > NOW() - INTERVAL '1 HOUR' GROUP BY key_value ORDER BY total_events DESC LIMIT 20;

-- Q6: Device fraud rate ranking
-- SELECT device_id, transaction_count, fraud_count, fraud_rate FROM fraud_device_fingerprints WHERE fraud_count > 0 ORDER BY fraud_rate DESC LIMIT 50;

-- Q7: Geographic fraud heatmap data
-- SELECT ip_country, COUNT(*) as events, SUM(CASE WHEN impossible_travel THEN 1 ELSE 0 END) as impossible_travel_count FROM fraud_geo_events WHERE created_at > NOW() - INTERVAL '24 HOURS' GROUP BY ip_country ORDER BY events DESC;

-- Q8: Investigation resolution time
-- SELECT status, COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours FROM fraud_investigations GROUP BY status;
