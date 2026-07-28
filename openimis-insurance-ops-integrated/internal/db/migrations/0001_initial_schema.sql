-- 0001_initial_schema.sql

CREATE TABLE IF NOT EXISTS reserves (
    id UUID PRIMARY KEY,
    claim_id UUID NOT NULL,
    reserve_type VARCHAR(50) NOT NULL,
    amount NUMERIC(19, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserves_claim_id ON reserves (claim_id);

-- Optional: Table to store IBNR calculation history
CREATE TABLE IF NOT EXISTS ibnr_history (
    id UUID PRIMARY KEY,
    total_ibnr NUMERIC(19, 4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on reserves table
CREATE OR REPLACE TRIGGER update_reserves_updated_at
BEFORE UPDATE ON reserves
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
