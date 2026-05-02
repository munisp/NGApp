"""
gRPC clients for high-performance Go services
"""

import os
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta

import grpc
from grpc import aio

from services.common.proto import ledger_pb2, ledger_pb2_grpc
from services.common.proto import party_pb2, party_pb2_grpc
from services.common.proto import account_pb2, account_pb2_grpc
from services.common.proto import vpa_pb2, vpa_pb2_grpc

logger = logging.getLogger(__name__)


class LedgerServiceClient:
    """
    High-performance gRPC client for the Ledger Service (Go)
    """

    def __init__(self, host: str = None, port: int = None):
        self.host = host or os.getenv("LEDGER_SERVICE_HOST", "ledger-service.payment-switch")
        self.port = port or int(os.getenv("LEDGER_SERVICE_PORT", "50051"))
        self.address = f"{self.host}:{self.port}"
        self.channel = None
        self.stub = None

    async def connect(self):
        """Establish connection to the gRPC server"""
        self.channel = aio.insecure_channel(
            self.address,
            options=[
                ('grpc.max_send_message_length', 10 * 1024 * 1024),
                ('grpc.max_receive_message_length', 10 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 30000),
                ('grpc.keepalive_timeout_ms', 10000),
                ('grpc.keepalive_permit_without_calls', 1),
                ('grpc.http2.max_pings_without_data', 0),
            ]
        )
        self.stub = ledger_pb2_grpc.LedgerServiceStub(self.channel)
        logger.info(f"Connected to Ledger Service at {self.address}")

    async def close(self):
        """Close the gRPC connection"""
        if self.channel:
            await self.channel.close()
            logger.info("Closed connection to Ledger Service")

    async def create_account(
        self,
        account_id: str,
        participant_id: str,
        currency: str,
        ledger: int = 1,
        code: int = 1,
        flags: int = 0
    ) -> Dict:
        """
        Create a new account in the ledger
        
        Args:
            account_id: Account identifier
            participant_id: Participant (financial institution) ID
            currency: Currency code (e.g., USD, EUR)
            ledger: Ledger ID (default: 1)
            code: Account code (default: 1)
            flags: Account flags (default: 0)
            
        Returns:
            Dict with success status and TigerBeetle account ID
        """
        try:
            request = ledger_pb2.CreateAccountRequest(
                account=ledger_pb2.Account(
                    account_id=account_id,
                    participant_id=participant_id,
                    currency=currency,
                    ledger=ledger,
                    code=code,
                    flags=flags
                )
            )
            response = await self.stub.CreateAccount(request)
            
            logger.info(f"Created account {account_id} for participant {participant_id}")
            return {
                "success": response.success,
                "message": response.message,
                "tigerbeetle_account_id": response.tigerbeetle_account_id
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error creating account: {e.code()} - {e.details()}")
            raise

    async def create_transfer(
        self,
        transfer_id: str,
        transaction_id: str,
        debit_account_id: str,
        credit_account_id: str,
        amount: str,
        currency: str,
        ledger: int = 1,
        code: int = 1,
        flags: int = 0
    ) -> Dict:
        """
        Create a new transfer between accounts
        
        Args:
            transfer_id: Transfer identifier
            transaction_id: Transaction identifier
            debit_account_id: Source account ID
            credit_account_id: Destination account ID
            amount: Transfer amount (decimal string, e.g., "10.50")
            currency: Currency code
            ledger: Ledger ID (default: 1)
            code: Transfer code (default: 1)
            flags: Transfer flags (default: 0)
            
        Returns:
            Dict with success status and TigerBeetle transfer ID
        """
        try:
            request = ledger_pb2.CreateTransferRequest(
                transfer=ledger_pb2.Transfer(
                    transfer_id=transfer_id,
                    transaction_id=transaction_id,
                    debit_account_id=debit_account_id,
                    credit_account_id=credit_account_id,
                    amount=amount,
                    currency=currency,
                    ledger=ledger,
                    code=code,
                    flags=flags
                )
            )
            response = await self.stub.CreateTransfer(request)
            
            logger.info(f"Created transfer {transfer_id} from {debit_account_id} to {credit_account_id}: {amount} {currency}")
            return {
                "success": response.success,
                "message": response.message,
                "tigerbeetle_transfer_id": response.tigerbeetle_transfer_id,
                "completed_at": response.completed_at if response.completed_at else datetime.utcnow().isoformat()
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error creating transfer: {e.code()} - {e.details()}")
            raise

    async def get_account_balance(self, account_id: str) -> Dict:
        """
        Get the balance of an account
        
        Args:
            account_id: Account identifier
            
        Returns:
            Dict with balance information
        """
        try:
            request = ledger_pb2.GetAccountBalanceRequest(account_id=account_id)
            response = await self.stub.GetAccountBalance(request)
            
            logger.info(f"Retrieved balance for account {account_id}")
            return {
                "success": response.success,
                "message": response.message,
                "balance": {
                    "account_id": response.balance.account_id,
                    "available_balance": response.balance.available_balance,
                    "pending_balance": response.balance.pending_balance,
                    "total_balance": response.balance.total_balance,
                    "last_updated": response.balance.last_updated if response.balance.last_updated else datetime.utcnow().isoformat()
                }
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error getting account balance: {e.code()} - {e.details()}")
            raise

    async def sync_balance_to_postgres(
        self,
        account_id: str,
        participant_id: str,
        currency: str
    ) -> Dict:
        """
        Synchronize account balance to PostgreSQL
        
        Args:
            account_id: Account identifier
            participant_id: Participant ID
            currency: Currency code
            
        Returns:
            Dict with success status
        """
        try:
            request = ledger_pb2.SyncBalanceRequest(
                account_id=account_id,
                participant_id=participant_id,
                currency=currency
            )
            response = await self.stub.SyncBalanceToPostgres(request)
            
            logger.info(f"Synced balance for account {account_id} to PostgreSQL")
            return {
                "success": response.success,
                "message": response.message
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error syncing balance: {e.code()} - {e.details()}")
            raise


class PartyServiceClient:
    """
    High-performance gRPC client for the Party Service (Go)
    """

    def __init__(self, host: str = None, port: int = None):
        self.host = host or os.getenv("PARTY_SERVICE_HOST", "party-service.payment-switch")
        self.port = port or int(os.getenv("PARTY_SERVICE_PORT", "50052"))
        self.address = f"{self.host}:{self.port}"
        self.channel = None
        self.stub = None

    async def connect(self):
        """Establish connection to the gRPC server"""
        self.channel = aio.insecure_channel(
            self.address,
            options=[
                ('grpc.max_send_message_length', 10 * 1024 * 1024),
                ('grpc.max_receive_message_length', 10 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 30000),
            ]
        )
        self.stub = party_pb2_grpc.PartyServiceStub(self.channel)
        logger.info(f"Connected to Party Service at {self.address}")

    async def close(self):
        """Close the gRPC connection"""
        if self.channel:
            await self.channel.close()
            logger.info("Closed connection to Party Service")

    async def register_party(
        self,
        party_type: str,
        party_identifier: str,
        participant_id: str,
        account_id: str,
        display_name: str = None
    ) -> Dict:
        """
        Register a party in the registry
        
        Args:
            party_type: Type of party (MSISDN, EMAIL, ACCOUNT, etc.)
            party_identifier: Party identifier value
            participant_id: Participant (financial institution) ID
            account_id: Account ID at the participant
            display_name: Display name for the party
            
        Returns:
            Dict with success status and party information
        """
        try:
            request = party_pb2.RegisterPartyRequest(
                party_type=party_type,
                party_identifier=party_identifier,
                participant_id=participant_id,
                account_id=account_id,
                display_name=display_name or ""
            )
            response = await self.stub.RegisterParty(request)
            
            logger.info(f"Registered party {party_type}:{party_identifier}")
            return {
                "success": response.success,
                "message": response.message,
                "party": {
                    "party_type": response.party.party_type,
                    "party_identifier": response.party.party_identifier,
                    "participant_id": response.party.participant_id,
                    "account_id": response.party.account_id,
                    "display_name": response.party.display_name,
                    "is_active": response.party.is_active
                }
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error registering party: {e.code()} - {e.details()}")
            raise

    async def lookup_party(self, party_type: str, party_identifier: str) -> Dict:
        """
        Look up a party by type and identifier
        
        Args:
            party_type: Type of party (MSISDN, EMAIL, ACCOUNT, etc.)
            party_identifier: Party identifier value
            
        Returns:
            Dict with party information
        """
        try:
            request = party_pb2.LookupPartyRequest(
                party_type=party_type,
                party_identifier=party_identifier
            )
            response = await self.stub.LookupParty(request)
            
            logger.info(f"Looked up party {party_type}:{party_identifier}")
            return {
                "success": response.success,
                "message": response.message,
                "party_info": {
                    "participant_id": response.party_info.participant_id,
                    "account_id": response.party_info.account_id,
                    "tigerbeetle_account_id": response.party_info.tigerbeetle_account_id,
                    "display_name": response.party_info.display_name,
                    "currency": response.party_info.currency
                }
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error looking up party: {e.code()} - {e.details()}")
            raise


class AccountServiceClient:
    """
    High-performance gRPC client for the Account Service (Go)
    """

    def __init__(self, host: str = None, port: int = None):
        self.host = host or os.getenv("ACCOUNT_SERVICE_HOST", "account-service.payment-switch")
        self.port = port or int(os.getenv("ACCOUNT_SERVICE_PORT", "50053"))
        self.address = f"{self.host}:{self.port}"
        self.channel = None
        self.stub = None

    async def connect(self):
        """Establish connection to the gRPC server"""
        self.channel = aio.insecure_channel(
            self.address,
            options=[
                ('grpc.max_send_message_length', 10 * 1024 * 1024),
                ('grpc.max_receive_message_length', 10 * 1024 * 1024),
                ('grpc.keepalive_time_ms', 30000),
            ]
        )
        self.stub = account_pb2_grpc.AccountServiceStub(self.channel)
        logger.info(f"Connected to Account Service at {self.address}")

    async def close(self):
        """Close the gRPC connection"""
        if self.channel:
            await self.channel.close()
            logger.info("Closed connection to Account Service")

    async def record_transaction(
        self,
        transaction_id: str,
        payer_id: str,
        payer_participant_id: str,
        payee_id: str,
        payee_participant_id: str,
        amount: str,
        currency: str,
        transaction_type: str,
        channel: str,
        status: str = "PENDING",
        metadata: Dict = None
    ) -> Dict:
        """
        Record a transaction in the database
        
        Args:
            transaction_id: Transaction identifier
            payer_id: Payer party identifier
            payer_participant_id: Payer participant ID
            payee_id: Payee party identifier
            payee_participant_id: Payee participant ID
            amount: Transaction amount
            currency: Currency code
            transaction_type: Type of transaction
            channel: Transaction channel (ATM, POS, WEB, MOBILE)
            status: Transaction status (default: PENDING)
            metadata: Additional metadata
            
        Returns:
            Dict with success status
        """
        try:
            request = account_pb2.RecordTransactionRequest(
                transaction_id=transaction_id,
                payer_id=payer_id,
                payer_participant_id=payer_participant_id,
                payee_id=payee_id,
                payee_participant_id=payee_participant_id,
                amount=amount,
                currency=currency,
                transaction_type=transaction_type,
                channel=channel,
                status=status,
                metadata=metadata or {}
            )
            response = await self.stub.RecordTransaction(request)
            
            logger.info(f"Recorded transaction {transaction_id}")
            return {
                "success": response.success,
                "message": response.message,
                "initiated_at": response.initiated_at if response.initiated_at else datetime.utcnow().isoformat()
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error recording transaction: {e.code()} - {e.details()}")
            raise

    async def update_transaction_status(
        self,
        transaction_id: str,
        status: str,
        error_code: str = None,
        error_description: str = None
    ) -> Dict:
        """
        Update the status of a transaction
        
        Args:
            transaction_id: Transaction identifier
            status: New status
            error_code: Error code (if failed)
            error_description: Error description (if failed)
            
        Returns:
            Dict with success status
        """
        try:
            request = account_pb2.UpdateTransactionStatusRequest(
                transaction_id=transaction_id,
                status=status,
                error_code=error_code or "",
                error_description=error_description or ""
            )
            response = await self.stub.UpdateTransactionStatus(request)
            
            logger.info(f"Updated transaction {transaction_id} status to {status}")
            return {
                "success": response.success,
                "message": response.message
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error updating transaction status: {e.code()} - {e.details()}")
            raise

    async def get_transaction(self, transaction_id: str) -> Dict:
        """
        Get transaction information
        
        Args:
            transaction_id: Transaction identifier
            
        Returns:
            Dict with transaction information
        """
        try:
            request = account_pb2.GetTransactionRequest(transaction_id=transaction_id)
            response = await self.stub.GetTransaction(request)
            
            logger.info(f"Retrieved transaction {transaction_id}")
            return {
                "success": response.success,
                "message": response.message,
                "transaction": {
                    "transaction_id": response.transaction.transaction_id,
                    "tigerbeetle_transfer_id": response.transaction.tigerbeetle_transfer_id,
                    "payer_id": response.transaction.payer_id,
                    "payer_participant_id": response.transaction.payer_participant_id,
                    "payee_id": response.transaction.payee_id,
                    "payee_participant_id": response.transaction.payee_participant_id,
                    "amount": response.transaction.amount,
                    "currency": response.transaction.currency,
                    "transaction_type": response.transaction.transaction_type,
                    "channel": response.transaction.channel,
                    "status": response.transaction.status,
                    "error_code": response.transaction.error_code,
                    "error_description": response.transaction.error_description,
                    "initiated_at": response.transaction.initiated_at if response.transaction.initiated_at else None,
                    "completed_at": response.transaction.completed_at if response.transaction.completed_at else None,
                    "metadata": dict(response.transaction.metadata) if response.transaction.metadata else {}
                }
            }
        except grpc.RpcError as e:
            logger.error(f"gRPC error getting transaction: {e.code()} - {e.details()}")
            raise


# Singleton instances for connection pooling
_ledger_client = None
_party_client = None
_account_client = None


async def get_ledger_client() -> LedgerServiceClient:
    """Get or create the ledger service client"""
    global _ledger_client
    if _ledger_client is None:
        _ledger_client = LedgerServiceClient()
        await _ledger_client.connect()
    return _ledger_client


async def get_party_client() -> PartyServiceClient:
    """Get or create the party service client"""
    global _party_client
    if _party_client is None:
        _party_client = PartyServiceClient()
        await _party_client.connect()
    return _party_client


async def get_account_client() -> AccountServiceClient:
    """Get or create the account service client"""
    global _account_client
    if _account_client is None:
        _account_client = AccountServiceClient()
        await _account_client.connect()
    return _account_client


async def close_all_clients():
    """Close all gRPC clients"""
    global _ledger_client, _party_client, _account_client
    
    if _ledger_client:
        await _ledger_client.close()
        _ledger_client = None
    
    if _party_client:
        await _party_client.close()
        _party_client = None
    
    if _account_client:
        await _account_client.close()
        _account_client = None
