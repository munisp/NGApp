"""
Platform-wide Optimizations for EscrowProtect
Provides performance enhancements across all services

Optimizations include:
1. Database query batching and caching
2. Redis connection pooling and pipelining
3. Async operation parallelization
4. Response compression and pagination
5. Memory-efficient data structures
"""

import asyncio
import functools
import hashlib
import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

T = TypeVar('T')

# =============================================================================
# CACHING DECORATORS
# =============================================================================

class CacheConfig:
    """Cache configuration"""
    DEFAULT_TTL = 300  # 5 minutes
    SHORT_TTL = 60     # 1 minute
    LONG_TTL = 3600    # 1 hour
    
    # Cache key prefixes
    USER_PREFIX = "user:"
    ESCROW_PREFIX = "escrow:"
    BANK_PREFIX = "bank:"
    RATE_PREFIX = "rate:"
    STATS_PREFIX = "stats:"


def cache_key(*args, **kwargs) -> str:
    """Generate cache key from arguments"""
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    key_str = ":".join(key_parts)
    return hashlib.md5(key_str.encode()).hexdigest()[:16]


def cached(ttl: int = CacheConfig.DEFAULT_TTL, prefix: str = "cache"):
    """
    Decorator for caching async function results in Redis.
    Falls back to in-memory cache if Redis unavailable.
    """
    def decorator(func: Callable) -> Callable:
        # In-memory fallback cache
        _memory_cache: Dict[str, tuple] = {}
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = f"{prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            
            # Try Redis first
            try:
                from app.repositories import cache as redis_cache
                if redis_cache.connected:
                    cached_value = await redis_cache.get_json(key)
                    if cached_value is not None:
                        logger.debug(f"Cache hit: {key}")
                        return cached_value
            except Exception as e:
                logger.debug(f"Redis cache error: {e}")
            
            # Check memory cache fallback
            if key in _memory_cache:
                value, expires_at = _memory_cache[key]
                if datetime.utcnow() < expires_at:
                    logger.debug(f"Memory cache hit: {key}")
                    return value
                else:
                    del _memory_cache[key]
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            try:
                from app.repositories import cache as redis_cache
                if redis_cache.connected:
                    await redis_cache.set_json(key, result, ttl)
            except Exception as e:
                logger.debug(f"Redis cache set error: {e}")
            
            # Store in memory fallback
            _memory_cache[key] = (result, datetime.utcnow() + timedelta(seconds=ttl))
            
            # Cleanup old memory cache entries (keep max 1000)
            if len(_memory_cache) > 1000:
                now = datetime.utcnow()
                expired = [k for k, (_, exp) in _memory_cache.items() if exp < now]
                for k in expired[:100]:
                    del _memory_cache[k]
            
            return result
        
        # Add cache invalidation method
        async def invalidate(*args, **kwargs):
            key = f"{prefix}:{func.__name__}:{cache_key(*args, **kwargs)}"
            try:
                from app.repositories import cache as redis_cache
                if redis_cache.connected:
                    await redis_cache.delete(key)
            except Exception:
                pass
            if key in _memory_cache:
                del _memory_cache[key]
        
        wrapper.invalidate = invalidate
        return wrapper
    
    return decorator


# =============================================================================
# BATCH OPERATIONS
# =============================================================================

class BatchProcessor:
    """
    Batch multiple operations together for efficiency.
    Useful for bulk database operations and API calls.
    """
    
    def __init__(self, batch_size: int = 100, flush_interval: float = 0.1):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._queue: List[tuple] = []
        self._lock = asyncio.Lock()
        self._last_flush = time.time()
    
    async def add(self, operation: Callable, *args, **kwargs):
        """Add operation to batch queue"""
        async with self._lock:
            self._queue.append((operation, args, kwargs))
            
            # Auto-flush if batch size reached or interval exceeded
            if len(self._queue) >= self.batch_size or \
               time.time() - self._last_flush > self.flush_interval:
                await self._flush()
    
    async def _flush(self):
        """Execute all queued operations"""
        if not self._queue:
            return
        
        operations = self._queue.copy()
        self._queue.clear()
        self._last_flush = time.time()
        
        # Execute operations in parallel
        tasks = [op(*args, **kwargs) for op, args, kwargs in operations]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any errors
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Batch operation {i} failed: {result}")
        
        return results
    
    async def flush(self):
        """Manually flush the queue"""
        async with self._lock:
            return await self._flush()


# =============================================================================
# PARALLEL EXECUTION HELPERS
# =============================================================================

async def parallel_execute(*coroutines, max_concurrency: int = 10) -> List[Any]:
    """
    Execute multiple coroutines in parallel with concurrency limit.
    Returns results in same order as input.
    """
    semaphore = asyncio.Semaphore(max_concurrency)
    
    async def bounded_coro(coro):
        async with semaphore:
            return await coro
    
    return await asyncio.gather(*[bounded_coro(c) for c in coroutines])


async def parallel_map(func: Callable, items: List[Any], max_concurrency: int = 10) -> List[Any]:
    """
    Apply async function to items in parallel with concurrency limit.
    """
    return await parallel_execute(
        *[func(item) for item in items],
        max_concurrency=max_concurrency
    )


