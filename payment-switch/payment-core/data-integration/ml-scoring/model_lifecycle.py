"""
Production Model Lifecycle Management for Fraud Detection
Implements Phase 2: Drift monitoring, backtesting, feedback loops, champion-challenger
"""

import json
import hashlib
import logging
import threading
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any, Callable
from collections import defaultdict
import math
import statistics

logger = logging.getLogger(__name__)


# =============================================================================
# Model Version Management
# =============================================================================

class ModelStatus(Enum):
    TRAINING = "TRAINING"
    VALIDATING = "VALIDATING"
    CHALLENGER = "CHALLENGER"
    CHAMPION = "CHAMPION"
    RETIRED = "RETIRED"
    ROLLBACK = "ROLLBACK"


@dataclass
class ModelMetrics:
    """Model performance metrics"""
    auc: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1_score: float = 0.0
    false_positive_rate: float = 0.0
    false_negative_rate: float = 0.0
    accuracy: float = 0.0
    log_loss: float = 0.0
    ks_statistic: float = 0.0
    gini_coefficient: float = 0.0
    sample_size: int = 0
    evaluated_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            'evaluated_at': self.evaluated_at.isoformat()
        }


@dataclass
class DriftMetrics:
    """Model drift metrics"""
    feature_drift: Dict[str, float] = field(default_factory=dict)
    prediction_drift: float = 0.0
    label_drift: float = 0.0
    psi: float = 0.0  # Population Stability Index
    kl_divergence: float = 0.0
    js_divergence: float = 0.0
    drift_detected: bool = False
    drift_severity: str = "LOW"
    measured_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            'measured_at': self.measured_at.isoformat()
        }


@dataclass
class ModelVersion:
    """Model version with metadata"""
    version_id: str
    model_name: str
    version: str
    status: ModelStatus = ModelStatus.TRAINING
    metrics: Optional[ModelMetrics] = None
    drift_metrics: Optional[DriftMetrics] = None
    trained_at: datetime = field(default_factory=datetime.utcnow)
    deployed_at: Optional[datetime] = None
    retired_at: Optional[datetime] = None
    config: Dict[str, Any] = field(default_factory=dict)
    model_artifact: Any = None  # The actual model object
    
    def to_dict(self) -> Dict:
        return {
            'version_id': self.version_id,
            'model_name': self.model_name,
            'version': self.version,
            'status': self.status.value,
            'metrics': self.metrics.to_dict() if self.metrics else None,
            'drift_metrics': self.drift_metrics.to_dict() if self.drift_metrics else None,
            'trained_at': self.trained_at.isoformat(),
            'deployed_at': self.deployed_at.isoformat() if self.deployed_at else None,
            'retired_at': self.retired_at.isoformat() if self.retired_at else None,
            'config': self.config
        }


