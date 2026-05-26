"""Redis async client with connection pooling, rate limiting, KYC gate, and pub/sub."""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import redis.asyncio as aioredis

logger = logging.getLogger("ngapp.infra.redis")


class RedisClient:
    def __init__(self, addr: str, db: int = 0, pool_size: int = 20):
        host, _, port_str = addr.partition(":")
        port = int(port_str) if port_str else 6379
        self._client = aioredis.Redis(
            host=host, port=port, db=db,
            max_connections=pool_size,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=3.0,
            retry_on_timeout=True,
        )

    async def ping(self):
        await self._client.ping()

    async def cache_json(self, key: str, value: Any, ttl_seconds: int = 300):
        await self._client.set(key, json.dumps(value), ex=ttl_seconds)

    async def get_cached_json(self, key: str) -> Optional[Any]:
        data = await self._client.get(key)
        if data is None:
            return None
        return json.loads(data)

    async def rate_limit(self, key: str, max_requests: int, window_seconds: int) -> bool:
        pipe = self._client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
        return results[0] <= max_requests

    async def acquire_lock(self, key: str, ttl_seconds: int = 30) -> bool:
        return await self._client.set(f"lock:{key}", int(time.time() * 1000), nx=True, ex=ttl_seconds)

    async def release_lock(self, key: str):
        await self._client.delete(f"lock:{key}")

    async def publish(self, channel: str, message: Any):
        await self._client.publish(channel, json.dumps(message))

    async def set_kyc_gate(self, user_id: str, allowed: bool, level: int, ttl: int = 600):
        await self.cache_json(f"kyc:gate:{user_id}", {"allowed": allowed, "level": level, "ts": int(time.time())}, ttl)

    async def get_kyc_gate(self, user_id: str) -> tuple[bool, int]:
        data = await self.get_cached_json(f"kyc:gate:{user_id}")
        if data is None:
            return False, 0
        return data.get("allowed", False), data.get("level", 0)

    async def invalidate_pattern(self, pattern: str) -> int:
        deleted = 0
        async for key in self._client.scan_iter(match=pattern, count=100):
            await self._client.delete(key)
            deleted += 1
        return deleted

    async def cache_policy(self, policy_id: str, data: dict, ttl: int = 3600):
        await self.cache_json(f"policy:{policy_id}", data, ttl)

    async def get_cached_policy(self, policy_id: str) -> Optional[dict]:
        return await self.get_cached_json(f"policy:{policy_id}")

    async def cache_session(self, session_id: str, data: dict, ttl: int = 1800):
        await self.cache_json(f"session:{session_id}", data, ttl)

    async def get_session(self, session_id: str) -> Optional[dict]:
        return await self.get_cached_json(f"session:{session_id}")

    def pool_stats(self) -> dict:
        pool = self._client.connection_pool
        return {"created_connections": pool._created_connections, "available_connections": len(pool._available_connections)}

    async def close(self):
        await self._client.aclose()
