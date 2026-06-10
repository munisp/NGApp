"""
TigerBeetle Client Integration
High-performance client for TigerBeetle distributed financial ledger.
"""

import os
import logging
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import IntEnum
import struct
import socket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# TigerBeetle Constants
TB_ACCOUNT_SIZE = 128
TB_TRANSFER_SIZE = 128
TB_OPERATION_CREATE_ACCOUNTS = 128
TB_OPERATION_CREATE_TRANSFERS = 129
TB_OPERATION_LOOKUP_ACCOUNTS = 130
TB_OPERATION_LOOKUP_TRANSFERS = 131

class AccountFlags(IntEnum):
    """TigerBeetle account flags"""
    NONE = 0
    LINKED = 1 << 0
    DEBITS_MUST_NOT_EXCEED_CREDITS = 1 << 1
    CREDITS_MUST_NOT_EXCEED_DEBITS = 1 << 2

class TransferFlags(IntEnum):
    """TigerBeetle transfer flags"""
    NONE = 0
    LINKED = 1 << 0
    PENDING = 1 << 1
    POST_PENDING_TRANSFER = 1 << 2
    VOID_PENDING_TRANSFER = 1 << 3
    BALANCING_DEBIT = 1 << 4
    BALANCING_CREDIT = 1 << 5

@dataclass
class Account:
    """TigerBeetle account"""
    id: int  # 128-bit ID (we'll use lower 64 bits for simplicity)
    user_data: int = 0
    reserved: int = 0
    ledger: int = 1
    code: int = 1
    flags: int = AccountFlags.NONE
    debits_pending: int = 0
    debits_posted: int = 0
    credits_pending: int = 0
    credits_posted: int = 0
    timestamp: int = 0

    def to_bytes(self) -> bytes:
        """Convert account to bytes for TigerBeetle"""
        return struct.pack(
            '<QQQQHHQQQQQ',
            self.id, 0,  # 128-bit ID (split into two 64-bit values)
            self.user_data,
            self.reserved,
            self.ledger,
            self.code,
            self.flags,
            self.debits_pending,
            self.debits_posted,
            self.credits_pending,
            self.credits_posted
        )

@dataclass
class Transfer:
    """TigerBeetle transfer"""
    id: int  # 128-bit ID
    debit_account_id: int
    credit_account_id: int
    user_data: int = 0
    reserved: int = 0
    pending_id: int = 0
    timeout: int = 0
    ledger: int = 1
    code: int = 1
    flags: int = TransferFlags.NONE
    amount: int = 0  # Amount in smallest currency unit (e.g., cents)
    timestamp: int = 0

    def to_bytes(self) -> bytes:
        """Convert transfer to bytes for TigerBeetle"""
        return struct.pack(
            '<QQQQQQQQHHQQ',
            self.id, 0,  # 128-bit ID
            self.debit_account_id, 0,  # 128-bit debit account ID
            self.credit_account_id, 0,  # 128-bit credit account ID
            self.user_data,
            self.pending_id, 0,  # 128-bit pending ID
            self.timeout,
            self.ledger,
            self.code,
            self.flags,
            self.amount
        )

