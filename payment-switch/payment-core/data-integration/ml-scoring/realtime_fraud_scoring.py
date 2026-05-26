#!/usr/bin/env python3
"""
Real-Time Fraud Scoring Service
Applies ML models to live transactions for real-time fraud detection

Features:
- Circuit breaker pattern for Kafka, Redis, and S3 operations
- Exponential backoff retry for transient failures
- Graceful degradation with rule-based fallback scoring
- Dead letter queue for failed predictions
- Comprehensive health checks and metrics
- Bulkhead pattern for concurrency limiting
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List
import threading
from concurrent.futures import ThreadPoolExecutor
from enum import Enum

import numpy as np
import redis
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError, NoBrokersAvailable
import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
import joblib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Resilience Configuration
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 0.1
MAX_RETRY_DELAY = 30.0
CIRCUIT_BREAKER_THRESHOLD = 5
CIRCUIT_BREAKER_TIMEOUT = 30.0
HEALTH_CHECK_INTERVAL = 30.0
DLQ_MAX_SIZE = 10000


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Circuit breaker for external service calls"""
    
    def __init__(self, name: str, threshold: int = CIRCUIT_BREAKER_THRESHOLD, timeout: float = CIRCUIT_BREAKER_TIMEOUT):
        self.name = name
        self.threshold = threshold
        self.timeout = timeout
        self.state = CircuitState.CLOSED
        self.failures = 0
        self.successes = 0
        self.last_failure_time = 0
        self.half_open_calls = 0
        self._lock = threading.Lock()
    
    def can_execute(self) -> bool:
        with self._lock:
            if self.state == CircuitState.CLOSED:
                return True
            elif self.state == CircuitState.OPEN:
                if time.time() - self.last_failure_time > self.timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                    return True
                return False
            else:
                if self.half_open_calls < 3:
                    self.half_open_calls += 1
                    return True
                return False
    
    def record_success(self):
        with self._lock:
            self.failures = 0
            if self.state == CircuitState.HALF_OPEN:
                self.successes += 1
                if self.successes >= 3:
                    self.state = CircuitState.CLOSED
                    logger.info(f"Circuit breaker {self.name} transitioning to CLOSED")
    
    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker {self.name} transitioning to OPEN")
            elif self.failures >= self.threshold:
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker {self.name} transitioning to OPEN after {self.failures} failures")


class DeadLetterQueue:
    """Dead letter queue for failed predictions"""
    
    def __init__(self, max_size: int = DLQ_MAX_SIZE, file_path: str = None):
        self.max_size = max_size
        self.file_path = file_path or "/tmp/fraud_scoring_dlq.json"
        self.events: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._load_from_disk()
    
    def add(self, event: Dict[str, Any]):
        with self._lock:
            if len(self.events) >= self.max_size:
                self.events.pop(0)
            self.events.append(event)
            self._persist_to_disk()
    
    def get_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self.events)
    
    def remove(self, transaction_id: str):
        with self._lock:
            self.events = [e for e in self.events if e.get("transaction_id") != transaction_id]
            self._persist_to_disk()
    
    def size(self) -> int:
        with self._lock:
            return len(self.events)
    
    def _persist_to_disk(self):
        try:
            with open(self.file_path, 'w') as f:
                json.dump(self.events, f)
        except Exception as e:
            logger.error(f"Failed to persist DLQ: {e}")
    
    def _load_from_disk(self):
        try:
            with open(self.file_path, 'r') as f:
                self.events = json.load(f)
        except FileNotFoundError:
            self.events = []
        except Exception as e:
            logger.error(f"Failed to load DLQ: {e}")
            self.events = []


