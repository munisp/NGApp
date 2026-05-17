-- 001_parametric_policies.sql

-- UP: Apply the migration
CREATE TYPE policy_type AS ENUM ('Traditional', 'Parametric');
CREATE TYPE policy_status AS ENUM ('Draft', 'PendingOnChain', 'Active', 'Expired', 'Failed');

-- Table for blockchain-specific parametric policy data
CREATE TABLE parametric_policies (
    id UUID PRIMARY KEY,
    gif_product_id TEXT NOT NULL,
    on_chain_address TEXT NOT NULL DEFAULT '',
    tx_hash TEXT NOT NULL DEFAULT '',
    premium_data JSONB NOT NULL,
    payout_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Extend the existing policies table
ALTER TABLE policies ADD COLUMN policy_type policy_type NOT NULL DEFAULT 'Traditional';
ALTER TABLE policies ADD COLUMN status policy_status NOT NULL DEFAULT 'Draft';
ALTER TABLE policies ADD COLUMN parametric_policy_id UUID REFERENCES parametric_policies(id) ON DELETE SET NULL;

-- Index for quick lookup of parametric policies
CREATE INDEX idx_policies_parametric_policy_id ON policies (parametric_policy_id);

-- DOWN: Revert the migration
ALTER TABLE policies DROP COLUMN parametric_policy_id;
ALTER TABLE policies DROP COLUMN status;
ALTER TABLE policies DROP COLUMN policy_type;

DROP TABLE parametric_policies;

DROP TYPE policy_status;
DROP TYPE policy_type;
