"""
Model Management System for Banking-CRM Integration.

This module provides a comprehensive model management system for the Banking-CRM
integration, including model versioning, deployment, monitoring, and lifecycle management.
"""

import datetime
import json
import logging
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import mlflow
import numpy as np
import torch
from mlflow.tracking import MlflowClient
from prometheus_client import Counter, Gauge, Histogram

# Configure logging
logger = logging.getLogger(__name__)

# Define metrics
MODEL_INFERENCE_LATENCY = Histogram(
    "model_inference_latency_seconds",
    "Model inference latency in seconds",
    ["model_name", "model_version", "model_type"],
)

MODEL_INFERENCE_COUNT = Counter(
    "model_inference_count_total",
    "Total number of model inferences",
    ["model_name", "model_version", "model_type", "status"],
)

MODEL_DRIFT_SCORE = Gauge(
    "model_drift_score",
    "Model drift score",
    ["model_name", "model_version", "model_type"],
)

MODEL_PERFORMANCE_SCORE = Gauge(
    "model_performance_score",
    "Model performance score",
    ["model_name", "model_version", "model_type", "metric"],
)


class ModelType(Enum):
    """Enum for model types."""

    FRAUD_DETECTION = "fraud_detection"
    CUSTOMER_SEGMENTATION = "customer_segmentation"
    RISK_SCORING = "risk_scoring"
    RECOMMENDATION = "recommendation"
    ANOMALY_DETECTION = "anomaly_detection"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    CHURN_PREDICTION = "churn_prediction"
    CREDIT_SCORING = "credit_scoring"


class ModelFramework(Enum):
    """Enum for model frameworks."""

    PYTORCH = "pytorch"
    PYTORCH_GEOMETRIC = "pytorch_geometric"
    TENSORFLOW = "tensorflow"
    SKLEARN = "sklearn"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    ONNX = "onnx"


class ModelStatus(Enum):
    """Enum for model status."""

    DRAFT = "draft"
    TRAINING = "training"
    TRAINED = "trained"
    EVALUATING = "evaluating"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"
    FAILED = "failed"


@dataclass
class ModelMetadata:
    """Model metadata."""

    name: str
    version: str
    type: ModelType
    framework: ModelFramework
    status: ModelStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    created_by: str
    description: str
    performance_metrics: Dict[str, float]
    tags: Dict[str, str]
    parameters: Dict[str, Any]
    artifacts: Dict[str, str]