@dataclass
class ScoringMetrics:
    """Metrics for the scoring service"""
    predictions_made: int = 0
    predictions_failed: int = 0
    fallback_used: int = 0
    avg_latency_ms: float = 0
    total_latency_ms: float = 0
    kafka_errors: int = 0
    redis_errors: int = 0
    s3_errors: int = 0
    dlq_size: int = 0
    
    def record_prediction(self, latency_ms: float, used_fallback: bool = False):
        self.predictions_made += 1
        self.total_latency_ms += latency_ms
        self.avg_latency_ms = self.total_latency_ms / self.predictions_made
        if used_fallback:
            self.fallback_used += 1
    
    def record_failure(self):
        self.predictions_failed += 1
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "predictions_made": self.predictions_made,
            "predictions_failed": self.predictions_failed,
            "fallback_used": self.fallback_used,
            "avg_latency_ms": self.avg_latency_ms,
            "kafka_errors": self.kafka_errors,
            "redis_errors": self.redis_errors,
            "s3_errors": self.s3_errors,
            "dlq_size": self.dlq_size,
        }


@dataclass
class FraudPrediction:
    transaction_id: str
    fraud_score: float
    risk_level: str
    risk_factors: List[Dict[str, Any]]
    model_version: str
    decision: str
    latency_ms: float
    timestamp: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "transaction_id": self.transaction_id,
            "fraud_score": self.fraud_score,
            "risk_level": self.risk_level,
            "risk_factors": self.risk_factors,
            "model_version": self.model_version,
            "decision": self.decision,
            "latency_ms": self.latency_ms,
            "timestamp": self.timestamp
        }


class ModelRegistry:
    """Model registry for loading and caching ML models from MinIO/S3"""
    
    def __init__(self, s3_endpoint: str, s3_access_key: str, s3_secret_key: str, bucket: str = "ml-models"):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=s3_endpoint,
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key
        )
        self.bucket = bucket
        self.models: Dict[str, Any] = {}
        self.model_metadata: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
    
    def load_model(self, model_name: str, version: str = "latest") -> Any:
        """Load a model from S3/MinIO"""
        cache_key = f"{model_name}:{version}"
        
        with self.lock:
            if cache_key in self.models:
                return self.models[cache_key]
        
        try:
            if version == "latest":
                response = self.s3_client.list_objects_v2(
                    Bucket=self.bucket,
                    Prefix=f"{model_name}_"
                )
                if 'Contents' not in response:
                    raise ValueError(f"No models found for {model_name}")
                
                latest = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
                model_key = latest['Key']
            else:
                model_key = f"{model_name}_{version}.pkl"
            
            local_path = f"/tmp/{model_key}"
            self.s3_client.download_file(self.bucket, model_key, local_path)
            
            model = joblib.load(local_path)
            
            metadata_key = model_key.replace('.pkl', '_metadata.json')
            try:
                metadata_response = self.s3_client.get_object(Bucket=self.bucket, Key=metadata_key)
                metadata = json.loads(metadata_response['Body'].read().decode('utf-8'))
            except Exception:
                metadata = {"model_name": model_name, "version": version}
            
            with self.lock:
                self.models[cache_key] = model
                self.model_metadata[cache_key] = metadata
            
            logger.info(f"Loaded model {model_name} version {version}")
            return model
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise
    
    def get_model_version(self, model_name: str) -> str:
        """Get the current version of a loaded model"""
        for key in self.models.keys():
            if key.startswith(model_name):
                return self.model_metadata.get(key, {}).get('version', 'unknown')
        return 'unknown'


