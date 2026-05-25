#!/usr/bin/env python3
"""
Model Inference Module

Loads trained weights and provides prediction functions for all models.
Used by both the FastAPI service and Temporal workers.

All inference runs on CPU — no GPU required.
"""

import os
import logging
import time
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np
import joblib
import torch
import torch.nn as nn
import torch.nn.functional as F

WEIGHTS_DIR = Path(__file__).resolve().parent.parent / "weights"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# GNN Model Definition (must match training)
# ─────────────────────────────────────────────────────────────

class GraphAttentionLayer(nn.Module):
    def __init__(self, in_features, out_features, n_heads=4, dropout=0.3, concat=True):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.n_heads = n_heads
        self.concat = concat
        self.W = nn.Parameter(torch.empty(n_heads, in_features, out_features))
        self.a_src = nn.Parameter(torch.empty(n_heads, out_features, 1))
        self.a_dst = nn.Parameter(torch.empty(n_heads, out_features, 1))
        self.leaky_relu = nn.LeakyReLU(0.2)
        self.dropout = nn.Dropout(dropout)
        nn.init.xavier_uniform_(self.W)
        nn.init.xavier_uniform_(self.a_src)
        nn.init.xavier_uniform_(self.a_dst)

    def forward(self, x, edge_index):
        N = x.size(0)
        h = torch.einsum("ni,hio->nho", x, self.W)
        src, dst = edge_index[0], edge_index[1]
        attn_src = torch.einsum("nho,hol->nhl", h, self.a_src).squeeze(-1)
        attn_dst = torch.einsum("nho,hol->nhl", h, self.a_dst).squeeze(-1)
        e = self.leaky_relu(attn_src[src] + attn_dst[dst])
        e_max = torch.zeros(N, self.n_heads, device=x.device)
        e_max.scatter_reduce_(0, dst.unsqueeze(1).expand(-1, self.n_heads), e, reduce="amax", include_self=True)
        alpha = torch.exp(e - e_max[dst])
        alpha_sum = torch.zeros(N, self.n_heads, device=x.device)
        alpha_sum.scatter_add_(0, dst.unsqueeze(1).expand(-1, self.n_heads), alpha)
        alpha = self.dropout(alpha / (alpha_sum[dst] + 1e-8))
        msg = h[src] * alpha.unsqueeze(-1)
        out = torch.zeros(N, self.n_heads, self.out_features, device=x.device)
        out.scatter_add_(0, dst.unsqueeze(1).unsqueeze(2).expand(-1, self.n_heads, self.out_features), msg)
        return out.reshape(N, -1) if self.concat else out.mean(dim=1)


class FraudGATNet(nn.Module):
    def __init__(self, num_node_features, hidden_dim=64, n_heads=4, dropout=0.3):
        super().__init__()
        self.gat1 = GraphAttentionLayer(num_node_features, hidden_dim, n_heads, dropout, True)
        self.gat2 = GraphAttentionLayer(hidden_dim * n_heads, hidden_dim, n_heads, dropout, True)
        self.gat3 = GraphAttentionLayer(hidden_dim * n_heads, hidden_dim, 1, dropout, False)
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 2),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, edge_index):
        x = self.dropout(F.elu(self.gat1(x, edge_index)))
        x = self.dropout(F.elu(self.gat2(x, edge_index)))
        x = F.elu(self.gat3(x, edge_index))
        return self.classifier(x)


# ─────────────────────────────────────────────────────────────
# Model Loader (singleton-style)
# ─────────────────────────────────────────────────────────────

