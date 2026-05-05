-- CRM Platform Database Initialization
-- PostgreSQL schema for multi-tenant CRM

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'trial',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    products JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    branding JSONB NOT NULL DEFAULT '{}',
    rate_limit INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    phone VARCHAR(20),
    bvn_hash VARCHAR(128),
    nin_hash VARCHAR(128),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    kyc_level INTEGER NOT NULL DEFAULT 1,
    risk_score DECIMAL(5,2) DEFAULT 0.0,
    products TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_status ON customers(tenant_id, status);
CREATE INDEX idx_customers_bvn ON customers(bvn_hash) WHERE bvn_hash IS NOT NULL;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    title VARCHAR(500) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    assignee VARCHAR(200),
    due_at TIMESTAMP WITH TIME ZONE,
    sla_breached BOOLEAN DEFAULT FALSE,
    related_type VARCHAR(50),
    related_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    title VARCHAR(500) NOT NULL,
    category VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    file_path VARCHAR(1000),
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by VARCHAR(200),
    expires_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
    name VARCHAR(500) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    target_segment JSONB DEFAULT '{}',
    content JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "converted": 0}',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id, status);

-- Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    actor_id VARCHAR(200) NOT NULL,
    actor_name VARCHAR(200),
    actor_type VARCHAR(30) NOT NULL DEFAULT 'user',
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(200),
    category VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    description TEXT,
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    hash_chain VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_events(tenant_id, created_at DESC);
CREATE INDEX idx_audit_category ON audit_events(category, severity);

-- Security Threats
CREATE TABLE IF NOT EXISTS security_threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    source_ip INET,
    target_path VARCHAR(500),
    matched_payload TEXT,
    rule_id VARCHAR(100),
    action_taken VARCHAR(30) NOT NULL,
    blocked BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_threats_time ON security_threats(created_at DESC);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    category VARCHAR(30) NOT NULL,
    reported_by VARCHAR(200),
    assigned_to VARCHAR(200),
    impact TEXT,
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PBAC Policies
CREATE TABLE IF NOT EXISTS pbac_policies (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    effect VARCHAR(10) NOT NULL DEFAULT 'allow',
    subjects JSONB NOT NULL DEFAULT '[]',
    resources JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    conditions JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Tenants
INSERT INTO tenants (id, name, tier, status, products, rate_limit) VALUES
    ('tenant-acme-bank', 'Acme Microfinance Bank', 'enterprise', 'active', '{"core_banking": true, "agent_banking": true, "remittance": true, "payments": true, "merchant": true, "mobile_money": true}', 1000),
    ('tenant-quickcash', 'QuickCash Mobile Money', 'growth', 'active', '{"agent_banking": true, "payments": true}', 500),
    ('tenant-swiftremit', 'SwiftRemit International', 'enterprise', 'active', '{"remittance": true, "payments": true}', 2000),
    ('tenant-nextgen-mfb', 'NextGen MFB', 'trial', 'active', '{"core_banking": true, "agent_banking": true}', 100)
ON CONFLICT (id) DO NOTHING;
