"""
Fraud Detection Service
Hybrid fraud detection system combining rule-based and ML/DL/GNN approaches.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from enum import Enum

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
import redis.asyncio as aioredis
import numpy as np
# Initialize event integration for lakehouse
try:
    from . import events_integration
except ImportError:
    import events_integration



# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Fraud Detection Service",
    description="Hybrid fraud detection using rules and ML/GNN",
    version="1.0.0"
)

# Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis-master.payment-switch")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# Enums
class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class FraudReason(str, Enum):
    VELOCITY_CHECK = "VELOCITY_CHECK"
    AMOUNT_ANOMALY = "AMOUNT_ANOMALY"
    LOCATION_ANOMALY = "LOCATION_ANOMALY"
    BLACKLIST = "BLACKLIST"
    PATTERN_MATCH = "PATTERN_MATCH"
    ML_PREDICTION = "ML_PREDICTION"
    GNN_PREDICTION = "GNN_PREDICTION"

# Models
class Party(BaseModel):
    id: str
    participantId: str

class Amount(BaseModel):
    currency: str
    value: str

class FraudCheckRequest(BaseModel):
    transactionId: str
    payer: Party
    payee: Party
    amount: Amount
    channel: str
    timestamp: str

class FraudCheckResponse(BaseModel):
    transactionId: str
    riskScore: float = Field(..., ge=0.0, le=1.0)
    riskLevel: RiskLevel
    reasons: List[str]
    rulesTriggered: List[str]
    mlScore: Optional[float] = None
    gnnScore: Optional[float] = None
    blocked: bool

# Global clients
redis_client: Optional[aioredis.Redis] = None

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global redis_client
    
    try:
        redis_client = await aioredis.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}",
            encoding="utf-8",
            decode_responses=True
        )
        logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        
        # Initialize ML models (in production, load from model registry)
        logger.info("Fraud detection models initialized")
        
    except Exception as e:
        logger.error(f"Failed to initialize connections: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up connections on shutdown"""
    global redis_client
    
    if redis_client:
        await redis_client.close()
        logger.info("Closed Redis connection")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "fraud-detection",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/check", response_model=FraudCheckResponse)
async def check_fraud(request: FraudCheckRequest):
    """
    Perform fraud detection on a transaction.
    
    This uses a hybrid approach:
    1. Rule-based checks (velocity, amount limits, blacklists)
    2. Machine Learning predictions
    3. Graph Neural Network analysis
    """
    try:
        logger.info(f"Checking fraud for transaction {request.transactionId}")
        
        # Initialize result
        reasons = []
        rules_triggered = []
        risk_scores = []
        
        # Rule-Based Checks
        
        # 1. Velocity Check
        velocity_result = await check_velocity(request.payer.id, request.amount)
        if velocity_result["triggered"]:
            rules_triggered.append("VELOCITY_CHECK")
            reasons.append(velocity_result["reason"])
            risk_scores.append(velocity_result["score"])
        
        # 2. Amount Anomaly Check
        amount_result = await check_amount_anomaly(request.payer.id, request.amount)
        if amount_result["triggered"]:
            rules_triggered.append("AMOUNT_ANOMALY")
            reasons.append(amount_result["reason"])
            risk_scores.append(amount_result["score"])
        
        # 3. Blacklist Check
        blacklist_result = await check_blacklist(request.payer.id, request.payee.id)
        if blacklist_result["triggered"]:
            rules_triggered.append("BLACKLIST")
            reasons.append(blacklist_result["reason"])
            risk_scores.append(1.0)  # Blacklist is critical
        
        # 4. Time-based Pattern Check
        time_result = await check_time_pattern(request.payer.id, request.timestamp)
        if time_result["triggered"]:
            rules_triggered.append("TIME_PATTERN")
            reasons.append(time_result["reason"])
            risk_scores.append(time_result["score"])
        
        # Machine Learning Prediction
        ml_score = await ml_fraud_prediction(request)
        if ml_score > 0.6:
            reasons.append(f"ML model flagged transaction (score: {ml_score:.2f})")
            risk_scores.append(ml_score)
        
        # Graph Neural Network Analysis
        gnn_score = await gnn_fraud_prediction(request)
        if gnn_score > 0.7:
            reasons.append(f"GNN detected suspicious network pattern (score: {gnn_score:.2f})")
            risk_scores.append(gnn_score)
        
        # Calculate final risk score (weighted average)
        if risk_scores:
            final_risk_score = np.mean(risk_scores)
        else:
            final_risk_score = 0.0
        
        # Determine risk level
        if final_risk_score >= 0.8:
            risk_level = RiskLevel.CRITICAL
            blocked = True
        elif final_risk_score >= 0.6:
            risk_level = RiskLevel.HIGH
            blocked = True
        elif final_risk_score >= 0.4:
            risk_level = RiskLevel.MEDIUM
            blocked = False
        else:
            risk_level = RiskLevel.LOW
            blocked = False
        
        # Store transaction for future analysis
        await store_transaction_for_analysis(request, final_risk_score)
        
        response = FraudCheckResponse(
            transactionId=request.transactionId,
            riskScore=final_risk_score,
            riskLevel=risk_level,
            reasons=reasons if reasons else ["No fraud indicators detected"],
            rulesTriggered=rules_triggered,
            mlScore=ml_score,
            gnnScore=gnn_score,
            blocked=blocked
        )
        
        logger.info(f"Fraud check completed: {request.transactionId} - Risk: {risk_level} ({final_risk_score:.2f})")
        
        return response
        
    except Exception as e:
        logger.error(f"Error checking fraud: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform fraud check"
        )

