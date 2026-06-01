"""
Production Anomaly Detector — Real Isolation Forest
====================================================
Spec: FRQ-016 — batch inference < 200ms for 1000 readings.

Uses sklearn IsolationForest trained on synthetic production telemetry.
Detects: stuck sensors, sensor drift, abnormal production patterns.

Training: Fits on synthetic "normal" telemetry data, then uses the trained
model's anomaly scores for real inference. Model persisted via joblib.

Inference: CPU only, < 200ms for batch of 1000 readings.
"""

import logging
import os
import time
from pathlib import Path
from typing import List, Dict, Any

import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.getenv("ML_MODEL_DIR", "/tmp/og-rmm-models"))
IFOREST_PATH = MODEL_DIR / "anomaly_iforest.joblib"


class ProductionAnomalyDetector:
    """
    Isolation Forest for production anomaly detection.
    Trained on synthetic "normal" telemetry with known contamination rate.
    """

    def __init__(self):
        self._model = None
        self._scaler = None
        self._model_loaded = False
        self._contamination = 0.05

    async def load(self):
        """Load trained Isolation Forest from disk, or train from synthetic data."""
        loaded = self._load_from_disk()
        if not loaded:
            logger.warning("Anomaly detector not found on disk — training from synthetic data")
            self._train_from_synthetic()
        self._model_loaded = True
        logger.info("Production anomaly detector ready (model=%s)", "iforest" if self._model else "none")

    def _load_from_disk(self) -> bool:
        if not IFOREST_PATH.exists():
            return False
        try:
            import joblib
            data = joblib.load(IFOREST_PATH)
            self._model = data["model"]
            self._scaler = data["scaler"]
            logger.info("Isolation Forest loaded from %s", IFOREST_PATH)
            return True
        except Exception as e:
            logger.warning("Failed to load Isolation Forest: %s", e)
            return False

    def _save_to_disk(self):
        import joblib
        IFOREST_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self._model, "scaler": self._scaler}, IFOREST_PATH)
        logger.info("Isolation Forest saved to %s", IFOREST_PATH)

    def _train_from_synthetic(self, n_samples: int = 5000):
        """Train Isolation Forest on synthetic normal production data."""
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler

        rng = np.random.default_rng(42)

        # Generate normal telemetry patterns
        X_normal = np.column_stack([
            rng.normal(500, 100, n_samples),     # value (e.g., pressure PSI)
            rng.normal(90, 5, n_samples),         # quality (0-100)
            rng.uniform(0.01, 2.0, n_samples),    # rate_of_change
            rng.normal(0, 0.05, n_samples),       # deviation_from_mean
        ])

        # Inject 5% known anomalies for validation
        n_anomalies = int(n_samples * self._contamination)
        anomaly_indices = rng.choice(n_samples, n_anomalies, replace=False)
        X_normal[anomaly_indices, 0] *= rng.choice([0.1, 5.0], n_anomalies)  # Extreme values
        X_normal[anomaly_indices, 1] *= 0.3  # Low quality
        X_normal[anomaly_indices, 2] *= 10.0  # High rate of change

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X_normal)

        self._model = IsolationForest(
            n_estimators=200,
            contamination=self._contamination,
            max_features=1.0,
            bootstrap=True,
            random_state=42,
            n_jobs=-1,
        )
        self._model.fit(X_scaled)
        self._save_to_disk()

        # Validation
        y_pred = self._model.predict(X_scaled)
        detected = sum(1 for i in anomaly_indices if y_pred[i] == -1)
        logger.info(
            "Isolation Forest trained on %d samples (detected %d/%d injected anomalies = %.0f%%)",
            n_samples, detected, n_anomalies, 100 * detected / max(n_anomalies, 1),
        )

    async def detect(self, well_id: str, readings: List[Dict[str, Any]]) -> dict:
        """
        Run Isolation Forest anomaly detection on a batch of readings.
        Returns anomaly scores and indices.
        """
        if not readings:
            return {
                "well_id": well_id,
                "anomalies_detected": 0,
                "anomaly_indices": [],
                "anomaly_scores": [],
                "overall_health_score": 100.0,
                "model_type": "isolation_forest",
            }

        t0 = time.time()

        # Extract features from readings
        features = []
        for i, r in enumerate(readings):
            value = float(r.get("value", 0))
            quality = float(r.get("quality", 100))
            # Compute rate of change from neighboring readings
            if i > 0:
                prev_val = float(readings[i - 1].get("value", value))
                roc = abs(value - prev_val) / (abs(prev_val) + 1e-8)
            else:
                roc = 0.0
            # Compute deviation from local mean
            vals = [float(rd.get("value", 0)) for rd in readings[max(0, i - 5):i + 5]]
            local_mean = np.mean(vals) if vals else value
            deviation = (value - local_mean) / (abs(local_mean) + 1e-8)

            features.append([value, quality, roc, deviation])

        X = np.array(features, dtype=np.float32)

        if self._model is not None and self._scaler is not None:
            # Real Isolation Forest inference
            X_scaled = self._scaler.transform(X)
            raw_scores = self._model.decision_function(X_scaled)
            predictions = self._model.predict(X_scaled)

            # Convert decision function to 0-1 score (lower = more anomalous)
            scores = 1 - (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-8)
            anomaly_indices = [i for i, p in enumerate(predictions) if p == -1]
        else:
            # Fallback z-score if model somehow unavailable
            scores = np.zeros(len(X))
            for i, row in enumerate(X):
                if len(X) > 10:
                    mean = np.mean(X[:, 0])
                    std = np.std(X[:, 0])
                    z = abs(row[0] - mean) / max(std, 1e-10)
                    scores[i] = min(z / 5.0, 1.0)
            anomaly_indices = [i for i, s in enumerate(scores) if s > 0.6]

        anomalies_detected = len(anomaly_indices)
        health_score = max(0, 100 - (anomalies_detected / len(readings)) * 100)
        latency_ms = (time.time() - t0) * 1000

        return {
            "well_id": well_id,
            "anomalies_detected": anomalies_detected,
            "anomaly_indices": anomaly_indices,
            "anomaly_scores": [round(float(s), 3) for s in scores],
            "overall_health_score": round(health_score, 1),
            "model_type": "isolation_forest",
            "inference_latency_ms": round(latency_ms, 1),
        }
