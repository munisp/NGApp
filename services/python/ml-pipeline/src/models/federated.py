"""
Federated Learning — FedAvg / FedProx Implementation
=====================================================
Implements federated averaging for multi-tenant ML model training.
Each tenant trains locally on their own well data, then submits
gradient updates to the aggregation server.

Algorithms:
  FedAvg:  weighted average of model parameters
  FedProx: FedAvg + proximal regularization term (μ * ||w - w_global||²)

Privacy: Differential privacy via gradient clipping + Gaussian noise.

Architecture:
  - Global model maintained on server
  - Participants submit encrypted weight diffs
  - Server aggregates and broadcasts new global model
"""

import logging
import time
from copy import deepcopy
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


class FederatedModel:
    """Simple neural network for federated learning (NumPy-based, no torch dependency)."""

    def __init__(self, input_dim: int = 10, hidden_dim: int = 32, output_dim: int = 1):
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        self._init_weights()

    def _init_weights(self):
        rng = np.random.default_rng(42)
        scale1 = np.sqrt(2.0 / self.input_dim)
        scale2 = np.sqrt(2.0 / self.hidden_dim)
        self.weights = {
            "W1": rng.normal(0, scale1, (self.input_dim, self.hidden_dim)).astype(np.float32),
            "b1": np.zeros(self.hidden_dim, dtype=np.float32),
            "W2": rng.normal(0, scale2, (self.hidden_dim, self.output_dim)).astype(np.float32),
            "b2": np.zeros(self.output_dim, dtype=np.float32),
        }

    def predict(self, X: np.ndarray) -> np.ndarray:
        h = np.maximum(0, X @ self.weights["W1"] + self.weights["b1"])  # ReLU
        logits = h @ self.weights["W2"] + self.weights["b2"]
        logits = np.clip(logits, -500, 500)
        return 1.0 / (1.0 + np.exp(-logits))  # Sigmoid

    def get_weights(self) -> Dict[str, np.ndarray]:
        return {k: v.copy() for k, v in self.weights.items()}

    def set_weights(self, weights: Dict[str, np.ndarray]):
        for k in self.weights:
            if k in weights:
                self.weights[k] = weights[k].copy()

    def train_local(
        self,
        X: np.ndarray,
        y: np.ndarray,
        epochs: int = 5,
        lr: float = 0.01,
        proximal_mu: float = 0.0,
        global_weights: Optional[Dict[str, np.ndarray]] = None,
    ) -> Dict[str, np.ndarray]:
        """
        Train locally using mini-batch SGD.
        Returns weight updates (deltas from initial weights).
        """
        initial_weights = self.get_weights()
        n = len(X)

        for epoch in range(epochs):
            indices = np.random.permutation(n)
            for start in range(0, n, 32):
                batch_idx = indices[start:start + 32]
                X_batch = X[batch_idx]
                y_batch = y[batch_idx].reshape(-1, 1)

                # Forward pass
                h = np.maximum(0, X_batch @ self.weights["W1"] + self.weights["b1"])
                pred = 1.0 / (1.0 + np.exp(-(h @ self.weights["W2"] + self.weights["b2"])))

                # Binary cross-entropy gradient
                error = pred - y_batch
                batch_size = len(X_batch)

                # Backprop
                dW2 = h.T @ error / batch_size
                db2 = error.mean(axis=0)
                dh = error @ self.weights["W2"].T
                dh[h <= 0] = 0  # ReLU gradient
                dW1 = X_batch.T @ dh / batch_size
                db1 = dh.mean(axis=0)

                # FedProx proximal term
                if proximal_mu > 0 and global_weights is not None:
                    dW1 += proximal_mu * (self.weights["W1"] - global_weights["W1"])
                    dW2 += proximal_mu * (self.weights["W2"] - global_weights["W2"])

                # Update
                self.weights["W1"] -= lr * dW1
                self.weights["b1"] -= lr * db1
                self.weights["W2"] -= lr * dW2
                self.weights["b2"] -= lr * db2

        # Return weight deltas
        deltas = {}
        for k in self.weights:
            deltas[k] = self.weights[k] - initial_weights[k]
        return deltas


