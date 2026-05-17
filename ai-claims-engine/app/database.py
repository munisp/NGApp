"""Database connection with SQLAlchemy."""
import os
import logging

logger = logging.getLogger(__name__)


class Database:
    """PostgreSQL connection with graceful fallback."""

    def __init__(self, schema: str = "public"):
        self.engine = None
        self.schema = schema
        try:
            from sqlalchemy import create_engine
            db_url = os.getenv("DATABASE_URL", "postgresql://ngapp:ngapp_dev_2026@localhost:5432/ngapp")
            self.engine = create_engine(db_url, pool_size=5, max_overflow=10)
            logger.info(f"Connected to PostgreSQL (schema: {schema})")
        except Exception as e:
            logger.warning(f"PostgreSQL not available (non-fatal): {e}")

    def is_connected(self) -> bool:
        return self.engine is not None
