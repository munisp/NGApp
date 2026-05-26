#!/usr/bin/env python3
"""
Unified Model Training Pipeline
================================
Trains all AI/ML models on synthetic data and saves real weights:

  1. GNN Fraud Detector       → trained_models/gnn_fraud_detector.pt
  2. XGBoost Fraud Detector   → trained_models/xgb_fraud_detector.pkl
  3. LightGBM Fraud Detector  → trained_models/lgb_fraud_detector.pkl
  4. RandomForest Fraud        → trained_models/rf_fraud_detector.pkl
  5. Anti-Spoofing Classifier  → trained_models/antispoof_classifier.pt
  6. Customer Segmentation     → trained_models/customer_segmentation.pkl
  7. Feature Scalers           → trained_models/*_scaler.pkl

All models are CPU-only (no CUDA required).
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import Dict, Any, Tuple, List

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report,
)
from sklearn.cluster import KMeans
import xgboost as xgb
import lightgbm as lgb
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "trained_models")
os.makedirs(MODEL_DIR, exist_ok=True)

DEVICE = torch.device("cpu")

# ============================================================================
# GNN FRAUD DETECTOR — Graph Attention Network
# ============================================================================

class FraudGATLayer(nn.Module):
    """Single Graph Attention layer for fraud detection."""

    def __init__(self, in_features: int, out_features: int, num_heads: int = 4, dropout: float = 0.3):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = out_features // num_heads
        assert out_features % num_heads == 0

        self.W = nn.Linear(in_features, out_features, bias=False)
        self.attn_src = nn.Parameter(torch.zeros(1, num_heads, self.head_dim))
        self.attn_dst = nn.Parameter(torch.zeros(1, num_heads, self.head_dim))
        nn.init.xavier_uniform_(self.attn_src)
        nn.init.xavier_uniform_(self.attn_dst)
        self.leaky_relu = nn.LeakyReLU(0.2)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        N = x.size(0)
        h = self.W(x).view(N, self.num_heads, self.head_dim)

        # Compute attention scores
        src_scores = (h * self.attn_src).sum(dim=-1)  # (N, num_heads)
        dst_scores = (h * self.attn_dst).sum(dim=-1)

        src_idx, dst_idx = edge_index[0], edge_index[1]
        edge_scores = self.leaky_relu(src_scores[src_idx] + dst_scores[dst_idx])

        # Softmax per destination node
        exp_scores = torch.exp(edge_scores - edge_scores.max())
        denom = torch.zeros(N, self.num_heads, device=x.device)
        denom.scatter_add_(0, dst_idx.unsqueeze(1).expand(-1, self.num_heads), exp_scores)
        alpha = exp_scores / (denom[dst_idx] + 1e-10)
        alpha = self.dropout(alpha)

        # Aggregate
        out = torch.zeros(N, self.num_heads, self.head_dim, device=x.device)
        msg = h[src_idx] * alpha.unsqueeze(-1)
        out.scatter_add_(0, dst_idx.unsqueeze(1).unsqueeze(2).expand(-1, self.num_heads, self.head_dim), msg)

        return out.view(N, -1)


class FraudDetectionGNN(nn.Module):
    """
    Multi-layer GAT for transaction fraud detection.

    Architecture:
      Input → Linear(in_dim, hidden) → GAT×num_layers → Classifier → sigmoid
    """

    def __init__(self, in_dim: int, hidden_dim: int = 64, num_layers: int = 3,
                 num_heads: int = 4, dropout: float = 0.3):
        super().__init__()
        self.input_proj = nn.Linear(in_dim, hidden_dim)
        self.gat_layers = nn.ModuleList()
        self.norms = nn.ModuleList()
        for _ in range(num_layers):
            self.gat_layers.append(FraudGATLayer(hidden_dim, hidden_dim, num_heads, dropout))
            self.norms.append(nn.LayerNorm(hidden_dim))
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        h = F.relu(self.input_proj(x))
        for gat, norm in zip(self.gat_layers, self.norms):
            h_new = gat(h, edge_index)
            h_new = norm(h_new)
            h = F.relu(h_new) + h  # residual
            h = self.dropout(h)
        return self.classifier(h).squeeze(-1)


def build_graph_from_data(transactions: pd.DataFrame) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Build node features, edge_index, and labels from transaction data."""
    # Each transaction is a node (for simplicity; in production, accounts are nodes)
    feature_cols = [
        "amount", "transaction_hour", "transaction_day_of_week",
        "transaction_count_24h", "transaction_amount_24h",
        "transaction_velocity_1h", "new_location", "new_merchant",
    ]
    X = transactions[feature_cols].copy()
    X["new_location"] = X["new_location"].astype(float)
    X["new_merchant"] = X["new_merchant"].astype(float)
    X["log_amount"] = np.log1p(X["amount"])
    X["log_amount_24h"] = np.log1p(X["transaction_amount_24h"])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    node_features = torch.tensor(X_scaled, dtype=torch.float32)

    labels = torch.tensor(transactions["is_fraud"].values, dtype=torch.float32)

    # Build edges: transactions sharing payer or payee within temporal window
    # For efficiency, sample edges
    n = len(transactions)
    payer_groups = transactions.groupby("payer_id").indices
    payee_groups = transactions.groupby("payee_id").indices

    src, dst = [], []
    for indices in list(payer_groups.values())[:2000]:
        if len(indices) > 1:
            for i in range(min(len(indices), 5)):
                for j in range(i + 1, min(len(indices), 5)):
                    src.append(indices[i])
                    dst.append(indices[j])
                    src.append(indices[j])
                    dst.append(indices[i])

    for indices in list(payee_groups.values())[:2000]:
        if len(indices) > 1:
            for i in range(min(len(indices), 5)):
                for j in range(i + 1, min(len(indices), 5)):
                    src.append(indices[i])
                    dst.append(indices[j])

    if not src:
        src = [0, 1]
        dst = [1, 0]

    edge_index = torch.tensor([src, dst], dtype=torch.long)

    return node_features, edge_index, labels, scaler