class ModelLifecycleManager:
    """Manages model versions, deployment, and lifecycle"""
    
    def __init__(self, db_connection=None):
        self.db = db_connection
        self.models: Dict[str, ModelVersion] = {}
        self.champion_model: Optional[ModelVersion] = None
        self.challenger_model: Optional[ModelVersion] = None
        self._lock = threading.RLock()
        self.drift_threshold = 0.1  # PSI threshold for drift detection
        self.traffic_split = 0.1  # 10% traffic to challenger
        self.min_auc_threshold = 0.7
        self.min_sample_size = 1000
        
    def register_model(self, model: ModelVersion) -> None:
        """Register a new model version"""
        with self._lock:
            model.status = ModelStatus.VALIDATING
            self.models[model.version_id] = model
            logger.info(f"Registered model {model.version_id} for validation")
            
    def validate_model(self, version_id: str, metrics: ModelMetrics) -> Tuple[bool, str]:
        """Validate a model meets minimum requirements"""
        with self._lock:
            model = self.models.get(version_id)
            if not model:
                return False, f"Model {version_id} not found"
            
            model.metrics = metrics
            
            # Check minimum requirements
            if metrics.auc < self.min_auc_threshold:
                return False, f"AUC {metrics.auc:.3f} below threshold {self.min_auc_threshold}"
            
            if metrics.sample_size < self.min_sample_size:
                return False, f"Sample size {metrics.sample_size} below minimum {self.min_sample_size}"
            
            if metrics.false_positive_rate > 0.1:
                return False, f"False positive rate {metrics.false_positive_rate:.3f} too high"
            
            return True, "Model validated successfully"
    
    def promote_to_challenger(self, version_id: str) -> Tuple[bool, str]:
        """Promote a model to challenger status"""
        with self._lock:
            model = self.models.get(version_id)
            if not model:
                return False, f"Model {version_id} not found"
            
            if model.status != ModelStatus.VALIDATING:
                return False, f"Model must be in VALIDATING status, currently {model.status.value}"
            
            # Validate metrics exist
            if not model.metrics:
                return False, "Model has no metrics, cannot promote"
            
            # Retire current challenger if exists
            if self.challenger_model:
                self.challenger_model.status = ModelStatus.RETIRED
                self.challenger_model.retired_at = datetime.utcnow()
            
            model.status = ModelStatus.CHALLENGER
            self.challenger_model = model
            logger.info(f"Promoted model {version_id} to challenger")
            return True, "Model promoted to challenger"
    
    def promote_to_champion(self, version_id: str) -> Tuple[bool, str]:
        """Promote challenger to champion"""
        with self._lock:
            model = self.models.get(version_id)
            if not model:
                return False, f"Model {version_id} not found"
            
            if model.status != ModelStatus.CHALLENGER:
                return False, f"Model must be CHALLENGER to promote to champion"
            
            # Retire current champion
            if self.champion_model:
                self.champion_model.status = ModelStatus.RETIRED
                self.champion_model.retired_at = datetime.utcnow()
                logger.info(f"Retired champion model {self.champion_model.version_id}")
            
            # Promote challenger
            model.status = ModelStatus.CHAMPION
            model.deployed_at = datetime.utcnow()
            self.champion_model = model
            self.challenger_model = None
            
            logger.info(f"Promoted model {version_id} to champion")
            return True, "Model promoted to champion"
    
    def rollback(self, target_version_id: str) -> Tuple[bool, str]:
        """Rollback to a previous model version"""
        with self._lock:
            target = self.models.get(target_version_id)
            if not target:
                return False, f"Target model {target_version_id} not found"
            
            # Mark current champion for rollback
            if self.champion_model:
                self.champion_model.status = ModelStatus.ROLLBACK
                logger.warning(f"Rolling back from {self.champion_model.version_id}")
            
            # Restore target
            target.status = ModelStatus.CHAMPION
            target.deployed_at = datetime.utcnow()
            self.champion_model = target
            
            logger.info(f"Rolled back to model {target_version_id}")
            return True, f"Rolled back to {target_version_id}"
    
    def get_model_for_scoring(self) -> Tuple[Optional[ModelVersion], bool]:
        """Get model for scoring with champion/challenger split"""
        with self._lock:
            # If challenger exists, use traffic split
            if self.challenger_model:
                # Simple random split
                if (time.time_ns() % 100) / 100 < self.traffic_split:
                    return self.challenger_model, True  # is_challenger
            
            return self.champion_model, False


# =============================================================================
# Drift Monitoring
# =============================================================================

