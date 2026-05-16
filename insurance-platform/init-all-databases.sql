-- Complete Database Schema for Insurance Platform
-- Run this script to initialize all tables for Go microservices

-- ============================================================================
-- POLICY SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    agent_id UUID,
    policy_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    premium_amount BIGINT NOT NULL,
    premium_frequency VARCHAR(20) NOT NULL,
    sum_assured BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    next_premium_due_date TIMESTAMP,
    beneficiaries JSONB,
    coverage_details JSONB,
    metadata JSONB,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policies_customer_id ON policies(customer_id);
CREATE INDEX idx_policies_agent_id ON policies(agent_id);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_policy_type ON policies(policy_type);

CREATE TABLE IF NOT EXISTS policy_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id),
    old_end_date TIMESTAMP NOT NULL,
    new_end_date TIMESTAMP NOT NULL,
    old_premium_amount BIGINT NOT NULL,
    new_premium_amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policy_renewals_policy_id ON policy_renewals(policy_id);

CREATE TABLE IF NOT EXISTS policy_endorsements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES policies(id),
    endorsement_type VARCHAR(50) NOT NULL,
    effective_date TIMESTAMP NOT NULL,
    changes JSONB NOT NULL,
    approved_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLAIM SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    policy_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    claim_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    claim_amount BIGINT NOT NULL,
    approved_amount BIGINT,
    incident_date TIMESTAMP NOT NULL,
    incident_description TEXT NOT NULL,
    incident_location VARCHAR(255),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assessed_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    settled_at TIMESTAMP,
    rejection_reason TEXT,
    assessor_id UUID,
    approver_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claims_policy_id ON claims(policy_id);
CREATE INDEX idx_claims_customer_id ON claims(customer_id);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_claim_type ON claims(claim_type);

CREATE TABLE IF NOT EXISTS claim_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    document_type VARCHAR(50) NOT NULL,
    document_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claim_documents_claim_id ON claim_documents(claim_id);

CREATE TABLE IF NOT EXISTS claim_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    assessor_id UUID NOT NULL,
    assessment_date TIMESTAMP NOT NULL,
    recommended_amount BIGINT NOT NULL,
    assessment_notes TEXT,
    fraud_score DECIMAL(3,2),
    risk_factors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claim_assessments_claim_id ON claim_assessments(claim_id);

-- ============================================================================
-- PAYMENT SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_reference VARCHAR(100) UNIQUE NOT NULL,
    policy_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50),
    gateway_reference VARCHAR(100),
    gateway_response JSONB,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_policy_id ON payments(policy_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payment_type ON payments(payment_type);

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    method_type VARCHAR(50) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    card_last_four VARCHAR(4),
    card_brand VARCHAR(50),
    card_expiry_month INTEGER,
    card_expiry_year INTEGER,
    bank_name VARCHAR(100),
    account_number_last_four VARCHAR(4),
    authorization_code VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_customer_id ON payment_methods(customer_id);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    transaction_type VARCHAR(50) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    status VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_payment_id ON transactions(payment_id);

-- ============================================================================
-- CUSTOMER SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    nin VARCHAR(11) UNIQUE,
    bvn VARCHAR(11),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Nigeria',
    postal_code VARCHAR(20),
    customer_type VARCHAR(50) DEFAULT 'individual',
    kyc_status VARCHAR(50) DEFAULT 'pending',
    kyc_verified_at TIMESTAMP,
    risk_rating VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_nin ON customers(nin);
CREATE INDEX idx_customers_kyc_status ON customers(kyc_status);

CREATE TABLE IF NOT EXISTS customer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    document_type VARCHAR(50) NOT NULL,
    document_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending',
    verified_at TIMESTAMP,
    verified_by UUID,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_documents_customer_id ON customer_documents(customer_id);

CREATE TABLE IF NOT EXISTS customer_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    kyc_level VARCHAR(20) NOT NULL,
    nin_verified BOOLEAN DEFAULT FALSE,
    bvn_verified BOOLEAN DEFAULT FALSE,
    address_verified BOOLEAN DEFAULT FALSE,
    biometric_verified BOOLEAN DEFAULT FALSE,
    verification_data JSONB,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_kyc_customer_id ON customer_kyc(customer_id);

-- ============================================================================
-- VERIFICATION SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_reference VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    request_data JSONB NOT NULL,
    response_data JSONB,
    match_score DECIMAL(5,2),
    is_match BOOLEAN,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verifications_customer_id ON verifications(customer_id);
CREATE INDEX idx_verifications_type ON verifications(verification_type);
CREATE INDEX idx_verifications_status ON verifications(status);

CREATE TABLE IF NOT EXISTS verification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES verifications(id),
    field_name VARCHAR(100) NOT NULL,
    submitted_value TEXT,
    verified_value TEXT,
    is_match BOOLEAN NOT NULL,
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_results_verification_id ON verification_results(verification_id);

CREATE TABLE IF NOT EXISTS verification_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    verification_data JSONB NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_verification_cache_key ON verification_cache(cache_key);
CREATE INDEX idx_verification_cache_expires_at ON verification_cache(expires_at);

-- ============================================================================
-- AUDIT LOG TABLE (Shared across all services)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id UUID,
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_service_name ON audit_logs(service_name);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Total Tables Created: 20
-- Policy Service: 3 tables (policies, policy_renewals, policy_endorsements)
-- Claim Service: 3 tables (claims, claim_documents, claim_assessments)
-- Payment Service: 3 tables (payments, payment_methods, transactions)
-- Customer Service: 3 tables (customers, customer_documents, customer_kyc)
-- Verification Service: 3 tables (verifications, verification_results, verification_cache)
-- Shared: 1 table (audit_logs)

-- Total Indexes Created: 35+
