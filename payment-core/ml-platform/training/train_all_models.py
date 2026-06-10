#!/usr/bin/env python3
"""
End-to-End Model Training Pipeline

Trains ALL ML/DL/GNN models on synthetic Nigerian payment data and saves
production-ready weights. Supports continuous retraining from platform data.

Models trained:
1. GNN Fraud Detector (PyTorch — GAT 3-layer)
2. XGBoost Fraud Classifier
3. LightGBM Fraud Classifier
4. Stacking Ensemble (XGB + LGB + RandomForest meta-learner)
5. RandomForest (for Temporal worker)
6. Prophet Volume Forecaster (optional, needs prophet installed)

All models run on CPU. Weights saved to payment-core/ml-platform/weights/
"""

import os
import sys
import json
import time
import logging
import hashlib
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.optim.lr_scheduler import ReduceLROnPlateau
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix,
    precision_recall_curve, average_precision_score,
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
import xgboost as xgb
import lightgbm as lgb

# Add parent dirs to path
SCRIPT_DIR = Path(__file__).resolve().parent
ML_PLATFORM_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(ML_PLATFORM_DIR / "data"))

from nigerian_payment_generator import NigerianPaymentDataGenerator

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

WEIGHTS_DIR = ML_PLATFORM_DIR / "weights"
DATA_DIR = ML_PLATFORM_DIR / "data" / "generated"

# ─────────────────────────────────────────────────────────────
# 1. GNN Model Definition (Pure PyTorch — no torch_geometric needed)
# ─────────────────────────────────────────────────────────────

class GraphAttentionLayer(nn.Module):
    """Single Graph Attention layer (GAT) — pure PyTorch implementation."""

    def __init__(self, in_features: int, out_features: int, n_heads: int = 4, dropout: float = 0.3, concat: bool = True):
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

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        """
        x: [N, in_features]
        edge_index: [2, E] (src, dst)
        returns: [N, n_heads * out_features] if concat else [N, out_features]
        """
        N = x.size(0)
        # x -> [N, n_heads, out_features]
        h = torch.einsum("ni,hio->nho", x, self.W)

        src, dst = edge_index[0], edge_index[1]

        # Attention scores
        attn_src = torch.einsum("nho,hol->nhl", h, self.a_src).squeeze(-1)  # [N, n_heads]
        attn_dst = torch.einsum("nho,hol->nhl", h, self.a_dst).squeeze(-1)

        # Edge-level attention: e_ij = LeakyReLU(a_src[i] + a_dst[j])
        e = attn_src[src] + attn_dst[dst]  # [E, n_heads]
        e = self.leaky_relu(e)

        # Softmax per node (sparse)
        e_max = torch.zeros(N, self.n_heads, device=x.device)
        e_max.scatter_reduce_(0, dst.unsqueeze(1).expand(-1, self.n_heads), e, reduce="amax", include_self=True)
        e_stable = e - e_max[dst]
        alpha = torch.exp(e_stable)

        alpha_sum = torch.zeros(N, self.n_heads, device=x.device)
        alpha_sum.scatter_add_(0, dst.unsqueeze(1).expand(-1, self.n_heads), alpha)
        alpha = alpha / (alpha_sum[dst] + 1e-8)
        alpha = self.dropout(alpha)

        # Message passing: aggregate neighbor features weighted by attention
        msg = h[src] * alpha.unsqueeze(-1)  # [E, n_heads, out_features]
        out = torch.zeros(N, self.n_heads, self.out_features, device=x.device)
        out.scatter_add_(0, dst.unsqueeze(1).unsqueeze(2).expand(-1, self.n_heads, self.out_features), msg)

        if self.concat:
            return out.reshape(N, self.n_heads * self.out_features)
        else:
            return out.mean(dim=1)


