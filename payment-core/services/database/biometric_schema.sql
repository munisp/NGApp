-- Biometric Authentication Schema

CREATE TABLE IF NOT EXISTS biometric_templates (
    template_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    biometric_type VARCHAR(32) NOT NULL,
    template_data TEXT NOT NULL,  -- Encrypted/hashed biometric template
    quality DECIMAL(3, 2) NOT NULL CHECK (quality >= 0 AND quality <= 1),
    device_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_biometric_templates_user_id ON biometric_templates(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_biometric_templates_type ON biometric_templates(biometric_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_biometric_templates_status ON biometric_templates(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_biometric_templates_device ON biometric_templates(device_id) WHERE deleted_at IS NULL;

-- Biometric authentication log
CREATE TABLE IF NOT EXISTS biometric_auth_log (
    log_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    biometric_type VARCHAR(32) NOT NULL,
    success BOOLEAN NOT NULL,
    match_score DECIMAL(3, 2),
    device_id VARCHAR(128),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Partition by month for efficient querying
CREATE INDEX idx_biometric_auth_log_user_id ON biometric_auth_log(user_id);
CREATE INDEX idx_biometric_auth_log_timestamp ON biometric_auth_log(timestamp DESC);
CREATE INDEX idx_biometric_auth_log_success ON biometric_auth_log(success);

-- Biometric enrollment history
CREATE TABLE IF NOT EXISTS biometric_enrollment_history (
    enrollment_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    biometric_type VARCHAR(32) NOT NULL,
    template_id VARCHAR(64) REFERENCES biometric_templates(template_id),
    enrollment_status VARCHAR(32) NOT NULL,
    quality_score DECIMAL(3, 2),
    device_id VARCHAR(128),
    enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_biometric_enrollment_user_id ON biometric_enrollment_history(user_id);
CREATE INDEX idx_biometric_enrollment_status ON biometric_enrollment_history(enrollment_status);

-- Biometric security events
CREATE TABLE IF NOT EXISTS biometric_security_events (
    event_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL,  -- e.g., 'LIVENESS_FAILED', 'MULTIPLE_FAILED_ATTEMPTS'
    severity VARCHAR(32) NOT NULL,     -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    description TEXT,
    device_id VARCHAR(128),
    ip_address INET,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_biometric_security_events_user_id ON biometric_security_events(user_id);
CREATE INDEX idx_biometric_security_events_type ON biometric_security_events(event_type);
CREATE INDEX idx_biometric_security_events_severity ON biometric_security_events(severity);
CREATE INDEX idx_biometric_security_events_timestamp ON biometric_security_events(timestamp DESC);
CREATE INDEX idx_biometric_security_events_resolved ON biometric_security_events(resolved);

-- Biometric device registry
CREATE TABLE IF NOT EXISTS biometric_devices (
    device_id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    device_name VARCHAR(256),
    device_type VARCHAR(64),  -- 'SMARTPHONE', 'TABLET', 'BIOMETRIC_SCANNER'
    manufacturer VARCHAR(128),
    model VARCHAR(128),
    os_version VARCHAR(64),
    biometric_capabilities JSONB,  -- ['fingerprint', 'face', 'voice']
    trusted BOOLEAN DEFAULT TRUE,
    registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_biometric_devices_user_id ON biometric_devices(user_id);
CREATE INDEX idx_biometric_devices_status ON biometric_devices(status);
CREATE INDEX idx_biometric_devices_trusted ON biometric_devices(trusted);

-- Comments
COMMENT ON TABLE biometric_templates IS 'Stores encrypted biometric templates for authentication';
COMMENT ON COLUMN biometric_templates.template_data IS 'Encrypted/hashed biometric template data';
COMMENT ON COLUMN biometric_templates.quality IS 'Quality score of the biometric sample (0-1)';
COMMENT ON COLUMN biometric_templates.biometric_type IS 'Type: fingerprint, face, voice, iris';

COMMENT ON TABLE biometric_auth_log IS 'Audit log of all biometric authentication attempts';
COMMENT ON COLUMN biometric_auth_log.match_score IS 'Biometric match score (0-1)';

COMMENT ON TABLE biometric_security_events IS 'Security events related to biometric authentication';
COMMENT ON COLUMN biometric_security_events.event_type IS 'Type of security event';
COMMENT ON COLUMN biometric_security_events.severity IS 'Severity level of the event';
