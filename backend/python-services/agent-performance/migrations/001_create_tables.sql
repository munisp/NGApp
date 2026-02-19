-- Migration: Create Agent Performance Tables
-- Version: 001
-- Date: 2025-11-11

-- Agent Feedback Table
CREATE TABLE IF NOT EXISTS agent_feedback (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    transaction_id VARCHAR(36),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_created ON agent_feedback(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_customer ON agent_feedback(customer_id);

-- Agent Rewards Table
CREATE TABLE IF NOT EXISTS agent_rewards (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_id VARCHAR(36) NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    reward_name VARCHAR(200) NOT NULL,
    reward_value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    criteria_met TEXT NOT NULL,
    awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    claimed INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_rewards_agent_awarded ON agent_rewards(agent_id, awarded_at);
CREATE INDEX IF NOT EXISTS idx_agent_rewards_type ON agent_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_agent_rewards_expires ON agent_rewards(expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_rewards_claimed ON agent_rewards(claimed);

-- Agent Performance Snapshots Table
CREATE TABLE IF NOT EXISTS agent_performance_snapshots (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_id VARCHAR(36) NOT NULL,
    snapshot_date TIMESTAMP NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    transaction_volume DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    commission_earned DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    customer_count INTEGER NOT NULL DEFAULT 0,
    avg_customer_satisfaction DECIMAL(3,2),
    uptime_percentage DECIMAL(5,2),
    float_utilization DECIMAL(5,2),
    rank_transaction_volume INTEGER,
    rank_transaction_count INTEGER,
    rank_commission_earned INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (agent_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshot_agent_date ON agent_performance_snapshots(agent_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_performance_snapshot_date ON agent_performance_snapshots(snapshot_date);

-- Leaderboard Snapshots Table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_type VARCHAR(50) NOT NULL,
    time_range VARCHAR(20) NOT NULL,
    region VARCHAR(50),
    snapshot_date TIMESTAMP NOT NULL,
    agent_id VARCHAR(36) NOT NULL,
    rank INTEGER NOT NULL,
    score DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_metric_date ON leaderboard_snapshots(metric_type, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_leaderboard_agent_metric ON leaderboard_snapshots(agent_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_region ON leaderboard_snapshots(region);

-- Agent Tiers Table
CREATE TABLE IF NOT EXISTS agent_tiers (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    tier_level INTEGER NOT NULL UNIQUE,
    min_transaction_volume DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    min_transaction_count INTEGER NOT NULL DEFAULT 0,
    min_customer_count INTEGER NOT NULL DEFAULT 0,
    min_satisfaction_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    commission_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    benefits TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Agent Tier History Table
CREATE TABLE IF NOT EXISTS agent_tier_history (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_id VARCHAR(36) NOT NULL,
    tier_id VARCHAR(36) NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    tier_level INTEGER NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tier_history_agent_effective ON agent_tier_history(agent_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_tier_history_tier ON agent_tier_history(tier_id);

-- Insert default tiers
INSERT INTO agent_tiers (id, tier_name, tier_level, min_transaction_volume, min_transaction_count, min_customer_count, min_satisfaction_rating, commission_multiplier, benefits)
VALUES 
    ('tier-bronze', 'Bronze', 1, 0, 0, 0, 0, 1.0, '{"max_float": 50000, "support": "email", "features": ["basic_dashboard", "transaction_history"]}'),
    ('tier-silver', 'Silver', 2, 100000, 100, 20, 3.5, 1.1, '{"max_float": 200000, "support": "phone", "features": ["basic_dashboard", "transaction_history", "analytics", "bulk_operations"]}'),
    ('tier-gold', 'Gold', 3, 500000, 500, 100, 4.0, 1.25, '{"max_float": 1000000, "support": "priority", "features": ["basic_dashboard", "transaction_history", "analytics", "bulk_operations", "api_access", "custom_reports"]}'),
    ('tier-platinum', 'Platinum', 4, 2000000, 2000, 500, 4.5, 1.5, '{"max_float": 5000000, "support": "dedicated", "features": ["basic_dashboard", "transaction_history", "analytics", "bulk_operations", "api_access", "custom_reports", "white_label", "priority_settlement"]}'),
    ('tier-diamond', 'Diamond', 5, 10000000, 10000, 2000, 4.8, 2.0, '{"max_float": 20000000, "support": "vip", "features": ["basic_dashboard", "transaction_history", "analytics", "bulk_operations", "api_access", "custom_reports", "white_label", "priority_settlement", "custom_integrations", "dedicated_account_manager"]}')
ON CONFLICT (tier_name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_agent_feedback_updated_at BEFORE UPDATE ON agent_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_rewards_updated_at BEFORE UPDATE ON agent_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_tiers_updated_at BEFORE UPDATE ON agent_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agent_banking_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_banking_user;

-- Migration complete
SELECT 'Agent Performance tables created successfully' AS status;

