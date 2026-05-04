"""
GNN service for graph neural network integration.
"""

import logging
import os
import json
import numpy as np
import torch
import torch.nn.functional as F
from torch_geometric.data import Data, Batch
from torch_geometric.nn import GCNConv, GATConv, SAGEConv
from typing import Dict, List, Optional, Any, Union, Tuple
from datetime import datetime
from uuid import UUID, uuid4

from ..config.config import config
from ..models.base_models import (
    GraphNode, GraphEdge, GraphQuery, GraphQueryResult,
    CustomerProfile, TransactionEvent, FraudEvent,
    AIModelMetadata, AIModelPrediction
)

logger = logging.getLogger(__name__)

class FraudDetectionGNN(torch.nn.Module):
    """Fraud detection graph neural network model."""
    
    def __init__(
        self,
        node_feature_dim: int,
        edge_feature_dim: int,
        embedding_dim: int,
        hidden_dim: int,
        num_layers: int,
        dropout: float
    ):
        """
        Initialize the fraud detection GNN model.
        
        Args:
            node_feature_dim: Dimension of node features
            edge_feature_dim: Dimension of edge features
            embedding_dim: Dimension of embeddings
            hidden_dim: Dimension of hidden layers
            num_layers: Number of GNN layers
            dropout: Dropout rate
        """
        super(FraudDetectionGNN, self).__init__()
        
        self.node_feature_dim = node_feature_dim
        self.edge_feature_dim = edge_feature_dim
        self.embedding_dim = embedding_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.dropout = dropout
        
        # Node embedding layers
        self.node_embedding = torch.nn.Linear(node_feature_dim, embedding_dim)
        
        # Edge embedding layers
        self.edge_embedding = torch.nn.Linear(edge_feature_dim, embedding_dim)
        
        # GNN layers
        self.convs = torch.nn.ModuleList()
        self.batch_norms = torch.nn.ModuleList()
        
        # First layer
        self.convs.append(GATConv(embedding_dim, hidden_dim, heads=4, concat=False, edge_dim=embedding_dim))
        self.batch_norms.append(torch.nn.BatchNorm1d(hidden_dim))
        
        # Hidden layers
        for _ in range(num_layers - 2):
            self.convs.append(GATConv(hidden_dim, hidden_dim, heads=4, concat=False, edge_dim=embedding_dim))
            self.batch_norms.append(torch.nn.BatchNorm1d(hidden_dim))
        
        # Last layer
        self.convs.append(GATConv(hidden_dim, hidden_dim, heads=1, concat=False, edge_dim=embedding_dim))
        self.batch_norms.append(torch.nn.BatchNorm1d(hidden_dim))
        
        # Output layers
        self.transaction_classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden_dim, hidden_dim // 2),
            torch.nn.ReLU(),
            torch.nn.Dropout(dropout),
            torch.nn.Linear(hidden_dim // 2, 1)
        )
        
        # Node type embedding
        self.node_type_embedding = torch.nn.Embedding(10, embedding_dim)  # Assuming at most 10 node types
        
        # Edge type embedding
        self.edge_type_embedding = torch.nn.Embedding(10, embedding_dim)  # Assuming at most 10 edge types
    
    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        node_type: torch.Tensor,
        edge_type: torch.Tensor,
        transaction_mask: torch.Tensor
    ) -> torch.Tensor:
        """
        Forward pass of the model.
        
        Args:
            x: Node features
            edge_index: Edge indices
            edge_attr: Edge features
            node_type: Node type indices
            edge_type: Edge type indices
            transaction_mask: Mask for transaction nodes
            
        Returns:
            Fraud probability for transaction nodes
        """
        # Embed node features
        node_type_emb = self.node_type_embedding(node_type)
        x = torch.cat([x, node_type_emb], dim=1)
        x = self.node_embedding(x)
        
        # Embed edge features
        edge_type_emb = self.edge_type_embedding(edge_type)
        edge_attr = torch.cat([edge_attr, edge_type_emb], dim=1)
        edge_attr = self.edge_embedding(edge_attr)
        
        # Apply GNN layers
        for i, conv in enumerate(self.convs):
            x = conv(x, edge_index, edge_attr)
            x = self.batch_norms[i](x)
            x = F.relu(x)
            x = F.dropout(x, p=self.dropout, training=self.training)
        
        # Apply transaction classifier to transaction nodes
        transaction_nodes = x[transaction_mask]
        fraud_logits = self.transaction_classifier(transaction_nodes).squeeze(-1)
        fraud_probs = torch.sigmoid(fraud_logits)
        
        return fraud_probs

