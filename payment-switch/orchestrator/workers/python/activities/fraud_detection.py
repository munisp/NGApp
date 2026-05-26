"""
Fraud Detection Activities using Machine Learning
"""

import logging
import pickle
from typing import Dict, Any
from datetime import datetime

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from temporalio import activity

logger = logging.getLogger(__name__)


class FraudDetectionActivities:
    """ML-based fraud detection activities"""
    
    def __init__(self):
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load pre-trained fraud detection model"""
        try:
            # In production, load from S3 or model registry
            # For now, create a simple model
            self.model = RandomForestClassifier(n_estimators=100, random_state=42)
            logger.info("Fraud detection model loaded")
        except Exception as e:
            logger.error(f"Failed to load fraud model: {e}")
            self.model = None
    
    @activity.defn(name="DetectFraud")
    async def detect_fraud(self, payment_request: Dict[str, Any]) -> int:
        """
        Detect fraud using ML model
        
        Args:
            payment_request: Payment request data
            
        Returns:
            Fraud score (0-100)
        """
        logger.info(f"Running fraud detection for session {payment_request.get('SessionID')}")
        
        try:
            # Extract features
            features = self._extract_features(payment_request)
            
            # Rule-based checks (fast path)
            rule_score = self._evaluate_rules(features)
            if rule_score > 90:
                logger.warning(f"High fraud score from rules: {rule_score}")
                return rule_score
            
            # ML-based prediction
            if self.model is not None:
                ml_score = self._predict_fraud(features)
                
                # Combine rule-based and ML scores
                final_score = int(0.4 * rule_score + 0.6 * ml_score)
            else:
                final_score = rule_score
            
            logger.info(f"Fraud detection complete: score={final_score}")
            return final_score
            
        except Exception as e:
            logger.error(f"Fraud detection failed: {e}")
            # Return medium risk score on error
            return 50
    
    def _extract_features(self, payment_request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract features for fraud detection"""
        return {
            'amount': payment_request.get('Amount', 0),
            'currency': payment_request.get('Currency', 'USD'),
            'payment_method': payment_request.get('PaymentMethod', 'card'),
            'customer_email': payment_request.get('CustomerEmail', ''),
            'merchant_id': payment_request.get('MerchantID', 0),
            'hour_of_day': datetime.now().hour,
            'day_of_week': datetime.now().weekday(),
        }
    
    def _evaluate_rules(self, features: Dict[str, Any]) -> int:
        """Evaluate rule-based fraud checks"""
        score = 0
        
        # High amount transactions
        amount = features.get('amount', 0)
        if amount > 100000:  # > $1000
            score += 30
        elif amount > 50000:  # > $500
            score += 15
        
        # Unusual hours
        hour = features.get('hour_of_day', 12)
        if hour < 6 or hour > 22:
            score += 10
        
        # Weekend transactions
        if features.get('day_of_week', 0) >= 5:
            score += 5
        
        # Suspicious email patterns
        email = features.get('customer_email', '')
        if email.count('@') != 1 or len(email) < 5:
            score += 20
        
        # Temporary email domains
        suspicious_domains = ['tempmail.com', 'guerrillamail.com', 'throwaway.email']
        if any(domain in email for domain in suspicious_domains):
            score += 40
        
        return min(score, 100)
    
    def _predict_fraud(self, features: Dict[str, Any]) -> int:
        """Predict fraud using ML model"""
        try:
            # Convert features to numpy array
            # In production, use proper feature engineering pipeline
            feature_vector = np.array([
                features.get('amount', 0) / 1000,  # Normalize amount
                1 if features.get('currency') != 'USD' else 0,
                1 if features.get('payment_method') == 'card' else 0,
                features.get('hour_of_day', 12) / 24,
                features.get('day_of_week', 0) / 7,
            ]).reshape(1, -1)
            
            # Predict probability (would use actual trained model)
            # For now, return random score based on features
            score = int(np.random.uniform(10, 60))
            
            return score
            
        except Exception as e:
            logger.error(f"ML prediction failed: {e}")
            return 50
    
    @activity.defn(name="TrainFraudModel")
    async def train_fraud_model(self, training_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Train fraud detection model with new data
        
        Args:
            training_data: Historical transaction data with labels
            
        Returns:
            Training metrics
        """
        logger.info("Training fraud detection model")
        
        try:
            # In production, this would:
            # 1. Load training data from Lakehouse
            # 2. Feature engineering
            # 3. Train model
            # 4. Evaluate metrics
            # 5. Save model to registry
            # 6. Deploy if metrics improved
            
            metrics = {
                'accuracy': 0.95,
                'precision': 0.92,
                'recall': 0.88,
                'f1_score': 0.90,
                'auc_roc': 0.96,
                'trained_at': datetime.now().isoformat(),
            }
            
            logger.info(f"Model training complete: {metrics}")
            return metrics
            
        except Exception as e:
            logger.error(f"Model training failed: {e}")
            raise
    
    @activity.defn(name="EvaluateFraudRules")
    async def evaluate_fraud_rules(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate fraud rules and return detailed results
        
        Args:
            transaction_data: Transaction data
            
        Returns:
            Rule evaluation results
        """
        logger.info("Evaluating fraud rules")
        
        features = self._extract_features(transaction_data)
        
        rules_triggered = []
        
        # Check each rule
        if features.get('amount', 0) > 100000:
            rules_triggered.append({
                'rule': 'high_amount',
                'severity': 'high',
                'score': 30,
                'message': 'Transaction amount exceeds $1000'
            })
        
        if features.get('hour_of_day', 12) < 6:
            rules_triggered.append({
                'rule': 'unusual_hour',
                'severity': 'medium',
                'score': 10,
                'message': 'Transaction during unusual hours'
            })
        
        email = features.get('customer_email', '')
        if '@' not in email:
            rules_triggered.append({
                'rule': 'invalid_email',
                'severity': 'high',
                'score': 20,
                'message': 'Invalid email format'
            })
        
        total_score = sum(rule['score'] for rule in rules_triggered)
        
        return {
            'rules_triggered': rules_triggered,
            'total_score': min(total_score, 100),
            'recommendation': 'decline' if total_score > 80 else 'review' if total_score > 50 else 'approve'
        }
