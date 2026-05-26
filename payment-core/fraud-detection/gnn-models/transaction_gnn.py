"""
Graph Neural Network Models for Transaction Fraud Detection

This module implements state-of-the-art GNN architectures for detecting
fraudulent transactions in the payment switch platform.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATConv, SAGEConv, GCNConv
from torch_geometric.nn import global_mean_pool, global_max_pool
from typing import Dict, Tuple, Optional


class GraphAttentionFraudDetector(nn.Module):
    """
    Graph Attention Network (GAT) for fraud detection.
    
    Uses attention mechanisms to assign different importance to neighboring
    nodes in the transaction graph.
    """
    
    def __init__(
        self,
        node_feature_dim: int,
        edge_feature_dim: int,
        hidden_dim: int = 128,
        num_heads: int = 4,
        num_layers: int = 3,
        dropout: float = 0.3
    ):
        super().__init__()
        
        self.node_feature_dim = node_feature_dim
        self.edge_feature_dim = edge_feature_dim
        self.hidden_dim = hidden_dim
        self.num_heads = num_heads
        
        # Initial node embedding
        self.node_embedding = nn.Linear(node_feature_dim, hidden_dim)
        
        # GAT layers
        self.gat_layers = nn.ModuleList()
        for i in range(num_layers):
            in_channels = hidden_dim if i == 0 else hidden_dim * num_heads
            self.gat_layers.append(
                GATConv(
                    in_channels=in_channels,
                    out_channels=hidden_dim,
                    heads=num_heads,
                    dropout=dropout,
                    concat=True if i < num_layers - 1 else False
                )
            )
        
        # Edge feature processing
        self.edge_encoder = nn.Sequential(
            nn.Linear(edge_feature_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        # Final classification layers
        final_dim = hidden_dim * num_heads if num_layers > 1 else hidden_dim
        self.classifier = nn.Sequential(
            nn.Linear(final_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1)
        )
        
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: Optional[torch.Tensor] = None,
        batch: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass through the GAT model.
        
        Args:
            x: Node features [num_nodes, node_feature_dim]
            edge_index: Edge connectivity [2, num_edges]
            edge_attr: Edge features [num_edges, edge_feature_dim]
            batch: Batch assignment for graph-level prediction
            
        Returns:
            fraud_score: Fraud probability [batch_size, 1]
            node_embeddings: Final node embeddings [num_nodes, hidden_dim]
        """
        # Initial node embedding
        x = F.relu(self.node_embedding(x))
        
        # Apply GAT layers
        for i, gat_layer in enumerate(self.gat_layers):
            x = gat_layer(x, edge_index)
            if i < len(self.gat_layers) - 1:
                x = F.relu(x)
                x = F.dropout(x, p=0.3, training=self.training)
        
        # Store node embeddings for explainability
        node_embeddings = x
        
        # Graph-level pooling for transaction-level prediction
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Final classification
        fraud_score = torch.sigmoid(self.classifier(x))
        
        return fraud_score, node_embeddings