def train_gnn_fraud_detector(transactions: pd.DataFrame) -> Dict[str, Any]:
    """Train GNN fraud detector and save weights."""
    logger.info("=" * 60)
    logger.info("Training GNN Fraud Detector (GAT architecture)")
    logger.info("=" * 60)

    # Use subset for GNN training (memory constraints)
    sample = transactions.sample(n=min(20000, len(transactions)), random_state=42)
    node_features, edge_index, labels, scaler = build_graph_from_data(sample)

    in_dim = node_features.shape[1]
    model = FraudDetectionGNN(in_dim=in_dim, hidden_dim=64, num_layers=3, num_heads=4, dropout=0.3)
    model.to(DEVICE)

    # Class-weighted loss (fraud is rare)
    pos_weight = torch.tensor([(labels == 0).sum() / max((labels == 1).sum(), 1)])
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=20, gamma=0.5)

    # Train/val split by index
    n = node_features.shape[0]
    perm = torch.randperm(n)
    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    train_mask[perm[:int(0.8 * n)]] = True
    val_mask[perm[int(0.8 * n):]] = True

    best_val_auc = 0.0
    best_state = None
    epochs = 60

    model.train()
    for epoch in range(epochs):
        optimizer.zero_grad()
        logits = model(node_features, edge_index)
        loss = criterion(logits[train_mask], labels[train_mask])
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()

        # Validation
        if (epoch + 1) % 5 == 0:
            model.eval()
            with torch.no_grad():
                val_logits = model(node_features, edge_index)[val_mask]
                val_probs = torch.sigmoid(val_logits).numpy()
                val_labels = labels[val_mask].numpy()
                try:
                    val_auc = roc_auc_score(val_labels, val_probs)
                except ValueError:
                    val_auc = 0.5
                if val_auc > best_val_auc:
                    best_val_auc = val_auc
                    best_state = {k: v.clone() for k, v in model.state_dict().items()}
            logger.info(f"  Epoch {epoch+1}/{epochs} — loss: {loss.item():.4f}, val_auc: {val_auc:.4f}")
            model.train()

    # Load best model
    if best_state:
        model.load_state_dict(best_state)

    # Final evaluation
    model.eval()
    with torch.no_grad():
        all_logits = model(node_features, edge_index)
        all_probs = torch.sigmoid(all_logits).numpy()
        preds = (all_probs > 0.5).astype(int)
        all_labels = labels.numpy()

    metrics = {
        "accuracy": float(accuracy_score(all_labels, preds)),
        "precision": float(precision_score(all_labels, preds, zero_division=0)),
        "recall": float(recall_score(all_labels, preds, zero_division=0)),
        "f1": float(f1_score(all_labels, preds, zero_division=0)),
        "auc": float(roc_auc_score(all_labels, all_probs)) if len(set(all_labels)) > 1 else 0.0,
    }

    # Save model
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "model_config": {"in_dim": in_dim, "hidden_dim": 64, "num_layers": 3, "num_heads": 4, "dropout": 0.3},
        "metrics": metrics,
        "training_timestamp": datetime.utcnow().isoformat(),
        "num_parameters": sum(p.numel() for p in model.parameters()),
        "training_samples": len(sample),
        "epochs": epochs,
    }
    model_path = os.path.join(MODEL_DIR, "gnn_fraud_detector.pt")
    torch.save(checkpoint, model_path)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "gnn_feature_scaler.pkl"))

    logger.info(f"  GNN saved: {model_path} ({sum(p.numel() for p in model.parameters()):,} params)")
    logger.info(f"  Metrics: {json.dumps(metrics, indent=2)}")
    return metrics