class FraudGATNet(nn.Module):
    """
    3-layer Graph Attention Network for fraud detection.
    Pure PyTorch — runs on CPU, no torch_geometric dependency.
    """

    def __init__(self, num_node_features: int, hidden_dim: int = 64, n_heads: int = 4, dropout: float = 0.3):
        super().__init__()
        self.gat1 = GraphAttentionLayer(num_node_features, hidden_dim, n_heads, dropout, concat=True)
        self.gat2 = GraphAttentionLayer(hidden_dim * n_heads, hidden_dim, n_heads, dropout, concat=True)
        self.gat3 = GraphAttentionLayer(hidden_dim * n_heads, hidden_dim, 1, dropout, concat=False)

        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 2),
        )
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = F.elu(self.gat1(x, edge_index))
        x = self.dropout(x)
        x = F.elu(self.gat2(x, edge_index))
        x = self.dropout(x)
        x = F.elu(self.gat3(x, edge_index))
        return self.classifier(x)


# ─────────────────────────────────────────────────────────────
# 2. Data Preparation
# ─────────────────────────────────────────────────────────────

def load_or_generate_data(data_dir: Path = DATA_DIR) -> tuple:
    """Load existing data or generate fresh synthetic data."""
    tx_path = data_dir / "transactions.csv"
    acct_path = data_dir / "accounts.csv"
    graph_path = data_dir / "graph_features.csv"

    if tx_path.exists() and acct_path.exists() and graph_path.exists():
        logger.info("Loading existing generated data...")
        tx_df = pd.read_csv(tx_path, parse_dates=["created_at"])
        acct_df = pd.read_csv(acct_path, parse_dates=["created_at"])
        graph_df = pd.read_csv(graph_path)
    else:
        logger.info("Generating fresh synthetic data...")
        gen = NigerianPaymentDataGenerator(seed=42)
        gen.generate_accounts(n_accounts=10000, mule_pct=0.02)
        gen.generate_transactions(n_transactions=100000, fraud_rate=0.015)
        tx_df, acct_df, graph_df = gen.save(str(data_dir))

    return tx_df, acct_df, graph_df


def prepare_tabular_features(tx_df: pd.DataFrame, acct_df: pd.DataFrame) -> tuple:
    """Prepare features for tabular ML models (XGBoost, LightGBM, RF)."""
    le_channel = LabelEncoder()
    le_narration = LabelEncoder()

    features = tx_df.copy()
    features["channel_enc"] = le_channel.fit_transform(features["channel"])
    features["narration_enc"] = le_narration.fit_transform(features["narration"])
    features["amount_log"] = np.log1p(features["amount"])
    features["is_interbank"] = (features["debit_bank_code"] != features["credit_bank_code"]).astype(int)

    # Merge account features
    sender_features = acct_df[["account_id", "balance", "account_age_days", "is_mule"]].rename(
        columns={"account_id": "debit_account_id", "balance": "sender_balance",
                 "account_age_days": "sender_age", "is_mule": "sender_is_mule"}
    )
    features = features.merge(sender_features, on="debit_account_id", how="left")

    feature_cols = [
        "amount", "amount_log", "channel_enc", "narration_enc",
        "hour", "day_of_week", "day_of_month", "is_weekend", "is_night",
        "is_salary_day", "is_interbank", "sender_balance", "sender_age", "sender_is_mule",
    ]

    for col in feature_cols:
        features[col] = features[col].fillna(0)

    X = features[feature_cols].values.astype(np.float32)
    y = features["is_fraud"].values.astype(np.int64)

    return X, y, feature_cols, le_channel, le_narration