class ModelRegistry:
    """Model registry for managing ML models."""

    def __init__(self, registry_uri: str):
        """Initialize the model registry.

        Args:
            registry_uri: URI of the model registry
        """
        self.registry_uri = registry_uri
        self.client = MlflowClient(registry_uri)
        mlflow.set_tracking_uri(registry_uri)
        logger.info(f"Initialized model registry with URI: {registry_uri}")

    def register_model(
        self,
        model: Any,
        name: str,
        version: Optional[str] = None,
        model_type: ModelType = ModelType.FRAUD_DETECTION,
        framework: ModelFramework = ModelFramework.PYTORCH,
        description: str = "",
        tags: Optional[Dict[str, str]] = None,
        parameters: Optional[Dict[str, Any]] = None,
        artifacts: Optional[Dict[str, str]] = None,
        performance_metrics: Optional[Dict[str, float]] = None,
    ) -> ModelMetadata:
        """Register a model in the registry.

        Args:
            model: Model to register
            name: Model name
            version: Model version (optional, auto-generated if not provided)
            model_type: Model type
            framework: Model framework
            description: Model description
            tags: Model tags
            parameters: Model parameters
            artifacts: Model artifacts
            performance_metrics: Model performance metrics

        Returns:
            Model metadata
        """
        # Generate version if not provided
        if version is None:
            version = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

        # Set default values
        tags = tags or {}
        parameters = parameters or {}
        artifacts = artifacts or {}
        performance_metrics = performance_metrics or {}

        # Start MLflow run
        with mlflow.start_run() as run:
            # Log model parameters
            for key, value in parameters.items():
                mlflow.log_param(key, value)

            # Log model metrics
            for key, value in performance_metrics.items():
                mlflow.log_metric(key, value)

            # Log model tags
            for key, value in tags.items():
                mlflow.set_tag(key, value)

            # Log model artifacts
            for key, value in artifacts.items():
                mlflow.log_artifact(value, key)

            # Log model framework-specific info
            if framework == ModelFramework.PYTORCH or framework == ModelFramework.PYTORCH_GEOMETRIC:
                mlflow.pytorch.log_model(model, "model")
            elif framework == ModelFramework.TENSORFLOW:
                mlflow.tensorflow.log_model(model, "model")
            elif framework == ModelFramework.SKLEARN:
                mlflow.sklearn.log_model(model, "model")
            elif framework == ModelFramework.XGBOOST:
                mlflow.xgboost.log_model(model, "model")
            elif framework == ModelFramework.LIGHTGBM:
                mlflow.lightgbm.log_model(model, "model")
            elif framework == ModelFramework.ONNX:
                mlflow.onnx.log_model(model, "model")
            else:
                raise ValueError(f"Unsupported model framework: {framework}")

            # Register model
            model_uri = f"runs:/{run.info.run_id}/model"
            registered_model = mlflow.register_model(model_uri, name)

        # Create model metadata
        metadata = ModelMetadata(
            name=name,
            version=version,
            type=model_type,
            framework=framework,
            status=ModelStatus.TRAINED,
            created_at=datetime.datetime.now(),
            updated_at=datetime.datetime.now(),
            created_by="system",
            description=description,
            performance_metrics=performance_metrics,
            tags=tags,
            parameters=parameters,
            artifacts=artifacts,
        )

        logger.info(f"Registered model: {name} (version: {version})")
        return metadata

    def load_model(
        self, name: str, version: Optional[str] = None, stage: Optional[str] = None
    ) -> Tuple[Any, ModelMetadata]:
        """Load a model from the registry.

        Args:
            name: Model name
            version: Model version (optional)
            stage: Model stage (optional)

        Returns:
            Tuple of (model, metadata)
        """
        # Determine model URI
        if version is not None:
            model_uri = f"models:/{name}/{version}"
        elif stage is not None:
            model_uri = f"models:/{name}/{stage}"
        else:
            model_uri = f"models:/{name}/latest"

        # Load model
        try:
            model = mlflow.pyfunc.load_model(model_uri)
        except Exception as e:
            logger.error(f"Failed to load model {name}: {e}")
            raise

        # Get model metadata
        model_version = self.client.get_latest_versions(name, stages=[stage] if stage else None)[0]
        run = self.client.get_run(model_version.run_id)

        # Extract metadata
        metadata = ModelMetadata(
            name=name,
            version=model_version.version,
            type=ModelType(run.data.tags.get("type", ModelType.FRAUD_DETECTION.value)),
            framework=ModelFramework(run.data.tags.get("framework", ModelFramework.PYTORCH.value)),
            status=ModelStatus(run.data.tags.get("status", ModelStatus.TRAINED.value)),
            created_at=datetime.datetime.fromtimestamp(model_version.creation_timestamp / 1000.0),
            updated_at=datetime.datetime.fromtimestamp(model_version.last_updated_timestamp / 1000.0),
            created_by=run.data.tags.get("created_by", "system"),
            description=model_version.description or "",
            performance_metrics={k: v for k, v in run.data.metrics.items()},
            tags={k: v for k, v in run.data.tags.items() if not k.startswith("mlflow.")},
            parameters={k: v for k, v in run.data.params.items()},
            artifacts={},  # Artifacts are not directly accessible through the API
        )

        logger.info(f"Loaded model: {name} (version: {model_version.version})")
        return model, metadata

    def list_models(self) -> List[str]:
        """List all models in the registry.

        Returns:
            List of model names
        """
        models = self.client.list_registered_models()
        return [model.name for model in models]

    def list_versions(self, name: str) -> List[str]:
        """List all versions of a model.

        Args:
            name: Model name

        Returns:
            List of model versions
        """
        versions = self.client.get_latest_versions(name)
        return [version.version for version in versions]

    def get_metadata(self, name: str, version: Optional[str] = None) -> ModelMetadata:
        """Get model metadata.

        Args:
            name: Model name
            version: Model version (optional)

        Returns:
            Model metadata
        """
        # Get model version
        if version is not None:
            model_version = self.client.get_model_version(name, version)
        else:
            model_version = self.client.get_latest_versions(name)[0]

        # Get run
        run = self.client.get_run(model_version.run_id)

        # Extract metadata
        metadata = ModelMetadata(
            name=name,
            version=model_version.version,
            type=ModelType(run.data.tags.get("type", ModelType.FRAUD_DETECTION.value)),
            framework=ModelFramework(run.data.tags.get("framework", ModelFramework.PYTORCH.value)),
            status=ModelStatus(run.data.tags.get("status", ModelStatus.TRAINED.value)),
            created_at=datetime.datetime.fromtimestamp(model_version.creation_timestamp / 1000.0),
            updated_at=datetime.datetime.fromtimestamp(model_version.last_updated_timestamp / 1000.0),
            created_by=run.data.tags.get("created_by", "system"),
            description=model_version.description or "",
            performance_metrics={k: v for k, v in run.data.metrics.items()},
            tags={k: v for k, v in run.data.tags.items() if not k.startswith("mlflow.")},
            parameters={k: v for k, v in run.data.params.items()},
            artifacts={},  # Artifacts are not directly accessible through the API
        )

        return metadata

    def update_status(self, name: str, version: str, status: ModelStatus) -> None:
        """Update model status.

        Args:
            name: Model name
            version: Model version
            status: New model status
        """
        # Map ModelStatus to MLflow model stage
        stage_map = {
            ModelStatus.DRAFT: "None",
            ModelStatus.TRAINING: "None",
            ModelStatus.TRAINED: "None",
            ModelStatus.EVALUATING: "None",
            ModelStatus.STAGING: "Staging",
            ModelStatus.PRODUCTION: "Production",
            ModelStatus.ARCHIVED: "Archived",
            ModelStatus.FAILED: "None",
        }

        # Update model stage in MLflow
        stage = stage_map.get(status, "None")
        self.client.transition_model_version_stage(name, version, stage)

        # Update model status tag
        self.client.set_model_version_tag(name, version, "status", status.value)

        logger.info(f"Updated model status: {name} (version: {version}) -> {status.value}")

    def delete_model(self, name: str, version: Optional[str] = None) -> None:
        """Delete a model from the registry.

        Args:
            name: Model name
            version: Model version (optional, deletes all versions if not provided)
        """
        if version is not None:
            self.client.delete_model_version(name, version)
            logger.info(f"Deleted model version: {name} (version: {version})")
        else:
            self.client.delete_registered_model(name)
            logger.info(f"Deleted model: {name}")


