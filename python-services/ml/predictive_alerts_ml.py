#!/usr/bin/env python3
"""
ML-Based Predictive Alerts Service
Uses Isolation Forest for anomaly detection and Qwen for intelligent alert generation
Production-ready with personalized thresholds and multi-factor fraud detection
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
OLLAMA_URL = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5:7b')
MODEL_DIR = '/tmp/ml_models'

# Ensure model directory exists
os.makedirs(MODEL_DIR, exist_ok=True)

class AnomalyDetector:
    """ML-based anomaly detection for transactions"""
    
    def __init__(self):
        self.model = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            random_state=42,
            n_estimators=100
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.user_models = {}  # Per-user models
    
    def extract_features(self, transactions: List[Dict[str, Any]]) -> np.ndarray:
        """Extract features from transactions for anomaly detection"""
        features = []
        
        for txn in transactions:
            # Basic features
            amount = txn.get('amount', 0)
            timestamp = txn.get('date', datetime.now().timestamp() * 1000)
            
            # Time-based features
            dt = datetime.fromtimestamp(timestamp / 1000)
            hour = dt.hour
            day_of_week = dt.weekday()
            day_of_month = dt.day
            
            # Category encoding (simple numeric mapping)
            category = txn.get('category', 'Other')
            category_map = {
                'Food': 1, 'Shopping': 2, 'Transportation': 3,
                'Utilities': 4, 'Entertainment': 5, 'Healthcare': 6,
                'Other': 0
            }
            category_code = category_map.get(category, 0)
            
            # Merchant features
            merchant = txn.get('merchant', '')
            merchant_length = len(merchant)
            
            # Transaction type
            is_debit = 1 if txn.get('type') == 'debit' else 0
            
            features.append([
                amount,
                hour,
                day_of_week,
                day_of_month,
                category_code,
                merchant_length,
                is_debit
            ])
        
        return np.array(features)
    
    def train(self, transactions: List[Dict[str, Any]], user_id: str = 'default'):
        """Train anomaly detection model on user's transaction history"""
        if len(transactions) < 10:
            return False  # Need minimum data
        
        features = self.extract_features(transactions)
        
        # Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # Train model
        self.model.fit(features_scaled)
        self.is_trained = True
        
        # Save per-user model
        self.user_models[user_id] = {
            'model': self.model,
            'scaler': self.scaler,
            'trained_at': datetime.now().isoformat(),
            'n_samples': len(transactions)
        }
        
        return True
    
    def detect_anomalies(
        self,
        transactions: List[Dict[str, Any]],
        user_id: str = 'default'
    ) -> List[Dict[str, Any]]:
        """Detect anomalous transactions"""
        if not self.is_trained and user_id not in self.user_models:
            # Train on provided data first
            self.train(transactions, user_id)
        
        # Use user-specific model if available
        if user_id in self.user_models:
            model_data = self.user_models[user_id]
            model = model_data['model']
            scaler = model_data['scaler']
        else:
            model = self.model
            scaler = self.scaler
        
        features = self.extract_features(transactions)
        features_scaled = scaler.transform(features)
        
        # Predict anomalies (-1 = anomaly, 1 = normal)
        predictions = model.predict(features_scaled)
        anomaly_scores = model.score_samples(features_scaled)
        
        # Identify anomalies
        anomalies = []
        for i, (txn, pred, score) in enumerate(zip(transactions, predictions, anomaly_scores)):
            if pred == -1:
                # Calculate confidence (lower score = more anomalous)
                confidence = min(100, max(0, (1 - abs(score)) * 100))
                
                anomalies.append({
                    'transaction': txn,
                    'anomaly_score': float(score),
                    'confidence': round(confidence, 1),
                    'index': i
                })
        
        return anomalies

