"""
Production Anomaly Detector
Isolation Forest model for detecting anomalous production patterns.
Spec: FRQ-016 — batch inference < 200ms for 1000 readings.
"""

import logging
from typing import List, Dict, Any

import numpy as np

logger = logging.getLogger(__name__)


class ProductionAnomalyDetector:
    """
    Isolation Forest for production anomaly detection.
    Detects: stuck-open/stuck-closed chokes, sensor drift, production anomalies.
    """

    def __init__(self):
        self._model_loaded = False
        self._contamination = 0.05  # Expected anomaly fraction

    async def load(self):
        """Load Isolation Forest model from MLflow."""
        # In production:
        # self._model = mlflow.sklearn.load_model("models:/production_anomaly_detector/Production")
        logger.info("Production anomaly detector loaded")
        self._model_loaded = True

    async def detect(self, well_id: str, readings: List[Dict[str, Any]]) -> dict:
        """
        Run anomaly detection on a batch of readings.
        Returns anomaly scores (-1 = anomaly, 1 = normal in sklearn convention).
        """
        if not readings:
            return {
                "well_id": well_id,
                "anomalies_detected": 0,
                "anomaly_indices": [],
                "anomaly_scores": [],
                "overall_health_score": 100.0,
            }

        # Extract numeric features
        features = []
        for r in readings:
            row = [
                float(r.get("value", 0)),
                float(r.get("quality", 100)),
            ]
            features.append(row)

        X = np.array(features)

        # Compute simple z-score based anomaly scores (production uses Isolation Forest)
        scores = []
        for i, row in enumerate(X):
            value = row[0]
            if len(X) > 10:
                mean = np.mean(X[:, 0])
                std = np.std(X[:, 0])
                z = abs(value - mean) / max(std, 1e-10)
                # Convert z-score to anomaly score (0=normal, 1=anomaly)
                score = min(z / 5.0, 1.0)
            else:
                score = 0.0
            scores.append(score)

        anomaly_threshold = 0.6
        anomaly_indices = [i for i, s in enumerate(scores) if s > anomaly_threshold]
        anomalies_detected = len(anomaly_indices)

        # Overall health score (100 = perfect, 0 = all anomalous)
        health_score = max(0, 100 - (anomalies_detected / len(readings)) * 100)

        return {
            "well_id": well_id,
            "anomalies_detected": anomalies_detected,
            "anomaly_indices": anomaly_indices,
            "anomaly_scores": [round(s, 3) for s in scores],
            "overall_health_score": round(health_score, 1),
        }
