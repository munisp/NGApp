-- Migration: 010_agentic_ai_schema
-- AI agents, governance, and automation tables

CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sales', 'cs', 'analytics', 'compliance', 'custom')),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    config JSONB DEFAULT '{}',
    permissions JSONB DEFAULT '[]',
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-4',
    max_tokens_per_day INTEGER DEFAULT 100000,
    cost_limit_daily NUMERIC(10,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_agent_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    agent_id UUID REFERENCES ai_agents(id),
    action_type VARCHAR(100) NOT NULL,
    input JSONB,
    output JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost NUMERIC(10,4) DEFAULT 0,
    latency_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_governance_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    agent_id UUID REFERENCES ai_agents(id),
    event_type VARCHAR(100) NOT NULL,
    details JSONB,
    reviewer VARCHAR(255),
    review_status VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semantic_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    metadata JSONB DEFAULT '{}',
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_agents_tenant ON ai_agents(tenant_id, status);
CREATE INDEX idx_ai_actions_agent ON ai_agent_actions(agent_id, created_at DESC);
CREATE INDEX idx_ai_actions_tenant ON ai_agent_actions(tenant_id, created_at DESC);
CREATE INDEX idx_ai_governance_tenant ON ai_governance_rules(tenant_id, is_active);
CREATE INDEX idx_ai_audit_tenant ON ai_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_semantic_search_tenant ON semantic_search_index(tenant_id, entity_type);