class DriftMonitor:
    """Monitors model drift using PSI and other metrics"""
    
    def __init__(self, baseline_window_days: int = 7, recent_window_hours: int = 24):
        self.baseline_window = timedelta(days=baseline_window_days)
        self.recent_window = timedelta(hours=recent_window_hours)
        self.predictions: List[Dict] = []
        self._lock = threading.RLock()
        self.psi_threshold = 0.1
        self.num_bins = 10
        
    def record_prediction(self, prediction: Dict) -> None:
        """Record a prediction for drift monitoring"""
        with self._lock:
            prediction['timestamp'] = datetime.utcnow()
            self.predictions.append(prediction)
            
            # Keep only last 30 days of predictions
            cutoff = datetime.utcnow() - timedelta(days=30)
            self.predictions = [p for p in self.predictions if p['timestamp'] > cutoff]
    
    def calculate_drift(self, features: List[str]) -> DriftMetrics:
        """Calculate drift metrics"""
        with self._lock:
            now = datetime.utcnow()
            
            # Get recent and baseline predictions
            recent = [p for p in self.predictions 
                     if p['timestamp'] > now - self.recent_window]
            baseline = [p for p in self.predictions 
                       if now - self.baseline_window < p['timestamp'] < now - self.recent_window]
            
            if len(recent) < 100 or len(baseline) < 100:
                return DriftMetrics(drift_detected=False, drift_severity="INSUFFICIENT_DATA")
            
            # Calculate feature drift
            feature_drift = {}
            total_psi = 0.0
            
            for feature in features:
                recent_values = [p['features'].get(feature, 0) for p in recent]
                baseline_values = [p['features'].get(feature, 0) for p in baseline]
                
                psi = self._calculate_psi(recent_values, baseline_values)
                feature_drift[feature] = psi
                total_psi += psi
            
            avg_psi = total_psi / len(features) if features else 0
            
            # Calculate prediction drift
            recent_scores = [p['score'] for p in recent]
            baseline_scores = [p['score'] for p in baseline]
            prediction_drift = self._calculate_psi(recent_scores, baseline_scores)
            
            # Calculate label drift (if labels available)
            label_drift = self._calculate_label_drift(recent, baseline)
            
            # Determine severity
            drift_detected = avg_psi > self.psi_threshold or prediction_drift > self.psi_threshold
            
            if avg_psi > 0.25:
                severity = "CRITICAL"
            elif avg_psi > 0.1:
                severity = "HIGH"
            elif avg_psi > 0.05:
                severity = "MEDIUM"
            else:
                severity = "LOW"
            
            return DriftMetrics(
                feature_drift=feature_drift,
                prediction_drift=prediction_drift,
                label_drift=label_drift,
                psi=avg_psi,
                drift_detected=drift_detected,
                drift_severity=severity,
                measured_at=now
            )
    
    def _calculate_psi(self, actual: List[float], expected: List[float]) -> float:
        """Calculate Population Stability Index"""
        if not actual or not expected:
            return 0.0
        
        # Create bins from combined data
        all_values = sorted(actual + expected)
        bin_edges = []
        for i in range(self.num_bins + 1):
            idx = int(i / self.num_bins * (len(all_values) - 1))
            bin_edges.append(all_values[idx])
        
        # Count values in each bin
        actual_counts = [0] * self.num_bins
        expected_counts = [0] * self.num_bins
        
        for v in actual:
            for i in range(self.num_bins):
                if v >= bin_edges[i] and (i == self.num_bins - 1 or v < bin_edges[i + 1]):
                    actual_counts[i] += 1
                    break
        
        for v in expected:
            for i in range(self.num_bins):
                if v >= bin_edges[i] and (i == self.num_bins - 1 or v < bin_edges[i + 1]):
                    expected_counts[i] += 1
                    break
        
        # Calculate PSI with smoothing
        psi = 0.0
        for i in range(self.num_bins):
            actual_pct = (actual_counts[i] + 0.5) / (len(actual) + 0.5 * self.num_bins)
            expected_pct = (expected_counts[i] + 0.5) / (len(expected) + 0.5 * self.num_bins)
            psi += (actual_pct - expected_pct) * math.log(actual_pct / expected_pct)
        
        return abs(psi)
    
    def _calculate_label_drift(self, recent: List[Dict], baseline: List[Dict]) -> float:
        """Calculate label drift"""
        recent_labels = [p.get('label') for p in recent if p.get('label') is not None]
        baseline_labels = [p.get('label') for p in baseline if p.get('label') is not None]
        
        if not recent_labels or not baseline_labels:
            return 0.0
        
        recent_rate = sum(recent_labels) / len(recent_labels)
        baseline_rate = sum(baseline_labels) / len(baseline_labels)
        
        return abs(recent_rate - baseline_rate)