class TigerBeetleClient:
    """
    Async TigerBeetle client for high-performance ledger operations.
    
    This client provides:
    - Account creation and lookup
    - Transfer creation and lookup
    - Batch operations for high throughput
    - Connection pooling
    """
    
    def __init__(
        self,
        cluster_id: int = 0,
        addresses: List[str] = None,
        max_connections: int = 10
    ):
        self.cluster_id = cluster_id
        self.addresses = addresses or [
            os.getenv("TIGERBEETLE_HOST", "tigerbeetle") + ":" + 
            os.getenv("TIGERBEETLE_PORT", "3000")
        ]
        self.max_connections = max_connections
        self._connection_pool: List[socket.socket] = []
        self._pool_lock = asyncio.Lock()
        
    async def connect(self):
        """Initialize connection pool"""
        logger.info(f"Connecting to TigerBeetle cluster {self.cluster_id} at {self.addresses}")
        
        for _ in range(self.max_connections):
            conn = await self._create_connection()
            self._connection_pool.append(conn)
        
        logger.info(f"Connected to TigerBeetle with {len(self._connection_pool)} connections")
    
    async def _create_connection(self) -> socket.socket:
        """Create a new connection to TigerBeetle"""
        # Parse address
        host, port = self.addresses[0].split(":")
        port = int(port)
        
        # Create socket connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setblocking(False)
        
        # Connect asynchronously
        loop = asyncio.get_event_loop()
        await loop.sock_connect(sock, (host, port))
        
        return sock
    
    async def _get_connection(self) -> socket.socket:
        """Get a connection from the pool"""
        async with self._pool_lock:
            if not self._connection_pool:
                return await self._create_connection()
            return self._connection_pool.pop()
    
    async def _return_connection(self, conn: socket.socket):
        """Return a connection to the pool"""
        async with self._pool_lock:
            if len(self._connection_pool) < self.max_connections:
                self._connection_pool.append(conn)
            else:
                conn.close()
    
    async def create_accounts(self, accounts: List[Account]) -> List[Dict[str, Any]]:
        """
        Create multiple accounts in a single batch operation.
        
        Args:
            accounts: List of Account objects to create
            
        Returns:
            List of results for each account creation
        """
        logger.info(f"Creating {len(accounts)} accounts")
        
        # Serialize accounts
        account_bytes = b''.join(account.to_bytes() for account in accounts)
        
        # Send request
        conn = await self._get_connection()
        try:
            result = await self._send_request(
                conn,
                TB_OPERATION_CREATE_ACCOUNTS,
                account_bytes
            )
            return result
        finally:
            await self._return_connection(conn)
    
    async def create_transfers(self, transfers: List[Transfer]) -> List[Dict[str, Any]]:
        """
        Create multiple transfers in a single batch operation.
        
        Args:
            transfers: List of Transfer objects to create
            
        Returns:
            List of results for each transfer creation
        """
        logger.info(f"Creating {len(transfers)} transfers")
        
        # Serialize transfers
        transfer_bytes = b''.join(transfer.to_bytes() for transfer in transfers)
        
        # Send request
        conn = await self._get_connection()
        try:
            result = await self._send_request(
                conn,
                TB_OPERATION_CREATE_TRANSFERS,
                transfer_bytes
            )
            return result
        finally:
            await self._return_connection(conn)
    
    async def lookup_accounts(self, account_ids: List[int]) -> List[Account]:
        """
        Look up multiple accounts by ID.
        
        Args:
            account_ids: List of account IDs to look up
            
        Returns:
            List of Account objects
        """
        logger.info(f"Looking up {len(account_ids)} accounts")
        
        # Serialize account IDs (128-bit each)
        id_bytes = b''.join(
            struct.pack('<QQ', account_id, 0) 
            for account_id in account_ids
        )
        
        # Send request
        conn = await self._get_connection()
        try:
            result = await self._send_request(
                conn,
                TB_OPERATION_LOOKUP_ACCOUNTS,
                id_bytes
            )
            
            # Parse results
            accounts = []
            for i in range(0, len(result), TB_ACCOUNT_SIZE):
                account_data = result[i:i+TB_ACCOUNT_SIZE]
                account = self._parse_account(account_data)
                accounts.append(account)
            
            return accounts
        finally:
            await self._return_connection(conn)
    
    async def lookup_transfers(self, transfer_ids: List[int]) -> List[Transfer]:
        """
        Look up multiple transfers by ID.
        
        Args:
            transfer_ids: List of transfer IDs to look up
            
        Returns:
            List of Transfer objects
        """
        logger.info(f"Looking up {len(transfer_ids)} transfers")
        
        # Serialize transfer IDs (128-bit each)
        id_bytes = b''.join(
            struct.pack('<QQ', transfer_id, 0) 
            for transfer_id in transfer_ids
        )
        
        # Send request
        conn = await self._get_connection()
        try:
            result = await self._send_request(
                conn,
                TB_OPERATION_LOOKUP_TRANSFERS,
                id_bytes
            )
            
            # Parse results
            transfers = []
            for i in range(0, len(result), TB_TRANSFER_SIZE):
                transfer_data = result[i:i+TB_TRANSFER_SIZE]
                transfer = self._parse_transfer(transfer_data)
                transfers.append(transfer)
            
            return transfers
        finally:
            await self._return_connection(conn)
    
    async def _send_request(
        self,
        conn: socket.socket,
        operation: int,
        data: bytes
    ) -> bytes:
        """
        Send a request to TigerBeetle and receive the response.
        
        Args:
            conn: Socket connection
            operation: Operation code
            data: Request data
            
        Returns:
            Response data
        """
        # Build request packet
        # Format: [operation: 1 byte][data_length: 4 bytes][data: N bytes]
        request = struct.pack('<BI', operation, len(data)) + data
        
        # Send request
        loop = asyncio.get_event_loop()
        await loop.sock_sendall(conn, request)
        
        # Receive response header
        header = await loop.sock_recv(conn, 5)
        if len(header) < 5:
            raise Exception("Failed to receive response header")
        
        response_code, response_length = struct.unpack('<BI', header)
        
        # Receive response data
        response_data = b''
        while len(response_data) < response_length:
            chunk = await loop.sock_recv(conn, response_length - len(response_data))
            if not chunk:
                raise Exception("Connection closed while receiving response")
            response_data += chunk
        
        return response_data
    
    def _parse_account(self, data: bytes) -> Account:
        """Parse account data from bytes"""
        unpacked = struct.unpack('<QQQQHHQQQQQ', data[:88])
        
        return Account(
            id=unpacked[0],
            user_data=unpacked[2],
            reserved=unpacked[3],
            ledger=unpacked[4],
            code=unpacked[5],
            flags=unpacked[6],
            debits_pending=unpacked[7],
            debits_posted=unpacked[8],
            credits_pending=unpacked[9],
            credits_posted=unpacked[10]
        )
    
    def _parse_transfer(self, data: bytes) -> Transfer:
        """Parse transfer data from bytes"""
        unpacked = struct.unpack('<QQQQQQQQHHQQ', data[:96])
        
        return Transfer(
            id=unpacked[0],
            debit_account_id=unpacked[2],
            credit_account_id=unpacked[4],
            user_data=unpacked[6],
            pending_id=unpacked[7],
            timeout=unpacked[9],
            ledger=unpacked[10],
            code=unpacked[11],
            flags=unpacked[12],
            amount=unpacked[13]
        )
    
    async def get_account_balance(self, account_id: int) -> Dict[str, int]:
        """
        Get the balance of an account.
        
        Args:
            account_id: Account ID
            
        Returns:
            Dictionary with balance information
        """
        accounts = await self.lookup_accounts([account_id])
        
        if not accounts:
            raise Exception(f"Account {account_id} not found")
        
        account = accounts[0]
        
        return {
            "account_id": account.id,
            "debits_pending": account.debits_pending,
            "debits_posted": account.debits_posted,
            "credits_pending": account.credits_pending,
            "credits_posted": account.credits_posted,
            "available_balance": account.credits_posted - account.debits_posted,
            "pending_balance": account.credits_pending - account.debits_pending
        }
    
    async def close(self):
        """Close all connections"""
        async with self._pool_lock:
            for conn in self._connection_pool:
                conn.close()
            self._connection_pool.clear()
        
        logger.info("TigerBeetle client closed")


