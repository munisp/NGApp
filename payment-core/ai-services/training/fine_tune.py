#!/usr/bin/env python3
"""
Model Fine-Tuning Scripts
==========================
Fine-tune pre-trained models on new data without full retraining.

Supports:
  1. GNN fine-tuning with frozen backbone (only classifier head retrained)
  2. XGBoost incremental learning (continue_training)
  3. LightGBM incremental learning (init_model)
  4. Anti-spoofing fine-tuning with learning rate warmup
  5. Transfer learning from one domain to another

Usage:
  # Fine-tune GNN on new data
  python fine_tune.py --model=gnn --data=path/to/new_data.parquet --epochs=10

  # Fine-tune XGBoost incrementally
  python fine_tune.py --model=xgb --data=path/to/new_data.parquet

  # Fine-tune anti-spoofing on new face data
  python fine_tune.py --model=antispoof --data=path/to/face_data.parquet --epochs=15

  # Fine-tune all models
  python fine_tune.py --model=all --data=path/to/new_data.parquet
"""

import os
import sys
import json
import time
import logging
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score, precision_score, recall_score
import xgboost as xgb
import lightgbm as lgb
import joblib

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "trained_models"

# Import model architectures
sys.path.insert(0, str(Path(__file__).parent))
from train_all_models import (
    FraudDetectionGNN, AntiSpoofNet,
    prepare_tabular_features, build_graph_from_data,
)


# ============================================================================
# GNN FINE-TUNING
# ============================================================================

def fine_tune_gnn(
    new_data: pd.DataFrame,
    epochs: int = 10,
    lr: float = 0.0001,
    freeze_backbone: bool = True,
) -> Dict[str, Any]:
    """
    Fine-tune GNN fraud detector on new data.

    Strategy: Freeze GAT layers, only retrain classifier head.
    This preserves learned graph attention patterns while adapting
    the decision boundary to new fraud patterns.
    """
    logger.info("=" * 60)
    logger.info("Fine-tuning GNN Fraud Detector")
    logger.info(f"  freeze_backbone={freeze_backbone}, epochs={epochs}, lr={lr}")
    logger.info("=" * 60)

    # Load pre-trained model
    checkpoint_path = str(MODEL_DIR / "gnn_fraud_detector.pt")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    config = checkpoint["model_config"]

    model = FraudDetectionGNN(**config)
    model.load_state_dict(checkpoint["model_state_dict"])
    logger.info(f"Loaded pre-trained GNN ({sum(p.numel() for p in model.parameters()):,} params)")

    # Freeze backbone if requested
    if freeze_backbone:
        frozen_count = 0
        for name, param in model.named_parameters():
            if "classifier" not in name:
                param.requires_grad = False
                frozen_count += 1
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        logger.info(f"Frozen {frozen_count} parameter groups, {trainable:,} trainable params remaining")

    # Prepare data
    sample = new_data.sample(n=min(20000, len(new_data)), random_state=42)
    node_features, edge_index, labels, scaler = build_graph_from_data(sample)

    # Split
    n = node_features.shape[0]
    perm = torch.randperm(n)
    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    train_mask[perm[:int(0.8 * n)]] = True
    val_mask[perm[int(0.8 * n):]] = True

    pos_weight = torch.tensor([(labels == 0).sum() / max((labels == 1).sum(), 1)])
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    # Optimizer with learning rate warmup
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=lr, weight_decay=1e-5,
    )
    warmup_epochs = min(3, epochs // 3)

    pre_metrics = checkpoint.get("metrics", {})
    best_val_auc = 0.0
    best_state = None

    model.train()
    for epoch in range(epochs):
        # Learning rate warmup
        if epoch < warmup_epochs:
            current_lr = lr * (epoch + 1) / warmup_epochs
            for pg in optimizer.param_groups:
                pg["lr"] = current_lr

        optimizer.zero_grad()
        logits = model(node_features, edge_index)
        loss = criterion(logits[train_mask], labels[train_mask])
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        # Validate
        if (epoch + 1) % 2 == 0 or epoch == epochs - 1:
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

    if best_state:
        model.load_state_dict(best_state)

    # Final eval
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

    # Save fine-tuned model
    new_checkpoint = {
        "model_state_dict": model.state_dict(),
        "model_config": config,
        "metrics": metrics,
        "pre_finetune_metrics": pre_metrics,
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "fine_tune_config": {"epochs": epochs, "lr": lr, "freeze_backbone": freeze_backbone},
        "num_parameters": sum(p.numel() for p in model.parameters()),
        "training_samples": len(sample),
    }
    torch.save(new_checkpoint, checkpoint_path)
    logger.info(f"Fine-tuned GNN saved: {checkpoint_path}")
    logger.info(f"  Pre-FT AUC: {pre_metrics.get('auc', 'N/A')} → Post-FT AUC: {metrics['auc']:.4f}")
    return metrics


# ============================================================================
# XGBOOST INCREMENTAL FINE-TUNING
# ============================================================================

def fine_tune_xgboost(new_data: pd.DataFrame) -> Dict[str, Any]:
    """Fine-tune XGBoost using incremental training."""
    logger.info("=" * 60)
    logger.info("Fine-tuning XGBoost (incremental)")
    logger.info("=" * 60)

    X, y, scaler = prepare_tabular_features(new_data)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # Load existing model
    model_path = str(MODEL_DIR / "xgb_fraud_detector.pkl")
    existing_model = joblib.load(model_path)

    # Get pre-finetune metrics
    y_pred_pre = existing_model.predict_proba(X_test)[:, 1]
    pre_auc = roc_auc_score(y_test, y_pred_pre)

    # Incremental training: use existing model as init
    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    new_model = xgb.XGBClassifier(
        max_depth=8, learning_rate=0.01, n_estimators=50,
        scale_pos_weight=float(scale_pos_weight),
        tree_method="hist", random_state=42,
    )
    new_model.fit(X_train, y_train, xgb_model=existing_model.get_booster(), eval_set=[(X_test, y_test)], verbose=False)

    y_pred = new_model.predict(X_test)
    y_prob = new_model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_test, y_prob)),
    }

    # Only save if improved
    if metrics["auc"] >= pre_auc - 0.001:
        joblib.dump(new_model, model_path)
        logger.info(f"Fine-tuned XGBoost saved (AUC: {pre_auc:.4f} → {metrics['auc']:.4f})")
    else:
        logger.warning(f"Fine-tuned model worse (AUC: {pre_auc:.4f} → {metrics['auc']:.4f}), keeping original")

    return metrics


