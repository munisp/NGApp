"""
PostgreSQL Database Connection Pool Manager
Optimized for high-performance database operations with connection pooling.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
import asyncpg
from asyncpg.pool import Pool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    PostgreSQL database manager with connection pooling.
    
    Features:
    - Connection pooling for high performance
    - Automatic connection management
    - Transaction support
    - Query optimization
    """
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        database: str = None,
        user: str = None,
        password: str = None,
        min_size: int = 10,
        max_size: int = 100,
        command_timeout: float = 60.0
    ):
        self.host = host or os.getenv("POSTGRES_HOST", "postgresql")
        self.port = port or int(os.getenv("POSTGRES_PORT", "5432"))
        self.database = database or os.getenv("POSTGRES_DB", "payment_switch")
        self.user = user or os.getenv("POSTGRES_USER", "postgres")
        self.password = password or os.getenv("POSTGRES_PASSWORD", "postgres")
        self.min_size = min_size
        self.max_size = max_size
        self.command_timeout = command_timeout
        self._pool: Optional[Pool] = None
    
    async def connect(self):
        """Initialize the connection pool"""
        logger.info(f"Connecting to PostgreSQL at {self.host}:{self.port}/{self.database}")
        
        self._pool = await asyncpg.create_pool(
            host=self.host,
            port=self.port,
            database=self.database,
            user=self.user,
            password=self.password,
            min_size=self.min_size,
            max_size=self.max_size,
            command_timeout=self.command_timeout
        )
        
        logger.info(f"Connected to PostgreSQL with pool size {self.min_size}-{self.max_size}")
    
    async def close(self):
        """Close the connection pool"""
        if self._pool:
            await self._pool.close()
            logger.info("PostgreSQL connection pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """
        Acquire a connection from the pool.
        
        Usage:
            async with db.acquire() as conn:
                result = await conn.fetch("SELECT * FROM table")
        """
        async with self._pool.acquire() as connection:
            yield connection
    
    @asynccontextmanager
    async def transaction(self):
        """
        Start a transaction.
        
        Usage:
            async with db.transaction() as tx:
                await tx.execute("INSERT INTO table VALUES ($1)", value)
        """
        async with self._pool.acquire() as connection:
            async with connection.transaction():
                yield connection
    
    async def execute(self, query: str, *args) -> str:
        """
        Execute a query that doesn't return results.
        
        Args:
            query: SQL query
            *args: Query parameters
            
        Returns:
            Status message
        """
        async with self.acquire() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        """
        Fetch multiple rows.
        
        Args:
            query: SQL query
            *args: Query parameters
            
        Returns:
            List of rows as dictionaries
        """
        async with self.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    
    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """
        Fetch a single row.
        
        Args:
            query: SQL query
            *args: Query parameters
            
        Returns:
            Row as dictionary or None
        """
        async with self.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    
    async def fetchval(self, query: str, *args) -> Any:
        """
        Fetch a single value.
        
        Args:
            query: SQL query
            *args: Query parameters
            
        Returns:
            Single value
        """
        async with self.acquire() as conn:
            return await conn.fetchval(query, *args)


# Transaction History Operations

async def insert_transaction_history(
    db: DatabaseManager,
    transaction_id: str,
    payer_id: str,
    payer_participant_id: str,
    payee_id: str,
    payee_participant_id: str,
    amount: str,
    currency: str,
    transaction_type: str,
    channel: str,
    status: str,
    tigerbeetle_transfer_id: str = None,
    metadata: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Insert a transaction into history"""
    query = """
        INSERT INTO transaction_history (
            transaction_id, tigerbeetle_transfer_id,
            payer_id, payer_participant_id,
            payee_id, payee_participant_id,
            amount, currency, transaction_type, channel,
            status, initiated_at, metadata
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12
        )
        RETURNING id, transaction_id, status, initiated_at
    """
    
    return await db.fetchrow(
        query,
        transaction_id, tigerbeetle_transfer_id,
        payer_id, payer_participant_id,
        payee_id, payee_participant_id,
        amount, currency, transaction_type, channel,
        status, metadata
    )


async def update_transaction_status(
    db: DatabaseManager,
    transaction_id: str,
    status: str,
    error_code: str = None,
    error_description: str = None
) -> Dict[str, Any]:
    """Update transaction status"""
    query = """
        UPDATE transaction_history
        SET status = $2,
            error_code = $3,
            error_description = $4,
            completed_at = CASE WHEN $2 IN ('COMPLETED', 'FAILED', 'CANCELLED') THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        WHERE transaction_id = $1
        RETURNING id, transaction_id, status, completed_at
    """
    
    return await db.fetchrow(query, transaction_id, status, error_code, error_description)


async def get_transaction_by_id(
    db: DatabaseManager,
    transaction_id: str
) -> Optional[Dict[str, Any]]:
    """Get transaction by ID"""
    query = """
        SELECT * FROM transaction_history
        WHERE transaction_id = $1
    """
    
    return await db.fetchrow(query, transaction_id)


# Account Balance Operations

async def upsert_account_balance(
    db: DatabaseManager,
    account_id: str,
    tigerbeetle_account_id: str,
    participant_id: str,
    currency: str,
    available_balance: str,
    pending_balance: str,
    ledger_id: int = 1,
    code: int = 1
) -> Dict[str, Any]:
    """Insert or update account balance"""
    query = """
        INSERT INTO account_balances (
            account_id, tigerbeetle_account_id, participant_id,
            currency, available_balance, pending_balance,
            ledger_id, code, last_synced_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NOW()
        )
        ON CONFLICT (account_id) DO UPDATE SET
            available_balance = EXCLUDED.available_balance,
            pending_balance = EXCLUDED.pending_balance,
            last_synced_at = NOW(),
            updated_at = NOW()
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        account_id, tigerbeetle_account_id, participant_id,
        currency, available_balance, pending_balance,
        ledger_id, code
    )


async def get_account_balance(
    db: DatabaseManager,
    account_id: str
) -> Optional[Dict[str, Any]]:
    """Get account balance"""
    query = """
        SELECT * FROM account_balances
        WHERE account_id = $1
    """
    
    return await db.fetchrow(query, account_id)


# Party Registry Operations

async def register_party(
    db: DatabaseManager,
    party_type: str,
    party_identifier: str,
    participant_id: str,
    account_id: str,
    display_name: str = None
) -> Dict[str, Any]:
    """Register a party in the registry"""
    query = """
        INSERT INTO party_registry (
            party_type, party_identifier, participant_id,
            account_id, display_name
        ) VALUES (
            $1, $2, $3, $4, $5
        )
        ON CONFLICT (party_type, party_identifier) DO UPDATE SET
            participant_id = EXCLUDED.participant_id,
            account_id = EXCLUDED.account_id,
            display_name = EXCLUDED.display_name,
            updated_at = NOW()
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        party_type, party_identifier, participant_id,
        account_id, display_name
    )


