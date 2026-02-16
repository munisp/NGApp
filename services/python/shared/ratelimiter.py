import os
import time
import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)


class TokenBucketRateLimiter:
    def __init__(self, name: str, rate_per_second: int):
        self.name = name
        self.rate = rate_per_second
        self.tokens = float(rate_per_second)
        self.max_tokens = float(rate_per_second)
        self.last_refill = time.monotonic()
        self.total_ops = 0
        self.rejected = 0
        self._lock = threading.Lock()

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.max_tokens, self.tokens + elapsed * self.rate)
        self.last_refill = now

    def allow(self) -> bool:
        with self._lock:
            self._refill()
            if self.tokens >= 1:
                self.tokens -= 1
                self.total_ops += 1
                return True
            self.rejected += 1
            return False

    def wait(self, timeout: float = 30.0) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self.allow():
                return True
            time.sleep(0.01)
        return False

    def stats(self) -> dict:
        with self._lock:
            return {
                "name": self.name,
                "rate_per_sec": self.rate,
                "total_ops": self.total_ops,
                "rejected": self.rejected,
                "available_tokens": int(self.tokens),
            }


class BatchRateLimiter:
    def __init__(self):
        self._limiters: dict[str, TokenBucketRateLimiter] = {}
        self._lock = threading.Lock()

    def register(self, name: str, rate_per_second: int):
        with self._lock:
            self._limiters[name] = TokenBucketRateLimiter(name, rate_per_second)

    def allow(self, name: str) -> bool:
        with self._lock:
            limiter = self._limiters.get(name)
        if limiter is None:
            return True
        return limiter.allow()

    def wait(self, name: str, timeout: float = 30.0) -> bool:
        with self._lock:
            limiter = self._limiters.get(name)
        if limiter is None:
            return True
        return limiter.wait(timeout)

    def stats(self) -> dict:
        with self._lock:
            return {name: rl.stats() for name, rl in self._limiters.items()}


def default_backfill_limiters() -> BatchRateLimiter:
    brl = BatchRateLimiter()
    brl.register("model-retraining-writes", 100)
    brl.register("lakehouse-etl-inserts", 500)
    brl.register("analytics-backfill", 200)
    brl.register("kyc-batch-verification", 50)
    brl.register("transaction-history-migration", 1000)
    brl.register("fraud-score-recalculation", 150)
    logger.info(f"Backfill rate limiters initialized: {len(brl._limiters)} registered")
    return brl


backfill_limiters = default_backfill_limiters()