async def check_velocity(payer_id: str, amount: Amount) -> Dict[str, Any]:
    """
    Check transaction velocity (number and amount of transactions in a time window).
    """
    try:
        # Get transactions in last hour
        key = f"velocity:{payer_id}:1h"
        transactions = await redis_client.lrange(key, 0, -1)
        
        count = len(transactions)
        total_amount = sum(float(t) for t in transactions) if transactions else 0.0
        current_amount = float(amount.value)
        
        # Rules
        max_transactions_per_hour = 10
        max_amount_per_hour = 5000.0
        
        if count >= max_transactions_per_hour:
            return {
                "triggered": True,
                "reason": f"Velocity limit exceeded: {count} transactions in last hour",
                "score": min(1.0, count / max_transactions_per_hour)
            }
        
        if total_amount + current_amount > max_amount_per_hour:
            return {
                "triggered": True,
                "reason": f"Amount velocity exceeded: ${total_amount + current_amount:.2f} in last hour",
                "score": min(1.0, (total_amount + current_amount) / max_amount_per_hour)
            }
        
        # Store current transaction
        await redis_client.lpush(key, amount.value)
        await redis_client.expire(key, 3600)  # 1 hour TTL
        
        return {"triggered": False, "score": 0.0}
        
    except Exception as e:
        logger.error(f"Error in velocity check: {e}")
        return {"triggered": False, "score": 0.0}

async def check_amount_anomaly(payer_id: str, amount: Amount) -> Dict[str, Any]:
    """
    Check if transaction amount is anomalous compared to user's history.
    """
    try:
        # Get historical transaction amounts
        key = f"history:{payer_id}:amounts"
        historical_amounts = await redis_client.lrange(key, 0, 99)  # Last 100 transactions
        
        if not historical_amounts or len(historical_amounts) < 10:
            # Not enough history, apply basic threshold
            current_amount = float(amount.value)
            if current_amount > 1000.0:
                return {
                    "triggered": True,
                    "reason": f"Large transaction without sufficient history: ${current_amount:.2f}",
                    "score": min(1.0, current_amount / 10000.0)
                }
            return {"triggered": False, "score": 0.0}
        
        # Calculate statistics
        amounts = [float(a) for a in historical_amounts]
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        current_amount = float(amount.value)
        
        # Z-score anomaly detection
        if std_amount > 0:
            z_score = abs((current_amount - mean_amount) / std_amount)
            if z_score > 3.0:  # More than 3 standard deviations
                return {
                    "triggered": True,
                    "reason": f"Amount anomaly detected: ${current_amount:.2f} vs avg ${mean_amount:.2f}",
                    "score": min(1.0, z_score / 5.0)
                }
        
        # Store current amount in history
        await redis_client.lpush(key, amount.value)
        await redis_client.ltrim(key, 0, 99)  # Keep only last 100
        
        return {"triggered": False, "score": 0.0}
        
    except Exception as e:
        logger.error(f"Error in amount anomaly check: {e}")
        return {"triggered": False, "score": 0.0}

async def check_blacklist(payer_id: str, payee_id: str) -> Dict[str, Any]:
    """
    Check if payer or payee is on blacklist.
    """
    try:
        payer_blacklisted = await redis_client.sismember("blacklist:accounts", payer_id)
        payee_blacklisted = await redis_client.sismember("blacklist:accounts", payee_id)
        
        if payer_blacklisted:
            return {
                "triggered": True,
                "reason": "Payer account is blacklisted",
                "score": 1.0
            }
        
        if payee_blacklisted:
            return {
                "triggered": True,
                "reason": "Payee account is blacklisted",
                "score": 1.0
            }
        
        return {"triggered": False, "score": 0.0}
        
    except Exception as e:
        logger.error(f"Error in blacklist check: {e}")
        return {"triggered": False, "score": 0.0}

