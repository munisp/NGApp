import os
import json
import time
import logging
import threading
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class CacheAside:
    def __init__(
        self,
        redis_url: Optional[str] = None,
        key_prefix: str = "fintech:",
        default_ttl: int = 300,
    ):
        self.key_prefix = key_prefix
        self.default_ttl = default_ttl
        self._client = None
        self._hit_count = 0
        self._miss_count = 0
        self._lock = threading.Lock()

        redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        try:
            import redis as redis_lib
            self._client = redis_lib.Redis.from_url(
                redis_url,
                max_connections=50,
                socket_timeout=2,
                socket_connect_timeout=2,
                retry_on_timeout=True,
                decode_responses=True,
            )
            logger.info(f"Cache initialized: {redis_url}")
        except ImportError:
            logger.warning("redis library not available")
        except Exception as e:
            logger.warning(f"Cache init deferred: {e}")

    def _key(self, key: str) -> str:
        return f"{self.key_prefix}{key}"

    def get(self, key: str) -> Optional[Any]:
        if not self._client:
            return None
        try:
            val = self._client.get(self._key(key))
            if val is None:
                with self._lock:
                    self._miss_count += 1
                return None
            with self._lock:
                self._hit_count += 1
            return json.loads(val)
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        if not self._client:
            return False
        try:
            ttl = ttl or self.default_ttl
            self._client.setex(self._key(key), ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    def get_or_load(
        self, key: str, loader: Callable, ttl: Optional[int] = None
    ) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached

        result = loader()
        if result is not None:
            self.set(key, result, ttl)
        return result

    def invalidate(self, *keys: str) -> int:
        if not self._client:
            return 0
        try:
            prefixed = [self._key(k) for k in keys]
            return self._client.delete(*prefixed)
        except Exception:
            return 0

    def invalidate_pattern(self, pattern: str) -> int:
        if not self._client:
            return 0
        try:
            keys = list(self._client.scan_iter(self._key(pattern), count=100))
            if keys:
                return self._client.delete(*keys)
            return 0
        except Exception:
            return 0

    def stats(self) -> dict:
        with self._lock:
            total = self._hit_count + self._miss_count
            hit_rate = (self._hit_count / total * 100) if total > 0 else 0
            return {
                "hits": self._hit_count,
                "misses": self._miss_count,
                "hit_rate": f"{hit_rate:.1f}%",
                "total": total,
            }

    def health_check(self) -> bool:
        if not self._client:
            return False
        try:
            return self._client.ping()
        except Exception:
            return False


cache = CacheAside()


def account_balance_key(account_id: str) -> str:
    return f"account:balance:{account_id}"

def fraud_score_key(txn_id: str) -> str:
    return f"fraud:score:{txn_id}"

def kyc_status_key(user_id: str) -> str:
    return f"kyc:status:{user_id}"

def merchant_profile_key(merchant_id: str) -> str:
    return f"merchant:profile:{merchant_id}"

def exchange_rate_key(from_currency: str, to_currency: str) -> str:
    return f"exchange:rate:{from_currency}:{to_currency}"
