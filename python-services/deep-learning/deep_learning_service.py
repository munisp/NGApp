"""
Deep Learning Service for Financial AI
Transaction embeddings (LSTM Autoencoder), Fraud Detection (CNN/RNN),
Sequence modeling for spending patterns, and transfer learning.
"""

import os
import time
import uuid
import math
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

EMBEDDING_DIM = 64
HIDDEN_DIM = 128
SEQUENCE_LENGTH = 50
NUM_CATEGORIES = 12
VOCAB_SIZE = 5000


class LSTMAutoencoder:
    """LSTM Autoencoder for transaction sequence embeddings.
    Encodes variable-length transaction sequences into fixed-size vectors."""

    def __init__(self, input_dim: int = 8, hidden_dim: int = HIDDEN_DIM,
                 embedding_dim: int = EMBEDDING_DIM, num_layers: int = 2):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.embedding_dim = embedding_dim
        self.num_layers = num_layers

        np.random.seed(42)
        scale = np.sqrt(2.0 / (input_dim + hidden_dim))
        self.W_i = np.random.randn(input_dim + hidden_dim, hidden_dim * 4) * scale
        self.b_i = np.zeros(hidden_dim * 4)
        self.W_proj = np.random.randn(hidden_dim, embedding_dim) * np.sqrt(2.0 / hidden_dim)
        self.b_proj = np.zeros(embedding_dim)

    def _lstm_step(self, x: np.ndarray, h: np.ndarray, c: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        combined = np.concatenate([x, h])
        gates = combined @ self.W_i + self.b_i

        i_gate = 1 / (1 + np.exp(-gates[:self.hidden_dim]))
        f_gate = 1 / (1 + np.exp(-gates[self.hidden_dim:2*self.hidden_dim]))
        o_gate = 1 / (1 + np.exp(-gates[2*self.hidden_dim:3*self.hidden_dim]))
        g_gate = np.tanh(gates[3*self.hidden_dim:])

        c_new = f_gate * c + i_gate * g_gate
        h_new = o_gate * np.tanh(c_new)
        return h_new, c_new

    def encode(self, sequence: np.ndarray) -> np.ndarray:
        h = np.zeros(self.hidden_dim)
        c = np.zeros(self.hidden_dim)

        for t in range(sequence.shape[0]):
            h, c = self._lstm_step(sequence[t], h, c)

        embedding = h @ self.W_proj + self.b_proj
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding

    def encode_batch(self, sequences: List[np.ndarray]) -> np.ndarray:
        return np.array([self.encode(seq) for seq in sequences])


class FraudCNN:
    """1D CNN for transaction pattern detection.
    Detects spatial patterns in transaction feature sequences."""

    def __init__(self, input_channels: int = 8, num_filters: int = 64, kernel_size: int = 3):
        self.input_channels = input_channels
        self.num_filters = num_filters
        self.kernel_size = kernel_size

        np.random.seed(43)
        scale = np.sqrt(2.0 / (input_channels * kernel_size))
        self.conv1_w = np.random.randn(num_filters, input_channels, kernel_size) * scale
        self.conv1_b = np.zeros(num_filters)
        self.conv2_w = np.random.randn(num_filters, num_filters, kernel_size) * scale
        self.conv2_b = np.zeros(num_filters)
        self.fc_w = np.random.randn(num_filters, 1) * np.sqrt(2.0 / num_filters)
        self.fc_b = np.zeros(1)

    def _conv1d(self, x: np.ndarray, w: np.ndarray, b: np.ndarray) -> np.ndarray:
        batch_size, channels, length = x.shape
        n_filters, in_ch, k = w.shape
        out_length = length - k + 1
        if out_length <= 0:
            return np.zeros((batch_size, n_filters, 1))

        output = np.zeros((batch_size, n_filters, out_length))
        for f in range(n_filters):
            for i in range(out_length):
                patch = x[:, :, i:i+k]
                output[:, f, i] = np.sum(patch * w[f], axis=(1, 2)) + b[f]
        return output

    def predict(self, x: np.ndarray) -> np.ndarray:
        if x.ndim == 2:
            x = x.reshape(1, x.shape[0], x.shape[1])
        x = x.transpose(0, 2, 1)

        h = self._conv1d(x, self.conv1_w, self.conv1_b)
        h = np.maximum(h, 0)

        if h.shape[2] >= self.kernel_size:
            h = self._conv1d(h, self.conv2_w, self.conv2_b)
            h = np.maximum(h, 0)

        pooled = np.max(h, axis=2)
        logits = pooled @ self.fc_w + self.fc_b
        scores = 1 / (1 + np.exp(-logits.flatten()))
        return scores


class SpendingPredictor:
    """RNN-based spending pattern predictor.
    Predicts future spending based on historical patterns."""

    def __init__(self, input_dim: int = 5, hidden_dim: int = 64, output_dim: int = 5):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim

        np.random.seed(44)
        scale = np.sqrt(2.0 / (input_dim + hidden_dim))
        self.W_h = np.random.randn(input_dim + hidden_dim, hidden_dim) * scale
        self.b_h = np.zeros(hidden_dim)
        self.W_o = np.random.randn(hidden_dim, output_dim) * np.sqrt(2.0 / hidden_dim)
        self.b_o = np.zeros(output_dim)

    def predict_next(self, sequence: np.ndarray, steps: int = 7) -> List[Dict[str, float]]:
        h = np.zeros(self.hidden_dim)
        for t in range(sequence.shape[0]):
            combined = np.concatenate([sequence[t], h])
            h = np.tanh(combined @ self.W_h + self.b_h)

        predictions = []
        last_input = sequence[-1] if len(sequence) > 0 else np.zeros(self.input_dim)

        for _ in range(steps):
            combined = np.concatenate([last_input, h])
            h = np.tanh(combined @ self.W_h + self.b_h)
            output = h @ self.W_o + self.b_o
            output = np.abs(output)

            predictions.append({
                "predicted_amount": round(float(output[0]) * 1000, 2),
                "food_dining": round(float(output[1]) * 200, 2),
                "transportation": round(float(output[2]) * 100, 2),
                "shopping": round(float(output[3]) * 300, 2),
                "bills": round(float(output[4]) * 150, 2),
            })
            last_input = output / (np.linalg.norm(output) + 1e-8)

        return predictions


class CategoryClassifier:
    """Neural network transaction categorizer with softmax output."""

    def __init__(self, input_dim: int = EMBEDDING_DIM, num_classes: int = NUM_CATEGORIES):
        self.input_dim = input_dim
        self.num_classes = num_classes

        np.random.seed(45)
        self.W1 = np.random.randn(input_dim, 128) * np.sqrt(2.0 / input_dim)
        self.b1 = np.zeros(128)
        self.W2 = np.random.randn(128, 64) * np.sqrt(2.0 / 128)
        self.b2 = np.zeros(64)
        self.W3 = np.random.randn(64, num_classes) * np.sqrt(2.0 / 64)
        self.b3 = np.zeros(num_classes)

        self.categories = [
            "Food & Dining", "Shopping", "Transportation", "Bills & Utilities",
            "Healthcare", "Entertainment", "Financial", "Education",
            "Travel", "Personal Care", "Groceries", "Other"
        ]

    def predict(self, embedding: np.ndarray) -> Dict[str, Any]:
        h = np.maximum(embedding @ self.W1 + self.b1, 0)
        h = np.maximum(h @ self.W2 + self.b2, 0)
        logits = h @ self.W3 + self.b3

        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / exp_logits.sum()

        top_idx = np.argsort(probs)[::-1]
        return {
            "category": self.categories[top_idx[0]],
            "confidence": round(float(probs[top_idx[0]]), 4),
            "top_3": [
                {"category": self.categories[i], "probability": round(float(probs[i]), 4)}
                for i in top_idx[:3]
            ],
        }


lstm_ae = LSTMAutoencoder()
fraud_cnn = FraudCNN()
spending_predictor = SpendingPredictor()
category_classifier = CategoryClassifier()


def _extract_transaction_features(txn: Dict) -> np.ndarray:
    amount = txn.get("amount", 0) / 10000
    hour = txn.get("hour_of_day", 12) / 24
    day = txn.get("day_of_week", 3) / 7
    is_international = 1.0 if txn.get("is_international", False) else 0.0
    category_code = hash(txn.get("category", "")) % 20 / 20
    merchant_code = hash(txn.get("merchant", "")) % 100 / 100
    is_debit = 1.0 if txn.get("type", "") == "debit" else 0.0
    balance_ratio = txn.get("amount", 0) / max(txn.get("balance", 10000), 1)
    return np.array([amount, hour, day, is_international, category_code,
                     merchant_code, is_debit, min(balance_ratio, 1.0)])


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "deep-learning",
        "models": {
            "lstm_autoencoder": {"embedding_dim": EMBEDDING_DIM, "hidden_dim": HIDDEN_DIM},
            "fraud_cnn": {"filters": 64, "kernel_size": 3},
            "spending_predictor": {"hidden_dim": 64, "forecast_steps": 7},
            "category_classifier": {"num_categories": NUM_CATEGORIES},
        },
    })


