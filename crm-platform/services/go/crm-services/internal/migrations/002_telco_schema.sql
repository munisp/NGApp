-- Telco vertical schema
-- Covers subscribers, SIMs, cell sites, interconnect, number portability

CREATE TABLE IF NOT EXISTS telco_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    msisdn VARCHAR(15) NOT NULL,
    imsi VARCHAR(15),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan_type VARCHAR(50),
    monthly_arpu DECIMAL(12,2),
    data_usage_mb BIGINT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    sms_count INT DEFAULT 0,
    activation_date TIMESTAMPTZ,
    last_activity TIMESTAMPTZ,
    kyc_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_sim_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    iccid VARCHAR(20) NOT NULL UNIQUE,
    subscriber_id UUID REFERENCES telco_subscribers(id),
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    sim_type VARCHAR(20) DEFAULT 'physical',
    activation_date TIMESTAMPTZ,
    deactivation_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_cell_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    site_id VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    technology VARCHAR(10) NOT NULL DEFAULT '4G',
    status VARCHAR(20) NOT NULL DEFAULT 'operational',
    capacity_users INT,
    current_load INT DEFAULT 0,
    last_maintenance TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_interconnect (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    partner_name VARCHAR(100) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    traffic_minutes BIGINT DEFAULT 0,
    settlement_amount DECIMAL(15,2),
    settlement_status VARCHAR(20) DEFAULT 'pending',
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_number_portability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    msisdn VARCHAR(15) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    donor_operator VARCHAR(50),
    recipient_operator VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    request_date TIMESTAMPTZ,
    completion_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telco_subscribers_tenant ON telco_subscribers(tenant_id);
CREATE INDEX idx_telco_subscribers_msisdn ON telco_subscribers(msisdn);
CREATE INDEX idx_telco_sim_cards_tenant ON telco_sim_cards(tenant_id);
CREATE INDEX idx_telco_cell_sites_tenant ON telco_cell_sites(tenant_id);
CREATE INDEX idx_telco_cell_sites_status ON telco_cell_sites(status);
