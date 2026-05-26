"""
Offline Payments Service

Enables payment processing in offline/low-connectivity scenarios with automatic synchronization.
Inspired by PIX's offline payment capability.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import json

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as aioredis
from temporalio import workflow, activity
from temporalio.client import Client as TemporalClient
from temporalio.common import RetryPolicy
import uvicorn

from routers import router as offline_router

from routers import router as offline_router
# Initialize event integration for lakehouse
try:
    from . import events_integration
except ImportError:
    import events_integration



# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Offline Payments Service")

# Global state
redis_client: Optional[aioredis.Redis] = None
temporal_client: Optional[TemporalClient] = None


class TransactionStatus(str, Enum):
    """Transaction status enumeration."""
    PENDING = "pending"
    QUEUED = "queued"
    SYNCING = "syncing"
    SYNCED = "synced"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class SyncStatus(str, Enum):
    """Sync status enumeration."""
    NOT_SYNCED = "not_synced"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


@dataclass
class OfflineTransaction:
    """Offline transaction."""
    transaction_id: str
    payer_id: str
    payee_id: str
    amount: float
    currency: str
    channel: str
    device_id: str
    created_at: datetime
    expires_at: datetime
    status: TransactionStatus
    sync_status: SyncStatus
    sync_attempts: int = 0
    last_sync_attempt: Optional[datetime] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict] = None


class OfflineTransactionRequest(BaseModel):
    """Offline transaction request."""
    payer_id: str
    payee_id: str
    amount: float
    currency: str
    channel: str
    device_id: str
    metadata: Optional[Dict] = None


class SyncRequest(BaseModel):
    """Sync request."""
    transaction_ids: List[str]


class OfflinePaymentService:
    """
    Offline Payment Service
    
    Handles payment processing in offline/low-connectivity scenarios.
    """
    
    def __init__(self, redis_client: aioredis.Redis, temporal_client: TemporalClient):
        self.redis = redis_client
        self.temporal = temporal_client
        
        # Configuration
        self.max_offline_duration = timedelta(hours=24)
        self.max_sync_attempts = 5
        self.sync_batch_size = 100
        
    async def create_offline_transaction(
        self,
        request: OfflineTransactionRequest
    ) -> OfflineTransaction:
        """
        Create an offline transaction.
        
        Args:
            request: Offline transaction request
            
        Returns:
            OfflineTransaction
        """
        try:
            # Generate transaction ID
            transaction_id = f"offline_{uuid.uuid4().hex}"
            
            # Create transaction
            now = datetime.now()
            transaction = OfflineTransaction(
                transaction_id=transaction_id,
                payer_id=request.payer_id,
                payee_id=request.payee_id,
                amount=request.amount,
                currency=request.currency,
                channel=request.channel,
                device_id=request.device_id,
                created_at=now,
                expires_at=now + self.max_offline_duration,
                status=TransactionStatus.PENDING,
                sync_status=SyncStatus.NOT_SYNCED,
                metadata=request.metadata
            )
            
            # Store in Redis
            await self._store_transaction(transaction)
            
            # Add to sync queue
            await self.redis.lpush("offline_sync_queue", transaction_id)
            
            logger.info(f"Created offline transaction: {transaction_id}")
            
            return transaction
            
        except Exception as e:
            logger.error(f"Failed to create offline transaction: {e}")
            raise
    
    async def sync_transactions(
        self,
        transaction_ids: Optional[List[str]] = None
    ) -> Dict:
        """
        Sync offline transactions to the main ledger.
        
        Args:
            transaction_ids: Optional list of transaction IDs to sync
            
        Returns:
            Sync result
        """
        try:
            # Get transactions to sync
            if transaction_ids:
                transactions = []
                for txn_id in transaction_ids:
                    txn = await self._get_transaction(txn_id)
                    if txn:
                        transactions.append(txn)
            else:
                # Get from sync queue
                transactions = await self._get_pending_transactions(self.sync_batch_size)
            
            if not transactions:
                return {
                    'synced': 0,
                    'failed': 0,
                    'message': 'No transactions to sync'
                }
            
            # Sync transactions
            synced = 0
            failed = 0
            
            for transaction in transactions:
                try:
                    # Check if expired
                    if datetime.now() > transaction.expires_at:
                        transaction.status = TransactionStatus.EXPIRED
                        transaction.sync_status = SyncStatus.FAILED
                        transaction.error_message = "Transaction expired"
                        await self._store_transaction(transaction)
                        failed += 1
                        continue
                    
                    # Update status
                    transaction.status = TransactionStatus.SYNCING
                    transaction.sync_status = SyncStatus.SYNCING
                    transaction.sync_attempts += 1
                    transaction.last_sync_attempt = datetime.now()
                    await self._store_transaction(transaction)
                    
                    # Execute sync workflow
                    result = await self._execute_sync_workflow(transaction)
                    
                    if result['success']:
                        transaction.status = TransactionStatus.COMPLETED
                        transaction.sync_status = SyncStatus.SYNCED
                        synced += 1
                    else:
                        transaction.status = TransactionStatus.FAILED
                        transaction.sync_status = SyncStatus.FAILED
                        transaction.error_message = result.get('error', 'Unknown error')
                        failed += 1
                    
                    await self._store_transaction(transaction)
                    
                except Exception as e:
                    logger.error(f"Failed to sync transaction {transaction.transaction_id}: {e}")
                    transaction.status = TransactionStatus.FAILED
                    transaction.sync_status = SyncStatus.FAILED
                    transaction.error_message = str(e)
                    await self._store_transaction(transaction)
                    failed += 1
            
            return {
                'synced': synced,
                'failed': failed,
                'message': f'Synced {synced} transactions, {failed} failed'
            }
            
        except Exception as e:
            logger.error(f"Sync failed: {e}")
            raise
    
    async def get_transaction_status(self, transaction_id: str) -> Optional[Dict]:
        """Get transaction status."""
        transaction = await self._get_transaction(transaction_id)
        if transaction:
            return {
                'transaction_id': transaction.transaction_id,
                'status': transaction.status.value,
                'sync_status': transaction.sync_status.value,
                'created_at': transaction.created_at.isoformat(),
                'expires_at': transaction.expires_at.isoformat(),
                'sync_attempts': transaction.sync_attempts,
                'last_sync_attempt': transaction.last_sync_attempt.isoformat() if transaction.last_sync_attempt else None,
                'error_message': transaction.error_message
            }
        return None
    
    async def get_pending_count(self) -> int:
        """Get count of pending transactions."""
        return await self.redis.llen("offline_sync_queue")
    
    # Private methods
    
    async def _store_transaction(self, transaction: OfflineTransaction):
        """Store transaction in Redis."""
        data = {
            'transaction_id': transaction.transaction_id,
            'payer_id': transaction.payer_id,
            'payee_id': transaction.payee_id,
            'amount': transaction.amount,
            'currency': transaction.currency,
            'channel': transaction.channel,
            'device_id': transaction.device_id,
            'created_at': transaction.created_at.isoformat(),
            'expires_at': transaction.expires_at.isoformat(),
            'status': transaction.status.value,
            'sync_status': transaction.sync_status.value,
            'sync_attempts': transaction.sync_attempts,
            'last_sync_attempt': transaction.last_sync_attempt.isoformat() if transaction.last_sync_attempt else None,
            'error_message': transaction.error_message,
            'metadata': json.dumps(transaction.metadata) if transaction.metadata else None
        }
        
        await self.redis.setex(
            f"offline_txn:{transaction.transaction_id}",
            86400 * 2,  # 2 days TTL
            json.dumps(data)
        )
    
    async def _get_transaction(self, transaction_id: str) -> Optional[OfflineTransaction]:
        """Get transaction from Redis."""
        data = await self.redis.get(f"offline_txn:{transaction_id}")
        if data:
            txn_dict = json.loads(data)
            return OfflineTransaction(
                transaction_id=txn_dict['transaction_id'],
                payer_id=txn_dict['payer_id'],
                payee_id=txn_dict['payee_id'],
                amount=txn_dict['amount'],
                currency=txn_dict['currency'],
                channel=txn_dict['channel'],
                device_id=txn_dict['device_id'],
                created_at=datetime.fromisoformat(txn_dict['created_at']),
                expires_at=datetime.fromisoformat(txn_dict['expires_at']),
                status=TransactionStatus(txn_dict['status']),
                sync_status=SyncStatus(txn_dict['sync_status']),
                sync_attempts=txn_dict['sync_attempts'],
                last_sync_attempt=datetime.fromisoformat(txn_dict['last_sync_attempt']) if txn_dict['last_sync_attempt'] else None,
                error_message=txn_dict['error_message'],
                metadata=json.loads(txn_dict['metadata']) if txn_dict['metadata'] else None
            )
        return None
    
    async def _get_pending_transactions(self, limit: int) -> List[OfflineTransaction]:
        """Get pending transactions from sync queue."""
        transactions = []
        
        # Get transaction IDs from queue
        txn_ids = await self.redis.lrange("offline_sync_queue", 0, limit - 1)
        
        for txn_id in txn_ids:
            txn = await self._get_transaction(txn_id.decode('utf-8') if isinstance(txn_id, bytes) else txn_id)
            if txn:
                transactions.append(txn)
                # Remove from queue
                await self.redis.lrem("offline_sync_queue", 1, txn_id)
        
        return transactions
    
    async def _execute_sync_workflow(self, transaction: OfflineTransaction) -> Dict:
        """Execute sync workflow via Temporal."""
        try:
            # In production, execute Temporal workflow
            # For now, simulate sync
            
            logger.info(f"Syncing transaction {transaction.transaction_id} to main ledger")
            
            # Simulate processing time
            await asyncio.sleep(0.1)
            
            # Simulate success
            return {
                'success': True,
                'ledger_transfer_id': f"transfer_{transaction.transaction_id}"
            }
            
        except Exception as e:
            logger.error(f"Sync workflow failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }


# Background task for automatic sync
async def auto_sync_task():
    """Background task for automatic synchronization."""
    while True:
        try:
            service: OfflinePaymentService = app.state.offline_service
            
            # Check pending count
            pending = await service.get_pending_count()
            
            if pending > 0:
                logger.info(f"Auto-syncing {pending} pending transactions")
                result = await service.sync_transactions()
                logger.info(f"Auto-sync result: {result}")
            
            # Wait before next sync
            await asyncio.sleep(60)  # Sync every minute
            
        except Exception as e:
            logger.error(f"Auto-sync task failed: {e}")
            await asyncio.sleep(60)


# API endpoints

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    global redis_client, temporal_client
    
    # Connect to Redis
    redis_client = await aioredis.from_url(
        "redis://localhost:6379",
        encoding="utf-8",
        decode_responses=False
    )
    
    # Connect to Temporal (in production)
    # temporal_client = await TemporalClient.connect("localhost:7233")
    
    # Initialize offline payment service
    offline_service = OfflinePaymentService(redis_client, temporal_client)
    app.state.offline_service = offline_service
    
    # Start auto-sync background task
    asyncio.create_task(auto_sync_task())
    
    logger.info("Offline Payments Service started")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    if redis_client:
        await redis_client.close()


@app.post("/transactions", response_model=Dict)
async def create_offline_transaction(request: OfflineTransactionRequest):
    """
    Create an offline transaction.
    
    Args:
        request: Offline transaction request
        
    Returns:
        Transaction details
    """
    try:
        service: OfflinePaymentService = app.state.offline_service
        transaction = await service.create_offline_transaction(request)
        
        return {
            'transaction_id': transaction.transaction_id,
            'status': transaction.status.value,
            'sync_status': transaction.sync_status.value,
            'created_at': transaction.created_at.isoformat(),
            'expires_at': transaction.expires_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to create offline transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sync", response_model=Dict)
async def sync_transactions(request: Optional[SyncRequest] = None):
    """
    Sync offline transactions.
    
    Args:
        request: Optional sync request with transaction IDs
        
    Returns:
        Sync result
    """
    try:
        service: OfflinePaymentService = app.state.offline_service
        
        transaction_ids = request.transaction_ids if request else None
        result = await service.sync_transactions(transaction_ids)
        
        return result
        
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/transactions/{transaction_id}", response_model=Dict)
async def get_transaction_status(transaction_id: str):
    """
    Get transaction status.
    
    Args:
        transaction_id: Transaction ID
        
    Returns:
        Transaction status
    """
    try:
        service: OfflinePaymentService = app.state.offline_service
        status = await service.get_transaction_status(transaction_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get transaction status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pending", response_model=Dict)
async def get_pending_count():
    """
    Get count of pending transactions.
    
    Returns:
        Pending count
    """
    try:
        service: OfflinePaymentService = app.state.offline_service
        count = await service.get_pending_count()
        
        return {'pending_count': count}
        
    except Exception as e:
        logger.error(f"Failed to get pending count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