# =============================================================================
# Backtesting Harness
# =============================================================================

@dataclass
class GoldenTransaction:
    """Golden test transaction"""
    transaction_id: str
    features: Dict[str, float]
    expected_score: float
    expected_decision: str
    actual_label: int  # 1=fraud, 0=legitimate
    category: str  # velocity, amount, geo, etc.


@dataclass
class BacktestResult:
    """Backtest results"""
    model_version: str
    total_tests: int
    passed: int
    failed: int
    metrics: Optional[ModelMetrics]
    failed_cases: List[Dict]
    executed_at: datetime
    duration_ms: float
    
    def to_dict(self) -> Dict:
        return {
            'model_version': self.model_version,
            'total_tests': self.total_tests,
            'passed': self.passed,
            'failed': self.failed,
            'pass_rate': self.passed / self.total_tests if self.total_tests > 0 else 0,
            'metrics': self.metrics.to_dict() if self.metrics else None,
            'failed_cases': self.failed_cases,
            'executed_at': self.executed_at.isoformat(),
            'duration_ms': self.duration_ms
        }


class BacktestHarness:
    """Backtesting harness for fraud models"""
    
    def __init__(self):
        self.golden_dataset: List[GoldenTransaction] = []
        self._lock = threading.RLock()
        self._load_golden_dataset()
    
    def _load_golden_dataset(self) -> None:
        """Load golden test transactions"""
        self.golden_dataset = [
            # High-risk velocity pattern
            GoldenTransaction(
                transaction_id="golden_velocity_001",
                features={
                    "amount": 5000, "velocity_1h": 15, "velocity_24h": 50,
                    "hour_of_day": 3, "is_weekend": 1, "merchant_risk": 0.8,
                    "device_age_days": 1, "account_age_days": 7
                },
                expected_score=0.85, expected_decision="BLOCK", actual_label=1, category="velocity"
            ),
            # Large amount pattern
            GoldenTransaction(
                transaction_id="golden_amount_001",
                features={
                    "amount": 500000, "velocity_1h": 1, "velocity_24h": 5,
                    "hour_of_day": 14, "is_weekend": 0, "merchant_risk": 0.3,
                    "device_age_days": 365, "account_age_days": 730
                },
                expected_score=0.75, expected_decision="REVIEW", actual_label=0, category="amount"
            ),
            # Normal transaction
            GoldenTransaction(
                transaction_id="golden_normal_001",
                features={
                    "amount": 100, "velocity_1h": 1, "velocity_24h": 3,
                    "hour_of_day": 10, "is_weekend": 0, "merchant_risk": 0.1,
                    "device_age_days": 180, "account_age_days": 365
                },
                expected_score=0.1, expected_decision="ALLOW", actual_label=0, category="normal"
            ),
            # Structuring pattern
            GoldenTransaction(
                transaction_id="golden_structuring_001",
                features={
                    "amount": 9900, "velocity_1h": 5, "velocity_24h": 20,
                    "hour_of_day": 16, "is_weekend": 0, "merchant_risk": 0.2,
                    "device_age_days": 30, "account_age_days": 60
                },
                expected_score=0.7, expected_decision="REVIEW", actual_label=1, category="structuring"
            ),
            # New device fraud
            GoldenTransaction(
                transaction_id="golden_new_device_001",
                features={
                    "amount": 2000, "velocity_1h": 3, "velocity_24h": 10,
                    "hour_of_day": 2, "is_weekend": 1, "merchant_risk": 0.5,
                    "device_age_days": 0, "account_age_days": 365
                },
                expected_score=0.8, expected_decision="BLOCK", actual_label=1, category="device"
            ),
            # Impossible travel
            GoldenTransaction(
                transaction_id="golden_geo_001",
                features={
                    "amount": 500, "velocity_1h": 2, "velocity_24h": 5,
                    "hour_of_day": 12, "is_weekend": 0, "merchant_risk": 0.2,
                    "device_age_days": 90, "account_age_days": 180,
                    "distance_from_last_km": 5000, "time_since_last_min": 30
                },
                expected_score=0.9, expected_decision="BLOCK", actual_label=1, category="geo"
            ),
            # Legitimate high-value
            GoldenTransaction(
                transaction_id="golden_legit_high_001",
                features={
                    "amount": 100000, "velocity_1h": 1, "velocity_24h": 2,
                    "hour_of_day": 11, "is_weekend": 0, "merchant_risk": 0.1,
                    "device_age_days": 500, "account_age_days": 1000
                },
                expected_score=0.3, expected_decision="ALLOW", actual_label=0, category="legitimate"
            ),
            # Mule pattern
            GoldenTransaction(
                transaction_id="golden_mule_001",
                features={
                    "amount": 1000, "velocity_1h": 20, "velocity_24h": 100,
                    "hour_of_day": 15, "is_weekend": 0, "merchant_risk": 0.4,
                    "device_age_days": 5, "account_age_days": 14,
                    "unique_recipients_24h": 50, "inbound_outbound_ratio": 0.95
                },
                expected_score=0.95, expected_decision="BLOCK", actual_label=1, category="mule"
            ),
        ]
    
    def run_backtest(self, scorer: Callable[[Dict], Tuple[float, str]], 
                     model_version: str) -> BacktestResult:
        """Run backtest against a model"""
        with self._lock:
            start_time = time.time()
            
            passed = 0
            failed = 0
            failed_cases = []
            
            # Metrics calculation
            true_positives = 0
            true_negatives = 0
            false_positives = 0
            false_negatives = 0
            total_log_loss = 0.0
            
            for golden in self.golden_dataset:
                try:
                    score, decision = scorer(golden.features)
                    
                    # Check if score is within tolerance (+-0.15)
                    score_diff = abs(score - golden.expected_score)
                    decision_match = decision == golden.expected_decision
                    
                    if score_diff <= 0.15 and decision_match:
                        passed += 1
                    else:
                        failed += 1
                        failed_cases.append({
                            'transaction_id': golden.transaction_id,
                            'category': golden.category,
                            'expected_score': golden.expected_score,
                            'actual_score': score,
                            'expected_decision': golden.expected_decision,
                            'actual_decision': decision,
                            'score_diff': score_diff
                        })
                    
                    # Calculate metrics
                    predicted = 1 if score >= 0.5 else 0
                    
                    if predicted == 1 and golden.actual_label == 1:
                        true_positives += 1
                    elif predicted == 0 and golden.actual_label == 0:
                        true_negatives += 1
                    elif predicted == 1 and golden.actual_label == 0:
                        false_positives += 1
                    else:
                        false_negatives += 1
                    
                    # Log loss
                    if golden.actual_label == 1:
                        total_log_loss -= math.log(max(score, 1e-15))
                    else:
                        total_log_loss -= math.log(max(1 - score, 1e-15))
                        
                except Exception as e:
                    failed += 1
                    failed_cases.append({
                        'transaction_id': golden.transaction_id,
                        'error': str(e)
                    })
            
            # Calculate final metrics
            total = true_positives + true_negatives + false_positives + false_negatives
            metrics = None
            
            if total > 0:
                precision = true_positives / max(true_positives + false_positives, 1)
                recall = true_positives / max(true_positives + false_negatives, 1)
                
                metrics = ModelMetrics(
                    precision=precision,
                    recall=recall,
                    f1_score=2 * precision * recall / max(precision + recall, 1e-10),
                    false_positive_rate=false_positives / max(false_positives + true_negatives, 1),
                    false_negative_rate=false_negatives / max(false_negatives + true_positives, 1),
                    accuracy=(true_positives + true_negatives) / total,
                    log_loss=total_log_loss / total,
                    sample_size=total
                )
            
            duration_ms = (time.time() - start_time) * 1000
            
            return BacktestResult(
                model_version=model_version,
                total_tests=len(self.golden_dataset),
                passed=passed,
                failed=failed,
                metrics=metrics,
                failed_cases=failed_cases,
                executed_at=datetime.utcnow(),
                duration_ms=duration_ms
            )
    
    def add_golden_transaction(self, transaction: GoldenTransaction) -> None:
        """Add a golden transaction to the dataset"""
        with self._lock:
            self.golden_dataset.append(transaction)


