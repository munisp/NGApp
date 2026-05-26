CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(10),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(3) DEFAULT 'NGA',
    postal_code VARCHAR(20),
    segment VARCHAR(50) DEFAULT 'standard' CHECK (segment IN ('vip', 'premium', 'standard', 'basic', 'dormant')),
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'closed', 'pending_kyc')),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('verified', 'pending', 'failed', 'expired')),
    risk_score DECIMAL(5,2) DEFAULT 0.0,
    lifetime_value DECIMAL(15,2) DEFAULT 0.0,
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(tenant_id, email);
CREATE INDEX idx_customers_phone ON customers(tenant_id, phone);
CREATE INDEX idx_customers_segment ON customers(tenant_id, segment);
CREATE INDEX idx_customers_status ON customers(tenant_id, status);
CREATE INDEX idx_customers_name_trgm ON customers USING gin((first_name || ' ' || last_name) gin_trgm_ops);
CREATE INDEX idx_customers_created ON customers(tenant_id, created_at DESC);
