#!/usr/bin/env python3
"""
Feature Store for Payment Switch ML Platform
Offline and online feature serving for fraud detection and risk scoring
"""

import json
import logging
import os
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/5')
DELTA_BASE_PATH = os.getenv('DELTA_BASE_PATH', 's3a://lakehouse/delta')


class FeatureType(Enum):
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    BOOLEAN = "boolean"
    TIMESTAMP = "timestamp"
    EMBEDDING = "embedding"


class AggregationType(Enum):
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    MIN = "min"
    MAX = "max"
    STDDEV = "stddev"
    PERCENTILE = "percentile"
    LAST = "last"


@dataclass
class FeatureDefinition:
    name: str
    entity: str  # customer, transaction, participant
    feature_type: FeatureType
    description: str
    aggregation: Optional[AggregationType] = None
    window: Optional[str] = None  # 1h, 24h, 7d, 30d
    default_value: Any = None
    tags: List[str] = field(default_factory=list)


@dataclass
class FeatureVector:
    entity_id: str
    features: Dict[str, Any]
    timestamp: str
    version: str


# Feature definitions for fraud detection
FRAUD_FEATURES = [
    # Transaction velocity features
    FeatureDefinition("tx_count_1h", "customer", FeatureType.NUMERIC, "Transaction count in last 1 hour", AggregationType.COUNT, "1h", 0),
    FeatureDefinition("tx_count_24h", "customer", FeatureType.NUMERIC, "Transaction count in last 24 hours", AggregationType.COUNT, "24h", 0),
    FeatureDefinition("tx_count_7d", "customer", FeatureType.NUMERIC, "Transaction count in last 7 days", AggregationType.COUNT, "7d", 0),
    
    # Amount features
    FeatureDefinition("tx_amount_sum_1h", "customer", FeatureType.NUMERIC, "Total transaction amount in last 1 hour", AggregationType.SUM, "1h", 0),
    FeatureDefinition("tx_amount_sum_24h", "customer", FeatureType.NUMERIC, "Total transaction amount in last 24 hours", AggregationType.SUM, "24h", 0),
    FeatureDefinition("tx_amount_avg_30d", "customer", FeatureType.NUMERIC, "Average transaction amount in last 30 days", AggregationType.AVG, "30d", 0),
    FeatureDefinition("tx_amount_max_30d", "customer", FeatureType.NUMERIC, "Maximum transaction amount in last 30 days", AggregationType.MAX, "30d", 0),
    
    # Unique counterparty features
    FeatureDefinition("unique_payees_24h", "customer", FeatureType.NUMERIC, "Unique payees in last 24 hours", AggregationType.COUNT, "24h", 0),
    FeatureDefinition("unique_payees_7d", "customer", FeatureType.NUMERIC, "Unique payees in last 7 days", AggregationType.COUNT, "7d", 0),
    
    # Time-based features
    FeatureDefinition("is_night_transaction", "transaction", FeatureType.BOOLEAN, "Transaction between 11pm-5am", None, None, False),
    FeatureDefinition("is_weekend_transaction", "transaction", FeatureType.BOOLEAN, "Transaction on weekend", None, None, False),
    FeatureDefinition("hours_since_last_tx", "customer", FeatureType.NUMERIC, "Hours since last transaction", AggregationType.LAST, None, 999),
    
    # Amount deviation features
    FeatureDefinition("amount_zscore", "transaction", FeatureType.NUMERIC, "Z-score of amount vs customer average", None, None, 0),
    FeatureDefinition("amount_pct_of_daily_avg", "transaction", FeatureType.NUMERIC, "Amount as % of daily average", None, None, 100),
    
    # Geographic features
    FeatureDefinition("is_new_payee", "transaction", FeatureType.BOOLEAN, "First transaction to this payee", None, None, True),
    FeatureDefinition("is_cross_border", "transaction", FeatureType.BOOLEAN, "Cross-border transaction", None, None, False),
    
    # Account age features
    FeatureDefinition("account_age_days", "customer", FeatureType.NUMERIC, "Days since account creation", None, None, 0),
    FeatureDefinition("days_since_first_tx", "customer", FeatureType.NUMERIC, "Days since first transaction", None, None, 0),
    
    # Fraud history features
    FeatureDefinition("fraud_alerts_30d", "customer", FeatureType.NUMERIC, "Fraud alerts in last 30 days", AggregationType.COUNT, "30d", 0),
    FeatureDefinition("blocked_tx_30d", "customer", FeatureType.NUMERIC, "Blocked transactions in last 30 days", AggregationType.COUNT, "30d", 0),
]


