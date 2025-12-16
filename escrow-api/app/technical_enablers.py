"""
Technical Enablers for Seller/Buyer Adoption

This module provides features to encourage sellers and buyers to use the platform:
1. Instant Account Opening (Tiered KYC)
2. Virtual Account Management
3. Fast Settlement System
4. Loyalty/Cashback Program
5. Merchant Analytics Dashboard
6. Working Capital/Advance System
7. Integrated Dispute Resolution

Designed to provide competitive advantages over other payment platforms.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Literal
from enum import Enum
from dataclasses import dataclass, field
import uuid
import hashlib

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class EnablerConfig:
    """Technical enabler configuration"""
    
    # Account Opening
    INSTANT_ACCOUNT_ENABLED = os.getenv("INSTANT_ACCOUNT_ENABLED", "true").lower() == "true"
    
    # Settlement Configuration
    SAME_DAY_SETTLEMENT_CUTOFF = os.getenv("SAME_DAY_SETTLEMENT_CUTOFF", "14:00")
    INSTANT_SETTLEMENT_FEE_RATE = float(os.getenv("INSTANT_SETTLEMENT_FEE_RATE", "0.005"))  # 0.5%
    STANDARD_SETTLEMENT_DAYS = int(os.getenv("STANDARD_SETTLEMENT_DAYS", "1"))
    
    # Loyalty Configuration
    CASHBACK_RATE_BUYER = float(os.getenv("CASHBACK_RATE_BUYER", "0.005"))  # 0.5%
    CASHBACK_RATE_SELLER = float(os.getenv("CASHBACK_RATE_SELLER", "0.002"))  # 0.2%
    REFERRAL_BONUS = float(os.getenv("REFERRAL_BONUS", "500"))  # 500 NGN
    
    # Working Capital
    MAX_ADVANCE_PERCENTAGE = float(os.getenv("MAX_ADVANCE_PERCENTAGE", "0.7"))  # 70% of in-escrow
    ADVANCE_FEE_RATE = float(os.getenv("ADVANCE_FEE_RATE", "0.02"))  # 2%
    
    # Tier Limits
    TIER_0_LIMIT = float(os.getenv("TIER_0_LIMIT", "10000"))  # 10K NGN
    TIER_1_LIMIT = float(os.getenv("TIER_1_LIMIT", "100000"))  # 100K NGN
    TIER_2_LIMIT = float(os.getenv("TIER_2_LIMIT", "500000"))  # 500K NGN
    TIER_3_LIMIT = float(os.getenv("TIER_3_LIMIT", "5000000"))  # 5M NGN


# =============================================================================
# Data Models
# =============================================================================

class AccountTier(str, Enum):
    TIER_0 = "tier_0"  # Phone only
    TIER_1 = "tier_1"  # Phone + Bank verified
    TIER_2 = "tier_2"  # Phone + Bank + BVN
    TIER_3 = "tier_3"  # Full KYC (ID + Address)


class AccountStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"


class SettlementSpeed(str, Enum):
    INSTANT = "instant"  # Within minutes (fee applies)
    SAME_DAY = "same_day"  # Same day if before cutoff
    NEXT_DAY = "next_day"  # T+1
    STANDARD = "standard"  # T+2 or T+3


class LoyaltyTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class AdvanceStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DISBURSED = "disbursed"
    REPAID = "repaid"
    DEFAULTED = "defaulted"


@dataclass
class MerchantAccount:
    """Merchant account with tiered KYC"""
    account_id: str
    merchant_id: str
    phone: str
    email: Optional[str]
    business_name: str
    
    # KYC Status
    tier: AccountTier
    kyc_status: Dict[str, bool]  # phone_verified, bank_verified, bvn_verified, id_verified
    
    # Account Details
    status: AccountStatus
    virtual_account_number: Optional[str]
    bank_account_number: Optional[str]
    bank_code: Optional[str]
    
    # Limits
    transaction_limit: float
    daily_limit: float
    monthly_limit: float
    
    # Stats
    total_transactions: int = 0
    total_volume: float = 0.0
    dispute_rate: float = 0.0
    
    # Loyalty
    loyalty_tier: LoyaltyTier = LoyaltyTier.BRONZE
    loyalty_points: int = 0
    cashback_earned: float = 0.0
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    upgraded_at: Optional[datetime] = None
    last_transaction_at: Optional[datetime] = None
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BuyerAccount:
    """Buyer account"""
    account_id: str
    phone: str
    name: str
    email: Optional[str]
    
    # Status
    status: AccountStatus
    phone_verified: bool = False
    
    # Stats
    total_purchases: int = 0
    total_spent: float = 0.0
    
    # Loyalty
    loyalty_tier: LoyaltyTier = LoyaltyTier.BRONZE
    loyalty_points: int = 0
    cashback_earned: float = 0.0
    cashback_balance: float = 0.0
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_purchase_at: Optional[datetime] = None


@dataclass
class SettlementRequest:
    """Settlement request"""
    settlement_id: str
    merchant_id: str
    escrow_id: str
    amount: float
    fee: float
    net_amount: float
    speed: SettlementSpeed
    status: str
    
    # Bank details
    bank_account: str
    bank_code: str
    account_name: str
    
    # Timestamps
    requested_at: datetime
    scheduled_at: datetime
    completed_at: Optional[datetime] = None
    
    # Reference
    transfer_reference: Optional[str] = None


@dataclass
class LoyaltyTransaction:
    """Loyalty transaction"""
    transaction_id: str
    account_id: str
    account_type: Literal["merchant", "buyer"]
    transaction_type: Literal["earn", "redeem", "expire", "bonus"]
    points: int
    cashback_amount: float
    description: str
    reference: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class WorkingCapitalAdvance:
    """Working capital advance"""
    advance_id: str
    merchant_id: str
    
    # Amount
    requested_amount: float
    approved_amount: float
    fee: float
    net_disbursement: float
    
    # Status
    status: AdvanceStatus
    
    # Collateral (in-escrow funds)
    escrow_ids: List[str]
    collateral_value: float
    
    # Repayment
    repaid_amount: float = 0.0
    remaining_balance: float = 0.0
    
    # Timestamps
    requested_at: datetime = field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    repaid_at: Optional[datetime] = None


@dataclass
class MerchantAnalytics:
    """Merchant analytics dashboard data"""
    merchant_id: str
    period: str  # "day", "week", "month", "year"
    
    # Volume
    total_transactions: int
    total_volume: float
    average_order_value: float
    
    # Performance
    completion_rate: float
    dispute_rate: float
    refund_rate: float
    
    # Settlement
    total_settled: float
    pending_settlement: float
    average_settlement_time_hours: float
    
    # Loyalty
    repeat_buyer_rate: float
    new_buyers: int
    
    # Comparison
    volume_change_pct: float
    transaction_change_pct: float
    
    # Generated
    generated_at: datetime = field(default_factory=datetime.utcnow)


# =============================================================================
# Instant Account Opening Service
# =============================================================================

class InstantAccountService:
    """
    Instant Account Opening with Tiered KYC
    
    Tier 0: Phone only - 10K limit
    Tier 1: Phone + Bank verified - 100K limit
    Tier 2: Phone + Bank + BVN - 500K limit
    Tier 3: Full KYC - 5M limit
    """
    
    def __init__(self):
        self._merchant_accounts: Dict[str, MerchantAccount] = {}
        self._buyer_accounts: Dict[str, BuyerAccount] = {}
        self._phone_to_merchant: Dict[str, str] = {}
        self._phone_to_buyer: Dict[str, str] = {}
    
    async def create_merchant_account(
        self,
        phone: str,
        business_name: str,
        email: Optional[str] = None
    ) -> MerchantAccount:
        """Create instant merchant account (Tier 0)"""
        
        # Check if account exists
        if phone in self._phone_to_merchant:
            existing_id = self._phone_to_merchant[phone]
            return self._merchant_accounts[existing_id]
        
        account_id = f"MA_{uuid.uuid4().hex[:12].upper()}"
        merchant_id = f"M_{uuid.uuid4().hex[:8].upper()}"
        
        account = MerchantAccount(
            account_id=account_id,
            merchant_id=merchant_id,
            phone=phone,
            email=email,
            business_name=business_name,
            tier=AccountTier.TIER_0,
            kyc_status={
                "phone_verified": False,
                "bank_verified": False,
                "bvn_verified": False,
                "id_verified": False
            },
            status=AccountStatus.PENDING,
            virtual_account_number=None,
            bank_account_number=None,
            bank_code=None,
            transaction_limit=EnablerConfig.TIER_0_LIMIT,
            daily_limit=EnablerConfig.TIER_0_LIMIT * 3,
            monthly_limit=EnablerConfig.TIER_0_LIMIT * 30
        )
        
        self._merchant_accounts[account_id] = account
        self._phone_to_merchant[phone] = account_id
        
        logger.info(f"Created merchant account {account_id} for {phone}")
        
        return account
    
    async def verify_phone(self, account_id: str, otp: str) -> MerchantAccount:
        """Verify phone and activate account"""
        
        account = self._merchant_accounts.get(account_id)
        if not account:
            raise ValueError(f"Account not found: {account_id}")
        
        # In production, verify OTP
        # For POC, assume valid
        
        account.kyc_status["phone_verified"] = True
        account.status = AccountStatus.ACTIVE
        
        logger.info(f"Phone verified for account {account_id}")
        
        return account
    
    async def upgrade_to_tier_1(
        self,
        account_id: str,
        bank_account: str,
        bank_code: str,
        account_name: str
    ) -> MerchantAccount:
        """Upgrade to Tier 1 with bank verification"""
        
        account = self._merchant_accounts.get(account_id)
        if not account:
            raise ValueError(f"Account not found: {account_id}")
        
        # Verify bank account via name enquiry
        # In production, call bank adapter
        
        account.bank_account_number = bank_account
        account.bank_code = bank_code
        account.kyc_status["bank_verified"] = True
        account.tier = AccountTier.TIER_1
        account.transaction_limit = EnablerConfig.TIER_1_LIMIT
        account.daily_limit = EnablerConfig.TIER_1_LIMIT * 3
        account.monthly_limit = EnablerConfig.TIER_1_LIMIT * 30
        account.upgraded_at = datetime.utcnow()
        
        # Create virtual account
        account.virtual_account_number = f"999{uuid.uuid4().hex[:7].upper()}"
        
        logger.info(f"Account {account_id} upgraded to Tier 1")
        
        return account
    
    async def upgrade_to_tier_2(
        self,
        account_id: str,
        bvn: str
    ) -> MerchantAccount:
        """Upgrade to Tier 2 with BVN verification"""
        
        account = self._merchant_accounts.get(account_id)
        if not account:
            raise ValueError(f"Account not found: {account_id}")
        
        if account.tier.value < AccountTier.TIER_1.value:
            raise ValueError("Must be Tier 1 to upgrade to Tier 2")
        
        # Verify BVN
        # In production, call NIBSS BVN verification
        
        account.kyc_status["bvn_verified"] = True
        account.tier = AccountTier.TIER_2
        account.transaction_limit = EnablerConfig.TIER_2_LIMIT
        account.daily_limit = EnablerConfig.TIER_2_LIMIT * 3
        account.monthly_limit = EnablerConfig.TIER_2_LIMIT * 30
        account.upgraded_at = datetime.utcnow()
        
        logger.info(f"Account {account_id} upgraded to Tier 2")
        
        return account
    
    async def upgrade_to_tier_3(
        self,
        account_id: str,
        id_document: Dict[str, Any],
        address_proof: Dict[str, Any]
    ) -> MerchantAccount:
        """Upgrade to Tier 3 with full KYC"""
        
        account = self._merchant_accounts.get(account_id)
        if not account:
            raise ValueError(f"Account not found: {account_id}")
        
        if account.tier.value < AccountTier.TIER_2.value:
            raise ValueError("Must be Tier 2 to upgrade to Tier 3")
        
        # Verify ID and address
        # In production, call identity verification service
        
        account.kyc_status["id_verified"] = True
        account.tier = AccountTier.TIER_3
        account.transaction_limit = EnablerConfig.TIER_3_LIMIT
        account.daily_limit = EnablerConfig.TIER_3_LIMIT * 3
        account.monthly_limit = EnablerConfig.TIER_3_LIMIT * 30
        account.upgraded_at = datetime.utcnow()
        
        logger.info(f"Account {account_id} upgraded to Tier 3")
        
        return account
    
    async def create_buyer_account(
        self,
        phone: str,
        name: str,
        email: Optional[str] = None
    ) -> BuyerAccount:
        """Create buyer account"""
        
        if phone in self._phone_to_buyer:
            existing_id = self._phone_to_buyer[phone]
            return self._buyer_accounts[existing_id]
        
        account_id = f"BA_{uuid.uuid4().hex[:12].upper()}"
        
        account = BuyerAccount(
            account_id=account_id,
            phone=phone,
            name=name,
            email=email,
            status=AccountStatus.ACTIVE,
            phone_verified=False
        )
        
        self._buyer_accounts[account_id] = account
        self._phone_to_buyer[phone] = account_id
        
        logger.info(f"Created buyer account {account_id} for {phone}")
        
        return account
    
    async def get_merchant_account(self, account_id: str) -> Optional[MerchantAccount]:
        """Get merchant account by ID"""
        return self._merchant_accounts.get(account_id)
    
    async def get_merchant_by_phone(self, phone: str) -> Optional[MerchantAccount]:
        """Get merchant account by phone"""
        account_id = self._phone_to_merchant.get(phone)
        if account_id:
            return self._merchant_accounts.get(account_id)
        return None
    
    async def get_buyer_account(self, account_id: str) -> Optional[BuyerAccount]:
        """Get buyer account by ID"""
        return self._buyer_accounts.get(account_id)
    
    async def check_transaction_limit(
        self,
        account_id: str,
        amount: float
    ) -> Dict[str, Any]:
        """Check if transaction is within limits"""
        
        account = self._merchant_accounts.get(account_id)
        if not account:
            return {"allowed": False, "reason": "Account not found"}
        
        if account.status != AccountStatus.ACTIVE:
            return {"allowed": False, "reason": f"Account is {account.status.value}"}
        
        if amount > account.transaction_limit:
            return {
                "allowed": False,
                "reason": f"Amount exceeds transaction limit of {account.transaction_limit}",
                "current_limit": account.transaction_limit,
                "upgrade_to": self._get_next_tier(account.tier)
            }
        
        return {
            "allowed": True,
            "current_tier": account.tier.value,
            "transaction_limit": account.transaction_limit
        }
    
    def _get_next_tier(self, current_tier: AccountTier) -> Optional[str]:
        """Get next tier for upgrade"""
        tier_order = [AccountTier.TIER_0, AccountTier.TIER_1, AccountTier.TIER_2, AccountTier.TIER_3]
        current_idx = tier_order.index(current_tier)
        if current_idx < len(tier_order) - 1:
            return tier_order[current_idx + 1].value
        return None


# =============================================================================
# Fast Settlement Service
# =============================================================================

class FastSettlementService:
    """
    Fast Settlement System
    
    Options:
    - Instant: Within minutes (0.5% fee)
    - Same-day: Before 2pm cutoff (no fee)
    - Next-day: T+1 (no fee)
    - Standard: T+2 (no fee)
    """
    
    def __init__(self):
        self._settlements: Dict[str, SettlementRequest] = {}
        self._merchant_pending: Dict[str, List[str]] = {}  # merchant_id -> settlement_ids
    
    async def request_settlement(
        self,
        merchant_id: str,
        escrow_id: str,
        amount: float,
        bank_account: str,
        bank_code: str,
        account_name: str,
        speed: SettlementSpeed = SettlementSpeed.SAME_DAY
    ) -> SettlementRequest:
        """Request settlement for completed escrow"""
        
        settlement_id = f"SET_{uuid.uuid4().hex[:12].upper()}"
        
        # Calculate fee
        fee = 0.0
        if speed == SettlementSpeed.INSTANT:
            fee = amount * EnablerConfig.INSTANT_SETTLEMENT_FEE_RATE
        
        net_amount = amount - fee
        
        # Calculate scheduled time
        now = datetime.utcnow()
        if speed == SettlementSpeed.INSTANT:
            scheduled_at = now + timedelta(minutes=5)
        elif speed == SettlementSpeed.SAME_DAY:
            cutoff = datetime.strptime(EnablerConfig.SAME_DAY_SETTLEMENT_CUTOFF, "%H:%M").time()
            if now.time() < cutoff:
                scheduled_at = now.replace(hour=16, minute=0, second=0)
            else:
                scheduled_at = (now + timedelta(days=1)).replace(hour=16, minute=0, second=0)
        elif speed == SettlementSpeed.NEXT_DAY:
            scheduled_at = (now + timedelta(days=1)).replace(hour=10, minute=0, second=0)
        else:
            scheduled_at = (now + timedelta(days=2)).replace(hour=10, minute=0, second=0)
        
        settlement = SettlementRequest(
            settlement_id=settlement_id,
            merchant_id=merchant_id,
            escrow_id=escrow_id,
            amount=amount,
            fee=fee,
            net_amount=net_amount,
            speed=speed,
            status="pending",
            bank_account=bank_account,
            bank_code=bank_code,
            account_name=account_name,
            requested_at=now,
            scheduled_at=scheduled_at
        )
        
        self._settlements[settlement_id] = settlement
        
        if merchant_id not in self._merchant_pending:
            self._merchant_pending[merchant_id] = []
        self._merchant_pending[merchant_id].append(settlement_id)
        
        logger.info(f"Settlement {settlement_id} requested for {amount} NGN ({speed.value})")
        
        # If instant, process immediately
        if speed == SettlementSpeed.INSTANT:
            await self._process_settlement(settlement_id)
        
        return settlement
    
    async def _process_settlement(self, settlement_id: str) -> SettlementRequest:
        """Process a settlement"""
        
        settlement = self._settlements.get(settlement_id)
        if not settlement:
            raise ValueError(f"Settlement not found: {settlement_id}")
        
        # In production, call bank adapter to initiate transfer
        # For POC, simulate success
        
        settlement.status = "completed"
        settlement.completed_at = datetime.utcnow()
        settlement.transfer_reference = f"TRF_{uuid.uuid4().hex[:12].upper()}"
        
        logger.info(f"Settlement {settlement_id} completed")
        
        return settlement
    
    async def get_settlement(self, settlement_id: str) -> Optional[SettlementRequest]:
        """Get settlement by ID"""
        return self._settlements.get(settlement_id)
    
    async def get_merchant_settlements(
        self,
        merchant_id: str,
        status: Optional[str] = None
    ) -> List[SettlementRequest]:
        """Get settlements for a merchant"""
        
        settlement_ids = self._merchant_pending.get(merchant_id, [])
        settlements = [self._settlements[sid] for sid in settlement_ids if sid in self._settlements]
        
        if status:
            settlements = [s for s in settlements if s.status == status]
        
        return settlements
    
    async def get_settlement_options(self, amount: float) -> List[Dict[str, Any]]:
        """Get available settlement options with fees"""
        
        return [
            {
                "speed": SettlementSpeed.INSTANT.value,
                "name": "Instant Settlement",
                "description": "Receive funds within 5 minutes",
                "fee": amount * EnablerConfig.INSTANT_SETTLEMENT_FEE_RATE,
                "fee_rate": EnablerConfig.INSTANT_SETTLEMENT_FEE_RATE,
                "net_amount": amount * (1 - EnablerConfig.INSTANT_SETTLEMENT_FEE_RATE),
                "estimated_time": "5 minutes"
            },
            {
                "speed": SettlementSpeed.SAME_DAY.value,
                "name": "Same-Day Settlement",
                "description": f"Receive funds by 4pm if requested before {EnablerConfig.SAME_DAY_SETTLEMENT_CUTOFF}",
                "fee": 0,
                "fee_rate": 0,
                "net_amount": amount,
                "estimated_time": "Same day by 4pm"
            },
            {
                "speed": SettlementSpeed.NEXT_DAY.value,
                "name": "Next-Day Settlement",
                "description": "Receive funds by 10am next business day",
                "fee": 0,
                "fee_rate": 0,
                "net_amount": amount,
                "estimated_time": "Next business day"
            },
            {
                "speed": SettlementSpeed.STANDARD.value,
                "name": "Standard Settlement",
                "description": "Receive funds within 2 business days",
                "fee": 0,
                "fee_rate": 0,
                "net_amount": amount,
                "estimated_time": "2 business days"
            }
        ]


# =============================================================================
# Loyalty Program Service
# =============================================================================

class LoyaltyService:
    """
    Loyalty and Cashback Program
    
    Features:
    - Cashback on transactions
    - Points accumulation
    - Tier upgrades
    - Referral bonuses
    """
    
    def __init__(self):
        self._transactions: List[LoyaltyTransaction] = []
        self._referrals: Dict[str, List[str]] = {}  # referrer -> referred
    
    async def earn_cashback_buyer(
        self,
        buyer_account: BuyerAccount,
        transaction_amount: float,
        escrow_id: str
    ) -> LoyaltyTransaction:
        """Award cashback to buyer"""
        
        # Calculate cashback based on tier
        tier_multipliers = {
            LoyaltyTier.BRONZE: 1.0,
            LoyaltyTier.SILVER: 1.2,
            LoyaltyTier.GOLD: 1.5,
            LoyaltyTier.PLATINUM: 2.0
        }
        
        multiplier = tier_multipliers.get(buyer_account.loyalty_tier, 1.0)
        cashback_rate = EnablerConfig.CASHBACK_RATE_BUYER * multiplier
        cashback_amount = transaction_amount * cashback_rate
        
        # Calculate points (1 point per 100 NGN)
        points = int(transaction_amount / 100)
        
        transaction = LoyaltyTransaction(
            transaction_id=f"LT_{uuid.uuid4().hex[:12].upper()}",
            account_id=buyer_account.account_id,
            account_type="buyer",
            transaction_type="earn",
            points=points,
            cashback_amount=cashback_amount,
            description=f"Cashback for purchase {escrow_id}",
            reference=escrow_id
        )
        
        self._transactions.append(transaction)
        
        # Update buyer account
        buyer_account.loyalty_points += points
        buyer_account.cashback_earned += cashback_amount
        buyer_account.cashback_balance += cashback_amount
        
        # Check for tier upgrade
        await self._check_buyer_tier_upgrade(buyer_account)
        
        logger.info(f"Buyer {buyer_account.account_id} earned {cashback_amount} NGN cashback")
        
        return transaction
    
    async def earn_cashback_merchant(
        self,
        merchant_account: MerchantAccount,
        transaction_amount: float,
        escrow_id: str
    ) -> LoyaltyTransaction:
        """Award cashback to merchant"""
        
        tier_multipliers = {
            LoyaltyTier.BRONZE: 1.0,
            LoyaltyTier.SILVER: 1.2,
            LoyaltyTier.GOLD: 1.5,
            LoyaltyTier.PLATINUM: 2.0
        }
        
        multiplier = tier_multipliers.get(merchant_account.loyalty_tier, 1.0)
        cashback_rate = EnablerConfig.CASHBACK_RATE_SELLER * multiplier
        cashback_amount = transaction_amount * cashback_rate
        
        points = int(transaction_amount / 100)
        
        transaction = LoyaltyTransaction(
            transaction_id=f"LT_{uuid.uuid4().hex[:12].upper()}",
            account_id=merchant_account.account_id,
            account_type="merchant",
            transaction_type="earn",
            points=points,
            cashback_amount=cashback_amount,
            description=f"Cashback for sale {escrow_id}",
            reference=escrow_id
        )
        
        self._transactions.append(transaction)
        
        merchant_account.loyalty_points += points
        merchant_account.cashback_earned += cashback_amount
        
        await self._check_merchant_tier_upgrade(merchant_account)
        
        logger.info(f"Merchant {merchant_account.account_id} earned {cashback_amount} NGN cashback")
        
        return transaction
    
    async def redeem_cashback(
        self,
        buyer_account: BuyerAccount,
        amount: float
    ) -> LoyaltyTransaction:
        """Redeem cashback balance"""
        
        if amount > buyer_account.cashback_balance:
            raise ValueError(f"Insufficient cashback balance. Available: {buyer_account.cashback_balance}")
        
        transaction = LoyaltyTransaction(
            transaction_id=f"LT_{uuid.uuid4().hex[:12].upper()}",
            account_id=buyer_account.account_id,
            account_type="buyer",
            transaction_type="redeem",
            points=0,
            cashback_amount=-amount,
            description=f"Cashback redemption"
        )
        
        self._transactions.append(transaction)
        buyer_account.cashback_balance -= amount
        
        logger.info(f"Buyer {buyer_account.account_id} redeemed {amount} NGN cashback")
        
        return transaction
    
    async def process_referral(
        self,
        referrer_id: str,
        referred_id: str,
        referrer_type: Literal["merchant", "buyer"]
    ) -> LoyaltyTransaction:
        """Process referral bonus"""
        
        if referrer_id not in self._referrals:
            self._referrals[referrer_id] = []
        
        if referred_id in self._referrals[referrer_id]:
            raise ValueError("Referral already processed")
        
        self._referrals[referrer_id].append(referred_id)
        
        transaction = LoyaltyTransaction(
            transaction_id=f"LT_{uuid.uuid4().hex[:12].upper()}",
            account_id=referrer_id,
            account_type=referrer_type,
            transaction_type="bonus",
            points=100,
            cashback_amount=EnablerConfig.REFERRAL_BONUS,
            description=f"Referral bonus for {referred_id}"
        )
        
        self._transactions.append(transaction)
        
        logger.info(f"Referral bonus awarded to {referrer_id}")
        
        return transaction
    
    async def _check_buyer_tier_upgrade(self, account: BuyerAccount):
        """Check and upgrade buyer loyalty tier"""
        
        # Tier thresholds based on total spent
        if account.total_spent >= 5000000:  # 5M
            account.loyalty_tier = LoyaltyTier.PLATINUM
        elif account.total_spent >= 1000000:  # 1M
            account.loyalty_tier = LoyaltyTier.GOLD
        elif account.total_spent >= 200000:  # 200K
            account.loyalty_tier = LoyaltyTier.SILVER
    
    async def _check_merchant_tier_upgrade(self, account: MerchantAccount):
        """Check and upgrade merchant loyalty tier"""
        
        if account.total_volume >= 50000000:  # 50M
            account.loyalty_tier = LoyaltyTier.PLATINUM
        elif account.total_volume >= 10000000:  # 10M
            account.loyalty_tier = LoyaltyTier.GOLD
        elif account.total_volume >= 2000000:  # 2M
            account.loyalty_tier = LoyaltyTier.SILVER
    
    async def get_loyalty_summary(
        self,
        account_id: str,
        account_type: Literal["merchant", "buyer"]
    ) -> Dict[str, Any]:
        """Get loyalty summary for account"""
        
        transactions = [
            t for t in self._transactions
            if t.account_id == account_id and t.account_type == account_type
        ]
        
        total_earned = sum(t.cashback_amount for t in transactions if t.transaction_type == "earn")
        total_redeemed = abs(sum(t.cashback_amount for t in transactions if t.transaction_type == "redeem"))
        total_points = sum(t.points for t in transactions)
        
        return {
            "account_id": account_id,
            "total_earned": total_earned,
            "total_redeemed": total_redeemed,
            "total_points": total_points,
            "transaction_count": len(transactions),
            "referrals": len(self._referrals.get(account_id, []))
        }


# =============================================================================
# Working Capital Service
# =============================================================================

class WorkingCapitalService:
    """
    Working Capital Advance System
    
    Allows merchants to get advances against in-escrow funds.
    """
    
    def __init__(self):
        self._advances: Dict[str, WorkingCapitalAdvance] = {}
        self._merchant_advances: Dict[str, List[str]] = {}
    
    async def check_eligibility(
        self,
        merchant_id: str,
        in_escrow_amount: float,
        merchant_tier: AccountTier
    ) -> Dict[str, Any]:
        """Check eligibility for working capital advance"""
        
        # Must be at least Tier 1
        if merchant_tier == AccountTier.TIER_0:
            return {
                "eligible": False,
                "reason": "Must be Tier 1 or higher",
                "upgrade_required": True
            }
        
        # Check existing advances
        existing = self._merchant_advances.get(merchant_id, [])
        active_advances = [
            self._advances[aid] for aid in existing
            if self._advances[aid].status in [AdvanceStatus.APPROVED, AdvanceStatus.DISBURSED]
        ]
        
        if active_advances:
            return {
                "eligible": False,
                "reason": "Active advance exists",
                "active_advance_id": active_advances[0].advance_id
            }
        
        # Calculate max advance
        max_advance = in_escrow_amount * EnablerConfig.MAX_ADVANCE_PERCENTAGE
        fee = max_advance * EnablerConfig.ADVANCE_FEE_RATE
        
        return {
            "eligible": True,
            "max_advance": max_advance,
            "fee_rate": EnablerConfig.ADVANCE_FEE_RATE,
            "fee": fee,
            "net_disbursement": max_advance - fee,
            "collateral_required": in_escrow_amount
        }
    
    async def request_advance(
        self,
        merchant_id: str,
        amount: float,
        escrow_ids: List[str],
        collateral_value: float
    ) -> WorkingCapitalAdvance:
        """Request working capital advance"""
        
        # Validate amount
        max_advance = collateral_value * EnablerConfig.MAX_ADVANCE_PERCENTAGE
        if amount > max_advance:
            raise ValueError(f"Amount exceeds maximum advance of {max_advance}")
        
        advance_id = f"ADV_{uuid.uuid4().hex[:12].upper()}"
        fee = amount * EnablerConfig.ADVANCE_FEE_RATE
        
        advance = WorkingCapitalAdvance(
            advance_id=advance_id,
            merchant_id=merchant_id,
            requested_amount=amount,
            approved_amount=amount,
            fee=fee,
            net_disbursement=amount - fee,
            status=AdvanceStatus.PENDING,
            escrow_ids=escrow_ids,
            collateral_value=collateral_value,
            remaining_balance=amount
        )
        
        self._advances[advance_id] = advance
        
        if merchant_id not in self._merchant_advances:
            self._merchant_advances[merchant_id] = []
        self._merchant_advances[merchant_id].append(advance_id)
        
        logger.info(f"Advance {advance_id} requested for {amount} NGN")
        
        return advance
    
    async def approve_advance(self, advance_id: str) -> WorkingCapitalAdvance:
        """Approve advance request"""
        
        advance = self._advances.get(advance_id)
        if not advance:
            raise ValueError(f"Advance not found: {advance_id}")
        
        advance.status = AdvanceStatus.APPROVED
        advance.approved_at = datetime.utcnow()
        advance.due_date = datetime.utcnow() + timedelta(days=30)
        
        logger.info(f"Advance {advance_id} approved")
        
        return advance
    
    async def disburse_advance(self, advance_id: str) -> WorkingCapitalAdvance:
        """Disburse approved advance"""
        
        advance = self._advances.get(advance_id)
        if not advance:
            raise ValueError(f"Advance not found: {advance_id}")
        
        if advance.status != AdvanceStatus.APPROVED:
            raise ValueError(f"Advance is not approved: {advance.status}")
        
        # In production, initiate transfer to merchant
        
        advance.status = AdvanceStatus.DISBURSED
        advance.disbursed_at = datetime.utcnow()
        
        logger.info(f"Advance {advance_id} disbursed")
        
        return advance
    
    async def record_repayment(
        self,
        advance_id: str,
        amount: float
    ) -> WorkingCapitalAdvance:
        """Record repayment against advance"""
        
        advance = self._advances.get(advance_id)
        if not advance:
            raise ValueError(f"Advance not found: {advance_id}")
        
        advance.repaid_amount += amount
        advance.remaining_balance = max(0, advance.approved_amount - advance.repaid_amount)
        
        if advance.remaining_balance == 0:
            advance.status = AdvanceStatus.REPAID
            advance.repaid_at = datetime.utcnow()
        
        logger.info(f"Repayment of {amount} recorded for advance {advance_id}")
        
        return advance
    
    async def get_advance(self, advance_id: str) -> Optional[WorkingCapitalAdvance]:
        """Get advance by ID"""
        return self._advances.get(advance_id)
    
    async def get_merchant_advances(self, merchant_id: str) -> List[WorkingCapitalAdvance]:
        """Get all advances for a merchant"""
        advance_ids = self._merchant_advances.get(merchant_id, [])
        return [self._advances[aid] for aid in advance_ids if aid in self._advances]


# =============================================================================
# Merchant Analytics Service
# =============================================================================

class MerchantAnalyticsService:
    """
    Merchant Analytics Dashboard
    
    Provides insights on:
    - Transaction volume and trends
    - Performance metrics
    - Settlement status
    - Customer insights
    """
    
    def __init__(self):
        self._transaction_data: Dict[str, List[Dict[str, Any]]] = {}
    
    async def record_transaction(
        self,
        merchant_id: str,
        escrow_id: str,
        amount: float,
        status: str,
        buyer_id: str,
        is_repeat_buyer: bool
    ):
        """Record transaction for analytics"""
        
        if merchant_id not in self._transaction_data:
            self._transaction_data[merchant_id] = []
        
        self._transaction_data[merchant_id].append({
            "escrow_id": escrow_id,
            "amount": amount,
            "status": status,
            "buyer_id": buyer_id,
            "is_repeat_buyer": is_repeat_buyer,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def get_analytics(
        self,
        merchant_id: str,
        period: str = "month"
    ) -> MerchantAnalytics:
        """Get analytics for merchant"""
        
        transactions = self._transaction_data.get(merchant_id, [])
        
        # Filter by period
        now = datetime.utcnow()
        if period == "day":
            cutoff = now - timedelta(days=1)
        elif period == "week":
            cutoff = now - timedelta(weeks=1)
        elif period == "month":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = now - timedelta(days=365)
        
        filtered = [
            t for t in transactions
            if datetime.fromisoformat(t["timestamp"]) >= cutoff
        ]
        
        # Calculate metrics
        total_transactions = len(filtered)
        total_volume = sum(t["amount"] for t in filtered)
        avg_order_value = total_volume / total_transactions if total_transactions > 0 else 0
        
        completed = [t for t in filtered if t["status"] == "completed"]
        disputed = [t for t in filtered if t["status"] == "disputed"]
        refunded = [t for t in filtered if t["status"] == "refunded"]
        
        completion_rate = len(completed) / total_transactions if total_transactions > 0 else 0
        dispute_rate = len(disputed) / total_transactions if total_transactions > 0 else 0
        refund_rate = len(refunded) / total_transactions if total_transactions > 0 else 0
        
        repeat_buyers = [t for t in filtered if t.get("is_repeat_buyer")]
        repeat_buyer_rate = len(repeat_buyers) / total_transactions if total_transactions > 0 else 0
        
        unique_buyers = len(set(t["buyer_id"] for t in filtered))
        
        return MerchantAnalytics(
            merchant_id=merchant_id,
            period=period,
            total_transactions=total_transactions,
            total_volume=total_volume,
            average_order_value=avg_order_value,
            completion_rate=completion_rate,
            dispute_rate=dispute_rate,
            refund_rate=refund_rate,
            total_settled=sum(t["amount"] for t in completed),
            pending_settlement=sum(t["amount"] for t in filtered if t["status"] == "pending"),
            average_settlement_time_hours=24,  # Placeholder
            repeat_buyer_rate=repeat_buyer_rate,
            new_buyers=unique_buyers - len(repeat_buyers),
            volume_change_pct=0,  # Would compare to previous period
            transaction_change_pct=0
        )
    
    async def get_dashboard_summary(self, merchant_id: str) -> Dict[str, Any]:
        """Get dashboard summary for merchant"""
        
        day_analytics = await self.get_analytics(merchant_id, "day")
        week_analytics = await self.get_analytics(merchant_id, "week")
        month_analytics = await self.get_analytics(merchant_id, "month")
        
        return {
            "merchant_id": merchant_id,
            "today": {
                "transactions": day_analytics.total_transactions,
                "volume": day_analytics.total_volume,
                "completion_rate": day_analytics.completion_rate
            },
            "this_week": {
                "transactions": week_analytics.total_transactions,
                "volume": week_analytics.total_volume,
                "completion_rate": week_analytics.completion_rate
            },
            "this_month": {
                "transactions": month_analytics.total_transactions,
                "volume": month_analytics.total_volume,
                "completion_rate": month_analytics.completion_rate,
                "dispute_rate": month_analytics.dispute_rate,
                "repeat_buyer_rate": month_analytics.repeat_buyer_rate
            }
        }


# =============================================================================
# Unified Technical Enabler Service
# =============================================================================

class TechnicalEnablerService:
    """Unified service for all technical enablers"""
    
    def __init__(self):
        self.account_service = InstantAccountService()
        self.settlement_service = FastSettlementService()
        self.loyalty_service = LoyaltyService()
        self.working_capital_service = WorkingCapitalService()
        self.analytics_service = MerchantAnalyticsService()
    
    async def onboard_merchant(
        self,
        phone: str,
        business_name: str,
        email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Complete merchant onboarding flow"""
        
        # Create account
        account = await self.account_service.create_merchant_account(
            phone=phone,
            business_name=business_name,
            email=email
        )
        
        return {
            "account_id": account.account_id,
            "merchant_id": account.merchant_id,
            "tier": account.tier.value,
            "status": account.status.value,
            "transaction_limit": account.transaction_limit,
            "next_steps": [
                "Verify phone number",
                "Add bank account to upgrade to Tier 1",
                "Verify BVN to upgrade to Tier 2"
            ]
        }
    
    async def process_completed_escrow(
        self,
        merchant_id: str,
        buyer_id: str,
        escrow_id: str,
        amount: float,
        bank_account: str,
        bank_code: str,
        account_name: str,
        settlement_speed: SettlementSpeed = SettlementSpeed.SAME_DAY
    ) -> Dict[str, Any]:
        """Process completed escrow with settlement and loyalty"""
        
        # Get accounts
        merchant_account = None
        buyer_account = None
        
        for acc in self.account_service._merchant_accounts.values():
            if acc.merchant_id == merchant_id:
                merchant_account = acc
                break
        
        buyer_account = self.account_service._buyer_accounts.get(buyer_id)
        
        # Request settlement
        settlement = await self.settlement_service.request_settlement(
            merchant_id=merchant_id,
            escrow_id=escrow_id,
            amount=amount,
            bank_account=bank_account,
            bank_code=bank_code,
            account_name=account_name,
            speed=settlement_speed
        )
        
        # Award loyalty
        merchant_loyalty = None
        buyer_loyalty = None
        
        if merchant_account:
            merchant_loyalty = await self.loyalty_service.earn_cashback_merchant(
                merchant_account=merchant_account,
                transaction_amount=amount,
                escrow_id=escrow_id
            )
            merchant_account.total_transactions += 1
            merchant_account.total_volume += amount
            merchant_account.last_transaction_at = datetime.utcnow()
        
        if buyer_account:
            buyer_loyalty = await self.loyalty_service.earn_cashback_buyer(
                buyer_account=buyer_account,
                transaction_amount=amount,
                escrow_id=escrow_id
            )
            buyer_account.total_purchases += 1
            buyer_account.total_spent += amount
            buyer_account.last_purchase_at = datetime.utcnow()
        
        # Record analytics
        await self.analytics_service.record_transaction(
            merchant_id=merchant_id,
            escrow_id=escrow_id,
            amount=amount,
            status="completed",
            buyer_id=buyer_id,
            is_repeat_buyer=buyer_account.total_purchases > 1 if buyer_account else False
        )
        
        return {
            "settlement": {
                "settlement_id": settlement.settlement_id,
                "amount": settlement.amount,
                "fee": settlement.fee,
                "net_amount": settlement.net_amount,
                "speed": settlement.speed.value,
                "scheduled_at": settlement.scheduled_at.isoformat()
            },
            "merchant_loyalty": {
                "cashback": merchant_loyalty.cashback_amount if merchant_loyalty else 0,
                "points": merchant_loyalty.points if merchant_loyalty else 0
            } if merchant_loyalty else None,
            "buyer_loyalty": {
                "cashback": buyer_loyalty.cashback_amount if buyer_loyalty else 0,
                "points": buyer_loyalty.points if buyer_loyalty else 0
            } if buyer_loyalty else None
        }


