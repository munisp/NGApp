"""Database connection and schema for IFRS 17 Engine."""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

import structlog

logger = structlog.get_logger()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://localhost:5432/ngapp")

engine = None
async_session_factory = None


async def init_db():
    """Initialize database connection and create tables."""
    global engine, async_session_factory
    
    engine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)
    async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ifrs17_contract_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                portfolio_id VARCHAR(100) NOT NULL,
                cohort_year INT NOT NULL,
                name VARCHAR(500) NOT NULL,
                measurement_model VARCHAR(10) NOT NULL DEFAULT 'gmm',
                inception_date DATE NOT NULL,
                coverage_period_months INT NOT NULL,
                is_onerous BOOLEAN DEFAULT FALSE,
                currency VARCHAR(3) DEFAULT 'NGN',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ifrs17_fulfillment_cashflows (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                group_id UUID REFERENCES ifrs17_contract_groups(id),
                valuation_date DATE NOT NULL,
                pv_future_premiums DECIMAL(18,2) DEFAULT 0,
                pv_future_claims DECIMAL(18,2) DEFAULT 0,
                pv_future_expenses DECIMAL(18,2) DEFAULT 0,
                pv_future_commissions DECIMAL(18,2) DEFAULT 0,
                risk_adjustment DECIMAL(18,2) DEFAULT 0,
                total_fulfillment_cf DECIMAL(18,2) DEFAULT 0,
                discount_rate DECIMAL(8,6) DEFAULT 0.12,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ifrs17_csm (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                group_id UUID REFERENCES ifrs17_contract_groups(id),
                valuation_date DATE NOT NULL,
                opening_balance DECIMAL(18,2) DEFAULT 0,
                changes_in_estimates DECIMAL(18,2) DEFAULT 0,
                accretion_of_interest DECIMAL(18,2) DEFAULT 0,
                fx_adjustments DECIMAL(18,2) DEFAULT 0,
                recognized_in_pnl DECIMAL(18,2) DEFAULT 0,
                closing_balance DECIMAL(18,2) DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ifrs17_risk_adjustments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                group_id UUID REFERENCES ifrs17_contract_groups(id),
                valuation_date DATE NOT NULL,
                confidence_level DECIMAL(5,4) DEFAULT 0.75,
                method VARCHAR(50) DEFAULT 'cost_of_capital',
                non_financial_risk_amount DECIMAL(18,2) DEFAULT 0,
                release_pattern VARCHAR(50) DEFAULT 'coverage_units',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ifrs17_loss_components (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                group_id UUID REFERENCES ifrs17_contract_groups(id),
                valuation_date DATE NOT NULL,
                loss_at_initial_recognition DECIMAL(18,2) DEFAULT 0,
                subsequent_changes DECIMAL(18,2) DEFAULT 0,
                reversal_of_losses DECIMAL(18,2) DEFAULT 0,
                remaining_loss DECIMAL(18,2) DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ifrs17_discount_curves (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                currency VARCHAR(3) NOT NULL,
                reference_date DATE NOT NULL,
                method VARCHAR(20) DEFAULT 'bottom_up',
                tenors INT[] NOT NULL,
                rates DECIMAL(8,6)[] NOT NULL,
                source VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(currency, reference_date, method)
            );

            CREATE INDEX IF NOT EXISTS idx_ifrs17_fc_group ON ifrs17_fulfillment_cashflows(group_id, valuation_date);
            CREATE INDEX IF NOT EXISTS idx_ifrs17_csm_group ON ifrs17_csm(group_id, valuation_date);
            CREATE INDEX IF NOT EXISTS idx_ifrs17_curves_date ON ifrs17_discount_curves(currency, reference_date);
        """))

    logger.info("ifrs17_database_initialized")


async def close_db():
    """Close database connections."""
    global engine
    if engine:
        await engine.dispose()


async def get_session() -> AsyncSession:
    """Get an async database session."""
    return async_session_factory()