# =============================================================================
# QUERY OPTIMIZATION
# =============================================================================

class QueryOptimizer:
    """
    Optimizes database queries by:
    1. Batching multiple queries
    2. Using connection pooling
    3. Implementing query result caching
    """
    
    def __init__(self):
        self._query_cache: Dict[str, tuple] = {}
        self._cache_ttl = 60  # 1 minute default
    
    @cached(ttl=60, prefix="query")
    async def get_user_with_accounts(self, user_id: str) -> Optional[Dict]:
        """
        Optimized query to get user with bank accounts in single query.
        Uses eager loading to avoid N+1 problem.
        """
        from app.repositories import db_manager
        from app.database import User, BankAccount
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        async with db_manager.session() as session:
            result = await session.execute(
                select(User)
                .options(selectinload(User.bank_accounts))
                .where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                return {
                    "id": user.id,
                    "phone": user.phone,
                    "name": user.name,
                    "kyc_level": user.kyc_level,
                    "bank_accounts": [
                        {
                            "id": ba.id,
                            "bank_code": ba.bank_code,
                            "bank_name": ba.bank_name,
                            "account_number_last4": ba.account_number_last4,
                            "verified": ba.verified,
                        }
                        for ba in user.bank_accounts
                    ]
                }
            return None
    
    @cached(ttl=300, prefix="query")
    async def get_escrow_with_relations(self, escrow_id: str) -> Optional[Dict]:
        """
        Optimized query to get escrow with all related data.
        """
        from app.repositories import db_manager
        from app.database import Escrow, EscrowTimeline, LedgerEntry
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        async with db_manager.session() as session:
            result = await session.execute(
                select(Escrow)
                .options(
                    selectinload(Escrow.timeline_events),
                    selectinload(Escrow.ledger_entries),
                    selectinload(Escrow.buyer),
                    selectinload(Escrow.seller),
                )
                .where(Escrow.id == escrow_id)
            )
            escrow = result.scalar_one_or_none()
            if escrow:
                return {
                    "id": escrow.id,
                    "status": escrow.status.value if escrow.status else None,
                    "amount": escrow.amount,
                    "currency": escrow.currency,
                    "buyer_id": escrow.buyer_id,
                    "seller_id": escrow.seller_id,
                    "created_at": escrow.created_at.isoformat() if escrow.created_at else None,
                    "timeline": [
                        {"event_type": e.event_type, "created_at": e.created_at.isoformat()}
                        for e in escrow.timeline_events
                    ],
                }
            return None
    
    async def bulk_get_users(self, user_ids: List[str]) -> Dict[str, Dict]:
        """
        Bulk fetch multiple users in single query.
        """
        from app.repositories import db_manager
        from app.database import User
        from sqlalchemy import select
        
        async with db_manager.session() as session:
            result = await session.execute(
                select(User).where(User.id.in_(user_ids))
            )
            users = result.scalars().all()
            return {
                user.id: {
                    "id": user.id,
                    "phone": user.phone,
                    "name": user.name,
                    "kyc_level": user.kyc_level,
                }
                for user in users
            }


# =============================================================================
# RESPONSE OPTIMIZATION
# =============================================================================

class ResponseOptimizer:
    """
    Optimizes API responses by:
    1. Pagination
    2. Field selection
    3. Compression hints
    """
    
    @staticmethod
    def paginate(items: List[Any], page: int = 1, page_size: int = 20) -> Dict:
        """
        Paginate a list of items.
        """
        total = len(items)
        total_pages = (total + page_size - 1) // page_size
        start = (page - 1) * page_size
        end = start + page_size
        
        return {
            "items": items[start:end],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_items": total,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_prev": page > 1,
            }
        }
    
    @staticmethod
    def select_fields(data: Dict, fields: Optional[List[str]] = None) -> Dict:
        """
        Select only specified fields from response.
        """
        if not fields:
            return data
        return {k: v for k, v in data.items() if k in fields}
    
    @staticmethod
    def compress_response(data: Any) -> bytes:
        """
        Compress response data using gzip.
        """
        import gzip
        json_bytes = json.dumps(data).encode('utf-8')
        return gzip.compress(json_bytes)


# =============================================================================
# CONNECTION POOLING
# =============================================================================

class ConnectionPool:
    """
    Manages connection pools for external services.
    """
    
    _pools: Dict[str, Any] = {}
    
    @classmethod
    async def get_http_client(cls, base_url: str, max_connections: int = 100):
        """
        Get or create HTTP client with connection pooling.
        """
        import httpx
        
        if base_url not in cls._pools:
            cls._pools[base_url] = httpx.AsyncClient(
                base_url=base_url,
                limits=httpx.Limits(
                    max_connections=max_connections,
                    max_keepalive_connections=20,
                ),
                timeout=httpx.Timeout(30.0, connect=10.0),
            )
        
        return cls._pools[base_url]
    
    @classmethod
    async def close_all(cls):
        """Close all connection pools"""
        for client in cls._pools.values():
            await client.aclose()
        cls._pools.clear()


