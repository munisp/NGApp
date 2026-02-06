-- Core Banking Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.corebanking_accounts (
    account_id VARCHAR,
    user_id VARCHAR,
    account_type VARCHAR,
    balance DECIMAL(18,2),
    currency VARCHAR(3),
    status VARCHAR(20),
    interest_rate DECIMAL(5,4),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    closed_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['account_type', 'currency']);

CREATE TABLE IF NOT EXISTS lakehouse.corebanking_transactions (
    transaction_id VARCHAR,
    from_account_id VARCHAR,
    to_account_id VARCHAR,
    amount DECIMAL(18,2),
    currency VARCHAR(3),
    type VARCHAR(20),
    status VARCHAR(20),
    fee DECIMAL(18,2),
    exchange_rate DECIMAL(12,6),
    created_at TIMESTAMP,
    completed_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['type', 'currency']);

CREATE TABLE IF NOT EXISTS lakehouse.corebanking_ledger (
    entry_id VARCHAR,
    account_id VARCHAR,
    debit_amount DECIMAL(18,2),
    credit_amount DECIMAL(18,2),
    balance DECIMAL(18,2),
    entry_type VARCHAR(30),
    reference VARCHAR,
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['entry_type']);

-- Payment Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.payment_transactions (
    payment_id VARCHAR,
    user_id VARCHAR,
    amount DECIMAL(18,2),
    currency VARCHAR(3),
    method VARCHAR(20),
    gateway VARCHAR(30),
    status VARCHAR(20),
    fee DECIMAL(18,2),
    recipient_id VARCHAR,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['method', 'status']);

CREATE TABLE IF NOT EXISTS lakehouse.payment_reconciliation (
    reconciliation_id VARCHAR,
    period VARCHAR,
    total_payments INTEGER,
    total_amount DECIMAL(18,2),
    total_fees DECIMAL(18,2),
    matched INTEGER,
    unmatched INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP
) WITH (format = 'PARQUET');

-- Insurance Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.insurance_policies (
    policy_id VARCHAR,
    user_id VARCHAR,
    product_id VARCHAR,
    product_type VARCHAR(20),
    premium DECIMAL(18,2),
    premium_frequency VARCHAR(20),
    coverage_amount DECIMAL(18,2),
    deductible DECIMAL(18,2),
    currency VARCHAR(3),
    status VARCHAR(20),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['product_type', 'status']);

CREATE TABLE IF NOT EXISTS lakehouse.insurance_claims (
    claim_id VARCHAR,
    policy_id VARCHAR,
    user_id VARCHAR,
    type VARCHAR(30),
    amount_claimed DECIMAL(18,2),
    amount_approved DECIMAL(18,2),
    status VARCHAR(20),
    submitted_at TIMESTAMP,
    reviewed_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['status']);

-- Investment Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.investment_holdings (
    holding_id VARCHAR,
    portfolio_id VARCHAR,
    user_id VARCHAR,
    product_id VARCHAR,
    product_type VARCHAR(20),
    units DECIMAL(18,6),
    buy_price DECIMAL(18,2),
    current_price DECIMAL(18,2),
    total_value DECIMAL(18,2),
    gain DECIMAL(18,2),
    bought_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['product_type']);

CREATE TABLE IF NOT EXISTS lakehouse.investment_fixed_deposits (
    fd_id VARCHAR,
    user_id VARCHAR,
    principal DECIMAL(18,2),
    rate DECIMAL(5,4),
    tenor_days INTEGER,
    maturity_date DATE,
    expected_yield DECIMAL(18,2),
    currency VARCHAR(3),
    status VARCHAR(20),
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['status']);

-- Merchant Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.merchant_profiles (
    merchant_id VARCHAR,
    user_id VARCHAR,
    business_name VARCHAR,
    business_type VARCHAR(30),
    country VARCHAR(3),
    currency VARCHAR(3),
    status VARCHAR(20),
    fee_rate DECIMAL(5,4),
    kyb_status VARCHAR(20),
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['country', 'status']);

CREATE TABLE IF NOT EXISTS lakehouse.merchant_transactions (
    transaction_id VARCHAR,
    merchant_id VARCHAR,
    customer_id VARCHAR,
    amount DECIMAL(18,2),
    fee DECIMAL(18,2),
    net DECIMAL(18,2),
    currency VARCHAR(3),
    method VARCHAR(20),
    status VARCHAR(20),
    pos_terminal VARCHAR,
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['method', 'status']);

CREATE TABLE IF NOT EXISTS lakehouse.merchant_settlements (
    settlement_id VARCHAR,
    merchant_id VARCHAR,
    amount DECIMAL(18,2),
    fee DECIMAL(18,2),
    net_amount DECIMAL(18,2),
    transaction_count INTEGER,
    period VARCHAR,
    status VARCHAR(20),
    settled_at TIMESTAMP
) WITH (format = 'PARQUET');

