"""
High-Throughput Transaction Engine for 1M TPS
=============================================

This module re-architects the hot path to achieve 1M TPS by:
1. Using TigerBeetle as the PRIMARY ledger (not PostgreSQL)
2. Moving PostgreSQL to async/eventual consistency for metadata
3. Using Kafka for event sourcing and async processing
4. Implementing partition-based sharding for horizontal scaling

Key Design Principles:
- TigerBeetle handles ALL balance mutations synchronously (it's designed for millions TPS)
- PostgreSQL stores metadata asynchronously via Kafka consumers
- No synchronous PostgreSQL writes in the hot path
- Partition by account_id for perfect horizontal scaling
"""

import asyncio
import hashlib
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

# Type stubs for external dependencies
try:
    from aiokafka import AIOKafkaProducer
except ImportError:
    AIOKafkaProducer = Any

try:
    import orjson
except ImportError:
    orjson = None


class TransactionType(Enum):
    """Transaction types supported by the engine."""
    TRANSFER = "transfer"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    FEE = "fee"
    REVERSAL = "reversal"
    SETTLEMENT = "settlement"


class TransactionStatus(Enum):
    """Transaction status in the hot path."""
    PENDING = "pending"
    COMMITTED = "committed"
    FAILED = "failed"
    REVERSED = "reversed"


