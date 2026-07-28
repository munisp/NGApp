"""
Kafka Consumer Deduplication Service
Ensures exactly-once processing semantics for Kafka messages
"""

import hashlib
import json
import redis
from typing import Optional, Callable, Any, Dict
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class MessageStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ProcessedMessage:
    message_id: str
    topic: str
    partition: int
    offset: int
    status: MessageStatus
    processed_at: str
    result: Optional[str] = None


class KafkaDeduplicationService:
    """
    Service for deduplicating Kafka messages to achieve exactly-once processing.
    Uses Redis for distributed tracking of processed messages.
    """
    
    def __init__(
        self,
        redis_host: str = "redis",
        redis_port: int = 6379,
        redis_db: int = 2,
        default_ttl: int = 604800  # 7 days
    ):
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=True
        )
        self.default_ttl = default_ttl
        self.key_prefix = "kafka:dedup:"
    
    def _generate_message_id(self, topic: str, partition: int, offset: int) -> str:
        """Generate unique message ID from topic, partition, and offset"""
        return f"{topic}:{partition}:{offset}"
    
    def _generate_content_hash(self, message_content: Dict[str, Any]) -> str:
        """Generate hash of message content for content-based deduplication"""
        content_str = json.dumps(message_content, sort_keys=True)
        return hashlib.sha256(content_str.encode()).hexdigest()
    
    def _get_key(self, message_id: str) -> str:
        """Generate Redis key from message ID"""
        return f"{self.key_prefix}{message_id}"
    
    def _get_content_key(self, content_hash: str) -> str:
        """Generate Redis key from content hash"""
        return f"{self.key_prefix}content:{content_hash}"
    
    def is_duplicate(
        self,
        topic: str,
        partition: int,
        offset: int
    ) -> bool:
        """Check if message has already been processed (offset-based)"""
        message_id = self._generate_message_id(topic, partition, offset)
        key = self._get_key(message_id)
        return self.redis_client.exists(key) == 1
    
    def is_content_duplicate(
        self,
        message_content: Dict[str, Any],
        window_seconds: int = 300  # 5 minute window
    ) -> bool:
        """
        Check if message with same content was processed recently (content-based).
        Useful for detecting duplicate events even if they have different offsets.
        """
        content_hash = self._generate_content_hash(message_content)
        key = self._get_content_key(content_hash)
        return self.redis_client.exists(key) == 1
    
    def mark_processing(
        self,
        topic: str,
        partition: int,
        offset: int,
        message_content: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Mark message as being processed. Returns True if lock acquired.
        Uses Redis SETNX for atomic operation.
        """
        message_id = self._generate_message_id(topic, partition, offset)
        key = self._get_key(message_id)
        lock_key = f"{key}:lock"
        
        acquired = self.redis_client.setnx(lock_key, "1")
        if acquired:
            self.redis_client.expire(lock_key, 300)  # 5 minute processing timeout
            
            if message_content:
                content_hash = self._generate_content_hash(message_content)
                content_key = self._get_content_key(content_hash)
                self.redis_client.setex(content_key, 300, message_id)
        
        return acquired
    
    def mark_completed(
        self,
        topic: str,
        partition: int,
        offset: int,
        result: Optional[str] = None,
        ttl: Optional[int] = None
    ):
        """Mark message as successfully processed"""
        message_id = self._generate_message_id(topic, partition, offset)
        key = self._get_key(message_id)
        lock_key = f"{key}:lock"
        
        processed = ProcessedMessage(
            message_id=message_id,
            topic=topic,
            partition=partition,
            offset=offset,
            status=MessageStatus.COMPLETED,
            processed_at=datetime.utcnow().isoformat(),
            result=result
        )
        
        self.redis_client.setex(
            key,
            ttl or self.default_ttl,
            json.dumps({
                "message_id": processed.message_id,
                "topic": processed.topic,
                "partition": processed.partition,
                "offset": processed.offset,
                "status": processed.status.value,
                "processed_at": processed.processed_at,
                "result": processed.result
            })
        )
        self.redis_client.delete(lock_key)
    
    def mark_failed(
        self,
        topic: str,
        partition: int,
        offset: int,
        error: Optional[str] = None
    ):
        """Mark message as failed, allowing retry"""
        message_id = self._generate_message_id(topic, partition, offset)
        key = self._get_key(message_id)
        lock_key = f"{key}:lock"
        
        self.redis_client.delete(lock_key)
        
        failed_key = f"{key}:failed"
        self.redis_client.setex(failed_key, 3600, error or "Unknown error")  # 1 hour retry window
    
    def get_processing_status(
        self,
        topic: str,
        partition: int,
        offset: int
    ) -> Optional[ProcessedMessage]:
        """Get the processing status of a message"""
        message_id = self._generate_message_id(topic, partition, offset)
        key = self._get_key(message_id)
        
        data = self.redis_client.get(key)
        if data:
            parsed = json.loads(data)
            return ProcessedMessage(
                message_id=parsed["message_id"],
                topic=parsed["topic"],
                partition=parsed["partition"],
                offset=parsed["offset"],
                status=MessageStatus(parsed["status"]),
                processed_at=parsed["processed_at"],
                result=parsed.get("result")
            )
        return None


class IdempotentKafkaConsumer:
    """
    Wrapper for Kafka consumers that provides exactly-once processing semantics.
    
    Usage:
        consumer = IdempotentKafkaConsumer(dedup_service)
        
        for message in kafka_consumer:
            async def process():
                # Your processing logic
                return result
            
            result = await consumer.process_message(
                message.topic,
                message.partition,
                message.offset,
                message.value,
                process
            )
    """
    
    def __init__(self, dedup_service: Optional[KafkaDeduplicationService] = None):
        self.dedup = dedup_service or KafkaDeduplicationService()
    
    async def process_message(
        self,
        topic: str,
        partition: int,
        offset: int,
        message_content: Dict[str, Any],
        processor: Callable[[], Any],
        enable_content_dedup: bool = True
    ) -> Optional[Any]:
        """
        Process a Kafka message with deduplication.
        
        Args:
            topic: Kafka topic name
            partition: Partition number
            offset: Message offset
            message_content: Parsed message content
            processor: Async function to process the message
            enable_content_dedup: Also check for content-based duplicates
            
        Returns:
            Processing result or None if duplicate
        """
        if self.dedup.is_duplicate(topic, partition, offset):
            logger.info(f"Skipping duplicate message: {topic}:{partition}:{offset}")
            return None
        
        if enable_content_dedup and self.dedup.is_content_duplicate(message_content):
            logger.info(f"Skipping content-duplicate message: {topic}:{partition}:{offset}")
            return None
        
        if not self.dedup.mark_processing(topic, partition, offset, message_content):
            logger.info(f"Message already being processed: {topic}:{partition}:{offset}")
            return None
        
        try:
            result = await processor()
            
            self.dedup.mark_completed(
                topic, partition, offset,
                result=json.dumps(result) if result else None
            )
            
            logger.info(f"Successfully processed message: {topic}:{partition}:{offset}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to process message: {topic}:{partition}:{offset} - {str(e)}")
            self.dedup.mark_failed(topic, partition, offset, str(e))
            raise


class EventDeduplicator:
    """
    Higher-level deduplication for domain events.
    Uses event ID or generates one from event content.
    """
    
    def __init__(
        self,
        redis_host: str = "redis",
        redis_port: int = 6379,
        redis_db: int = 3,
        default_ttl: int = 86400  # 24 hours
    ):
        self.redis_client = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            decode_responses=True
        )
        self.default_ttl = default_ttl
        self.key_prefix = "event:dedup:"
    
    def _get_event_id(self, event: Dict[str, Any]) -> str:
        """Extract or generate event ID"""
        if "event_id" in event:
            return event["event_id"]
        if "id" in event:
            return event["id"]
        
        content = json.dumps(event, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()
    
    def is_processed(self, event: Dict[str, Any]) -> bool:
        """Check if event has already been processed"""
        event_id = self._get_event_id(event)
        key = f"{self.key_prefix}{event_id}"
        return self.redis_client.exists(key) == 1
    
    def mark_processed(
        self,
        event: Dict[str, Any],
        result: Optional[str] = None,
        ttl: Optional[int] = None
    ):
        """Mark event as processed"""
        event_id = self._get_event_id(event)
        key = f"{self.key_prefix}{event_id}"
        
        data = {
            "event_id": event_id,
            "processed_at": datetime.utcnow().isoformat(),
            "result": result
        }
        
        self.redis_client.setex(key, ttl or self.default_ttl, json.dumps(data))
    
    async def process_event(
        self,
        event: Dict[str, Any],
        processor: Callable[[], Any]
    ) -> Optional[Any]:
        """Process event with deduplication"""
        if self.is_processed(event):
            logger.info(f"Skipping duplicate event: {self._get_event_id(event)}")
            return None
        
        result = await processor()
        self.mark_processed(event, json.dumps(result) if result else None)
        return result
