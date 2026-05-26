-- CRM Platform Base Schema
-- Multi-tenant, multi-vertical foundation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============== Core Tables ==============

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN ('banking', 'telco', 'commodity', 'cpaas')),
    products JSONB NOT NULL DEFAULT '[]',
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    permissions JSONB NOT NULL DEFAULT '[]',
    keycloak_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    external_id VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    segment VARCHAR(50),
    health_score INTEGER DEFAULT 50,
    lifetime_value DECIMAL(15,2) DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_segment ON customers(tenant_id, segment);

CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    channel VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT,
    sentiment DECIMAL(3,2),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_customer ON interactions(customer_id);
CREATE INDEX idx_interactions_tenant_date ON interactions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    channels JSONB NOT NULL DEFAULT '[]',
    audience_filter JSONB NOT NULL DEFAULT '{}',
    content JSONB NOT NULL DEFAULT '{}',
    metrics JSONB NOT NULL DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_date ON audit_log(tenant_id, created_at DESC);

-- ============== Banking Vertical ==============

CREATE TABLE IF NOT EXISTS banking_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    bvn VARCHAR(11),
    nin VARCHAR(11),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banking_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES banking_accounts(id),
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(100) UNIQUE,
    counterparty_account VARCHAR(20),
    channel VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banking_txn_account ON banking_transactions(account_id, created_at DESC);

-- ============== Telco Vertical ==============

CREATE TABLE IF NOT EXISTS telco_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    msisdn VARCHAR(15) UNIQUE NOT NULL,
    sim_iccid VARCHAR(20),
    plan_name VARCHAR(100),
    plan_type VARCHAR(50),
    data_balance_mb DECIMAL(10,2) DEFAULT 0,
    voice_balance_min DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    ncc_registered BOOLEAN DEFAULT FALSE,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    subscriber_id UUID NOT NULL REFERENCES telco_subscribers(id),
    usage_type VARCHAR(20) NOT NULL CHECK (usage_type IN ('data', 'voice', 'sms')),
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    cost DECIMAL(10,2),
    cell_site_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telco_usage_subscriber ON telco_usage(subscriber_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telco_cell_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    site_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    technology VARCHAR(10) NOT NULL CHECK (technology IN ('2G', '3G', '4G', '5G')),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status VARCHAR(20) NOT NULL DEFAULT 'operational',
    traffic_load DECIMAL(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============== Commodity Vertical ==============

CREATE TABLE IF NOT EXISTS commodity_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trade_id VARCHAR(50) UNIQUE NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    price DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    buyer_id UUID REFERENCES customers(id),
    seller_id UUID REFERENCES customers(id),
    trade_type VARCHAR(20) NOT NULL CHECK (trade_type IN ('spot', 'forward', 'futures', 'options')),
    settlement_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    settlement_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_tenant ON commodity_trades(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS commodity_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    commodity VARCHAR(100) NOT NULL,
    net_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
    avg_price DECIMAL(15,4) NOT NULL DEFAULT 0,
    unrealized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
    margin_requirement DECIMAL(15,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, commodity)
);

-- ============== CPaaS Vertical ==============

CREATE TABLE IF NOT EXISTS cpaas_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    message_id VARCHAR(100) UNIQUE NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'voice', 'email', 'push', 'rcs')),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_address VARCHAR(100),
    to_address VARCHAR(100),
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    latency_ms INTEGER,
    cost DECIMAL(10,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cpaas_messages_tenant ON cpaas_messages(tenant_id, created_at DESC);
CREATE INDEX idx_cpaas_messages_status ON cpaas_messages(status);

CREATE TABLE IF NOT EXISTS cpaas_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    key_prefix VARCHAR(10) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit INTEGER NOT NULL DEFAULT 100,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