# ============================================================================
# TRADITIONAL ML — XGBoost, LightGBM, RandomForest
# ============================================================================

def prepare_tabular_features(transactions: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, StandardScaler]:
    """Prepare tabular features for traditional ML."""
    feature_cols = [
        "amount", "transaction_hour", "transaction_day_of_week",
        "transaction_count_24h", "transaction_amount_24h",
        "transaction_velocity_1h", "new_location", "new_merchant",
    ]
    X = transactions[feature_cols].copy()
    X["new_location"] = X["new_location"].astype(float)
    X["new_merchant"] = X["new_merchant"].astype(float)
    X["log_amount"] = np.log1p(X["amount"])
    X["log_amount_24h"] = np.log1p(X["transaction_amount_24h"])
    X["amount_velocity_ratio"] = X["amount"] / (X["transaction_amount_24h"] + 1)
    X["hour_sin"] = np.sin(2 * np.pi * X["transaction_hour"] / 24)
    X["hour_cos"] = np.cos(2 * np.pi * X["transaction_hour"] / 24)
    X["is_night"] = ((X["transaction_hour"] < 6) | (X["transaction_hour"] > 22)).astype(float)
    X["is_weekend"] = (X["transaction_day_of_week"] >= 5).astype(float)

    y = transactions["is_fraud"]
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)
    return X_scaled, y, scaler


def train_xgboost(X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
    """Train XGBoost fraud detector."""
    logger.info("=" * 60)
    logger.info("Training XGBoost Fraud Detector")
    logger.info("=" * 60)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

    model = xgb.XGBClassifier(
        max_depth=8, learning_rate=0.05, n_estimators=300,
        scale_pos_weight=float(scale_pos_weight),
        objective="binary:logistic", eval_metric="auc",
        tree_method="hist", random_state=42,
        subsample=0.8, colsample_bytree=0.8,
        reg_alpha=0.1, reg_lambda=1.0,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_test, y_prob)),
    }

    model_path = os.path.join(MODEL_DIR, "xgb_fraud_detector.pkl")
    joblib.dump(model, model_path)
    logger.info(f"  XGBoost saved: {model_path}")
    logger.info(f"  Metrics: {json.dumps(metrics, indent=2)}")

    # Feature importance
    importance = model.feature_importances_
    fi = sorted(zip(X.columns, importance), key=lambda x: -x[1])[:5]
    logger.info(f"  Top features: {[(n, round(v,3)) for n, v in fi]}")

    return metrics


