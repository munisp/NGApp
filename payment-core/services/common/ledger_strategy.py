"""
Ledger Strategy - Single Source of Truth for Payment Switch

This module defines the ledger strategy for the payment switch, establishing
TigerBeetle as the authoritative source of truth for all financial transactions,
while Mojaloop Central Ledger handles interoperability and scheme compliance.

Architecture:
- TigerBeetle: System of Record (SoR) for all account balances and transfers
- Mojaloop Central Ledger: Scheme compliance, participant management, ILP routing
- Reconciliation: Continuous reconciliation between TigerBeetle and Mojaloop

Flow:
1. Payment request received
2. Mojaloop validates parties, quotes, and scheme rules
3. TigerBeetle executes the actual transfer (two-phase commit)
4. Mojaloop records the transfer for scheme compliance
5. Reconciliation service verifies consistency
"""
import os
import logging
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)


class LedgerType(Enum):
    """Types of ledgers in the system"""
    TIGERBEETLE = "tigerbeetle"  # System of Record
    MOJALOOP = "mojaloop"        # Scheme compliance
    BOTH = "both"                # Dual-write (for migration)


class ReconciliationStatus(Enum):
    """Status of reconciliation between ledgers"""
    CONSISTENT = "consistent"
    INCONSISTENT = "inconsistent"
    PENDING = "pending"
    UNKNOWN = "unknown"


@dataclass
class LedgerConfig:
    """Configuration for ledger strategy"""
    primary_ledger: LedgerType = LedgerType.TIGERBEETLE
    enable_dual_write: bool = False
    reconciliation_interval_seconds: int = 60
    max_reconciliation_drift_cents: int = 100  # Max allowed drift before alert
    tigerbeetle_host: str = os.getenv("TIGERBEETLE_HOST", "tigerbeetle.payment-switch.svc.cluster.local")
    tigerbeetle_port: int = int(os.getenv("TIGERBEETLE_PORT", "3000"))
    mojaloop_central_ledger_url: str = os.getenv(
        "MOJALOOP_CENTRAL_LEDGER_URL",
        "http://mojaloop-central-ledger.payment-switch.svc.cluster.local:3001"
    )


# Global configuration
_config = LedgerConfig()


def get_ledger_config() -> LedgerConfig:
    """Get the current ledger configuration"""
    return _config


def set_ledger_config(config: LedgerConfig):
    """Set the ledger configuration"""
    global _config
    _config = config
    logger.info(f"Ledger strategy configured: primary={config.primary_ledger.value}")


@dataclass
class TransferRecord:
    """Unified transfer record across ledgers"""
    transfer_id: str
    payer_account_id: str
    payee_account_id: str
    amount: int  # In minor units (cents)
    currency: str
    timestamp: datetime
    tigerbeetle_id: Optional[int] = None
    mojaloop_transfer_id: Optional[str] = None
    status: str = "pending"
    reconciliation_status: ReconciliationStatus = ReconciliationStatus.PENDING