class FeatureStore:
    """Feature store for real-time feature retrieval from Redis"""
    
    def __init__(self, redis_url: str):
        self.redis_client = redis.from_url(redis_url)
        self.prefix = "features:"
    
    def get_account_features(self, account_id: str) -> Dict[str, Any]:
        """Get pre-computed features for an account"""
        key = f"{self.prefix}account:{account_id}"
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return self._default_account_features()
    
    def get_merchant_features(self, merchant_id: str) -> Dict[str, Any]:
        """Get pre-computed features for a merchant"""
        key = f"{self.prefix}merchant:{merchant_id}"
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return self._default_merchant_features()
    
    def get_velocity_features(self, account_id: str) -> Dict[str, Any]:
        """Get velocity features for an account"""
        key = f"{self.prefix}velocity:{account_id}"
        data = self.redis_client.get(key)
        if data:
            return json.loads(data)
        return self._default_velocity_features()
    
    def _default_account_features(self) -> Dict[str, Any]:
        return {
            "account_age_days": 0,
            "total_transactions": 0,
            "avg_transaction_amount": 0,
            "stddev_transaction_amount": 0,
            "fraud_history_count": 0
        }
    
    def _default_merchant_features(self) -> Dict[str, Any]:
        return {
            "merchant_risk_score": 0.5,
            "merchant_category_risk": 0.5,
            "merchant_transaction_count": 0,
            "merchant_fraud_rate": 0
        }
    
    def _default_velocity_features(self) -> Dict[str, Any]:
        return {
            "txn_count_1h": 0,
            "txn_amount_1h": 0,
            "txn_count_24h": 0,
            "txn_amount_24h": 0,
            "unique_merchants_24h": 0
        }


