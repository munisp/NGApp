-- Telco vertical schema
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    msisdn VARCHAR(20) NOT NULL,
    imsi VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan_id UUID REFERENCES telco_plans(id),
    activation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_type VARCHAR(100),
    data_usage_mb BIGINT DEFAULT 0,
    voice_minutes_used INT DEFAULT 0,
    last_activity TIMESTAMPTZ,
    churn_risk_score DECIMAL(5,4),
    arpu DECIMAL(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, msisdn)
);

CREATE TABLE IF NOT EXISTS telco_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- prepaid, postpaid, hybrid
    data_cap_gb DECIMAL(10,2),
    voice_minutes INT,
    sms_limit INT,
    monthly_price DECIMAL(12,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cell_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    site_id VARCHAR(50) NOT NULL,
    name VARCHAR(200),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    technology VARCHAR(10) NOT NULL, -- 2G, 3G, 4G, 5G
    status VARCHAR(20) NOT NULL DEFAULT 'operational',
    capacity_utilization DECIMAL(5,2),
    last_maintenance TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sim_lifecycle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    iccid VARCHAR(22) NOT NULL,
    msisdn VARCHAR(20),
    status VARCHAR(20) NOT NULL, -- provisioned, activated, suspended, deactivated, ported_out
    action VARCHAR(30) NOT NULL,
    performed_by UUID,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS interconnect_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    partner_name VARCHAR(200) NOT NULL,
    agreement_type VARCHAR(30) NOT NULL, -- voice, data, roaming, sms
    rate_per_minute DECIMAL(10,6),
    rate_per_mb DECIMAL(10,6),
    settlement_period VARCHAR(20) DEFAULT 'monthly',
    status VARCHAR(20) DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscribers_tenant ON subscribers(tenant_id);
CREATE INDEX idx_subscribers_msisdn ON subscribers(msisdn);
CREATE INDEX idx_cell_sites_tenant ON cell_sites(tenant_id);
CREATE INDEX idx_sim_lifecycle_iccid ON sim_lifecycle(iccid);
