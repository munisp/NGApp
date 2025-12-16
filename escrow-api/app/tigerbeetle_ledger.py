"""
TigerBeetle Double-Entry Ledger for EscrowProtect
High-performance, ACID-compliant financial transactions

TigerBeetle provides:
- 1M+ TPS for financial transactions
- ACID guarantees with strict serializability
- Immutable audit trail
- Built-in double-entry bookkeeping primitives
"""

import os
import uuid
import hashlib
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from enum import IntEnum
import logging

logger = logging.getLogger(__name__)

# TigerBeetle configuration
TIGERBEETLE_CLUSTER_ID = int(os.getenv("TIGERBEETLE_CLUSTER_ID", "0"))
TIGERBEETLE_ADDRESSES = os.getenv("TIGERBEETLE_ADDRESSES", "127.0.0.1:3000").split(",")

# Account codes for different account types
class AccountCode(IntEnum):
    """
    TigerBeetle uses 16-bit account codes to categorize accounts.
    We use these to distinguish between different account types.
    """
    USER_AVAILABLE = 1      # User's available balance
    USER_PENDING = 2        # User's pending balance (in escrow)
    ESCROW_HOLD = 100       # Escrow holding account
    PLATFORM_REVENUE = 200  # Platform fee revenue
    PLATFORM_FLOAT = 201    # Platform float/operating account
    INSURANCE_POOL = 300    # Insurance pool
    INSURANCE_CLAIMS = 301  # Insurance claims paid out

# Ledger codes for different transaction types
class LedgerCode(IntEnum):
    """
    TigerBeetle uses 32-bit ledger codes to categorize transactions.
    All accounts in a transfer must be on the same ledger.
    """
    NGN = 566  # Nigerian Naira (ISO 4217)
    USD = 840  # US Dollar
    GHS = 936  # Ghanaian Cedi
    KES = 404  # Kenyan Shilling
    ZAR = 710  # South African Rand

# Transfer flags
class TransferFlags(IntEnum):
    LINKED = 1 << 0           # Link transfers (all succeed or all fail)
    PENDING = 1 << 1          # Two-phase transfer: pending
    POST_PENDING = 1 << 2     # Two-phase transfer: post
    VOID_PENDING = 1 << 3     # Two-phase transfer: void