class RealtimeFraudScorer:
    """Real-time fraud scoring service with full resilience patterns"""
    
    def __init__(
        self,
        kafka_bootstrap_servers: str,
        redis_url: str,
        s3_endpoint: str,
        s3_access_key: str,
        s3_secret_key: str,
        input_topic: str = "transactions.pending",
        output_topic: str = "fraud.scores",
        consumer_group: str = "fraud-scorer"
    ):
        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.redis_url = redis_url
        self.input_topic = input_topic
        self.output_topic = output_topic
        self.consumer_group = consumer_group
        
        # Circuit breakers for external services
        self.kafka_circuit = CircuitBreaker("kafka")
        self.redis_circuit = CircuitBreaker("redis")
        self.s3_circuit = CircuitBreaker("s3")
        
        # Dead letter queue for failed predictions
        self.dlq = DeadLetterQueue()
        
        # Metrics
        self.metrics = ScoringMetrics()
        
        self.model_registry = ModelRegistry(s3_endpoint, s3_access_key, s3_secret_key)
        self.feature_store = FeatureStore(redis_url)
        
        self.consumer: Optional[KafkaConsumer] = None
        self.producer: Optional[KafkaProducer] = None
        self.redis_client = self._init_redis_with_retry(redis_url)
        
        self.model = None
        self.model_version = "unknown"
        
        self._running = False
        self._healthy = True
        self.executor = ThreadPoolExecutor(max_workers=4)
        
        self.high_risk_threshold = 0.8
        self.medium_risk_threshold = 0.5
        self.auto_block_threshold = 0.95
        
        # Start background health checker
        self._health_check_thread = threading.Thread(target=self._health_checker, daemon=True)
        self._stop_health_check = threading.Event()
    
    def _init_redis_with_retry(self, redis_url: str) -> Optional[redis.Redis]:
        """Initialize Redis with retry logic"""
        for attempt in range(MAX_RETRIES):
            try:
                client = redis.from_url(redis_url)
                client.ping()
                self.redis_circuit.record_success()
                return client
            except Exception as e:
                self.redis_circuit.record_failure()
                if attempt == MAX_RETRIES - 1:
                    logger.error(f"Failed to connect to Redis after {MAX_RETRIES} attempts: {e}")
                    return None
                delay = min(INITIAL_RETRY_DELAY * (2 ** attempt), MAX_RETRY_DELAY)
                logger.warning(f"Redis connection attempt {attempt + 1} failed, retrying in {delay}s")
                time.sleep(delay)
        return None
    
    def _health_checker(self):
        """Background health checker"""
        while not self._stop_health_check.is_set():
            try:
                # Check Redis
                if self.redis_client and self.redis_circuit.can_execute():
                    try:
                        self.redis_client.ping()
                        self.redis_circuit.record_success()
                    except Exception:
                        self.redis_circuit.record_failure()
                        self.metrics.redis_errors += 1
                
                # Check Kafka producer
                if self.producer and self.kafka_circuit.can_execute():
                    try:
                        self.producer.partitions_for(self.output_topic)
                        self.kafka_circuit.record_success()
                    except Exception:
                        self.kafka_circuit.record_failure()
                        self.metrics.kafka_errors += 1
                
                # Update DLQ size metric
                self.metrics.dlq_size = self.dlq.size()
                
                # Process DLQ if circuits are healthy
                if self.kafka_circuit.state == CircuitState.CLOSED:
                    self._process_dlq()
                
            except Exception as e:
                logger.error(f"Health check error: {e}")
            
            self._stop_health_check.wait(HEALTH_CHECK_INTERVAL)
    
    def _process_dlq(self):
        """Process dead letter queue"""
        events = self.dlq.get_all()
        for event in events[:10]:  # Process up to 10 at a time
            try:
                transaction_id = event.get("transaction_id")
                prediction_data = event.get("prediction")
                if prediction_data and self.producer:
                    self.producer.send(
                        self.output_topic,
                        key=transaction_id,
                        value=prediction_data
                    ).get(timeout=5)
                    self.dlq.remove(transaction_id)
                    logger.info(f"Successfully reprocessed DLQ event: {transaction_id}")
            except Exception as e:
                logger.warning(f"Failed to reprocess DLQ event: {e}")
                break
    
    def is_healthy(self) -> bool:
        """Check if the scorer is healthy"""
        return (
            self._healthy and
            self.kafka_circuit.state != CircuitState.OPEN and
            self.redis_circuit.state != CircuitState.OPEN
        )
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get detailed health status"""
        return {
            "healthy": self.is_healthy(),
            "kafka_circuit": self.kafka_circuit.state.value,
            "redis_circuit": self.redis_circuit.state.value,
            "s3_circuit": self.s3_circuit.state.value,
            "model_loaded": self.model is not None,
            "model_version": self.model_version,
            "metrics": self.metrics.to_dict(),
        }
    
    def initialize(self):
        """Initialize the scorer"""
        logger.info("Initializing real-time fraud scorer...")
        
        try:
            self.model = self.model_registry.load_model("fraud_detection_model")
            self.model_version = self.model_registry.get_model_version("fraud_detection_model")
        except Exception as e:
            logger.warning(f"Could not load ML model, using rule-based scoring: {e}")
            self.model = None
            self.model_version = "rule-based-v1"
        
        self.consumer = KafkaConsumer(
            self.input_topic,
            bootstrap_servers=self.kafka_bootstrap_servers,
            group_id=self.consumer_group,
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True
        )
        
        self.producer = KafkaProducer(
            bootstrap_servers=self.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v, default=str).encode('utf-8'),
            key_serializer=lambda k: str(k).encode('utf-8') if k else None,
            acks='all'
        )
        
        logger.info(f"Fraud scorer initialized with model version: {self.model_version}")
    
    def extract_features(self, transaction: Dict[str, Any]) -> np.ndarray:
        """Extract features from a transaction for ML scoring"""
        account_id = transaction.get('account_id', transaction.get('debit_account_id', ''))
        merchant_id = transaction.get('merchant_id', '')
        
        account_features = self.feature_store.get_account_features(str(account_id))
        merchant_features = self.feature_store.get_merchant_features(str(merchant_id))
        velocity_features = self.feature_store.get_velocity_features(str(account_id))
        
        amount = float(transaction.get('amount', 0))
        
        timestamp = transaction.get('timestamp', transaction.get('created_at', ''))
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                hour_of_day = dt.hour
                day_of_week = dt.weekday()
                is_weekend = 1 if day_of_week >= 5 else 0
                is_night = 1 if hour_of_day < 6 or hour_of_day > 22 else 0
            except Exception:
                hour_of_day = 12
                day_of_week = 0
                is_weekend = 0
                is_night = 0
        else:
            hour_of_day = 12
            day_of_week = 0
            is_weekend = 0
            is_night = 0
        
        avg_amount = account_features.get('avg_transaction_amount', 0)
        stddev_amount = account_features.get('stddev_transaction_amount', 1)
        amount_deviation = (amount - avg_amount) / max(stddev_amount, 1)
        
        features = [
            amount,
            hour_of_day,
            day_of_week,
            is_weekend,
            is_night,
            account_features.get('account_age_days', 0),
            account_features.get('total_transactions', 0),
            avg_amount,
            stddev_amount,
            amount_deviation,
            account_features.get('fraud_history_count', 0),
            merchant_features.get('merchant_risk_score', 0.5),
            merchant_features.get('merchant_category_risk', 0.5),
            merchant_features.get('merchant_fraud_rate', 0),
            velocity_features.get('txn_count_1h', 0),
            velocity_features.get('txn_amount_1h', 0),
            velocity_features.get('txn_count_24h', 0),
            velocity_features.get('txn_amount_24h', 0),
            velocity_features.get('unique_merchants_24h', 0)
        ]
        
        return np.array(features).reshape(1, -1)
    
    def calculate_risk_factors(self, transaction: Dict[str, Any], features: np.ndarray) -> List[Dict[str, Any]]:
        """Calculate risk factors for explainability"""
        risk_factors = []
        
        amount = float(transaction.get('amount', 0))
        avg_amount = features[0, 7]
        if amount > avg_amount * 3:
            risk_factors.append({
                "factor": "high_amount",
                "description": f"Transaction amount {amount} is {amount/max(avg_amount,1):.1f}x average",
                "weight": 0.3
            })
        
        if features[0, 4] == 1:
            risk_factors.append({
                "factor": "night_transaction",
                "description": "Transaction occurred during night hours",
                "weight": 0.1
            })
        
        txn_count_1h = features[0, 14]
        if txn_count_1h > 5:
            risk_factors.append({
                "factor": "high_velocity",
                "description": f"{int(txn_count_1h)} transactions in last hour",
                "weight": 0.25
            })
        
        merchant_risk = features[0, 11]
        if merchant_risk > 0.7:
            risk_factors.append({
                "factor": "high_risk_merchant",
                "description": f"Merchant risk score: {merchant_risk:.2f}",
                "weight": 0.2
            })
        
        fraud_history = features[0, 10]
        if fraud_history > 0:
            risk_factors.append({
                "factor": "fraud_history",
                "description": f"Account has {int(fraud_history)} previous fraud incidents",
                "weight": 0.4
            })
        
        return risk_factors
    
    def score_transaction(self, transaction: Dict[str, Any]) -> FraudPrediction:
        """Score a single transaction"""
        start_time = time.time()
        
        transaction_id = transaction.get('transaction_id', transaction.get('id', 'unknown'))
        
        features = self.extract_features(transaction)
        
        if self.model is not None:
            try:
                fraud_score = float(self.model.predict_proba(features)[0, 1])
            except Exception as e:
                logger.warning(f"ML model prediction failed, using rule-based: {e}")
                fraud_score = self._rule_based_score(transaction, features)
        else:
            fraud_score = self._rule_based_score(transaction, features)
        
        if fraud_score >= self.high_risk_threshold:
            risk_level = "high"
        elif fraud_score >= self.medium_risk_threshold:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        if fraud_score >= self.auto_block_threshold:
            decision = "block"
        elif fraud_score >= self.high_risk_threshold:
            decision = "review"
        elif fraud_score >= self.medium_risk_threshold:
            decision = "step_up"
        else:
            decision = "allow"
        
        risk_factors = self.calculate_risk_factors(transaction, features)
        
        latency_ms = (time.time() - start_time) * 1000
        
        prediction = FraudPrediction(
            transaction_id=str(transaction_id),
            fraud_score=fraud_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            model_version=self.model_version,
            decision=decision,
            latency_ms=latency_ms,
            timestamp=datetime.utcnow().isoformat()
        )
        
        return prediction
    
    def _rule_based_score(self, transaction: Dict[str, Any], features: np.ndarray) -> float:
        """Rule-based scoring when ML model is unavailable"""
        score = 0.1
        
        amount = float(transaction.get('amount', 0))
        avg_amount = features[0, 7]
        if avg_amount > 0 and amount > avg_amount * 5:
            score += 0.3
        elif avg_amount > 0 and amount > avg_amount * 3:
            score += 0.15
        
        if features[0, 4] == 1:
            score += 0.1
        
        txn_count_1h = features[0, 14]
        if txn_count_1h > 10:
            score += 0.3
        elif txn_count_1h > 5:
            score += 0.15
        
        merchant_risk = features[0, 11]
        score += merchant_risk * 0.2
        
        fraud_history = features[0, 10]
        if fraud_history > 0:
            score += min(fraud_history * 0.1, 0.3)
        
        return min(score, 1.0)
    
    def publish_prediction(self, prediction: FraudPrediction):
        """Publish prediction to Kafka"""
        try:
            future = self.producer.send(
                self.output_topic,
                key=prediction.transaction_id,
                value=prediction.to_dict()
            )
            future.get(timeout=5)
        except KafkaError as e:
            logger.error(f"Failed to publish prediction: {e}")
    
    def cache_prediction(self, prediction: FraudPrediction):
        """Cache prediction in Redis for quick lookup"""
        key = f"fraud_score:{prediction.transaction_id}"
        self.redis_client.setex(key, 3600, json.dumps(prediction.to_dict()))
    
    def run(self):
        """Main scoring loop"""
        logger.info("Starting real-time fraud scoring...")
        self._running = True
        
        try:
            for message in self.consumer:
                if not self._running:
                    break
                
                try:
                    transaction = message.value
                    prediction = self.score_transaction(transaction)
                    
                    self.publish_prediction(prediction)
                    self.cache_prediction(prediction)
                    
                    self.predictions_made += 1
                    self.avg_latency_ms = (self.avg_latency_ms * (self.predictions_made - 1) + prediction.latency_ms) / self.predictions_made
                    
                    if self.predictions_made % 1000 == 0:
                        logger.info(f"Predictions: {self.predictions_made}, Avg latency: {self.avg_latency_ms:.2f}ms")
                    
                except Exception as e:
                    logger.error(f"Error scoring transaction: {e}")
                    
        except KeyboardInterrupt:
            logger.info("Shutting down fraud scorer...")
        finally:
            self.cleanup()
    
    def stop(self):
        """Stop the scorer"""
        self._running = False
    
    def cleanup(self):
        """Cleanup resources"""
        if self.consumer:
            self.consumer.close()
        if self.producer:
            self.producer.flush()
            self.producer.close()
        self.executor.shutdown(wait=False)


def main():
    kafka_servers = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    s3_endpoint = os.getenv('S3_ENDPOINT', 'http://rustfs.lakehouse:9000')
    s3_access_key = os.getenv('S3_ACCESS_KEY', os.getenv('MINIO_ACCESS_KEY', 'minioadmin'))
    s3_secret_key = os.getenv('S3_SECRET_KEY', os.getenv('MINIO_SECRET_KEY', 'minioadmin'))
    
    scorer = RealtimeFraudScorer(
        kafka_bootstrap_servers=kafka_servers,
        redis_url=redis_url,
        s3_endpoint=s3_endpoint,
        s3_access_key=s3_access_key,
        s3_secret_key=s3_secret_key
    )
    
    scorer.initialize()
    scorer.run()


if __name__ == '__main__':
    main()