def train_lightgbm(X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
    """Train LightGBM fraud detector."""
    logger.info("=" * 60)
    logger.info("Training LightGBM Fraud Detector")
    logger.info("=" * 60)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

    model = lgb.LGBMClassifier(
        max_depth=8, learning_rate=0.05, n_estimators=300,
        scale_pos_weight=float(scale_pos_weight),
        num_leaves=63, subsample=0.8, colsample_bytree=0.8,
        reg_alpha=0.1, reg_lambda=1.0, random_state=42,
        verbose=-1,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)])

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_test, y_prob)),
    }

    model_path = os.path.join(MODEL_DIR, "lgb_fraud_detector.pkl")
    joblib.dump(model, model_path)
    logger.info(f"  LightGBM saved: {model_path}")
    logger.info(f"  Metrics: {json.dumps(metrics, indent=2)}")
    return metrics


def train_random_forest(X: pd.DataFrame, y: pd.Series) -> Dict[str, Any]:
    """Train RandomForest fraud detector."""
    logger.info("=" * 60)
    logger.info("Training RandomForest Fraud Detector")
    logger.info("=" * 60)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=200, max_depth=12, min_samples_split=5,
        min_samples_leaf=2, class_weight="balanced", n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_test, y_prob)),
    }

    model_path = os.path.join(MODEL_DIR, "rf_fraud_detector.pkl")
    joblib.dump(model, model_path)
    logger.info(f"  RandomForest saved: {model_path}")
    logger.info(f"  Metrics: {json.dumps(metrics, indent=2)}")
    return metrics


# ============================================================================
# ANTI-SPOOFING CLASSIFIER — Real neural network (replaces rule-based)
# ============================================================================

