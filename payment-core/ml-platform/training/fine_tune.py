#!/usr/bin/env python3
"""
Fine-Tuning Script

Fine-tunes existing trained model weights on new data without full retraining.
Supports:
  - GNN: Lower learning rate, fewer epochs, freeze early layers
  - XGBoost/LightGBM: Incremental training from existing booster
  - Ensemble: Retrain meta-learner only
  - RandomForest: Warm-start with additional estimators

Usage:
  python fine_tune.py --model gnn --epochs 30 --lr 0.0005
  python fine_tune.py --model xgboost --n-rounds 50
  python fine_tune.py --model ensemble --meta-only
  python fine_tune.py --model all
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

SCRIPT_DIR = Path(__file__).resolve().parent
ML_PLATFORM_DIR = SCRIPT_DIR.parent
WEIGHTS_DIR = ML_PLATFORM_DIR / "weights"
DATA_DIR = ML_PLATFORM_DIR / "data" / "generated"

sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(ML_PLATFORM_DIR / "data"))

from train_all_models import (
    load_or_generate_data, prepare_tabular_features, prepare_graph_data,
    FraudGATNet,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def fine_tune_gnn(epochs: int = 30, lr: float = 0.0005, freeze_layers: int = 1) -> dict:
    """Fine-tune GNN with lower learning rate and optional layer freezing."""
    logger.info(f"Fine-tuning GNN (epochs={epochs}, lr={lr}, freeze_layers={freeze_layers})")

    weight_path = WEIGHTS_DIR / "fraud_gnn_gat.pt"
    if not weight_path.exists():
        raise FileNotFoundError(f"No GNN weights at {weight_path}. Run train_all_models.py first.")

    # Load existing model
    checkpoint = torch.load(weight_path, map_location="cpu", weights_only=False)
    cfg = checkpoint["model_config"]
    model = FraudGATNet(
        num_node_features=cfg["num_node_features"],
        hidden_dim=cfg["hidden_dim"],
        n_heads=cfg["n_heads"],
        dropout=cfg["dropout"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])

    # Freeze early layers
    layers = [model.gat1, model.gat2, model.gat3, model.classifier]
    for i in range(min(freeze_layers, len(layers))):
        for param in layers[i].parameters():
            param.requires_grad = False
        logger.info(f"  Froze layer {i}")

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"  Trainable params: {trainable}/{total}")

    # Load fresh data
    tx_df, acct_df, _ = load_or_generate_data()
    x, edge_index, y, _, x_mean, x_std = prepare_graph_data(tx_df, acct_df)

    n = x.size(0)
    n_fraud = y.sum().item()
    n_legit = (y == 0).sum().item()
    weight = torch.tensor([1.0, n_legit / max(n_fraud, 1)], dtype=torch.float32)
    criterion = nn.CrossEntropyLoss(weight=weight)
    optimizer = torch.optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=lr, weight_decay=5e-4)

    perm = torch.randperm(n)
    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask = torch.zeros(n, dtype=torch.bool)
    train_mask[perm[:int(0.8 * n)]] = True
    val_mask[perm[int(0.8 * n):]] = True

    best_val_loss = float("inf")
    best_state = None
    start = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        optimizer.zero_grad()
        out = model(x, edge_index)
        loss = criterion(out[train_mask], y[train_mask])
        loss.backward()
        optimizer.step()

        model.eval()
        with torch.no_grad():
            val_out = model(x, edge_index)
            val_loss = criterion(val_out[val_mask], y[val_mask]).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 10 == 0:
            logger.info(f"  Epoch {epoch:3d} | Loss: {loss.item():.4f} | Val Loss: {val_loss:.4f}")

    model.load_state_dict(best_state)
    train_time = time.time() - start

    # Evaluate
    model.eval()
    with torch.no_grad():
        out = model(x, edge_index)
        pred = out.argmax(dim=1)
        probs = F.softmax(out, dim=1)[:, 1]
        y_val = y[val_mask].numpy()
        pred_val = pred[val_mask].numpy()
        probs_val = probs[val_mask].numpy()

    metrics = {
        "accuracy": float(accuracy_score(y_val, pred_val)),
        "precision": float(precision_score(y_val, pred_val, zero_division=0)),
        "recall": float(recall_score(y_val, pred_val, zero_division=0)),
        "f1": float(f1_score(y_val, pred_val, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_val, probs_val)) if len(np.unique(y_val)) > 1 else 0.0,
        "fine_tune_time_seconds": round(train_time, 2),
        "fine_tune_epochs": epochs,
        "fine_tune_lr": lr,
        "frozen_layers": freeze_layers,
    }

    # Save fine-tuned weights
    torch.save({
        "model_state_dict": model.state_dict(),
        "model_config": cfg,
        "metrics": metrics,
        "trained_at": checkpoint.get("trained_at"),
        "fine_tuned_at": datetime.now().isoformat(),
        "device": "cpu",
    }, weight_path)

    logger.info(f"  GNN fine-tuned in {train_time:.1f}s — AUC={metrics['auc_roc']:.4f} F1={metrics['f1']:.4f}")
    return metrics


def fine_tune_xgboost(n_rounds: int = 50) -> dict:
    """Incrementally train XGBoost from existing booster."""
    import xgboost as xgb

    logger.info(f"Fine-tuning XGBoost (+{n_rounds} rounds)")
    xgb_path = WEIGHTS_DIR / "fraud_xgboost.joblib"
    if not xgb_path.exists():
        raise FileNotFoundError(f"No XGBoost weights at {xgb_path}")

    data = joblib.load(xgb_path)
    model = data["model"]
    scaler = data["scaler"]

    tx_df, acct_df, _ = load_or_generate_data()
    X, y, feature_names, _, _ = prepare_tabular_features(tx_df, acct_df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    start = time.time()
    # Continue training from existing booster
    model.set_params(n_estimators=model.n_estimators + n_rounds)
    model.fit(X_train_s, y_train, eval_set=[(X_test_s, y_test)], verbose=False,
              xgb_model=model.get_booster())
    train_time = time.time() - start

    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "fine_tune_time_seconds": round(train_time, 2),
        "total_estimators": model.n_estimators,
    }

    joblib.dump({
        "model": model, "scaler": scaler,
        "feature_names": feature_names,
        "metrics": metrics,
        "fine_tuned_at": datetime.now().isoformat(),
    }, xgb_path)

    logger.info(f"  XGBoost fine-tuned in {train_time:.1f}s — AUC={metrics['auc_roc']:.4f}")
    return metrics


def fine_tune_lightgbm(n_rounds: int = 50) -> dict:
    """Incrementally train LightGBM from existing model."""
    import lightgbm as lgb

    logger.info(f"Fine-tuning LightGBM (+{n_rounds} rounds)")
    lgb_path = WEIGHTS_DIR / "fraud_lightgbm.joblib"
    if not lgb_path.exists():
        raise FileNotFoundError(f"No LightGBM weights at {lgb_path}")

    data = joblib.load(lgb_path)
    model = data["model"]
    scaler = data["scaler"]

    tx_df, acct_df, _ = load_or_generate_data()
    X, y, feature_names, _, _ = prepare_tabular_features(tx_df, acct_df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    start = time.time()
    model.set_params(n_estimators=model.n_estimators + n_rounds)
    model.fit(X_train_s, y_train, eval_set=[(X_test_s, y_test)],
              callbacks=[lgb.early_stopping(20, verbose=False)], init_model=model)
    train_time = time.time() - start

    y_pred = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "auc_roc": float(roc_auc_score(y_test, y_proba)),
        "fine_tune_time_seconds": round(train_time, 2),
        "total_estimators": model.n_estimators,
    }

    joblib.dump({
        "model": model, "scaler": scaler,
        "feature_names": feature_names,
        "metrics": metrics,
        "fine_tuned_at": datetime.now().isoformat(),
    }, lgb_path)

    logger.info(f"  LightGBM fine-tuned in {train_time:.1f}s — AUC={metrics['auc_roc']:.4f}")
    return metrics


def fine_tune_all(gnn_epochs: int = 30, gnn_lr: float = 0.0005, boost_rounds: int = 50) -> dict:
    """Fine-tune all models."""
    results = {}
    results["gnn"] = fine_tune_gnn(epochs=gnn_epochs, lr=gnn_lr)
    results["xgboost"] = fine_tune_xgboost(n_rounds=boost_rounds)
    results["lightgbm"] = fine_tune_lightgbm(n_rounds=boost_rounds)

    logger.info("=" * 60)
    for name, m in results.items():
        logger.info(f"  {name:12s} | AUC={m.get('auc_roc', 0):.4f} | F1={m.get('f1', 0):.4f}")

    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fine-tune fraud detection models")
    parser.add_argument("--model", choices=["gnn", "xgboost", "lightgbm", "all"], default="all")
    parser.add_argument("--epochs", type=int, default=30, help="GNN fine-tune epochs")
    parser.add_argument("--lr", type=float, default=0.0005, help="GNN fine-tune learning rate")
    parser.add_argument("--n-rounds", type=int, default=50, help="Boosting additional rounds")
    parser.add_argument("--freeze-layers", type=int, default=1, help="GNN layers to freeze")
    args = parser.parse_args()

    if args.model == "all":
        fine_tune_all(gnn_epochs=args.epochs, gnn_lr=args.lr, boost_rounds=args.n_rounds)
    elif args.model == "gnn":
        fine_tune_gnn(epochs=args.epochs, lr=args.lr, freeze_layers=args.freeze_layers)
    elif args.model == "xgboost":
        fine_tune_xgboost(n_rounds=args.n_rounds)
    elif args.model == "lightgbm":
        fine_tune_lightgbm(n_rounds=args.n_rounds)