class GNNService:
    """Service for graph neural network integration."""
    
    def __init__(self):
        """Initialize the GNN service."""
        self.model_path = config.gnn.model_path
        self.embedding_dim = config.gnn.embedding_dim
        self.hidden_dim = config.gnn.hidden_dim
        self.num_layers = config.gnn.num_layers
        self.dropout = config.gnn.dropout
        self.device = torch.device(config.gnn.device)
        self.batch_size = config.gnn.batch_size
        
        # Node and edge feature dimensions
        self.node_feature_dim = 64
        self.edge_feature_dim = 32
        
        # Node and edge type mappings
        self.node_type_map = {
            "Transaction": 0,
            "Customer": 1,
            "Account": 2,
            "Merchant": 3,
            "Device": 4,
            "Location": 5,
            "FraudAlert": 6,
            "Platform": 7,
            "Product": 8,
            "Agent": 9
        }
        
        self.edge_type_map = {
            "PERFORMED_BY": 0,
            "BELONGS_TO": 1,
            "AT_MERCHANT": 2,
            "FROM_DEVICE": 3,
            "AT_LOCATION": 4,
            "AFFECTS": 5,
            "HAS_DOCUMENT": 6,
            "HAS_ADDRESS": 7,
            "OWNS": 8,
            "PART_OF": 9
        }
        
        # Initialize model
        self.model = None
        self.model_metadata = None
        
        # Load model if exists
        self.load_model()
    
    def load_model(self) -> bool:
        """
        Load the GNN model from disk.
        
        Returns:
            True if model loaded successfully, False otherwise
        """
        try:
            # Check if model file exists
            if not os.path.exists(self.model_path):
                logger.warning(f"Model file not found: {self.model_path}")
                
                # Initialize new model
                self.model = FraudDetectionGNN(
                    node_feature_dim=self.node_feature_dim,
                    edge_feature_dim=self.edge_feature_dim,
                    embedding_dim=self.embedding_dim,
                    hidden_dim=self.hidden_dim,
                    num_layers=self.num_layers,
                    dropout=self.dropout
                )
                
                # Move model to device
                self.model = self.model.to(self.device)
                
                # Set model to evaluation mode
                self.model.eval()
                
                # Create model metadata
                self.model_metadata = AIModelMetadata(
                    model_id=str(uuid4()),
                    model_name="FraudDetectionGNN",
                    model_version="0.1.0",
                    model_type="graph_neural_network",
                    training_timestamp=datetime.utcnow(),
                    performance_metrics={
                        "accuracy": 0.0,
                        "precision": 0.0,
                        "recall": 0.0,
                        "f1_score": 0.0,
                        "auc": 0.0
                    },
                    hyperparameters={
                        "embedding_dim": self.embedding_dim,
                        "hidden_dim": self.hidden_dim,
                        "num_layers": self.num_layers,
                        "dropout": self.dropout
                    },
                    metadata={
                        "node_types": list(self.node_type_map.keys()),
                        "edge_types": list(self.edge_type_map.keys()),
                        "node_feature_dim": self.node_feature_dim,
                        "edge_feature_dim": self.edge_feature_dim
                    }
                )
                
                return False
            
            # Load model
            checkpoint = torch.load(self.model_path, map_location=self.device)
            
            # Extract model metadata
            self.model_metadata = AIModelMetadata(
                model_id=checkpoint.get("model_id", str(uuid4())),
                model_name=checkpoint.get("model_name", "FraudDetectionGNN"),
                model_version=checkpoint.get("model_version", "1.0.0"),
                model_type=checkpoint.get("model_type", "graph_neural_network"),
                training_timestamp=checkpoint.get("training_timestamp", datetime.utcnow()),
                last_evaluation_timestamp=checkpoint.get("last_evaluation_timestamp"),
                performance_metrics=checkpoint.get("performance_metrics", {}),
                feature_importance=checkpoint.get("feature_importance", {}),
                hyperparameters=checkpoint.get("hyperparameters", {}),
                metadata=checkpoint.get("metadata", {})
            )
            
            # Extract hyperparameters
            hyperparameters = self.model_metadata.hyperparameters
            self.embedding_dim = hyperparameters.get("embedding_dim", self.embedding_dim)
            self.hidden_dim = hyperparameters.get("hidden_dim", self.hidden_dim)
            self.num_layers = hyperparameters.get("num_layers", self.num_layers)
            self.dropout = hyperparameters.get("dropout", self.dropout)
            
            # Extract feature dimensions
            metadata = self.model_metadata.metadata
            self.node_feature_dim = metadata.get("node_feature_dim", self.node_feature_dim)
            self.edge_feature_dim = metadata.get("edge_feature_dim", self.edge_feature_dim)
            
            # Initialize model
            self.model = FraudDetectionGNN(
                node_feature_dim=self.node_feature_dim,
                edge_feature_dim=self.edge_feature_dim,
                embedding_dim=self.embedding_dim,
                hidden_dim=self.hidden_dim,
                num_layers=self.num_layers,
                dropout=self.dropout
            )
            
            # Load model state
            self.model.load_state_dict(checkpoint["model_state_dict"])
            
            # Move model to device
            self.model = self.model.to(self.device)
            
            # Set model to evaluation mode
            self.model.eval()
            
            logger.info(f"Model loaded from {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            
            # Initialize new model
            self.model = FraudDetectionGNN(
                node_feature_dim=self.node_feature_dim,
                edge_feature_dim=self.edge_feature_dim,
                embedding_dim=self.embedding_dim,
                hidden_dim=self.hidden_dim,
                num_layers=self.num_layers,
                dropout=self.dropout
            )
            
            # Move model to device
            self.model = self.model.to(self.device)
            
            # Set model to evaluation mode
            self.model.eval()
            
            # Create model metadata
            self.model_metadata = AIModelMetadata(
                model_id=str(uuid4()),
                model_name="FraudDetectionGNN",
                model_version="0.1.0",
                model_type="graph_neural_network",
                training_timestamp=datetime.utcnow(),
                performance_metrics={
                    "accuracy": 0.0,
                    "precision": 0.0,
                    "recall": 0.0,
                    "f1_score": 0.0,
                    "auc": 0.0
                },
                hyperparameters={
                    "embedding_dim": self.embedding_dim,
                    "hidden_dim": self.hidden_dim,
                    "num_layers": self.num_layers,
                    "dropout": self.dropout
                },
                metadata={
                    "node_types": list(self.node_type_map.keys()),
                    "edge_types": list(self.edge_type_map.keys()),
                    "node_feature_dim": self.node_feature_dim,
                    "edge_feature_dim": self.edge_feature_dim
                }
            )
            
            return False
    
    def save_model(self) -> bool:
        """
        Save the GNN model to disk.
        
        Returns:
            True if model saved successfully, False otherwise
        """
        try:
            # Create checkpoint
            checkpoint = {
                "model_state_dict": self.model.state_dict(),
                "model_id": self.model_metadata.model_id,
                "model_name": self.model_metadata.model_name,
                "model_version": self.model_metadata.model_version,
                "model_type": self.model_metadata.model_type,
                "training_timestamp": self.model_metadata.training_timestamp,
                "last_evaluation_timestamp": self.model_metadata.last_evaluation_timestamp,
                "performance_metrics": self.model_metadata.performance_metrics,
                "feature_importance": self.model_metadata.feature_importance,
                "hyperparameters": self.model_metadata.hyperparameters,
                "metadata": self.model_metadata.metadata
            }
            
            # Create directory if not exists
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            
            # Save model
            torch.save(checkpoint, self.model_path)
            
            logger.info(f"Model saved to {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            return False
    
    def graph_to_pyg_data(self, nodes: List[GraphNode], edges: List[GraphEdge]) -> Data:
        """
        Convert graph nodes and edges to PyTorch Geometric Data object.
        
        Args:
            nodes: List of graph nodes
            edges: List of graph edges
            
        Returns:
            PyTorch Geometric Data object
        """
        # Create node ID to index mapping
        node_id_to_idx = {node.node_id: i for i, node in enumerate(nodes)}
        
        # Extract node features
        x = []
        node_types = []
        transaction_mask = []
        
        for node in nodes:
            # Extract node features
            features = self.extract_node_features(node)
            x.append(features)
            
            # Extract node type
            node_type = self.node_type_map.get(node.node_type, 0)
            node_types.append(node_type)
            
            # Check if node is a transaction
            is_transaction = node.node_type == "Transaction"
            transaction_mask.append(is_transaction)
        
        # Convert to tensors
        x = torch.tensor(x, dtype=torch.float)
        node_types = torch.tensor(node_types, dtype=torch.long)
        transaction_mask = torch.tensor(transaction_mask, dtype=torch.bool)
        
        # Extract edge indices and features
        edge_index = []
        edge_attr = []
        edge_types = []
        
        for edge in edges:
            # Check if source and target nodes exist
            if edge.source_id not in node_id_to_idx or edge.target_id not in node_id_to_idx:
                continue
            
            # Extract source and target indices
            source_idx = node_id_to_idx[edge.source_id]
            target_idx = node_id_to_idx[edge.target_id]
            
            # Add edge indices
            edge_index.append([source_idx, target_idx])
            
            # Extract edge features
            features = self.extract_edge_features(edge)
            edge_attr.append(features)
            
            # Extract edge type
            edge_type = self.edge_type_map.get(edge.edge_type, 0)
            edge_types.append(edge_type)
        
        # Convert to tensors
        if edge_index:
            edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
            edge_attr = torch.tensor(edge_attr, dtype=torch.float)
            edge_types = torch.tensor(edge_types, dtype=torch.long)
        else:
            # Empty graph
            edge_index = torch.zeros((2, 0), dtype=torch.long)
            edge_attr = torch.zeros((0, self.edge_feature_dim), dtype=torch.float)
            edge_types = torch.zeros((0,), dtype=torch.long)
        
        # Create PyTorch Geometric Data object
        data = Data(
            x=x,
            edge_index=edge_index,
            edge_attr=edge_attr,
            node_type=node_types,
            edge_type=edge_types,
            transaction_mask=transaction_mask
        )
        
        return data
    
    def extract_node_features(self, node: GraphNode) -> List[float]:
        """
        Extract features from a graph node.
        
        Args:
            node: Graph node
            
        Returns:
            List of node features
        """
        # Initialize features with zeros
        features = [0.0] * self.node_feature_dim
        
        # Extract properties
        properties = node.properties
        
        # Extract common features
        features[0] = 1.0  # Bias term
        
        # Extract node type-specific features
        if node.node_type == "Transaction":
            # Transaction amount
            amount = float(properties.get("amount", 0.0))
            features[1] = min(amount / 10000.0, 1.0)  # Normalized amount
            
            # Transaction type
            transaction_type = properties.get("transaction_type", "")
            if transaction_type == "WITHDRAWAL":
                features[2] = 1.0
            elif transaction_type == "TRANSFER":
                features[3] = 1.0
            elif transaction_type == "PAYMENT":
                features[4] = 1.0
            elif transaction_type == "PURCHASE":
                features[5] = 1.0
            
            # Transaction status
            status = properties.get("status", "")
            if status == "APPROVED":
                features[6] = 1.0
            elif status == "DECLINED":
                features[7] = 1.0
            elif status == "PENDING":
                features[8] = 1.0
            
            # Transaction timestamp
            timestamp = properties.get("timestamp", None)
            if timestamp:
                if isinstance(timestamp, str):
                    try:
                        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                    except ValueError:
                        timestamp = datetime.utcnow()
                
                # Hour of day (normalized)
                hour = timestamp.hour
                features[9] = hour / 24.0
                
                # Day of week (normalized)
                day = timestamp.weekday()
                features[10] = day / 7.0
            
            # Is international
            is_international = properties.get("is_international", False)
            features[11] = 1.0 if is_international else 0.0
            
            # Is online
            is_online = properties.get("is_online", False)
            features[12] = 1.0 if is_online else 0.0
            
            # Is high risk
            is_high_risk = properties.get("is_high_risk", False)
            features[13] = 1.0 if is_high_risk else 0.0
        
        elif node.node_type == "Customer":
            # Customer risk score
            risk_score = float(properties.get("risk_score", 0.0))
            features[14] = min(risk_score / 100.0, 1.0)  # Normalized risk score
            
            # Customer segment
            segment = properties.get("segment", "")
            if segment == "MASS":
                features[15] = 1.0
            elif segment == "MASS_AFFLUENT":
                features[16] = 1.0
            elif segment == "AFFLUENT":
                features[17] = 1.0
            elif segment == "HIGH_NET_WORTH":
                features[18] = 1.0
            
            # Customer lifetime value
            lifetime_value = float(properties.get("lifetime_value", 0.0))
            features[19] = min(lifetime_value / 100000.0, 1.0)  # Normalized lifetime value
            
            # Customer status
            status = properties.get("status", "")
            if status == "active":
                features[20] = 1.0
            elif status == "inactive":
                features[21] = 1.0
            elif status == "suspended":
                features[22] = 1.0
            
            # Customer KYC status
            kyc_status = properties.get("kyc_status", "")
            if kyc_status == "COMPLETED":
                features[23] = 1.0
            elif kyc_status == "IN_PROGRESS":
                features[24] = 1.0
            elif kyc_status == "NOT_STARTED":
                features[25] = 1.0
        
        elif node.node_type == "Account":
            # Account balance
            balance = float(properties.get("balance", 0.0))
            features[26] = min(balance / 100000.0, 1.0)  # Normalized balance
            
            # Account type
            account_type = properties.get("account_type", "")
            if account_type == "SAVINGS":
                features[27] = 1.0
            elif account_type == "CURRENT":
                features[28] = 1.0
            elif account_type == "LOAN":
                features[29] = 1.0
            
            # Account status
            status = properties.get("status", "")
            if status == "active":
                features[30] = 1.0
            elif status == "inactive":
                features[31] = 1.0
            elif status == "blocked":
                features[32] = 1.0
            
            # Account age (days)
            created_at = properties.get("created_at", None)
            if created_at:
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    except ValueError:
                        created_at = datetime.utcnow()
                
                age_days = (datetime.utcnow() - created_at).days
                features[33] = min(age_days / 365.0, 1.0)  # Normalized age (max 1 year)
        
        elif node.node_type == "Merchant":
            # Merchant category
            category = properties.get("merchant_category", "")
            if category == "RETAIL":
                features[34] = 1.0
            elif category == "TRAVEL":
                features[35] = 1.0
            elif category == "FOOD":
                features[36] = 1.0
            elif category == "ENTERTAINMENT":
                features[37] = 1.0
            
            # Merchant risk score
            risk_score = float(properties.get("risk_score", 0.0))
            features[38] = min(risk_score / 100.0, 1.0)  # Normalized risk score
        
        elif node.node_type == "Device":
            # Device type
            device_type = properties.get("device_type", "")
            if device_type == "MOBILE":
                features[39] = 1.0
            elif device_type == "DESKTOP":
                features[40] = 1.0
            elif device_type == "TABLET":
                features[41] = 1.0
            
            # Device OS
            device_os = properties.get("device_os", "")
            if device_os == "ANDROID":
                features[42] = 1.0
            elif device_os == "IOS":
                features[43] = 1.0
            elif device_os == "WINDOWS":
                features[44] = 1.0
            
            # Device risk score
            risk_score = float(properties.get("risk_score", 0.0))
            features[45] = min(risk_score / 100.0, 1.0)  # Normalized risk score
        
        elif node.node_type == "Location":
            # Location type
            location_type = properties.get("location_type", "")
            if location_type == "HOME":
                features[46] = 1.0
            elif location_type == "WORK":
                features[47] = 1.0
            elif location_type == "OTHER":
                features[48] = 1.0
            
            # Location risk score
            risk_score = float(properties.get("risk_score", 0.0))
            features[49] = min(risk_score / 100.0, 1.0)  # Normalized risk score
        
        elif node.node_type == "FraudAlert":
            # Fraud type
            fraud_type = properties.get("fraud_type", "")
            if fraud_type == "ACCOUNT_TAKEOVER":
                features[50] = 1.0
            elif fraud_type == "IDENTITY_THEFT":
                features[51] = 1.0
            elif fraud_type == "CARD_FRAUD":
                features[52] = 1.0
            elif fraud_type == "TRANSACTION_FRAUD":
                features[53] = 1.0
            
            # Fraud risk score
            risk_score = float(properties.get("risk_score", 0.0))
            features[54] = min(risk_score / 100.0, 1.0)  # Normalized risk score
            
            # Fraud status
            status = properties.get("status", "")
            if status == "new":
                features[55] = 1.0
            elif status == "investigating":
                features[56] = 1.0
            elif status == "confirmed":
                features[57] = 1.0
            elif status == "cleared":
                features[58] = 1.0
        
        return features
    
    def extract_edge_features(self, edge: GraphEdge) -> List[float]:
        """
        Extract features from a graph edge.
        
        Args:
            edge: Graph edge
            
        Returns:
            List of edge features
        """
        # Initialize features with zeros
        features = [0.0] * self.edge_feature_dim
        
        # Extract properties
        properties = edge.properties
        
        # Extract common features
        features[0] = 1.0  # Bias term
        
        # Extract edge type-specific features
        if edge.edge_type == "PERFORMED_BY":
            features[1] = 1.0
        elif edge.edge_type == "BELONGS_TO":
            features[2] = 1.0
        elif edge.edge_type == "AT_MERCHANT":
            features[3] = 1.0
        elif edge.edge_type == "FROM_DEVICE":
            features[4] = 1.0
        elif edge.edge_type == "AT_LOCATION":
            features[5] = 1.0
        elif edge.edge_type == "AFFECTS":
            features[6] = 1.0
        
        # Extract timestamp
        created_at = properties.get("created_at", None)
        if created_at:
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                except ValueError:
                    created_at = datetime.utcnow()
            
            # Hour of day (normalized)
            hour = created_at.hour
            features[7] = hour / 24.0
            
            # Day of week (normalized)
            day = created_at.weekday()
            features[8] = day / 7.0
        
        # Extract weight
        weight = float(properties.get("weight", 1.0))
        features[9] = min(weight, 1.0)  # Normalized weight
        
        return features
    
    def predict_fraud(self, data: Data) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Predict fraud probability for transaction nodes in a graph.
        
        Args:
            data: PyTorch Geometric Data object
            
        Returns:
            Tuple of (fraud probabilities, transaction mask)
        """
        # Move data to device
        data = data.to(self.device)
        
        # Set model to evaluation mode
        self.model.eval()
        
        # Predict fraud probability
        with torch.no_grad():
            fraud_probs = self.model(
                data.x,
                data.edge_index,
                data.edge_attr,
                data.node_type,
                data.edge_type,
                data.transaction_mask
            )
        
        return fraud_probs, data.transaction_mask
    
    def predict_fraud_batch(self, batch: Batch) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Predict fraud probability for transaction nodes in a batch of graphs.
        
        Args:
            batch: PyTorch Geometric Batch object
            
        Returns:
            Tuple of (fraud probabilities, transaction mask)
        """
        # Move batch to device
        batch = batch.to(self.device)
        
        # Set model to evaluation mode
        self.model.eval()
        
        # Predict fraud probability
        with torch.no_grad():
            fraud_probs = self.model(
                batch.x,
                batch.edge_index,
                batch.edge_attr,
                batch.node_type,
                batch.edge_type,
                batch.transaction_mask
            )
        
        return fraud_probs, batch.transaction_mask
    
    def predict_transaction_fraud(self, transaction_subgraph: GraphQueryResult) -> List[AIModelPrediction]:
        """
        Predict fraud probability for transactions in a subgraph.
        
        Args:
            transaction_subgraph: Transaction subgraph
            
        Returns:
            List of AI model predictions
        """
        # Convert graph to PyTorch Geometric Data object
        data = self.graph_to_pyg_data(transaction_subgraph.nodes, transaction_subgraph.edges)
        
        # Predict fraud probability
        fraud_probs, transaction_mask = self.predict_fraud(data)
        
        # Create predictions
        predictions = []
        
        # Extract transaction nodes
        transaction_nodes = [node for node in transaction_subgraph.nodes if node.node_type == "Transaction"]
        
        # Map predictions to transaction nodes
        transaction_idx = 0
        for i, is_transaction in enumerate(transaction_mask.cpu().numpy()):
            if is_transaction:
                # Get transaction node
                if transaction_idx < len(transaction_nodes):
                    transaction_node = transaction_nodes[transaction_idx]
                    
                    # Get fraud probability
                    fraud_prob = fraud_probs[transaction_idx].item()
                    
                    # Create prediction
                    prediction = AIModelPrediction(
                        prediction_id=str(uuid4()),
                        model_id=self.model_metadata.model_id,
                        entity_id=transaction_node.node_id,
                        entity_type="Transaction",
                        prediction_type="fraud_probability",
                        prediction_value=fraud_prob > 0.5,
                        prediction_probability=fraud_prob,
                        prediction_timestamp=datetime.utcnow(),
                        features={},
                        explanation=None,
                        metadata={
                            "transaction_id": transaction_node.node_id,
                            "transaction_type": transaction_node.properties.get("transaction_type"),
                            "amount": transaction_node.properties.get("amount"),
                            "currency": transaction_node.properties.get("currency"),
                            "timestamp": transaction_node.properties.get("timestamp")
                        }
                    )
                    
                    predictions.append(prediction)
                
                transaction_idx += 1
        
        return predictions
    
    def predict_batch_transaction_fraud(self, transaction_subgraphs: List[GraphQueryResult]) -> List[AIModelPrediction]:
        """
        Predict fraud probability for transactions in multiple subgraphs.
        
        Args:
            transaction_subgraphs: List of transaction subgraphs
            
        Returns:
            List of AI model predictions
        """
        # Convert graphs to PyTorch Geometric Data objects
        data_list = []
        for subgraph in transaction_subgraphs:
            data = self.graph_to_pyg_data(subgraph.nodes, subgraph.edges)
            data_list.append(data)
        
        # Create batch
        batch = Batch.from_data_list(data_list)
        
        # Predict fraud probability
        fraud_probs, transaction_mask = self.predict_fraud_batch(batch)
        
        # Create predictions
        predictions = []
        
        # Extract transaction nodes from each subgraph
        all_transaction_nodes = []
        for subgraph in transaction_subgraphs:
            transaction_nodes = [node for node in subgraph.nodes if node.node_type == "Transaction"]
            all_transaction_nodes.extend(transaction_nodes)
        
        # Map predictions to transaction nodes
        transaction_idx = 0
        for i, is_transaction in enumerate(transaction_mask.cpu().numpy()):
            if is_transaction:
                # Get transaction node
                if transaction_idx < len(all_transaction_nodes):
                    transaction_node = all_transaction_nodes[transaction_idx]
                    
                    # Get fraud probability
                    fraud_prob = fraud_probs[transaction_idx].item()
                    
                    # Create prediction
                    prediction = AIModelPrediction(
                        prediction_id=str(uuid4()),
                        model_id=self.model_metadata.model_id,
                        entity_id=transaction_node.node_id,
                        entity_type="Transaction",
                        prediction_type="fraud_probability",
                        prediction_value=fraud_prob > 0.5,
                        prediction_probability=fraud_prob,
                        prediction_timestamp=datetime.utcnow(),
                        features={},
                        explanation=None,
                        metadata={
                            "transaction_id": transaction_node.node_id,
                            "transaction_type": transaction_node.properties.get("transaction_type"),
                            "amount": transaction_node.properties.get("amount"),
                            "currency": transaction_node.properties.get("currency"),
                            "timestamp": transaction_node.properties.get("timestamp")
                        }
                    )
                    
                    predictions.append(prediction)
                
                transaction_idx += 1
        
        return predictions
    
    def get_model_metadata(self) -> AIModelMetadata:
        """
        Get the GNN model metadata.
        
        Returns:
            AI model metadata
        """
        return self.model_metadata