def prepare_graph_data(tx_df: pd.DataFrame, acct_df: pd.DataFrame) -> tuple:
    """Prepare graph-structured data for GNN training."""
    # Build account → index mapping
    all_accounts = pd.concat([tx_df["debit_account_id"], tx_df["credit_account_id"]]).unique()
    acct_to_idx = {aid: idx for idx, aid in enumerate(all_accounts)}
    n_nodes = len(all_accounts)

    # Node features from account data
    acct_map = acct_df.set_index("account_id")
    node_features = []
    node_labels = []
    for aid in all_accounts:
        if aid in acct_map.index:
            row = acct_map.loc[aid]
            node_features.append([
                float(row.get("balance", 0)),
                float(row.get("account_age_days", 0)),
                float(row.get("is_mule", 0)),
            ])
            node_labels.append(int(row.get("is_mule", 0)))
        else:
            node_features.append([0.0, 0.0, 0.0])
            node_labels.append(0)

    # Augment node features with graph-derived stats
    for aid in all_accounts:
        idx = acct_to_idx[aid]
        sent = tx_df[tx_df["debit_account_id"] == aid]
        recv = tx_df[tx_df["credit_account_id"] == aid]
        out_deg = len(sent)
        in_deg = len(recv)
        total_sent = float(sent["amount"].sum())
        total_recv = float(recv["amount"].sum())
        avg_amount = (total_sent + total_recv) / max(out_deg + in_deg, 1)
        night_ratio = float(len(sent[sent["is_night"] == 1]) / max(out_deg, 1))

        node_features[idx].extend([out_deg, in_deg, total_sent, total_recv, avg_amount, night_ratio])

    x = torch.tensor(node_features, dtype=torch.float32)

    # Normalize features
    x_mean = x.mean(dim=0, keepdim=True)
    x_std = x.std(dim=0, keepdim=True) + 1e-8
    x = (x - x_mean) / x_std

    y = torch.tensor(node_labels, dtype=torch.long)

    # Build edge index (sample edges for tractable training)
    max_edges = min(len(tx_df), 200000)
    sampled_tx = tx_df.sample(n=max_edges, random_state=42) if len(tx_df) > max_edges else tx_df

    src_indices = [acct_to_idx[aid] for aid in sampled_tx["debit_account_id"]]
    dst_indices = [acct_to_idx[aid] for aid in sampled_tx["credit_account_id"]]
    edge_index = torch.tensor([src_indices, dst_indices], dtype=torch.long)

    return x, edge_index, y, acct_to_idx, x_mean, x_std


# ─────────────────────────────────────────────────────────────
# 3. Training Functions
# ─────────────────────────────────────────────────────────────

def train_gnn(x, edge_index, y, weights_dir: Path, epochs: int = 200) -> dict:
    """Train the GAT GNN model and save weights."""
    logger.info("=" * 60)
    logger.info("Training GNN Fraud Detector (GAT 3-layer)...")
    logger.info(f"  Nodes: {x.size(0)}, Edges: {edge_index.size(1)}, Features: {x.size(1)}")
    logger.info(f"  Fraud nodes: {y.sum().item()}, Legit nodes: {(y == 0).sum().item()}")

    device = torch.device("cpu")
    model = FraudGATNet(num_node_features=x.size(1), hidden_dim=64, n_heads=4, dropout=0.3).to(device)
    x, edge_index, y = x.to(device), edge_index.to(device), y.to(device)

    # Class weights for imbalanced data
    n_fraud = y.sum().item()
    n_legit = (y == 0).sum().item()
    weight = torch.tensor([1.0, n_legit / max(n_fraud, 1)], dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=weight)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.005, weight_decay=5e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", patience=15, factor=0.5)

    # Train/val split (node-level)
    n = x.size(0)
    perm = torch.randperm(n)
    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    train_mask[perm[:int(0.8 * n)]] = True
    val_mask[perm[int(0.8 * n):]] = True

    best_val_loss = float("inf")
    best_state = None
    patience_counter = 0
    start_time = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        out = model(x, edge_index)
        loss = criterion(out[train_mask], y[train_mask])
        loss.backward()
        optimizer.step()

        # Validation
        model.eval()
        with torch.no_grad():
            val_out = model(x, edge_index)
            val_loss = criterion(val_out[val_mask], y[val_mask]).item()
            val_pred = val_out[val_mask].argmax(dim=1)
            val_acc = (val_pred == y[val_mask]).float().mean().item()

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1

        if epoch % 20 == 0 or epoch == 1:
            logger.info(f"  Epoch {epoch:3d} | Loss: {loss.item():.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")

        if patience_counter >= 30:
            logger.info(f"  Early stopping at epoch {epoch}")
            break

    train_time = time.time() - start_time

    # Load best model
    model.load_state_dict(best_state)
    model.eval()

    # Final evaluation
    with torch.no_grad():
        out = model(x, edge_index)
        pred = out.argmax(dim=1)
        probs = F.softmax(out, dim=1)[:, 1]

        # Metrics on validation set
        y_val = y[val_mask].numpy()
        pred_val = pred[val_mask].numpy()
        probs_val = probs[val_mask].numpy()

        metrics = {
            "accuracy": float(accuracy_score(y_val, pred_val)),
            "precision": float(precision_score(y_val, pred_val, zero_division=0)),
            "recall": float(recall_score(y_val, pred_val, zero_division=0)),
            "f1": float(f1_score(y_val, pred_val, zero_division=0)),
            "auc_roc": float(roc_auc_score(y_val, probs_val)) if len(np.unique(y_val)) > 1 else 0.0,
            "training_time_seconds": round(train_time, 2),
            "epochs_trained": epoch,
            "n_parameters": sum(p.numel() for p in model.parameters()),
        }

    # Save weights
    save_path = weights_dir / "fraud_gnn_gat.pt"
    torch.save({
        "model_state_dict": model.state_dict(),
        "model_config": {"num_node_features": x.size(1), "hidden_dim": 64, "n_heads": 4, "dropout": 0.3},
        "metrics": metrics,
        "trained_at": datetime.now().isoformat(),
        "device": "cpu",
        "n_nodes": x.size(0),
        "n_edges": edge_index.size(1),
    }, save_path)

    logger.info(f"  GNN saved to {save_path}")
    logger.info(f"  Metrics: Acc={metrics['accuracy']:.4f} Prec={metrics['precision']:.4f} Rec={metrics['recall']:.4f} F1={metrics['f1']:.4f} AUC={metrics['auc_roc']:.4f}")

    return metrics