class FederatedAggregator:
    """
    Federated learning aggregation server.
    Supports FedAvg, FedProx, and differential privacy.
    """

    def __init__(
        self,
        model: FederatedModel,
        strategy: str = "fedavg",
        dp_epsilon: float = 1.0,
        dp_delta: float = 1e-5,
        dp_clip_norm: float = 1.0,
    ):
        self.global_model = model
        self.strategy = strategy
        self.dp_epsilon = dp_epsilon
        self.dp_delta = dp_delta
        self.dp_clip_norm = dp_clip_norm
        self.round_number = 0
        self.history: List[dict] = []

    def aggregate(
        self,
        participant_updates: List[Dict[str, Any]],
    ) -> Dict[str, np.ndarray]:
        """
        Aggregate participant weight updates into new global model.

        Args:
            participant_updates: list of {"weights": {str: ndarray}, "n_samples": int, "tenant_id": str}
        """
        if not participant_updates:
            return self.global_model.get_weights()

        t0 = time.time()
        total_samples = sum(p["n_samples"] for p in participant_updates)

        if self.strategy == "fedavg":
            new_weights = self._fedavg(participant_updates, total_samples)
        elif self.strategy == "fedprox":
            new_weights = self._fedavg(participant_updates, total_samples)
        else:
            new_weights = self._fedavg(participant_updates, total_samples)

        # Apply differential privacy noise
        if self.dp_epsilon < float("inf"):
            new_weights = self._apply_dp_noise(new_weights)

        self.global_model.set_weights(new_weights)
        self.round_number += 1

        elapsed = time.time() - t0
        self.history.append({
            "round": self.round_number,
            "participants": len(participant_updates),
            "total_samples": total_samples,
            "aggregation_time_ms": round(elapsed * 1000, 1),
        })

        logger.info(
            "FL round %d: aggregated %d participants (%d samples) in %.1fms",
            self.round_number, len(participant_updates), total_samples, elapsed * 1000,
        )
        return new_weights

    def _fedavg(
        self,
        updates: List[Dict[str, Any]],
        total_samples: int,
    ) -> Dict[str, np.ndarray]:
        """Weighted average of model weights (FedAvg algorithm)."""
        avg_weights: Dict[str, np.ndarray] = {}
        for key in self.global_model.weights:
            weighted_sum = np.zeros_like(self.global_model.weights[key])
            for update in updates:
                weight = update["n_samples"] / total_samples
                weighted_sum += weight * update["weights"][key]
            avg_weights[key] = weighted_sum
        return avg_weights

    def _apply_dp_noise(self, weights: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
        """Add calibrated Gaussian noise for differential privacy."""
        rng = np.random.default_rng()
        # Clip weights
        for key in weights:
            norm = np.linalg.norm(weights[key])
            if norm > self.dp_clip_norm:
                weights[key] = weights[key] * (self.dp_clip_norm / norm)

        # Gaussian mechanism: sigma = sqrt(2 * ln(1.25/delta)) * sensitivity / epsilon
        import math
        sigma = math.sqrt(2 * math.log(1.25 / self.dp_delta)) * self.dp_clip_norm / self.dp_epsilon

        for key in weights:
            noise = rng.normal(0, sigma, weights[key].shape).astype(np.float32)
            weights[key] += noise

        return weights

    def get_status(self) -> dict:
        return {
            "strategy": self.strategy,
            "round_number": self.round_number,
            "dp_epsilon": self.dp_epsilon,
            "history": self.history[-10:],
        }


def run_federated_round(
    n_participants: int = 5,
    samples_per_participant: int = 200,
    local_epochs: int = 5,
    strategy: str = "fedavg",
    dp_epsilon: float = 1.0,
) -> dict:
    """
    Simulate a complete federated learning round for testing/demo.
    """
    rng = np.random.default_rng(42)
    model = FederatedModel(input_dim=10, hidden_dim=32, output_dim=1)
    aggregator = FederatedAggregator(model, strategy=strategy, dp_epsilon=dp_epsilon)

    global_weights = model.get_weights()
    proximal_mu = 0.01 if strategy == "fedprox" else 0.0

    participant_updates = []
    for p in range(n_participants):
        # Each participant has local data with different distributions
        local_model = FederatedModel(input_dim=10, hidden_dim=32, output_dim=1)
        local_model.set_weights(global_weights)

        X_local = rng.normal(p * 0.5, 1.0, (samples_per_participant, 10)).astype(np.float32)
        y_local = (X_local[:, 0] + X_local[:, 1] > p * 0.3).astype(np.float32)

        local_model.train_local(
            X_local, y_local,
            epochs=local_epochs,
            proximal_mu=proximal_mu,
            global_weights=global_weights,
        )

        participant_updates.append({
            "weights": local_model.get_weights(),
            "n_samples": samples_per_participant,
            "tenant_id": f"tenant-{p + 1}",
        })

    new_weights = aggregator.aggregate(participant_updates)

    # Evaluate on test data
    X_test = rng.normal(0, 1, (100, 10)).astype(np.float32)
    y_test = (X_test[:, 0] + X_test[:, 1] > 0).astype(np.float32)
    pred = model.predict(X_test).flatten()
    accuracy = np.mean((pred > 0.5) == y_test)

    return {
        "round": aggregator.round_number,
        "participants": n_participants,
        "strategy": strategy,
        "accuracy": round(float(accuracy), 3),
        "dp_epsilon": dp_epsilon,
        "status": aggregator.get_status(),
    }