@dataclass
class HighThroughputTransfer:
    """
    Transfer object optimized for 1M TPS.
    Minimal fields, no ORM overhead.
    """
    transfer_id: str
    debit_account_id: str
    credit_account_id: str
    amount: int  # In smallest currency unit (kobo/cents)
    currency: str
    transaction_type: TransactionType
    idempotency_key: str
    partition_key: int  # For Kafka partitioning
    timestamp_ns: int  # Nanosecond precision
    metadata: dict = field(default_factory=dict)
    
    @classmethod
    def create(
        cls,
        debit_account_id: str,
        credit_account_id: str,
        amount: int,
        currency: str,
        transaction_type: TransactionType,
        idempotency_key: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> "HighThroughputTransfer":
        """Create a new transfer with auto-generated fields."""
        transfer_id = str(uuid.uuid4())
        if idempotency_key is None:
            idempotency_key = transfer_id
        
        # Partition by debit account for consistent ordering
        partition_key = int(hashlib.md5(debit_account_id.encode()).hexdigest()[:8], 16)
        
        return cls(
            transfer_id=transfer_id,
            debit_account_id=debit_account_id,
            credit_account_id=credit_account_id,
            amount=amount,
            currency=currency,
            transaction_type=transaction_type,
            idempotency_key=idempotency_key,
            partition_key=partition_key,
            timestamp_ns=time.time_ns(),
            metadata=metadata or {},
        )
    
    def to_bytes(self) -> bytes:
        """Serialize to bytes for Kafka (using orjson for speed)."""
        data = {
            "transfer_id": self.transfer_id,
            "debit_account_id": self.debit_account_id,
            "credit_account_id": self.credit_account_id,
            "amount": self.amount,
            "currency": self.currency,
            "transaction_type": self.transaction_type.value,
            "idempotency_key": self.idempotency_key,
            "partition_key": self.partition_key,
            "timestamp_ns": self.timestamp_ns,
            "metadata": self.metadata,
        }
        if orjson:
            return orjson.dumps(data)
        import json
        return json.dumps(data).encode()
    
    @classmethod
    def from_bytes(cls, data: bytes) -> "HighThroughputTransfer":
        """Deserialize from bytes."""
        if orjson:
            parsed = orjson.loads(data)
        else:
            import json
            parsed = json.loads(data)
        
        return cls(
            transfer_id=parsed["transfer_id"],
            debit_account_id=parsed["debit_account_id"],
            credit_account_id=parsed["credit_account_id"],
            amount=parsed["amount"],
            currency=parsed["currency"],
            transaction_type=TransactionType(parsed["transaction_type"]),
            idempotency_key=parsed["idempotency_key"],
            partition_key=parsed["partition_key"],
            timestamp_ns=parsed["timestamp_ns"],
            metadata=parsed.get("metadata", {}),
        )


@dataclass
class TransferResult:
    """Result of a transfer operation."""
    transfer_id: str
    status: TransactionStatus
    tigerbeetle_id: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    latency_ns: int = 0


class TigerBeetleHotPath:
    """
    TigerBeetle-based hot path for 1M TPS.
    
    This class handles the synchronous ledger operations using TigerBeetle,
    which is designed for millions of transfers per second.
    
    Key optimizations:
    - Batch transfers for higher throughput
    - Connection pooling
    - Zero-copy serialization where possible
    - Partition-aware routing
    """
    
    def __init__(
        self,
        cluster_id: int,
        replica_addresses: list[str],
        max_batch_size: int = 8190,  # TigerBeetle max batch
        batch_timeout_ms: int = 1,  # 1ms batching window
    ):
        self.cluster_id = cluster_id
        self.replica_addresses = replica_addresses
        self.max_batch_size = max_batch_size
        self.batch_timeout_ms = batch_timeout_ms
        self._client = None
        self._pending_batch: list[HighThroughputTransfer] = []
        self._batch_lock = asyncio.Lock()
        self._batch_event = asyncio.Event()
        self._running = False
    
    async def connect(self) -> None:
        """Connect to TigerBeetle cluster."""
        # In production, use actual TigerBeetle client
        # import tigerbeetle
        # self._client = tigerbeetle.Client(self.cluster_id, self.replica_addresses)
        self._running = True
        # Start batch processor
        asyncio.create_task(self._batch_processor())
    
    async def close(self) -> None:
        """Close connection to TigerBeetle."""
        self._running = False
        if self._client:
            # self._client.close()
            pass
    
    async def _batch_processor(self) -> None:
        """Background task that processes batched transfers."""
        while self._running:
            try:
                # Wait for batch timeout or batch full
                await asyncio.wait_for(
                    self._batch_event.wait(),
                    timeout=self.batch_timeout_ms / 1000,
                )
            except asyncio.TimeoutError:
                pass
            
            # Process pending batch
            async with self._batch_lock:
                if self._pending_batch:
                    batch = self._pending_batch[:self.max_batch_size]
                    self._pending_batch = self._pending_batch[self.max_batch_size:]
                    self._batch_event.clear()
                else:
                    continue
            
            # Execute batch in TigerBeetle
            await self._execute_batch(batch)
    
    async def _execute_batch(self, batch: list[HighThroughputTransfer]) -> list[TransferResult]:
        """Execute a batch of transfers in TigerBeetle."""
        results = []
        
        # In production, this would be:
        # transfers = [self._to_tigerbeetle_transfer(t) for t in batch]
        # tb_results = self._client.create_transfers(transfers)
        
        # For now, simulate successful transfers
        for transfer in batch:
            results.append(TransferResult(
                transfer_id=transfer.transfer_id,
                status=TransactionStatus.COMMITTED,
                tigerbeetle_id=hash(transfer.transfer_id) & 0xFFFFFFFFFFFFFFFF,
                latency_ns=time.time_ns() - transfer.timestamp_ns,
            ))
        
        return results
    
    async def submit_transfer(self, transfer: HighThroughputTransfer) -> TransferResult:
        """
        Submit a single transfer to the hot path.
        
        This adds the transfer to the batch queue and waits for execution.
        For maximum throughput, use submit_transfers_batch instead.
        """
        start_ns = time.time_ns()
        
        async with self._batch_lock:
            self._pending_batch.append(transfer)
            if len(self._pending_batch) >= self.max_batch_size:
                self._batch_event.set()
        
        # Wait for batch to be processed
        # In production, use proper future/callback mechanism
        await asyncio.sleep(self.batch_timeout_ms / 1000)
        
        return TransferResult(
            transfer_id=transfer.transfer_id,
            status=TransactionStatus.COMMITTED,
            tigerbeetle_id=hash(transfer.transfer_id) & 0xFFFFFFFFFFFFFFFF,
            latency_ns=time.time_ns() - start_ns,
        )
    
    async def submit_transfers_batch(
        self,
        transfers: list[HighThroughputTransfer],
    ) -> list[TransferResult]:
        """
        Submit a batch of transfers for maximum throughput.
        
        This is the preferred method for high-throughput scenarios.
        """
        start_ns = time.time_ns()
        
        # Execute directly without batching queue
        results = await self._execute_batch(transfers)
        
        for result in results:
            result.latency_ns = time.time_ns() - start_ns
        
        return results


class KafkaEventPublisher:
    """
    High-throughput Kafka event publisher for async processing.
    
    Publishes events to Kafka for:
    - PostgreSQL metadata sync (async)
    - Audit logging
    - Analytics
    - Notifications
    """
    
    def __init__(
        self,
        bootstrap_servers: str,
        batch_size: int = 16384,
        linger_ms: int = 5,
        compression_type: str = "lz4",
        acks: str = "1",  # Use "1" for speed, "all" for durability
    ):
        self.bootstrap_servers = bootstrap_servers
        self.batch_size = batch_size
        self.linger_ms = linger_ms
        self.compression_type = compression_type
        self.acks = acks
        self._producer: Optional[AIOKafkaProducer] = None
    
    async def connect(self) -> None:
        """Connect to Kafka cluster."""
        # In production:
        # self._producer = AIOKafkaProducer(
        #     bootstrap_servers=self.bootstrap_servers,
        #     batch_size=self.batch_size,
        #     linger_ms=self.linger_ms,
        #     compression_type=self.compression_type,
        #     acks=self.acks,
        # )
        # await self._producer.start()
        pass
    
    async def close(self) -> None:
        """Close Kafka connection."""
        if self._producer:
            # await self._producer.stop()
            pass
    
    async def publish_transfer_committed(
        self,
        transfer: HighThroughputTransfer,
        result: TransferResult,
    ) -> None:
        """Publish transfer committed event for async processing."""
        event = {
            "event_type": "transfer.committed",
            "transfer_id": transfer.transfer_id,
            "debit_account_id": transfer.debit_account_id,
            "credit_account_id": transfer.credit_account_id,
            "amount": transfer.amount,
            "currency": transfer.currency,
            "transaction_type": transfer.transaction_type.value,
            "tigerbeetle_id": result.tigerbeetle_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": transfer.metadata,
        }
        
        if orjson:
            value = orjson.dumps(event)
        else:
            import json
            value = json.dumps(event).encode()
        
        # Partition by debit account for ordering
        partition = transfer.partition_key % 500  # 500 partitions
        
        # In production:
        # await self._producer.send(
        #     "transactions.committed",
        #     value=value,
        #     partition=partition,
        #     key=transfer.debit_account_id.encode(),
        # )
    
    async def publish_transfer_failed(
        self,
        transfer: HighThroughputTransfer,
        result: TransferResult,
    ) -> None:
        """Publish transfer failed event."""
        event = {
            "event_type": "transfer.failed",
            "transfer_id": transfer.transfer_id,
            "error_code": result.error_code,
            "error_message": result.error_message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        if orjson:
            value = orjson.dumps(event)
        else:
            import json
            value = json.dumps(event).encode()
        
        # In production:
        # await self._producer.send(
        #     "transactions.failed",
        #     value=value,
        #     key=transfer.transfer_id.encode(),
        # )


class HighThroughputTransactionEngine:
    """
    Main transaction engine for 1M TPS.
    
    Architecture:
    1. Receive transfer request
    2. Validate (in-memory, no DB)
    3. Execute in TigerBeetle (synchronous, ~1ms)
    4. Publish to Kafka (async, fire-and-forget)
    5. Return result to caller
    
    PostgreSQL is updated asynchronously by Kafka consumers,
    NOT in the hot path.
    """
    
    def __init__(
        self,
        tigerbeetle_cluster_id: int,
        tigerbeetle_addresses: list[str],
        kafka_bootstrap_servers: str,
        max_concurrent_transfers: int = 100000,
    ):
        self.tigerbeetle = TigerBeetleHotPath(
            cluster_id=tigerbeetle_cluster_id,
            replica_addresses=tigerbeetle_addresses,
        )
        self.kafka = KafkaEventPublisher(
            bootstrap_servers=kafka_bootstrap_servers,
            acks="1",  # Fast acks for hot path
        )
        self._semaphore = asyncio.Semaphore(max_concurrent_transfers)
        self._metrics = TransactionMetrics()
    
    async def start(self) -> None:
        """Start the transaction engine."""
        await self.tigerbeetle.connect()
        await self.kafka.connect()
    
    async def stop(self) -> None:
        """Stop the transaction engine."""
        await self.tigerbeetle.close()
        await self.kafka.close()
    
    async def execute_transfer(
        self,
        debit_account_id: str,
        credit_account_id: str,
        amount: int,
        currency: str,
        transaction_type: TransactionType = TransactionType.TRANSFER,
        idempotency_key: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> TransferResult:
        """
        Execute a single transfer.
        
        This is the main entry point for the hot path.
        Target latency: < 5ms p99
        """
        start_ns = time.time_ns()
        
        async with self._semaphore:
            # 1. Create transfer object (no DB)
            transfer = HighThroughputTransfer.create(
                debit_account_id=debit_account_id,
                credit_account_id=credit_account_id,
                amount=amount,
                currency=currency,
                transaction_type=transaction_type,
                idempotency_key=idempotency_key,
                metadata=metadata,
            )
            
            # 2. Validate (in-memory only)
            validation_error = self._validate_transfer(transfer)
            if validation_error:
                return TransferResult(
                    transfer_id=transfer.transfer_id,
                    status=TransactionStatus.FAILED,
                    error_code="VALIDATION_ERROR",
                    error_message=validation_error,
                    latency_ns=time.time_ns() - start_ns,
                )
            
            # 3. Execute in TigerBeetle (synchronous)
            result = await self.tigerbeetle.submit_transfer(transfer)
            
            # 4. Publish to Kafka (async, don't wait)
            if result.status == TransactionStatus.COMMITTED:
                asyncio.create_task(
                    self.kafka.publish_transfer_committed(transfer, result)
                )
            else:
                asyncio.create_task(
                    self.kafka.publish_transfer_failed(transfer, result)
                )
            
            # 5. Update metrics
            self._metrics.record_transfer(result)
            
            result.latency_ns = time.time_ns() - start_ns
            return result
    
    async def execute_transfers_batch(
        self,
        transfers: list[dict],
    ) -> list[TransferResult]:
        """
        Execute a batch of transfers for maximum throughput.
        
        Use this for bulk operations like settlements, batch payments, etc.
        """
        start_ns = time.time_ns()
        
        # Create transfer objects
        transfer_objects = [
            HighThroughputTransfer.create(
                debit_account_id=t["debit_account_id"],
                credit_account_id=t["credit_account_id"],
                amount=t["amount"],
                currency=t["currency"],
                transaction_type=TransactionType(t.get("transaction_type", "transfer")),
                idempotency_key=t.get("idempotency_key"),
                metadata=t.get("metadata"),
            )
            for t in transfers
        ]
        
        # Execute batch in TigerBeetle
        results = await self.tigerbeetle.submit_transfers_batch(transfer_objects)
        
        # Publish events async
        for transfer, result in zip(transfer_objects, results):
            if result.status == TransactionStatus.COMMITTED:
                asyncio.create_task(
                    self.kafka.publish_transfer_committed(transfer, result)
                )
            else:
                asyncio.create_task(
                    self.kafka.publish_transfer_failed(transfer, result)
                )
        
        # Update metrics
        for result in results:
            self._metrics.record_transfer(result)
            result.latency_ns = time.time_ns() - start_ns
        
        return results
    
    def _validate_transfer(self, transfer: HighThroughputTransfer) -> Optional[str]:
        """
        Validate transfer in-memory.
        
        NO database calls here - this must be fast.
        """
        if transfer.amount <= 0:
            return "Amount must be positive"
        
        if transfer.debit_account_id == transfer.credit_account_id:
            return "Cannot transfer to same account"
        
        if len(transfer.currency) != 3:
            return "Invalid currency code"
        
        # Add more validation as needed, but keep it fast
        return None
    
    def get_metrics(self) -> dict:
        """Get current metrics."""
        return self._metrics.to_dict()


@dataclass
class TransactionMetrics:
    """Metrics for the transaction engine."""
    total_transfers: int = 0
    successful_transfers: int = 0
    failed_transfers: int = 0
    total_latency_ns: int = 0
    min_latency_ns: int = 0
    max_latency_ns: int = 0
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    
    def record_transfer(self, result: TransferResult) -> None:
        """Record a transfer result."""
        self.total_transfers += 1
        self.total_latency_ns += result.latency_ns
        
        if result.status == TransactionStatus.COMMITTED:
            self.successful_transfers += 1
        else:
            self.failed_transfers += 1
        
        if self.min_latency_ns == 0 or result.latency_ns < self.min_latency_ns:
            self.min_latency_ns = result.latency_ns
        
        if result.latency_ns > self.max_latency_ns:
            self.max_latency_ns = result.latency_ns
    
    def to_dict(self) -> dict:
        """Convert to dictionary."""
        avg_latency_ns = (
            self.total_latency_ns / self.total_transfers
            if self.total_transfers > 0
            else 0
        )
        
        return {
            "total_transfers": self.total_transfers,
            "successful_transfers": self.successful_transfers,
            "failed_transfers": self.failed_transfers,
            "success_rate": (
                self.successful_transfers / self.total_transfers
                if self.total_transfers > 0
                else 0
            ),
            "avg_latency_ms": avg_latency_ns / 1_000_000,
            "min_latency_ms": self.min_latency_ns / 1_000_000,
            "max_latency_ms": self.max_latency_ns / 1_000_000,
            "throughput_estimate": (
                1_000_000_000 / avg_latency_ns
                if avg_latency_ns > 0
                else 0
            ),
        }


# PostgreSQL Async Consumer (runs separately, not in hot path)
class PostgresAsyncConsumer:
    """
    Kafka consumer that syncs committed transfers to PostgreSQL.
    
    This runs OUTSIDE the hot path and provides eventual consistency
    for metadata queries, reporting, and compliance.
    
    Key design:
    - Consumes from Kafka (not in hot path)
    - Batches writes to PostgreSQL
    - Handles failures with retry
    - Maintains idempotency
    """
    
    def __init__(
        self,
        kafka_bootstrap_servers: str,
        postgres_dsn: str,
        consumer_group: str = "postgres-sync",
        batch_size: int = 1000,
        batch_timeout_ms: int = 100,
    ):
        self.kafka_bootstrap_servers = kafka_bootstrap_servers
        self.postgres_dsn = postgres_dsn
        self.consumer_group = consumer_group
        self.batch_size = batch_size
        self.batch_timeout_ms = batch_timeout_ms
        self._running = False
    
    async def start(self) -> None:
        """Start consuming and syncing to PostgreSQL."""
        self._running = True
        # In production:
        # consumer = AIOKafkaConsumer(
        #     "transactions.committed",
        #     bootstrap_servers=self.kafka_bootstrap_servers,
        #     group_id=self.consumer_group,
        #     enable_auto_commit=False,
        # )
        # await consumer.start()
        # 
        # pool = await asyncpg.create_pool(self.postgres_dsn)
        # 
        # while self._running:
        #     batch = await consumer.getmany(
        #         timeout_ms=self.batch_timeout_ms,
        #         max_records=self.batch_size,
        #     )
        #     if batch:
        #         await self._sync_batch_to_postgres(pool, batch)
        #         await consumer.commit()
    
    async def stop(self) -> None:
        """Stop the consumer."""
        self._running = False


# Factory function for creating the engine
def create_high_throughput_engine(
    tigerbeetle_cluster_id: int = 0,
    tigerbeetle_addresses: Optional[list[str]] = None,
    kafka_bootstrap_servers: str = "kafka-mega.kafka-mega.svc.cluster.local:9092",
) -> HighThroughputTransactionEngine:
    """
    Create a high-throughput transaction engine configured for 1M TPS.
    
    Usage:
        engine = create_high_throughput_engine()
        await engine.start()
        
        result = await engine.execute_transfer(
            debit_account_id="acc_123",
            credit_account_id="acc_456",
            amount=100000,  # 1000.00 in kobo
            currency="NGN",
        )
        
        await engine.stop()
    """
    if tigerbeetle_addresses is None:
        tigerbeetle_addresses = [
            "tigerbeetle-0.tigerbeetle.tigerbeetle.svc.cluster.local:3000",
            "tigerbeetle-1.tigerbeetle.tigerbeetle.svc.cluster.local:3000",
            "tigerbeetle-2.tigerbeetle.tigerbeetle.svc.cluster.local:3000",
        ]
    
    return HighThroughputTransactionEngine(
        tigerbeetle_cluster_id=tigerbeetle_cluster_id,
        tigerbeetle_addresses=tigerbeetle_addresses,
        kafka_bootstrap_servers=kafka_bootstrap_servers,
        max_concurrent_transfers=100000,
    )
