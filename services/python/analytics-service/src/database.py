"""
PostgreSQL connection pool for the Analytics Service.
Uses asyncpg for async PostgreSQL access.
PostgreSQL exclusively — no MySQL or TiDB.
"""

import logging
import os
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> asyncpg.Pool:
    """Get or create the PostgreSQL connection pool."""
    global _pool
    if _pool is None:
        dsn = os.getenv(
            "DATABASE_URL",
            "postgresql://og_rmm:og_rmm_pass@postgres:5432/og_rmm"
        )
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=3,
            max_size=15,
            command_timeout=30,
        )
        logger.info("PostgreSQL connection pool created")
    return _pool


async def close_db_pool():
    """Close the PostgreSQL connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")
