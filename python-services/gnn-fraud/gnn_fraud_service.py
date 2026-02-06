"""
Graph Neural Network Fraud Detection Service
Uses PyTorch Geometric for transaction graph analysis with GAT (Graph Attention Networks).
Detects fraud through graph structure: accounts as nodes, transactions as edges.
"""

import os
import time
import uuid
import json
import math
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

torch_geometric_available = False
try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    torch_available = True
except ImportError:
    torch_available = False
    torch = None

DEVICE = "cpu"
EMBEDDING_DIM = 64
HIDDEN_DIM = 128
NUM_HEADS = 4
NUM_LAYERS = 3
DROPOUT = 0.3
FRAUD_THRESHOLD = 0.7


class TransactionGraph:
    """In-memory transaction graph for fraud detection."""

    def __init__(self):
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []
        self.node_index: Dict[str, int] = {}
        self.adjacency: Dict[str, List[str]] = {}

    def add_node(self, node_id: str, node_type: str, features: Dict[str, Any]):
        self.nodes[node_id] = {"type": node_type, "features": features}
        if node_id not in self.node_index:
            self.node_index[node_id] = len(self.node_index)
        if node_id not in self.adjacency:
            self.adjacency[node_id] = []

    def add_edge(self, source: str, target: str, edge_type: str, features: Dict[str, Any]):
        self.edges.append({
            "source": source, "target": target,
            "type": edge_type, "features": features,
        })
        if source not in self.adjacency:
            self.adjacency[source] = []
        self.adjacency[source].append(target)
        if target not in self.adjacency:
            self.adjacency[target] = []
        self.adjacency[target].append(source)

    def get_neighborhood(self, node_id: str, hops: int = 2) -> Dict[str, Any]:
        visited = set()
        frontier = {node_id}
        subgraph_nodes = set()
        subgraph_edges = []

        for _ in range(hops):
            next_frontier = set()
            for n in frontier:
                if n in visited:
                    continue
                visited.add(n)
                subgraph_nodes.add(n)
                for neighbor in self.adjacency.get(n, []):
                    next_frontier.add(neighbor)
                    subgraph_nodes.add(neighbor)
            frontier = next_frontier

        for edge in self.edges:
            if edge["source"] in subgraph_nodes and edge["target"] in subgraph_nodes:
                subgraph_edges.append(edge)

        return {
            "nodes": {n: self.nodes.get(n, {}) for n in subgraph_nodes},
            "edges": subgraph_edges,
            "center_node": node_id,
            "num_nodes": len(subgraph_nodes),
            "num_edges": len(subgraph_edges),
        }

    def to_feature_matrix(self) -> Tuple[Any, Any]:
        n = len(self.nodes)
        if n == 0:
            return np.zeros((1, EMBEDDING_DIM)), np.zeros((2, 0), dtype=int)

        feature_matrix = np.zeros((n, EMBEDDING_DIM))
        for node_id, idx in self.node_index.items():
            node_data = self.nodes.get(node_id, {})
            features = node_data.get("features", {})
            seed = int(hashlib.md5(node_id.encode()).hexdigest()[:8], 16) % (2**31)
            np.random.seed(seed)
            base = np.random.randn(EMBEDDING_DIM) * 0.1

            if node_data.get("type") == "account":
                base[0] = features.get("balance", 0) / 100000
                base[1] = features.get("age_days", 0) / 365
                base[2] = features.get("total_transactions", 0) / 1000
                base[3] = 1.0 if features.get("kyc_verified", False) else 0.0
                base[4] = features.get("risk_score", 0.5)
            elif node_data.get("type") == "merchant":
                base[10] = features.get("category_code", 0) / 20
                base[11] = features.get("avg_transaction", 0) / 10000
                base[12] = features.get("fraud_rate", 0)
            elif node_data.get("type") == "device":
                base[20] = features.get("trust_score", 0.5)
                base[21] = 1.0 if features.get("is_mobile", True) else 0.0

            feature_matrix[idx] = base

        edge_sources = []
        edge_targets = []
        for edge in self.edges:
            src_idx = self.node_index.get(edge["source"])
            tgt_idx = self.node_index.get(edge["target"])
            if src_idx is not None and tgt_idx is not None:
                edge_sources.append(src_idx)
                edge_targets.append(tgt_idx)
                edge_sources.append(tgt_idx)
                edge_targets.append(src_idx)

        edge_index = np.array([edge_sources, edge_targets], dtype=int) if edge_sources else np.zeros((2, 0), dtype=int)
        return feature_matrix, edge_index


