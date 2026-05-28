"""
Graph Neural Network — Well-Network Connectivity Modeling
==========================================================
Implements a lightweight GNN (Graph Attention Network variant) for modeling
relationships between wells, equipment, and failure cascades.

Architecture:
  - Message-passing GNN with attention (GAT-style)
  - Nodes: wells, ESPs, compressors, separators, pipelines
  - Edges: physical connections, fluid flow paths, electrical circuits
  - Task: Predict failure cascade probability and identify critical nodes

Implementation: Pure NumPy (no torch_geometric dependency).
  For production at scale, migrate to PyTorch Geometric.

Inference: CPU only, < 500ms for 200-node graph.
"""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Node types in the O&G equipment graph
NODE_TYPES = ["well", "esp", "compressor", "separator", "pipeline", "flowline", "manifold", "tank"]
EDGE_TYPES = ["fluid_flow", "electrical", "control_signal", "physical_proximity"]
NODE_FEATURE_DIM = 16
HIDDEN_DIM = 32
N_HEADS = 4
N_LAYERS = 2


class GraphAttentionLayer:
    """
    Single GAT (Graph Attention Network) layer.
    Implements multi-head attention over graph neighbors.
    """

    def __init__(self, in_dim: int, out_dim: int, n_heads: int = 4):
        self.in_dim = in_dim
        self.out_dim = out_dim
        self.n_heads = n_heads
        self.head_dim = out_dim // n_heads

        rng = np.random.default_rng(42)
        scale = np.sqrt(2.0 / in_dim)

        # Multi-head attention weights
        self.W = rng.normal(0, scale, (n_heads, in_dim, self.head_dim)).astype(np.float32)
        self.a_src = rng.normal(0, 0.1, (n_heads, self.head_dim)).astype(np.float32)
        self.a_dst = rng.normal(0, 0.1, (n_heads, self.head_dim)).astype(np.float32)

    def forward(self, X: np.ndarray, adjacency: np.ndarray) -> np.ndarray:
        """
        Forward pass with multi-head attention.

        Args:
            X: Node features (N, in_dim)
            adjacency: Adjacency matrix (N, N) — 1 where edge exists

        Returns:
            Updated node features (N, out_dim)
        """
        N = X.shape[0]
        outputs = []

        for h in range(self.n_heads):
            # Linear transform
            Xh = X @ self.W[h]  # (N, head_dim)

            # Attention scores
            e_src = Xh @ self.a_src[h]  # (N,)
            e_dst = Xh @ self.a_dst[h]  # (N,)
            e = e_src[:, None] + e_dst[None, :]  # (N, N)

            # LeakyReLU
            e = np.where(e > 0, e, 0.2 * e)

            # Mask non-edges with -inf
            e = np.where(adjacency > 0, e, -1e9)

            # Softmax
            e_exp = np.exp(e - e.max(axis=1, keepdims=True))
            alpha = e_exp / (e_exp.sum(axis=1, keepdims=True) + 1e-8)

            # Aggregate
            out_h = alpha @ Xh  # (N, head_dim)
            outputs.append(out_h)

        # Concatenate heads
        return np.concatenate(outputs, axis=1)  # (N, out_dim)

    def get_attention_weights(self, X: np.ndarray, adjacency: np.ndarray) -> np.ndarray:
        """Return attention weights for visualization."""
        N = X.shape[0]
        all_alpha = np.zeros((self.n_heads, N, N))

        for h in range(self.n_heads):
            Xh = X @ self.W[h]
            e_src = Xh @ self.a_src[h]
            e_dst = Xh @ self.a_dst[h]
            e = e_src[:, None] + e_dst[None, :]
            e = np.where(e > 0, e, 0.2 * e)
            e = np.where(adjacency > 0, e, -1e9)
            e_exp = np.exp(e - e.max(axis=1, keepdims=True))
            all_alpha[h] = e_exp / (e_exp.sum(axis=1, keepdims=True) + 1e-8)

        return all_alpha.mean(axis=0)  # Average across heads


