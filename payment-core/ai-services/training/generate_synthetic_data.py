#!/usr/bin/env python3
"""
Synthetic Data Generator for AI/ML Training Pipeline
=====================================================
Generates realistic Nigerian banking transaction data for training
fraud detection, anti-spoofing, and customer segmentation models.

Outputs:
  - data/transactions.parquet      — 100K labelled transactions
  - data/graph_edges.parquet       — account-to-account transfer graph
  - data/customer_profiles.parquet — 5K customer profiles with segments
  - data/face_samples.parquet      — 20K synthetic face feature vectors for anti-spoofing
"""

import os
import math
import random
import hashlib
from datetime import datetime, timedelta
from typing import List, Tuple

import numpy as np
import pandas as pd

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# 1.  Customer Profiles  (5 000 customers)
# ---------------------------------------------------------------------------

NIGERIAN_FIRST_NAMES = [
    "Adamu", "Fatima", "Chinedu", "Ngozi", "Emeka", "Aisha", "Bola",
    "Ibrahim", "Grace", "Samuel", "Kemi", "David", "Amina", "Oluwaseun",
    "Chidinma", "Yusuf", "Funke", "Obinna", "Halima", "Tunde",
    "Ifeoma", "Musa", "Nkechi", "Adebayo", "Zainab", "Chukwuma",
    "Folake", "Abdullahi", "Nneka", "Segun", "Hadiza", "Okey",
]
NIGERIAN_LAST_NAMES = [
    "Ibrahim", "Okafor", "Bello", "Nwosu", "Adeyemi", "Mohammed",
    "Ogundimu", "Yusuf", "Eze", "Ajayi", "Fawole", "Obi",
    "Abdullahi", "Onwuka", "Bakare", "Okoro", "Suleiman", "Adewale",
    "Igwe", "Danjuma", "Oladipo", "Nnamdi", "Hassan", "Ogbonna",
]
TIERS = ["basic", "standard", "premium"]
TIER_WEIGHTS = [0.50, 0.35, 0.15]
PRODUCTS = ["savings", "current", "mobile_money", "fixed_deposit", "insurance", "loan"]
CHANNELS = ["branch", "mobile", "ussd", "agent", "web", "pos"]
STATES = [
    "Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu",
    "Delta", "Anambra", "Ogun", "Borno", "Bauchi", "Imo", "Edo",
]


def _gen_bvn() -> str:
    return "".join([str(random.randint(0, 9)) for _ in range(11)])


def _gen_phone() -> str:
    prefixes = ["0803", "0805", "0806", "0807", "0808", "0810", "0813",
                "0814", "0816", "0903", "0906", "0915", "0705"]
    return random.choice(prefixes) + "".join([str(random.randint(0, 9)) for _ in range(7)])


def generate_customers(n: int = 5000) -> pd.DataFrame:
    rows = []
    now = datetime.now()
    for i in range(n):
        tier = np.random.choice(TIERS, p=TIER_WEIGHTS)
        balance_ranges = {"basic": (1000, 100_000), "standard": (50_000, 1_000_000), "premium": (500_000, 20_000_000)}
        lo, hi = balance_ranges[tier]
        balance = round(random.uniform(lo, hi), 2)

        # ~3% of customers are fraud-linked (higher for basic)
        is_risky = random.random() < (0.06 if tier == "basic" else 0.02 if tier == "standard" else 0.005)

        num_products = {"basic": random.randint(1, 2), "standard": random.randint(1, 4), "premium": random.randint(2, 6)}[tier]
        products = random.sample(PRODUCTS, min(num_products, len(PRODUCTS)))
        tenure_months = random.randint(1, 60)

        rows.append({
            "customer_id": f"C{i:05d}",
            "bvn": _gen_bvn(),
            "first_name": random.choice(NIGERIAN_FIRST_NAMES),
            "last_name": random.choice(NIGERIAN_LAST_NAMES),
            "phone": _gen_phone(),
            "tier": tier,
            "balance": balance,
            "risk_flag": is_risky,
            "num_products": num_products,
            "products": ",".join(products),
            "channel": random.choice(CHANNELS),
            "state": random.choice(STATES),
            "tenure_months": tenure_months,
            "created_at": (now - timedelta(days=tenure_months * 30 + random.randint(0, 30))).isoformat(),
        })
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 2.  Transactions  (100 000 labelled)
# ---------------------------------------------------------------------------