class AlertGenerator:
    """Generate intelligent alerts using Qwen LLM"""
    
    def __init__(self, ollama_url: str = OLLAMA_URL, model: str = OLLAMA_MODEL):
        self.ollama_url = ollama_url.rstrip('/')
        self.model = model
    
    def generate_alert_message(
        self,
        alert_type: str,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> str:
        """Generate human-readable alert message using Qwen"""
        
        # Build prompt
        prompt = f"""Generate a concise financial alert message for the user.

Alert Type: {alert_type}
Transaction: ${transaction.get('amount', 0):.2f} at {transaction.get('merchant', 'Unknown')}
Category: {transaction.get('category', 'Other')}
Date: {datetime.fromtimestamp(transaction.get('date', 0) / 1000).strftime('%Y-%m-%d %H:%M')}

User Context:
- Average Transaction: ${context.get('avg_amount', 0):.2f}
- Monthly Budget: ${context.get('monthly_budget', 0):.2f}
- Current Spending: ${context.get('current_spending', 0):.2f}

Generate a brief, actionable alert message (2-3 sentences max). Be specific about the concern and suggest an action."""

        try:
            response = requests.post(
                f'{self.ollama_url}/api/generate',
                json={
                    'model': self.model,
                    'prompt': prompt,
                    'stream': False,
                    'options': {
                        'temperature': 0.7,
                        'num_predict': 150
                    }
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '').strip()
            else:
                # Fallback message
                return self._generate_fallback_message(alert_type, transaction)
                
        except Exception as e:
            print(f"Error generating alert with Qwen: {e}")
            return self._generate_fallback_message(alert_type, transaction)
    
    def _generate_fallback_message(self, alert_type: str, transaction: Dict[str, Any]) -> str:
        """Generate fallback alert message without LLM"""
        amount = transaction.get('amount', 0)
        merchant = transaction.get('merchant', 'Unknown merchant')
        
        messages = {
            'unusual_spending': f"Unusual transaction detected: ${amount:.2f} at {merchant}. This is significantly higher than your typical spending. Review this transaction to ensure it's legitimate.",
            'budget_alert': f"Budget alert: ${amount:.2f} spent at {merchant}. You're approaching your monthly budget limit. Consider reducing discretionary spending.",
            'fraud_risk': f"Potential fraud alert: ${amount:.2f} transaction at {merchant}. This transaction shows unusual patterns. Verify this charge immediately.",
            'large_transaction': f"Large transaction alert: ${amount:.2f} at {merchant}. This is a significant expense. Ensure this aligns with your financial goals.",
            'duplicate_charge': f"Possible duplicate charge: ${amount:.2f} at {merchant}. Similar transaction detected recently. Check for duplicate charges."
        }
        
        return messages.get(alert_type, f"Alert: ${amount:.2f} transaction at {merchant} requires your attention.")

class PredictiveAlertsService:
    """Main service for ML-based predictive alerts"""
    
    def __init__(self):
        self.anomaly_detector = AnomalyDetector()
        self.alert_generator = AlertGenerator()
    
    def analyze_transactions(
        self,
        transactions: List[Dict[str, Any]],
        user_id: str = 'default',
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze transactions and generate predictive alerts"""
        
        if not transactions:
            return {'alerts': [], 'summary': {'total_alerts': 0}}
        
        # Calculate user statistics
        amounts = [t.get('amount', 0) for t in transactions]
        avg_amount = np.mean(amounts) if amounts else 0
        std_amount = np.std(amounts) if len(amounts) > 1 else 0
        total_spending = sum(amounts)
        
        context = user_context or {}
        context.update({
            'avg_amount': avg_amount,
            'std_amount': std_amount,
            'total_spending': total_spending,
            'n_transactions': len(transactions)
        })
        
        alerts = []
        
        # 1. ML-based anomaly detection
        anomalies = self.anomaly_detector.detect_anomalies(transactions, user_id)
        
        for anomaly in anomalies:
            txn = anomaly['transaction']
            alert_type = self._classify_anomaly(txn, context, anomaly['anomaly_score'])
            
            # Generate intelligent message
            message = self.alert_generator.generate_alert_message(
                alert_type,
                txn,
                context
            )
            
            alerts.append({
                'id': f"alert_{txn.get('id', '')}_{int(datetime.now().timestamp())}",
                'type': alert_type,
                'severity': self._calculate_severity(alert_type, anomaly['confidence']),
                'transaction': txn,
                'message': message,
                'confidence': anomaly['confidence'],
                'anomaly_score': anomaly['anomaly_score'],
                'timestamp': datetime.now().isoformat(),
                'actionable': True,
                'actions': self._suggest_actions(alert_type)
            })
        
        # 2. Rule-based alerts (complement ML)
        rule_alerts = self._generate_rule_based_alerts(transactions, context)
        alerts.extend(rule_alerts)
        
        # 3. Predictive alerts (future risks)
        predictive_alerts = self._generate_predictive_alerts(transactions, context)
        alerts.extend(predictive_alerts)
        
        # Sort by severity and confidence
        alerts.sort(key=lambda x: (
            {'critical': 3, 'high': 2, 'medium': 1, 'low': 0}.get(x['severity'], 0),
            x.get('confidence', 0)
        ), reverse=True)
        
        # Generate summary
        summary = {
            'total_alerts': len(alerts),
            'by_severity': {
                'critical': len([a for a in alerts if a['severity'] == 'critical']),
                'high': len([a for a in alerts if a['severity'] == 'high']),
                'medium': len([a for a in alerts if a['severity'] == 'medium']),
                'low': len([a for a in alerts if a['severity'] == 'low'])
            },
            'by_type': {},
            'requires_action': len([a for a in alerts if a.get('actionable')])
        }
        
        # Count by type
        for alert in alerts:
            alert_type = alert['type']
            summary['by_type'][alert_type] = summary['by_type'].get(alert_type, 0) + 1
        
        return {
            'alerts': alerts[:20],  # Limit to top 20 alerts
            'summary': summary,
            'user_context': context
        }
    
    def _classify_anomaly(self, txn: Dict[str, Any], context: Dict[str, Any], score: float) -> str:
        """Classify type of anomaly"""
        amount = txn.get('amount', 0)
        avg_amount = context.get('avg_amount', 0)
        std_amount = context.get('std_amount', 0)
        
        # Very large transaction
        if amount > avg_amount + 3 * std_amount:
            return 'large_transaction'
        
        # Unusual spending pattern
        if score < -0.5:
            return 'fraud_risk'
        
        # Budget concerns
        monthly_budget = context.get('monthly_budget', 0)
        current_spending = context.get('current_spending', 0)
        if monthly_budget > 0 and current_spending / monthly_budget > 0.8:
            return 'budget_alert'
        
        return 'unusual_spending'
    
    def _calculate_severity(self, alert_type: str, confidence: float) -> str:
        """Calculate alert severity"""
        severity_map = {
            'fraud_risk': 'critical',
            'large_transaction': 'high',
            'budget_alert': 'high',
            'unusual_spending': 'medium',
            'duplicate_charge': 'medium',
            'low_balance': 'high',
            'overspending': 'medium'
        }
        
        base_severity = severity_map.get(alert_type, 'low')
        
        # Adjust based on confidence
        if confidence > 80 and base_severity in ['medium', 'low']:
            return 'high'
        
        return base_severity
    
    def _suggest_actions(self, alert_type: str) -> List[str]:
        """Suggest actions for alert"""
        actions = {
            'fraud_risk': [
                'Verify transaction immediately',
                'Contact merchant if unrecognized',
                'Report fraud if confirmed',
                'Lock card if necessary'
            ],
            'large_transaction': [
                'Review transaction details',
                'Ensure it aligns with budget',
                'Adjust spending plan if needed'
            ],
            'budget_alert': [
                'Review remaining budget',
                'Reduce discretionary spending',
                'Consider postponing non-essential purchases'
            ],
            'unusual_spending': [
                'Verify transaction is legitimate',
                'Check for unauthorized access',
                'Review recent account activity'
            ],
            'duplicate_charge': [
                'Check transaction history',
                'Contact merchant for refund',
                'Dispute charge if confirmed duplicate'
            ]
        }
        
        return actions.get(alert_type, ['Review transaction', 'Take appropriate action'])
    
    def _generate_rule_based_alerts(
        self,
        transactions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate rule-based alerts to complement ML"""
        alerts = []
        
        # Check for duplicate transactions
        seen = {}
        for txn in transactions:
            key = f"{txn.get('merchant', '')}_{txn.get('amount', 0)}"
            txn_date = datetime.fromtimestamp(txn.get('date', 0) / 1000)
            
            if key in seen:
                last_date = seen[key]
                time_diff = (txn_date - last_date).total_seconds() / 3600  # hours
                
                if time_diff < 24:  # Within 24 hours
                    message = self.alert_generator.generate_alert_message(
                        'duplicate_charge',
                        txn,
                        context
                    )
                    
                    alerts.append({
                        'id': f"rule_dup_{txn.get('id', '')}",
                        'type': 'duplicate_charge',
                        'severity': 'medium',
                        'transaction': txn,
                        'message': message,
                        'confidence': 75.0,
                        'timestamp': datetime.now().isoformat(),
                        'actionable': True,
                        'actions': self._suggest_actions('duplicate_charge')
                    })
            
            seen[key] = txn_date
        
        return alerts
    
    def _generate_predictive_alerts(
        self,
        transactions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate predictive alerts for future risks"""
        alerts = []
        
        # Predict budget overrun
        monthly_budget = context.get('monthly_budget', 0)
        current_spending = context.get('current_spending', 0)
        
        if monthly_budget > 0:
            # Calculate daily burn rate
            today = datetime.now()
            days_in_month = (datetime(today.year, today.month + 1, 1) - timedelta(days=1)).day
            days_elapsed = today.day
            days_remaining = days_in_month - days_elapsed
            
            if days_elapsed > 0:
                daily_rate = current_spending / days_elapsed
                projected_spending = current_spending + (daily_rate * days_remaining)
                
                if projected_spending > monthly_budget:
                    overage = projected_spending - monthly_budget
                    
                    alerts.append({
                        'id': f"pred_budget_{int(datetime.now().timestamp())}",
                        'type': 'overspending',
                        'severity': 'high',
                        'transaction': None,
                        'message': f"Budget warning: At your current spending rate (${daily_rate:.2f}/day), you're projected to exceed your monthly budget by ${overage:.2f}. Consider reducing daily spending to ${(monthly_budget - current_spending) / days_remaining:.2f}/day.",
                        'confidence': 85.0,
                        'timestamp': datetime.now().isoformat(),
                        'actionable': True,
                        'actions': [
                            'Review daily spending',
                            'Identify areas to cut back',
                            'Set daily spending limit',
                            'Track expenses more closely'
                        ],
                        'prediction': {
                            'projected_spending': round(projected_spending, 2),
                            'overage': round(overage, 2),
                            'recommended_daily_limit': round((monthly_budget - current_spending) / days_remaining, 2)
                        }
                    })
        
        return alerts

# Global service instance
predictive_alerts_service = PredictiveAlertsService()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'predictive-alerts-ml',
        'ml_model': 'IsolationForest',
        'llm_model': OLLAMA_MODEL,
        'features': [
            'anomaly_detection',
            'intelligent_alerts',
            'personalized_thresholds',
            'multi_factor_analysis',
            'predictive_warnings'
        ]
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze transactions and generate alerts"""
    try:
        data = request.get_json()
        
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Transactions are required'}), 400
        
        transactions = data['transactions']
        user_id = data.get('user_id', 'default')
        user_context = data.get('user_context', {})
        
        result = predictive_alerts_service.analyze_transactions(
            transactions,
            user_id,
            user_context
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error analyzing transactions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['POST'])
def train():
    """Train user-specific anomaly detection model"""
    try:
        data = request.get_json()
        
        if not data or 'transactions' not in data:
            return jsonify({'error': 'Transactions are required'}), 400
        
        transactions = data['transactions']
        user_id = data.get('user_id', 'default')
        
        success = predictive_alerts_service.anomaly_detector.train(transactions, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Model trained successfully for user {user_id}',
                'n_samples': len(transactions)
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Insufficient data for training (minimum 10 transactions required)'
            }), 400
        
    except Exception as e:
        print(f"Error training model: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PREDICTIVE_ALERTS_ML_PORT', 5003))
    print(f"Starting ML-Based Predictive Alerts Service on port {port}...")
    print(f"Ollama URL: {OLLAMA_URL}")
    print(f"Ollama Model: {OLLAMA_MODEL}")
    print(f"ML Model: Isolation Forest")
    print("Features: Anomaly Detection, Intelligent Alerts, Predictive Warnings")
    print("Predictive Alerts ML Service ready!")
    app.run(host='0.0.0.0', port=port, debug=False)