def train_xgboost(X, y, feature_names, weights_dir: Path) -> dict:
    """Train XGBoost and save weights."""
    logger.info("=" * 60)
    logger.info("Training XGBoost Fraud Classifier...")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    n_fraud = y_train.sum()
    n_legit = (y_train == 0).sum()

    model = xgb.XGBClassifier(
        max_depth=8, learning_rate=0.1, n_estimators=300,
        scale_pos_weight=n_legit / max(n_fraud, 1),
        objective="binary:logistic", eval_metric="auc",
        use_label_encoder=False, random_state=42,
        tree_method="hist", enable_categorical=False,
        early_stopping_rounds=30,
    )

    start = time.time()
    model.fit(X_train_s, y_train, eval_set=[(X_test_s, y_test)], verbose=False)
    train_time = time.time() - start

    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "training_time_seconds": round(train_time, 2),
        "best_iteration": model.best_iteration if hasattr(model, 'best_iteration') else 300,
    }

    # Feature importance
    importance = dict(zip(feature_names, model.feature_importances_.tolist()))

    save_path = weights_dir / "fraud_xgboost.joblib"
    joblib.dump({
        "model": model, "scaler": scaler,
        "feature_names": feature_names,
        "metrics": metrics, "importance": importance,
        "trained_at": datetime.now().isoformat(),
    }, save_path)

    logger.info(f"  XGBoost saved to {save_path}")
    logger.info(f"  Metrics: Acc={metrics['accuracy']:.4f} Prec={metrics['precision']:.4f} Rec={metrics['recall']:.4f} F1={metrics['f1']:.4f} AUC={metrics['auc_roc']:.4f}")

    return metrics


def train_lightgbm(X, y, feature_names, weights_dir: Path) -> dict:
    """Train LightGBM and save weights."""
    logger.info("=" * 60)
    logger.info("Training LightGBM Fraud Classifier...")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    n_fraud = y_train.sum()
    n_legit = (y_train == 0).sum()

    model = lgb.LGBMClassifier(
        max_depth=8, learning_rate=0.1, n_estimators=300,
        num_leaves=31, scale_pos_weight=n_legit / max(n_fraud, 1),
        objective="binary", metric="auc", random_state=42, verbose=-1,
    )

    start = time.time()
    model.fit(
        X_train_s, y_train,
        eval_set=[(X_test_s, y_test)],
        callbacks=[lgb.early_stopping(30, verbose=False)],
    )
    train_time = time.time() - start

    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "training_time_seconds": round(train_time, 2),
        "best_iteration": model.best_iteration_ if hasattr(model, 'best_iteration_') else 300,
    }

    importance = dict(zip(feature_names, model.feature_importances_.tolist()))

    save_path = weights_dir / "fraud_lightgbm.joblib"
    joblib.dump({
        "model": model, "scaler": scaler,
        "feature_names": feature_names,
        "metrics": metrics, "importance": importance,
        "trained_at": datetime.now().isoformat(),
    }, save_path)

    logger.info(f"  LightGBM saved to {save_path}")
    logger.info(f"  Metrics: Acc={metrics['accuracy']:.4f} Prec={metrics['precision']:.4f} Rec={metrics['recall']:.4f} F1={metrics['f1']:.4f} AUC={metrics['auc_roc']:.4f}")

    return metrics


