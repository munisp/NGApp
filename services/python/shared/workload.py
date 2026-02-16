import os
import logging
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class WorkloadTier(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    BACKGROUND = "background"


class WorkloadClassifier:
    def __init__(self):
        self.critical_paths = [
            "/api/v1/payments",
            "/api/v1/accounts/balance",
            "/api/v1/fraud/score",
            "/api/v1/transfers",
        ]
        self.high_paths = [
            "/api/v1/kyc",
            "/api/v1/kyb",
            "/api/v1/bnpl",
            "/api/v1/investments",
            "/api/v1/accounts",
        ]
        self.background_paths = [
            "/api/v1/analytics",
            "/api/v1/ml/retrain",
            "/api/v1/reports",
            "/api/v1/backfill",
            "/api/v1/export",
        ]

    def classify(self, path: str) -> WorkloadTier:
        for p in self.critical_paths:
            if path.startswith(p):
                return WorkloadTier.CRITICAL
        for p in self.high_paths:
            if path.startswith(p):
                return WorkloadTier.HIGH
        for p in self.background_paths:
            if path.startswith(p):
                return WorkloadTier.BACKGROUND
        return WorkloadTier.NORMAL


class DBRouter:
    def __init__(self, db_pool=None, cache=None, classifier=None):
        from .database import db_pool as default_pool
        from .cache import cache as default_cache

        self.pool = db_pool or default_pool
        self.cache = cache or default_cache
        self.classifier = classifier or WorkloadClassifier()

    def read_for_path(self, path: str):
        tier = self.classifier.classify(path)
        if tier == WorkloadTier.CRITICAL:
            return self.pool.get_primary
        elif tier == WorkloadTier.BACKGROUND:
            return self.pool.get_replica
        else:
            return self.pool.read_connection

    def write_for_path(self, path: str):
        return self.pool.write_connection


classifier = WorkloadClassifier()