class ModelDeployer:
    """Model deployer for deploying ML models."""

    def __init__(self, registry: ModelRegistry, deployment_dir: str):
        """Initialize the model deployer.

        Args:
            registry: Model registry
            deployment_dir: Directory for deployed models
        """
        self.registry = registry
        self.deployment_dir = Path(deployment_dir)
        self.deployment_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Initialized model deployer with deployment directory: {deployment_dir}")

    def deploy_model(self, name: str, version: Optional[str] = None, stage: Optional[str] = None) -> str:
        """Deploy a model.

        Args:
            name: Model name
            version: Model version (optional)
            stage: Model stage (optional)

        Returns:
            Path to the deployed model
        """
        # Load model from registry
        model, metadata = self.registry.load_model(name, version, stage)

        # Create deployment directory
        model_dir = self.deployment_dir / f"{name}-{metadata.version}"
        model_dir.mkdir(parents=True, exist_ok=True)

        # Save model
        if metadata.framework == ModelFramework.PYTORCH or metadata.framework == ModelFramework.PYTORCH_GEOMETRIC:
            model_path = model_dir / "model.pt"
            torch.save(model._model, model_path)
        elif metadata.framework == ModelFramework.TENSORFLOW:
            model_path = model_dir / "model"
            model._model.save(model_path)
        elif metadata.framework == ModelFramework.SKLEARN:
            model_path = model_dir / "model.pkl"
            import pickle

            with open(model_path, "wb") as f:
                pickle.dump(model._model, f)
        elif metadata.framework == ModelFramework.XGBOOST:
            model_path = model_dir / "model.xgb"
            model._model.save_model(model_path)
        elif metadata.framework == ModelFramework.LIGHTGBM:
            model_path = model_dir / "model.lgb"
            model._model.save_model(str(model_path))
        elif metadata.framework == ModelFramework.ONNX:
            model_path = model_dir / "model.onnx"
            with open(model_path, "wb") as f:
                f.write(model._model.SerializeToString())
        else:
            raise ValueError(f"Unsupported model framework: {metadata.framework}")

        # Save metadata
        metadata_path = model_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            # Convert dataclass to dict
            metadata_dict = {
                "name": metadata.name,
                "version": metadata.version,
                "type": metadata.type.value,
                "framework": metadata.framework.value,
                "status": metadata.status.value,
                "created_at": metadata.created_at.isoformat(),
                "updated_at": metadata.updated_at.isoformat(),
                "created_by": metadata.created_by,
                "description": metadata.description,
                "performance_metrics": metadata.performance_metrics,
                "tags": metadata.tags,
                "parameters": metadata.parameters,
                "artifacts": metadata.artifacts,
            }
            json.dump(metadata_dict, f, indent=2)

        # Update model status
        self.registry.update_status(name, metadata.version, ModelStatus.PRODUCTION)

        logger.info(f"Deployed model: {name} (version: {metadata.version}) to {model_dir}")
        return str(model_dir)

    def undeploy_model(self, name: str, version: str) -> None:
        """Undeploy a model.

        Args:
            name: Model name
            version: Model version
        """
        # Get model directory
        model_dir = self.deployment_dir / f"{name}-{version}"

        # Check if model is deployed
        if not model_dir.exists():
            logger.warning(f"Model not deployed: {name} (version: {version})")
            return

        # Remove model directory
        shutil.rmtree(model_dir)

        # Update model status
        self.registry.update_status(name, version, ModelStatus.ARCHIVED)

        logger.info(f"Undeployed model: {name} (version: {version})")

    def list_deployed_models(self) -> List[Tuple[str, str]]:
        """List all deployed models.

        Returns:
            List of (name, version) tuples
        """
        deployed_models = []
        for model_dir in self.deployment_dir.glob("*"):
            if model_dir.is_dir():
                # Extract name and version from directory name
                name_version = model_dir.name.split("-")
                if len(name_version) >= 2:
                    name = "-".join(name_version[:-1])
                    version = name_version[-1]
                    deployed_models.append((name, version))

        return deployed_models

    def get_deployed_model_path(self, name: str, version: str) -> Optional[str]:
        """Get the path to a deployed model.

        Args:
            name: Model name
            version: Model version

        Returns:
            Path to the deployed model, or None if not deployed
        """
        model_dir = self.deployment_dir / f"{name}-{version}"
        if not model_dir.exists():
            return None

        return str(model_dir)


