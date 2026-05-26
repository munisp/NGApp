#!/usr/bin/env python3
"""
Model Inference Service
========================
Loads trained model weights and provides real-time inference.
CPU-optimized with int8 quantization and model caching.

API Endpoints:
  POST /predict/fraud     — Score transaction for fraud (GNN + XGB + LGB ensemble)
  POST /predict/spoof     — Classify face image for spoofing
  POST /predict/segment   — Predict customer segment
  POST /predict/churn     — Predict customer churn probability
  GET  /models            — List loaded models and metrics
  GET  /health            — Health check
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / "trained_models"

# Import architectures
import sys
sys.path.insert(0, str(Path(__file__).parent))
from train_all_models import FraudDetectionGNN, AntiSpoofNet


class ModelRegistry:
    """Loads and caches all trained models for inference."""

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, Any] = {}
        self.metrics: Dict[str, Dict] = {}
        self._load_all()

    def _load_all(self):
        logger.info("Loading trained models...")

        # GNN Fraud Detector
        gnn_path = MODEL_DIR / "gnn_fraud_detector.pt"
        if gnn_path.exists():
            checkpoint = torch.load(str(gnn_path), map_location="cpu", weights_only=False)
            config = checkpoint["model_config"]
            model = FraudDetectionGNN(**config)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.eval()
            # Quantize for CPU inference
            model = torch.quantization.quantize_dynamic(model, {nn.Linear}, dtype=torch.qint8)
            self.models["gnn_fraud"] = model
            self.metrics["gnn_fraud"] = checkpoint.get("metrics", {})
            logger.info(f"  ✓ GNN Fraud Detector loaded ({checkpoint.get('num_parameters', '?')} params, quantized)")

        # GNN scaler
        gnn_scaler_path = MODEL_DIR / "gnn_feature_scaler.pkl"
        if gnn_scaler_path.exists():
            self.scalers["gnn"] = joblib.load(str(gnn_scaler_path))

        # XGBoost
        xgb_path = MODEL_DIR / "xgb_fraud_detector.pkl"
        if xgb_path.exists():
            self.models["xgb_fraud"] = joblib.load(str(xgb_path))
            logger.info("  ✓ XGBoost Fraud Detector loaded")

        # LightGBM
        lgb_path = MODEL_DIR / "lgb_fraud_detector.pkl"
        if lgb_path.exists():
            self.models["lgb_fraud"] = joblib.load(str(lgb_path))
            logger.info("  ✓ LightGBM Fraud Detector loaded")

        # RandomForest
        rf_path = MODEL_DIR / "rf_fraud_detector.pkl"
        if rf_path.exists():
            self.models["rf_fraud"] = joblib.load(str(rf_path))
            logger.info("  ✓ RandomForest Fraud Detector loaded")

        # Tabular scaler
        tab_scaler_path = MODEL_DIR / "tabular_feature_scaler.pkl"
        if tab_scaler_path.exists():
            self.scalers["tabular"] = joblib.load(str(tab_scaler_path))

        # Anti-Spoofing
        spoof_path = MODEL_DIR / "antispoof_classifier.pt"
        if spoof_path.exists():
            checkpoint = torch.load(str(spoof_path), map_location="cpu", weights_only=False)
            config = checkpoint["model_config"]
            model = AntiSpoofNet(**config)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.eval()
            self.models["antispoof"] = model
            self.metrics["antispoof"] = checkpoint.get("metrics", {})
            self.models["antispoof_type_map"] = checkpoint.get("type_map", {})
            logger.info(f"  ✓ Anti-Spoofing Classifier loaded ({checkpoint.get('num_parameters', '?')} params)")

        spoof_scaler_path = MODEL_DIR / "antispoof_scaler.pkl"
        if spoof_scaler_path.exists():
            self.scalers["antispoof"] = joblib.load(str(spoof_scaler_path))

        # Customer Segmentation
        seg_path = MODEL_DIR / "customer_segmentation.pkl"
        if seg_path.exists():
            self.models["segmentation"] = joblib.load(str(seg_path))
            logger.info("  ✓ Customer Segmentation loaded")

        # Churn Predictor
        churn_path = MODEL_DIR / "churn_predictor.pkl"
        if churn_path.exists():
            self.models["churn"] = joblib.load(str(churn_path))
            logger.info("  ✓ Churn Predictor loaded")

        cust_scaler_path = MODEL_DIR / "customer_scaler.pkl"
        if cust_scaler_path.exists():
            self.scalers["customer"] = joblib.load(str(cust_scaler_path))

        # Load metrics summary
        metrics_path = MODEL_DIR / "training_metrics.json"
        if metrics_path.exists():
            with open(str(metrics_path)) as f:
                self.metrics["summary"] = json.load(f)

        logger.info(f"  Total models loaded: {len(self.models)}")


class InferenceEngine:
    """Runs inference using loaded models."""

    def __init__(self, registry: ModelRegistry):
        self.registry = registry

    def predict_fraud(self, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ensemble fraud prediction combining GNN + XGBoost + LightGBM.
        Returns fraud score (0-1), risk level, and per-model breakdown.
        """
        start = time.time()

        # Prepare tabular features
        features = self._extract_tabular_features(transaction)
        scores = {}

        # XGBoost prediction
        if "xgb_fraud" in self.registry.models and "tabular" in self.registry.scalers:
            scaler = self.registry.scalers["tabular"]
            X = scaler.transform(features.reshape(1, -1))
            prob = self.registry.models["xgb_fraud"].predict_proba(X)[0, 1]
            scores["xgboost"] = float(prob)

        # LightGBM prediction
        if "lgb_fraud" in self.registry.models and "tabular" in self.registry.scalers:
            scaler = self.registry.scalers["tabular"]
            X = scaler.transform(features.reshape(1, -1))
            prob = self.registry.models["lgb_fraud"].predict_proba(X)[0, 1]
            scores["lightgbm"] = float(prob)

        # RandomForest prediction
        if "rf_fraud" in self.registry.models and "tabular" in self.registry.scalers:
            scaler = self.registry.scalers["tabular"]
            X = scaler.transform(features.reshape(1, -1))
            prob = self.registry.models["rf_fraud"].predict_proba(X)[0, 1]
            scores["random_forest"] = float(prob)

        # GNN prediction (if graph context available)
        if "gnn_fraud" in self.registry.models and "gnn" in self.registry.scalers:
            scaler = self.registry.scalers["gnn"]
            gnn_features = features[:10]  # GNN uses first 10 features
            X = scaler.transform(gnn_features.reshape(1, -1))
            X_tensor = torch.tensor(X, dtype=torch.float32)
            edge_index = torch.tensor([[0], [0]], dtype=torch.long)  # self-loop for single node
            with torch.no_grad():
                logit = self.registry.models["gnn_fraud"](X_tensor, edge_index)
                prob = torch.sigmoid(logit).item()
            scores["gnn"] = float(prob)

        # Weighted ensemble
        weights = {"xgboost": 0.35, "lightgbm": 0.30, "random_forest": 0.20, "gnn": 0.15}
        ensemble_score = 0.0
        total_weight = 0.0
        for model_name, score in scores.items():
            w = weights.get(model_name, 0.1)
            ensemble_score += score * w
            total_weight += w
        if total_weight > 0:
            ensemble_score /= total_weight

        risk_level = "low"
        if ensemble_score > 0.8:
            risk_level = "critical"
        elif ensemble_score > 0.6:
            risk_level = "high"
        elif ensemble_score > 0.3:
            risk_level = "medium"

        return {
            "fraud_score": round(ensemble_score, 4),
            "risk_level": risk_level,
            "model_scores": {k: round(v, 4) for k, v in scores.items()},
            "inference_time_ms": round((time.time() - start) * 1000, 2),
            "models_used": list(scores.keys()),
        }

    def predict_spoof(self, face_features: Dict[str, float]) -> Dict[str, Any]:
        """Anti-spoofing classification."""
        start = time.time()

        feature_order = [
            "lbp_entropy", "lbp_uniformity", "high_freq_ratio", "moire_energy",
            "depth_variance", "gradient_consistency", "skin_score", "color_variance",
            "texture_contrast", "histogram_smoothness", "compression_artifacts",
            "temporal_consistency", "subsurface_scatter", "micro_expression_score",
        ]

        X = np.array([face_features.get(f, 0.0) for f in feature_order], dtype=np.float32)

        if "antispoof" in self.registry.scalers:
            X = self.registry.scalers["antispoof"].transform(X.reshape(1, -1))
        X_tensor = torch.tensor(X, dtype=torch.float32)

        model = self.registry.models.get("antispoof")
        if model is None:
            return {"error": "Anti-spoofing model not loaded"}

        type_map = self.registry.models.get("antispoof_type_map", {})
        reverse_map = {v: k for k, v in type_map.items()}

        with torch.no_grad():
            bin_logit, type_logits = model(X_tensor)
            is_live = torch.sigmoid(bin_logit).item() > 0.5
            live_confidence = torch.sigmoid(bin_logit).item()
            type_probs = torch.softmax(type_logits, dim=1).squeeze().numpy()

        type_idx = int(type_probs.argmax())
        spoof_type = reverse_map.get(type_idx, "unknown")

        return {
            "is_live": is_live,
            "live_confidence": round(float(live_confidence), 4),
            "spoof_type": spoof_type if not is_live else "none",
            "type_probabilities": {reverse_map.get(i, f"type_{i}"): round(float(p), 4)
                                   for i, p in enumerate(type_probs)},
            "inference_time_ms": round((time.time() - start) * 1000, 2),
        }

    def _extract_tabular_features(self, transaction: Dict[str, Any]) -> np.ndarray:
        """Extract tabular feature vector from transaction dict."""
        amount = float(transaction.get("amount", 0))
        hour = int(transaction.get("transaction_hour", 12))

        return np.array([
            amount,
            hour,
            int(transaction.get("transaction_day_of_week", 0)),
            int(transaction.get("transaction_count_24h", 0)),
            float(transaction.get("transaction_amount_24h", 0)),
            int(transaction.get("transaction_velocity_1h", 0)),
            float(transaction.get("new_location", False)),
            float(transaction.get("new_merchant", False)),
            np.log1p(amount),
            np.log1p(float(transaction.get("transaction_amount_24h", 0))),
            amount / (float(transaction.get("transaction_amount_24h", 0)) + 1),
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
            float(hour < 6 or hour > 22),
            float(int(transaction.get("transaction_day_of_week", 0)) >= 5),
        ], dtype=np.float32)


