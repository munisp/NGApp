import json
import logging
from typing import Any, Dict
from kafka import KafkaProducer
from kafka.errors import KafkaError
import os

from app.models import VerificationEvent

logger = logging.getLogger(__name__)


class KafkaEventProducer:
    """Kafka producer for verification events"""
    
    def __init__(self):
        self.bootstrap_servers = os.getenv(
            "KAFKA_BOOTSTRAP_SERVERS", 
            "localhost:9092"
        ).split(",")
        
        self.topic = os.getenv("KAFKA_VERIFICATION_TOPIC", "verification-events")
        
        self.producer = KafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
            acks='all',  # Wait for all replicas
            retries=3,
            max_in_flight_requests_per_connection=1,  # Ensure ordering
            compression_type='snappy'
        )
        
        logger.info(f"Kafka producer initialized with brokers: {self.bootstrap_servers}")
    
    async def publish_verification_event(self, event: VerificationEvent) -> bool:
        """
        Publish verification event to Kafka
        
        Args:
            event: Verification event to publish
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert event to dict
            event_dict = event.dict()
            
            # Convert datetime to ISO format
            if event_dict.get("timestamp"):
                event_dict["timestamp"] = event_dict["timestamp"].isoformat()
            
            # Send to Kafka
            future = self.producer.send(
                self.topic,
                key=event.customer_id,
                value=event_dict
            )
            
            # Wait for confirmation
            record_metadata = future.get(timeout=10)
            
            logger.info(
                f"Event published: {event.event_type} for customer {event.customer_id} "
                f"to partition {record_metadata.partition} at offset {record_metadata.offset}"
            )
            
            return True
            
        except KafkaError as e:
            logger.error(f"Failed to publish event to Kafka: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing event: {str(e)}")
            return False
    
    async def publish_nin_verified_event(
        self, 
        verification_id: str,
        customer_id: str,
        nin: str,
        verified: bool,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Publish NIN verified event
        
        Args:
            verification_id: Verification ID
            customer_id: Customer ID
            nin: NIN number
            verified: Whether verification was successful
            metadata: Additional metadata
            
        Returns:
            True if successful, False otherwise
        """
        from datetime import datetime
        from app.models import VerificationType, VerificationStatus
        
        event = VerificationEvent(
            event_id=verification_id,
            event_type="verification.nin.completed",
            verification_id=verification_id,
            customer_id=customer_id,
            verification_type=VerificationType.NIN,
            status=VerificationStatus.VERIFIED if verified else VerificationStatus.FAILED,
            timestamp=datetime.utcnow(),
            metadata=metadata or {"nin": nin}
        )
        
        return await self.publish_verification_event(event)
    
    async def publish_cac_verified_event(
        self, 
        verification_id: str,
        customer_id: str,
        cac_number: str,
        verified: bool,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """
        Publish CAC verified event
        
        Args:
            verification_id: Verification ID
            customer_id: Customer ID
            cac_number: CAC registration number
            verified: Whether verification was successful
            metadata: Additional metadata
            
        Returns:
            True if successful, False otherwise
        """
        from datetime import datetime
        from app.models import VerificationType, VerificationStatus
        
        event = VerificationEvent(
            event_id=verification_id,
            event_type="verification.cac.completed",
            verification_id=verification_id,
            customer_id=customer_id,
            verification_type=VerificationType.CAC,
            status=VerificationStatus.VERIFIED if verified else VerificationStatus.FAILED,
            timestamp=datetime.utcnow(),
            metadata=metadata or {"cac_number": cac_number}
        )
        
        return await self.publish_verification_event(event)
    
    def close(self):
        """Close Kafka producer"""
        if self.producer:
            self.producer.flush()
            self.producer.close()
            logger.info("Kafka producer closed")