def train_ensemble(X, y, feature_names, weights_dir: Path) -> dict:
    """Train stacking ensemble (XGB + LGB + RF meta-learner) and save weights."""
    logger.info("=" * 60)
    logger.info("Training Stacking Ensemble (XGB + LGB + RF)...")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    n_fraud = y_train.sum()
    n_legit = (y_train == 0).sum()
    pos_weight = n_legit / max(n_fraud, 1)

    start = time.time()

    # Base models
    xgb_model = xgb.XGBClassifier(
        max_depth=6, learning_rate=0.1, n_estimators=200,
        scale_pos_weight=pos_weight, objective="binary:logistic",
        eval_metric="auc", use_label_encoder=False, random_state=42,
        tree_method="hist", verbosity=0,
    )
    xgb_model.fit(X_train_s, y_train)

    lgb_model = lgb.LGBMClassifier(
        max_depth=6, learning_rate=0.1, n_estimators=200,
        scale_pos_weight=pos_weight, objective="binary",
        metric="auc", random_state=42, verbose=-1,
    )
    lgb_model.fit(X_train_s, y_train)

    # Generate meta-features via cross-validation
    kf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    meta_train = np.zeros((len(X_train_s), 2))
    for fold_idx, (tr_idx, val_idx) in enumerate(kf.split(X_train_s, y_train)):
        xgb_fold = xgb.XGBClassifier(
            max_depth=6, learning_rate=0.1, n_estimators=200,
            scale_pos_weight=pos_weight, objective="binary:logistic",
            eval_metric="auc", use_label_encoder=False, random_state=42,
            tree_method="hist", verbosity=0,
        )
        xgb_fold.fit(X_train_s[tr_idx], y_train[tr_idx])
        meta_train[val_idx, 0] = xgb_fold.predict_proba(X_train_s[val_idx])[:, 1]

        lgb_fold = lgb.LGBMClassifier(
            max_depth=6, learning_rate=0.1, n_estimators=200,
            scale_pos_weight=pos_weight, objective="binary",
            metric="auc", random_state=42, verbose=-1,
        )
        lgb_fold.fit(X_train_s[tr_idx], y_train[tr_idx])
        meta_train[val_idx, 1] = lgb_fold.predict_proba(X_train_s[val_idx])[:, 1]

    # Meta-learner
    meta_learner = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
    meta_learner.fit(meta_train, y_train)

    train_time = time.time() - start

    # Evaluate
    meta_test = np.column_stack([
        xgb_model.predict_proba(X_test_s)[:, 1],
        lgb_model.predict_proba(X_test_s)[:, 1],
    ])
    y_pred = meta_learner.predict(meta_test)
    y_proba = meta_learner.predict_proba(meta_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "training_time_seconds": round(train_time, 2),
    }

    save_path = weights_dir / "fraud_ensemble.joblib"
    joblib.dump({
        "xgb_model": xgb_model, "lgb_model": lgb_model, "meta_learner": meta_learner,
        "scaler": scaler, "feature_names": feature_names,
        "metrics": metrics, "trained_at": datetime.now().isoformat(),
    }, save_path)

    logger.info(f"  Ensemble saved to {save_path}")
    logger.info(f"  Metrics: Acc={metrics['accuracy']:.4f} Prec={metrics['precision']:.4f} Rec={metrics['recall']:.4f} F1={metrics['f1']:.4f} AUC={metrics['auc_roc']:.4f}")

    return metrics