# Utility functions

def generate_account_id(participant_id: str, account_number: str) -> int:
    """
    Generate a unique account ID from participant ID and account number.
    
    Args:
        participant_id: Participant identifier
        account_number: Account number
        
    Returns:
        64-bit account ID
    """
    import hashlib
    
    # Create a hash of the combined string
    combined = f"{participant_id}:{account_number}"
    hash_bytes = hashlib.sha256(combined.encode()).digest()
    
    # Take the first 8 bytes and convert to int
    account_id = int.from_bytes(hash_bytes[:8], byteorder='little')
    
    return account_id


def generate_transfer_id(transaction_id: str) -> int:
    """
    Generate a unique transfer ID from transaction ID.
    
    Args:
        transaction_id: Transaction identifier
        
    Returns:
        64-bit transfer ID
    """
    import hashlib
    
    # Create a hash of the transaction ID
    hash_bytes = hashlib.sha256(transaction_id.encode()).digest()
    
    # Take the first 8 bytes and convert to int
    transfer_id = int.from_bytes(hash_bytes[:8], byteorder='little')
    
    return transfer_id


def amount_to_cents(amount: str) -> int:
    """
    Convert amount string to cents (integer).
    
    Args:
        amount: Amount as string (e.g., "10.50")
        
    Returns:
        Amount in cents
    """
    from decimal import Decimal
    
    decimal_amount = Decimal(amount)
    cents = int(decimal_amount * 100)
    
    return cents


def cents_to_amount(cents: int) -> str:
    """
    Convert cents (integer) to amount string.
    
    Args:
        cents: Amount in cents
        
    Returns:
        Amount as string with 2 decimal places
    """
    from decimal import Decimal
    
    amount = Decimal(cents) / 100
    
    return f"{amount:.2f}"