async def lookup_party(
    db: DatabaseManager,
    party_type: str,
    party_identifier: str
) -> Optional[Dict[str, Any]]:
    """Look up a party in the registry"""
    query = """
        SELECT * FROM party_registry
        WHERE party_type = $1 AND party_identifier = $2 AND is_active = true
    """
    
    return await db.fetchrow(query, party_type, party_identifier)


# Quote Operations

async def create_quote(
    db: DatabaseManager,
    quote_id: str,
    transaction_id: str,
    payer_participant_id: str,
    payee_participant_id: str,
    amount: str,
    currency: str,
    payee_receive_amount: str,
    payee_fee_amount: str = "0.00",
    payee_commission: str = "0.00",
    expiration: str = None
) -> Dict[str, Any]:
    """Create a quote"""
    query = """
        INSERT INTO quotes (
            quote_id, transaction_id,
            payer_participant_id, payee_participant_id,
            amount, currency,
            payee_receive_amount, payee_fee_amount, payee_commission,
            expiration, status
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            COALESCE($10::timestamp, NOW() + INTERVAL '5 minutes'),
            'PENDING'
        )
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        quote_id, transaction_id,
        payer_participant_id, payee_participant_id,
        amount, currency,
        payee_receive_amount, payee_fee_amount, payee_commission,
        expiration
    )


async def get_quote(
    db: DatabaseManager,
    quote_id: str
) -> Optional[Dict[str, Any]]:
    """Get quote by ID"""
    query = """
        SELECT * FROM quotes
        WHERE quote_id = $1
    """
    
    return await db.fetchrow(query, quote_id)


# Settlement Operations

async def create_settlement_window(
    db: DatabaseManager,
    window_id: str,
    currency: str
) -> Dict[str, Any]:
    """Create a settlement window"""
    query = """
        INSERT INTO settlement_windows (
            window_id, currency, start_time, status
        ) VALUES (
            $1, $2, NOW(), 'PENDING'
        )
        RETURNING *
    """
    
    return await db.fetchrow(query, window_id, currency)


async def close_settlement_window(
    db: DatabaseManager,
    window_id: str
) -> Dict[str, Any]:
    """Close a settlement window"""
    query = """
        UPDATE settlement_windows
        SET end_time = NOW(),
            status = 'PROCESSING',
            updated_at = NOW()
        WHERE window_id = $1
        RETURNING *
    """
    
    return await db.fetchrow(query, window_id)


async def upsert_settlement_position(
    db: DatabaseManager,
    window_id: str,
    participant_id: str,
    currency: str,
    net_position: str,
    debit_amount: str,
    credit_amount: str
) -> Dict[str, Any]:
    """Insert or update settlement position"""
    query = """
        INSERT INTO settlement_positions (
            window_id, participant_id, currency,
            net_position, debit_amount, credit_amount
        ) VALUES (
            $1, $2, $3, $4, $5, $6
        )
        ON CONFLICT (window_id, participant_id, currency) DO UPDATE SET
            net_position = EXCLUDED.net_position,
            debit_amount = EXCLUDED.debit_amount,
            credit_amount = EXCLUDED.credit_amount,
            updated_at = NOW()
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        window_id, participant_id, currency,
        net_position, debit_amount, credit_amount
    )