# =============================================================================
# Singleton Instance
# =============================================================================

enabler_service = TechnicalEnablerService()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/enablers", tags=["Technical Enablers"])


class CreateMerchantRequest(BaseModel):
    phone: str
    business_name: str
    email: Optional[str] = None


class UpgradeTier1Request(BaseModel):
    account_id: str
    bank_account: str
    bank_code: str
    account_name: str


class UpgradeTier2Request(BaseModel):
    account_id: str
    bvn: str


class CreateBuyerRequest(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None


class SettlementRequest(BaseModel):
    merchant_id: str
    escrow_id: str
    amount: float
    bank_account: str
    bank_code: str
    account_name: str
    speed: str = "same_day"


class AdvanceRequest(BaseModel):
    merchant_id: str
    amount: float
    escrow_ids: List[str]
    collateral_value: float


class RedeemCashbackRequest(BaseModel):
    buyer_account_id: str
    amount: float


# Account Endpoints
@router.post("/accounts/merchant")
async def create_merchant_account(request: CreateMerchantRequest):
    """Create instant merchant account"""
    result = await enabler_service.onboard_merchant(
        phone=request.phone,
        business_name=request.business_name,
        email=request.email
    )
    return result


@router.post("/accounts/merchant/upgrade/tier1")
async def upgrade_to_tier1(request: UpgradeTier1Request):
    """Upgrade merchant to Tier 1"""
    account = await enabler_service.account_service.upgrade_to_tier_1(
        account_id=request.account_id,
        bank_account=request.bank_account,
        bank_code=request.bank_code,
        account_name=request.account_name
    )
    return {
        "account_id": account.account_id,
        "tier": account.tier.value,
        "transaction_limit": account.transaction_limit,
        "virtual_account": account.virtual_account_number
    }


@router.post("/accounts/merchant/upgrade/tier2")
async def upgrade_to_tier2(request: UpgradeTier2Request):
    """Upgrade merchant to Tier 2"""
    account = await enabler_service.account_service.upgrade_to_tier_2(
        account_id=request.account_id,
        bvn=request.bvn
    )
    return {
        "account_id": account.account_id,
        "tier": account.tier.value,
        "transaction_limit": account.transaction_limit
    }


@router.get("/accounts/merchant/{account_id}")
async def get_merchant_account(account_id: str):
    """Get merchant account details"""
    account = await enabler_service.account_service.get_merchant_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {
        "account_id": account.account_id,
        "merchant_id": account.merchant_id,
        "business_name": account.business_name,
        "tier": account.tier.value,
        "status": account.status.value,
        "kyc_status": account.kyc_status,
        "transaction_limit": account.transaction_limit,
        "virtual_account": account.virtual_account_number,
        "loyalty_tier": account.loyalty_tier.value,
        "loyalty_points": account.loyalty_points,
        "total_transactions": account.total_transactions,
        "total_volume": account.total_volume
    }


@router.post("/accounts/buyer")
async def create_buyer_account(request: CreateBuyerRequest):
    """Create buyer account"""
    account = await enabler_service.account_service.create_buyer_account(
        phone=request.phone,
        name=request.name,
        email=request.email
    )
    return {
        "account_id": account.account_id,
        "name": account.name,
        "status": account.status.value,
        "loyalty_tier": account.loyalty_tier.value
    }


# Settlement Endpoints
@router.get("/settlement/options")
async def get_settlement_options(amount: float):
    """Get available settlement options"""
    return await enabler_service.settlement_service.get_settlement_options(amount)


@router.post("/settlement/request")
async def request_settlement(request: SettlementRequest):
    """Request settlement"""
    try:
        speed = SettlementSpeed(request.speed)
    except ValueError:
        speed = SettlementSpeed.SAME_DAY
    
    settlement = await enabler_service.settlement_service.request_settlement(
        merchant_id=request.merchant_id,
        escrow_id=request.escrow_id,
        amount=request.amount,
        bank_account=request.bank_account,
        bank_code=request.bank_code,
        account_name=request.account_name,
        speed=speed
    )
    
    return {
        "settlement_id": settlement.settlement_id,
        "amount": settlement.amount,
        "fee": settlement.fee,
        "net_amount": settlement.net_amount,
        "speed": settlement.speed.value,
        "status": settlement.status,
        "scheduled_at": settlement.scheduled_at.isoformat()
    }


@router.get("/settlement/{settlement_id}")
async def get_settlement(settlement_id: str):
    """Get settlement status"""
    settlement = await enabler_service.settlement_service.get_settlement(settlement_id)
    if not settlement:
        raise HTTPException(status_code=404, detail="Settlement not found")
    
    return {
        "settlement_id": settlement.settlement_id,
        "amount": settlement.amount,
        "fee": settlement.fee,
        "net_amount": settlement.net_amount,
        "speed": settlement.speed.value,
        "status": settlement.status,
        "scheduled_at": settlement.scheduled_at.isoformat(),
        "completed_at": settlement.completed_at.isoformat() if settlement.completed_at else None
    }


# Loyalty Endpoints
@router.get("/loyalty/{account_id}")
async def get_loyalty_summary(account_id: str, account_type: str = "buyer"):
    """Get loyalty summary"""
    return await enabler_service.loyalty_service.get_loyalty_summary(
        account_id=account_id,
        account_type=account_type
    )


@router.post("/loyalty/redeem")
async def redeem_cashback(request: RedeemCashbackRequest):
    """Redeem cashback"""
    account = await enabler_service.account_service.get_buyer_account(request.buyer_account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    transaction = await enabler_service.loyalty_service.redeem_cashback(
        buyer_account=account,
        amount=request.amount
    )
    
    return {
        "transaction_id": transaction.transaction_id,
        "amount_redeemed": abs(transaction.cashback_amount),
        "remaining_balance": account.cashback_balance
    }


# Working Capital Endpoints
@router.get("/capital/eligibility")
async def check_advance_eligibility(
    merchant_id: str,
    in_escrow_amount: float,
    merchant_tier: str = "tier_1"
):
    """Check eligibility for working capital advance"""
    try:
        tier = AccountTier(merchant_tier)
    except ValueError:
        tier = AccountTier.TIER_1
    
    return await enabler_service.working_capital_service.check_eligibility(
        merchant_id=merchant_id,
        in_escrow_amount=in_escrow_amount,
        merchant_tier=tier
    )


@router.post("/capital/request")
async def request_advance(request: AdvanceRequest):
    """Request working capital advance"""
    advance = await enabler_service.working_capital_service.request_advance(
        merchant_id=request.merchant_id,
        amount=request.amount,
        escrow_ids=request.escrow_ids,
        collateral_value=request.collateral_value
    )
    
    return {
        "advance_id": advance.advance_id,
        "requested_amount": advance.requested_amount,
        "fee": advance.fee,
        "net_disbursement": advance.net_disbursement,
        "status": advance.status.value
    }


@router.get("/capital/{advance_id}")
async def get_advance(advance_id: str):
    """Get advance status"""
    advance = await enabler_service.working_capital_service.get_advance(advance_id)
    if not advance:
        raise HTTPException(status_code=404, detail="Advance not found")
    
    return {
        "advance_id": advance.advance_id,
        "requested_amount": advance.requested_amount,
        "approved_amount": advance.approved_amount,
        "fee": advance.fee,
        "net_disbursement": advance.net_disbursement,
        "status": advance.status.value,
        "repaid_amount": advance.repaid_amount,
        "remaining_balance": advance.remaining_balance
    }


# Analytics Endpoints
@router.get("/analytics/{merchant_id}")
async def get_merchant_analytics(merchant_id: str, period: str = "month"):
    """Get merchant analytics"""
    analytics = await enabler_service.analytics_service.get_analytics(
        merchant_id=merchant_id,
        period=period
    )
    
    return {
        "merchant_id": analytics.merchant_id,
        "period": analytics.period,
        "total_transactions": analytics.total_transactions,
        "total_volume": analytics.total_volume,
        "average_order_value": analytics.average_order_value,
        "completion_rate": analytics.completion_rate,
        "dispute_rate": analytics.dispute_rate,
        "refund_rate": analytics.refund_rate,
        "repeat_buyer_rate": analytics.repeat_buyer_rate
    }


@router.get("/analytics/{merchant_id}/dashboard")
async def get_merchant_dashboard(merchant_id: str):
    """Get merchant dashboard summary"""
    return await enabler_service.analytics_service.get_dashboard_summary(merchant_id)


# Tier Information
@router.get("/tiers")
async def get_tier_information():
    """Get account tier information"""
    return {
        "tiers": [
            {
                "tier": "tier_0",
                "name": "Starter",
                "requirements": ["Phone number"],
                "transaction_limit": EnablerConfig.TIER_0_LIMIT,
                "features": ["Basic escrow", "Phone support"]
            },
            {
                "tier": "tier_1",
                "name": "Verified",
                "requirements": ["Phone number", "Bank account verified"],
                "transaction_limit": EnablerConfig.TIER_1_LIMIT,
                "features": ["Virtual account", "Same-day settlement", "Working capital eligible"]
            },
            {
                "tier": "tier_2",
                "name": "Trusted",
                "requirements": ["Phone number", "Bank account verified", "BVN verified"],
                "transaction_limit": EnablerConfig.TIER_2_LIMIT,
                "features": ["Instant settlement", "Higher working capital", "Priority support"]
            },
            {
                "tier": "tier_3",
                "name": "Premium",
                "requirements": ["Full KYC (ID + Address proof)"],
                "transaction_limit": EnablerConfig.TIER_3_LIMIT,
                "features": ["Highest limits", "Dedicated account manager", "Custom terms"]
            }
        ]
    }