class GraphSAGEFraudDetector(nn.Module):
    """
    GraphSAGE model for fraud detection.
    
    Inductive learning approach that can generalize to unseen nodes,
    making it suitable for real-time fraud detection on new users/merchants.
    """
    
    def __init__(
        self,
        node_feature_dim: int,
        hidden_dim: int = 128,
        num_layers: int = 3,
        dropout: float = 0.3,
        aggregator: str = 'mean'
    ):
        super().__init__()
        
        self.node_feature_dim = node_feature_dim
        self.hidden_dim = hidden_dim
        
        # GraphSAGE layers
        self.sage_layers = nn.ModuleList()
        self.sage_layers.append(SAGEConv(node_feature_dim, hidden_dim, aggr=aggregator))
        
        for _ in range(num_layers - 1):
            self.sage_layers.append(SAGEConv(hidden_dim, hidden_dim, aggr=aggregator))
        
        # Batch normalization
        self.batch_norms = nn.ModuleList([
            nn.BatchNorm1d(hidden_dim) for _ in range(num_layers)
        ])
        
        # Dropout
        self.dropout = dropout
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),  # *2 for mean+max pooling
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1)
        )
        
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        batch: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass through the GraphSAGE model.
        
        Args:
            x: Node features [num_nodes, node_feature_dim]
            edge_index: Edge connectivity [2, num_edges]
            batch: Batch assignment for graph-level prediction
            
        Returns:
            fraud_score: Fraud probability [batch_size, 1]
            node_embeddings: Final node embeddings [num_nodes, hidden_dim]
        """
        # Apply GraphSAGE layers
        for i, (sage_layer, batch_norm) in enumerate(zip(self.sage_layers, self.batch_norms)):
            x = sage_layer(x, edge_index)
            x = batch_norm(x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Store node embeddings
        node_embeddings = x
        
        # Graph-level pooling (combine mean and max)
        if batch is not None:
            x_mean = global_mean_pool(x, batch)
            x_max = global_max_pool(x, batch)
            x = torch.cat([x_mean, x_max], dim=1)
        
        # Final classification
        fraud_score = torch.sigmoid(self.classifier(x))
        
        return fraud_score, node_embeddings


class TemporalGNNFraudDetector(nn.Module):
    """
    Temporal Graph Neural Network for fraud detection.
    
    Captures the time-evolving nature of fraudulent behavior by incorporating
    temporal information into the graph structure.
    """
    
    def __init__(
        self,
        node_feature_dim: int,
        edge_feature_dim: int,
        hidden_dim: int = 128,
        num_layers: int = 3,
        dropout: float = 0.3
    ):
        super().__init__()
        
        self.node_feature_dim = node_feature_dim
        self.edge_feature_dim = edge_feature_dim
        self.hidden_dim = hidden_dim
        
        # Temporal encoding
        self.time_encoder = nn.Sequential(
            nn.Linear(1, hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(hidden_dim // 4, hidden_dim // 4)
        )
        
        # Node feature encoding
        self.node_encoder = nn.Linear(node_feature_dim, hidden_dim)
        
        # Edge feature encoding
        self.edge_encoder = nn.Linear(edge_feature_dim + hidden_dim // 4, hidden_dim)
        
        # GCN layers with temporal attention
        self.gcn_layers = nn.ModuleList()
        for _ in range(num_layers):
            self.gcn_layers.append(GCNConv(hidden_dim, hidden_dim))
        
        # Temporal attention
        self.temporal_attention = nn.MultiheadAttention(
            embed_dim=hidden_dim,
            num_heads=4,
            dropout=dropout,
            batch_first=True
        )
        
        # LSTM for temporal sequence modeling
        self.lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            dropout=dropout,
            batch_first=True
        )
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1)
        )
        
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        timestamps: torch.Tensor,
        batch: Optional[torch.Tensor] = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass through the Temporal GNN model.
        
        Args:
            x: Node features [num_nodes, node_feature_dim]
            edge_index: Edge connectivity [2, num_edges]
            edge_attr: Edge features [num_edges, edge_feature_dim]
            timestamps: Transaction timestamps [num_edges, 1]
            batch: Batch assignment for graph-level prediction
            
        Returns:
            fraud_score: Fraud probability [batch_size, 1]
            node_embeddings: Final node embeddings [num_nodes, hidden_dim]
        """
        # Encode temporal information
        time_encoding = self.time_encoder(timestamps)
        
        # Encode node features
        x = F.relu(self.node_encoder(x))
        
        # Encode edge features with temporal information
        edge_attr_temporal = torch.cat([edge_attr, time_encoding], dim=1)
        edge_encoding = self.edge_encoder(edge_attr_temporal)
        
        # Apply GCN layers
        for gcn_layer in self.gcn_layers:
            x = gcn_layer(x, edge_index)
            x = F.relu(x)
            x = F.dropout(x, p=0.3, training=self.training)
        
        # Store node embeddings
        node_embeddings = x
        
        # Graph-level pooling
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Reshape for temporal attention (assuming batch represents time steps)
        # In practice, you would organize this based on your temporal batching strategy
        x = x.unsqueeze(1)  # Add sequence dimension
        
        # Apply temporal attention
        x_attended, _ = self.temporal_attention(x, x, x)
        
        # Apply LSTM for temporal modeling
        x_temporal, _ = self.lstm(x_attended)
        x = x_temporal[:, -1, :]  # Take last time step
        
        # Final classification
        fraud_score = torch.sigmoid(self.classifier(x))
        
        return fraud_score, node_embeddings