class ModelMonitor:
    """Model monitor for monitoring ML models."""

    def __init__(self, registry: ModelRegistry):
        """Initialize the model monitor.

        Args:
            registry: Model registry
        """
        self.registry = registry
        logger.info("Initialized model monitor")

    def record_inference(
        self, name: str, version: str, model_type: ModelType, latency: float, status: str = "success"
    ) -> None:
        """Record model inference.

        Args:
            name: Model name
            version: Model version
            model_type: Model type
            latency: Inference latency in seconds
            status: Inference status (success or error)
        """
        # Record metrics
        MODEL_INFERENCE_LATENCY.labels(name, version, model_type.value).observe(latency)
        MODEL_INFERENCE_COUNT.labels(name, version, model_type.value, status).inc()

    def record_drift(self, name: str, version: str, model_type: ModelType, drift_score: float) -> None:
        """Record model drift.

        Args:
            name: Model name
            version: Model version
            model_type: Model type
            drift_score: Drift score
        """
        # Record metrics
        MODEL_DRIFT_SCORE.labels(name, version, model_type.value).set(drift_score)

    def record_performance(
        self, name: str, version: str, model_type: ModelType, metric: str, value: float
    ) -> None:
        """Record model performance.

        Args:
            name: Model name
            version: Model version
            model_type: Model type
            metric: Performance metric name
            value: Performance metric value
        """
        # Record metrics
        MODEL_PERFORMANCE_SCORE.labels(name, version, model_type.value, metric).set(value)

    def check_drift(
        self, name: str, version: str, reference_data: np.ndarray, current_data: np.ndarray
    ) -> float:
        """Check model drift.

        Args:
            name: Model name
            version: Model version
            reference_data: Reference data
            current_data: Current data

        Returns:
            Drift score
        """
        # Calculate drift score (simple KL divergence for demonstration)
        from scipy.stats import entropy

        # Calculate histograms
        hist1, _ = np.histogram(reference_data, bins=20, density=True)
        hist2, _ = np.histogram(current_data, bins=20, density=True)

        # Add small epsilon to avoid division by zero
        hist1 = hist1 + 1e-10
        hist2 = hist2 + 1e-10

        # Normalize
        hist1 = hist1 / np.sum(hist1)
        hist2 = hist2 / np.sum(hist2)

        # Calculate KL divergence
        drift_score = entropy(hist1, hist2)

        # Get model metadata
        metadata = self.registry.get_metadata(name, version)

        # Record drift
        self.record_drift(name, version, metadata.type, drift_score)

        logger.info(f"Drift score for model {name} (version: {version}): {drift_score:.4f}")
        return drift_score


