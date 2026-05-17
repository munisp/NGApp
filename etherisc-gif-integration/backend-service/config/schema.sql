-- Blockchain Policies Table
CREATE TABLE IF NOT EXISTS blockchain_policies (
    id SERIAL PRIMARY KEY,
    policy_id BYTEA NOT NULL UNIQUE,
    customer_id VARCHAR(255) NOT NULL,
    customer_address VARCHAR(42) NOT NULL,
    product_type VARCHAR(50) NOT NULL, -- 'flight_delay', 'crop', 'weather'
    coverage_amount BIGINT NOT NULL,
    premium BIGINT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    active BOOLEAN DEFAULT true,
    claimed BOOLEAN DEFAULT false,
    
    -- Flight-specific fields
    flight_number VARCHAR(20),
    departure_time TIMESTAMP,
    delay_threshold INTEGER, -- in minutes
    departure_airport VARCHAR(10),
    arrival_airport VARCHAR(10),
    payout_percentage INTEGER, -- basis points
    
    -- Blockchain fields
    blockchain_tx_hash VARCHAR(66),
    block_number BIGINT,
    contract_address VARCHAR(42),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_customer_address (customer_address),
    INDEX idx_product_type (product_type),
    INDEX idx_flight_number (flight_number),
    INDEX idx_departure_time (departure_time),
    INDEX idx_active (active),
    INDEX idx_claimed (claimed)
);

-- Blockchain Claims Table
CREATE TABLE IF NOT EXISTS blockchain_claims (
    id SERIAL PRIMARY KEY,
    claim_id BYTEA NOT NULL UNIQUE,
    policy_id BYTEA NOT NULL REFERENCES blockchain_policies(policy_id),
    customer_address VARCHAR(42) NOT NULL,
    payout_amount BIGINT NOT NULL,
    claim_reason TEXT,
    
    -- Flight-specific fields
    actual_departure_time TIMESTAMP,
    delay_minutes INTEGER,
    
    -- Blockchain fields
    blockchain_tx_hash VARCHAR(66),
    block_number BIGINT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'rejected'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_policy_id (policy_id),
    INDEX idx_customer_address (customer_address),
    INDEX idx_status (status)
);

-- Blockchain Transactions Table
CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value BIGINT NOT NULL,
    gas_used BIGINT,
    gas_price BIGINT,
    block_number BIGINT,
    block_timestamp TIMESTAMP,
    
    -- Transaction type
    tx_type VARCHAR(50) NOT NULL, -- 'policy_creation', 'premium_payment', 'claim_trigger', 'payout'
    
    -- Related entities
    policy_id BYTEA,
    claim_id BYTEA,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_from_address (from_address),
    INDEX idx_to_address (to_address),
    INDEX idx_policy_id (policy_id),
    INDEX idx_claim_id (claim_id),
    INDEX idx_tx_type (tx_type),
    INDEX idx_status (status),
    INDEX idx_block_number (block_number)
);

-- Blockchain Wallets Table
CREATE TABLE IF NOT EXISTS blockchain_wallets (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(255) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL UNIQUE,
    encrypted_private_key TEXT NOT NULL, -- Encrypted with platform key
    public_key TEXT NOT NULL,
    
    -- Balance tracking
    balance BIGINT DEFAULT 0,
    last_balance_update TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_wallet_address (wallet_address)
);

-- Risk Pools Table
CREATE TABLE IF NOT EXISTS blockchain_risk_pools (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(42) NOT NULL UNIQUE,
    product_type VARCHAR(50) NOT NULL,
    total_capital BIGINT DEFAULT 0,
    available_capital BIGINT DEFAULT 0,
    locked_capital BIGINT DEFAULT 0,
    total_premiums BIGINT DEFAULT 0,
    total_payouts BIGINT DEFAULT 0,
    min_capital BIGINT NOT NULL,
    active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_product_type (product_type),
    INDEX idx_active (active)
);

-- Oracle Data Table
CREATE TABLE IF NOT EXISTS oracle_data (
    id SERIAL PRIMARY KEY,
    data_id BYTEA NOT NULL UNIQUE,
    data_type VARCHAR(50) NOT NULL, -- 'flight', 'weather', 'iot'
    data_payload JSONB NOT NULL,
    
    -- Flight-specific fields
    flight_number VARCHAR(20),
    scheduled_departure_time TIMESTAMP,
    actual_departure_time TIMESTAMP,
    delay_minutes INTEGER,
    
    -- Weather-specific fields
    location VARCHAR(255),
    temperature DECIMAL(5, 2),
    rainfall DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    
    -- Blockchain fields
    blockchain_tx_hash VARCHAR(66),
    block_number BIGINT,
    verified BOOLEAN DEFAULT false,
    submitter_address VARCHAR(42),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_data_type (data_type),
    INDEX idx_flight_number (flight_number),
    INDEX idx_location (location),
    INDEX idx_verified (verified)
);

-- Payment Gateway Transactions Table
CREATE TABLE IF NOT EXISTS payment_gateway_transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    customer_id VARCHAR(255) NOT NULL,
    policy_id BYTEA,
    
    -- Fiat payment
    fiat_amount BIGINT NOT NULL, -- in kobo/cents
    fiat_currency VARCHAR(3) DEFAULT 'NGN',
    payment_method VARCHAR(50), -- 'paystack', 'flutterwave'
    payment_reference VARCHAR(255),
    payment_status VARCHAR(20), -- 'pending', 'success', 'failed'
    
    -- Crypto conversion
    crypto_amount BIGINT, -- in wei/smallest unit
    crypto_currency VARCHAR(10), -- 'USDC', 'DAI', 'MATIC'
    exchange_rate DECIMAL(20, 8),
    
    -- Blockchain transaction
    blockchain_tx_hash VARCHAR(66),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_customer_id (customer_id),
    INDEX idx_policy_id (policy_id),
    INDEX idx_payment_status (payment_status)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_blockchain_policies_updated_at BEFORE UPDATE ON blockchain_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_claims_updated_at BEFORE UPDATE ON blockchain_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_wallets_updated_at BEFORE UPDATE ON blockchain_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_risk_pools_updated_at BEFORE UPDATE ON blockchain_risk_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_gateway_transactions_updated_at BEFORE UPDATE ON payment_gateway_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
