"""
Kafka Consumer Base - Provides consumer functionality for all services
"""
import os
import json
import logging
from typing import Callable, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

@dataclass
class ConsumerConfig:
    """Kafka consumer configuration"""
    topic: str
    group_id: str
    auto_offset_reset: str = "earliest"
    enable_auto_commit: bool = True
    max_poll_records: int = 100


class DomainEventConsumer:
    """
    Consumer for domain.events topic - processes all domain events
    """
    def __init__(self, group_id: str = "domain-events-processor"):
        self.topic = "domain.events"
        self.group_id = group_id
        self.handlers: Dict[str, Callable] = {}
        self.running = False
        
    def register_handler(self, event_type: str, handler: Callable):
        """Register a handler for a specific event type"""
        self.handlers[event_type] = handler
        logger.info(f"Registered handler for event type: {event_type}")
        
    async def process_event(self, event: Dict[str, Any]):
        """Process a single domain event"""
        event_type = event.get("event_type", "unknown")
        handler = self.handlers.get(event_type)
        
        if handler:
            try:
                await handler(event)
                logger.debug(f"Processed event: {event_type}")
            except Exception as e:
                logger.error(f"Error processing event {event_type}: {e}")
                raise
        else:
            logger.debug(f"No handler for event type: {event_type}")
            
    async def start(self):
        """Start consuming events"""
        self.running = True
        logger.info(f"Starting consumer for topic: {self.topic}, group: {self.group_id}")
        # In production, this would use aiokafka or confluent-kafka
        # For now, this is the interface that services will use
        
    async def stop(self):
        """Stop consuming events"""
        self.running = False
        logger.info(f"Stopped consumer for topic: {self.topic}")


class PaymentRetryConsumer:
    """
    Consumer for payment.retry topic - handles failed payment retries
    """
    def __init__(self, group_id: str = "payment-retry-processor"):
        self.topic = "payment.retry"
        self.group_id = group_id
        self.retry_handler: Optional[Callable] = None
        self.running = False
        
    def set_retry_handler(self, handler: Callable):
        """Set the handler for retry events"""
        self.retry_handler = handler
        
    async def process_retry(self, message: Dict[str, Any]):
        """Process a retry message"""
        if self.retry_handler:
            transaction_id = message.get("transaction_id")
            attempt = message.get("attempt", 1)
            logger.info(f"Processing retry for transaction {transaction_id}, attempt {attempt}")
            await self.retry_handler(message)
        else:
            logger.warning("No retry handler configured")
            
    async def start(self):
        """Start consuming retry messages"""
        self.running = True
        logger.info(f"Starting consumer for topic: {self.topic}, group: {self.group_id}")
        
    async def stop(self):
        """Stop consuming retry messages"""
        self.running = False
        logger.info(f"Stopped consumer for topic: {self.topic}")


class TigerBeetleTransferConsumer:
    """
    Consumer for tigerbeetle.transfers topic - handles ledger transfer events
    """
    def __init__(self, group_id: str = "tigerbeetle-transfer-processor"):
        self.topic = "tigerbeetle.transfers"
        self.group_id = group_id
        self.transfer_handler: Optional[Callable] = None
        self.running = False
        
    def set_transfer_handler(self, handler: Callable):
        """Set the handler for transfer events"""
        self.transfer_handler = handler
        
    async def process_transfer(self, message: Dict[str, Any]):
        """Process a transfer event from TigerBeetle"""
        if self.transfer_handler:
            transfer_id = message.get("transfer_id")
            logger.info(f"Processing TigerBeetle transfer: {transfer_id}")
            await self.transfer_handler(message)
        else:
            logger.warning("No transfer handler configured")
            
    async def start(self):
        """Start consuming transfer events"""
        self.running = True
        logger.info(f"Starting consumer for topic: {self.topic}, group: {self.group_id}")
        
    async def stop(self):
        """Stop consuming transfer events"""
        self.running = False
        logger.info(f"Stopped consumer for topic: {self.topic}")


# Singleton instances for use across services
domain_event_consumer = DomainEventConsumer()
payment_retry_consumer = PaymentRetryConsumer()
tigerbeetle_transfer_consumer = TigerBeetleTransferConsumer()
