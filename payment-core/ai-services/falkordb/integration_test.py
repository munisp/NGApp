#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import unittest
import os
import sys
import time
import json
import numpy as np
import torch
from torch_geometric.data import Data
import redis
import requests
from concurrent.futures import ThreadPoolExecutor

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from python.ai_integration.services.falkordb_service import FalkorDBService
from python.ai_integration.services.gnn_service import GNNService
from python.ai_integration.models.base_models import Transaction, Customer, FraudAlert

class TestFalkorDBGNNIntegration(unittest.TestCase):
    """Integration tests for FalkorDB and GNN services."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        # Configuration
        cls.falkordb_config = {
            'host': os.environ.get('FALKORDB_HOST', 'localhost'),
            'port': int(os.environ.get('FALKORDB_PORT', 6379)),
            'password': os.environ.get('FALKORDB_PASSWORD', ''),
            'db': int(os.environ.get('FALKORDB_DB', 0)),
            'timeout': float(os.environ.get('FALKORDB_TIMEOUT', 5.0)),
            'pool_size': int(os.environ.get('FALKORDB_POOL_SIZE', 10))
        }
        
        cls.gnn_config = {
            'model_path': os.environ.get('GNN_MODEL_PATH', 'models/fraud_detection_gnn.pt'),
            'embedding_dim': int(os.environ.get('GNN_EMBEDDING_DIM', 128)),
            'hidden_dim': int(os.environ.get('GNN_HIDDEN_DIM', 256)),
            'num_layers': int(os.environ.get('GNN_NUM_LAYERS', 3)),
            'dropout': float(os.environ.get('GNN_DROPOUT', 0.2)),
            'device': os.environ.get('GNN_DEVICE', 'cpu'),
            'max_hops': int(os.environ.get('GNN_MAX_HOPS', 2)),
            'batch_size': int(os.environ.get('GNN_BATCH_SIZE', 32)),
            'threshold': float(os.environ.get('GNN_THRESHOLD', 0.5))
        }
        
        # Initialize services
        cls.falkordb_service = FalkorDBService(cls.falkordb_config)
        cls.gnn_service = GNNService(cls.gnn_config)
        
        # Clear test data
        cls.falkordb_service.clear_test_data()
        
        # Create test data
        cls.create_test_data()
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after tests."""
        cls.falkordb_service.clear_test_data()
    
    @classmethod
    def create_test_data(cls):
        """Create test data in FalkorDB."""
        # Create customers
        cls.customers = []
        for i in range(10):
            customer = Customer(
                id=f"test-customer-{i}",
                first_name=f"First{i}",
                last_name=f"Last{i}",
                email=f"customer{i}@example.com",
                phone=f"+234123456789{i}",
                risk_score=0.1 * i
            )
            cls.falkordb_service.create_customer(customer)
            cls.customers.append(customer)
        
        # Create legitimate transactions
        cls.legitimate_transactions = []
        for i in range(50):
            customer_idx = i % 10
            transaction = Transaction(
                id=f"test-legitimate-tx-{i}",
                customer_id=cls.customers[customer_idx].id,
                amount=100.0 + (i * 10),
                currency="NGN",
                type="TRANSFER" if i % 3 == 0 else "PURCHASE" if i % 3 == 1 else "WITHDRAWAL",
                status="COMPLETED",
                timestamp=int(time.time()) - (i * 3600),
                channel="MOBILE" if i % 2 == 0 else "WEB",
                merchant_id=f"merchant-{i % 5}" if i % 3 == 1 else None,
                location={
                    "latitude": 6.5244 + (i * 0.01) % 0.5,
                    "longitude": 3.3792 + (i * 0.01) % 0.5
                },
                device_id=f"device-{customer_idx}-{i % 3}",
                ip_address=f"192.168.1.{i % 256}",
                is_international=False,
                is_high_risk=False
            )
            cls.falkordb_service.create_transaction(transaction)
            cls.legitimate_transactions.append(transaction)
        
        # Create fraudulent transactions
        cls.fraudulent_transactions = []
        for i in range(10):
            customer_idx = i % 5
            transaction = Transaction(
                id=f"test-fraud-tx-{i}",
                customer_id=cls.customers[customer_idx].id,
                amount=5000.0 + (i * 1000),
                currency="USD",
                type="PURCHASE",
                status="COMPLETED",
                timestamp=int(time.time()) - (i * 600),
                channel="WEB",
                merchant_id=f"suspicious-merchant-{i}",
                location={
                    "latitude": 40.7128 + (i * 0.01) % 0.5,  # New York (far from Nigeria)
                    "longitude": -74.0060 + (i * 0.01) % 0.5
                },
                device_id=f"new-device-{i}",
                ip_address=f"10.0.0.{i}",
                is_international=True,
                is_high_risk=True
            )
            cls.falkordb_service.create_transaction(transaction)
            cls.fraudulent_transactions.append(transaction)
            
            # Create fraud alert for this transaction
            alert = FraudAlert(
                id=f"test-fraud-alert-{i}",
                customer_id=cls.customers[customer_idx].id,
                transaction_id=transaction.id,
                type="SUSPICIOUS_TRANSACTION",
                severity="HIGH",
                score=0.85 + (i * 0.01),
                timestamp=transaction.timestamp + 60,
                status="OPEN",
                description="Unusual transaction pattern detected"
            )
            cls.falkordb_service.create_fraud_alert(alert)
    
    def test_extract_transaction_subgraph(self):
        """Test extracting transaction subgraph from FalkorDB."""
        # Get a legitimate transaction
        transaction_id = self.legitimate_transactions[0].id
        
        # Extract subgraph
        subgraph = self.falkordb_service.extract_transaction_subgraph(transaction_id, max_hops=2)
        
        # Verify subgraph structure
        self.assertIsNotNone(subgraph)
        self.assertIn('nodes', subgraph)
        self.assertIn('edges', subgraph)
        self.assertIn('node_features', subgraph)
        self.assertIn('edge_features', subgraph)
        
        # Verify transaction node exists
        transaction_node_found = False
        for node in subgraph['nodes']:
            if node['id'] == transaction_id and node['type'] == 'Transaction':
                transaction_node_found = True
                break
        self.assertTrue(transaction_node_found, "Transaction node not found in subgraph")
        
        # Verify customer node exists
        customer_id = self.legitimate_transactions[0].customer_id
        customer_node_found = False
        for node in subgraph['nodes']:
            if node['id'] == customer_id and node['type'] == 'Customer':
                customer_node_found = True
                break
        self.assertTrue(customer_node_found, "Customer node not found in subgraph")
        
        # Verify edge between customer and transaction
        edge_found = False
        for edge in subgraph['edges']:
            if (edge['source'] == customer_id and edge['target'] == transaction_id and 
                edge['type'] == 'PERFORMED'):
                edge_found = True
                break
        self.assertTrue(edge_found, "Edge between customer and transaction not found")
    
    def test_convert_subgraph_to_pytorch_geometric(self):
        """Test converting FalkorDB subgraph to PyTorch Geometric format."""
        # Get a fraudulent transaction
        transaction_id = self.fraudulent_transactions[0].id
        
        # Extract subgraph
        subgraph = self.falkordb_service.extract_transaction_subgraph(transaction_id, max_hops=2)
        
        # Convert to PyTorch Geometric
        pyg_data = self.gnn_service.convert_subgraph_to_pytorch_geometric(subgraph)
        
        # Verify PyTorch Geometric data
        self.assertIsInstance(pyg_data, Data)
        self.assertIsNotNone(pyg_data.x)  # Node features
        self.assertIsNotNone(pyg_data.edge_index)  # Edge indices
        self.assertIsNotNone(pyg_data.edge_attr)  # Edge features
        
        # Check dimensions
        self.assertEqual(pyg_data.x.shape[0], len(subgraph['nodes']))
        self.assertEqual(pyg_data.edge_index.shape[1], len(subgraph['edges']))
        
        # Check data types
        self.assertEqual(pyg_data.x.dtype, torch.float32)
        self.assertEqual(pyg_data.edge_index.dtype, torch.long)
        self.assertEqual(pyg_data.edge_attr.dtype, torch.float32)
    
    def test_fraud_detection_inference(self):
        """Test fraud detection inference with GNN."""
        # Test with legitimate transaction
        legitimate_tx_id = self.legitimate_transactions[5].id
        legitimate_subgraph = self.falkordb_service.extract_transaction_subgraph(legitimate_tx_id, max_hops=2)
        legitimate_pyg_data = self.gnn_service.convert_subgraph_to_pytorch_geometric(legitimate_subgraph)
        
        legitimate_score = self.gnn_service.predict_fraud_probability(legitimate_pyg_data)
        self.assertIsInstance(legitimate_score, float)
        self.assertGreaterEqual(legitimate_score, 0.0)
        self.assertLessEqual(legitimate_score, 1.0)
        
        # Test with fraudulent transaction
        fraud_tx_id = self.fraudulent_transactions[0].id
        fraud_subgraph = self.falkordb_service.extract_transaction_subgraph(fraud_tx_id, max_hops=2)
        fraud_pyg_data = self.gnn_service.convert_subgraph_to_pytorch_geometric(fraud_subgraph)
        
        fraud_score = self.gnn_service.predict_fraud_probability(fraud_pyg_data)
        self.assertIsInstance(fraud_score, float)
        self.assertGreaterEqual(fraud_score, 0.0)
        self.assertLessEqual(fraud_score, 1.0)
        
        # Fraudulent transaction should have higher score than legitimate
        self.assertGreater(fraud_score, legitimate_score)
    
    def test_batch_fraud_detection(self):
        """Test batch fraud detection."""
        # Get transaction IDs
        transaction_ids = [tx.id for tx in self.legitimate_transactions[:5] + self.fraudulent_transactions[:5]]
        
        # Run batch fraud detection
        results = self.gnn_service.batch_predict_fraud(transaction_ids, self.falkordb_service)
        
        # Verify results
        self.assertEqual(len(results), len(transaction_ids))
        for tx_id, score in results.items():
            self.assertIn(tx_id, transaction_ids)
            self.assertIsInstance(score, float)
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)
        
        # Check that fraudulent transactions have higher scores
        legitimate_scores = [results[tx.id] for tx in self.legitimate_transactions[:5]]
        fraud_scores = [results[tx.id] for tx in self.fraudulent_transactions[:5]]
        
        avg_legitimate = sum(legitimate_scores) / len(legitimate_scores)
        avg_fraud = sum(fraud_scores) / len(fraud_scores)
        
        self.assertGreater(avg_fraud, avg_legitimate)
    
    def test_update_risk_scores(self):
        """Test updating customer risk scores based on transaction patterns."""
        # Get customer IDs
        customer_ids = [customer.id for customer in self.customers[:5]]
        
        # Initial risk scores
        initial_scores = {}
        for customer_id in customer_ids:
            customer = self.falkordb_service.get_customer(customer_id)
            initial_scores[customer_id] = customer.risk_score
        
        # Update risk scores
        self.gnn_service.update_customer_risk_scores(customer_ids, self.falkordb_service)
        
        # Get updated risk scores
        updated_scores = {}
        for customer_id in customer_ids:
            customer = self.falkordb_service.get_customer(customer_id)
            updated_scores[customer_id] = customer.risk_score
        
        # Verify risk scores were updated
        for customer_id in customer_ids:
            self.assertNotEqual(updated_scores[customer_id], initial_scores[customer_id])
    
    def test_parallel_subgraph_extraction(self):
        """Test parallel subgraph extraction."""
        # Get transaction IDs
        transaction_ids = [tx.id for tx in self.legitimate_transactions[:10]]
        
        # Extract subgraphs in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [
                executor.submit(self.falkordb_service.extract_transaction_subgraph, tx_id, 2)
                for tx_id in transaction_ids
            ]
            subgraphs = [future.result() for future in futures]
        
        # Verify subgraphs
        self.assertEqual(len(subgraphs), len(transaction_ids))
        for subgraph, tx_id in zip(subgraphs, transaction_ids):
            self.assertIsNotNone(subgraph)
            self.assertIn('nodes', subgraph)
            self.assertIn('edges', subgraph)
            
            # Verify transaction node exists
            transaction_node_found = False
            for node in subgraph['nodes']:
                if node['id'] == tx_id and node['type'] == 'Transaction':
                    transaction_node_found = True
                    break
            self.assertTrue(transaction_node_found, f"Transaction node {tx_id} not found in subgraph")
    
    def test_save_and_load_embeddings(self):
        """Test saving and loading node embeddings."""
        # Get a transaction ID
        transaction_id = self.legitimate_transactions[0].id
        
        # Extract subgraph
        subgraph = self.falkordb_service.extract_transaction_subgraph(transaction_id, max_hops=2)
        
        # Generate embeddings
        embeddings = {}
        for i, node in enumerate(subgraph['nodes']):
            embeddings[node['id']] = np.random.rand(128).astype(np.float32)
        
        # Save embeddings
        self.falkordb_service.save_node_embeddings(embeddings)
        
        # Load embeddings
        loaded_embeddings = self.falkordb_service.load_node_embeddings(list(embeddings.keys()))
        
        # Verify embeddings
        self.assertEqual(len(loaded_embeddings), len(embeddings))
        for node_id, embedding in embeddings.items():
            self.assertIn(node_id, loaded_embeddings)
            np.testing.assert_array_almost_equal(loaded_embeddings[node_id], embedding)
    
    def test_fraud_pattern_detection(self):
        """Test fraud pattern detection."""
        # Create a new customer with suspicious pattern
        suspicious_customer = Customer(
            id="test-suspicious-customer",
            first_name="Suspicious",
            last_name="User",
            email="suspicious@example.com",
            phone="+2341234567899",
            risk_score=0.2
        )
        self.falkordb_service.create_customer(suspicious_customer)
        
        # Create a pattern of suspicious transactions
        suspicious_transactions = []
        base_time = int(time.time())
        
        # First, create some normal transactions
        for i in range(3):
            tx = Transaction(
                id=f"test-suspicious-normal-tx-{i}",
                customer_id=suspicious_customer.id,
                amount=100.0 + (i * 10),
                currency="NGN",
                type="PURCHASE",
                status="COMPLETED",
                timestamp=base_time - (i * 86400),  # One day apart
                channel="MOBILE",
                merchant_id=f"merchant-{i % 5}",
                location={
                    "latitude": 6.5244 + (i * 0.01),
                    "longitude": 3.3792 + (i * 0.01)
                },
                device_id="device-normal",
                ip_address=f"192.168.1.{i}",
                is_international=False,
                is_high_risk=False
            )
            self.falkordb_service.create_transaction(tx)
            suspicious_transactions.append(tx)
        
        # Then create a burst of international transactions
        for i in range(5):
            tx = Transaction(
                id=f"test-suspicious-burst-tx-{i}",
                customer_id=suspicious_customer.id,
                amount=1000.0 + (i * 500),
                currency="USD",
                type="PURCHASE",
                status="COMPLETED",
                timestamp=base_time + (i * 300),  # 5 minutes apart
                channel="WEB",
                merchant_id=f"international-merchant-{i}",
                location={
                    "latitude": 40.7128 + (i * 0.01),  # New York
                    "longitude": -74.0060 + (i * 0.01)
                },
                device_id="device-new",
                ip_address=f"10.0.0.{i}",
                is_international=True,
                is_high_risk=False
            )
            self.falkordb_service.create_transaction(tx)
            suspicious_transactions.append(tx)
        
        # Run fraud pattern detection
        patterns = self.gnn_service.detect_fraud_patterns(suspicious_customer.id, self.falkordb_service)
        
        # Verify patterns
        self.assertIsNotNone(patterns)
        self.assertGreaterEqual(len(patterns), 1)
        
        # Check if burst pattern was detected
        burst_pattern_found = False
        for pattern in patterns:
            if pattern['type'] == 'TRANSACTION_BURST' and pattern['confidence'] > 0.7:
                burst_pattern_found = True
                break
        
        self.assertTrue(burst_pattern_found, "Transaction burst pattern not detected")
        
        # Clean up
        for tx in suspicious_transactions:
            self.falkordb_service.delete_transaction(tx.id)
        self.falkordb_service.delete_customer(suspicious_customer.id)


if __name__ == '__main__':
    unittest.main()