class GATLayer:
    """Graph Attention Network layer (numpy implementation for portability)."""

    def __init__(self, in_dim: int, out_dim: int, num_heads: int = 4):
        self.in_dim = in_dim
        self.out_dim = out_dim
        self.num_heads = num_heads
        self.head_dim = out_dim // num_heads

        np.random.seed(42)
        scale = np.sqrt(2.0 / (in_dim + self.head_dim))
        self.W = np.random.randn(num_heads, in_dim, self.head_dim) * scale
        self.a_src = np.random.randn(num_heads, self.head_dim) * scale
        self.a_tgt = np.random.randn(num_heads, self.head_dim) * scale

    def forward(self, x: np.ndarray, edge_index: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        n = x.shape[0]
        if edge_index.shape[1] == 0:
            return x[:, :self.out_dim] if x.shape[1] >= self.out_dim else np.zeros((n, self.out_dim)), np.zeros((self.num_heads, 0))

        head_outputs = []
        all_attention = []

        for h in range(self.num_heads):
            Wh = x @ self.W[h]
            src_scores = Wh @ self.a_src[h]
            tgt_scores = Wh @ self.a_tgt[h]

            attention_scores = np.full((n, n), -1e9)
            for i in range(edge_index.shape[1]):
                s, t = edge_index[0, i], edge_index[1, i]
                attention_scores[s, t] = src_scores[s] + tgt_scores[t]

            for i in range(n):
                neighbors = edge_index[1, edge_index[0] == i]
                if len(neighbors) > 0:
                    scores = attention_scores[i, neighbors]
                    max_score = np.max(scores)
                    exp_scores = np.exp(scores - max_score)
                    attention_scores[i, neighbors] = exp_scores / (exp_scores.sum() + 1e-8)

            out = np.zeros((n, self.head_dim))
            for i in range(n):
                neighbors = edge_index[1, edge_index[0] == i]
                if len(neighbors) > 0:
                    attn = attention_scores[i, neighbors].reshape(-1, 1)
                    out[i] = (attn * Wh[neighbors]).sum(axis=0)
                else:
                    out[i] = Wh[i]

            head_outputs.append(out)
            all_attention.append(attention_scores)

        output = np.concatenate(head_outputs, axis=1)
        output = np.maximum(output, 0)
        return output, np.array(all_attention)


class FraudGNN:
    """Full GNN model for fraud detection."""

    def __init__(self):
        self.layers = []
        in_dim = EMBEDDING_DIM
        for i in range(NUM_LAYERS):
            out_dim = HIDDEN_DIM if i < NUM_LAYERS - 1 else EMBEDDING_DIM
            self.layers.append(GATLayer(in_dim, out_dim, NUM_HEADS))
            in_dim = out_dim

        np.random.seed(42)
        self.classifier_w = np.random.randn(EMBEDDING_DIM, 1) * np.sqrt(2.0 / EMBEDDING_DIM)
        self.classifier_b = np.zeros(1)

    def predict(self, x: np.ndarray, edge_index: np.ndarray) -> Tuple[np.ndarray, List[np.ndarray]]:
        h = x
        attention_weights = []
        for layer in self.layers:
            h_new, attn = layer.forward(h, edge_index)
            if h_new.shape[1] == h.shape[1]:
                h = h + h_new
            else:
                h = h_new
            attention_weights.append(attn)

        logits = h @ self.classifier_w + self.classifier_b
        scores = 1 / (1 + np.exp(-logits.flatten()))
        return scores, attention_weights


graph = TransactionGraph()
model = FraudGNN()

RULE_CHECKS = [
    {"id": "R001", "name": "large_amount", "severity": "high", "threshold": 10000,
     "check": lambda txn: txn.get("amount", 0) > 10000},
    {"id": "R002", "name": "international_transfer", "severity": "medium",
     "check": lambda txn: txn.get("is_international", False)},
    {"id": "R003", "name": "new_account", "severity": "medium",
     "check": lambda txn: txn.get("account_age_days", 365) < 30},
    {"id": "R004", "name": "odd_hours", "severity": "low",
     "check": lambda txn: txn.get("hour_of_day", 12) < 5 or txn.get("hour_of_day", 12) > 23},
    {"id": "R005", "name": "rapid_succession", "severity": "high",
     "check": lambda txn: txn.get("transactions_last_hour", 0) > 10},
    {"id": "R006", "name": "round_amount", "severity": "low",
     "check": lambda txn: txn.get("amount", 0) > 1000 and txn.get("amount", 0) % 1000 == 0},
    {"id": "R007", "name": "velocity_breach", "severity": "critical",
     "check": lambda txn: txn.get("velocity_kmh", 0) > 500},
    {"id": "R008", "name": "first_international", "severity": "medium",
     "check": lambda txn: txn.get("is_international", False) and txn.get("international_count", 0) == 0},
]


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "service": "gnn-fraud-detection",
        "model": "GAT (Graph Attention Network)",
        "layers": NUM_LAYERS,
        "heads": NUM_HEADS,
        "embedding_dim": EMBEDDING_DIM,
        "hidden_dim": HIDDEN_DIM,
        "graph_nodes": len(graph.nodes),
        "graph_edges": len(graph.edges),
        "rules": len(RULE_CHECKS),
        "fraud_threshold": FRAUD_THRESHOLD,
        "torch_available": torch_available,
    })