async def check_time_pattern(payer_id: str, timestamp: str) -> Dict[str, Any]:
    """
    Check for suspicious time patterns (e.g., transactions at unusual hours).
    """
    try:
        transaction_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        hour = transaction_time.hour
        
        # Flag transactions between 2 AM and 5 AM as potentially suspicious
        if 2 <= hour < 5:
            return {
                "triggered": True,
                "reason": f"Transaction at unusual hour: {hour}:00",
                "score": 0.5
            }
        
        return {"triggered": False, "score": 0.0}
        
    except Exception as e:
        logger.error(f"Error in time pattern check: {e}")
        return {"triggered": False, "score": 0.0}

async def ml_fraud_prediction(request: FraudCheckRequest) -> float:
    """
    Machine Learning-based fraud prediction.
    
    In production, this would use a trained model (e.g., XGBoost, Random Forest).
    For now, we simulate with a simple heuristic.
    """
    try:
        # Extract features
        amount = float(request.amount.value)
        hour = datetime.fromisoformat(request.timestamp.replace('Z', '+00:00')).hour
        
        # Simulate ML model prediction
        # In production, you would do: model.predict(features)
        score = 0.0
        
        # Simple heuristic for demonstration
        if amount > 5000:
            score += 0.3
        if 2 <= hour < 5:
            score += 0.2
        if request.channel == "WEB":
            score += 0.1
        
        return min(1.0, score)
        
    except Exception as e:
        logger.error(f"Error in ML prediction: {e}")
        return 0.0

async def gnn_fraud_prediction(request: FraudCheckRequest) -> float:
    """
    Graph Neural Network-based fraud prediction.
    
    Analyzes the transaction graph to detect suspicious patterns.
    In production, this would use PyTorch Geometric or DGL.
    """
    try:
        # In production, you would:
        # 1. Build a graph of accounts and transactions
        # 2. Extract graph features (node embeddings, edge features)
        # 3. Run GNN model to predict fraud probability
        
        # For now, simulate with a simple check
        # Check if payer and payee are in a suspicious network
        payer_risk = await get_network_risk(request.payer.id)
        payee_risk = await get_network_risk(request.payee.id)
        
        score = max(payer_risk, payee_risk)
        
        return score
        
    except Exception as e:
        logger.error(f"Error in GNN prediction: {e}")
        return 0.0

async def get_network_risk(account_id: str) -> float:
    """
    Get the network risk score for an account based on its connections.
    """
    try:
        # Check if account is connected to known fraudulent accounts
        connections = await redis_client.smembers(f"network:{account_id}")
        
        if not connections:
            return 0.0
        
        # Check how many connections are flagged
        flagged_count = 0
        for conn in connections:
            if await redis_client.sismember("flagged:accounts", conn):
                flagged_count += 1
        
        # Calculate risk based on percentage of flagged connections
        risk_score = flagged_count / len(connections) if connections else 0.0
        
        return risk_score
        
    except Exception as e:
        logger.error(f"Error getting network risk: {e}")
        return 0.0

async def store_transaction_for_analysis(request: FraudCheckRequest, risk_score: float):
    """
    Store transaction data for future analysis and model training.
    """
    try:
        transaction_data = {
            "transactionId": request.transactionId,
            "payerId": request.payer.id,
            "payeeId": request.payee.id,
            "amount": request.amount.value,
            "currency": request.amount.currency,
            "channel": request.channel,
            "timestamp": request.timestamp,
            "riskScore": risk_score
        }
        
        # Store in Redis list for batch processing
        await redis_client.lpush("fraud:analysis:queue", str(transaction_data))
        
        # Update network graph
        await redis_client.sadd(f"network:{request.payer.id}", request.payee.id)
        await redis_client.sadd(f"network:{request.payee.id}", request.payer.id)
        
    except Exception as e:
        logger.error(f"Error storing transaction for analysis: {e}")

@app.post("/report")
async def report_fraud(transaction_id: str, confirmed: bool):
    """
    Report fraud feedback for model training.
    
    This endpoint allows manual confirmation or rejection of fraud predictions,
    which can be used to improve the ML/GNN models.
    """
    try:
        logger.info(f"Fraud report received for {transaction_id}: confirmed={confirmed}")
        
        # Store feedback for model retraining
        feedback_data = {
            "transactionId": transaction_id,
            "confirmed": confirmed,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await redis_client.lpush("fraud:feedback:queue", str(feedback_data))
        
        return {
            "status": "success",
            "message": "Fraud report recorded"
        }
        
    except Exception as e:
        logger.error(f"Error reporting fraud: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to report fraud"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