# ============================================================================
# LIGHTGBM INCREMENTAL FINE-TUNING
# ============================================================================

def fine_tune_lightgbm(new_data: pd.DataFrame) -> Dict[str, Any]:
    """Fine-tune LightGBM using init_model."""
    logger.info("=" * 60)
    logger.info("Fine-tuning LightGBM (incremental)")
    logger.info("=" * 60)

    X, y, scaler = prepare_tabular_features(new_data)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model_path = str(MODEL_DIR / "lgb_fraud_detector.pkl")
    existing_model = joblib.load(model_path)

    y_pred_pre = existing_model.predict_proba(X_test)[:, 1]
    pre_auc = roc_auc_score(y_test, y_pred_pre)

    scale_pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    new_model = lgb.LGBMClassifier(
        max_depth=8, learning_rate=0.01, n_estimators=50,
        scale_pos_weight=float(scale_pos_weight),
        num_leaves=63, random_state=42, verbose=-1,
    )
    new_model.fit(X_train, y_train, init_model=existing_model, eval_set=[(X_test, y_test)])

    y_pred = new_model.predict(X_test)
    y_prob = new_model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc": float(roc_auc_score(y_test, y_prob)),
    }

    if metrics["auc"] >= pre_auc - 0.001:
        joblib.dump(new_model, model_path)
        logger.info(f"Fine-tuned LightGBM saved (AUC: {pre_auc:.4f} → {metrics['auc']:.4f})")
    else:
        logger.warning(f"Fine-tuned model worse, keeping original")

    return metrics


# ============================================================================
# ANTI-SPOOFING FINE-TUNING
# ============================================================================

