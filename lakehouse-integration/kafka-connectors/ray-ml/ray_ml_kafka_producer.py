"""
Ray ML Kafka Producer

Produces ML prediction results to Kafka for lakehouse ingestion.
Integrates with Ray Serve deployments to stream predictions.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from uuid import uuid4

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MLPredictionEvent:
    """ML prediction event for Kafka"""
    event_id: str
    model_name: str
    model_version: str
    prediction_type: str
    input_features: Dict[str, Any]
    prediction: Any
    confidence: float
    latency_ms: float
    timestamp: str
    metadata: Dict[str, Any]


class RayMLKafkaProducer:
    """Produces Ray ML predictions to Kafka for lakehouse ingestion"""
    
    def __init__(
        self,
        bootstrap_servers: Optional[str] = None,
        topic: str = "ml-predictions",
        batch_size: int = 100,
        linger_ms: int = 100
    ):
        self.bootstrap_servers = bootstrap_servers or os.getenv(
            "KAFKA_BROKERS", "kafka-0:9092,kafka-1:9092,kafka-2:9092"
        )
        self.topic = topic
        self.batch_size = batch_size
        self.linger_ms = linger_ms
        self.producer: Optional[AIOKafkaProducer] = None
        self._metrics = {
            "messages_sent": 0,
            "bytes_sent": 0,
            "errors": 0,
            "last_send_time": None
        }
    
    async def start(self):
        """Start the Kafka producer"""
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
            acks='all',
            enable_idempotence=True,
            max_batch_size=self.batch_size * 1024,
            linger_ms=self.linger_ms,
            compression_type='gzip'
        )
        await self.producer.start()
        logger.info(f"Ray ML Kafka Producer started, topic: {self.topic}")
    
    async def stop(self):
        """Stop the Kafka producer"""
        if self.producer:
            await self.producer.stop()
            logger.info("Ray ML Kafka Producer stopped")
    
    async def send_prediction(
        self,
        model_name: str,
        model_version: str,
        prediction_type: str,
        input_features: Dict[str, Any],
        prediction: Any,
        confidence: float,
        latency_ms: float,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send a single prediction event to Kafka
        
        Args:
            model_name: Name of the ML model
            model_version: Version of the model
            prediction_type: Type of prediction (fraud, risk, claims, etc.)
            input_features: Input features used for prediction
            prediction: The prediction result
            confidence: Confidence score (0-1)
            latency_ms: Inference latency in milliseconds
            metadata: Additional metadata
            
        Returns:
            True if sent successfully, False otherwise
        """
        event = MLPredictionEvent(
            event_id=str(uuid4()),
            model_name=model_name,
            model_version=model_version,
            prediction_type=prediction_type,
            input_features=input_features,
            prediction=prediction,
            confidence=confidence,
            latency_ms=latency_ms,
            timestamp=datetime.utcnow().isoformat(),
            metadata=metadata or {}
        )
        
        try:
            await self.producer.send_and_wait(
                self.topic,
                value=asdict(event),
                key=f"{model_name}-{event.event_id}"
            )
            
            self._metrics["messages_sent"] += 1
            self._metrics["bytes_sent"] += len(json.dumps(asdict(event)))
            self._metrics["last_send_time"] = datetime.utcnow().isoformat()
            
            return True
            
        except KafkaError as e:
            logger.error(f"Failed to send prediction to Kafka: {e}")
            self._metrics["errors"] += 1
            return False
    
    async def send_batch_predictions(
        self,
        predictions: List[Dict[str, Any]]
    ) -> int:
        """
        Send a batch of predictions to Kafka
        
        Args:
            predictions: List of prediction dictionaries
            
        Returns:
            Number of successfully sent predictions
        """
        sent_count = 0
        
        for pred in predictions:
            success = await self.send_prediction(
                model_name=pred.get("model_name", "unknown"),
                model_version=pred.get("model_version", "1.0.0"),
                prediction_type=pred.get("prediction_type", "unknown"),
                input_features=pred.get("input_features", {}),
                prediction=pred.get("prediction"),
                confidence=pred.get("confidence", 0.0),
                latency_ms=pred.get("latency_ms", 0.0),
                metadata=pred.get("metadata")
            )
            if success:
                sent_count += 1
        
        return sent_count
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get producer metrics"""
        return self._metrics.copy()


class FraudDetectionProducer(RayMLKafkaProducer):
    """Specialized producer for fraud detection predictions"""
    
    def __init__(self, **kwargs):
        super().__init__(topic="fraud-detection-results", **kwargs)
    
    async def send_fraud_prediction(
        self,
        transaction_id: str,
        customer_id: str,
        amount: float,
        is_fraud: bool,
        fraud_probability: float,
        risk_factors: List[str],
        latency_ms: float,
        model_version: str = "1.0.0"
    ) -> bool:
        """Send fraud detection prediction"""
        return await self.send_prediction(
            model_name="fraud-detection",
            model_version=model_version,
            prediction_type="fraud_detection",
            input_features={
                "transaction_id": transaction_id,
                "customer_id": customer_id,
                "amount": amount
            },
            prediction={
                "is_fraud": is_fraud,
                "fraud_probability": fraud_probability,
                "risk_factors": risk_factors
            },
            confidence=fraud_probability if is_fraud else 1 - fraud_probability,
            latency_ms=latency_ms,
            metadata={
                "transaction_id": transaction_id,
                "customer_id": customer_id
            }
        )


class RiskScoringProducer(RayMLKafkaProducer):
    """Specialized producer for risk scoring predictions"""
    
    def __init__(self, **kwargs):
        super().__init__(topic="risk-scoring-results", **kwargs)
    
    async def send_risk_score(
        self,
        entity_id: str,
        entity_type: str,
        risk_score: float,
        risk_category: str,
        risk_factors: Dict[str, float],
        latency_ms: float,
        model_version: str = "1.0.0"
    ) -> bool:
        """Send risk scoring prediction"""
        return await self.send_prediction(
            model_name="risk-scoring",
            model_version=model_version,
            prediction_type="risk_scoring",
            input_features={
                "entity_id": entity_id,
                "entity_type": entity_type
            },
            prediction={
                "risk_score": risk_score,
                "risk_category": risk_category,
                "risk_factors": risk_factors
            },
            confidence=1.0 - abs(risk_score - 0.5) * 2,  # Higher confidence at extremes
            latency_ms=latency_ms,
            metadata={
                "entity_id": entity_id,
                "entity_type": entity_type
            }
        )


class ClaimsPredictionProducer(RayMLKafkaProducer):
    """Specialized producer for claims prediction"""
    
    def __init__(self, **kwargs):
        super().__init__(topic="claims-prediction-results", **kwargs)
    
    async def send_claims_prediction(
        self,
        claim_id: str,
        policy_id: str,
        predicted_amount: float,
        approval_probability: float,
        processing_time_days: int,
        latency_ms: float,
        model_version: str = "1.0.0"
    ) -> bool:
        """Send claims prediction"""
        return await self.send_prediction(
            model_name="claims-prediction",
            model_version=model_version,
            prediction_type="claims_prediction",
            input_features={
                "claim_id": claim_id,
                "policy_id": policy_id
            },
            prediction={
                "predicted_amount": predicted_amount,
                "approval_probability": approval_probability,
                "processing_time_days": processing_time_days
            },
            confidence=approval_probability,
            latency_ms=latency_ms,
            metadata={
                "claim_id": claim_id,
                "policy_id": policy_id
            }
        )


async def main():
    """Example usage"""
    # Initialize producers
    fraud_producer = FraudDetectionProducer()
    risk_producer = RiskScoringProducer()
    claims_producer = ClaimsPredictionProducer()
    
    await fraud_producer.start()
    await risk_producer.start()
    await claims_producer.start()
    
    try:
        # Send sample predictions
        await fraud_producer.send_fraud_prediction(
            transaction_id="txn-12345",
            customer_id="cust-67890",
            amount=50000.0,
            is_fraud=False,
            fraud_probability=0.15,
            risk_factors=["high_amount", "new_device"],
            latency_ms=25.5
        )
        
        await risk_producer.send_risk_score(
            entity_id="policy-12345",
            entity_type="policy",
            risk_score=0.35,
            risk_category="LOW",
            risk_factors={"age": 0.1, "location": 0.15, "history": 0.1},
            latency_ms=18.2
        )
        
        await claims_producer.send_claims_prediction(
            claim_id="claim-12345",
            policy_id="policy-67890",
            predicted_amount=150000.0,
            approval_probability=0.85,
            processing_time_days=5,
            latency_ms=32.1
        )
        
        logger.info("Sample predictions sent successfully")
        
    finally:
        await fraud_producer.stop()
        await risk_producer.stop()
        await claims_producer.stop()


if __name__ == "__main__":
    asyncio.run(main())