def train_random_forest(X, y, feature_names, weights_dir: Path) -> dict:
    """Train RandomForest for the Temporal worker and save weights."""
    logger.info("=" * 60)
    logger.info("Training RandomForest (for Temporal fraud worker)...")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=200, max_depth=10, random_state=42,
        class_weight="balanced", n_jobs=-1,
    )

    start = time.time()
    model.fit(X_train_s, y_train)
    train_time = time.time() - start

    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "training_time_seconds": round(train_time, 2),
    }

    save_path = weights_dir / "fraud_random_forest.joblib"
    joblib.dump({
        "model": model, "scaler": scaler,
        "feature_names": feature_names,
        "metrics": metrics, "trained_at": datetime.now().isoformat(),
    }, save_path)

    logger.info(f"  RandomForest saved to {save_path}")
    logger.info(f"  Metrics: Acc={metrics['accuracy']:.4f} Prec={metrics['precision']:.4f} Rec={metrics['recall']:.4f} F1={metrics['f1']:.4f} AUC={metrics['auc_roc']:.4f}")

    return metrics


# ─────────────────────────────────────────────────────────────
# 4. Main Training Pipeline
# ─────────────────────────────────────────────────────────────

def train_all(epochs: int = 200) -> dict:
    """Train all models and save weights."""
    logger.info("=" * 60)
    logger.info("PAYMENT SWITCH ML TRAINING PIPELINE")
    logger.info(f"Started at: {datetime.now().isoformat()}")
    logger.info("=" * 60)

    os.makedirs(WEIGHTS_DIR, exist_ok=True)

    # Load data
    tx_df, acct_df, graph_df = load_or_generate_data()
    logger.info(f"Data: {len(tx_df)} transactions, {len(acct_df)} accounts, {tx_df['is_fraud'].sum()} fraud")

    # Prepare tabular features
    X, y, feature_names, le_channel, le_narration = prepare_tabular_features(tx_df, acct_df)
    logger.info(f"Tabular features: {X.shape} (fraud rate: {y.mean()*100:.1f}%)")

    # Prepare graph data
    x_graph, edge_index, y_graph, acct_to_idx, x_mean, x_std = prepare_graph_data(tx_df, acct_df)
    logger.info(f"Graph: {x_graph.size(0)} nodes, {edge_index.size(1)} edges, {x_graph.size(1)} features")

    all_metrics = {}
    total_start = time.time()

    # Train all models
    all_metrics["gnn_gat"] = train_gnn(x_graph, edge_index, y_graph, WEIGHTS_DIR, epochs=epochs)
    all_metrics["xgboost"] = train_xgboost(X, y, feature_names, WEIGHTS_DIR)
    all_metrics["lightgbm"] = train_lightgbm(X, y, feature_names, WEIGHTS_DIR)
    all_metrics["ensemble"] = train_ensemble(X, y, feature_names, WEIGHTS_DIR)
    all_metrics["random_forest"] = train_random_forest(X, y, feature_names, WEIGHTS_DIR)

    # Save encoders for inference
    joblib.dump({
        "le_channel": le_channel, "le_narration": le_narration,
        "feature_names": feature_names,
        "graph_acct_to_idx": acct_to_idx,
        "graph_x_mean": x_mean.numpy().tolist(),
        "graph_x_std": x_std.numpy().tolist(),
    }, WEIGHTS_DIR / "encoders.joblib")

    total_time = time.time() - total_start

    # Save training manifest
    manifest = {
        "trained_at": datetime.now().isoformat(),
        "total_training_time_seconds": round(total_time, 2),
        "data": {
            "transactions": len(tx_df),
            "accounts": len(acct_df),
            "fraud_rate": float(tx_df["is_fraud"].mean()),
            "date_range": f"{tx_df['created_at'].min()} to {tx_df['created_at'].max()}",
        },
        "models": all_metrics,
        "weights_dir": str(WEIGHTS_DIR),
        "weight_files": [f.name for f in WEIGHTS_DIR.glob("*") if f.is_file()],
        "device": "cpu",
        "continuous_training": True,
    }

    manifest_path = WEIGHTS_DIR / "training_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)

    logger.info("=" * 60)
    logger.info(f"ALL MODELS TRAINED in {total_time:.1f}s")
    logger.info(f"Weights saved to: {WEIGHTS_DIR}")
    for name, m in all_metrics.items():
        logger.info(f"  {name:20s} | AUC={m.get('auc_roc', 0):.4f} | F1={m.get('f1', 0):.4f}")
    logger.info("=" * 60)

    return manifest


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train all fraud detection models")
    parser.add_argument("--epochs", type=int, default=200, help="GNN training epochs")
    args = parser.parse_args()
    train_all(epochs=args.epochs)