MERCHANT_CATEGORIES = [
    "grocery", "fuel", "electronics", "restaurant", "utility",
    "telecom", "transport", "healthcare", "education", "fashion",
    "real_estate", "gambling", "crypto_exchange", "jewellery", "general",
]

# Fraud patterns
FRAUD_PATTERNS = [
    "velocity_burst",        # many txns in short window
    "round_amount",          # suspiciously round amounts
    "new_device_large",      # large txn from new device
    "cross_border_rapid",    # rapid cross-border transfers
    "circular_flow",         # money circles back
    "dormant_spike",         # dormant account sudden activity
    "split_structuring",     # amounts split to avoid thresholds
]


def generate_transactions(customers: pd.DataFrame, n: int = 100_000) -> pd.DataFrame:
    customer_ids = customers["customer_id"].tolist()
    risky_ids = set(customers[customers["risk_flag"]]["customer_id"].tolist())

    rows = []
    now = datetime.now()

    for i in range(n):
        payer = random.choice(customer_ids)
        payee = random.choice(customer_ids)
        while payee == payer:
            payee = random.choice(customer_ids)

        # Time distribution — heavier during business hours
        hour = int(np.random.normal(14, 4)) % 24
        day_offset = random.randint(0, 90)
        ts = now - timedelta(days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        ts = ts.replace(hour=hour)

        channel = random.choice(["POS", "ATM", "WEB", "MOBILE", "QR", "USSD", "AGENT"])
        merchant_cat = random.choice(MERCHANT_CATEGORIES)
        device_id = f"DEV{hashlib.md5(f'{payer}-{random.randint(0,3)}'.encode()).hexdigest()[:8]}"

        # Amount distribution — log-normal, NGN
        base_amount = round(np.random.lognormal(mean=8.5, sigma=1.5), 2)
        amount = min(base_amount, 50_000_000)  # cap at 50M NGN

        # Fraud labelling: ~2.5% fraud rate (realistic for Nigerian banking)
        is_fraud = 0
        fraud_pattern = None
        fraud_confidence = 0.0

        # Higher fraud probability for risky customers
        fraud_prob = 0.08 if payer in risky_ids else 0.02

        if random.random() < fraud_prob:
            is_fraud = 1
            fraud_pattern = random.choice(FRAUD_PATTERNS)
            fraud_confidence = round(random.uniform(0.6, 0.99), 3)

            # Adjust features to match fraud pattern
            if fraud_pattern == "round_amount":
                amount = round(amount / 10000) * 10000
            elif fraud_pattern == "velocity_burst":
                hour = random.choice([1, 2, 3, 23, 0])
            elif fraud_pattern == "new_device_large":
                amount = round(random.uniform(500_000, 10_000_000), 2)
                device_id = f"DEV{hashlib.md5(os.urandom(8)).hexdigest()[:8]}"
            elif fraud_pattern == "split_structuring":
                amount = round(random.uniform(900_000, 999_999), 2)  # just below 1M NGN reporting threshold

        # Velocity features
        txn_count_24h = random.randint(0, 8) if not is_fraud else random.randint(5, 30)
        txn_amount_24h = round(amount * txn_count_24h * random.uniform(0.3, 1.5), 2)
        velocity_1h = random.randint(0, 3) if not is_fraud else random.randint(3, 15)

        # Location features
        new_location = random.random() < (0.3 if is_fraud else 0.05)
        new_merchant = random.random() < (0.4 if is_fraud else 0.08)
        lat = round(random.uniform(4.0, 14.0), 6)  # Nigeria lat range
        lon = round(random.uniform(2.5, 14.5), 6)  # Nigeria lon range

        rows.append({
            "transaction_id": f"TXN{i:07d}",
            "payer_id": payer,
            "payee_id": payee,
            "amount": amount,
            "currency": "NGN",
            "channel": channel,
            "merchant_category": merchant_cat,
            "device_id": device_id,
            "transaction_hour": hour,
            "transaction_day_of_week": ts.weekday(),
            "transaction_count_24h": txn_count_24h,
            "transaction_amount_24h": txn_amount_24h,
            "transaction_velocity_1h": velocity_1h,
            "new_location": new_location,
            "new_merchant": new_merchant,
            "latitude": lat,
            "longitude": lon,
            "timestamp": ts.isoformat(),
            "is_fraud": is_fraud,
            "fraud_pattern": fraud_pattern,
            "fraud_confidence": fraud_confidence,
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# 3.  Graph Edges (account transfer graph)
# ---------------------------------------------------------------------------

def generate_graph_edges(transactions: pd.DataFrame) -> pd.DataFrame:
    """Build aggregated transfer graph from transactions."""
    grouped = transactions.groupby(["payer_id", "payee_id"]).agg(
        num_transfers=("transaction_id", "count"),
        total_amount=("amount", "sum"),
        avg_amount=("amount", "mean"),
        fraud_count=("is_fraud", "sum"),
    ).reset_index()

    grouped["edge_weight"] = np.log1p(grouped["total_amount"]) / 20.0
    grouped["is_suspicious"] = grouped["fraud_count"] > 0
    return grouped


# ---------------------------------------------------------------------------
# 4.  Face / Anti-Spoofing Samples (20 000 synthetic feature vectors)
# ---------------------------------------------------------------------------

SPOOF_TYPES = ["none", "printed_photo", "screen_replay", "paper_mask", "3d_mask", "deepfake", "high_quality_photo"]


def generate_face_samples(n: int = 20_000) -> pd.DataFrame:
    """Generate synthetic face feature vectors for anti-spoofing training.

    Real faces have natural statistical distributions; spoofs have artifacts
    that show up in frequency/texture/depth features.
    """
    rows = []
    for i in range(n):
        is_live = random.random() < 0.60  # 60% live, 40% spoof
        spoof_type = "none" if is_live else random.choice(SPOOF_TYPES[1:])

        # 14-dimensional feature vector simulating real image analysis
        if is_live:
            features = {
                "lbp_entropy": np.random.normal(4.5, 0.3),
                "lbp_uniformity": np.random.normal(0.15, 0.03),
                "high_freq_ratio": np.random.normal(0.45, 0.08),
                "moire_energy": np.random.normal(0.02, 0.01),
                "depth_variance": np.random.normal(0.35, 0.08),
                "gradient_consistency": np.random.normal(0.82, 0.05),
                "skin_score": np.random.normal(0.75, 0.08),
                "color_variance": np.random.normal(0.42, 0.06),
                "texture_contrast": np.random.normal(0.55, 0.07),
                "histogram_smoothness": np.random.normal(0.48, 0.06),
                "compression_artifacts": np.random.normal(0.10, 0.04),
                "temporal_consistency": np.random.normal(0.90, 0.04),
                "subsurface_scatter": np.random.normal(0.65, 0.08),
                "micro_expression_score": np.random.normal(0.72, 0.10),
            }
        else:
            # Spoofed — different distributions per attack type
            base = {
                "lbp_entropy": np.random.normal(3.2, 0.5),
                "lbp_uniformity": np.random.normal(0.35, 0.08),
                "high_freq_ratio": np.random.normal(0.25, 0.10),
                "moire_energy": np.random.normal(0.08, 0.04),
                "depth_variance": np.random.normal(0.10, 0.05),
                "gradient_consistency": np.random.normal(0.55, 0.10),
                "skin_score": np.random.normal(0.40, 0.12),
                "color_variance": np.random.normal(0.25, 0.08),
                "texture_contrast": np.random.normal(0.30, 0.08),
                "histogram_smoothness": np.random.normal(0.70, 0.08),
                "compression_artifacts": np.random.normal(0.35, 0.10),
                "temporal_consistency": np.random.normal(0.50, 0.15),
                "subsurface_scatter": np.random.normal(0.25, 0.10),
                "micro_expression_score": np.random.normal(0.15, 0.10),
            }
            # Per-type adjustments
            if spoof_type == "screen_replay":
                base["moire_energy"] = np.random.normal(0.45, 0.10)
                base["high_freq_ratio"] = np.random.normal(0.60, 0.10)
            elif spoof_type == "printed_photo":
                base["depth_variance"] = np.random.normal(0.03, 0.02)
                base["texture_contrast"] = np.random.normal(0.18, 0.05)
            elif spoof_type == "deepfake":
                base["compression_artifacts"] = np.random.normal(0.55, 0.10)
                base["gradient_consistency"] = np.random.normal(0.40, 0.08)
                base["temporal_consistency"] = np.random.normal(0.35, 0.12)
            elif spoof_type == "3d_mask":
                base["skin_score"] = np.random.normal(0.30, 0.08)
                base["subsurface_scatter"] = np.random.normal(0.12, 0.05)
            elif spoof_type == "paper_mask":
                base["depth_variance"] = np.random.normal(0.05, 0.02)
                base["lbp_uniformity"] = np.random.normal(0.50, 0.08)
            elif spoof_type == "high_quality_photo":
                base["depth_variance"] = np.random.normal(0.02, 0.01)
                base["compression_artifacts"] = np.random.normal(0.40, 0.08)
            features = base

        # Clamp all features to [0, 1] or reasonable range
        for k in features:
            features[k] = round(max(0.0, features[k]), 4)

        features["sample_id"] = f"FACE{i:06d}"
        features["is_live"] = 1 if is_live else 0
        features["spoof_type"] = spoof_type
        rows.append(features)

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Synthetic Data Generator for NGApp AI/ML Pipeline")
    print("=" * 60)

    print("\n[1/4] Generating 5,000 customer profiles...")
    customers = generate_customers(5000)
    customers.to_parquet(os.path.join(DATA_DIR, "customer_profiles.parquet"), index=False)
    print(f"  ✓ {len(customers)} customers — tiers: {customers['tier'].value_counts().to_dict()}")
    print(f"  ✓ {customers['risk_flag'].sum()} risky customers ({customers['risk_flag'].mean()*100:.1f}%)")

    print("\n[2/4] Generating 100,000 labelled transactions...")
    transactions = generate_transactions(customers, 100_000)
    transactions.to_parquet(os.path.join(DATA_DIR, "transactions.parquet"), index=False)
    fraud_count = transactions["is_fraud"].sum()
    print(f"  ✓ {len(transactions)} transactions — {fraud_count} fraud ({fraud_count/len(transactions)*100:.2f}%)")
    print(f"  ✓ Fraud patterns: {transactions[transactions['is_fraud']==1]['fraud_pattern'].value_counts().to_dict()}")

    print("\n[3/4] Building transfer graph edges...")
    edges = generate_graph_edges(transactions)
    edges.to_parquet(os.path.join(DATA_DIR, "graph_edges.parquet"), index=False)
    print(f"  ✓ {len(edges)} unique transfer edges — {edges['is_suspicious'].sum()} suspicious")

    print("\n[4/4] Generating 20,000 face anti-spoofing samples...")
    faces = generate_face_samples(20_000)
    faces.to_parquet(os.path.join(DATA_DIR, "face_samples.parquet"), index=False)
    live = faces["is_live"].sum()
    print(f"  ✓ {len(faces)} face samples — {live} live, {len(faces)-live} spoof")
    print(f"  ✓ Spoof types: {faces[faces['is_live']==0]['spoof_type'].value_counts().to_dict()}")

    print(f"\n{'='*60}")
    print(f"All data saved to {DATA_DIR}/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
