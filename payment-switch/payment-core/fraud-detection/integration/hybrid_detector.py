"""
Hybrid Fraud Detection System

This module integrates rule-based detection with ML/DL/GNN models
to provide a comprehensive fraud detection solution.
"""

import torch
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

# Import components
import sys
sys.path.append('..')
from rule_engine.fraud_rules import RuleEngine, RuleAction, RuleSeverity
from ml_models.traditional_ml import FraudDetectionPipeline
from gnn_models.transaction_gnn import create_fraud_detector


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DetectionMode(Enum):
    """Detection modes for the hybrid system."""
    RULES_ONLY = "rules_only"
    ML_ONLY = "ml_only"
    GNN_ONLY = "gnn_only"
    HIERARCHICAL = "hierarchical"  # Rules → ML → GNN
    PARALLEL = "parallel"  # All run simultaneously
    ENSEMBLE = "ensemble"  # Weighted combination


@dataclass
class FraudDetectionResult:
    """Result of fraud detection."""
    transaction_id: str
    final_action: RuleAction
    final_score: float
    confidence: float
    rule_score: float
    ml_score: float
    gnn_score: float
    triggered_rules: List[str]
    explanation: str
    metadata: Dict[str, Any]
    processing_time_ms: float


class HybridFraudDetector:
    """
    Hybrid fraud detector combining rules, ML, and GNN models.
    """
    
    def __init__(
        self,
        rule_engine: RuleEngine,
        ml_model: Optional[FraudDetectionPipeline] = None,
        gnn_model: Optional[torch.nn.Module] = None,
        mode: DetectionMode = DetectionMode.HIERARCHICAL,
        weights: Optional[Dict[str, float]] = None,
        device: str = 'cpu'
    ):
        self.rule_engine = rule_engine
        self.ml_model = ml_model
        self.gnn_model = gnn_model
        self.mode = mode
        self.device = device
        
        # Default weights for ensemble mode
        self.weights = weights or {
            'rules': 0.3,
            'ml': 0.35,
            'gnn': 0.35
        }
        
        # Thread pool for parallel execution
        self.executor = ThreadPoolExecutor(max_workers=3)
        
        if self.gnn_model:
            self.gnn_model.to(device)
            self.gnn_model.eval()
            
    async def detect_fraud_async(
        self,
        transaction: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> FraudDetectionResult:
        """
        Asynchronous fraud detection.
        
        Args:
            transaction: Transaction data
            context: Additional context (e.g., user history, graph data)
            
        Returns:
            FraudDetectionResult
        """
        import time
        start_time = time.time()
        
        context = context or {}
        
        if self.mode == DetectionMode.RULES_ONLY:
            result = await self._detect_rules_only(transaction, context)
        elif self.mode == DetectionMode.ML_ONLY:
            result = await self._detect_ml_only(transaction, context)
        elif self.mode == DetectionMode.GNN_ONLY:
            result = await self._detect_gnn_only(transaction, context)
        elif self.mode == DetectionMode.HIERARCHICAL:
            result = await self._detect_hierarchical(transaction, context)
        elif self.mode == DetectionMode.PARALLEL:
            result = await self._detect_parallel(transaction, context)
        elif self.mode == DetectionMode.ENSEMBLE:
            result = await self._detect_ensemble(transaction, context)
        else:
            raise ValueError(f"Unknown detection mode: {self.mode}")
        
        # Add processing time
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        result.processing_time_ms = processing_time
        
        logger.info(
            f"Transaction {result.transaction_id}: "
            f"Action={result.final_action.value}, "
            f"Score={result.final_score:.3f}, "
            f"Time={processing_time:.2f}ms"
        )
        
        return result
        
    async def _detect_rules_only(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """Rules-only detection."""
        action, score, results = self.rule_engine.evaluate_transaction(
            transaction, context
        )
        
        triggered_rules = [r.rule_name for r in results if r.triggered]
        explanation = self._generate_rule_explanation(results)
        
        return FraudDetectionResult(
            transaction_id=transaction.get('transaction_id', 'unknown'),
            final_action=action,
            final_score=score,
            confidence=1.0 if action == RuleAction.BLOCK else 0.8,
            rule_score=score,
            ml_score=0.0,
            gnn_score=0.0,
            triggered_rules=triggered_rules,
            explanation=explanation,
            metadata={'rule_results': [r.__dict__ for r in results]},
            processing_time_ms=0.0
        )
        
    async def _detect_ml_only(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """ML-only detection."""
        if not self.ml_model:
            raise ValueError("ML model not initialized")
        
        # Prepare features
        features = self._prepare_ml_features(transaction, context)
        
        # Get ML prediction
        ml_score = self.ml_model.predict_proba(features)[0]
        
        # Determine action based on score
        if ml_score >= 0.9:
            action = RuleAction.BLOCK
        elif ml_score >= 0.7:
            action = RuleAction.REVIEW
        else:
            action = RuleAction.APPROVE
        
        return FraudDetectionResult(
            transaction_id=transaction.get('transaction_id', 'unknown'),
            final_action=action,
            final_score=ml_score,
            confidence=ml_score,
            rule_score=0.0,
            ml_score=ml_score,
            gnn_score=0.0,
            triggered_rules=[],
            explanation=f"ML model fraud score: {ml_score:.3f}",
            metadata={'ml_features': features.to_dict('records')[0]},
            processing_time_ms=0.0
        )
        
    async def _detect_gnn_only(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """GNN-only detection."""
        if not self.gnn_model:
            raise ValueError("GNN model not initialized")
        
        # Prepare graph data
        graph_data = self._prepare_graph_data(transaction, context)
        
        # Get GNN prediction
        with torch.no_grad():
            if hasattr(self.gnn_model, 'forward'):
                output = self.gnn_model(
                    graph_data['x'].to(self.device),
                    graph_data['edge_index'].to(self.device),
                    graph_data.get('edge_attr', None),
                    graph_data.get('timestamps', None),
                    graph_data.get('batch', None)
                )
                
                if isinstance(output, dict):
                    gnn_score = output['ensemble_score'].item()
                else:
                    gnn_score = output[0].item()
            else:
                gnn_score = 0.5
        
        # Determine action based on score
        if gnn_score >= 0.9:
            action = RuleAction.BLOCK
        elif gnn_score >= 0.7:
            action = RuleAction.REVIEW
        else:
            action = RuleAction.APPROVE
        
        return FraudDetectionResult(
            transaction_id=transaction.get('transaction_id', 'unknown'),
            final_action=action,
            final_score=gnn_score,
            confidence=gnn_score,
            rule_score=0.0,
            ml_score=0.0,
            gnn_score=gnn_score,
            triggered_rules=[],
            explanation=f"GNN model fraud score: {gnn_score:.3f}",
            metadata={'graph_stats': self._get_graph_stats(graph_data)},
            processing_time_ms=0.0
        )
        
    async def _detect_hierarchical(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """
        Hierarchical detection: Rules → ML → GNN
        
        Fast rules are evaluated first. If they don't trigger,
        ML models are used. GNN is used for complex cases.
        """
        # Step 1: Rule-based detection
        rule_action, rule_score, rule_results = self.rule_engine.evaluate_transaction(
            transaction, context
        )
        
        # If rules trigger BLOCK, return immediately
        if rule_action == RuleAction.BLOCK:
            return await self._detect_rules_only(transaction, context)
        
        # Step 2: ML detection
        if self.ml_model and rule_score < 0.7:
            features = self._prepare_ml_features(transaction, context)
            ml_score = self.ml_model.predict_proba(features)[0]
            
            # If ML score is high, return
            if ml_score >= 0.9:
                return FraudDetectionResult(
                    transaction_id=transaction.get('transaction_id', 'unknown'),
                    final_action=RuleAction.BLOCK,
                    final_score=ml_score,
                    confidence=ml_score,
                    rule_score=rule_score,
                    ml_score=ml_score,
                    gnn_score=0.0,
                    triggered_rules=[r.rule_name for r in rule_results if r.triggered],
                    explanation=f"ML model detected high fraud risk: {ml_score:.3f}",
                    metadata={},
                    processing_time_ms=0.0
                )
            
            # If ML score is moderate, use GNN for final decision
            if ml_score >= 0.5 and self.gnn_model:
                graph_data = self._prepare_graph_data(transaction, context)
                
                with torch.no_grad():
                    output = self.gnn_model(
                        graph_data['x'].to(self.device),
                        graph_data['edge_index'].to(self.device),
                        graph_data.get('edge_attr', None),
                        graph_data.get('timestamps', None),
                        graph_data.get('batch', None)
                    )
                    
                    if isinstance(output, dict):
                        gnn_score = output['ensemble_score'].item()
                    else:
                        gnn_score = output[0].item()
                
                # Final decision based on all scores
                final_score = max(rule_score, ml_score, gnn_score)
                
                if final_score >= 0.9:
                    final_action = RuleAction.BLOCK
                elif final_score >= 0.7:
                    final_action = RuleAction.REVIEW
                else:
                    final_action = RuleAction.APPROVE
                
                return FraudDetectionResult(
                    transaction_id=transaction.get('transaction_id', 'unknown'),
                    final_action=final_action,
                    final_score=final_score,
                    confidence=(ml_score + gnn_score) / 2,
                    rule_score=rule_score,
                    ml_score=ml_score,
                    gnn_score=gnn_score,
                    triggered_rules=[r.rule_name for r in rule_results if r.triggered],
                    explanation=f"Hierarchical detection: Rules={rule_score:.3f}, ML={ml_score:.3f}, GNN={gnn_score:.3f}",
                    metadata={},
                    processing_time_ms=0.0
                )
        
        # Default: approve
        return FraudDetectionResult(
            transaction_id=transaction.get('transaction_id', 'unknown'),
            final_action=RuleAction.APPROVE,
            final_score=max(rule_score, 0.0),
            confidence=0.9,
            rule_score=rule_score,
            ml_score=0.0,
            gnn_score=0.0,
            triggered_rules=[r.rule_name for r in rule_results if r.triggered],
            explanation="Transaction approved after hierarchical checks",
            metadata={},
            processing_time_ms=0.0
        )
        
    async def _detect_parallel(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """
        Parallel detection: Run all models simultaneously.
        """
        # Run all detections in parallel
        tasks = []
        
        # Rules
        tasks.append(self._detect_rules_only(transaction, context))
        
        # ML
        if self.ml_model:
            tasks.append(self._detect_ml_only(transaction, context))
        
        # GNN
        if self.gnn_model:
            tasks.append(self._detect_gnn_only(transaction, context))
        
        results = await asyncio.gather(*tasks)
        
        # Combine results
        rule_result = results[0]
        ml_result = results[1] if len(results) > 1 else None
        gnn_result = results[2] if len(results) > 2 else None
        
        # Take the highest score
        final_score = rule_result.rule_score
        if ml_result:
            final_score = max(final_score, ml_result.ml_score)
        if gnn_result:
            final_score = max(final_score, gnn_result.gnn_score)
        
        # Determine action
        if final_score >= 0.9:
            final_action = RuleAction.BLOCK
        elif final_score >= 0.7:
            final_action = RuleAction.REVIEW
        else:
            final_action = RuleAction.APPROVE
        
        return FraudDetectionResult(
            transaction_id=transaction.get('transaction_id', 'unknown'),
            final_action=final_action,
            final_score=final_score,
            confidence=final_score,
            rule_score=rule_result.rule_score,
            ml_score=ml_result.ml_score if ml_result else 0.0,
            gnn_score=gnn_result.gnn_score if gnn_result else 0.0,
            triggered_rules=rule_result.triggered_rules,
            explanation=f"Parallel detection: max score={final_score:.3f}",
            metadata={},
            processing_time_ms=0.0
        )
        
    async def _detect_ensemble(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> FraudDetectionResult:
        """
        Ensemble detection: Weighted combination of all models.
        """
        # Run all detections in parallel
        results = await self._detect_parallel(transaction, context)
        
        # Weighted ensemble
        final_score = (
            results.rule_score * self.weights['rules'] +
            results.ml_score * self.weights['ml'] +
            results.gnn_score * self.weights['gnn']
        )
        
        # Determine action
        if final_score >= 0.9:
            final_action = RuleAction.BLOCK
        elif final_score >= 0.7:
            final_action = RuleAction.REVIEW
        else:
            final_action = RuleAction.APPROVE
        
        results.final_action = final_action
        results.final_score = final_score
        results.explanation = (
            f"Ensemble detection: "
            f"Rules={results.rule_score:.3f} (w={self.weights['rules']}), "
            f"ML={results.ml_score:.3f} (w={self.weights['ml']}), "
            f"GNN={results.gnn_score:.3f} (w={self.weights['gnn']}), "
            f"Final={final_score:.3f}"
        )
        
        return results
        
    def _prepare_ml_features(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> pd.DataFrame:
        """Prepare features for ML model."""
        # Extract features from transaction
        features = {
            'amount': transaction.get('amount', 0),
            'merchant_id': transaction.get('merchant_id', 0),
            'account_id': transaction.get('account_id', 0),
            'hour': transaction.get('hour', 0),
            'day_of_week': transaction.get('day_of_week', 0),
            # Add more features as needed
        }
        
        return pd.DataFrame([features])
        
    def _prepare_graph_data(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, torch.Tensor]:
        """Prepare graph data for GNN model."""
        # This is a simplified example
        # In practice, you would construct a proper graph from the transaction
        # and its context (e.g., user network, merchant network)
        
        x = torch.randn(10, 64)  # Node features
        edge_index = torch.randint(0, 10, (2, 20))  # Edge connectivity
        
        return {
            'x': x,
            'edge_index': edge_index
        }
        
    def _generate_rule_explanation(self, results: List) -> str:
        """Generate human-readable explanation from rule results."""
        triggered = [r for r in results if r.triggered]
        
        if not triggered:
            return "No rules triggered"
        
        explanations = [f"{r.rule_name}: {r.reason}" for r in triggered]
        return "; ".join(explanations)
        
    def _get_graph_stats(self, graph_data: Dict[str, torch.Tensor]) -> Dict[str, int]:
        """Get statistics about the graph."""
        return {
            'num_nodes': graph_data['x'].size(0),
            'num_edges': graph_data['edge_index'].size(1)
        }
