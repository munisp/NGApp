CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'email' CHECK (type IN ('email', 'sms', 'push', 'whatsapp', 'in_app', 'multi_channel')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
    target_segment JSONB DEFAULT '{}',
    content JSONB DEFAULT '{}',
    schedule JSONB DEFAULT '{}',
    budget_amount DECIMAL(15,2) DEFAULT 0.0,
    budget_currency VARCHAR(3) DEFAULT 'NGN',
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    roi_percentage DECIMAL(8,2) DEFAULT 0.0,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_type ON campaigns(tenant_id, type);
CREATE INDEX idx_campaigns_starts ON campaigns(starts_at);

CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task', 'sms', 'whatsapp', 'chat', 'visit')),
    channel VARCHAR(50) DEFAULT 'manual',
    subject VARCHAR(255),
    content TEXT,
    direction VARCHAR(10) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed')),
    duration_seconds INTEGER,
    sentiment VARCHAR(20),
    assigned_to UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_tenant ON interactions(tenant_id);
CREATE INDEX idx_interactions_customer ON interactions(customer_id);
CREATE INDEX idx_interactions_type ON interactions(tenant_id, type);
CREATE INDEX idx_interactions_created ON interactions(tenant_id, created_at DESC);
