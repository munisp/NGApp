CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'starter', 'growth', 'enterprise')),
    primary_color VARCHAR(7) DEFAULT '#1E40AF',
    accent_color VARCHAR(7) DEFAULT '#7C3AED',
    default_currency VARCHAR(3) DEFAULT 'NGN',
    supported_currencies JSONB DEFAULT '["NGN"]',
    timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
    max_users INTEGER DEFAULT 10,
    max_agents INTEGER DEFAULT 50,
    api_rate_limit INTEGER DEFAULT 100,
    max_customers INTEGER DEFAULT 1000,
    max_transactions_per_day INTEGER DEFAULT 500,
    products JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);

-- Seed tenants
INSERT INTO tenants (slug, name, status, subscription_tier, primary_color, default_currency, max_users, max_agents, max_customers, products) VALUES
    ('acme-bank', 'Acme Microfinance Bank', 'active', 'enterprise', '#1E40AF', 'NGN', 500, 2000, 500000, '{"core_banking": true, "agent_banking": true, "remittance": true, "payments": true, "lending": true, "cards": true}'),
    ('quickcash', 'QuickCash Mobile Money', 'active', 'growth', '#059669', 'NGN', 50, 5000, 200000, '{"agent_banking": true, "payments": true}'),
    ('swiftremit', 'SwiftRemit International', 'active', 'enterprise', '#7C3AED', 'USD', 100, 0, 100000, '{"remittance": true, "payments": true}'),
    ('nextgen-mfb', 'NextGen MFB', 'trial', 'trial', '#DC2626', 'NGN', 10, 50, 1000, '{"core_banking": true, "agent_banking": true}')
ON CONFLICT (slug) DO NOTHING;