class ModelManager:
    """Model manager for managing ML models."""

    def __init__(
        self, registry_uri: str, deployment_dir: str, cache_size: int = 10, enable_monitoring: bool = True
    ):
        """Initialize the model manager.

        Args:
            registry_uri: URI of the model registry
            deployment_dir: Directory for deployed models
            cache_size: Maximum number of models to cache
            enable_monitoring: Whether to enable model monitoring
        """
        self.registry = ModelRegistry(registry_uri)
        self.deployer = ModelDeployer(self.registry, deployment_dir)
        self.monitor = ModelMonitor(self.registry) if enable_monitoring else None
        self.cache = {}
        self.cache_size = cache_size
        logger.info(f"Initialized model manager with registry URI: {registry_uri}")

    def register_model(
        self,
        model: Any,
        name: str,
        version: Optional[str] = None,
        model_type: ModelType = ModelType.FRAUD_DETECTION,
        framework: ModelFramework = ModelFramework.PYTORCH,
        description: str = "",
        tags: Optional[Dict[str, str]] = None,
        parameters: Optional[Dict[str, Any]] = None,
        artifacts: Optional[Dict[str, str]] = None,
        performance_metrics: Optional[Dict[str, float]] = None,
    ) -> ModelMetadata:
        """Register a model.

        Args:
            model: Model to register
            name: Model name
            version: Model version (optional)
            model_type: Model type
            framework: Model framework
            description: Model description
            tags: Model tags
            parameters: Model parameters
            artifacts: Model artifacts
            performance_metrics: Model performance metrics

        Returns:
            Model metadata
        """
        return self.registry.register_model(
            model,
            name,
            version,
            model_type,
            framework,
            description,
            tags,
            parameters,
            artifacts,
            performance_metrics,
        )

    def deploy_model(self, name: str, version: Optional[str] = None, stage: Optional[str] = None) -> str:
        """Deploy a model.

        Args:
            name: Model name
            version: Model version (optional)
            stage: Model stage (optional)

        Returns:
            Path to the deployed model
        """
        return self.deployer.deploy_model(name, version, stage)

    def load_model(self, name: str, version: Optional[str] = None) -> Any:
        """Load a model.

        Args:
            name: Model name
            version: Model version (optional)

        Returns:
            Loaded model
        """
        # Check if model is in cache
        cache_key = f"{name}-{version or 'latest'}"
        if cache_key in self.cache:
            logger.debug(f"Loading model from cache: {cache_key}")
            return self.cache[cache_key]

        # Get deployed model path
        if version is not None:
            model_path = self.deployer.get_deployed_model_path(name, version)
            if model_path is None:
                # Model not deployed, deploy it
                model_path = self.deployer.deploy_model(name, version)
        else:
            # Get latest deployed version
            deployed_models = self.deployer.list_deployed_models()
            deployed_versions = [v for n, v in deployed_models if n == name]
            if deployed_versions:
                # Use latest deployed version
                version = max(deployed_versions)
                model_path = self.deployer.get_deployed_model_path(name, version)
            else:
                # No deployed version, deploy latest
                model_path = self.deployer.deploy_model(name)

        # Load model metadata
        metadata_path = os.path.join(model_path, "metadata.json")
        with open(metadata_path, "r") as f:
            metadata_dict = json.load(f)

        # Load model based on framework
        framework = ModelFramework(metadata_dict["framework"])
        if framework == ModelFramework.PYTORCH or framework == ModelFramework.PYTORCH_GEOMETRIC:
            model_file = os.path.join(model_path, "model.pt")
            model = torch.load(model_file)
        elif framework == ModelFramework.TENSORFLOW:
            import tensorflow as tf

            model_file = os.path.join(model_path, "model")
            model = tf.keras.models.load_model(model_file)
        elif framework == ModelFramework.SKLEARN:
            import pickle

            model_file = os.path.join(model_path, "model.pkl")
            with open(model_file, "rb") as f:
                model = pickle.load(f)
        elif framework == ModelFramework.XGBOOST:
            import xgboost as xgb

            model_file = os.path.join(model_path, "model.xgb")
            model = xgb.Booster()
            model.load_model(model_file)
        elif framework == ModelFramework.LIGHTGBM:
            import lightgbm as lgb

            model_file = os.path.join(model_path, "model.lgb")
            model = lgb.Booster(model_file=model_file)
        elif framework == ModelFramework.ONNX:
            import onnx

            model_file = os.path.join(model_path, "model.onnx")
            model = onnx.load(model_file)
        else:
            raise ValueError(f"Unsupported model framework: {framework}")

        # Add to cache
        if len(self.cache) >= self.cache_size:
            # Remove oldest item
            self.cache.pop(next(iter(self.cache)))
        self.cache[cache_key] = model

        logger.info(f"Loaded model: {name} (version: {version or 'latest'})")
        return model

    def predict(
        self, name: str, version: Optional[str], inputs: Union[np.ndarray, torch.Tensor, Dict[str, Any]]
    ) -> Any:
        """Make predictions with a model.

        Args:
            name: Model name
            version: Model version (optional)
            inputs: Model inputs

        Returns:
            Model predictions
        """
        start_time = datetime.datetime.now()
        status = "success"

        try:
            # Load model
            model = self.load_model(name, version)

            # Make prediction
            if isinstance(model, torch.nn.Module):
                # PyTorch model
                if isinstance(inputs, np.ndarray):
                    inputs = torch.from_numpy(inputs)
                with torch.no_grad():
                    predictions = model(inputs)
            else:
                # Other model types
                predictions = model.predict(inputs)

            return predictions
        except Exception as e:
            logger.error(f"Prediction error for model {name} (version: {version or 'latest'}): {e}")
            status = "error"
            raise
        finally:
            # Record inference metrics
            if self.monitor is not None:
                end_time = datetime.datetime.now()
                latency = (end_time - start_time).total_seconds()
                metadata = self.registry.get_metadata(name, version or "latest")
                self.monitor.record_inference(name, metadata.version, metadata.type, latency, status)

    def evaluate_model(
        self, name: str, version: Optional[str], test_data: Any, test_labels: Any
    ) -> Dict[str, float]:
        """Evaluate a model.

        Args:
            name: Model name
            version: Model version (optional)
            test_data: Test data
            test_labels: Test labels

        Returns:
            Evaluation metrics
        """
        # Load model
        model = self.load_model(name, version)

        # Get model metadata
        metadata = self.registry.get_metadata(name, version or "latest")

        # Make predictions
        predictions = self.predict(name, version, test_data)

        # Calculate metrics based on model type
        metrics = {}
        if metadata.type == ModelType.FRAUD_DETECTION:
            # Binary classification metrics
            from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

            # Convert predictions to binary
            if isinstance(predictions, torch.Tensor):
                predictions = predictions.detach().cpu().numpy()
            if predictions.ndim > 1 and predictions.shape[1] > 1:
                # Multi-class predictions, take the fraud class probability
                pred_proba = predictions[:, 1]
                pred_class = (pred_proba > 0.5).astype(int)
            else:
                # Binary predictions
                pred_proba = predictions.flatten()
                pred_class = (pred_proba > 0.5).astype(int)

            # Calculate metrics
            metrics["accuracy"] = float(accuracy_score(test_labels, pred_class))
            metrics["precision"] = float(precision_score(test_labels, pred_class))
            metrics["recall"] = float(recall_score(test_labels, pred_class))
            metrics["f1"] = float(f1_score(test_labels, pred_class))
            metrics["auc"] = float(roc_auc_score(test_labels, pred_proba))

        elif metadata.type == ModelType.CUSTOMER_SEGMENTATION:
            # Clustering metrics
            from sklearn.metrics import calinski_harabasz_score, davies_bouldin_score, silhouette_score

            # Calculate metrics
            metrics["silhouette"] = float(silhouette_score(test_data, predictions))
            metrics["calinski_harabasz"] = float(calinski_harabasz_score(test_data, predictions))
            metrics["davies_bouldin"] = float(davies_bouldin_score(test_data, predictions))

        elif metadata.type == ModelType.RISK_SCORING:
            # Regression metrics
            from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

            # Calculate metrics
            metrics["mae"] = float(mean_absolute_error(test_labels, predictions))
            metrics["mse"] = float(mean_squared_error(test_labels, predictions))
            metrics["rmse"] = float(np.sqrt(mean_squared_error(test_labels, predictions)))
            metrics["r2"] = float(r2_score(test_labels, predictions))

        # Record performance metrics
        if self.monitor is not None:
            for metric_name, metric_value in metrics.items():
                self.monitor.record_performance(name, metadata.version, metadata.type, metric_name, metric_value)

        logger.info(f"Evaluated model: {name} (version: {metadata.version}), metrics: {metrics}")
        return metrics

    def check_drift(
        self, name: str, version: Optional[str], reference_data: np.ndarray, current_data: np.ndarray
    ) -> float:
        """Check model drift.

        Args:
            name: Model name
            version: Model version (optional)
            reference_data: Reference data
            current_data: Current data

        Returns:
            Drift score
        """
        if self.monitor is None:
            logger.warning("Model monitoring is disabled")
            return 0.0

        # Get model metadata
        metadata = self.registry.get_metadata(name, version or "latest")

        # Check drift
        drift_score = self.monitor.check_drift(name, metadata.version, reference_data, current_data)

        return drift_score

    def export_model(self, name: str, version: Optional[str], export_format: str, export_path: str) -> str:
        """Export a model to a specific format.

        Args:
            name: Model name
            version: Model version (optional)
            export_format: Export format (onnx, torchscript, etc.)
            export_path: Path to export the model

        Returns:
            Path to the exported model
        """
        # Load model
        model = self.load_model(name, version)

        # Get model metadata
        metadata = self.registry.get_metadata(name, version or "latest")

        # Export model based on format
        if export_format.lower() == "onnx":
            # Export to ONNX
            if metadata.framework == ModelFramework.PYTORCH or metadata.framework == ModelFramework.PYTORCH_GEOMETRIC:
                import torch.onnx

                # Create dummy input based on model type
                if metadata.type == ModelType.FRAUD_DETECTION:
                    dummy_input = torch.randn(1, 10)  # Adjust input shape as needed
                elif metadata.type == ModelType.CUSTOMER_SEGMENTATION:
                    dummy_input = torch.randn(1, 10)  # Adjust input shape as needed
                else:
                    dummy_input = torch.randn(1, 10)  # Default input shape

                # Export model
                torch.onnx.export(model, dummy_input, export_path)
            else:
                raise ValueError(f"ONNX export not supported for framework: {metadata.framework}")

        elif export_format.lower() == "torchscript":
            # Export to TorchScript
            if metadata.framework == ModelFramework.PYTORCH or metadata.framework == ModelFramework.PYTORCH_GEOMETRIC:
                scripted_model = torch.jit.script(model)
                scripted_model.save(export_path)
            else:
                raise ValueError(f"TorchScript export not supported for framework: {metadata.framework}")

        elif export_format.lower() == "tensorflow":
            # Export to TensorFlow SavedModel
            if metadata.framework == ModelFramework.TENSORFLOW:
                model.save(export_path)
            else:
                raise ValueError(f"TensorFlow export not supported for framework: {metadata.framework}")

        else:
            raise ValueError(f"Unsupported export format: {export_format}")

        logger.info(f"Exported model: {name} (version: {metadata.version}) to {export_path}")
        return export_path

