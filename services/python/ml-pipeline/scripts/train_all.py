#!/usr/bin/env python3
"""
train_all.py — Train all ML models from scratch
=================================================
Trains ESP failure predictor (LSTM + XGBoost), Anomaly detector (Isolation Forest),
and validates decline curve fitting. All models run on CPU.

Usage:
  python scripts/train_all.py
  python scripts/train_all.py --model esp
  python scripts/train_all.py --model anomaly
  python scripts/train_all.py --model decline
  python scripts/train_all.py --model federated
  python scripts/train_all.py --model gnn
"""

import argparse
import asyncio
import logging
import os
import sys
import time

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("train_all")

MODEL_DIR = os.getenv("ML_MODEL_DIR", "/tmp/og-rmm-models")
os.makedirs(MODEL_DIR, exist_ok=True)


async def train_esp():
    """Train ESP failure predictor (LSTM + XGBoost ensemble)."""
    logger.info("=" * 60)
    logger.info("Training ESP Failure Predictor (LSTM + XGBoost)")
    logger.info("=" * 60)

    from src.models.esp_predictor import ESPFailurePredictor
    predictor = ESPFailurePredictor()
    await predictor._train_from_synthetic()
    logger.info("ESP predictor training complete")

    # Validate with a sample prediction
    from src.main import ESPFeatures
    from datetime import datetime
    sample = ESPFeatures(
        well_id="test-001",
        timestamp=datetime.now(),
        motor_current_a=35.0,
        motor_voltage_v=420.0,
        motor_frequency_hz=55.0,
        motor_temperature_c=95.0,
        pump_intake_pressure_psi=1200.0,
        pump_discharge_pressure_psi=2800.0,
        pump_vibration_mm_s=1.5,
        flow_rate_bpd=600.0,
        water_cut_pct=35.0,
    )
    result = await predictor.predict(sample)
    logger.info("Sample prediction: prob_7d=%.3f risk=%s latency=%.1fms",
                result["failure_probability_7d"], result["risk_level"], result["inference_latency_ms"])


async def train_anomaly():
    """Train anomaly detector (Isolation Forest)."""
    logger.info("=" * 60)
    logger.info("Training Anomaly Detector (Isolation Forest)")
    logger.info("=" * 60)

    from src.models.anomaly_detector import ProductionAnomalyDetector
    detector = ProductionAnomalyDetector()
    detector._train_from_synthetic(n_samples=5000)
    logger.info("Anomaly detector training complete")

    # Validate
    result = await detector.detect("test-001", [
        {"value": 500, "quality": 95},
        {"value": 510, "quality": 92},
        {"value": 5000, "quality": 10},  # Anomaly
        {"value": 490, "quality": 90},
        {"value": 505, "quality": 88},
    ])
    logger.info("Sample detection: %d anomalies found, health=%.1f%%",
                result["anomalies_detected"], result["overall_health_score"])


def train_decline():
    """Validate decline curve fitting."""
    logger.info("=" * 60)
    logger.info("Validating Decline Curve Forecaster (Arps)")
    logger.info("=" * 60)

    from src.models.decline_forecaster import DeclineCurveForecaster
    forecaster = DeclineCurveForecaster()

    # Generate synthetic decline data (known parameters)
    import numpy as np
    true_qi, true_di, true_b = 800.0, 0.08, 0.6
    t = np.arange(1, 37)  # 36 months
    rng = np.random.default_rng(42)
    q = true_qi / np.power(1 + true_b * true_di * t, 1.0 / true_b)
    q_noisy = q * (1 + rng.normal(0, 0.05, len(q)))

    result = forecaster.fit(q_noisy.tolist())
    logger.info("Fitted: qi=%.1f (true=%.1f) di=%.4f (true=%.4f) b=%.2f (true=%.2f) R²=%.4f",
                result["qi"], true_qi, result["di"], true_di, result["b"], true_b, result["r_squared"])

    forecast = forecaster.forecast("test-001", q_noisy.tolist(), forecast_months=60)
    logger.info("Forecast: EUR P50=%.1f MBBL, economic life=%d months",
                forecast["eur_p50_mbbl"], forecast["economic_life_months"])


def train_federated():
    """Run federated learning demo round."""
    logger.info("=" * 60)
    logger.info("Running Federated Learning Round (FedAvg)")
    logger.info("=" * 60)

    from src.models.federated import run_federated_round

    for strategy in ["fedavg", "fedprox"]:
        result = run_federated_round(
            n_participants=5,
            samples_per_participant=200,
            local_epochs=5,
            strategy=strategy,
            dp_epsilon=1.0,
        )
        logger.info("%s round %d: accuracy=%.3f, participants=%d",
                    strategy.upper(), result["round"], result["accuracy"], result["participants"])


def train_gnn():
    """Run GNN well-network analysis."""
    logger.info("=" * 60)
    logger.info("Running GNN Well-Network Analysis")
    logger.info("=" * 60)

    from src.models.gnn_well_network import WellNetworkGNN, build_sample_well_network

    node_features, adjacency, node_names = build_sample_well_network(n_wells=20)
    gnn = WellNetworkGNN(n_layers=2, hidden_dim=32, n_heads=4)

    # Predict cascade from a random well failure
    cascade = gnn.predict_cascade(node_features, adjacency, failed_node_idx=5)
    logger.info("Cascade from Well-006: affected=%d nodes, max_depth=%d, latency=%.1fms",
                cascade["affected_nodes"], cascade["max_cascade_depth"], cascade["inference_latency_ms"])

    # Identify critical nodes
    critical = gnn.identify_critical_nodes(node_features, adjacency, node_names)
    logger.info("Top 5 critical nodes:")
    for node in critical[:5]:
        logger.info("  %s — criticality=%.3f, failure_prob=%.3f, degree=%d",
                    node["node_name"], node["criticality_score"], node["failure_probability"], node["degree"])


async def main():
    parser = argparse.ArgumentParser(description="Train OG-RMM ML models")
    parser.add_argument("--model", choices=["esp", "anomaly", "decline", "federated", "gnn", "all"], default="all")
    args = parser.parse_args()

    t0 = time.time()
    logger.info("ML Model Training — OG-RMM Platform")
    logger.info("Model directory: %s", MODEL_DIR)

    if args.model in ("esp", "all"):
        await train_esp()
    if args.model in ("anomaly", "all"):
        await train_anomaly()
    if args.model in ("decline", "all"):
        train_decline()
    if args.model in ("federated", "all"):
        train_federated()
    if args.model in ("gnn", "all"):
        train_gnn()

    elapsed = time.time() - t0
    logger.info("=" * 60)
    logger.info("All training complete in %.1fs", elapsed)
    logger.info("Models saved to: %s", MODEL_DIR)


if __name__ == "__main__":
    asyncio.run(main())