# =============================================================================
# Feedback Loop
# =============================================================================

@dataclass
class FraudFeedback:
    """Feedback on a fraud decision"""
    transaction_id: str
    original_score: float
    original_decision: str
    actual_outcome: str  # FRAUD, LEGITIMATE, CHARGEBACK
    feedback_source: str  # REVIEWER, CHARGEBACK, CUSTOMER
    feedback_at: datetime = field(default_factory=datetime.utcnow)
    reviewer_id: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class LabeledTransaction:
    """Labeled transaction for training"""
    transaction_id: str
    features: Dict[str, float]
    label: int  # 1=fraud, 0=legitimate
    label_source: str
    labeled_at: datetime
    model_version: str


class FeedbackLoop:
    """Manages feedback from confirmed fraud to training"""
    
    def __init__(self, db_connection=None):
        self.db = db_connection
        self.feedback_queue: List[FraudFeedback] = []
        self.labeled_data: List[LabeledTransaction] = []
        self._lock = threading.RLock()
        self.batch_size = 1000
        self._running = True
        self._processor_thread = threading.Thread(target=self._process_loop, daemon=True)
        self._processor_thread.start()
    
    def submit_feedback(self, feedback: FraudFeedback) -> bool:
        """Submit feedback on a fraud decision"""
        with self._lock:
            if len(self.feedback_queue) >= 10000:
                logger.warning("Feedback queue full, dropping feedback")
                return False
            self.feedback_queue.append(feedback)
            return True
    
    def _process_loop(self) -> None:
        """Process feedback in background"""
        while self._running:
            time.sleep(60)  # Process every minute
            self._process_batch()
    
    def _process_batch(self) -> None:
        """Process a batch of feedback"""
        with self._lock:
            if not self.feedback_queue:
                return
            
            batch = self.feedback_queue[:self.batch_size]
            self.feedback_queue = self.feedback_queue[self.batch_size:]
        
        for feedback in batch:
            # Convert feedback to labeled transaction
            label = 1 if feedback.actual_outcome in ("FRAUD", "CHARGEBACK") else 0
            
            labeled = LabeledTransaction(
                transaction_id=feedback.transaction_id,
                features={},  # Would be fetched from feature store
                label=label,
                label_source=feedback.feedback_source,
                labeled_at=feedback.feedback_at,
                model_version=""
            )
            
            with self._lock:
                self.labeled_data.append(labeled)
            
            logger.info(f"Labeled transaction {feedback.transaction_id} as {'FRAUD' if label == 1 else 'LEGITIMATE'}")
    
    def get_training_data(self, since: datetime, limit: int = 10000) -> List[LabeledTransaction]:
        """Get labeled data for model training"""
        with self._lock:
            result = [
                t for t in self.labeled_data 
                if t.labeled_at > since
            ][:limit]
            return result
    
    def get_feedback_stats(self) -> Dict:
        """Get feedback statistics"""
        with self._lock:
            total = len(self.labeled_data)
            fraud_count = sum(1 for t in self.labeled_data if t.label == 1)
            
            return {
                'total_labeled': total,
                'fraud_count': fraud_count,
                'legitimate_count': total - fraud_count,
                'fraud_rate': fraud_count / total if total > 0 else 0,
                'pending_feedback': len(self.feedback_queue)
            }
    
    def stop(self) -> None:
        """Stop the feedback loop"""
        self._running = False