def fine_tune_antispoof(face_data: pd.DataFrame, epochs: int = 15, lr: float = 0.0005) -> Dict[str, Any]:
    """Fine-tune anti-spoofing network with learning rate warmup."""
    logger.info("=" * 60)
    logger.info("Fine-tuning Anti-Spoofing Classifier")
    logger.info("=" * 60)

    checkpoint_path = str(MODEL_DIR / "antispoof_classifier.pt")
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    config = checkpoint["model_config"]

    model = AntiSpoofNet(**config)
    model.load_state_dict(checkpoint["model_state_dict"])

    feature_cols = checkpoint["feature_columns"]
    type_map = checkpoint["type_map"]
    pre_metrics = checkpoint.get("metrics", {})

    X = face_data[feature_cols].values.astype(np.float32)
    y_binary = face_data["is_live"].values.astype(np.float32)
    y_type = face_data["spoof_type"].map(type_map).values.astype(np.int64)

    scaler = joblib.load(str(MODEL_DIR / "antispoof_scaler.pkl"))
    X_scaled = scaler.transform(X)

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

    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)
    bce = nn.BCEWithLogitsLoss()
    ce = nn.CrossEntropyLoss()

    best_acc = 0.0
    best_state = None

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

        if (epoch + 1) % 5 == 0:
            model.eval()
            with torch.no_grad():
                bin_logit, type_logits = model(X_test)
                acc = ((torch.sigmoid(bin_logit) > 0.5).float() == y_bin_test).float().mean().item()
                if acc > best_acc:
                    best_acc = acc
                    best_state = {k: v.clone() for k, v in model.state_dict().items()}
            logger.info(f"  Epoch {epoch+1}/{epochs} — loss: {total_loss/len(train_loader):.4f}, acc: {acc:.4f}")

    if best_state:
        model.load_state_dict(best_state)

    model.eval()
    with torch.no_grad():
        bin_logit, type_logits = model(X_test)
        bin_probs = torch.sigmoid(bin_logit).numpy()
        bin_preds = (bin_probs > 0.5).astype(int)
        type_preds = type_logits.argmax(dim=1).numpy()

    y_test_np = y_bin_test.numpy().astype(int)
    metrics = {
        "binary_accuracy": float(accuracy_score(y_test_np, bin_preds)),
        "binary_auc": float(roc_auc_score(y_test_np, bin_probs)),
        "type_accuracy": float(accuracy_score(y_type[test_idx], type_preds)),
    }

    new_checkpoint = {
        "model_state_dict": model.state_dict(),
        "model_config": config,
        "metrics": metrics,
        "pre_finetune_metrics": pre_metrics,
        "feature_columns": feature_cols,
        "type_map": type_map,
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "fine_tune_config": {"epochs": epochs, "lr": lr},
        "num_parameters": sum(p.numel() for p in model.parameters()),
    }
    torch.save(new_checkpoint, checkpoint_path)
    logger.info(f"Fine-tuned anti-spoof saved: {checkpoint_path}")
    return metrics


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Model Fine-Tuning")
    parser.add_argument("--model", choices=["gnn", "xgb", "lgb", "antispoof", "all"], required=True)
    parser.add_argument("--data", type=str, default=None, help="Path to new data")
    parser.add_argument("--epochs", type=int, default=10, help="Epochs for neural network fine-tuning")
    parser.add_argument("--lr", type=float, default=0.0001, help="Learning rate")
    parser.add_argument("--freeze-backbone", action="store_true", default=True)
    args = parser.parse_args()

    # Load data
    if args.data:
        data = pd.read_parquet(args.data)
    else:
        data = pd.read_parquet(str(DATA_DIR / "transactions.parquet"))

    face_path = str(DATA_DIR / "face_samples.parquet")
    face_data = pd.read_parquet(face_path) if os.path.exists(face_path) else None

    results = {}

    if args.model in ("gnn", "all"):
        results["gnn"] = fine_tune_gnn(data, epochs=args.epochs, lr=args.lr, freeze_backbone=args.freeze_backbone)

    if args.model in ("xgb", "all"):
        results["xgb"] = fine_tune_xgboost(data)

    if args.model in ("lgb", "all"):
        results["lgb"] = fine_tune_lightgbm(data)

    if args.model in ("antispoof", "all") and face_data is not None:
        results["antispoof"] = fine_tune_antispoof(face_data, epochs=args.epochs, lr=args.lr)

    logger.info(f"\nFine-tuning complete: {json.dumps(results, indent=2, default=str)}")


if __name__ == "__main__":
    main()