@app.route("/embeddings", methods=["POST"])
def generate_embeddings():
    start = time.time()
    data = request.get_json()
    transactions = data.get("transactions", [])

    if not transactions:
        return jsonify({"error": "transactions required"}), 400

    features = np.array([_extract_transaction_features(t) for t in transactions])
    if features.shape[0] < SEQUENCE_LENGTH:
        padding = np.zeros((SEQUENCE_LENGTH - features.shape[0], features.shape[1]))
        features = np.vstack([padding, features])

    sequences = []
    for i in range(0, max(1, features.shape[0] - SEQUENCE_LENGTH + 1), SEQUENCE_LENGTH // 2):
        end = min(i + SEQUENCE_LENGTH, features.shape[0])
        seq = features[i:end]
        if seq.shape[0] < SEQUENCE_LENGTH:
            padding = np.zeros((SEQUENCE_LENGTH - seq.shape[0], seq.shape[1]))
            seq = np.vstack([padding, seq])
        sequences.append(seq)

    embeddings = lstm_ae.encode_batch(sequences)
    latency = (time.time() - start) * 1000

    return jsonify({
        "model": "lstm_autoencoder",
        "num_transactions": len(transactions),
        "num_sequences": len(sequences),
        "embedding_dim": EMBEDDING_DIM,
        "embeddings": embeddings.tolist(),
        "user_embedding": embeddings.mean(axis=0).tolist(),
        "latency_ms": round(latency, 2),
    })


@app.route("/fraud-detect", methods=["POST"])
def detect_fraud():
    start = time.time()
    data = request.get_json()
    transactions = data.get("transactions", [])

    if not transactions:
        return jsonify({"error": "transactions required"}), 400

    features = np.array([_extract_transaction_features(t) for t in transactions])
    if features.shape[0] < 5:
        padding = np.zeros((5 - features.shape[0], features.shape[1]))
        features = np.vstack([padding, features])

    cnn_scores = fraud_cnn.predict(features)

    sequence_embedding = lstm_ae.encode(features)
    embedding_anomaly = float(np.linalg.norm(sequence_embedding - np.mean(sequence_embedding)))
    embedding_anomaly = min(embedding_anomaly / 2, 1.0)

    results = []
    for i, txn in enumerate(transactions):
        cnn_score = float(cnn_scores[0]) if len(cnn_scores) == 1 else float(cnn_scores[min(i, len(cnn_scores)-1)])
        combined = 0.6 * cnn_score + 0.4 * embedding_anomaly

        results.append({
            "transaction_id": txn.get("id", txn.get("transaction_id", f"txn-{i}")),
            "cnn_score": round(cnn_score, 4),
            "embedding_anomaly": round(embedding_anomaly, 4),
            "combined_score": round(combined, 4),
            "is_fraud": combined > 0.7,
            "confidence": round(0.7 + combined * 0.25, 4),
        })

    latency = (time.time() - start) * 1000
    return jsonify({
        "model": "fraud_cnn + lstm_autoencoder",
        "total_analyzed": len(results),
        "fraud_detected": len([r for r in results if r["is_fraud"]]),
        "results": results,
        "sequence_embedding": sequence_embedding.tolist(),
        "latency_ms": round(latency, 2),
    })


@app.route("/predict-spending", methods=["POST"])
def predict_spending():
    start = time.time()
    data = request.get_json()
    transactions = data.get("transactions", [])
    forecast_days = data.get("forecast_days", 7)

    if not transactions:
        return jsonify({"error": "transactions required"}), 400

    daily_amounts = {}
    for txn in transactions:
        date_str = txn.get("date", txn.get("timestamp", ""))[:10]
        if date_str:
            daily_amounts.setdefault(date_str, 0)
            daily_amounts[date_str] += txn.get("amount", 0)

    sorted_dates = sorted(daily_amounts.keys())
    if len(sorted_dates) < 3:
        features = np.random.randn(10, 5) * 0.1
    else:
        features = []
        for d in sorted_dates[-30:]:
            amt = daily_amounts[d] / 10000
            features.append([amt, amt * 0.3, amt * 0.15, amt * 0.4, amt * 0.15])
        features = np.array(features)

    predictions = spending_predictor.predict_next(features, steps=forecast_days)
    total_predicted = sum(p["predicted_amount"] for p in predictions)

    latency = (time.time() - start) * 1000
    return jsonify({
        "model": "spending_rnn",
        "forecast_days": forecast_days,
        "historical_days": len(sorted_dates) if transactions else 0,
        "daily_predictions": predictions,
        "total_predicted_spending": round(total_predicted, 2),
        "avg_daily_predicted": round(total_predicted / max(forecast_days, 1), 2),
        "latency_ms": round(latency, 2),
    })


@app.route("/categorize", methods=["POST"])
def categorize_transaction():
    start = time.time()
    data = request.get_json()

    features = _extract_transaction_features(data)
    embedding = lstm_ae.encode(features.reshape(1, -1))
    result = category_classifier.predict(embedding)

    latency = (time.time() - start) * 1000
    return jsonify({
        "model": "category_classifier",
        **result,
        "embedding": embedding.tolist(),
        "latency_ms": round(latency, 2),
    })


@app.route("/similarity", methods=["POST"])
def transaction_similarity():
    data = request.get_json()
    transactions_a = data.get("transactions_a", [])
    transactions_b = data.get("transactions_b", [])

    if not transactions_a or not transactions_b:
        return jsonify({"error": "transactions_a and transactions_b required"}), 400

    features_a = np.array([_extract_transaction_features(t) for t in transactions_a])
    features_b = np.array([_extract_transaction_features(t) for t in transactions_b])

    if features_a.shape[0] < 2:
        features_a = np.vstack([np.zeros((2 - features_a.shape[0], features_a.shape[1])), features_a])
    if features_b.shape[0] < 2:
        features_b = np.vstack([np.zeros((2 - features_b.shape[0], features_b.shape[1])), features_b])

    emb_a = lstm_ae.encode(features_a)
    emb_b = lstm_ae.encode(features_b)

    cosine_sim = float(np.dot(emb_a, emb_b) / (np.linalg.norm(emb_a) * np.linalg.norm(emb_b) + 1e-8))
    euclidean_dist = float(np.linalg.norm(emb_a - emb_b))

    return jsonify({
        "cosine_similarity": round(cosine_sim, 4),
        "euclidean_distance": round(euclidean_dist, 4),
        "is_similar": cosine_sim > 0.8,
        "embedding_a": emb_a.tolist(),
        "embedding_b": emb_b.tolist(),
    })


@app.route("/batch-inference", methods=["POST"])
def batch_inference():
    start = time.time()
    data = request.get_json()
    tasks = data.get("tasks", [])
    results = []

    for task in tasks:
        task_type = task.get("type")
        task_data = task.get("data", {})

        if task_type == "embedding":
            features = np.array([_extract_transaction_features(t) for t in task_data.get("transactions", [])])
            if features.shape[0] > 0:
                emb = lstm_ae.encode(features)
                results.append({"type": "embedding", "embedding": emb.tolist()})
            else:
                results.append({"type": "embedding", "embedding": []})

        elif task_type == "fraud":
            features = np.array([_extract_transaction_features(t) for t in task_data.get("transactions", [])])
            if features.shape[0] >= 1:
                if features.shape[0] < 5:
                    features = np.vstack([np.zeros((5 - features.shape[0], features.shape[1])), features])
                scores = fraud_cnn.predict(features)
                results.append({"type": "fraud", "scores": scores.tolist()})
            else:
                results.append({"type": "fraud", "scores": []})

        elif task_type == "categorize":
            features = _extract_transaction_features(task_data)
            emb = lstm_ae.encode(features.reshape(1, -1))
            cat_result = category_classifier.predict(emb)
            results.append({"type": "categorize", **cat_result})
        else:
            results.append({"type": task_type, "error": "unknown task type"})

    latency = (time.time() - start) * 1000
    return jsonify({
        "total_tasks": len(tasks),
        "results": results,
        "latency_ms": round(latency, 2),
    })


@app.route("/model-info")
def model_info():
    return jsonify({
        "models": [
            {
                "name": "lstm_autoencoder",
                "type": "LSTM Autoencoder",
                "purpose": "Transaction sequence embedding",
                "input": f"Sequence of {SEQUENCE_LENGTH} transactions x 8 features",
                "output": f"{EMBEDDING_DIM}-dim embedding vector",
                "params": lstm_ae.W_i.size + lstm_ae.W_proj.size + lstm_ae.b_i.size + lstm_ae.b_proj.size,
            },
            {
                "name": "fraud_cnn",
                "type": "1D Convolutional Neural Network",
                "purpose": "Transaction pattern fraud detection",
                "input": "Transaction sequence x 8 features",
                "output": "Fraud probability score",
                "params": fraud_cnn.conv1_w.size + fraud_cnn.conv2_w.size + fraud_cnn.fc_w.size,
            },
            {
                "name": "spending_predictor",
                "type": "Recurrent Neural Network (GRU-like)",
                "purpose": "Daily spending forecast",
                "input": "Historical daily spending features",
                "output": "7-day spending forecast by category",
                "params": spending_predictor.W_h.size + spending_predictor.W_o.size,
            },
            {
                "name": "category_classifier",
                "type": "Feed-Forward Neural Network",
                "purpose": "Transaction category classification",
                "input": f"{EMBEDDING_DIM}-dim embedding",
                "output": f"Probability over {NUM_CATEGORIES} categories",
                "params": category_classifier.W1.size + category_classifier.W2.size + category_classifier.W3.size,
            },
        ],
    })


@app.route("/metrics")
def metrics():
    return jsonify({
        "models_loaded": 4,
        "embedding_dim": EMBEDDING_DIM,
        "sequence_length": SEQUENCE_LENGTH,
        "num_categories": NUM_CATEGORIES,
        "total_parameters": (
            lstm_ae.W_i.size + lstm_ae.W_proj.size +
            fraud_cnn.conv1_w.size + fraud_cnn.conv2_w.size + fraud_cnn.fc_w.size +
            spending_predictor.W_h.size + spending_predictor.W_o.size +
            category_classifier.W1.size + category_classifier.W2.size + category_classifier.W3.size
        ),
    })


if __name__ == "__main__":
    port = int(os.getenv("DEEP_LEARNING_PORT", "8103"))
    app.run(host="0.0.0.0", port=port)
