-- KYC/KYB Analytics Tables for Lakehouse (Trino/Hive)

CREATE SCHEMA IF NOT EXISTS fintech_kyc;
CREATE SCHEMA IF NOT EXISTS fintech_kyb;

-- KYC Verifications fact table
CREATE TABLE IF NOT EXISTS fintech_kyc.verifications (
    verification_id VARCHAR,
    user_id VARCHAR,
    document_type VARCHAR,
    status VARCHAR,
    country VARCHAR,
    nationality VARCHAR,
    ocr_confidence DOUBLE,
    face_match BOOLEAN,
    face_confidence DOUBLE,
    liveness_score DOUBLE,
    fraud_risk_score DOUBLE,
    overall_risk_score DOUBLE,
    risk_level VARCHAR,
    auto_decision VARCHAR,
    verification_level INTEGER,
    reviewer_id VARCHAR,
    processing_time_ms BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    reviewed_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['country', 'status'],
    external_location = 's3a://fintech-lakehouse/kyc/verifications/'
);

-- KYC Reviews dimension table
CREATE TABLE IF NOT EXISTS fintech_kyc.reviews (
    review_id VARCHAR,
    verification_id VARCHAR,
    user_id VARCHAR,
    reviewer_id VARCHAR,
    action VARCHAR,
    risk_score_at_review DOUBLE,
    risk_level_at_review VARCHAR,
    notes VARCHAR,
    rejection_reason VARCHAR,
    review_duration_ms BIGINT,
    reviewed_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/kyc/reviews/'
);

-- KYC OCR Results
CREATE TABLE IF NOT EXISTS fintech_kyc.ocr_results (
    verification_id VARCHAR,
    document_type VARCHAR,
    confidence DOUBLE,
    fields_extracted INTEGER,
    country_detected VARCHAR,
    processing_time_ms BIGINT,
    created_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/kyc/ocr_results/'
);

-- KYC Face Verification Results
CREATE TABLE IF NOT EXISTS fintech_kyc.face_verifications (
    verification_id VARCHAR,
    is_match BOOLEAN,
    confidence DOUBLE,
    liveness_score DOUBLE,
    is_live BOOLEAN,
    anti_spoofing_flags VARCHAR,
    processing_time_ms BIGINT,
    created_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/kyc/face_verifications/'
);

-- KYC Audit Events (immutable)
CREATE TABLE IF NOT EXISTS fintech_kyc.audit_events (
    audit_id VARCHAR,
    verification_id VARCHAR,
    user_id VARCHAR,
    action VARCHAR,
    performed_by VARCHAR,
    details VARCHAR,
    ip_address VARCHAR,
    user_agent VARCHAR,
    created_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['action'],
    external_location = 's3a://fintech-lakehouse/kyc/audit_events/'
);

-- KYC Daily Summary (materialized)
CREATE TABLE IF NOT EXISTS fintech_kyc.daily_summary (
    date_key DATE,
    country VARCHAR,
    total_submissions INTEGER,
    total_approved INTEGER,
    total_rejected INTEGER,
    total_pending INTEGER,
    avg_risk_score DOUBLE,
    avg_ocr_confidence DOUBLE,
    avg_face_confidence DOUBLE,
    avg_processing_time_ms BIGINT,
    auto_approve_count INTEGER,
    auto_reject_count INTEGER,
    manual_review_count INTEGER
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['country'],
    external_location = 's3a://fintech-lakehouse/kyc/daily_summary/'
);

-- KYB Verifications fact table
CREATE TABLE IF NOT EXISTS fintech_kyb.verifications (
    verification_id VARCHAR,
    business_name VARCHAR,
    business_type VARCHAR,
    country VARCHAR,
    industry VARCHAR,
    status VARCHAR,
    risk_score DOUBLE,
    risk_level VARCHAR,
    sanctions_clean BOOLEAN,
    owner_count INTEGER,
    director_count INTEGER,
    pep_count INTEGER,
    total_ownership_declared DOUBLE,
    registration_verified BOOLEAN,
    tax_id_verified BOOLEAN,
    auto_decision VARCHAR,
    reviewer_id VARCHAR,
    processing_time_ms BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    reviewed_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['country', 'status'],
    external_location = 's3a://fintech-lakehouse/kyb/verifications/'
);

-- KYB Sanctions Screening Results
CREATE TABLE IF NOT EXISTS fintech_kyb.sanctions_screenings (
    screening_id VARCHAR,
    verification_id VARCHAR,
    entity_name VARCHAR,
    entity_type VARCHAR,
    sanctions_list VARCHAR,
    match_type VARCHAR,
    match_score DOUBLE,
    is_clean BOOLEAN,
    screened_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['sanctions_list'],
    external_location = 's3a://fintech-lakehouse/kyb/sanctions_screenings/'
);

-- KYB Beneficial Owners
CREATE TABLE IF NOT EXISTS fintech_kyb.beneficial_owners (
    owner_id VARCHAR,
    verification_id VARCHAR,
    nationality VARCHAR,
    ownership_percentage DOUBLE,
    is_politically_exposed BOOLEAN,
    sanctions_clean BOOLEAN,
    kyc_verification_id VARCHAR,
    kyc_status VARCHAR,
    created_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/kyb/beneficial_owners/'
);

-- KYB Risk Factors
CREATE TABLE IF NOT EXISTS fintech_kyb.risk_factors (
    factor_id VARCHAR,
    verification_id VARCHAR,
    factor VARCHAR,
    impact VARCHAR,
    description VARCHAR,
    score_contribution DOUBLE,
    assessed_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/kyb/risk_factors/'
);

-- KYB Audit Events
CREATE TABLE IF NOT EXISTS fintech_kyb.audit_events (
    audit_id VARCHAR,
    verification_id VARCHAR,
    action VARCHAR,
    performed_by VARCHAR,
    details VARCHAR,
    created_at TIMESTAMP
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['action'],
    external_location = 's3a://fintech-lakehouse/kyb/audit_events/'
);

-- KYB Daily Summary
CREATE TABLE IF NOT EXISTS fintech_kyb.daily_summary (
    date_key DATE,
    country VARCHAR,
    industry VARCHAR,
    total_submissions INTEGER,
    total_approved INTEGER,
    total_rejected INTEGER,
    total_pending INTEGER,
    avg_risk_score DOUBLE,
    sanctions_hit_count INTEGER,
    pep_count INTEGER,
    high_risk_count INTEGER
) WITH (
    format = 'PARQUET',
    partitioned_by = ARRAY['country'],
    external_location = 's3a://fintech-lakehouse/kyb/daily_summary/'
);

-- Prebuilt Analytics Queries

-- KYC Approval Rate by Country
-- SELECT country, COUNT(*) as total, 
--        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
--        CAST(SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) as approval_rate
-- FROM fintech_kyc.verifications GROUP BY country;

-- KYB High Risk Industries
-- SELECT industry, COUNT(*) as total, AVG(risk_score) as avg_risk,
--        SUM(CASE WHEN risk_level='high' THEN 1 ELSE 0 END) as high_risk_count
-- FROM fintech_kyb.verifications GROUP BY industry ORDER BY avg_risk DESC;

-- Sanctions Hit Rate
-- SELECT sanctions_list, COUNT(*) as total_screenings,
--        SUM(CASE WHEN is_clean=false THEN 1 ELSE 0 END) as hits,
--        CAST(SUM(CASE WHEN is_clean=false THEN 1 ELSE 0 END) AS DOUBLE) / COUNT(*) as hit_rate
-- FROM fintech_kyb.sanctions_screenings GROUP BY sanctions_list;
