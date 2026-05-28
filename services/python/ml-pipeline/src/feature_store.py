"""
Feature Store
Computes and caches ML features from PostgreSQL telemetry data.
Uses Redis as the cache layer with PostgreSQL as the feature store backend.
Spec: FRQ-016 — feature retrieval < 50ms.
"""

import json
import logging
import os
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
FEATURE_TTL = int(os.getenv("FEATURE_CACHE_TTL", "3600"))  # 1 hour default

_redis_client = None


def _get_redis():
    """Lazy-init Redis client. Returns None if Redis is unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        _redis_client = redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
        _redis_client.ping()
        logger.info("Feature store Redis connected: %s", REDIS_URL)
        return _redis_client
    except Exception as e:
        logger.warning("Feature store Redis unavailable (%s) — using in-memory fallback", e)
        _redis_client = None
        return None


class FeatureStore:
    """
    Manages ML feature computation and caching.
    Features are computed from PostgreSQL telemetry and cached in Redis
    with in-memory fallback when Redis is unavailable.
    """

    def __init__(self):
        self._mem_cache: Dict[str, dict] = {}

    def _cache_key(self, prefix: str, well_id: str) -> str:
        return f"og-rmm:features:{prefix}:{well_id}"

    async def _cache_get(self, key: str) -> Optional[dict]:
        r = _get_redis()
        if r:
            try:
                raw = r.get(key)
                if raw:
                    return json.loads(raw)
            except Exception:
                pass
        return self._mem_cache.get(key)

    async def _cache_set(self, key: str, value: dict, ttl: int = FEATURE_TTL):
        self._mem_cache[key] = value
        r = _get_redis()
        if r:
            try:
                r.setex(key, ttl, json.dumps(value))
            except Exception:
                pass

    async def get_esp_features(self, well_id: str) -> Optional[dict]:
        """
        Retrieve pre-computed ESP features for a well.
        Checks Redis first, then in-memory fallback.
        """
        key = self._cache_key("esp", well_id)
        cached = await self._cache_get(key)
        if cached:
            return cached

        # In production: query PostgreSQL feature store table
        # SELECT * FROM ml_features WHERE well_id = $1 AND feature_set = 'esp'
        # AND computed_at > NOW() - INTERVAL '1 hour'
        return None

    async def put_esp_features(self, well_id: str, features: dict):
        """Store computed ESP features in cache."""
        key = self._cache_key("esp", well_id)
        await self._cache_set(key, features)

    async def compute_rolling_stats(
        self,
        well_id: str,
        sensor_type: str,
        window_days: int = 7,
    ) -> dict:
        """
        Compute rolling statistics for a sensor over a time window.
        Results are cached in Redis for subsequent lookups.
        """
        key = self._cache_key(f"rolling:{sensor_type}:{window_days}", well_id)
        cached = await self._cache_get(key)
        if cached:
            return cached

        # In production: query InfluxDB or PostgreSQL daily aggregates
        stats = {
            "mean": 1320.0,
            "std": 45.0,
            "min": 1180.0,
            "max": 1450.0,
            "cv": 0.034,
            "trend": 0.002,
            "window_days": window_days,
        }
        await self._cache_set(key, stats, ttl=window_days * 86400)
        return stats

    async def invalidate(self, well_id: str, prefix: Optional[str] = None):
        """Invalidate cached features for a well."""
        if prefix:
            key = self._cache_key(prefix, well_id)
            self._mem_cache.pop(key, None)
            r = _get_redis()
            if r:
                try:
                    r.delete(key)
                except Exception:
                    pass
        else:
            # Invalidate all feature sets for this well
            pattern = f"og-rmm:features:*:{well_id}"
            to_remove = [k for k in self._mem_cache if k.endswith(f":{well_id}")]
            for k in to_remove:
                del self._mem_cache[k]
            r = _get_redis()
            if r:
                try:
                    for key in r.scan_iter(match=pattern, count=100):
                        r.delete(key)
                except Exception:
                    pass