class FraudModelRegistry:
    """Loads and caches all trained models for inference."""

    def __init__(self, weights_dir: Path = WEIGHTS_DIR):
        self.weights_dir = weights_dir
        self.gnn_model: Optional[FraudGATNet] = None
        self.xgb_model = None
        self.lgb_model = None
        self.ensemble = None
        self.rf_model = None
        self.scaler = None
        self.feature_names = None
        self._loaded = False

    def load_all(self) -> Dict[str, bool]:
        """Load all available model weights."""
        status = {}

        # GNN
        gnn_path = self.weights_dir / "fraud_gnn_gat.pt"
        if gnn_path.exists():
            try:
                ckpt = torch.load(gnn_path, map_location="cpu", weights_only=False)
                cfg = ckpt["model_config"]
                self.gnn_model = FraudGATNet(**cfg)
                self.gnn_model.load_state_dict(ckpt["model_state_dict"])
                self.gnn_model.eval()
                status["gnn"] = True
                logger.info(f"Loaded GNN (AUC={ckpt.get('metrics', {}).get('auc_roc', 'N/A')})")
            except Exception as e:
                status["gnn"] = False
                logger.warning(f"GNN load failed: {e}")
        else:
            status["gnn"] = False

        # XGBoost
        xgb_path = self.weights_dir / "fraud_xgboost.joblib"
        if xgb_path.exists():
            try:
                data = joblib.load(xgb_path)
                self.xgb_model = data["model"]
                if self.scaler is None:
                    self.scaler = data.get("scaler")
                    self.feature_names = data.get("feature_names")
                status["xgboost"] = True
            except Exception as e:
                status["xgboost"] = False
                logger.warning(f"XGBoost load failed: {e}")
        else:
            status["xgboost"] = False

        # LightGBM
        lgb_path = self.weights_dir / "fraud_lightgbm.joblib"
        if lgb_path.exists():
            try:
                data = joblib.load(lgb_path)
                self.lgb_model = data["model"]
                status["lightgbm"] = True
            except Exception as e:
                status["lightgbm"] = False
        else:
            status["lightgbm"] = False

        # Ensemble
        ens_path = self.weights_dir / "fraud_ensemble.joblib"
        if ens_path.exists():
            try:
                data = joblib.load(ens_path)
                self.ensemble = {
                    "xgb": data["xgb_model"],
                    "lgb": data["lgb_model"],
                    "meta": data["meta_learner"],
                }
                if self.scaler is None:
                    self.scaler = data.get("scaler")
                    self.feature_names = data.get("feature_names")
                status["ensemble"] = True
            except Exception as e:
                status["ensemble"] = False
        else:
            status["ensemble"] = False

        # RandomForest
        rf_path = self.weights_dir / "fraud_random_forest.joblib"
        if rf_path.exists():
            try:
                data = joblib.load(rf_path)
                self.rf_model = data["model"]
                status["random_forest"] = True
            except Exception as e:
                status["random_forest"] = False
        else:
            status["random_forest"] = False

        self._loaded = True
        return status

    def predict_ensemble(self, features: np.ndarray) -> Tuple[float, bool]:
        """Predict using stacking ensemble (best model)."""
        if self.ensemble is None:
            raise RuntimeError("Ensemble not loaded")
        if self.scaler is not None:
            features = self.scaler.transform(features.reshape(1, -1))
        else:
            features = features.reshape(1, -1)

        xgb_proba = self.ensemble["xgb"].predict_proba(features)[:, 1]
        lgb_proba = self.ensemble["lgb"].predict_proba(features)[:, 1]
        meta_input = np.column_stack([xgb_proba, lgb_proba])
        proba = float(self.ensemble["meta"].predict_proba(meta_input)[0][1])
        return proba, proba >= 0.5

    def predict_xgboost(self, features: np.ndarray) -> Tuple[float, bool]:
        if self.xgb_model is None:
            raise RuntimeError("XGBoost not loaded")
        if self.scaler is not None:
            features = self.scaler.transform(features.reshape(1, -1))
        else:
            features = features.reshape(1, -1)
        proba = float(self.xgb_model.predict_proba(features)[0][1])
        return proba, proba >= 0.5

    def predict_gnn(self, node_features: np.ndarray) -> Tuple[float, bool]:
        """Predict fraud using GNN for a single node (with self-loop)."""
        if self.gnn_model is None:
            raise RuntimeError("GNN not loaded")
        x = torch.tensor(node_features, dtype=torch.float32).unsqueeze(0)
        edge_index = torch.tensor([[0], [0]], dtype=torch.long)
        with torch.no_grad():
            out = self.gnn_model(x, edge_index)
            probs = F.softmax(out, dim=1)
            proba = float(probs[0][1])
        return proba, proba >= 0.5

    def predict_all(self, tabular_features: np.ndarray, node_features: Optional[np.ndarray] = None) -> Dict:
        """Run all models and return aggregated prediction."""
        results = {}
        if self.ensemble:
            try:
                p, f = self.predict_ensemble(tabular_features)
                results["ensemble"] = {"probability": p, "is_fraud": f}
            except Exception as e:
                results["ensemble"] = {"error": str(e)}

        if self.xgb_model:
            try:
                p, f = self.predict_xgboost(tabular_features)
                results["xgboost"] = {"probability": p, "is_fraud": f}
            except Exception as e:
                results["xgboost"] = {"error": str(e)}

        if self.gnn_model and node_features is not None:
            try:
                p, f = self.predict_gnn(node_features)
                results["gnn"] = {"probability": p, "is_fraud": f}
            except Exception as e:
                results["gnn"] = {"error": str(e)}

        # Weighted average
        probas = [r["probability"] for r in results.values() if "probability" in r]
        if probas:
            avg_proba = sum(probas) / len(probas)
            results["consensus"] = {
                "probability": round(avg_proba, 6),
                "is_fraud": avg_proba >= 0.5,
                "models_used": len(probas),
            }

        return results


# Global registry instance
_registry = None


def get_registry() -> FraudModelRegistry:
    """Get or create the global model registry."""
    global _registry
    if _registry is None:
        _registry = FraudModelRegistry()
        status = _registry.load_all()
        logger.info(f"Model registry loaded: {status}")
    return _registry


if __name__ == "__main__":
    registry = get_registry()
    print(f"Models loaded: GNN={registry.gnn_model is not None}, XGB={registry.xgb_model is not None}, "
          f"LGB={registry.lgb_model is not None}, Ensemble={registry.ensemble is not None}, "
          f"RF={registry.rf_model is not None}")

    # Test prediction with sample features
    sample = np.array([50000, np.log1p(50000), 0, 0, 14, 2, 15, 0, 0, 0, 1, 500000, 365, 0], dtype=np.float32)
    result = registry.predict_all(sample)
    print(f"Prediction: {result}")