# =============================================================================
# Champion-Challenger Framework
# =============================================================================

class ChampionChallengerFramework:
    """Framework for safe model deployment with A/B testing"""
    
    def __init__(self, lifecycle_manager: ModelLifecycleManager, 
                 drift_monitor: DriftMonitor,
                 backtest_harness: BacktestHarness):
        self.lifecycle = lifecycle_manager
        self.drift_monitor = drift_monitor
        self.backtest = backtest_harness
        self.challenger_metrics: Dict[str, List[Dict]] = defaultdict(list)
        self._lock = threading.RLock()
        
        # Promotion criteria
        self.min_challenger_samples = 1000
        self.max_fpr_increase = 0.02  # Max 2% increase in false positive rate
        self.min_recall_improvement = 0.01  # Min 1% improvement in recall
    
    def record_challenger_prediction(self, model_version: str, 
                                     prediction: Dict, 
                                     is_challenger: bool) -> None:
        """Record a prediction for challenger evaluation"""
        if is_challenger:
            with self._lock:
                self.challenger_metrics[model_version].append({
                    'score': prediction['score'],
                    'decision': prediction['decision'],
                    'timestamp': datetime.utcnow()
                })
    
    def evaluate_challenger(self, challenger_version: str) -> Tuple[bool, str]:
        """Evaluate if challenger should be promoted"""
        with self._lock:
            metrics = self.challenger_metrics.get(challenger_version, [])
            
            if len(metrics) < self.min_challenger_samples:
                return False, f"Insufficient samples: {len(metrics)}/{self.min_challenger_samples}"
            
            challenger = self.lifecycle.models.get(challenger_version)
            champion = self.lifecycle.champion_model
            
            if not challenger or not champion:
                return False, "Missing challenger or champion model"
            
            if not challenger.metrics or not champion.metrics:
                return False, "Missing metrics for comparison"
            
            # Compare metrics
            fpr_increase = challenger.metrics.false_positive_rate - champion.metrics.false_positive_rate
            recall_improvement = challenger.metrics.recall - champion.metrics.recall
            
            if fpr_increase > self.max_fpr_increase:
                return False, f"FPR increase {fpr_increase:.3f} exceeds threshold {self.max_fpr_increase}"
            
            if recall_improvement < self.min_recall_improvement:
                return False, f"Recall improvement {recall_improvement:.3f} below threshold {self.min_recall_improvement}"
            
            return True, "Challenger meets promotion criteria"
    
    def auto_promote_if_ready(self, challenger_version: str) -> Tuple[bool, str]:
        """Automatically promote challenger if it meets criteria"""
        ready, reason = self.evaluate_challenger(challenger_version)
        
        if ready:
            success, msg = self.lifecycle.promote_to_champion(challenger_version)
            if success:
                # Clear challenger metrics
                with self._lock:
                    self.challenger_metrics.pop(challenger_version, None)
                return True, f"Challenger promoted: {msg}"
            return False, f"Promotion failed: {msg}"
        
        return False, f"Not ready for promotion: {reason}"


