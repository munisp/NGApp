-- CPaaS vertical schema
CREATE TABLE IF NOT EXISTS api_consumers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    organization_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    api_tier VARCHAR(20) NOT NULL DEFAULT 'starter', -- starter, growth, enterprise
    monthly_quota INT NOT NULL DEFAULT 10000,
    messages_sent BIGINT DEFAULT 0,
    api_calls_total BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    onboarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_api_call TIMESTAMPTZ,
    webhook_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    consumer_id UUID REFERENCES api_consumers(id),
    channel VARCHAR(20) NOT NULL, -- sms, whatsapp, voice, video, email, push
    direction VARCHAR(10) NOT NULL, -- outbound, inbound
    sender_id VARCHAR(50),
    recipient VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- queued, sent, delivered, failed, rejected
    dlr_status VARCHAR(20), -- delivery report status
    content_type VARCHAR(20) DEFAULT 'text',
    message_cost DECIMAL(10,6),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sender_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    consumer_id UUID REFERENCES api_consumers(id),
    sender_id VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, suspended
    registration_type VARCHAR(20), -- 10DLC, short_code, alphanumeric
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    consumer_id UUID REFERENCES api_consumers(id),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending',
    response_code INT,
    attempts INT DEFAULT 0,
    next_retry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_analytics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    channel VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    messages_sent BIGINT DEFAULT 0,
    messages_delivered BIGINT DEFAULT 0,
    messages_failed BIGINT DEFAULT 0,
    delivery_rate DECIMAL(5,4),
    avg_latency_ms INT,
    revenue DECIMAL(12,2) DEFAULT 0,
    UNIQUE(tenant_id, channel, date)
);

CREATE INDEX idx_api_consumers_tenant ON api_consumers(tenant_id);
CREATE INDEX idx_message_logs_tenant ON message_logs(tenant_id);
CREATE INDEX idx_message_logs_channel ON message_logs(channel);
CREATE INDEX idx_message_logs_status ON message_logs(status);
CREATE INDEX idx_webhook_events_consumer ON webhook_events(consumer_id);
CREATE INDEX idx_channel_analytics_date ON channel_analytics(tenant_id, date);
