#!/usr/bin/env python3
"""
Fraud GNN Training Pipeline with Lakehouse Integration
Trains fraud detection models using data from Delta Lake
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data, DataLoader
from torch_geometric.nn import GATConv, global_mean_pool
from pyspark.sql import SparkSession
from delta import *
import ray
from ray import tune
from ray.air import session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FraudGNN(nn.Module):
    """
    Graph Attention Network for Fraud Detection
    
    This model uses Graph Attention Networks to learn patterns in transaction networks
    and identify fraudulent transactions.
    """
    
    def __init__(
        self,
        num_node_features: int,
        hidden_channels: int = 128,
        num_heads: int = 4,
        dropout: float = 0.3
    ):
        super(FraudGNN, self).__init__()
        
        # First GAT layer
        self.conv1 = GATConv(
            num_node_features,
            hidden_channels,
            heads=num_heads,
            dropout=dropout
        )
        
        # Second GAT layer
        self.conv2 = GATConv(
            hidden_channels * num_heads,
            hidden_channels,
            heads=num_heads,
            dropout=dropout
        )
        
        # Third GAT layer
        self.conv3 = GATConv(
            hidden_channels * num_heads,
            hidden_channels,
            heads=1,
            dropout=dropout
        )
        
        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_channels, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 2)  # Binary classification: fraud or not
        )
        
    def forward(self, x, edge_index, batch=None):
        # First GAT layer
        x = self.conv1(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=0.3, training=self.training)
        
        # Second GAT layer
        x = self.conv2(x, edge_index)
        x = F.elu(x)
        x = F.dropout(x, p=0.3, training=self.training)
        
        # Third GAT layer
        x = self.conv3(x, edge_index)
        x = F.elu(x)
        
        # Global pooling (if batch is provided)
        if batch is not None:
            x = global_mean_pool(x, batch)
        
        # Classification
        x = self.classifier(x)
        
        return F.log_softmax(x, dim=1)


class FraudGNNTrainingPipeline:
    """
    Training pipeline for Fraud GNN models
    
    This pipeline reads training data from Delta Lake, constructs transaction graphs,
    trains the GNN model, and saves the trained model back to the Lakehouse.
    """
    
    def __init__(
        self,
        delta_lake_path: str,
        s3_endpoint: str,
        s3_access_key: str,
        s3_secret_key: str,
        model_output_path: str,
        use_ray: bool = True
    ):
        self.delta_lake_path = delta_lake_path
        self.s3_endpoint = s3_endpoint
        self.s3_access_key = s3_access_key
        self.s3_secret_key = s3_secret_key
        self.model_output_path = model_output_path
        self.use_ray = use_ray
        
        # Initialize Spark session
        self.spark = self._create_spark_session()
        
        # Initialize Ray if enabled
        if self.use_ray:
            if not ray.is_initialized():
                ray.init()
    
    def _create_spark_session(self) -> SparkSession:
        """Create a Spark session configured for Delta Lake"""
        builder = (
            SparkSession.builder
            .appName("Fraud GNN Training Pipeline")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint)
            .config("spark.hadoop.fs.s3a.access.key", self.s3_access_key)
            .config("spark.hadoop.fs.s3a.secret.key", self.s3_secret_key)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        )
        
        return configure_spark_with_delta_pip(builder).getOrCreate()
    
    def load_training_data(self, lookback_days: int = 30) -> pd.DataFrame:
        """Load training data from Delta Lake"""
        logger.info(f"Loading training data from Delta Lake (last {lookback_days} days)...")
        
        # Calculate the date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)
        
        # Read transactions from Delta Lake
        transactions_df = (
            self.spark.read
            .format("delta")
            .load(f"{self.delta_lake_path}/transactions")
            .filter(f"created_at >= '{start_date.isoformat()}' AND created_at <= '{end_date.isoformat()}'")
        )
        
        # Read fraud labels (if available)
        fraud_labels_df = (
            self.spark.read
            .format("delta")
            .load(f"{self.delta_lake_path}/fraud_labels")
            .filter(f"labeled_at >= '{start_date.isoformat()}'")
        )
        
        # Join transactions with fraud labels
        training_df = transactions_df.join(
            fraud_labels_df,
            transactions_df.transaction_id == fraud_labels_df.transaction_id,
            "left"
        )
        
        # Convert to Pandas for easier manipulation
        pandas_df = training_df.toPandas()
        
        logger.info(f"Loaded {len(pandas_df)} transactions")
        
        return pandas_df
    
    def construct_transaction_graph(self, df: pd.DataFrame) -> Data:
        """Construct a transaction graph from the DataFrame"""
        logger.info("Constructing transaction graph...")
        
        # Create node features
        # Each node represents an account
        account_ids = pd.concat([df['debit_account_id'], df['credit_account_id']]).unique()
        account_to_idx = {acc_id: idx for idx, acc_id in enumerate(account_ids)}
        
        # Node features: [total_debits, total_credits, num_transactions, avg_amount]
        node_features = []
        for acc_id in account_ids:
            debits = df[df['debit_account_id'] == acc_id]['amount'].sum()
            credits = df[df['credit_account_id'] == acc_id]['amount'].sum()
            num_txns = len(df[(df['debit_account_id'] == acc_id) | (df['credit_account_id'] == acc_id)])
            avg_amount = df[(df['debit_account_id'] == acc_id) | (df['credit_account_id'] == acc_id)]['amount'].mean()
            
            node_features.append([debits, credits, num_txns, avg_amount])
        
        x = torch.tensor(node_features, dtype=torch.float)
        
        # Create edges
        # Each transaction creates an edge from debit_account to credit_account
        edge_index = []
        edge_labels = []
        
        for _, row in df.iterrows():
            debit_idx = account_to_idx[row['debit_account_id']]
            credit_idx = account_to_idx[row['credit_account_id']]
            
            edge_index.append([debit_idx, credit_idx])
            
            # Edge label: 1 if fraud, 0 otherwise
            is_fraud = row.get('is_fraud', 0)
            edge_labels.append(is_fraud)
        
        edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        y = torch.tensor(edge_labels, dtype=torch.long)
        
        # Create PyTorch Geometric Data object
        data = Data(x=x, edge_index=edge_index, y=y)
        
        logger.info(f"Graph constructed: {data.num_nodes} nodes, {data.num_edges} edges")
        
        return data
    
    def train_model(
        self,
        data: Data,
        num_epochs: int = 100,
        learning_rate: float = 0.001,
        batch_size: int = 32
    ) -> FraudGNN:
        """Train the Fraud GNN model"""
        logger.info("Training Fraud GNN model...")
        
        # Create model
        model = FraudGNN(
            num_node_features=data.num_node_features,
            hidden_channels=128,
            num_heads=4,
            dropout=0.3
        )
        
        # Move to GPU if available
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = model.to(device)
        data = data.to(device)
        
        # Define optimizer and loss function
        optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
        criterion = nn.NLLLoss()
        
        # Training loop
        model.train()
        for epoch in range(num_epochs):
            optimizer.zero_grad()
            
            # Forward pass
            out = model(data.x, data.edge_index)
            
            # Calculate loss
            loss = criterion(out, data.y)
            
            # Backward pass
            loss.backward()
            optimizer.step()
            
            # Log progress
            if (epoch + 1) % 10 == 0:
                logger.info(f"Epoch {epoch + 1}/{num_epochs}, Loss: {loss.item():.4f}")
        
        logger.info("Training completed")
        
        return model
    
    def evaluate_model(self, model: FraudGNN, data: Data) -> Dict[str, float]:
        """Evaluate the trained model"""
        logger.info("Evaluating model...")
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = model.to(device)
        data = data.to(device)
        
        model.eval()
        with torch.no_grad():
            out = model(data.x, data.edge_index)
            pred = out.argmax(dim=1)
            
            # Calculate metrics
            correct = (pred == data.y).sum().item()
            accuracy = correct / data.num_edges
            
            # Calculate precision, recall, F1
            true_positives = ((pred == 1) & (data.y == 1)).sum().item()
            false_positives = ((pred == 1) & (data.y == 0)).sum().item()
            false_negatives = ((pred == 0) & (data.y == 1)).sum().item()
            
            precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
            recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        metrics = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1
        }
        
        logger.info(f"Evaluation metrics: {metrics}")
        
        return metrics
    
    def save_model(self, model: FraudGNN, metrics: Dict[str, float]):
        """Save the trained model to the Lakehouse"""
        logger.info("Saving model...")
        
        # Save model weights
        model_path = f"{self.model_output_path}/fraud_gnn_model.pth"
        torch.save(model.state_dict(), model_path)
        
        # Save metadata
        metadata = {
            'model_type': 'FraudGNN',
            'trained_at': datetime.now().isoformat(),
            'metrics': metrics,
            'model_path': model_path
        }
        
        # Save metadata to Delta Lake
        metadata_df = self.spark.createDataFrame([metadata])
        metadata_df.write.format("delta").mode("append").save(f"{self.delta_lake_path}/model_metadata")
        
        logger.info(f"Model saved to {model_path}")
    
    def publish_scores_to_kafka(self, model: FraudGNN, data: Data):
        """Publish fraud scores to Kafka for real-time use"""
        logger.info("Publishing fraud scores to Kafka...")
        
        from kafka import KafkaProducer
        import json
        
        # Initialize Kafka producer
        producer = KafkaProducer(
            bootstrap_servers=os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092'),
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = model.to(device)
        data = data.to(device)
        
        model.eval()
        with torch.no_grad():
            out = model(data.x, data.edge_index)
            scores = F.softmax(out, dim=1)[:, 1].cpu().numpy()  # Probability of fraud
            
            # Publish scores
            for i, score in enumerate(scores):
                event = {
                    'edge_index': i,
                    'fraud_score': float(score),
                    'timestamp': datetime.now().isoformat()
                }
                producer.send('fraud.scores', value=event)
        
        producer.flush()
        producer.close()
        
        logger.info("Fraud scores published to Kafka")
    
    def run(self):
        """Run the complete training pipeline"""
        logger.info("Starting Fraud GNN Training Pipeline...")
        
        # Load training data from Delta Lake
        df = self.load_training_data(lookback_days=30)
        
        # Construct transaction graph
        data = self.construct_transaction_graph(df)
        
        # Train model
        model = self.train_model(data, num_epochs=100)
        
        # Evaluate model
        metrics = self.evaluate_model(model, data)
        
        # Save model to Lakehouse
        self.save_model(model, metrics)
        
        # Publish scores to Kafka
        self.publish_scores_to_kafka(model, data)
        
        logger.info("Fraud GNN Training Pipeline completed")


def main():
    """Main entry point"""
    # Configuration from environment variables
    delta_lake_path = os.getenv('DELTA_LAKE_PATH', 's3a://lakehouse/delta')
    s3_endpoint = os.getenv('S3_ENDPOINT', 'http://rustfs.lakehouse:9000')
    s3_access_key = os.getenv('S3_ACCESS_KEY', 'minioadmin')
    s3_secret_key = os.getenv('S3_SECRET_KEY', 'minioadmin')
    model_output_path = os.getenv('MODEL_OUTPUT_PATH', 's3a://lakehouse/models')
    
    # Create and run the training pipeline
    pipeline = FraudGNNTrainingPipeline(
        delta_lake_path=delta_lake_path,
        s3_endpoint=s3_endpoint,
        s3_access_key=s3_access_key,
        s3_secret_key=s3_secret_key,
        model_output_path=model_output_path,
        use_ray=True
    )
    
    pipeline.run()


if __name__ == '__main__':
    main()