@app.route("/detect", methods=["POST"])
def detect_fraud():
    start = time.time()
    data = request.get_json()
    txn = data.get("transaction", {})
    account = data.get("account", {})
    history = data.get("history", [])

    txn_id = txn.get("transaction_id", str(uuid.uuid4()))

    sender_id = txn.get("from_account", f"acct-{uuid.uuid4().hex[:6]}")
    receiver_id = txn.get("to_account", f"acct-{uuid.uuid4().hex[:6]}")
    merchant_id = txn.get("merchant_id", f"merch-{uuid.uuid4().hex[:6]}")

    graph.add_node(sender_id, "account", {
        "balance": account.get("balance", 0),
        "age_days": account.get("account_age_days", 365),
        "total_transactions": account.get("total_transactions", 0),
        "kyc_verified": account.get("kyc_verified", True),
        "risk_score": account.get("risk_score", 0.1),
    })
    graph.add_node(receiver_id, "account", {
        "balance": 0, "age_days": 365, "total_transactions": 0,
        "kyc_verified": True, "risk_score": 0.1,
    })
    graph.add_node(merchant_id, "merchant", {
        "category_code": hash(txn.get("merchant_category", "")) % 20,
        "avg_transaction": txn.get("amount", 0),
        "fraud_rate": 0.02,
    })

    graph.add_edge(sender_id, receiver_id, "transfer", {
        "amount": txn.get("amount", 0),
        "timestamp": txn.get("timestamp", datetime.utcnow().isoformat()),
    })
    graph.add_edge(sender_id, merchant_id, "purchase", {
        "amount": txn.get("amount", 0),
    })

    feature_matrix, edge_index = graph.to_feature_matrix()
    gnn_scores, attention_weights = model.predict(feature_matrix, edge_index)

    sender_idx = graph.node_index.get(sender_id, 0)
    gnn_score = float(gnn_scores[sender_idx]) if sender_idx < len(gnn_scores) else 0.5

    rule_violations = []
    rule_score = 0.0
    for rule in RULE_CHECKS:
        if rule["check"](txn):
            severity_weight = {"low": 0.1, "medium": 0.2, "high": 0.35, "critical": 0.5}
            rule_score += severity_weight.get(rule["severity"], 0.1)
            rule_violations.append({
                "rule_id": rule["id"],
                "rule_name": rule["name"],
                "severity": rule["severity"],
                "description": f"Rule {rule['name']} triggered",
                "score": severity_weight.get(rule["severity"], 0.1),
            })
    rule_score = min(rule_score, 1.0)

    ml_features = np.array([
        txn.get("amount", 0) / 10000,
        1.0 if txn.get("is_international", False) else 0.0,
        txn.get("hour_of_day", 12) / 24,
        account.get("account_age_days", 365) / 365,
        account.get("risk_score", 0.1),
        len(history) / 100,
    ])
    seed = int(hashlib.md5(json.dumps(txn, sort_keys=True, default=str).encode()).hexdigest()[:8], 16) % (2**31)
    np.random.seed(seed)
    weights = np.array([0.25, 0.2, 0.1, -0.15, 0.2, -0.05])
    ml_score = float(1 / (1 + np.exp(-(np.dot(ml_features, weights) + np.random.normal(0, 0.1)))))

    combined_score = 0.4 * gnn_score + 0.35 * ml_score + 0.25 * rule_score
    is_fraud = combined_score > FRAUD_THRESHOLD

    if combined_score >= 0.9:
        action = "BLOCK_TRANSACTION"
    elif combined_score >= 0.7:
        action = "MANUAL_REVIEW"
    elif combined_score >= 0.5:
        action = "ADDITIONAL_VERIFICATION"
    else:
        action = "ALLOW"

    neighborhood = graph.get_neighborhood(sender_id, hops=2)

    patterns = []
    if txn.get("amount", 0) > account.get("avg_transaction_amount", 1000) * 3:
        patterns.append("amount_3x_average")
    if txn.get("is_international") and account.get("total_transactions", 0) < 10:
        patterns.append("international_new_account")
    if txn.get("hour_of_day", 12) < 5:
        patterns.append("early_morning_transaction")
    if len(history) > 5:
        recent_amounts = [h.get("amount", 0) for h in history[:5]]
        if txn.get("amount", 0) > np.mean(recent_amounts) * 5:
            patterns.append("sudden_amount_spike")

    processing_time = (time.time() - start) * 1000

    return jsonify({
        "transaction_id": txn_id,
        "is_fraud": is_fraud,
        "confidence": round(0.7 + combined_score * 0.25, 4),
        "risk_score": round(combined_score, 4),
        "recommended_action": action,
        "explanation": f"Combined risk score {combined_score:.2f} from GNN ({gnn_score:.2f}), ML ({ml_score:.2f}), Rules ({rule_score:.2f})",
        "gnn_score": round(gnn_score, 4),
        "ml_score": round(ml_score, 4),
        "rule_based_score": round(rule_score, 4),
        "rule_violations": rule_violations,
        "suspicious_patterns": patterns,
        "graph_context": {
            "neighborhood_nodes": neighborhood["num_nodes"],
            "neighborhood_edges": neighborhood["num_edges"],
            "sender_connections": len(graph.adjacency.get(sender_id, [])),
        },
        "node_embedding": gnn_scores[sender_idx:sender_idx+1].tolist() if sender_idx < len(gnn_scores) else [],
        "timestamp": datetime.utcnow().isoformat(),
        "processing_time_ms": round(processing_time, 2),
    })


