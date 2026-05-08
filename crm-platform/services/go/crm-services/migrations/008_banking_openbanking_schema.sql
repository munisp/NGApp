-- Banking open banking & compliance schema
CREATE TABLE IF NOT EXISTS open_banking_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL,
    third_party_id UUID NOT NULL,
    third_party_name VARCHAR(200) NOT NULL,
    consent_type VARCHAR(30) NOT NULL, -- account_info, payment_initiation, balance_inquiry
    accounts TEXT[], -- array of account IDs consented
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, authorized, revoked, expired
    authorized_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_initiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    consent_id UUID REFERENCES open_banking_consents(id),
    debtor_account VARCHAR(20) NOT NULL,
    creditor_account VARCHAR(20) NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    reference VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, authorized, processing, completed, failed
    nip_session_id VARCHAR(50), -- NIBSS NIP reference
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS regulatory_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    report_type VARCHAR(50) NOT NULL, -- cbn_return, ndic_return, aml_sar, ndpr_audit
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, generated, reviewed, submitted
    generated_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    submission_ref VARCHAR(100),
    report_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ob_consents_tenant ON open_banking_consents(tenant_id);
CREATE INDEX idx_payment_init_tenant ON payment_initiations(tenant_id);
CREATE INDEX idx_reg_reports_tenant ON regulatory_reports(tenant_id);
