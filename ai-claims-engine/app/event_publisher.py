"""Kafka event publisher for claims AI events."""
import json
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)


class EventPublisher:
    """Publishes domain events to Kafka (graceful degradation if unavailable)."""

    def __init__(self, service: str):
        self.service = service
        self.broker = os.getenv("KAFKA_BROKERS", "localhost:9092")
        self.producer = None
        try:
            from kafka import KafkaProducer
            self.producer = KafkaProducer(
                bootstrap_servers=self.broker,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                request_timeout_ms=5000,
            )
            logger.info(f"Kafka producer connected to {self.broker}")
        except Exception as e:
            logger.warning(f"Kafka not available (non-fatal): {e}")

    def publish(self, event_type: str, key: str, payload: dict):
        event = {
            "id": f"{event_type}-{datetime.utcnow().timestamp()}",
            "type": event_type,
            "service": self.service,
            "timestamp": datetime.utcnow().isoformat(),
            "payload": payload,
        }
        if self.producer:
            try:
                topic = f"ngapp.{self.service.replace('-', '_')}.events"
                self.producer.send(topic, key=key.encode(), value=event)
            except Exception as e:
                logger.warning(f"Kafka publish failed (non-fatal): {e}")
        else:
            logger.debug(f"Event (local): {event_type} -> {key}")
