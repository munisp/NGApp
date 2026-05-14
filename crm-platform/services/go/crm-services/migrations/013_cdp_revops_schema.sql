-- Migration: 013_cdp_revops_schema
-- Customer Data Platform, RevOps, and deal management tables

CREATE TABLE IF NOT EXISTS customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    external_id VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    title VARCHAR(255),
    source VARCHAR(100),
    segment VARCHAR(100),
    lifecycle_stage VARCHAR(50) DEFAULT 'lead',
    score INTEGER DEFAULT 0,
    tags TEXT[],
    properties JSONB DEFAULT '{}',
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS customer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    profile_id UUID REFERENCES customer_profiles(id),
    event_name VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}',
    source VARCHAR(100),
    channel VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    member_count INTEGER DEFAULT 0,
    is_dynamic BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(500) NOT NULL,
    value NUMERIC(15,2),
    currency VARCHAR(3) DEFAULT 'NGN',
    stage VARCHAR(50) NOT NULL DEFAULT 'prospecting',
    probability INTEGER DEFAULT 0,
    owner_id VARCHAR(255),
    contact_id UUID REFERENCES customer_profiles(id),
    company VARCHAR(255),
    vertical VARCHAR(50),
    expected_close_date DATE,
    actual_close_date DATE,
    loss_reason TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id),
    tenant_id VARCHAR(64) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    performed_by VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    period VARCHAR(20) NOT NULL,
    forecast_type VARCHAR(50) NOT NULL DEFAULT 'weighted_pipeline',
    committed NUMERIC(15,2) DEFAULT 0,
    best_case NUMERIC(15,2) DEFAULT 0,
    pipeline NUMERIC(15,2) DEFAULT 0,
    closed NUMERIC(15,2) DEFAULT 0,
    target NUMERIC(15,2) DEFAULT 0,
    confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_profiles_tenant ON customer_profiles(tenant_id, lifecycle_stage);
CREATE INDEX idx_customer_profiles_email ON customer_profiles(tenant_id, email);
CREATE INDEX idx_customer_events_profile ON customer_events(profile_id, created_at DESC);
CREATE INDEX idx_segments_tenant ON segments(tenant_id);
CREATE INDEX idx_deals_tenant ON deals(tenant_id, stage);
CREATE INDEX idx_deals_owner ON deals(owner_id, stage);
CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id, created_at DESC);
CREATE INDEX idx_revenue_forecasts_tenant ON revenue_forecasts(tenant_id, period);
