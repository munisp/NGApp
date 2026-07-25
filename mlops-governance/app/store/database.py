"""Database connection and schema for MLOps Governance."""

import os

import structlog
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

logger = structlog.get_logger()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://localhost:5432/ngapp",
)

engine = None
async_session = None


async def init_db():
    """Initialize database connection and run migrations."""
    global engine, async_session
    engine = create_async_engine(DATABASE_URL, pool_size=10, max_overflow=5)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ml_models (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                version VARCHAR(50) NOT NULL,
                model_type VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'development',
                description TEXT,
                owner VARCHAR(255),
                framework VARCHAR(50),
                metrics JSONB DEFAULT '{}',
                input_schema JSONB DEFAULT '{}',
                output_schema JSONB DEFAULT '{}',
                training_data_ref VARCHAR(500),
                artifact_path VARCHAR(500),
                fluvio_topic VARCHAR(255),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deployed_at TIMESTAMPTZ,
                last_prediction_at TIMESTAMPTZ
            );

            CREATE TABLE IF NOT EXISTS ml_drift_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                model_id VARCHAR(100) NOT NULL,
                drift_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                score DECIMAL(8,6) NOT NULL,
                features_affected TEXT[],
                baseline_period VARCHAR(100),
                current_period VARCHAR(100),
                recommendation TEXT,
                detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ml_explainability_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                model_id VARCHAR(100) NOT NULL,
                prediction_id VARCHAR(100) NOT NULL,
                method VARCHAR(50) NOT NULL,
                feature_importances JSONB NOT NULL,
                decision_path JSONB,
                confidence DECIMAL(5,4),
                generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ml_governance_policies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                rules JSONB NOT NULL DEFAULT '[]',
                enforcement VARCHAR(20) DEFAULT 'advisory',
                applicable_models TEXT[],
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ml_performance_daily (
                date DATE NOT NULL,
                model_id VARCHAR(100) NOT NULL,
                total_predictions INT DEFAULT 0,
                avg_latency_ms DECIMAL(10,2) DEFAULT 0,
                accuracy DECIMAL(5,4),
                f1_score DECIMAL(5,4),
                drift_score DECIMAL(8,6) DEFAULT 0,
                PRIMARY KEY (date, model_id)
            );

            CREATE INDEX IF NOT EXISTS idx_drift_model ON ml_drift_reports(model_id, detected_at DESC);
            CREATE INDEX IF NOT EXISTS idx_explain_model ON ml_explainability_logs(model_id, generated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_perf_model ON ml_performance_daily(model_id, date DESC);
        """))

    logger.info("MLOps governance database initialized")


async def close_db():
    """Close database connections."""
    global engine
    if engine:
        await engine.dispose()