class LedgerOrchestrator:
    """
    Orchestrates operations across TigerBeetle and Mojaloop ledgers.
    
    This class ensures:
    1. TigerBeetle is always the source of truth for balances
    2. Mojaloop is updated for scheme compliance
    3. Reconciliation detects and alerts on any drift
    """
    
    def __init__(self, config: Optional[LedgerConfig] = None):
        self.config = config or get_ledger_config()
        self._tigerbeetle_client = None
        self._mojaloop_client = None
    
    async def initialize(self):
        """Initialize connections to both ledgers"""
        # Import here to avoid circular imports
        from .tigerbeetle_client import get_tigerbeetle_client
        self._tigerbeetle_client = await get_tigerbeetle_client()
        logger.info("LedgerOrchestrator initialized")
    
    async def execute_transfer(
        self,
        transfer_id: str,
        payer_account_id: int,
        payee_account_id: int,
        amount: int,
        currency: str,
        payer_fsp: str,
        payee_fsp: str,
        ilp_packet: str,
        condition: str
    ) -> Tuple[bool, TransferRecord]:
        """
        Execute a transfer using the configured ledger strategy.
        
        This method:
        1. Executes the transfer in TigerBeetle (source of truth)
        2. Records the transfer in Mojaloop (scheme compliance)
        3. Returns a unified transfer record
        
        Args:
            transfer_id: Unique transfer identifier
            payer_account_id: Payer's TigerBeetle account ID
            payee_account_id: Payee's TigerBeetle account ID
            amount: Amount in minor units
            currency: ISO 4217 currency code
            payer_fsp: Payer FSP identifier
            payee_fsp: Payee FSP identifier
            ilp_packet: ILP packet for Mojaloop
            condition: ILP condition for Mojaloop
            
        Returns:
            Tuple of (success, TransferRecord)
        """
        record = TransferRecord(
            transfer_id=transfer_id,
            payer_account_id=str(payer_account_id),
            payee_account_id=str(payee_account_id),
            amount=amount,
            currency=currency,
            timestamp=datetime.utcnow()
        )
        
        try:
            # Step 1: Execute in TigerBeetle (Source of Truth)
            logger.info(f"Executing transfer {transfer_id} in TigerBeetle")
            
            from .tigerbeetle_client import execute_payment_transfer
            tb_result = await execute_payment_transfer(
                transfer_id=transfer_id,
                payer_account_id=payer_account_id,
                payee_account_id=payee_account_id,
                amount=amount,
                currency_ledger=self._get_currency_ledger(currency),
                two_phase=True
            )
            
            if not tb_result.get("success"):
                record.status = "failed"
                record.reconciliation_status = ReconciliationStatus.UNKNOWN
                logger.error(f"TigerBeetle transfer failed: {tb_result.get('error')}")
                return False, record
            
            record.tigerbeetle_id = tb_result.get("tigerbeetle_id")
            record.status = "committed_tigerbeetle"
            
            # Step 2: Record in Mojaloop (Scheme Compliance)
            if self.config.enable_dual_write or self.config.primary_ledger == LedgerType.BOTH:
                logger.info(f"Recording transfer {transfer_id} in Mojaloop")
                
                mojaloop_success = await self._record_in_mojaloop(
                    transfer_id=transfer_id,
                    payer_fsp=payer_fsp,
                    payee_fsp=payee_fsp,
                    amount=amount,
                    currency=currency,
                    ilp_packet=ilp_packet,
                    condition=condition
                )
                
                if mojaloop_success:
                    record.mojaloop_transfer_id = transfer_id
                    record.status = "committed"
                    record.reconciliation_status = ReconciliationStatus.CONSISTENT
                else:
                    # TigerBeetle succeeded but Mojaloop failed
                    # This is acceptable - TigerBeetle is source of truth
                    # Reconciliation will catch this
                    record.status = "committed_tigerbeetle_only"
                    record.reconciliation_status = ReconciliationStatus.PENDING
                    logger.warning(f"Mojaloop recording failed for {transfer_id}, will reconcile later")
            else:
                record.status = "committed"
                record.reconciliation_status = ReconciliationStatus.CONSISTENT
            
            logger.info(f"Transfer {transfer_id} completed: {record.status}")
            return True, record
            
        except Exception as e:
            logger.error(f"Transfer {transfer_id} failed: {e}")
            record.status = "failed"
            record.reconciliation_status = ReconciliationStatus.UNKNOWN
            return False, record
    
    async def get_balance(
        self,
        account_id: int,
        ledger: LedgerType = LedgerType.TIGERBEETLE
    ) -> Optional[int]:
        """
        Get account balance from the specified ledger.
        
        By default, returns balance from TigerBeetle (source of truth).
        
        Args:
            account_id: Account identifier
            ledger: Which ledger to query
            
        Returns:
            Balance in minor units or None if not found
        """
        if ledger == LedgerType.TIGERBEETLE:
            from .tigerbeetle_client import get_tigerbeetle_client
            client = await get_tigerbeetle_client()
            return await client.get_account_balance(account_id)
        elif ledger == LedgerType.MOJALOOP:
            return await self._get_mojaloop_balance(account_id)
        else:
            # Return TigerBeetle balance as authoritative
            from .tigerbeetle_client import get_tigerbeetle_client
            client = await get_tigerbeetle_client()
            return await client.get_account_balance(account_id)
    
    async def reconcile_account(
        self,
        account_id: int
    ) -> Tuple[ReconciliationStatus, Dict[str, Any]]:
        """
        Reconcile an account between TigerBeetle and Mojaloop.
        
        Args:
            account_id: Account to reconcile
            
        Returns:
            Tuple of (status, details)
        """
        try:
            tb_balance = await self.get_balance(account_id, LedgerType.TIGERBEETLE)
            ml_balance = await self.get_balance(account_id, LedgerType.MOJALOOP)
            
            if tb_balance is None or ml_balance is None:
                return ReconciliationStatus.UNKNOWN, {
                    "tigerbeetle_balance": tb_balance,
                    "mojaloop_balance": ml_balance,
                    "error": "Could not retrieve balance from one or both ledgers"
                }
            
            drift = abs(tb_balance - ml_balance)
            
            if drift == 0:
                status = ReconciliationStatus.CONSISTENT
            elif drift <= self.config.max_reconciliation_drift_cents:
                status = ReconciliationStatus.PENDING  # Within tolerance
            else:
                status = ReconciliationStatus.INCONSISTENT
                logger.error(
                    f"Account {account_id} has drift of {drift} cents "
                    f"(TB: {tb_balance}, ML: {ml_balance})"
                )
            
            return status, {
                "tigerbeetle_balance": tb_balance,
                "mojaloop_balance": ml_balance,
                "drift": drift,
                "drift_within_tolerance": drift <= self.config.max_reconciliation_drift_cents
            }
            
        except Exception as e:
            logger.error(f"Reconciliation failed for account {account_id}: {e}")
            return ReconciliationStatus.UNKNOWN, {"error": str(e)}
    
    def _get_currency_ledger(self, currency: str) -> int:
        """Map currency code to TigerBeetle ledger ID"""
        currency_ledgers = {
            "USD": 1,
            "EUR": 2,
            "GBP": 3,
            "NGN": 4,
            "KES": 5,
            "ZAR": 6,
            "GHS": 7,
            "TZS": 8,
            "UGX": 9,
            "RWF": 10
        }
        return currency_ledgers.get(currency.upper(), 1)
    
    async def _record_in_mojaloop(
        self,
        transfer_id: str,
        payer_fsp: str,
        payee_fsp: str,
        amount: int,
        currency: str,
        ilp_packet: str,
        condition: str
    ) -> bool:
        """Record a transfer in Mojaloop Central Ledger"""
        import httpx
        
        try:
            transfer_request = {
                "transferId": transfer_id,
                "payerFsp": payer_fsp,
                "payeeFsp": payee_fsp,
                "amount": {
                    "currency": currency,
                    "amount": str(amount / 100)
                },
                "ilpPacket": ilp_packet,
                "condition": condition,
                "expiration": datetime.utcnow().isoformat() + "Z"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.config.mojaloop_central_ledger_url}/transfers",
                    json=transfer_request,
                    timeout=10.0
                )
                return response.status_code in (200, 201, 202)
                
        except Exception as e:
            logger.error(f"Failed to record in Mojaloop: {e}")
            return False
    
    async def _get_mojaloop_balance(self, account_id: int) -> Optional[int]:
        """Get balance from Mojaloop (for reconciliation)"""
        import httpx
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.config.mojaloop_central_ledger_url}/participants/{account_id}/positions",
                    timeout=5.0
                )
                if response.status_code == 200:
                    data = response.json()
                    # Convert to cents
                    return int(float(data.get("value", 0)) * 100)
                return None
        except Exception as e:
            logger.error(f"Failed to get Mojaloop balance: {e}")
            return None


# Singleton instance
_orchestrator: Optional[LedgerOrchestrator] = None


async def get_ledger_orchestrator() -> LedgerOrchestrator:
    """Get or create the ledger orchestrator singleton"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = LedgerOrchestrator()
        await _orchestrator.initialize()
    return _orchestrator


async def execute_transfer(
    transfer_id: str,
    payer_account_id: int,
    payee_account_id: int,
    amount: int,
    currency: str,
    payer_fsp: str,
    payee_fsp: str,
    ilp_packet: str,
    condition: str
) -> Tuple[bool, TransferRecord]:
    """
    Execute a transfer using the ledger strategy.
    
    This is the main entry point for payment services.
    TigerBeetle is the source of truth; Mojaloop is for scheme compliance.
    """
    orchestrator = await get_ledger_orchestrator()
    return await orchestrator.execute_transfer(
        transfer_id=transfer_id,
        payer_account_id=payer_account_id,
        payee_account_id=payee_account_id,
        amount=amount,
        currency=currency,
        payer_fsp=payer_fsp,
        payee_fsp=payee_fsp,
        ilp_packet=ilp_packet,
        condition=condition
    )
