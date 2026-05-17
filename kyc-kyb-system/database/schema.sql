-- KYC/KYB System Database Schema
-- PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Document Verification Service Tables

CREATE TABLE IF NOT EXISTS document_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    ocr_engine VARCHAR(50),
    extracted_data JSONB,
    verification_status VARCHAR(50) DEFAULT 'pending',
    fraud_score DECIMAL(5,2),
    fraud_indicators JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_documents_customer (customer_id),
    INDEX idx_documents_status (verification_status)
);

-- Liveness Detection Service Tables

CREATE TABLE IF NOT EXISTS liveness_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    document_id UUID,
    liveness_type VARCHAR(50) NOT NULL,
    video_path VARCHAR(500),
    image_path VARCHAR(500),
    liveness_score DECIMAL(5,2),
    face_match_score DECIMAL(5,2),
    is_live BOOLEAN DEFAULT FALSE,
    spoofing_detected BOOLEAN DEFAULT FALSE,
    spoofing_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB,
    error_message VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_liveness_customer (customer_id),
    INDEX idx_liveness_status (status)
);

-- AML Screening Service Tables

CREATE TABLE IF NOT EXISTS aml_screenings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    screening_type VARCHAR(50) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    date_of_birth DATE,
    nationality VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    risk_level VARCHAR(50),
    match_score DECIMAL(5,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_aml_customer (customer_id),
    INDEX idx_aml_status (status),
    INDEX idx_aml_risk (risk_level)
);

CREATE TABLE IF NOT EXISTS aml_hits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    screening_id UUID NOT NULL REFERENCES aml_screenings(id) ON DELETE CASCADE,
    list_name VARCHAR(200) NOT NULL,
    matched_name VARCHAR(200) NOT NULL,
    match_score DECIMAL(5,2),
    category VARCHAR(100),
    description TEXT,
    source VARCHAR(200),
    date_added DATE,
    risk_level VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hits_screening (screening_id),
    INDEX idx_hits_risk (risk_level)
);

-- Risk Scoring Service Tables

CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    dd_level VARCHAR(50) NOT NULL,
    identity_score DECIMAL(5,2),
    document_score DECIMAL(5,2),
    aml_score DECIMAL(5,2),
    behavior_score DECIMAL(5,2),
    geographic_score DECIMAL(5,2),
    transaction_score DECIMAL(5,2),
    recommendations JSONB,
    model_version VARCHAR(50),
    calculated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_risk_customer (customer_id),
    INDEX idx_risk_level (risk_level),
    INDEX idx_risk_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS risk_factors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_score_id UUID NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    factor VARCHAR(200) NOT NULL,
    impact DECIMAL(5,2),
    severity VARCHAR(50),
    description TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_factors_score (risk_score_id),
    INDEX idx_factors_severity (severity)
);

-- Insert default document types
INSERT INTO document_types (name, description) VALUES
    ('national_id', 'Nigerian National Identity Card'),
    ('passport', 'International Passport'),
    ('drivers_license', 'Driver''s License'),
    ('utility_bill', 'Utility Bill (Electricity, Water, etc.)'),
    ('cac_certificate', 'Corporate Affairs Commission Certificate'),
    ('bank_statement', 'Bank Account Statement')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liveness_created ON liveness_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aml_created ON aml_screenings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_created ON risk_scores(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liveness_updated_at BEFORE UPDATE ON liveness_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aml_updated_at BEFORE UPDATE ON aml_screenings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_updated_at BEFORE UPDATE ON risk_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