class WellNetworkGNN:
    """
    GNN for well-network failure cascade prediction.

    Uses multi-layer GAT to propagate failure risk through the equipment graph.
    Identifies critical nodes whose failure would cascade to most equipment.
    """

    def __init__(self, n_layers: int = N_LAYERS, hidden_dim: int = HIDDEN_DIM, n_heads: int = N_HEADS):
        self.layers = []
        in_dim = NODE_FEATURE_DIM
        for i in range(n_layers):
            out_dim = hidden_dim if i < n_layers - 1 else hidden_dim
            layer = GraphAttentionLayer(in_dim, out_dim, n_heads)
            self.layers.append(layer)
            in_dim = out_dim

        # Output head for failure probability
        rng = np.random.default_rng(42)
        self.output_W = rng.normal(0, 0.1, (hidden_dim, 1)).astype(np.float32)
        self.output_b = np.zeros(1, dtype=np.float32)

    def forward(self, node_features: np.ndarray, adjacency: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Forward pass through GNN.

        Returns:
            embeddings: (N, hidden_dim) node embeddings
            failure_probs: (N,) failure cascade probabilities
        """
        X = node_features
        for layer in self.layers:
            X = layer.forward(X, adjacency)
            X = np.maximum(X, 0)  # ReLU

        logits = X @ self.output_W + self.output_b
        probs = 1.0 / (1.0 + np.exp(-logits.flatten()))

        return X, probs

    def predict_cascade(
        self,
        node_features: np.ndarray,
        adjacency: np.ndarray,
        failed_node_idx: int,
    ) -> dict:
        """
        Given a failed node, predict cascade impact on all other nodes.
        Simulates failure propagation through the graph.
        """
        t0 = time.time()
        N = node_features.shape[0]

        # Modify failed node features (set risk indicators to max)
        X_modified = node_features.copy()
        X_modified[failed_node_idx, :4] = 1.0  # Max risk features

        embeddings, failure_probs = self.forward(X_modified, adjacency)

        # BFS cascade simulation (how many hops to reach each node)
        cascade_depth = np.full(N, -1)
        cascade_depth[failed_node_idx] = 0
        queue = [failed_node_idx]
        visited = {failed_node_idx}

        while queue:
            current = queue.pop(0)
            neighbors = np.where(adjacency[current] > 0)[0]
            for nb in neighbors:
                if nb not in visited:
                    visited.add(nb)
                    cascade_depth[nb] = cascade_depth[current] + 1
                    queue.append(nb)

        # Impact score: combine GNN probability with cascade depth
        impact_scores = np.zeros(N)
        for i in range(N):
            if cascade_depth[i] >= 0:
                depth_decay = 0.8 ** cascade_depth[i]
                impact_scores[i] = failure_probs[i] * depth_decay

        latency_ms = (time.time() - t0) * 1000

        return {
            "source_node": failed_node_idx,
            "failure_probabilities": [round(float(p), 3) for p in failure_probs],
            "cascade_depth": [int(d) for d in cascade_depth],
            "impact_scores": [round(float(s), 3) for s in impact_scores],
            "affected_nodes": int(np.sum(cascade_depth >= 0)) - 1,
            "max_cascade_depth": int(np.max(cascade_depth)),
            "avg_impact": round(float(np.mean(impact_scores[impact_scores > 0])), 3) if np.any(impact_scores > 0) else 0,
            "inference_latency_ms": round(latency_ms, 1),
        }

    def identify_critical_nodes(
        self,
        node_features: np.ndarray,
        adjacency: np.ndarray,
        node_names: Optional[List[str]] = None,
    ) -> List[dict]:
        """
        Identify critical nodes whose failure would cause the worst cascade.
        Uses betweenness centrality + GNN failure probability.
        """
        t0 = time.time()
        N = node_features.shape[0]
        _, base_probs = self.forward(node_features, adjacency)

        # Compute criticality for each node
        criticality = []
        for i in range(N):
            cascade = self.predict_cascade(node_features, adjacency, i)
            # Criticality = affected_nodes * avg_impact
            crit_score = cascade["affected_nodes"] * cascade["avg_impact"]

            # Degree centrality
            degree = np.sum(adjacency[i] > 0) + np.sum(adjacency[:, i] > 0)

            criticality.append({
                "node_idx": i,
                "node_name": node_names[i] if node_names else f"node-{i}",
                "criticality_score": round(float(crit_score), 3),
                "failure_probability": round(float(base_probs[i]), 3),
                "affected_nodes": cascade["affected_nodes"],
                "max_cascade_depth": cascade["max_cascade_depth"],
                "degree": int(degree),
            })

        # Sort by criticality
        criticality.sort(key=lambda x: x["criticality_score"], reverse=True)
        latency_ms = (time.time() - t0) * 1000

        return criticality


def build_sample_well_network(n_wells: int = 20) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Build a sample well-network graph for testing/demo.
    Creates a realistic O&G field topology.
    """
    rng = np.random.default_rng(42)

    # Nodes: wells + shared equipment
    node_names = []
    for i in range(n_wells):
        node_names.append(f"Well-{i + 1:03d}")
    node_names.extend(["Manifold-A", "Manifold-B", "Separator-1", "Compressor-1", "Pipeline-Main", "Tank-Farm"])
    N = len(node_names)

    # Node features: [risk_temp, risk_vibration, risk_pressure, risk_flow,
    #                  age_years, production_rate, uptime_pct, maintenance_score,
    #                  type_onehot * 8]
    node_features = np.zeros((N, NODE_FEATURE_DIM), dtype=np.float32)
    for i in range(n_wells):
        node_features[i, 0] = rng.uniform(0, 0.5)  # risk_temp
        node_features[i, 1] = rng.uniform(0, 0.3)  # risk_vibration
        node_features[i, 2] = rng.uniform(0, 0.4)  # risk_pressure
        node_features[i, 3] = rng.uniform(0, 0.3)  # risk_flow
        node_features[i, 4] = rng.uniform(1, 20) / 20  # age
        node_features[i, 5] = rng.uniform(0.3, 1.0)  # production
        node_features[i, 6] = rng.uniform(0.85, 1.0)  # uptime
        node_features[i, 7] = rng.uniform(0.5, 1.0)  # maintenance
        node_features[i, 8] = 1.0  # type: well

    # Shared equipment features
    for j, eq_idx in enumerate(range(n_wells, N)):
        node_features[eq_idx, 4] = rng.uniform(5, 15) / 20
        node_features[eq_idx, 6] = rng.uniform(0.95, 1.0)
        node_features[eq_idx, 7] = rng.uniform(0.7, 1.0)
        node_features[eq_idx, 9 + min(j, 6)] = 1.0  # type encoding

    # Adjacency: wells connect to manifolds, manifolds to separator, etc.
    adjacency = np.zeros((N, N), dtype=np.float32)
    manifold_a = n_wells
    manifold_b = n_wells + 1
    separator = n_wells + 2
    compressor = n_wells + 3
    pipeline = n_wells + 4
    tank = n_wells + 5

    # Wells → Manifolds (split roughly in half)
    for i in range(n_wells):
        target = manifold_a if i < n_wells // 2 else manifold_b
        adjacency[i, target] = 1.0
        adjacency[target, i] = 1.0

    # Manifolds → Separator
    adjacency[manifold_a, separator] = 1.0
    adjacency[separator, manifold_a] = 1.0
    adjacency[manifold_b, separator] = 1.0
    adjacency[separator, manifold_b] = 1.0

    # Separator → Compressor, Tank
    adjacency[separator, compressor] = 1.0
    adjacency[compressor, separator] = 1.0
    adjacency[separator, tank] = 1.0
    adjacency[tank, separator] = 1.0

    # Compressor → Pipeline
    adjacency[compressor, pipeline] = 1.0
    adjacency[pipeline, compressor] = 1.0

    # Some inter-well connections (nearby wells share flowlines)
    for i in range(0, n_wells - 1, 3):
        adjacency[i, i + 1] = 1.0
        adjacency[i + 1, i] = 1.0

    return node_features, adjacency, node_names
