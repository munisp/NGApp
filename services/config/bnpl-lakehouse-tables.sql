-- BNPL Lakehouse Analytics Tables
-- Stored in Trino/Hive Metastore with Parquet format on MinIO

CREATE SCHEMA IF NOT EXISTS bnpl;

CREATE TABLE IF NOT EXISTS bnpl.applications (
    application_id VARCHAR,
    user_id VARCHAR,
    category VARCHAR,
    merchant_name VARCHAR,
    principal_amount DECIMAL(18,2),
    interest_rate DECIMAL(5,2),
    total_interest DECIMAL(18,2),
    total_amount DECIMAL(18,2),
    monthly_payment DECIMAL(18,2),
    installment_months INTEGER,
    status VARCHAR,
    credit_score INTEGER,
    credit_grade VARCHAR,
    fraud_risk_score DECIMAL(5,4),
    fraud_risk_level VARCHAR,
    dti_ratio DECIMAL(5,4),
    recommended_action VARCHAR,
    auto_approved BOOLEAN,
    reviewer_id VARCHAR,
    rejection_reason VARCHAR,
    employment_status VARCHAR,
    monthly_income DECIMAL(18,2),
    created_at TIMESTAMP,
    approved_at TIMESTAMP,
    disbursed_at TIMESTAMP,
    completed_at TIMESTAMP,
    defaulted_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/applications/',
    partitioned_by = ARRAY['status']
);

CREATE TABLE IF NOT EXISTS bnpl.installments (
    installment_id VARCHAR,
    application_id VARCHAR,
    user_id VARCHAR,
    installment_number INTEGER,
    amount DECIMAL(18,2),
    principal_portion DECIMAL(18,2),
    interest_portion DECIMAL(18,2),
    late_fee DECIMAL(18,2),
    due_date TIMESTAMP,
    status VARCHAR,
    paid_amount DECIMAL(18,2),
    paid_at TIMESTAMP,
    payment_method VARCHAR,
    payment_reference VARCHAR,
    days_overdue INTEGER,
    grace_period_end TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/installments/',
    partitioned_by = ARRAY['status']
);

CREATE TABLE IF NOT EXISTS bnpl.payments (
    payment_id VARCHAR,
    application_id VARCHAR,
    installment_id VARCHAR,
    user_id VARCHAR,
    amount DECIMAL(18,2),
    payment_method VARCHAR,
    payment_reference VARCHAR,
    gateway_name VARCHAR,
    gateway_status VARCHAR,
    paid_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/payments/'
);

CREATE TABLE IF NOT EXISTS bnpl.disbursements (
    disbursement_id VARCHAR,
    application_id VARCHAR,
    user_id VARCHAR,
    amount DECIMAL(18,2),
    disbursement_method VARCHAR,
    recipient_account VARCHAR,
    recipient_name VARCHAR,
    status VARCHAR,
    disbursed_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/disbursements/'
);

CREATE TABLE IF NOT EXISTS bnpl.credit_decisions (
    application_id VARCHAR,
    user_id VARCHAR,
    credit_score INTEGER,
    credit_grade VARCHAR,
    fraud_risk_score DECIMAL(5,4),
    fraud_risk_level VARCHAR,
    dti_ratio DECIMAL(5,4),
    max_approved_amount DECIMAL(18,2),
    recommended_action VARCHAR,
    auto_approve BOOLEAN,
    auto_reject BOOLEAN,
    confidence DECIMAL(5,4),
    risk_factors_json VARCHAR,
    assessed_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/credit_decisions/'
);

CREATE TABLE IF NOT EXISTS bnpl.overdue_events (
    event_id VARCHAR,
    application_id VARCHAR,
    user_id VARCHAR,
    installment_number INTEGER,
    days_overdue INTEGER,
    late_fee_amount DECIMAL(18,2),
    cumulative_late_fees DECIMAL(18,2),
    consecutive_overdue INTEGER,
    defaulted BOOLEAN,
    detected_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/overdue_events/'
);

CREATE TABLE IF NOT EXISTS bnpl.notifications (
    notification_id VARCHAR,
    user_id VARCHAR,
    application_id VARCHAR,
    notification_type VARCHAR,
    title VARCHAR,
    message VARCHAR,
    read_status BOOLEAN,
    created_at TIMESTAMP
)
WITH (
    format = 'PARQUET',
    external_location = 's3a://fintech-lakehouse/bnpl/notifications/'
);

-- Prebuilt analytics views

CREATE OR REPLACE VIEW bnpl.application_summary AS
SELECT
    status,
    COUNT(*) as total_applications,
    AVG(principal_amount) as avg_principal,
    SUM(principal_amount) as total_principal,
    AVG(credit_score) as avg_credit_score,
    AVG(fraud_risk_score) as avg_fraud_risk,
    AVG(interest_rate) as avg_interest_rate
FROM bnpl.applications
GROUP BY status;

CREATE OR REPLACE VIEW bnpl.monthly_disbursements AS
SELECT
    DATE_TRUNC('month', disbursed_at) as month,
    COUNT(*) as disbursement_count,
    SUM(amount) as total_disbursed,
    AVG(amount) as avg_disbursement
FROM bnpl.disbursements
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', disbursed_at)
ORDER BY month DESC;

CREATE OR REPLACE VIEW bnpl.payment_collection_rate AS
SELECT
    DATE_TRUNC('month', due_date) as month,
    COUNT(*) as total_installments,
    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
    SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
    SUM(amount) as total_expected,
    SUM(paid_amount) as total_collected,
    SUM(late_fee) as total_late_fees
FROM bnpl.installments
GROUP BY DATE_TRUNC('month', due_date)
ORDER BY month DESC;

CREATE OR REPLACE VIEW bnpl.default_risk_analysis AS
SELECT
    a.category,
    a.employment_status,
    COUNT(*) as total_applications,
    SUM(CASE WHEN a.status = 'defaulted' THEN 1 ELSE 0 END) as defaults,
    AVG(a.credit_score) as avg_credit_score,
    AVG(a.fraud_risk_score) as avg_fraud_risk,
    AVG(a.principal_amount) as avg_principal
FROM bnpl.applications a
GROUP BY a.category, a.employment_status;

CREATE OR REPLACE VIEW bnpl.credit_decision_distribution AS
SELECT
    recommended_action,
    COUNT(*) as total,
    AVG(credit_score) as avg_score,
    AVG(fraud_risk_score) as avg_fraud_risk,
    AVG(max_approved_amount) as avg_max_approved
FROM bnpl.credit_decisions
GROUP BY recommended_action;