# =============================================================================
# Production Fraud Scoring Service
# =============================================================================

class ProductionFraudScoringService:
    """Production-ready fraud scoring service with full lifecycle management"""
    
    def __init__(self, db_connection=None):
        self.lifecycle = ModelLifecycleManager(db_connection)
        self.drift_monitor = DriftMonitor()
        self.backtest = BacktestHarness()
        self.feedback_loop = FeedbackLoop(db_connection)
        self.champion_challenger = ChampionChallengerFramework(
            self.lifecycle, self.drift_monitor, self.backtest
        )
        self._lock = threading.RLock()
        
    def score_transaction(self, features: Dict[str, float]) -> Dict:
        """Score a transaction with full lifecycle tracking"""
        model, is_challenger = self.lifecycle.get_model_for_scoring()
        
        if not model or not model.model_artifact:
            # Fallback to rule-based scoring
            score, decision = self._rule_based_score(features)
            return {
                'score': score,
                'decision': decision,
                'model_version': 'rules_fallback',
                'is_challenger': False
            }
        
        # Score with model
        try:
            score = model.model_artifact.predict_proba([list(features.values())])[0][1]
        except Exception as e:
            logger.error(f"Model scoring failed: {e}")
            score, decision = self._rule_based_score(features)
            return {
                'score': score,
                'decision': decision,
                'model_version': 'rules_fallback',
                'is_challenger': False
            }
        
        # Determine decision
        if score >= 0.8:
            decision = "BLOCK"
        elif score >= 0.5:
            decision = "REVIEW"
        else:
            decision = "ALLOW"
        
        result = {
            'score': score,
            'decision': decision,
            'model_version': model.version_id,
            'is_challenger': is_challenger
        }
        
        # Record for drift monitoring
        self.drift_monitor.record_prediction({
            'features': features,
            'score': score,
            'model_version': model.version_id
        })
        
        # Record for challenger evaluation
        self.champion_challenger.record_challenger_prediction(
            model.version_id, result, is_challenger
        )
        
        return result
    
    def _rule_based_score(self, features: Dict[str, float]) -> Tuple[float, str]:
        """Fallback rule-based scoring"""
        score = 0.0
        
        # Velocity rules
        if features.get('velocity_1h', 0) > 10:
            score += 0.3
        if features.get('velocity_24h', 0) > 50:
            score += 0.2
        
        # Amount rules
        amount = features.get('amount', 0)
        if amount > 100000:
            score += 0.3
        elif amount > 10000:
            score += 0.1
        
        # Time rules
        hour = features.get('hour_of_day', 12)
        if hour < 6 or hour > 22:
            score += 0.1
        
        # Device/account age
        if features.get('device_age_days', 365) < 7:
            score += 0.2
        if features.get('account_age_days', 365) < 30:
            score += 0.1
        
        score = min(score, 1.0)
        
        if score >= 0.8:
            decision = "BLOCK"
        elif score >= 0.5:
            decision = "REVIEW"
        else:
            decision = "ALLOW"
        
        return score, decision
    
    def submit_feedback(self, feedback: FraudFeedback) -> bool:
        """Submit feedback on a fraud decision"""
        return self.feedback_loop.submit_feedback(feedback)
    
    def check_drift(self) -> DriftMetrics:
        """Check for model drift"""
        features = ['amount', 'velocity_1h', 'velocity_24h', 'hour_of_day', 
                   'merchant_risk', 'device_age_days', 'account_age_days']
        return self.drift_monitor.calculate_drift(features)
    
    def run_backtest(self, model_version: str) -> BacktestResult:
        """Run backtest on a model"""
        model = self.lifecycle.models.get(model_version)
        
        if model and model.model_artifact:
            def scorer(features):
                score = model.model_artifact.predict_proba([list(features.values())])[0][1]
                decision = "BLOCK" if score >= 0.8 else ("REVIEW" if score >= 0.5 else "ALLOW")
                return score, decision
        else:
            scorer = lambda f: self._rule_based_score(f)
        
        return self.backtest.run_backtest(scorer, model_version)
    
    def get_status(self) -> Dict:
        """Get service status"""
        champion = self.lifecycle.champion_model
        challenger = self.lifecycle.challenger_model
        
        return {
            'champion_model': champion.version_id if champion else None,
            'champion_metrics': champion.metrics.to_dict() if champion and champion.metrics else None,
            'challenger_model': challenger.version_id if challenger else None,
            'challenger_metrics': challenger.metrics.to_dict() if challenger and challenger.metrics else None,
            'drift_metrics': self.drift_monitor.calculate_drift([]).to_dict(),
            'feedback_stats': self.feedback_loop.get_feedback_stats(),
            'total_models': len(self.lifecycle.models)
        }


# Export main classes
__all__ = [
    'ModelLifecycleManager',
    'DriftMonitor', 
    'BacktestHarness',
    'FeedbackLoop',
    'ChampionChallengerFramework',
    'ProductionFraudScoringService',
    'ModelVersion',
    'ModelMetrics',
    'DriftMetrics',
    'GoldenTransaction',
    'FraudFeedback'
]