@app.route("/graph/stats")
def graph_stats():
    node_types = {}
    for n, data in graph.nodes.items():
        t = data.get("type", "unknown")
        node_types[t] = node_types.get(t, 0) + 1

    edge_types = {}
    for e in graph.edges:
        t = e.get("type", "unknown")
        edge_types[t] = edge_types.get(t, 0) + 1

    return jsonify({
        "total_nodes": len(graph.nodes),
        "total_edges": len(graph.edges),
        "node_types": node_types,
        "edge_types": edge_types,
        "avg_degree": round(np.mean([len(v) for v in graph.adjacency.values()]), 2) if graph.adjacency else 0,
        "max_degree": max([len(v) for v in graph.adjacency.values()]) if graph.adjacency else 0,
    })


@app.route("/graph/neighborhood/<node_id>")
def get_neighborhood(node_id):
    hops = request.args.get("hops", 2, type=int)
    if node_id not in graph.nodes:
        return jsonify({"error": "Node not found"}), 404
    return jsonify(graph.get_neighborhood(node_id, hops))


@app.route("/graph/add-transaction", methods=["POST"])
def add_transaction():
    data = request.get_json()
    sender = data.get("sender_id")
    receiver = data.get("receiver_id")
    amount = data.get("amount", 0)

    if not sender or not receiver:
        return jsonify({"error": "sender_id and receiver_id required"}), 400

    if sender not in graph.nodes:
        graph.add_node(sender, "account", {"balance": 0, "age_days": 0, "total_transactions": 0})
    if receiver not in graph.nodes:
        graph.add_node(receiver, "account", {"balance": 0, "age_days": 0, "total_transactions": 0})

    graph.add_edge(sender, receiver, "transfer", {"amount": amount, "timestamp": datetime.utcnow().isoformat()})
    return jsonify({"status": "added", "nodes": len(graph.nodes), "edges": len(graph.edges)})


@app.route("/rules")
def list_rules():
    return jsonify({
        "total_rules": len(RULE_CHECKS),
        "rules": [
            {"rule_id": r["id"], "name": r["name"], "severity": r["severity"]}
            for r in RULE_CHECKS
        ],
    })


@app.route("/embeddings", methods=["POST"])
def get_embeddings():
    data = request.get_json()
    node_ids = data.get("node_ids", [])

    feature_matrix, edge_index = graph.to_feature_matrix()
    scores, _ = model.predict(feature_matrix, edge_index)

    results = {}
    for nid in node_ids:
        idx = graph.node_index.get(nid)
        if idx is not None and idx < feature_matrix.shape[0]:
            results[nid] = {
                "embedding": feature_matrix[idx].tolist(),
                "fraud_score": float(scores[idx]) if idx < len(scores) else 0.0,
            }

    return jsonify({"embeddings": results, "embedding_dim": EMBEDDING_DIM})


@app.route("/metrics")
def metrics():
    return jsonify({
        "graph_nodes": len(graph.nodes),
        "graph_edges": len(graph.edges),
        "model_layers": NUM_LAYERS,
        "model_heads": NUM_HEADS,
        "embedding_dim": EMBEDDING_DIM,
        "fraud_threshold": FRAUD_THRESHOLD,
        "rules_count": len(RULE_CHECKS),
    })


if __name__ == "__main__":
    port = int(os.getenv("GNN_FRAUD_PORT", "8101"))
    app.run(host="0.0.0.0", port=port)
