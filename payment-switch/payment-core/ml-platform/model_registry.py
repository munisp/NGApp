#!/usr/bin/env python3
"""
Model Registry for Payment Switch ML Platform
Model versioning, deployment, and monitoring
"""

import json
import logging
import os
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, List
from enum import Enum

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/6')
MODEL_STORAGE_PATH = os.getenv('MODEL_STORAGE_PATH', 's3a://lakehouse/models')


class ModelStage(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


class ModelStatus(Enum):
    TRAINING = "training"
    TRAINED = "trained"
    VALIDATING = "validating"
    VALIDATED = "validated"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    RETIRED = "retired"


@dataclass
class ModelMetrics:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    auc_roc: float = 0.0
    auc_pr: float = 0.0
    false_positive_rate: float = 0.0
    false_negative_rate: float = 0.0
    latency_p50_ms: float = 0.0
    latency_p99_ms: float = 0.0
    throughput_qps: float = 0.0


@dataclass
class ModelVersion:
    model_id: str
    version: int
    name: str
    description: str
    stage: ModelStage
    status: ModelStatus
    artifact_path: str
    metrics: ModelMetrics
    parameters: Dict[str, Any]
    feature_names: List[str]
    created_at: str
    created_by: str
    deployed_at: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class ModelDeployment:
    deployment_id: str
    model_id: str
    version: int
    endpoint: str
    replicas: int
    status: str
    created_at: str
    traffic_pct: float = 100.0


class ModelRegistry:
    """Registry for ML models"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "model_registry:"
        self.storage_path = MODEL_STORAGE_PATH
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Model registry connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def register_model(
        self,
        name: str,
        description: str,
        artifact_path: str,
        metrics: ModelMetrics,
        parameters: Dict[str, Any],
        feature_names: List[str],
        created_by: str,
        tags: Optional[Dict[str, str]] = None
    ) -> ModelVersion:
        """Register a new model version"""
        
        # Get next version number
        version = self._get_next_version(name)
        model_id = f"{name}-v{version}"
        
        model = ModelVersion(
            model_id=model_id,
            version=version,
            name=name,
            description=description,
            stage=ModelStage.DEVELOPMENT,
            status=ModelStatus.TRAINED,
            artifact_path=artifact_path,
            metrics=metrics,
            parameters=parameters,
            feature_names=feature_names,
            created_at=datetime.utcnow().isoformat(),
            created_by=created_by,
            tags=tags or {}
        )
        
        self._save_model(model)
        logger.info(f"Registered model {model_id}")
        
        return model
    
    def _get_next_version(self, name: str) -> int:
        """Get next version number for a model"""
        key = f"{self.prefix}version_counter:{name}"
        return self.redis_client.incr(key)
    
    def _save_model(self, model: ModelVersion):
        """Save model to registry"""
        key = f"{self.prefix}model:{model.model_id}"
        
        data = {
            'model_id': model.model_id,
            'version': model.version,
            'name': model.name,
            'description': model.description,
            'stage': model.stage.value,
            'status': model.status.value,
            'artifact_path': model.artifact_path,
            'metrics': {
                'accuracy': model.metrics.accuracy,
                'precision': model.metrics.precision,
                'recall': model.metrics.recall,
                'f1_score': model.metrics.f1_score,
                'auc_roc': model.metrics.auc_roc,
                'auc_pr': model.metrics.auc_pr,
                'false_positive_rate': model.metrics.false_positive_rate,
                'false_negative_rate': model.metrics.false_negative_rate,
                'latency_p50_ms': model.metrics.latency_p50_ms,
                'latency_p99_ms': model.metrics.latency_p99_ms,
                'throughput_qps': model.metrics.throughput_qps
            },
            'parameters': model.parameters,
            'feature_names': model.feature_names,
            'created_at': model.created_at,
            'created_by': model.created_by,
            'deployed_at': model.deployed_at,
            'tags': model.tags
        }
        
        self.redis_client.set(key, json.dumps(data))
        
        # Add to model list
        self.redis_client.sadd(f"{self.prefix}models:{model.name}", model.model_id)
        
        # Update stage index
        self.redis_client.sadd(f"{self.prefix}stage:{model.stage.value}", model.model_id)
    
    def get_model(self, model_id: str) -> Optional[ModelVersion]:
        """Get model by ID"""
        key = f"{self.prefix}model:{model_id}"
        data = self.redis_client.get(key)
        
        if not data:
            return None
        
        return self._parse_model(json.loads(data))
    
    def _parse_model(self, data: Dict[str, Any]) -> ModelVersion:
        """Parse model from JSON data"""
        metrics_data = data.get('metrics', {})
        return ModelVersion(
            model_id=data['model_id'],
            version=data['version'],
            name=data['name'],
            description=data['description'],
            stage=ModelStage(data['stage']),
            status=ModelStatus(data['status']),
            artifact_path=data['artifact_path'],
            metrics=ModelMetrics(
                accuracy=metrics_data.get('accuracy', 0),
                precision=metrics_data.get('precision', 0),
                recall=metrics_data.get('recall', 0),
                f1_score=metrics_data.get('f1_score', 0),
                auc_roc=metrics_data.get('auc_roc', 0),
                auc_pr=metrics_data.get('auc_pr', 0),
                false_positive_rate=metrics_data.get('false_positive_rate', 0),
                false_negative_rate=metrics_data.get('false_negative_rate', 0),
                latency_p50_ms=metrics_data.get('latency_p50_ms', 0),
                latency_p99_ms=metrics_data.get('latency_p99_ms', 0),
                throughput_qps=metrics_data.get('throughput_qps', 0)
            ),
            parameters=data.get('parameters', {}),
            feature_names=data.get('feature_names', []),
            created_at=data['created_at'],
            created_by=data['created_by'],
            deployed_at=data.get('deployed_at'),
            tags=data.get('tags', {})
        )
    
    def get_latest_model(self, name: str, stage: Optional[ModelStage] = None) -> Optional[ModelVersion]:
        """Get latest model version by name and optionally stage"""
        model_ids = self.redis_client.smembers(f"{self.prefix}models:{name}")
        
        if not model_ids:
            return None
        
        models = []
        for model_id in model_ids:
            model = self.get_model(model_id)
            if model and (stage is None or model.stage == stage):
                models.append(model)
        
        if not models:
            return None
        
        # Return highest version
        return max(models, key=lambda m: m.version)
    
    def get_production_model(self, name: str) -> Optional[ModelVersion]:
        """Get production model for a given name"""
        return self.get_latest_model(name, ModelStage.PRODUCTION)
    
    def transition_stage(self, model_id: str, new_stage: ModelStage, comment: Optional[str] = None):
        """Transition model to new stage"""
        model = self.get_model(model_id)
        if not model:
            raise ValueError(f"Model {model_id} not found")
        
        old_stage = model.stage
        
        # Remove from old stage index
        self.redis_client.srem(f"{self.prefix}stage:{old_stage.value}", model_id)
        
        # Update model
        model.stage = new_stage
        if new_stage == ModelStage.PRODUCTION:
            model.deployed_at = datetime.utcnow().isoformat()
        
        self._save_model(model)
        
        # Log transition
        self._log_transition(model_id, old_stage, new_stage, comment)
        
        logger.info(f"Transitioned {model_id} from {old_stage.value} to {new_stage.value}")
    
    def _log_transition(self, model_id: str, old_stage: ModelStage, new_stage: ModelStage, comment: Optional[str]):
        """Log stage transition"""
        log_entry = {
            'model_id': model_id,
            'old_stage': old_stage.value,
            'new_stage': new_stage.value,
            'comment': comment,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.redis_client.lpush(f"{self.prefix}transitions:{model_id}", json.dumps(log_entry))
    
    def update_metrics(self, model_id: str, metrics: ModelMetrics):
        """Update model metrics (e.g., from production monitoring)"""
        model = self.get_model(model_id)
        if not model:
            raise ValueError(f"Model {model_id} not found")
        
        model.metrics = metrics
        self._save_model(model)
        
        # Store metrics history
        metrics_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'accuracy': metrics.accuracy,
            'precision': metrics.precision,
            'recall': metrics.recall,
            'f1_score': metrics.f1_score,
            'auc_roc': metrics.auc_roc,
            'false_positive_rate': metrics.false_positive_rate
        }
        self.redis_client.lpush(f"{self.prefix}metrics_history:{model_id}", json.dumps(metrics_entry))
        self.redis_client.ltrim(f"{self.prefix}metrics_history:{model_id}", 0, 999)
    
    def get_metrics_history(self, model_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get metrics history for a model"""
        entries = self.redis_client.lrange(f"{self.prefix}metrics_history:{model_id}", 0, limit - 1)
        return [json.loads(e) for e in entries]
    
    def check_drift(self, model_id: str) -> Dict[str, Any]:
        """Check for model drift"""
        history = self.get_metrics_history(model_id, limit=30)
        
        if len(history) < 2:
            return {'drift_detected': False, 'reason': 'Insufficient history'}
        
        # Compare recent metrics to baseline
        recent = history[:5]
        baseline = history[10:20] if len(history) > 10 else history[5:]
        
        if not baseline:
            return {'drift_detected': False, 'reason': 'Insufficient baseline'}
        
        recent_auc = sum(m.get('auc_roc', 0) for m in recent) / len(recent)
        baseline_auc = sum(m.get('auc_roc', 0) for m in baseline) / len(baseline)
        
        auc_drop = baseline_auc - recent_auc
        
        drift_detected = auc_drop > 0.05  # 5% drop threshold
        
        return {
            'drift_detected': drift_detected,
            'recent_auc': recent_auc,
            'baseline_auc': baseline_auc,
            'auc_drop': auc_drop,
            'threshold': 0.05,
            'recommendation': 'Retrain model' if drift_detected else 'Model is stable'
        }
    
    def list_models(self, name: Optional[str] = None, stage: Optional[ModelStage] = None) -> List[ModelVersion]:
        """List models with optional filters"""
        if name:
            model_ids = self.redis_client.smembers(f"{self.prefix}models:{name}")
        elif stage:
            model_ids = self.redis_client.smembers(f"{self.prefix}stage:{stage.value}")
        else:
            # Get all models
            all_keys = self.redis_client.keys(f"{self.prefix}model:*")
            model_ids = [k.replace(f"{self.prefix}model:", "") for k in all_keys]
        
        models = []
        for model_id in model_ids:
            model = self.get_model(model_id)
            if model:
                if stage is None or model.stage == stage:
                    models.append(model)
        
        return sorted(models, key=lambda m: (m.name, -m.version))


class ModelServer:
    """Server for model inference"""
    
    def __init__(self, registry: ModelRegistry):
        self.registry = registry
        self._loaded_models: Dict[str, Any] = {}
    
    async def predict(self, model_name: str, features: Dict[str, Any]) -> Dict[str, Any]:
        """Make prediction using production model"""
        model = self.registry.get_production_model(model_name)
        
        if not model:
            raise ValueError(f"No production model found for {model_name}")
        
        # In production, load and run actual model
        # For now, simulate prediction
        start = datetime.now()
        
        # Simulate fraud score prediction
        import random
        score = random.uniform(0, 1)
        decision = "BLOCK" if score > 0.8 else "REVIEW" if score > 0.5 else "ALLOW"
        
        latency_ms = (datetime.now() - start).total_seconds() * 1000
        
        return {
            'model_id': model.model_id,
            'model_version': model.version,
            'score': score,
            'decision': decision,
            'confidence': 1 - abs(score - 0.5) * 2,
            'latency_ms': latency_ms,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    async def predict_batch(self, model_name: str, features_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Make batch predictions"""
        results = []
        for features in features_list:
            result = await self.predict(model_name, features)
            results.append(result)
        return results


# Singleton instance
_registry: Optional[ModelRegistry] = None

def get_model_registry() -> ModelRegistry:
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.initialize()
    return _registry
