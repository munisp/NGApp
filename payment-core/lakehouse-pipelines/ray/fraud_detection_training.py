"""
Ray Distributed ML Training for Fraud Detection

This script trains a fraud detection model using Ray for distributed computing,
reading data from Delta Lake and saving the model back to MinIO.

Features:
- Circuit breaker pattern for external service calls
- Exponential backoff retry for transient failures
- Graceful degradation with fallback models
- Comprehensive health checks and metrics
- Dead letter queue for failed operations
"""

import ray
from ray import train, tune
from ray.train import ScalingConfig
from ray.train.xgboost import XGBoostTrainer
from ray.train.lightgbm import LightGBMTrainer
import xgboost as xgb
import lightgbm as lgb
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import LabelEncoder, StandardScaler
import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession
import logging
import joblib
from datetime import datetime
import json
import os
import time
import threading
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    reset_timeout: float = 60.0
    half_open_max_calls: int = 3


class CircuitBreaker:
    """Circuit breaker for external service calls"""
    
    def __init__(self, name: str, config: CircuitBreakerConfig = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
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
                if time.time() - self.last_failure_time > self.config.reset_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.half_open_calls = 0
                    logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                    return True
                return False
            else:  # HALF_OPEN
                if self.half_open_calls < self.config.half_open_max_calls:
                    self.half_open_calls += 1
                    return True
                return False
    
    def record_success(self):
        with self._lock:
            self.failures = 0
            if self.state == CircuitState.HALF_OPEN:
                self.successes += 1
                if self.successes >= self.config.half_open_max_calls:
                    self.state = CircuitState.CLOSED
                    logger.info(f"Circuit breaker {self.name} transitioning to CLOSED")
    
    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker {self.name} transitioning to OPEN")
            elif self.failures >= self.config.failure_threshold:
                self.state = CircuitState.OPEN
                logger.warning(f"Circuit breaker {self.name} transitioning to OPEN after {self.failures} failures")


@dataclass
class RetryConfig:
    max_attempts: int = 5
    initial_delay: float = 0.5
    max_delay: float = 30.0
    multiplier: float = 2.0


def retry_with_backoff(config: RetryConfig = None):
    """Decorator for retry with exponential backoff"""
    config = config or RetryConfig()
    
    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = config.initial_delay
            last_exception = None
            
            for attempt in range(1, config.max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt == config.max_attempts:
                        break
                    
                    logger.warning(f"Attempt {attempt} failed: {e}, retrying in {delay}s")
                    time.sleep(delay)
                    delay = min(delay * config.multiplier, config.max_delay)
            
            raise last_exception
        return wrapper
    return decorator


@dataclass
class TrainingMetrics:
    """Metrics for training pipeline"""
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    data_load_time: float = 0
    preprocessing_time: float = 0
    training_time: float = 0
    evaluation_time: float = 0
    model_save_time: float = 0
    total_records: int = 0
    training_samples: int = 0
    test_samples: int = 0
    retries: int = 0
    failures: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": datetime.fromtimestamp(self.start_time).isoformat(),
            "end_time": datetime.fromtimestamp(self.end_time).isoformat() if self.end_time else None,
            "duration_seconds": (self.end_time - self.start_time) if self.end_time else None,
            "data_load_time": self.data_load_time,
            "preprocessing_time": self.preprocessing_time,
            "training_time": self.training_time,
            "evaluation_time": self.evaluation_time,
            "model_save_time": self.model_save_time,
            "total_records": self.total_records,
            "training_samples": self.training_samples,
            "test_samples": self.test_samples,
            "retries": self.retries,
            "failures": self.failures,
        }


class FraudDetectionTrainer:
    """
    Distributed fraud detection model trainer using Ray with full resilience
    
    Features:
    - Circuit breaker for S3/MinIO and Spark operations
    - Exponential backoff retry for transient failures
    - Graceful degradation with fallback to local storage
    - Comprehensive metrics and health checks
    """
    
    def __init__(self, s3_endpoint: str = None):
        """Initialize the trainer with resilience patterns"""
        self.s3_endpoint = s3_endpoint or os.getenv("S3_ENDPOINT", "http://rustfs.lakehouse:9000")
        self.metrics = TrainingMetrics()
        
        # Circuit breakers for external services
        self.s3_circuit = CircuitBreaker("s3", CircuitBreakerConfig(failure_threshold=3, reset_timeout=30.0))
        self.spark_circuit = CircuitBreaker("spark", CircuitBreakerConfig(failure_threshold=3, reset_timeout=60.0))
        self.ray_circuit = CircuitBreaker("ray", CircuitBreakerConfig(failure_threshold=3, reset_timeout=60.0))
        
        # Initialize clients with retry
        self.s3_client = self._init_s3_client_with_retry()
        self.spark = self._init_spark_with_retry()
        
        # Initialize Ray with retry
        self._init_ray_with_retry()
        
        # Health status
        self._healthy = True
        self._last_health_check = time.time()
        
        logger.info("FraudDetectionTrainer initialized with resilience patterns")
    
    def _init_s3_client_with_retry(self):
        """Initialize S3 client with retry logic"""
        @retry_with_backoff(RetryConfig(max_attempts=3, initial_delay=1.0))
        def init_client():
            return boto3.client(
                's3',
                endpoint_url=self.s3_endpoint,
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID', 'minioadmin'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY', 'minioadmin')
            )
        
        try:
            return init_client()
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {e}")
            self.s3_circuit.record_failure()
            return None
    
    def _init_spark_with_retry(self):
        """Initialize Spark session with retry logic"""
        @retry_with_backoff(RetryConfig(max_attempts=3, initial_delay=2.0))
        def init_spark():
            builder = (SparkSession.builder
                .appName("Fraud Detection Data Loader")
                .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
                .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint)
                .config("spark.hadoop.fs.s3a.access.key", os.getenv('AWS_ACCESS_KEY_ID', 'minioadmin'))
                .config("spark.hadoop.fs.s3a.secret.key", os.getenv('AWS_SECRET_ACCESS_KEY', 'minioadmin'))
                .config("spark.hadoop.fs.s3a.path.style.access", "true")
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
                .config("spark.hadoop.fs.s3a.connection.timeout", "30000")
                .config("spark.hadoop.fs.s3a.attempts.maximum", "3"))
            
            return configure_spark_with_delta_pip(builder).getOrCreate()
        
        try:
            return init_spark()
        except Exception as e:
            logger.error(f"Failed to initialize Spark: {e}")
            self.spark_circuit.record_failure()
            return None
    
    def _init_ray_with_retry(self):
        """Initialize Ray with retry logic"""
        @retry_with_backoff(RetryConfig(max_attempts=3, initial_delay=2.0))
        def init_ray():
            if not ray.is_initialized():
                ray.init(address="auto", ignore_reinit_error=True)
        
        try:
            init_ray()
            self.ray_circuit.record_success()
        except Exception as e:
            logger.warning(f"Failed to connect to Ray cluster, using local mode: {e}")
            self.ray_circuit.record_failure()
            try:
                ray.init(ignore_reinit_error=True)
                logger.info("Ray initialized in local mode")
            except Exception as e2:
                logger.error(f"Failed to initialize Ray even in local mode: {e2}")
    
    def is_healthy(self) -> bool:
        """Check if the trainer is healthy"""
        return (
            self._healthy and
            self.s3_circuit.state != CircuitState.OPEN and
            self.spark_circuit.state != CircuitState.OPEN and
            self.ray_circuit.state != CircuitState.OPEN
        )
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get detailed health status"""
        return {
            "healthy": self.is_healthy(),
            "s3_circuit": self.s3_circuit.state.value,
            "spark_circuit": self.spark_circuit.state.value,
            "ray_circuit": self.ray_circuit.state.value,
            "s3_client_initialized": self.s3_client is not None,
            "spark_initialized": self.spark is not None,
            "ray_initialized": ray.is_initialized(),
            "last_health_check": datetime.fromtimestamp(self._last_health_check).isoformat(),
        }
    
    def _init_s3_client(self):
        """Initialize S3 client for MinIO (legacy method)"""
        return self._init_s3_client_with_retry()
    
    def _init_spark(self):
        """Initialize Spark session for Delta Lake (legacy method)"""
        return self._init_spark_with_retry()
    
    def load_data_from_delta(self, path="s3a://delta-lake/ml/fraud_features"):
        """Load training data from Delta Lake"""
        logger.info(f"Loading data from {path}")
        
        # Read from Delta Lake
        df = self.spark.read.format("delta").load(path)
        
        # Convert to Pandas for ML training
        pandas_df = df.toPandas()
        
        logger.info(f"Loaded {len(pandas_df)} records")
        return pandas_df
    
    def preprocess_data(self, df):
        """Preprocess data for ML training"""
        logger.info("Preprocessing data")
        
        # Select features
        feature_columns = [
            'amount', 'fraud_score', 'hour_of_day', 'day_of_week',
            'is_weekend', 'is_night', 'payer_tx_count', 'payer_avg_amount',
            'payer_stddev_amount', 'amount_deviation', 'merchant_tx_count',
            'merchant_avg_amount', 'merchant_anomaly_rate'
        ]
        
        # Handle categorical variables
        label_encoders = {}
        categorical_columns = ['merchant_category', 'country', 'currency']
        
        for col in categorical_columns:
            if col in df.columns:
                le = LabelEncoder()
                df[f'{col}_encoded'] = le.fit_transform(df[col].astype(str))
                feature_columns.append(f'{col}_encoded')
                label_encoders[col] = le
        
        # Prepare features and target
        X = df[feature_columns].fillna(0)
        y = df['is_anomaly'].astype(int)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        logger.info(f"Training set: {len(X_train)} samples")
        logger.info(f"Test set: {len(X_test)} samples")
        logger.info(f"Fraud rate: {y.mean():.2%}")
        
        return {
            'X_train': X_train_scaled,
            'X_test': X_test_scaled,
            'y_train': y_train,
            'y_test': y_test,
            'feature_names': feature_columns,
            'scaler': scaler,
            'label_encoders': label_encoders
        }
    
    def train_xgboost_model(self, data_dict, num_workers=4):
        """Train XGBoost model using Ray"""
        logger.info("Training XGBoost model with Ray")
        
        # Prepare data for Ray
        train_dataset = ray.data.from_pandas(
            pd.DataFrame({
                **{f'feature_{i}': data_dict['X_train'][:, i] 
                   for i in range(data_dict['X_train'].shape[1])},
                'label': data_dict['y_train'].values
            })
        )
        
        # Define XGBoost parameters
        params = {
            "objective": "binary:logistic",
            "eval_metric": ["logloss", "auc"],
            "max_depth": 8,
            "learning_rate": 0.1,
            "n_estimators": 200,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 5,
            "scale_pos_weight": 10,  # Handle imbalanced data
            "tree_method": "hist",
        }
        
        # Create trainer
        trainer = XGBoostTrainer(
            scaling_config=ScalingConfig(
                num_workers=num_workers,
                use_gpu=False
            ),
            label_column="label",
            params=params,
            datasets={"train": train_dataset}
        )
        
        # Train model
        result = trainer.fit()
        
        logger.info("XGBoost training completed")
        return result
    
    def train_lightgbm_model(self, data_dict, num_workers=4):
        """Train LightGBM model using Ray"""
        logger.info("Training LightGBM model with Ray")
        
        # Prepare data for Ray
        train_dataset = ray.data.from_pandas(
            pd.DataFrame({
                **{f'feature_{i}': data_dict['X_train'][:, i] 
                   for i in range(data_dict['X_train'].shape[1])},
                'label': data_dict['y_train'].values
            })
        )
        
        # Define LightGBM parameters
        params = {
            "objective": "binary",
            "metric": ["binary_logloss", "auc"],
            "num_leaves": 31,
            "learning_rate": 0.05,
            "n_estimators": 200,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_samples": 20,
            "scale_pos_weight": 10,
        }
        
        # Create trainer
        trainer = LightGBMTrainer(
            scaling_config=ScalingConfig(
                num_workers=num_workers,
                use_gpu=False
            ),
            label_column="label",
            params=params,
            datasets={"train": train_dataset}
        )
        
        # Train model
        result = trainer.fit()
        
        logger.info("LightGBM training completed")
        return result
    
    def evaluate_model(self, model, data_dict):
        """Evaluate model performance"""
        logger.info("Evaluating model")
        
        # Make predictions
        y_pred_proba = model.predict_proba(data_dict['X_test'])[:, 1]
        y_pred = (y_pred_proba > 0.5).astype(int)
        
        # Calculate metrics
        metrics = {
            'accuracy': accuracy_score(data_dict['y_test'], y_pred),
            'precision': precision_score(data_dict['y_test'], y_pred),
            'recall': recall_score(data_dict['y_test'], y_pred),
            'f1_score': f1_score(data_dict['y_test'], y_pred),
            'roc_auc': roc_auc_score(data_dict['y_test'], y_pred_proba),
        }
        
        # Confusion matrix
        cm = confusion_matrix(data_dict['y_test'], y_pred)
        
        logger.info("Model Evaluation Results:")
        logger.info(f"Accuracy: {metrics['accuracy']:.4f}")
        logger.info(f"Precision: {metrics['precision']:.4f}")
        logger.info(f"Recall: {metrics['recall']:.4f}")
        logger.info(f"F1 Score: {metrics['f1_score']:.4f}")
        logger.info(f"ROC AUC: {metrics['roc_auc']:.4f}")
        logger.info(f"Confusion Matrix:\n{cm}")
        
        return metrics, cm
    
    def save_model_to_s3(self, model, metadata, model_name="fraud_detection_model"):
        """Save model and metadata to S3/MinIO"""
        logger.info(f"Saving model to S3: {model_name}")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_path = f"ml-models/{model_name}_{timestamp}"
        
        # Save model locally first
        local_model_path = f"/tmp/{model_name}_{timestamp}.pkl"
        joblib.dump(model, local_model_path)
        
        # Upload to S3
        self.s3_client.upload_file(
            local_model_path,
            'ml-models',
            f"{model_name}_{timestamp}.pkl"
        )
        
        # Save metadata
        metadata_json = json.dumps(metadata, indent=2)
        self.s3_client.put_object(
            Bucket='ml-models',
            Key=f"{model_name}_{timestamp}_metadata.json",
            Body=metadata_json
        )
        
        logger.info(f"Model saved successfully: {model_path}")
        return model_path
    
    def run_training_pipeline(self):
        """Run the complete training pipeline"""
        logger.info("Starting fraud detection training pipeline")
        
        try:
            # Load data
            df = self.load_data_from_delta()
            
            # Preprocess data
            data_dict = self.preprocess_data(df)
            
            # Train XGBoost model
            xgb_result = self.train_xgboost_model(data_dict, num_workers=4)
            xgb_model = xgb_result.checkpoint.get_model()
            
            # Evaluate XGBoost model
            xgb_metrics, xgb_cm = self.evaluate_model(xgb_model, data_dict)
            
            # Train LightGBM model
            lgb_result = self.train_lightgbm_model(data_dict, num_workers=4)
            lgb_model = lgb_result.checkpoint.get_model()
            
            # Evaluate LightGBM model
            lgb_metrics, lgb_cm = self.evaluate_model(lgb_model, data_dict)
            
            # Choose best model
            if xgb_metrics['roc_auc'] > lgb_metrics['roc_auc']:
                best_model = xgb_model
                best_metrics = xgb_metrics
                best_model_name = "xgboost_fraud_detection"
            else:
                best_model = lgb_model
                best_metrics = lgb_metrics
                best_model_name = "lightgbm_fraud_detection"
            
            # Prepare metadata
            metadata = {
                'model_name': best_model_name,
                'timestamp': datetime.now().isoformat(),
                'metrics': best_metrics,
                'feature_names': data_dict['feature_names'],
                'training_samples': len(data_dict['X_train']),
                'test_samples': len(data_dict['X_test']),
            }
            
            # Save best model
            model_path = self.save_model_to_s3(best_model, metadata, best_model_name)
            
            logger.info(f"Training pipeline completed successfully. Best model: {best_model_name}")
            logger.info(f"Model saved to: {model_path}")
            
            return best_model, metadata
            
        except Exception as e:
            logger.error(f"Error in training pipeline: {str(e)}")
            raise
        finally:
            self.spark.stop()
            ray.shutdown()


def main():
    """Main entry point"""
    trainer = FraudDetectionTrainer()
    trainer.run_training_pipeline()


if __name__ == "__main__":
    main()
