-- Commodity trading vertical schema
-- Covers trades, positions, counterparty risk, mark-to-market, settlements

CREATE TABLE IF NOT EXISTS commodity_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trade_id VARCHAR(20) NOT NULL,
    commodity VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    price DECIMAL(15,4) NOT NULL,
    total_value DECIMAL(20,2),
    counterparty_id UUID,
    counterparty_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    trade_date TIMESTAMPTZ NOT NULL,
    settlement_date DATE,
    exchange VARCHAR(50),
    broker VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commodity_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    commodity VARCHAR(50) NOT NULL,
    position_type VARCHAR(10) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    avg_entry_price DECIMAL(15,4),
    current_price DECIMAL(15,4),
    unrealized_pnl DECIMAL(20,2),
    margin_required DECIMAL(20,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commodity_counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    credit_rating VARCHAR(10),
    exposure_limit DECIMAL(20,2),
    current_exposure DECIMAL(20,2) DEFAULT 0,
    country VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    last_review_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commodity_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trade_id UUID REFERENCES commodity_trades(id),
    settlement_amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date DATE,
    settled_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commodity_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity VARCHAR(50) NOT NULL,
    price DECIMAL(15,4) NOT NULL,
    source VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commodity_trades_tenant ON commodity_trades(tenant_id);
CREATE INDEX idx_commodity_trades_status ON commodity_trades(status);
CREATE INDEX idx_commodity_positions_tenant ON commodity_positions(tenant_id);
CREATE INDEX idx_commodity_counterparties_tenant ON commodity_counterparties(tenant_id);
CREATE INDEX idx_commodity_price_history_commodity ON commodity_price_history(commodity, timestamp);