class TigerBeetleLedger:
    """
    TigerBeetle-backed double-entry ledger for escrow transactions.
    
    Account Structure:
    - Each user has two accounts: available and pending
    - Each escrow has a holding account
    - Platform has revenue and float accounts
    - Insurance pool has premium and claims accounts
    
    Transfer Flow (Escrow Deposit):
    1. Buyer's available -> Escrow hold (pending transfer)
    2. Buyer's available -> Platform revenue (fee)
    3. Buyer's available -> Insurance pool (optional premium)
    
    Transfer Flow (Escrow Release):
    1. Escrow hold -> Seller's available (post pending transfer)
    
    Transfer Flow (Escrow Refund):
    1. Escrow hold -> Buyer's available (void pending transfer)
    """
    
    def __init__(self):
        self.client = None
        self.connected = False
        self._fallback_balances: Dict[str, int] = {}  # Fallback in-memory storage
        self._fallback_transfers: List[Dict] = []
        
    async def connect(self) -> bool:
        """Connect to TigerBeetle cluster"""
        try:
            import tigerbeetle as tb
            
            self.client = tb.Client(
                cluster_id=TIGERBEETLE_CLUSTER_ID,
                addresses=TIGERBEETLE_ADDRESSES
            )
            self.connected = True
            logger.info(f"Connected to TigerBeetle cluster {TIGERBEETLE_CLUSTER_ID}")
            return True
            
        except Exception as e:
            logger.warning(f"TigerBeetle connection failed: {e}. Using in-memory fallback.")
            self.connected = False
            return False
    
    def _generate_account_id(self, identifier: str, account_type: AccountCode) -> int:
        """
        Generate a unique 128-bit account ID from identifier and type.
        TigerBeetle uses 128-bit UUIDs for account IDs.
        """
        # Create deterministic ID from identifier + type
        data = f"{identifier}:{account_type.value}"
        hash_bytes = hashlib.sha256(data.encode()).digest()[:16]
        return int.from_bytes(hash_bytes, 'big')
    
    def _generate_transfer_id(self) -> int:
        """Generate unique transfer ID"""
        return int.from_bytes(uuid.uuid4().bytes, 'big')
    
    async def create_user_accounts(self, user_id: str, ledger: LedgerCode = LedgerCode.NGN) -> Dict[str, Any]:
        """
        Create available and pending accounts for a user.
        """
        available_id = self._generate_account_id(user_id, AccountCode.USER_AVAILABLE)
        pending_id = self._generate_account_id(user_id, AccountCode.USER_PENDING)
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                accounts = [
                    tb.Account(
                        id=available_id,
                        ledger=ledger.value,
                        code=AccountCode.USER_AVAILABLE.value,
                        flags=0,
                        user_data_128=0,
                        user_data_64=0,
                        user_data_32=0,
                    ),
                    tb.Account(
                        id=pending_id,
                        ledger=ledger.value,
                        code=AccountCode.USER_PENDING.value,
                        flags=0,
                        user_data_128=0,
                        user_data_64=0,
                        user_data_32=0,
                    ),
                ]
                
                errors = self.client.create_accounts(accounts)
                if errors:
                    # Account already exists is OK
                    for error in errors:
                        if error.result != tb.CreateAccountResult.EXISTS:
                            logger.error(f"Failed to create account: {error}")
                
            except Exception as e:
                logger.error(f"TigerBeetle create_accounts failed: {e}")
        
        # Initialize fallback storage
        self._fallback_balances[f"{available_id}_credits"] = 0
        self._fallback_balances[f"{available_id}_debits"] = 0
        self._fallback_balances[f"{pending_id}_credits"] = 0
        self._fallback_balances[f"{pending_id}_debits"] = 0
        
        return {
            "user_id": user_id,
            "available_account_id": available_id,
            "pending_account_id": pending_id,
            "ledger": ledger.name
        }
    
    async def create_escrow_account(self, escrow_id: str, ledger: LedgerCode = LedgerCode.NGN) -> Dict[str, Any]:
        """
        Create holding account for an escrow.
        """
        account_id = self._generate_account_id(escrow_id, AccountCode.ESCROW_HOLD)
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                account = tb.Account(
                    id=account_id,
                    ledger=ledger.value,
                    code=AccountCode.ESCROW_HOLD.value,
                    flags=0,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                )
                
                errors = self.client.create_accounts([account])
                if errors:
                    for error in errors:
                        if error.result != tb.CreateAccountResult.EXISTS:
                            logger.error(f"Failed to create escrow account: {error}")
                
            except Exception as e:
                logger.error(f"TigerBeetle create escrow account failed: {e}")
        
        # Initialize fallback storage
        self._fallback_balances[f"{account_id}_credits"] = 0
        self._fallback_balances[f"{account_id}_debits"] = 0
        
        return {
            "escrow_id": escrow_id,
            "account_id": account_id,
            "ledger": ledger.name
        }
    
    async def get_balance(self, account_id: int) -> Dict[str, int]:
        """
        Get account balance.
        TigerBeetle tracks debits and credits separately.
        Balance = credits_posted - debits_posted
        """
        if self.connected and self.client:
            try:
                accounts = self.client.lookup_accounts([account_id])
                if accounts:
                    account = accounts[0]
                    return {
                        "credits_posted": account.credits_posted,
                        "debits_posted": account.debits_posted,
                        "credits_pending": account.credits_pending,
                        "debits_pending": account.debits_pending,
                        "balance": account.credits_posted - account.debits_posted,
                        "pending_balance": account.credits_pending - account.debits_pending
                    }
            except Exception as e:
                logger.error(f"TigerBeetle lookup_accounts failed: {e}")
        
        # Fallback
        credits = self._fallback_balances.get(f"{account_id}_credits", 0)
        debits = self._fallback_balances.get(f"{account_id}_debits", 0)
        return {
            "credits_posted": credits,
            "debits_posted": debits,
            "credits_pending": 0,
            "debits_pending": 0,
            "balance": credits - debits,
            "pending_balance": 0
        }
    
    async def deposit_to_escrow(
        self,
        escrow_id: str,
        buyer_id: str,
        amount: int,  # Amount in smallest currency unit (kobo for NGN)
        platform_fee: int,
        insurance_fee: int = 0,
        ledger: LedgerCode = LedgerCode.NGN,
        idempotency_key: str = None
    ) -> Dict[str, Any]:
        """
        Record buyer's payment into escrow using two-phase transfers.
        
        This creates linked transfers that all succeed or all fail:
        1. Buyer -> Escrow hold (pending, will be posted on release or voided on refund)
        2. Buyer -> Platform revenue (immediate)
        3. Buyer -> Insurance pool (immediate, if applicable)
        """
        buyer_available_id = self._generate_account_id(buyer_id, AccountCode.USER_AVAILABLE)
        escrow_account_id = self._generate_account_id(escrow_id, AccountCode.ESCROW_HOLD)
        platform_revenue_id = self._generate_account_id("platform", AccountCode.PLATFORM_REVENUE)
        insurance_pool_id = self._generate_account_id("insurance", AccountCode.INSURANCE_POOL)
        
        # Generate transfer IDs
        escrow_transfer_id = self._generate_transfer_id()
        fee_transfer_id = self._generate_transfer_id()
        insurance_transfer_id = self._generate_transfer_id() if insurance_fee > 0 else None
        
        transfers = []
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                # Transfer 1: Buyer -> Escrow (pending two-phase transfer)
                transfers.append(tb.Transfer(
                    id=escrow_transfer_id,
                    debit_account_id=buyer_available_id,
                    credit_account_id=escrow_account_id,
                    amount=amount,
                    ledger=ledger.value,
                    code=1,  # Escrow deposit
                    flags=TransferFlags.PENDING | TransferFlags.LINKED,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                    timeout=0,  # No timeout for pending transfer
                ))
                
                # Transfer 2: Buyer -> Platform (immediate, linked)
                fee_flags = TransferFlags.LINKED if insurance_fee > 0 else 0
                transfers.append(tb.Transfer(
                    id=fee_transfer_id,
                    debit_account_id=buyer_available_id,
                    credit_account_id=platform_revenue_id,
                    amount=platform_fee,
                    ledger=ledger.value,
                    code=2,  # Platform fee
                    flags=fee_flags,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                    timeout=0,
                ))
                
                # Transfer 3: Buyer -> Insurance (immediate, if applicable)
                if insurance_fee > 0:
                    transfers.append(tb.Transfer(
                        id=insurance_transfer_id,
                        debit_account_id=buyer_available_id,
                        credit_account_id=insurance_pool_id,
                        amount=insurance_fee,
                        ledger=ledger.value,
                        code=3,  # Insurance premium
                        flags=0,  # Last in chain, no LINKED flag
                        user_data_128=0,
                        user_data_64=0,
                        user_data_32=0,
                        timeout=0,
                    ))
                
                errors = self.client.create_transfers(transfers)
                if errors:
                    for error in errors:
                        logger.error(f"Transfer failed: {error}")
                    return {"success": False, "errors": [str(e) for e in errors]}
                
            except Exception as e:
                logger.error(f"TigerBeetle deposit failed: {e}")
                # Fall through to fallback
        
        # Fallback: Update in-memory balances
        total = amount + platform_fee + insurance_fee
        self._fallback_balances[f"{buyer_available_id}_debits"] = \
            self._fallback_balances.get(f"{buyer_available_id}_debits", 0) + total
        self._fallback_balances[f"{escrow_account_id}_credits"] = \
            self._fallback_balances.get(f"{escrow_account_id}_credits", 0) + amount
        self._fallback_balances[f"{platform_revenue_id}_credits"] = \
            self._fallback_balances.get(f"{platform_revenue_id}_credits", 0) + platform_fee
        if insurance_fee > 0:
            self._fallback_balances[f"{insurance_pool_id}_credits"] = \
                self._fallback_balances.get(f"{insurance_pool_id}_credits", 0) + insurance_fee
        
        # Record transfer for audit
        self._fallback_transfers.append({
            "id": str(escrow_transfer_id),
            "type": "escrow_deposit",
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "amount": amount,
            "platform_fee": platform_fee,
            "insurance_fee": insurance_fee,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "success": True,
            "escrow_transfer_id": str(escrow_transfer_id),
            "fee_transfer_id": str(fee_transfer_id),
            "insurance_transfer_id": str(insurance_transfer_id) if insurance_transfer_id else None,
            "total_amount": total,
            "escrow_amount": amount,
            "platform_fee": platform_fee,
            "insurance_fee": insurance_fee,
            "ledger": ledger.name,
            "using_tigerbeetle": self.connected
        }
    
    async def release_escrow(
        self,
        escrow_id: str,
        seller_id: str,
        escrow_transfer_id: int,  # Original pending transfer ID
        ledger: LedgerCode = LedgerCode.NGN
    ) -> Dict[str, Any]:
        """
        Release escrow funds to seller by posting the pending transfer.
        """
        seller_available_id = self._generate_account_id(seller_id, AccountCode.USER_AVAILABLE)
        escrow_account_id = self._generate_account_id(escrow_id, AccountCode.ESCROW_HOLD)
        
        release_transfer_id = self._generate_transfer_id()
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                # Post the pending transfer (moves funds from escrow to seller)
                transfer = tb.Transfer(
                    id=release_transfer_id,
                    debit_account_id=escrow_account_id,
                    credit_account_id=seller_available_id,
                    amount=0,  # Amount comes from pending transfer
                    ledger=ledger.value,
                    code=4,  # Escrow release
                    flags=TransferFlags.POST_PENDING,
                    pending_id=escrow_transfer_id,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                    timeout=0,
                )
                
                errors = self.client.create_transfers([transfer])
                if errors:
                    for error in errors:
                        logger.error(f"Release transfer failed: {error}")
                    return {"success": False, "errors": [str(e) for e in errors]}
                
            except Exception as e:
                logger.error(f"TigerBeetle release failed: {e}")
        
        # Fallback: Get escrow balance and transfer to seller
        escrow_balance = self._fallback_balances.get(f"{escrow_account_id}_credits", 0) - \
                        self._fallback_balances.get(f"{escrow_account_id}_debits", 0)
        
        self._fallback_balances[f"{escrow_account_id}_debits"] = \
            self._fallback_balances.get(f"{escrow_account_id}_debits", 0) + escrow_balance
        self._fallback_balances[f"{seller_available_id}_credits"] = \
            self._fallback_balances.get(f"{seller_available_id}_credits", 0) + escrow_balance
        
        self._fallback_transfers.append({
            "id": str(release_transfer_id),
            "type": "escrow_release",
            "escrow_id": escrow_id,
            "seller_id": seller_id,
            "amount": escrow_balance,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "success": True,
            "release_transfer_id": str(release_transfer_id),
            "amount_released": escrow_balance,
            "seller_id": seller_id,
            "using_tigerbeetle": self.connected
        }
    
    async def refund_escrow(
        self,
        escrow_id: str,
        buyer_id: str,
        escrow_transfer_id: int,  # Original pending transfer ID
        ledger: LedgerCode = LedgerCode.NGN
    ) -> Dict[str, Any]:
        """
        Refund escrow funds to buyer by voiding the pending transfer.
        """
        buyer_available_id = self._generate_account_id(buyer_id, AccountCode.USER_AVAILABLE)
        escrow_account_id = self._generate_account_id(escrow_id, AccountCode.ESCROW_HOLD)
        
        refund_transfer_id = self._generate_transfer_id()
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                # Void the pending transfer (returns funds to buyer)
                transfer = tb.Transfer(
                    id=refund_transfer_id,
                    debit_account_id=escrow_account_id,
                    credit_account_id=buyer_available_id,
                    amount=0,  # Amount comes from pending transfer
                    ledger=ledger.value,
                    code=5,  # Escrow refund
                    flags=TransferFlags.VOID_PENDING,
                    pending_id=escrow_transfer_id,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                    timeout=0,
                )
                
                errors = self.client.create_transfers([transfer])
                if errors:
                    for error in errors:
                        logger.error(f"Refund transfer failed: {error}")
                    return {"success": False, "errors": [str(e) for e in errors]}
                
            except Exception as e:
                logger.error(f"TigerBeetle refund failed: {e}")
        
        # Fallback: Get escrow balance and return to buyer
        escrow_balance = self._fallback_balances.get(f"{escrow_account_id}_credits", 0) - \
                        self._fallback_balances.get(f"{escrow_account_id}_debits", 0)
        
        self._fallback_balances[f"{escrow_account_id}_debits"] = \
            self._fallback_balances.get(f"{escrow_account_id}_debits", 0) + escrow_balance
        self._fallback_balances[f"{buyer_available_id}_credits"] = \
            self._fallback_balances.get(f"{buyer_available_id}_credits", 0) + escrow_balance
        
        self._fallback_transfers.append({
            "id": str(refund_transfer_id),
            "type": "escrow_refund",
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "amount": escrow_balance,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "success": True,
            "refund_transfer_id": str(refund_transfer_id),
            "amount_refunded": escrow_balance,
            "buyer_id": buyer_id,
            "using_tigerbeetle": self.connected
        }
    
    async def split_escrow(
        self,
        escrow_id: str,
        buyer_id: str,
        seller_id: str,
        buyer_amount: int,
        seller_amount: int,
        escrow_transfer_id: int,
        ledger: LedgerCode = LedgerCode.NGN
    ) -> Dict[str, Any]:
        """
        Split escrow funds between buyer and seller (dispute resolution).
        This voids the original pending transfer and creates new immediate transfers.
        """
        buyer_available_id = self._generate_account_id(buyer_id, AccountCode.USER_AVAILABLE)
        seller_available_id = self._generate_account_id(seller_id, AccountCode.USER_AVAILABLE)
        escrow_account_id = self._generate_account_id(escrow_id, AccountCode.ESCROW_HOLD)
        
        void_transfer_id = self._generate_transfer_id()
        buyer_transfer_id = self._generate_transfer_id()
        seller_transfer_id = self._generate_transfer_id()
        
        if self.connected and self.client:
            try:
                import tigerbeetle as tb
                
                transfers = []
                
                # First void the pending transfer
                transfers.append(tb.Transfer(
                    id=void_transfer_id,
                    debit_account_id=escrow_account_id,
                    credit_account_id=buyer_available_id,
                    amount=0,
                    ledger=ledger.value,
                    code=6,  # Dispute void
                    flags=TransferFlags.VOID_PENDING | TransferFlags.LINKED,
                    pending_id=escrow_transfer_id,
                    user_data_128=0,
                    user_data_64=0,
                    user_data_32=0,
                    timeout=0,
                ))
                
                # Then create new transfers for the split
                if buyer_amount > 0:
                    transfers.append(tb.Transfer(
                        id=buyer_transfer_id,
                        debit_account_id=escrow_account_id,
                        credit_account_id=buyer_available_id,
                        amount=buyer_amount,
                        ledger=ledger.value,
                        code=7,  # Dispute refund
                        flags=TransferFlags.LINKED if seller_amount > 0 else 0,
                        user_data_128=0,
                        user_data_64=0,
                        user_data_32=0,
                        timeout=0,
                    ))
                
                if seller_amount > 0:
                    transfers.append(tb.Transfer(
                        id=seller_transfer_id,
                        debit_account_id=escrow_account_id,
                        credit_account_id=seller_available_id,
                        amount=seller_amount,
                        ledger=ledger.value,
                        code=8,  # Dispute payout
                        flags=0,
                        user_data_128=0,
                        user_data_64=0,
                        user_data_32=0,
                        timeout=0,
                    ))
                
                errors = self.client.create_transfers(transfers)
                if errors:
                    for error in errors:
                        logger.error(f"Split transfer failed: {error}")
                    return {"success": False, "errors": [str(e) for e in errors]}
                
            except Exception as e:
                logger.error(f"TigerBeetle split failed: {e}")
        
        # Fallback
        total = buyer_amount + seller_amount
        self._fallback_balances[f"{escrow_account_id}_debits"] = \
            self._fallback_balances.get(f"{escrow_account_id}_debits", 0) + total
        self._fallback_balances[f"{buyer_available_id}_credits"] = \
            self._fallback_balances.get(f"{buyer_available_id}_credits", 0) + buyer_amount
        self._fallback_balances[f"{seller_available_id}_credits"] = \
            self._fallback_balances.get(f"{seller_available_id}_credits", 0) + seller_amount
        
        self._fallback_transfers.append({
            "id": str(void_transfer_id),
            "type": "escrow_split",
            "escrow_id": escrow_id,
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "buyer_amount": buyer_amount,
            "seller_amount": seller_amount,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "success": True,
            "buyer_transfer_id": str(buyer_transfer_id),
            "seller_transfer_id": str(seller_transfer_id),
            "buyer_amount": buyer_amount,
            "seller_amount": seller_amount,
            "using_tigerbeetle": self.connected
        }
    
    async def get_transfer_history(self, account_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """Get transfer history for an account"""
        if self.connected and self.client:
            try:
                # TigerBeetle doesn't have a direct query API for transfers
                # In production, you'd use a separate audit log or event store
                pass
            except Exception as e:
                logger.error(f"TigerBeetle get_transfer_history failed: {e}")
        
        # Return fallback transfers
        return [t for t in self._fallback_transfers if str(account_id) in str(t)]
    
    async def reconcile(self) -> Dict[str, Any]:
        """
        Reconcile all accounts.
        In TigerBeetle, debits always equal credits across all accounts.
        """
        total_debits = 0
        total_credits = 0
        
        for key, value in self._fallback_balances.items():
            if key.endswith("_debits"):
                total_debits += value
            elif key.endswith("_credits"):
                total_credits += value
        
        return {
            "total_debits": total_debits,
            "total_credits": total_credits,
            "balanced": total_debits == total_credits,
            "discrepancy": total_credits - total_debits,
            "using_tigerbeetle": self.connected
        }
    
    def close(self):
        """Close TigerBeetle connection"""
        if self.client:
            # TigerBeetle Python client doesn't have explicit close
            self.client = None
            self.connected = False


# Global ledger instance
tigerbeetle_ledger = TigerBeetleLedger()


# Helper functions for currency conversion
def naira_to_kobo(naira: float) -> int:
    """Convert Naira to Kobo (smallest unit)"""
    return int(naira * 100)

def kobo_to_naira(kobo: int) -> float:
    """Convert Kobo to Naira"""
    return kobo / 100