-- African Markets Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.african_mobile_money (
    txn_id VARCHAR,
    wallet_id VARCHAR,
    user_id VARCHAR,
    provider VARCHAR(30),
    type VARCHAR(20),
    amount DECIMAL(18,2),
    fee DECIMAL(18,2),
    currency VARCHAR(3),
    recipient_phone VARCHAR,
    status VARCHAR(20),
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['provider', 'type']);

CREATE TABLE IF NOT EXISTS lakehouse.african_cooperative_groups (
    group_id VARCHAR,
    name VARCHAR,
    type VARCHAR(20),
    member_count INTEGER,
    contribution_amount DECIMAL(18,2),
    frequency VARCHAR(20),
    currency VARCHAR(3),
    total_pool DECIMAL(18,2),
    current_round INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['type']);

-- ML/AI Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.ml_predictions (
    prediction_id VARCHAR,
    service VARCHAR(30),
    model VARCHAR(50),
    confidence DECIMAL(5,4),
    latency_ms DECIMAL(10,2),
    input_hash VARCHAR,
    result_summary VARCHAR,
    timestamp TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['service']);

CREATE TABLE IF NOT EXISTS lakehouse.ml_fraud_alerts (
    alert_id VARCHAR,
    transaction_id VARCHAR,
    user_id VARCHAR,
    fraud_score DECIMAL(5,4),
    risk_level VARCHAR(20),
    signals_count INTEGER,
    recommendation VARCHAR(20),
    timestamp TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['risk_level']);

-- Tax Planning Analytics Tables
CREATE TABLE IF NOT EXISTS lakehouse.tax_calculations (
    calculation_id VARCHAR,
    user_id VARCHAR,
    jurisdiction VARCHAR(5),
    tax_year INTEGER,
    gross_income DECIMAL(18,2),
    taxable_income DECIMAL(18,2),
    total_tax DECIMAL(18,2),
    effective_rate DECIMAL(5,4),
    net_income DECIMAL(18,2),
    currency VARCHAR(3),
    calculated_at TIMESTAMP
) WITH (format = 'PARQUET', partitioning = ARRAY['jurisdiction']);

CREATE TABLE IF NOT EXISTS lakehouse.retirement_plans (
    plan_id VARCHAR,
    user_id VARCHAR,
    current_age INTEGER,
    retirement_age INTEGER,
    current_savings DECIMAL(18,2),
    monthly_contribution DECIMAL(18,2),
    projected_savings DECIMAL(18,2),
    savings_gap DECIMAL(18,2),
    currency VARCHAR(3),
    created_at TIMESTAMP
) WITH (format = 'PARQUET');

-- Prebuilt Analytics Views
CREATE OR REPLACE VIEW lakehouse.daily_transaction_volume AS
SELECT DATE(created_at) as txn_date, method, currency, COUNT(*) as txn_count, SUM(amount) as total_amount, SUM(fee) as total_fees
FROM lakehouse.payment_transactions WHERE status = 'completed' GROUP BY DATE(created_at), method, currency;

CREATE OR REPLACE VIEW lakehouse.insurance_loss_ratio AS
SELECT p.product_type, COUNT(DISTINCT p.policy_id) as policy_count, SUM(p.premium) as total_premiums, SUM(c.amount_approved) as total_claims, COALESCE(SUM(c.amount_approved), 0) / NULLIF(SUM(p.premium), 0) as loss_ratio
FROM lakehouse.insurance_policies p LEFT JOIN lakehouse.insurance_claims c ON p.policy_id = c.policy_id AND c.status = 'approved' GROUP BY p.product_type;

CREATE OR REPLACE VIEW lakehouse.merchant_revenue_summary AS
SELECT m.business_type, m.country, COUNT(DISTINCT m.merchant_id) as merchant_count, SUM(t.amount) as gross_revenue, SUM(t.fee) as total_fees, SUM(t.net) as net_revenue, COUNT(t.transaction_id) as txn_count
FROM lakehouse.merchant_profiles m JOIN lakehouse.merchant_transactions t ON m.merchant_id = t.merchant_id GROUP BY m.business_type, m.country;

CREATE OR REPLACE VIEW lakehouse.mobile_money_provider_stats AS
SELECT provider, currency, COUNT(*) as txn_count, SUM(amount) as total_volume, SUM(fee) as total_fees, AVG(amount) as avg_txn_size
FROM lakehouse.african_mobile_money WHERE status = 'completed' GROUP BY provider, currency;

CREATE OR REPLACE VIEW lakehouse.ml_model_performance AS
SELECT service, model, COUNT(*) as prediction_count, AVG(confidence) as avg_confidence, AVG(latency_ms) as avg_latency_ms, PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM lakehouse.ml_predictions GROUP BY service, model;

CREATE OR REPLACE VIEW lakehouse.tax_jurisdiction_summary AS
SELECT jurisdiction, tax_year, COUNT(*) as calculation_count, AVG(effective_rate) as avg_effective_rate, SUM(total_tax) as total_tax_collected, AVG(gross_income) as avg_income
FROM lakehouse.tax_calculations GROUP BY jurisdiction, tax_year;