# =============================================================================
# RATE LIMITING
# =============================================================================

class RateLimiter:
    """
    Token bucket rate limiter for API endpoints.
    """
    
    def __init__(self, rate: float, burst: int):
        """
        Args:
            rate: Tokens per second
            burst: Maximum burst size
        """
        self.rate = rate
        self.burst = burst
        self._tokens: Dict[str, float] = {}
        self._last_update: Dict[str, float] = {}
    
    async def acquire(self, key: str) -> bool:
        """
        Try to acquire a token for the given key.
        Returns True if allowed, False if rate limited.
        """
        now = time.time()
        
        # Initialize if new key
        if key not in self._tokens:
            self._tokens[key] = self.burst
            self._last_update[key] = now
        
        # Add tokens based on time elapsed
        elapsed = now - self._last_update[key]
        self._tokens[key] = min(self.burst, self._tokens[key] + elapsed * self.rate)
        self._last_update[key] = now
        
        # Try to consume a token
        if self._tokens[key] >= 1:
            self._tokens[key] -= 1
            return True
        
        return False
    
    def get_retry_after(self, key: str) -> float:
        """Get seconds until next token available"""
        if key not in self._tokens:
            return 0
        
        tokens_needed = 1 - self._tokens[key]
        if tokens_needed <= 0:
            return 0
        
        return tokens_needed / self.rate


# =============================================================================
# MEMORY OPTIMIZATION
# =============================================================================

class LRUCache:
    """
    Memory-efficient LRU cache with size limit.
    """
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self._cache: Dict[str, Any] = {}
        self._access_order: List[str] = []
    
    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            # Move to end (most recently used)
            self._access_order.remove(key)
            self._access_order.append(key)
            return self._cache[key]
        return None
    
    def set(self, key: str, value: Any):
        if key in self._cache:
            self._access_order.remove(key)
        elif len(self._cache) >= self.max_size:
            # Remove least recently used
            lru_key = self._access_order.pop(0)
            del self._cache[lru_key]
        
        self._cache[key] = value
        self._access_order.append(key)
    
    def delete(self, key: str):
        if key in self._cache:
            del self._cache[key]
            self._access_order.remove(key)
    
    def clear(self):
        self._cache.clear()
        self._access_order.clear()


# =============================================================================
# PERFORMANCE MONITORING
# =============================================================================

class PerformanceMonitor:
    """
    Monitors and logs performance metrics.
    """
    
    _metrics: Dict[str, List[float]] = {}
    _max_samples = 1000
    
    @classmethod
    def record(cls, metric_name: str, value: float):
        """Record a metric value"""
        if metric_name not in cls._metrics:
            cls._metrics[metric_name] = []
        
        cls._metrics[metric_name].append(value)
        
        # Keep only last N samples
        if len(cls._metrics[metric_name]) > cls._max_samples:
            cls._metrics[metric_name] = cls._metrics[metric_name][-cls._max_samples:]
    
    @classmethod
    def get_stats(cls, metric_name: str) -> Dict[str, float]:
        """Get statistics for a metric"""
        values = cls._metrics.get(metric_name, [])
        if not values:
            return {"count": 0}
        
        sorted_values = sorted(values)
        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "p50": sorted_values[len(sorted_values) // 2],
            "p95": sorted_values[int(len(sorted_values) * 0.95)],
            "p99": sorted_values[int(len(sorted_values) * 0.99)],
        }
    
    @classmethod
    def get_all_stats(cls) -> Dict[str, Dict[str, float]]:
        """Get statistics for all metrics"""
        return {name: cls.get_stats(name) for name in cls._metrics}


def timed(metric_name: str):
    """Decorator to time function execution"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return await func(*args, **kwargs)
            finally:
                elapsed = time.time() - start
                PerformanceMonitor.record(metric_name, elapsed)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                elapsed = time.time() - start
                PerformanceMonitor.record(metric_name, elapsed)
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# =============================================================================
# GLOBAL INSTANCES
# =============================================================================

# Query optimizer singleton
query_optimizer = QueryOptimizer()

# Response optimizer singleton
response_optimizer = ResponseOptimizer()

# Default rate limiters
api_rate_limiter = RateLimiter(rate=100, burst=200)  # 100 req/s, burst 200
auth_rate_limiter = RateLimiter(rate=10, burst=20)   # 10 req/s for auth endpoints

# LRU caches for hot data
user_cache = LRUCache(max_size=10000)
escrow_cache = LRUCache(max_size=5000)
bank_cache = LRUCache(max_size=1000)


# =============================================================================
# INITIALIZATION
# =============================================================================

async def init_optimizations():
    """Initialize optimization infrastructure"""
    logger.info("Initializing platform optimizations...")
    
    # Pre-warm caches if needed
    # This could load frequently accessed data into cache
    
    logger.info("Platform optimizations initialized")


async def shutdown_optimizations():
    """Cleanup optimization resources"""
    await ConnectionPool.close_all()
    user_cache.clear()
    escrow_cache.clear()
    bank_cache.clear()
    logger.info("Platform optimizations shutdown")