class FeatureStore:
    """Feature store for ML model serving"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "feature_store:"
        self.features = {f.name: f for f in FRAUD_FEATURES}
        self.version = "v1"
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Feature store connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def get_online_features(self, entity_type: str, entity_id: str, feature_names: Optional[List[str]] = None) -> FeatureVector:
        """Get features from online store (Redis) for real-time inference"""
        key = f"{self.prefix}online:{entity_type}:{entity_id}"
        
        cached = self.redis_client.get(key)
        if cached:
            data = json.loads(cached)
            features = data.get('features', {})
            
            # Filter to requested features
            if feature_names:
                features = {k: v for k, v in features.items() if k in feature_names}
            
            return FeatureVector(
                entity_id=entity_id,
                features=features,
                timestamp=data.get('timestamp', datetime.utcnow().isoformat()),
                version=self.version
            )
        
        # Return default values if not in cache
        if feature_names is None:
            feature_names = [f.name for f in FRAUD_FEATURES if f.entity == entity_type]
        
        features = {}
        for name in feature_names:
            if name in self.features:
                features[name] = self.features[name].default_value
        
        return FeatureVector(
            entity_id=entity_id,
            features=features,
            timestamp=datetime.utcnow().isoformat(),
            version=self.version
        )
    
    def set_online_features(self, entity_type: str, entity_id: str, features: Dict[str, Any], ttl: int = 3600):
        """Update features in online store"""
        key = f"{self.prefix}online:{entity_type}:{entity_id}"
        
        data = {
            'entity_id': entity_id,
            'entity_type': entity_type,
            'features': features,
            'timestamp': datetime.utcnow().isoformat(),
            'version': self.version
        }
        
        self.redis_client.setex(key, ttl, json.dumps(data))
    
    def get_offline_features(self, entity_type: str, entity_ids: List[str], feature_names: List[str], point_in_time: Optional[datetime] = None) -> List[FeatureVector]:
        """Get features from offline store (Delta Lake) for training"""
        # In production, query Delta Lake feature tables
        # For now, return simulated data
        
        results = []
        for entity_id in entity_ids:
            features = {}
            for name in feature_names:
                if name in self.features:
                    # Simulate feature values
                    features[name] = self._simulate_feature_value(name, entity_id)
            
            results.append(FeatureVector(
                entity_id=entity_id,
                features=features,
                timestamp=(point_in_time or datetime.utcnow()).isoformat(),
                version=self.version
            ))
        
        return results
    
    def _simulate_feature_value(self, feature_name: str, entity_id: str) -> Any:
        """Simulate feature value for demo purposes"""
        import random
        
        feature = self.features.get(feature_name)
        if not feature:
            return None
        
        # Use entity_id as seed for consistent values
        seed = int(hashlib.md5(f"{feature_name}:{entity_id}".encode()).hexdigest()[:8], 16)
        random.seed(seed)
        
        if feature.feature_type == FeatureType.BOOLEAN:
            return random.random() < 0.3
        
        if feature.feature_type == FeatureType.NUMERIC:
            if "count" in feature_name:
                return random.randint(0, 50)
            if "amount" in feature_name:
                return random.uniform(1000, 1000000)
            if "days" in feature_name or "hours" in feature_name:
                return random.uniform(0, 365)
            if "zscore" in feature_name:
                return random.gauss(0, 1)
            if "pct" in feature_name:
                return random.uniform(50, 200)
            return random.uniform(0, 100)
        
        return feature.default_value
    
    def materialize_features(self, entity_type: str, start_time: datetime, end_time: datetime):
        """Materialize features from offline to online store"""
        # In production, run Spark job to compute features and push to Redis
        logger.info(f"Materializing features for {entity_type} from {start_time} to {end_time}")
        
        # Simulate materialization
        # This would query Delta Lake, compute aggregations, and update Redis
        pass
    
    def get_feature_definitions(self, entity_type: Optional[str] = None) -> List[FeatureDefinition]:
        """Get feature definitions"""
        if entity_type:
            return [f for f in FRAUD_FEATURES if f.entity == entity_type]
        return FRAUD_FEATURES
    
    def get_feature_statistics(self, feature_name: str) -> Dict[str, Any]:
        """Get statistics for a feature"""
        key = f"{self.prefix}stats:{feature_name}"
        cached = self.redis_client.get(key)
        
        if cached:
            return json.loads(cached)
        
        # Return default statistics
        return {
            'feature_name': feature_name,
            'count': 0,
            'mean': 0,
            'stddev': 0,
            'min': 0,
            'max': 0,
            'null_count': 0,
            'last_updated': None
        }
    
    def log_feature_request(self, entity_type: str, entity_id: str, feature_names: List[str], latency_ms: float):
        """Log feature request for monitoring"""
        log_entry = {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'feature_count': len(feature_names),
            'latency_ms': latency_ms,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.redis_client.lpush(f"{self.prefix}request_log", json.dumps(log_entry))
        self.redis_client.ltrim(f"{self.prefix}request_log", 0, 9999)


class FeatureServer:
    """HTTP server for serving features"""
    
    def __init__(self, feature_store: FeatureStore):
        self.store = feature_store
    
    async def get_features(self, entity_type: str, entity_id: str, feature_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """Get features for an entity"""
        start = datetime.now()
        
        vector = self.store.get_online_features(entity_type, entity_id, feature_names)
        
        latency_ms = (datetime.now() - start).total_seconds() * 1000
        self.store.log_feature_request(entity_type, entity_id, list(vector.features.keys()), latency_ms)
        
        return {
            'entity_id': vector.entity_id,
            'features': vector.features,
            'timestamp': vector.timestamp,
            'version': vector.version,
            'latency_ms': latency_ms
        }
    
    async def get_batch_features(self, entity_type: str, entity_ids: List[str], feature_names: List[str]) -> List[Dict[str, Any]]:
        """Get features for multiple entities"""
        results = []
        for entity_id in entity_ids:
            result = await self.get_features(entity_type, entity_id, feature_names)
            results.append(result)
        return results


# Singleton instance
_store: Optional[FeatureStore] = None

def get_feature_store() -> FeatureStore:
    global _store
    if _store is None:
        _store = FeatureStore()
        _store.initialize()
    return _store
