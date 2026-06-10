"""
Fraud Detection Activities using Machine Learning

Loads pre-trained model weights from payment-core/ml-platform/weights/
and runs real inference on CPU. Falls back to rule-based scoring if
weights are unavailable.
"""

import logging
import os
import time
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from temporalio import activity

logger = logging.getLogger(__name__)

# Resolve weights directory relative to repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]
_WEIGHTS_DIR = _REPO_ROOT / "payment-core" / "ml-platform" / "weights"

CHANNEL_MAP = {"NIP": 0, "NEFT": 1, "POS": 2, "ATM": 3, "MOBILE": 4, "USSD": 5, "QR": 6, "WEB": 7, "card": 2}
NARRATION_MAP = {"Transfer": 0, "Payment": 1, "Funds Transfer": 2, "Bill Payment": 3, "Salary": 4, "Airtime Purchase": 5}


class FraudDetectionActivities:
    """ML-based fraud detection activities with real trained weights."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.ensemble = None
        self._model_loaded = False
        self.load_model()

    def load_model(self):
        """Load pre-trained fraud detection model from weights directory."""
        # Try loading the stacking ensemble (best model)
        ensemble_path = _WEIGHTS_DIR / "fraud_ensemble.joblib"
        rf_path = _WEIGHTS_DIR / "fraud_random_forest.joblib"

        if ensemble_path.exists():
            try:
                data = joblib.load(ensemble_path)
                self.ensemble = {
                    "xgb": data["xgb_model"],
                    "lgb": data["lgb_model"],
                    "meta": data["meta_learner"],
                }
                self.scaler = data["scaler"]
                self.feature_names = data["feature_names"]
                self._model_loaded = True
                logger.info(f"Loaded stacking ensemble from {ensemble_path} (AUC={data['metrics']['auc_roc']:.4f})")
                return
            except Exception as e:
                logger.warning(f"Failed to load ensemble: {e}")

        if rf_path.exists():
            try:
                data = joblib.load(rf_path)
                self.model = data["model"]
                self.scaler = data["scaler"]
                self.feature_names = data["feature_names"]
                self._model_loaded = True
                logger.info(f"Loaded RandomForest from {rf_path} (AUC={data['metrics']['auc_roc']:.4f})")
                return
            except Exception as e:
                logger.warning(f"Failed to load RF: {e}")

        logger.warning("No pre-trained weights found — using rule-based scoring only")

    def _build_feature_vector(self, features: Dict[str, Any]) -> np.ndarray:
        """Build feature vector matching training schema."""
        amount = float(features.get("amount", 0))
        hour = int(features.get("hour_of_day", datetime.now().hour))
        dow = int(features.get("day_of_week", datetime.now().weekday()))
        dom = int(features.get("day_of_month", datetime.now().day))
        channel = features.get("channel", features.get("payment_method", "NIP"))
        narration = features.get("narration", "Transfer")

        vec = np.array([
            amount,                                          # amount
            np.log1p(amount),                                # amount_log
            CHANNEL_MAP.get(channel, 0),                     # channel_enc
            NARRATION_MAP.get(narration, 0),                 # narration_enc
            hour,                                            # hour
            dow,                                             # day_of_week
            dom,                                             # day_of_month
            1 if dow >= 5 else 0,                            # is_weekend
            1 if hour < 6 or hour >= 22 else 0,              # is_night
            1 if 25 <= dom <= 28 else 0,                     # is_salary_day
            1 if features.get("is_interbank", False) else 0, # is_interbank
            float(features.get("sender_balance", 100000)),   # sender_balance
            int(features.get("sender_age", 365)),            # sender_age
            0,                                               # sender_is_mule
        ], dtype=np.float32).reshape(1, -1)

        if self.scaler is not None:
            vec = self.scaler.transform(vec)
        return vec

    @activity.defn(name="DetectFraud")
    async def detect_fraud(self, payment_request: Dict[str, Any]) -> int:
        """
        Detect fraud using trained ML model.

        Returns:
            Fraud score (0-100)
        """
        logger.info(f"Running fraud detection for session {payment_request.get('SessionID')}")
        start = time.time()

        try:
            features = self._extract_features(payment_request)
            rule_score = self._evaluate_rules(features)

            if rule_score > 90:
                logger.warning(f"High fraud score from rules: {rule_score}")
                return rule_score

            if self._model_loaded:
                ml_score = self._predict_fraud(features)
                final_score = int(0.35 * rule_score + 0.65 * ml_score)
            else:
                final_score = rule_score

            elapsed = (time.time() - start) * 1000
            logger.info(f"Fraud detection complete: score={final_score} ({elapsed:.1f}ms)")
            return final_score

        except Exception as e:
            logger.error(f"Fraud detection failed: {e}")
            return 50

    def _extract_features(self, payment_request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract features for fraud detection."""
        return {
            "amount": payment_request.get("Amount", 0),
            "currency": payment_request.get("Currency", "NGN"),
            "payment_method": payment_request.get("PaymentMethod", "NIP"),
            "channel": payment_request.get("Channel", "NIP"),
            "customer_email": payment_request.get("CustomerEmail", ""),
            "merchant_id": payment_request.get("MerchantID", 0),
            "hour_of_day": datetime.now().hour,
            "day_of_week": datetime.now().weekday(),
            "day_of_month": datetime.now().day,
            "narration": payment_request.get("Narration", "Transfer"),
            "is_interbank": payment_request.get("IsInterbank", False),
            "sender_balance": payment_request.get("SenderBalance", 100000),
            "sender_age": payment_request.get("SenderAccountAge", 365),
        }

    def _evaluate_rules(self, features: Dict[str, Any]) -> int:
        """Evaluate rule-based fraud checks (fast path)."""
        score = 0
        amount = features.get("amount", 0)

        if amount > 5_000_000:
            score += 35
        elif amount > 1_000_000:
            score += 20
        elif amount > 100000:
            score += 10

        hour = features.get("hour_of_day", 12)
        if hour < 5 or hour > 23:
            score += 15
        elif hour < 6 or hour > 22:
            score += 8

        if features.get("day_of_week", 0) >= 5:
            score += 5

        email = features.get("customer_email", "")
        if email and (email.count("@") != 1 or len(email) < 5):
            score += 20

        suspicious_domains = ["tempmail.com", "guerrillamail.com", "throwaway.email", "mailinator.com"]
        if any(domain in email for domain in suspicious_domains):
            score += 40

        return min(score, 100)

    def _predict_fraud(self, features: Dict[str, Any]) -> int:
        """Predict fraud using trained model weights."""
        try:
            vec = self._build_feature_vector(features)

            if self.ensemble is not None:
                xgb_proba = self.ensemble["xgb"].predict_proba(vec)[:, 1]
                lgb_proba = self.ensemble["lgb"].predict_proba(vec)[:, 1]
                meta_input = np.column_stack([xgb_proba, lgb_proba])
                proba = self.ensemble["meta"].predict_proba(meta_input)[0][1]
            elif self.model is not None:
                proba = self.model.predict_proba(vec)[0][1]
            else:
                return 30

            return int(proba * 100)

        except Exception as e:
            logger.error(f"ML prediction failed: {e}")
            return 30

    @activity.defn(name="TrainFraudModel")
    async def train_fraud_model(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Train fraud detection model with new data (continuous training).

        Invokes the training pipeline, saves new weights, and reloads them.
        """
        logger.info("Training fraud detection model (continuous retraining)...")
        start = time.time()

        try:
            import sys
            sys.path.insert(0, str(_REPO_ROOT / "payment-core" / "ml-platform" / "training"))
            from train_all_models import train_all

            manifest = train_all(epochs=100)
            self.load_model()

            metrics = {
                "models_trained": list(manifest.get("models", {}).keys()),
                "total_time_seconds": manifest.get("total_training_time_seconds", 0),
                "trained_at": datetime.now().isoformat(),
            }

            for name, m in manifest.get("models", {}).items():
                metrics[f"{name}_auc"] = m.get("auc_roc", 0)
                metrics[f"{name}_f1"] = m.get("f1", 0)

            elapsed = time.time() - start
            logger.info(f"Model training complete in {elapsed:.1f}s: {metrics}")
            return metrics

        except Exception as e:
            logger.error(f"Model training failed: {e}")
            raise

    @activity.defn(name="EvaluateFraudRules")
    async def evaluate_fraud_rules(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate fraud rules and return detailed results."""
        logger.info("Evaluating fraud rules")

        features = self._extract_features(transaction_data)
        rules_triggered = []

        amount = features.get("amount", 0)
        if amount > 5_000_000:
            rules_triggered.append({"rule": "cbn_reporting_threshold", "severity": "critical", "score": 35, "message": f"Amount ₦{amount:,.0f} exceeds CBN ₦5M reporting threshold"})
        elif amount > 1_000_000:
            rules_triggered.append({"rule": "high_amount", "severity": "high", "score": 20, "message": f"Amount ₦{amount:,.0f} exceeds ₦1M"})

        hour = features.get("hour_of_day", 12)
        if hour < 5 or hour > 23:
            rules_triggered.append({"rule": "unusual_hour", "severity": "medium", "score": 15, "message": f"Transaction at {hour}:00 — unusual hours"})

        email = features.get("customer_email", "")
        if email and "@" not in email:
            rules_triggered.append({"rule": "invalid_email", "severity": "high", "score": 20, "message": "Invalid email format"})

        # ML-enhanced scoring
        ml_risk = "N/A"
        if self._model_loaded:
            ml_proba = self._predict_fraud(features) / 100.0
            ml_risk = f"{ml_proba:.2%}"
            if ml_proba > 0.7:
                rules_triggered.append({"rule": "ml_high_risk", "severity": "critical", "score": 40, "message": f"ML model score: {ml_proba:.2%}"})
            elif ml_proba > 0.4:
                rules_triggered.append({"rule": "ml_medium_risk", "severity": "medium", "score": 15, "message": f"ML model score: {ml_proba:.2%}"})

        total_score = sum(rule["score"] for rule in rules_triggered)

        return {
            "rules_triggered": rules_triggered,
            "total_score": min(total_score, 100),
            "ml_risk_score": ml_risk,
            "model_loaded": self._model_loaded,
            "recommendation": "decline" if total_score > 80 else "review" if total_score > 50 else "approve",
        }
