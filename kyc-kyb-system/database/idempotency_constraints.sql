-- Idempotency Constraints and Tables for KYC/KYB System
-- PostgreSQL 14+

-- ============================================
-- IDEMPOTENCY KEYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idempotency_key VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status_code INTEGER,
    response_body JSONB,
    response_headers JSONB,
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(idempotency_key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_key ON idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_status ON idempotency_keys(status);

-- ============================================
-- UNIQUE CONSTRAINTS FOR BUSINESS OPERATIONS
-- ============================================

-- Prevent duplicate document verifications for same customer + document type within 24 hours
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_customer_type_day 
ON documents (customer_id, document_type, DATE(created_at))
WHERE verification_status != 'rejected';

-- Prevent duplicate liveness checks for same customer within 1 hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_liveness_customer_hour
ON liveness_checks (customer_id, DATE_TRUNC('hour', created_at))
WHERE status = 'pending' OR status = 'processing';

-- Prevent duplicate AML screenings for same customer + name within 24 hours
CREATE UNIQUE INDEX IF NOT EXISTS idx_aml_customer_name_day
ON aml_screenings (customer_id, full_name, DATE(created_at))
WHERE status != 'expired';

-- Prevent duplicate risk scores for same customer within validity period
CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_customer_active
ON risk_scores (customer_id)
WHERE expires_at > CURRENT_TIMESTAMP;

-- ============================================
-- POLICIES TABLE WITH IDEMPOTENCY
-- ============================================

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    policy_type VARCHAR(100) NOT NULL,
    product_id UUID,
    premium_amount DECIMAL(15,2) NOT NULL,
    coverage_amount DECIMAL(15,2) NOT NULL,
    effective_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    underwriting_status VARCHAR(50) DEFAULT 'pending',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    idempotency_key VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, policy_type, effective_date, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_policies_customer ON policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_idempotency ON policies(idempotency_key);

-- ============================================
-- CLAIMS TABLE WITH IDEMPOTENCY
-- ============================================

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_number VARCHAR(50) NOT NULL UNIQUE,
    policy_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    claim_type VARCHAR(100) NOT NULL,
    claim_amount DECIMAL(15,2) NOT NULL,
    approved_amount DECIMAL(15,2),
    incident_date DATE NOT NULL,
    incident_description TEXT,
    status VARCHAR(50) DEFAULT 'submitted',
    idempotency_key VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(policy_id, incident_date, claim_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_claims_policy ON claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_customer ON claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_idempotency ON claims(idempotency_key);

-- ============================================
-- PAYMENTS TABLE WITH IDEMPOTENCY
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    customer_id UUID NOT NULL,
    policy_id UUID,
    claim_id UUID,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50) NOT NULL,
    gateway_reference VARCHAR(255),
    gateway_response JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_policy ON payments(policy_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_ref ON payments(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

-- ============================================
-- KYC VERIFICATION REQUESTS WITH IDEMPOTENCY
-- ============================================

CREATE TABLE IF NOT EXISTS kyc_verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    identifier VARCHAR(100) NOT NULL,
    identifier_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(customer_id, verification_type, identifier_hash)
);

CREATE INDEX IF NOT EXISTS idx_kyc_requests_customer ON kyc_verification_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_status ON kyc_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_kyc_requests_idempotency ON kyc_verification_requests(idempotency_key);

-- ============================================
-- EVENT OUTBOX FOR EXACTLY-ONCE DELIVERY
-- ============================================

CREATE TABLE IF NOT EXISTS event_outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    published_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON event_outbox(status);
CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON event_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON event_outbox(created_at);

-- ============================================
-- PROCESSED EVENTS FOR CONSUMER DEDUPLICATION
-- ============================================

CREATE TABLE IF NOT EXISTS processed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    consumer_group VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result JSONB,
    UNIQUE(event_id, consumer_group)
);

CREATE INDEX IF NOT EXISTS idx_processed_event_id ON processed_events(event_id);
CREATE INDEX IF NOT EXISTS idx_processed_consumer ON processed_events(consumer_group);
CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_events(processed_at);

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old processed events (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_processed_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM processed_events WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to retry failed outbox events
CREATE OR REPLACE FUNCTION retry_failed_outbox_events()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE event_outbox 
    SET status = 'pending', retry_count = retry_count + 1
    WHERE status = 'failed' 
    AND retry_count < 5
    AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours';
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kyc_requests_updated_at BEFORE UPDATE ON kyc_verification_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