# Fraud Check Operations

async def insert_fraud_check(
    db: DatabaseManager,
    transaction_id: str,
    risk_score: float,
    risk_level: str,
    blocked: bool,
    rules_triggered: List[str],
    reasons: List[str],
    ml_score: float = None,
    gnn_score: float = None
) -> Dict[str, Any]:
    """Insert fraud check result"""
    query = """
        INSERT INTO fraud_checks (
            transaction_id, risk_score, risk_level, blocked,
            rules_triggered, reasons, ml_score, gnn_score
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        transaction_id, risk_score, risk_level, blocked,
        rules_triggered, reasons, ml_score, gnn_score
    )


# Audit Log Operations

async def insert_audit_log(
    db: DatabaseManager,
    event_type: str,
    entity_type: str,
    entity_id: str,
    actor_id: str = None,
    actor_type: str = None,
    old_value: Dict[str, Any] = None,
    new_value: Dict[str, Any] = None,
    ip_address: str = None,
    user_agent: str = None
) -> Dict[str, Any]:
    """Insert audit log entry"""
    query = """
        INSERT INTO audit_log (
            event_type, entity_type, entity_id,
            actor_id, actor_type,
            old_value, new_value,
            ip_address, user_agent
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
    """
    
    return await db.fetchrow(
        query,
        event_type, entity_type, entity_id,
        actor_id, actor_type,
        old_value, new_value,
        ip_address, user_agent
    )