# ============================================================================
# HTTP SERVER
# ============================================================================

registry = None
engine = None


class InferenceHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "healthy", "models_loaded": len(registry.models)})
        elif self.path == "/models":
            model_info = {}
            for name in registry.models:
                if name == "antispoof_type_map":
                    continue
                model_info[name] = {
                    "loaded": True,
                    "metrics": registry.metrics.get(name, {}),
                }
            self._respond(200, {"models": model_info, "scalers": list(registry.scalers.keys())})
        else:
            self._respond(404, {"error": "Not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/predict/fraud":
            result = engine.predict_fraud(body)
            self._respond(200, result)
        elif self.path == "/predict/spoof":
            result = engine.predict_spoof(body)
            self._respond(200, result)
        else:
            self._respond(404, {"error": "Unknown endpoint"})

    def _respond(self, status: int, data: Dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def log_message(self, format, *args):
        logger.info(f"{self.client_address[0]} - {format % args}")


def main():
    global registry, engine
    port = int(os.environ.get("INFERENCE_PORT", "8090"))

    registry = ModelRegistry()
    engine = InferenceEngine(registry)

    # Quick self-test
    logger.info("\nRunning inference self-test...")
    test_txn = {
        "amount": 5000000, "transaction_hour": 2, "transaction_day_of_week": 6,
        "transaction_count_24h": 15, "transaction_amount_24h": 25000000,
        "transaction_velocity_1h": 8, "new_location": True, "new_merchant": True,
    }
    result = engine.predict_fraud(test_txn)
    logger.info(f"  Fraud test: score={result['fraud_score']}, risk={result['risk_level']}, "
                f"models={result['models_used']}, time={result['inference_time_ms']}ms")

    test_face = {
        "lbp_entropy": 3.1, "lbp_uniformity": 0.4, "high_freq_ratio": 0.2,
        "moire_energy": 0.5, "depth_variance": 0.03, "gradient_consistency": 0.5,
        "skin_score": 0.3, "color_variance": 0.2, "texture_contrast": 0.2,
        "histogram_smoothness": 0.7, "compression_artifacts": 0.5,
        "temporal_consistency": 0.3, "subsurface_scatter": 0.2, "micro_expression_score": 0.1,
    }
    result = engine.predict_spoof(test_face)
    logger.info(f"  Spoof test: is_live={result['is_live']}, type={result['spoof_type']}, "
                f"confidence={result['live_confidence']}, time={result['inference_time_ms']}ms")

    server = HTTPServer(("0.0.0.0", port), InferenceHandler)
    logger.info(f"\nInference server running on port {port}")
    logger.info(f"Endpoints: POST /predict/fraud, POST /predict/spoof, GET /models, GET /health")
    server.serve_forever()


if __name__ == "__main__":
    main()
