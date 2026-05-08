-- Commodity trading vertical schema
CREATE TABLE IF NOT EXISTS trading_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    instrument VARCHAR(100) NOT NULL,
    instrument_type VARCHAR(30) NOT NULL, -- futures, options, spot, swap
    direction VARCHAR(10) NOT NULL, -- long, short
    quantity DECIMAL(20,4) NOT NULL,
    entry_price DECIMAL(20,6) NOT NULL,
    current_price DECIMAL(20,6),
    unrealized_pnl DECIMAL(20,2),
    margin_required DECIMAL(20,2),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'open',
    trader_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trade_ref VARCHAR(50) NOT NULL,
    instrument VARCHAR(100) NOT NULL,
    side VARCHAR(10) NOT NULL, -- buy, sell
    quantity DECIMAL(20,4) NOT NULL,
    price DECIMAL(20,6) NOT NULL,
    total_value DECIMAL(20,2) NOT NULL,
    counterparty_id UUID REFERENCES counterparties(id),
    execution_venue VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, filled, partially_filled, cancelled
    executed_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    fees DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(200) NOT NULL,
    lei VARCHAR(20), -- Legal Entity Identifier
    credit_rating VARCHAR(10),
    exposure_limit DECIMAL(20,2),
    current_exposure DECIMAL(20,2) DEFAULT 0,
    kyc_status VARCHAR(20) DEFAULT 'pending',
    country VARCHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    trade_id UUID REFERENCES trades(id),
    settlement_date DATE NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, settled, failed
    counterparty_id UUID REFERENCES counterparties(id),
    netting_group VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_feed (
    id BIGSERIAL PRIMARY KEY,
    instrument VARCHAR(100) NOT NULL,
    bid_price DECIMAL(20,6),
    ask_price DECIMAL(20,6),
    last_price DECIMAL(20,6) NOT NULL,
    volume DECIMAL(20,4),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_positions_tenant ON trading_positions(tenant_id);
CREATE INDEX idx_trades_tenant ON trades(tenant_id);
CREATE INDEX idx_trades_instrument ON trades(instrument);
CREATE INDEX idx_settlements_date ON settlements(settlement_date);
CREATE INDEX idx_price_feed_instrument ON price_feed(instrument, timestamp DESC);
