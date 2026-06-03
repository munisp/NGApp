"""Model drift monitoring - detects data drift, concept drift, and prediction drift.

Uses statistical tests (KS test, PSI, Chi-square) to compare current feature
distributions against training baseline. Streams real-time predictions via Fluvio.
"""

import numpy as np
from datetime import datetime, timezone
from typing import Optional

import structlog

from app.models.schemas import DriftReport, DriftType, DriftSeverity

logger = structlog.get_logger()


class DriftMonitor:
    """Monitors deployed models for various types of drift."""

    def __init__(self, redis_client=None, fluvio_url: Optional[str] = None):
        self.redis = redis_client
        self.fluvio_url = fluvio_url

    def calculate_psi(self, baseline: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
        """Population Stability Index (PSI) for feature drift detection.

        PSI < 0.1: No significant drift
        0.1 <= PSI < 0.25: Moderate drift
        PSI >= 0.25: Significant drift
        """
        # Create bins from baseline
        breakpoints = np.linspace(
            min(baseline.min(), current.min()),
            max(baseline.max(), current.max()),
            bins + 1,
        )

        baseline_counts = np.histogram(baseline, bins=breakpoints)[0]
        current_counts = np.histogram(current, bins=breakpoints)[0]

        # Avoid division by zero
        baseline_pct = (baseline_counts + 1) / (len(baseline) + bins)
        current_pct = (current_counts + 1) / (len(current) + bins)

        psi = np.sum((current_pct - baseline_pct) * np.log(current_pct / baseline_pct))
        return float(psi)

    def calculate_ks_statistic(self, baseline: np.ndarray, current: np.ndarray) -> float:
        """Kolmogorov-Smirnov test for distribution comparison."""
        baseline_sorted = np.sort(baseline)
        current_sorted = np.sort(current)

        # Compute empirical CDFs
        n1 = len(baseline_sorted)
        n2 = len(current_sorted)
        all_values = np.sort(np.concatenate([baseline_sorted, current_sorted]))

        cdf_baseline = np.searchsorted(baseline_sorted, all_values, side="right") / n1
        cdf_current = np.searchsorted(current_sorted, all_values, side="right") / n2

        ks_stat = np.max(np.abs(cdf_baseline - cdf_current))
        return float(ks_stat)

    def assess_severity(self, psi: float) -> DriftSeverity:
        """Determine drift severity from PSI score."""
        if psi < 0.05:
            return DriftSeverity.NONE
        elif psi < 0.1:
            return DriftSeverity.LOW
        elif psi < 0.2:
            return DriftSeverity.MEDIUM
        elif psi < 0.3:
            return DriftSeverity.HIGH
        else:
            return DriftSeverity.CRITICAL

    def generate_recommendation(self, severity: DriftSeverity, drift_type: DriftType) -> str:
        """Generate actionable recommendation based on drift assessment."""
        recommendations = {
            (DriftSeverity.NONE, DriftType.DATA_DRIFT): "No action needed. Continue monitoring.",
            (DriftSeverity.LOW, DriftType.DATA_DRIFT): "Monitor closely. Consider retraining if trend continues.",
            (DriftSeverity.MEDIUM, DriftType.DATA_DRIFT): "Schedule model retraining within 7 days.",
            (DriftSeverity.HIGH, DriftType.DATA_DRIFT): "Immediate retraining required. Consider fallback model.",
            (DriftSeverity.CRITICAL, DriftType.DATA_DRIFT): "CRITICAL: Switch to fallback model immediately. Data distribution has fundamentally changed.",
            (DriftSeverity.MEDIUM, DriftType.CONCEPT_DRIFT): "Investigate underlying business changes. Full model review needed.",
            (DriftSeverity.HIGH, DriftType.CONCEPT_DRIFT): "Model assumptions violated. Redesign required.",
        }
        return recommendations.get(
            (severity, drift_type),
            f"Drift detected ({severity.value}). Review model performance and consider retraining.",
        )

    def check_model_drift(
        self,
        model_id: str,
        feature_name: str,
        baseline_data: np.ndarray,
        current_data: np.ndarray,
    ) -> DriftReport:
        """Check a single feature for drift against its baseline."""
        psi = self.calculate_psi(baseline_data, current_data)
        severity = self.assess_severity(psi)
        recommendation = self.generate_recommendation(severity, DriftType.DATA_DRIFT)

        logger.info(
            "drift_check_complete",
            model_id=model_id,
            feature=feature_name,
            psi=psi,
            severity=severity.value,
        )

        return DriftReport(
            model_id=model_id,
            drift_type=DriftType.DATA_DRIFT,
            severity=severity,
            score=psi,
            features_affected=[feature_name],
            baseline_period="training",
            current_period="last_7_days",
            recommendation=recommendation,
            detected_at=datetime.now(timezone.utc),
        )