class AntiSpoofNet(nn.Module):
    """
    Multi-task anti-spoofing classifier.

    Outputs:
      - Binary: live vs spoof (1 logit)
      - Multi-class: spoof type (7 classes)
    """

    def __init__(self, in_features: int = 14, hidden_dim: int = 64):
        super().__init__()
        self.feature_extractor = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
        )
        self.binary_head = nn.Linear(hidden_dim // 2, 1)   # live/spoof
        self.type_head = nn.Linear(hidden_dim // 2, 7)      # 7 spoof types

    def forward(self, x: torch.Tensor) -> Tuple:
        features = self.feature_extractor(x)
        binary_logit = self.binary_head(features).squeeze(-1)
        type_logits = self.type_head(features)
        return binary_logit, type_logits


def train_antispoof_classifier(face_data: pd.DataFrame) -> Dict[str, Any]:
    """Train anti-spoofing neural network."""
    logger.info("=" * 60)
    logger.info("Training Anti-Spoofing Neural Network")
    logger.info("=" * 60)

    feature_cols = [
        "lbp_entropy", "lbp_uniformity", "high_freq_ratio", "moire_energy",
        "depth_variance", "gradient_consistency", "skin_score", "color_variance",
        "texture_contrast", "histogram_smoothness", "compression_artifacts",
        "temporal_consistency", "subsurface_scatter", "micro_expression_score",
    ]

    X = face_data[feature_cols].values.astype(np.float32)
    y_binary = face_data["is_live"].values.astype(np.float32)

    type_map = {"none": 0, "printed_photo": 1, "screen_replay": 2, "paper_mask": 3,
                "3d_mask": 4, "deepfake": 5, "high_quality_photo": 6}
    y_type = face_data["spoof_type"].map(type_map).values.astype(np.int64)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split
    idx = np.arange(len(X_scaled))
    train_idx, test_idx = train_test_split(idx, test_size=0.2, random_state=42, stratify=y_binary)

    X_train = torch.tensor(X_scaled[train_idx], dtype=torch.float32)
    X_test = torch.tensor(X_scaled[test_idx], dtype=torch.float32)
    y_bin_train = torch.tensor(y_binary[train_idx], dtype=torch.float32)
    y_bin_test = torch.tensor(y_binary[test_idx], dtype=torch.float32)
    y_type_train = torch.tensor(y_type[train_idx], dtype=torch.long)
    y_type_test = torch.tensor(y_type[test_idx], dtype=torch.long)

    train_ds = TensorDataset(X_train, y_bin_train, y_type_train)
    train_loader = DataLoader(train_ds, batch_size=256, shuffle=True)

    model = AntiSpoofNet(in_features=14, hidden_dim=64)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=40)

    bce = nn.BCEWithLogitsLoss()
    ce = nn.CrossEntropyLoss()

    best_acc = 0.0
    best_state = None
    epochs = 40

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for batch_x, batch_yb, batch_yt in train_loader:
            optimizer.zero_grad()
            bin_logit, type_logits = model(batch_x)
            loss = bce(bin_logit, batch_yb) + 0.5 * ce(type_logits, batch_yt)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        scheduler.step()

        if (epoch + 1) % 5 == 0:
            model.eval()
            with torch.no_grad():
                bin_logit, type_logits = model(X_test)
                bin_preds = (torch.sigmoid(bin_logit) > 0.5).float()
                acc = (bin_preds == y_bin_test).float().mean().item()
                type_preds = type_logits.argmax(dim=1)
                type_acc = (type_preds == y_type_test).float().mean().item()
                if acc > best_acc:
                    best_acc = acc
                    best_state = {k: v.clone() for k, v in model.state_dict().items()}
            logger.info(f"  Epoch {epoch+1}/{epochs} — loss: {total_loss/len(train_loader):.4f}, "
                        f"binary_acc: {acc:.4f}, type_acc: {type_acc:.4f}")

    if best_state:
        model.load_state_dict(best_state)

    # Final eval
    model.eval()
    with torch.no_grad():
        bin_logit, type_logits = model(X_test)
        bin_probs = torch.sigmoid(bin_logit).numpy()
        bin_preds = (bin_probs > 0.5).astype(int)
        type_preds = type_logits.argmax(dim=1).numpy()

    y_test_np = y_bin_test.numpy().astype(int)
    metrics = {
        "binary_accuracy": float(accuracy_score(y_test_np, bin_preds)),
        "binary_precision": float(precision_score(y_test_np, bin_preds, zero_division=0)),
        "binary_recall": float(recall_score(y_test_np, bin_preds, zero_division=0)),
        "binary_f1": float(f1_score(y_test_np, bin_preds, zero_division=0)),
        "binary_auc": float(roc_auc_score(y_test_np, bin_probs)),
        "type_accuracy": float(accuracy_score(y_type[test_idx], type_preds)),
    }

    checkpoint = {
        "model_state_dict": model.state_dict(),
        "model_config": {"in_features": 14, "hidden_dim": 64},
        "metrics": metrics,
        "feature_columns": feature_cols,
        "type_map": type_map,
        "training_timestamp": datetime.utcnow().isoformat(),
        "num_parameters": sum(p.numel() for p in model.parameters()),
    }

    model_path = os.path.join(MODEL_DIR, "antispoof_classifier.pt")
    torch.save(checkpoint, model_path)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "antispoof_scaler.pkl"))

    logger.info(f"  AntiSpoof saved: {model_path} ({sum(p.numel() for p in model.parameters()):,} params)")
    logger.info(f"  Metrics: {json.dumps(metrics, indent=2)}")
    return metrics


# ============================================================================
# CUSTOMER SEGMENTATION — KMeans + GradientBoosting Churn Predictor
# ============================================================================