class EnsembleGNNFraudDetector(nn.Module):
    """
    Ensemble of multiple GNN models for robust fraud detection.
    
    Combines predictions from GAT, GraphSAGE, and Temporal GNN models
    to improve overall accuracy and reduce false positives.
    """
    
    def __init__(
        self,
        node_feature_dim: int,
        edge_feature_dim: int,
        hidden_dim: int = 128,
        dropout: float = 0.3
    ):
        super().__init__()
        
        # Initialize individual models
        self.gat_model = GraphAttentionFraudDetector(
            node_feature_dim=node_feature_dim,
            edge_feature_dim=edge_feature_dim,
            hidden_dim=hidden_dim,
            dropout=dropout
        )
        
        self.sage_model = GraphSAGEFraudDetector(
            node_feature_dim=node_feature_dim,
            hidden_dim=hidden_dim,
            dropout=dropout
        )
        
        self.temporal_model = TemporalGNNFraudDetector(
            node_feature_dim=node_feature_dim,
            edge_feature_dim=edge_feature_dim,
            hidden_dim=hidden_dim,
            dropout=dropout
        )
        
        # Ensemble weights (learnable)
        self.ensemble_weights = nn.Parameter(torch.ones(3) / 3)
        
        # Meta-learner for final prediction
        self.meta_learner = nn.Sequential(
            nn.Linear(3, 16),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(16, 1)
        )
        
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        timestamps: torch.Tensor,
        batch: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through the ensemble model.
        
        Args:
            x: Node features
            edge_index: Edge connectivity
            edge_attr: Edge features
            timestamps: Transaction timestamps
            batch: Batch assignment
            
        Returns:
            Dictionary containing:
                - ensemble_score: Final ensemble fraud score
                - gat_score: GAT model score
                - sage_score: GraphSAGE model score
                - temporal_score: Temporal GNN model score
        """
        # Get predictions from individual models
        gat_score, _ = self.gat_model(x, edge_index, edge_attr, batch)
        sage_score, _ = self.sage_model(x, edge_index, batch)
        temporal_score, _ = self.temporal_model(x, edge_index, edge_attr, timestamps, batch)
        
        # Weighted ensemble
        weights = F.softmax(self.ensemble_weights, dim=0)
        weighted_scores = torch.stack([gat_score, sage_score, temporal_score], dim=1)
        weighted_scores = weighted_scores.squeeze(-1)
        
        # Meta-learner for final prediction
        ensemble_score = torch.sigmoid(self.meta_learner(weighted_scores))
        
        return {
            'ensemble_score': ensemble_score,
            'gat_score': gat_score,
            'sage_score': sage_score,
            'temporal_score': temporal_score,
            'weights': weights
        }


def create_fraud_detector(
    model_type: str,
    node_feature_dim: int,
    edge_feature_dim: int,
    **kwargs
) -> nn.Module:
    """
    Factory function to create fraud detection models.
    
    Args:
        model_type: Type of model ('gat', 'sage', 'temporal', 'ensemble')
        node_feature_dim: Dimension of node features
        edge_feature_dim: Dimension of edge features
        **kwargs: Additional model-specific parameters
        
    Returns:
        Initialized fraud detection model
    """
    models = {
        'gat': GraphAttentionFraudDetector,
        'sage': GraphSAGEFraudDetector,
        'temporal': TemporalGNNFraudDetector,
        'ensemble': EnsembleGNNFraudDetector
    }
    
    if model_type not in models:
        raise ValueError(f"Unknown model type: {model_type}")
    
    model_class = models[model_type]
    
    # Prepare kwargs based on model type
    if model_type in ['gat', 'temporal', 'ensemble']:
        return model_class(
            node_feature_dim=node_feature_dim,
            edge_feature_dim=edge_feature_dim,
            **kwargs
        )
    else:  # sage
        return model_class(
            node_feature_dim=node_feature_dim,
            **kwargs
        )
