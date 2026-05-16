-- 001_initial_schema.sql

-- Table for Cession events
CREATE TABLE IF NOT EXISTS cessions (
    id UUID PRIMARY KEY,
    policy_id UUID NOT NULL,
    reinsurer_id UUID NOT NULL,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC NOT NULL,
    currency VARCHAR(3) NOT NULL,
    ceded_share NUMERIC NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for Cession Calculation results
CREATE TABLE IF NOT EXISTS cession_calculations (
    id UUID PRIMARY KEY,
    cession_id UUID NOT NULL REFERENCES cessions(id),
    ceded_amount NUMERIC NOT NULL,
    commission NUMERIC NOT NULL,
    net_payable NUMERIC NOT NULL,
    calculation_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table for Reinsurer Balances
CREATE TABLE IF NOT EXISTS reinsurer_balances (
    id UUID PRIMARY KEY,
    reinsurer_id UUID NOT NULL,
    month DATE NOT NULL,
    total_premium NUMERIC DEFAULT 0,
    total_claim NUMERIC DEFAULT 0,
    total_commission NUMERIC DEFAULT 0,
    net_balance NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (reinsurer_id, month)
);

-- Table for Bordereaux
CREATE TABLE IF NOT EXISTS bordereaux (
    id UUID PRIMARY KEY,
    reinsurer_id UUID NOT NULL,
    statement_month DATE NOT NULL,
    status VARCHAR(10) NOT NULL,
    total_net_payable NUMERIC NOT NULL,
    file_path VARCHAR(255),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Table for Settlement Workflows
CREATE TABLE IF NOT EXISTS settlement_workflows (
    id UUID PRIMARY KEY,
    bordereau_id UUID NOT NULL REFERENCES bordereaux(id),
    payment_ref VARCHAR(255),
    amount NUMERIC NOT NULL,
    direction VARCHAR(10) NOT NULL,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