def train_customer_segmentation(customers: pd.DataFrame) -> Dict[str, Any]:
    """Train customer segmentation and churn prediction models."""
    logger.info("=" * 60)
    logger.info("Training Customer Segmentation (KMeans + Churn)")
    logger.info("=" * 60)

    feature_cols = ["balance", "num_products", "tenure_months"]
    X = customers[feature_cols].copy()
    X["log_balance"] = np.log1p(X["balance"])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # KMeans segmentation
    kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
    segments = kmeans.fit_predict(X_scaled)
    customers["segment"] = segments

    segment_labels = {0: "high_value", 1: "growing", 2: "at_risk",
                      3: "new_customer", 4: "dormant"}

    # Churn prediction (simulate churn labels from risk_flag + low tenure)
    churn_label = ((customers["risk_flag"]) | (customers["tenure_months"] < 3)).astype(int)
    X_churn = pd.DataFrame(X_scaled, columns=X.columns)
    X_train, X_test, y_train, y_test = train_test_split(X_churn, churn_label, test_size=0.2, random_state=42)

    gb = GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42)
    gb.fit(X_train, y_train)
    y_pred = gb.predict(X_test)
    y_prob = gb.predict_proba(X_test)[:, 1]

    metrics = {
        "churn_accuracy": float(accuracy_score(y_test, y_pred)),
        "churn_f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "churn_auc": float(roc_auc_score(y_test, y_prob)),
        "num_segments": 5,
        "segment_sizes": {str(k): int(v) for k, v in zip(*np.unique(segments, return_counts=True))},
    }

    joblib.dump(kmeans, os.path.join(MODEL_DIR, "customer_segmentation.pkl"))
    joblib.dump(gb, os.path.join(MODEL_DIR, "churn_predictor.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "customer_scaler.pkl"))

    logger.info(f"  Segmentation saved ({len(set(segments))} clusters)")
    logger.info(f"  Churn predictor: AUC={metrics['churn_auc']:.4f}")
    return metrics


# ============================================================================
# MAIN
# ============================================================================

def main():
    start = time.time()
    logger.info("=" * 70)
    logger.info("NGApp AI/ML Training Pipeline — Full Model Training")
    logger.info("=" * 70)

    # Load data
    logger.info("\nLoading training data...")
    transactions = pd.read_parquet(os.path.join(DATA_DIR, "transactions.parquet"))
    customers = pd.read_parquet(os.path.join(DATA_DIR, "customer_profiles.parquet"))
    face_data = pd.read_parquet(os.path.join(DATA_DIR, "face_samples.parquet"))

    logger.info(f"  Transactions: {len(transactions):,} ({transactions['is_fraud'].sum():,} fraud)")
    logger.info(f"  Customers: {len(customers):,}")
    logger.info(f"  Face samples: {len(face_data):,}")

    all_metrics = {}

    # 1. GNN
    all_metrics["gnn_fraud_detector"] = train_gnn_fraud_detector(transactions)

    # 2. XGBoost
    X_tab, y_tab, tab_scaler = prepare_tabular_features(transactions)
    joblib.dump(tab_scaler, os.path.join(MODEL_DIR, "tabular_feature_scaler.pkl"))
    all_metrics["xgb_fraud_detector"] = train_xgboost(X_tab, y_tab)

    # 3. LightGBM
    all_metrics["lgb_fraud_detector"] = train_lightgbm(X_tab, y_tab)

    # 4. RandomForest
    all_metrics["rf_fraud_detector"] = train_random_forest(X_tab, y_tab)

    # 5. Anti-Spoofing
    all_metrics["antispoof_classifier"] = train_antispoof_classifier(face_data)

    # 6. Customer Segmentation
    all_metrics["customer_segmentation"] = train_customer_segmentation(customers)

    # Save combined metrics
    metrics_path = os.path.join(MODEL_DIR, "training_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump({
            "models": all_metrics,
            "training_timestamp": datetime.utcnow().isoformat(),
            "total_training_time_seconds": round(time.time() - start, 1),
            "data_stats": {
                "transactions": len(transactions),
                "fraud_rate": float(transactions["is_fraud"].mean()),
                "customers": len(customers),
                "face_samples": len(face_data),
            },
        }, f, indent=2)

    elapsed = time.time() - start
    logger.info("\n" + "=" * 70)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 70)
    logger.info(f"Total time: {elapsed:.1f}s")
    logger.info(f"\nSaved models:")
    for f_name in sorted(os.listdir(MODEL_DIR)):
        size = os.path.getsize(os.path.join(MODEL_DIR, f_name))
        logger.info(f"  {f_name:40s} {size:>10,} bytes")

    logger.info(f"\nModel Performance Summary:")
    for model_name, m in all_metrics.items():
        auc = m.get("auc", m.get("binary_auc", m.get("churn_auc", "N/A")))
        logger.info(f"  {model_name:30s} AUC={auc}")


if __name__ == "__main__":
    main()
