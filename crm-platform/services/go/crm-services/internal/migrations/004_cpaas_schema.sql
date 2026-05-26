-- CPaaS vertical schema
-- Covers channels, messages, developers, webhooks, A2P compliance

CREATE TABLE IF NOT EXISTS cpaas_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    throughput_limit INT,
    monthly_volume BIGINT DEFAULT 0,
    delivery_rate DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpaas_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    channel_id UUID REFERENCES cpaas_channels(id),
    direction VARCHAR(10) NOT NULL,
    sender VARCHAR(100),
    recipient VARCHAR(100),
    content_type VARCHAR(20) DEFAULT 'text',
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    delivery_status VARCHAR(20),
    cost DECIMAL(10,4),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpaas_developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(64),
    status VARCHAR(20) DEFAULT 'active',
    tier VARCHAR(20) DEFAULT 'free',
    monthly_quota INT DEFAULT 1000,
    monthly_usage INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpaas_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    developer_id UUID REFERENCES cpaas_developers(id),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    secret_hash VARCHAR(64),
    failure_count INT DEFAULT 0,
    last_triggered TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cpaas_a2p_senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sender_id VARCHAR(20) NOT NULL,
    brand_name VARCHAR(100),
    registration_status VARCHAR(20) DEFAULT 'pending',
    compliance_score DECIMAL(5,2),
    monthly_volume BIGINT DEFAULT 0,
    approved_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cpaas_channels_tenant ON cpaas_channels(tenant_id);
CREATE INDEX idx_cpaas_messages_tenant ON cpaas_messages(tenant_id);
CREATE INDEX idx_cpaas_messages_status ON cpaas_messages(status);
CREATE INDEX idx_cpaas_developers_tenant ON cpaas_developers(tenant_id);
CREATE INDEX idx_cpaas_webhooks_tenant ON cpaas_webhooks(tenant_id);
CREATE INDEX idx_cpaas_a2p_senders_tenant ON cpaas_a2p_senders(tenant_id);
