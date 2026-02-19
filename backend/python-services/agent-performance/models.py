"""
Database models for Agent Performance Service
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class AgentFeedback(Base):
    """Agent feedback from customers"""
    __tablename__ = "agent_feedback"
    
    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False)
    transaction_id = Column(String(36), ForeignKey("transactions.id"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # service, speed, professionalism, etc.
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_agent_feedback_agent_created', 'agent_id', 'created_at'),
        Index('idx_agent_feedback_rating', 'rating'),
    )

class AgentReward(Base):
    """Agent rewards and achievements"""
    __tablename__ = "agent_rewards"
    
    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    reward_type = Column(String(50), nullable=False)  # bonus, badge, prize, recognition
    reward_name = Column(String(200), nullable=False)
    reward_value = Column(Float, nullable=False, default=0.0)
    criteria_met = Column(Text, nullable=False)  # Description of achievement
    awarded_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True)
    claimed = Column(Integer, nullable=False, default=0)  # 0 = not claimed, 1 = claimed
    claimed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_agent_rewards_agent_awarded', 'agent_id', 'awarded_at'),
        Index('idx_agent_rewards_type', 'reward_type'),
        Index('idx_agent_rewards_expires', 'expires_at'),
    )

class AgentPerformanceSnapshot(Base):
    """Daily performance snapshots for agents"""
    __tablename__ = "agent_performance_snapshots"
    
    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    snapshot_date = Column(DateTime, nullable=False, index=True)
    transaction_count = Column(Integer, nullable=False, default=0)
    transaction_volume = Column(Float, nullable=False, default=0.0)
    commission_earned = Column(Float, nullable=False, default=0.0)
    customer_count = Column(Integer, nullable=False, default=0)
    avg_customer_satisfaction = Column(Float, nullable=True)
    uptime_percentage = Column(Float, nullable=True)
    float_utilization = Column(Float, nullable=True)
    rank_transaction_volume = Column(Integer, nullable=True)
    rank_transaction_count = Column(Integer, nullable=True)
    rank_commission_earned = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_performance_snapshot_agent_date', 'agent_id', 'snapshot_date', unique=True),
        Index('idx_performance_snapshot_date', 'snapshot_date'),
    )

class LeaderboardSnapshot(Base):
    """Leaderboard snapshots for historical tracking"""
    __tablename__ = "leaderboard_snapshots"
    
    id = Column(String(36), primary_key=True)
    metric_type = Column(String(50), nullable=False, index=True)
    time_range = Column(String(20), nullable=False)
    region = Column(String(50), nullable=True)
    snapshot_date = Column(DateTime, nullable=False, index=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False)
    rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_leaderboard_metric_date', 'metric_type', 'snapshot_date'),
        Index('idx_leaderboard_agent_metric', 'agent_id', 'metric_type'),
    )

class AgentTier(Base):
    """Agent tier/level system"""
    __tablename__ = "agent_tiers"
    
    id = Column(String(36), primary_key=True)
    tier_name = Column(String(50), nullable=False, unique=True)
    tier_level = Column(Integer, nullable=False, unique=True)
    min_transaction_volume = Column(Float, nullable=False, default=0.0)
    min_transaction_count = Column(Integer, nullable=False, default=0)
    min_customer_count = Column(Integer, nullable=False, default=0)
    min_satisfaction_rating = Column(Float, nullable=False, default=0.0)
    commission_multiplier = Column(Float, nullable=False, default=1.0)
    benefits = Column(Text, nullable=True)  # JSON string of benefits
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

class AgentTierHistory(Base):
    """Track agent tier changes over time"""
    __tablename__ = "agent_tier_history"
    
    id = Column(String(36), primary_key=True)
    agent_id = Column(String(36), ForeignKey("agents.id"), nullable=False, index=True)
    tier_id = Column(String(36), ForeignKey("agent_tiers.id"), nullable=False)
    tier_name = Column(String(50), nullable=False)
    tier_level = Column(Integer, nullable=False)
    effective_from = Column(DateTime, nullable=False, index=True)
    effective_to = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_tier_history_agent_effective', 'agent_id', 'effective_from'),
    )

# SQL for creating tables
CREATE_TABLES_SQL = """
-- Agent Feedback Table
CREATE TABLE IF NOT EXISTS agent_feedback (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    transaction_id VARCHAR(36),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_created ON agent_feedback(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_rating ON agent_feedback(rating);

-- Agent Rewards Table
CREATE TABLE IF NOT EXISTS agent_rewards (
    id VARCHAR(36) PRIMARY KEY,
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
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_rewards_agent_awarded ON agent_rewards(agent_id, awarded_at);
CREATE INDEX IF NOT EXISTS idx_agent_rewards_type ON agent_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_agent_rewards_expires ON agent_rewards(expires_at);

-- Agent Performance Snapshots Table
CREATE TABLE IF NOT EXISTS agent_performance_snapshots (
    id VARCHAR(36) PRIMARY KEY,
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
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    UNIQUE (agent_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshot_agent_date ON agent_performance_snapshots(agent_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_performance_snapshot_date ON agent_performance_snapshots(snapshot_date);

-- Leaderboard Snapshots Table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    time_range VARCHAR(20) NOT NULL,
    region VARCHAR(50),
    snapshot_date TIMESTAMP NOT NULL,
    agent_id VARCHAR(36) NOT NULL,
    rank INTEGER NOT NULL,
    score DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_metric_date ON leaderboard_snapshots(metric_type, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_leaderboard_agent_metric ON leaderboard_snapshots(agent_id, metric_type);

-- Agent Tiers Table
CREATE TABLE IF NOT EXISTS agent_tiers (
    id VARCHAR(36) PRIMARY KEY,
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
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    tier_id VARCHAR(36) NOT NULL,
    tier_name VARCHAR(50) NOT NULL,
    tier_level INTEGER NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (tier_id) REFERENCES agent_tiers(id)
);

CREATE INDEX IF NOT EXISTS idx_tier_history_agent_effective ON agent_tier_history(agent_id, effective_from);

-- Insert default tiers
INSERT INTO agent_tiers (id, tier_name, tier_level, min_transaction_volume, min_transaction_count, min_customer_count, min_satisfaction_rating, commission_multiplier, benefits)
VALUES 
    ('tier-1', 'Bronze', 1, 0, 0, 0, 0, 1.0, '{"max_float": 50000, "support": "email"}'),
    ('tier-2', 'Silver', 2, 100000, 100, 20, 3.5, 1.1, '{"max_float": 200000, "support": "phone"}'),
    ('tier-3', 'Gold', 3, 500000, 500, 100, 4.0, 1.25, '{"max_float": 1000000, "support": "priority"}'),
    ('tier-4', 'Platinum', 4, 2000000, 2000, 500, 4.5, 1.5, '{"max_float": 5000000, "support": "dedicated"}'),
    ('tier-5', 'Diamond', 5, 10000000, 10000, 2000, 4.8, 2.0, '{"max_float": 20000000, "support": "vip"}')
ON CONFLICT (tier_name) DO NOTHING;
"""

