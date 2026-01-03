"""
Progressive KYC Service for SocialEscrow
Risk-based, tiered KYC optimized for Nigerian social commerce

Design Principles:
1. Minimize friction for small merchants
2. Gate payout, not sale (let transactions happen, verify at withdrawal)
3. Progressive verification as volume/value increases
4. Automatic bank name enquiry (no user action needed)
5. Risk-triggered step-up verification

Tiers:
- Tier 0 (Phone Only): ₦10,000 per transaction
- Tier 1 (Bank Verified): ₦100,000 per transaction - 80% of merchants stay here
- Tier 2 (BVN Verified): ₦1,000,000 per transaction
- Tier 3 (Full KYC): Unlimited
"""

import uuid
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class KYCTier(int, Enum):
    """Progressive KYC tiers for social commerce"""
    PHONE_ONLY = 0      # Just phone number
    BANK_VERIFIED = 1   # Bank account name matched
    BVN_VERIFIED = 2    # BVN verified
    FULL_KYC = 3        # NIN + document + liveness


class VerificationStatus(str, Enum):
    """Status of a verification attempt"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PayoutHoldReason(str, Enum):
    """Reasons for holding a payout"""
    KYC_REQUIRED = "kyc_required"
    FIRST_PAYOUT = "first_payout"
    HIGH_VALUE = "high_value"
    RISK_FLAG = "risk_flag"
    BANK_CHANGE = "bank_change"
    MANUAL_REVIEW = "manual_review"


@dataclass
class MerchantKYC:
    """Merchant's KYC profile"""
    merchant_id: str
    phone: str
    phone_verified: bool = False
    
    # Bank verification (Tier 1)
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None  # From bank name enquiry
    bank_verified: bool = False
    bank_verified_at: Optional[str] = None
    
    # BVN verification (Tier 2)
    bvn_hash: Optional[str] = None  # Hashed BVN, never store plain
    bvn_first_name: Optional[str] = None
    bvn_last_name: Optional[str] = None
    bvn_verified: bool = False
    bvn_verified_at: Optional[str] = None
    
    # Full KYC (Tier 3)
    nin_hash: Optional[str] = None
    nin_verified: bool = False
    document_verified: bool = False
    liveness_verified: bool = False
    full_kyc_at: Optional[str] = None
    
    # Badges and status
    verified_badge: bool = False
    instant_payout_enabled: bool = False
    
    # Limits and usage
    current_tier: KYCTier = KYCTier.PHONE_ONLY
    cumulative_volume_30d: float = 0.0
    transaction_count_30d: int = 0
    last_transaction_at: Optional[str] = None
    
    # Risk flags
    risk_flags: List[str] = field(default_factory=list)
    payout_holds: List[str] = field(default_factory=list)
    
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class PayoutRequest:
    """Payout request with KYC check"""
    id: str
    merchant_id: str
    escrow_id: str
    amount: float
    status: str  # pending, kyc_required, approved, processing, completed, failed
    kyc_tier_required: KYCTier
    current_kyc_tier: KYCTier
    hold_reasons: List[PayoutHoldReason] = field(default_factory=list)
    kyc_upgrade_url: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    processed_at: Optional[str] = None


# Tier limits (in NGN)
TIER_LIMITS = {
    KYCTier.PHONE_ONLY: {
        "per_transaction": 10000,       # ₦10,000
        "daily": 20000,                 # ₦20,000
        "monthly": 50000,               # ₦50,000
        "payout_delay_hours": 72,       # 3 days hold
    },
    KYCTier.BANK_VERIFIED: {
        "per_transaction": 100000,      # ₦100,000
        "daily": 300000,                # ₦300,000
        "monthly": 1000000,             # ₦1,000,000
        "payout_delay_hours": 24,       # 24 hour hold
    },
    KYCTier.BVN_VERIFIED: {
        "per_transaction": 1000000,     # ₦1,000,000
        "daily": 3000000,               # ₦3,000,000
        "monthly": 10000000,            # ₦10,000,000
        "payout_delay_hours": 0,        # Instant payout
    },
    KYCTier.FULL_KYC: {
        "per_transaction": 999999999,  # Effectively unlimited
        "daily": 999999999,
        "monthly": 999999999,
        "payout_delay_hours": 0,
    },
}

# Thresholds that trigger KYC upgrade prompts
UPGRADE_TRIGGERS = {
    "monthly_volume_for_bvn": 500000,      # ₦500k/month triggers BVN prompt
    "single_transaction_for_bvn": 100000,  # ₦100k single triggers BVN prompt
    "monthly_volume_for_full": 5000000,    # ₦5M/month triggers full KYC
}


class BankNameEnquiryService:
    """
    Automatic bank name enquiry service.
    
    In production, integrates with:
    - Paystack Resolve Account API
    - Flutterwave Account Verification
    - Direct NIBSS integration
    
    For POC, simulates the verification.
    """
    
    # Nigerian bank codes
    BANK_CODES = {
        "044": "Access Bank",
        "023": "Citibank",
        "063": "Diamond Bank",
        "050": "Ecobank",
        "084": "Enterprise Bank",
        "070": "Fidelity Bank",
        "011": "First Bank",
        "214": "FCMB",
        "058": "GTBank",
        "030": "Heritage Bank",
        "301": "Jaiz Bank",
        "082": "Keystone Bank",
        "526": "Parallex Bank",
        "076": "Polaris Bank",
        "101": "Providus Bank",
        "221": "Stanbic IBTC",
        "068": "Standard Chartered",
        "232": "Sterling Bank",
        "100": "Suntrust Bank",
        "032": "Union Bank",
        "033": "UBA",
        "215": "Unity Bank",
        "035": "Wema Bank",
        "057": "Zenith Bank",
        "999": "OPay",
        "998": "PalmPay",
        "997": "Kuda",
        "996": "Moniepoint",
    }
    
    def __init__(self):
        self.verification_cache: Dict[str, Dict[str, Any]] = {}
    
    async def verify_account(
        self,
        bank_code: str,
        account_number: str
    ) -> Dict[str, Any]:
        """
        Verify bank account and get account holder name.
        
        In production, calls Paystack/Flutterwave API:
        POST https://api.paystack.co/bank/resolve
        {
            "account_number": "0001234567",
            "bank_code": "058"
        }
        
        Returns account_name if valid.
        """
        cache_key = f"{bank_code}:{account_number}"
        
        # Check cache
        if cache_key in self.verification_cache:
            return self.verification_cache[cache_key]
        
        # Validate inputs
        if not self._validate_account_number(account_number):
            return {
                "success": False,
                "error": "Invalid account number format"
            }
        
        if bank_code not in self.BANK_CODES:
            return {
                "success": False,
                "error": "Invalid bank code"
            }
        
        # In production, call Paystack/Flutterwave API
        # For POC, simulate successful verification
        bank_name = self.BANK_CODES[bank_code]
        
        # Simulate account name (in production, this comes from bank)
        simulated_name = f"MERCHANT {account_number[-4:]}"
        
        result = {
            "success": True,
            "account_number": account_number,
            "account_name": simulated_name,
            "bank_code": bank_code,
            "bank_name": bank_name,
            "verified_at": datetime.utcnow().isoformat()
        }
        
        # Cache result
        self.verification_cache[cache_key] = result
        
        logger.info(f"Bank account verified: {bank_name} ****{account_number[-4:]}")
        return result
    
    def _validate_account_number(self, account_number: str) -> bool:
        """Validate Nigerian bank account number format"""
        # Nigerian accounts are 10 digits (NUBAN)
        return bool(re.match(r'^\d{10}$', account_number))
    
    def get_bank_name(self, bank_code: str) -> Optional[str]:
        """Get bank name from code"""
        return self.BANK_CODES.get(bank_code)


class BVNVerificationService:
    """
    BVN verification service.
    
    In production, integrates with:
    - NIBSS BVN Validation API (via licensed aggregator)
    - Dojah BVN Lookup
    - Smile Identity BVN Verification
    
    For POC, simulates the verification.
    """
    
    def __init__(self):
        self.verifications: Dict[str, Dict[str, Any]] = {}
    
    async def verify_bvn(
        self,
        bvn: str,
        first_name: str,
        last_name: str,
        date_of_birth: str = None
    ) -> Dict[str, Any]:
        """
        Verify BVN and match against provided details.
        
        In production:
        1. Call NIBSS/aggregator API with BVN
        2. Get back: first_name, last_name, dob, phone, photo
        3. Match against provided details
        4. Return match score and verification status
        """
        # Validate BVN format (11 digits)
        if not re.match(r'^\d{11}$', bvn):
            return {
                "success": False,
                "error": "Invalid BVN format. Must be 11 digits."
            }
        
        # In production, call NIBSS/aggregator
        # For POC, simulate verification
        
        # Simulate BVN data (in production, comes from NIBSS)
        simulated_bvn_data = {
            "first_name": first_name.upper(),
            "last_name": last_name.upper(),
            "phone": "080XXXXXXXX",
            "dob": date_of_birth or "1990-01-01"
        }
        
        # Name matching (fuzzy match in production)
        first_name_match = first_name.upper() == simulated_bvn_data["first_name"]
        last_name_match = last_name.upper() == simulated_bvn_data["last_name"]
        
        if first_name_match and last_name_match:
            result = {
                "success": True,
                "match_score": 100,
                "first_name": simulated_bvn_data["first_name"],
                "last_name": simulated_bvn_data["last_name"],
                "verified_at": datetime.utcnow().isoformat()
            }
        else:
            result = {
                "success": False,
                "error": "Name does not match BVN records",
                "match_score": 50 if first_name_match or last_name_match else 0
            }
        
        # Store verification attempt
        self.verifications[bvn[:4] + "****" + bvn[-3:]] = result
        
        return result


class ProgressiveKYCService:
    """
    Main progressive KYC service for social commerce.
    
    Key Features:
    1. Automatic tier progression based on verification
    2. KYC-at-payout enforcement (not at transaction creation)
    3. Risk-triggered step-up verification
    4. Verified badge system
    """
    
    def __init__(self):
        self.merchants: Dict[str, MerchantKYC] = {}
        self.payout_requests: Dict[str, PayoutRequest] = {}
        self.bank_enquiry = BankNameEnquiryService()
        self.bvn_service = BVNVerificationService()
    
    # ==========================================
    # MERCHANT REGISTRATION & TIER MANAGEMENT
    # ==========================================
    
    def register_merchant(
        self,
        merchant_id: str,
        phone: str,
        phone_verified: bool = True
    ) -> MerchantKYC:
        """
        Register new merchant with phone verification.
        Starts at Tier 0 (Phone Only).
        """
        merchant = MerchantKYC(
            merchant_id=merchant_id,
            phone=phone,
            phone_verified=phone_verified,
            current_tier=KYCTier.PHONE_ONLY
        )
        
        self.merchants[merchant_id] = merchant
        logger.info(f"Merchant {merchant_id} registered at Tier 0 (Phone Only)")
        
        return merchant
    
    def get_merchant(self, merchant_id: str) -> Optional[MerchantKYC]:
        """Get merchant KYC profile"""
        return self.merchants.get(merchant_id)
    
    def get_tier_limits(self, tier: KYCTier) -> Dict[str, Any]:
        """Get limits for a KYC tier"""
        return TIER_LIMITS.get(tier, TIER_LIMITS[KYCTier.PHONE_ONLY])
    
    # ==========================================
    # BANK VERIFICATION (TIER 1)
    # ==========================================
    
    async def add_bank_account(
        self,
        merchant_id: str,
        bank_code: str,
        account_number: str
    ) -> Dict[str, Any]:
        """
        Add and verify bank account.
        Automatically upgrades to Tier 1 if name enquiry succeeds.
        """
        merchant = self.merchants.get(merchant_id)
        if not merchant:
            return {"success": False, "error": "Merchant not found"}
        
        # Perform bank name enquiry
        verification = await self.bank_enquiry.verify_account(bank_code, account_number)
        
        if not verification["success"]:
            return verification
        
        # Update merchant profile
        merchant.bank_code = bank_code
        merchant.account_number = account_number
        merchant.account_name = verification["account_name"]
        merchant.bank_verified = True
        merchant.bank_verified_at = datetime.utcnow().isoformat()
        
        # Upgrade to Tier 1
        if merchant.current_tier == KYCTier.PHONE_ONLY:
            merchant.current_tier = KYCTier.BANK_VERIFIED
            logger.info(f"Merchant {merchant_id} upgraded to Tier 1 (Bank Verified)")
        
        merchant.updated_at = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "tier": merchant.current_tier.name,
            "account_name": verification["account_name"],
            "bank_name": verification["bank_name"],
            "limits": self.get_tier_limits(merchant.current_tier)
        }
    
    # ==========================================
    # BVN VERIFICATION (TIER 2)
    # ==========================================
    
    async def verify_bvn(
        self,
        merchant_id: str,
        bvn: str,
        first_name: str,
        last_name: str
    ) -> Dict[str, Any]:
        """
        Verify BVN and upgrade to Tier 2.
        """
        merchant = self.merchants.get(merchant_id)
        if not merchant:
            return {"success": False, "error": "Merchant not found"}
        
        # Must be at least Tier 1 to verify BVN
        if merchant.current_tier < KYCTier.BANK_VERIFIED:
            return {
                "success": False,
                "error": "Please add and verify bank account first"
            }
        
        # Verify BVN
        verification = await self.bvn_service.verify_bvn(bvn, first_name, last_name)
        
        if not verification["success"]:
            return verification
        
        # Update merchant profile (store hash, not plain BVN)
        import hashlib
        merchant.bvn_hash = hashlib.sha256(bvn.encode()).hexdigest()
        merchant.bvn_first_name = verification["first_name"]
        merchant.bvn_last_name = verification["last_name"]
        merchant.bvn_verified = True
        merchant.bvn_verified_at = datetime.utcnow().isoformat()
        
        # Upgrade to Tier 2
        merchant.current_tier = KYCTier.BVN_VERIFIED
        merchant.verified_badge = True  # Award verified badge
        merchant.instant_payout_enabled = True  # Enable instant payouts
        
        merchant.updated_at = datetime.utcnow().isoformat()
        
        logger.info(f"Merchant {merchant_id} upgraded to Tier 2 (BVN Verified)")
        
        return {
            "success": True,
            "tier": merchant.current_tier.name,
            "verified_badge": True,
            "instant_payout": True,
            "limits": self.get_tier_limits(merchant.current_tier)
        }
    
    # ==========================================
    # TRANSACTION CHECKS (ALLOW SALE)
    # ==========================================
    
    def check_transaction_allowed(
        self,
        merchant_id: str,
        amount: float
    ) -> Dict[str, Any]:
        """
        Check if a transaction can be created.
        
        Key principle: We allow the sale to happen even if KYC is low.
        The merchant will be prompted to upgrade KYC at payout time.
        """
        merchant = self.merchants.get(merchant_id)
        
        if not merchant:
            # New merchant - allow transaction, will register on first payout
            return {
                "allowed": True,
                "kyc_required_for_payout": True,
                "message": "Transaction allowed. Seller will need to verify identity to receive payout."
            }
        
        limits = self.get_tier_limits(merchant.current_tier)
        
        # Check per-transaction limit
        if amount > limits["per_transaction"]:
            # Still allow, but flag that KYC upgrade needed for payout
            return {
                "allowed": True,
                "kyc_required_for_payout": True,
                "current_tier": merchant.current_tier.name,
                "current_limit": limits["per_transaction"],
                "message": f"Transaction allowed. Seller will need to upgrade to receive payout for amounts over ₦{limits['per_transaction']:,.0f}."
            }
        
        return {
            "allowed": True,
            "kyc_required_for_payout": False,
            "current_tier": merchant.current_tier.name
        }
    
    # ==========================================
    # PAYOUT CHECKS (GATE WITHDRAWAL)
    # ==========================================
    
    def check_payout_allowed(
        self,
        merchant_id: str,
        amount: float,
        escrow_id: str
    ) -> Dict[str, Any]:
        """
        Check if payout can be processed.
        
        This is where KYC is enforced - at withdrawal time.
        """
        merchant = self.merchants.get(merchant_id)
        
        if not merchant:
            return {
                "allowed": False,
                "reason": PayoutHoldReason.KYC_REQUIRED.value,
                "message": "Please register and verify your identity to receive payout",
                "action_url": "/kyc/register"
            }
        
        hold_reasons = []
        limits = self.get_tier_limits(merchant.current_tier)
        
        # Check 1: Per-transaction limit
        if amount > limits["per_transaction"]:
            hold_reasons.append(PayoutHoldReason.HIGH_VALUE)
        
        # Check 2: First payout for new merchants
        if merchant.transaction_count_30d == 0:
            hold_reasons.append(PayoutHoldReason.FIRST_PAYOUT)
        
        # Check 3: Risk flags
        if merchant.risk_flags:
            hold_reasons.append(PayoutHoldReason.RISK_FLAG)
        
        # Check 4: Bank not verified
        if not merchant.bank_verified:
            hold_reasons.append(PayoutHoldReason.KYC_REQUIRED)
        
        # Determine required tier
        required_tier = self._get_required_tier_for_amount(amount)
        
        if hold_reasons:
            # Create payout request with hold
            payout_id = f"PAY-{uuid.uuid4().hex[:8].upper()}"
            payout = PayoutRequest(
                id=payout_id,
                merchant_id=merchant_id,
                escrow_id=escrow_id,
                amount=amount,
                status="kyc_required" if PayoutHoldReason.KYC_REQUIRED in hold_reasons else "pending_review",
                kyc_tier_required=required_tier,
                current_kyc_tier=merchant.current_tier,
                hold_reasons=hold_reasons,
                kyc_upgrade_url=f"/kyc/upgrade?tier={required_tier.value}&payout={payout_id}"
            )
            self.payout_requests[payout_id] = payout
            
            return {
                "allowed": False,
                "payout_id": payout_id,
                "hold_reasons": [r.value for r in hold_reasons],
                "current_tier": merchant.current_tier.name,
                "required_tier": required_tier.name,
                "message": self._get_hold_message(hold_reasons, required_tier),
                "action_url": payout.kyc_upgrade_url
            }
        
        # Payout allowed
        payout_delay = limits["payout_delay_hours"]
        
        return {
            "allowed": True,
            "current_tier": merchant.current_tier.name,
            "payout_delay_hours": payout_delay,
            "instant_payout": payout_delay == 0,
            "message": "Payout approved" if payout_delay == 0 else f"Payout will be processed in {payout_delay} hours"
        }
    
    def _get_required_tier_for_amount(self, amount: float) -> KYCTier:
        """Determine minimum KYC tier required for an amount"""
        for tier in [KYCTier.PHONE_ONLY, KYCTier.BANK_VERIFIED, KYCTier.BVN_VERIFIED, KYCTier.FULL_KYC]:
            if amount <= TIER_LIMITS[tier]["per_transaction"]:
                return tier
        return KYCTier.FULL_KYC
    
    def _get_hold_message(self, reasons: List[PayoutHoldReason], required_tier: KYCTier) -> str:
        """Generate user-friendly hold message"""
        if PayoutHoldReason.KYC_REQUIRED in reasons:
            if required_tier == KYCTier.BANK_VERIFIED:
                return "Please add your bank account to receive this payout"
            elif required_tier == KYCTier.BVN_VERIFIED:
                return "Please verify your BVN to receive payouts over ₦100,000"
            else:
                return "Please complete identity verification to receive this payout"
        
        if PayoutHoldReason.FIRST_PAYOUT in reasons:
            return "First payout requires additional verification. Please verify your bank account."
        
        if PayoutHoldReason.HIGH_VALUE in reasons:
            return f"High-value payout requires {required_tier.name} verification"
        
        if PayoutHoldReason.RISK_FLAG in reasons:
            return "This payout is under review. Please contact support."
        
        return "Payout is being processed"
    
    # ==========================================
    # RISK-TRIGGERED STEP-UP
    # ==========================================
    
    def trigger_step_up_verification(
        self,
        merchant_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """
        Trigger step-up verification due to risk signals.
        
        Called by fraud detection when suspicious activity detected.
        """
        merchant = self.merchants.get(merchant_id)
        if not merchant:
            return {"success": False, "error": "Merchant not found"}
        
        merchant.risk_flags.append(reason)
        merchant.payout_holds.append(f"step_up_required:{datetime.utcnow().isoformat()}")
        merchant.updated_at = datetime.utcnow().isoformat()
        
        logger.warning(f"Step-up verification triggered for {merchant_id}: {reason}")
        
        return {
            "success": True,
            "merchant_id": merchant_id,
            "reason": reason,
            "action_required": "Complete BVN verification to continue",
            "action_url": f"/kyc/step-up?merchant={merchant_id}"
        }
    
    def clear_risk_flag(self, merchant_id: str, flag: str) -> bool:
        """Clear a risk flag after verification"""
        merchant = self.merchants.get(merchant_id)
        if merchant and flag in merchant.risk_flags:
            merchant.risk_flags.remove(flag)
            merchant.updated_at = datetime.utcnow().isoformat()
            return True
        return False
    
    # ==========================================
    # VERIFIED BADGE SYSTEM
    # ==========================================
    
    def get_merchant_badge(self, merchant_id: str) -> Dict[str, Any]:
        """Get merchant's verification badge for display"""
        merchant = self.merchants.get(merchant_id)
        
        if not merchant:
            return {
                "badge": "unverified",
                "color": "gray",
                "label": "New Seller"
            }
        
        if merchant.current_tier >= KYCTier.BVN_VERIFIED:
            return {
                "badge": "verified",
                "color": "green",
                "label": "Verified Seller",
                "icon": "shield-check",
                "benefits": ["Instant payouts", "Higher limits", "Trust badge"]
            }
        
        if merchant.current_tier >= KYCTier.BANK_VERIFIED:
            return {
                "badge": "bank_verified",
                "color": "blue",
                "label": "Bank Verified",
                "icon": "bank",
                "benefits": ["24h payouts", "₦100k limit"]
            }
        
        return {
            "badge": "phone_verified",
            "color": "yellow",
            "label": "Phone Verified",
            "icon": "phone",
            "benefits": ["₦10k limit", "72h payout hold"]
        }
    
    # ==========================================
    # VOLUME TRACKING & UPGRADE PROMPTS
    # ==========================================
    
    def record_transaction(
        self,
        merchant_id: str,
        amount: float
    ):
        """Record transaction for volume tracking"""
        merchant = self.merchants.get(merchant_id)
        if not merchant:
            return
        
        merchant.cumulative_volume_30d += amount
        merchant.transaction_count_30d += 1
        merchant.last_transaction_at = datetime.utcnow().isoformat()
        merchant.updated_at = datetime.utcnow().isoformat()
    
    def check_upgrade_prompt(self, merchant_id: str) -> Optional[Dict[str, Any]]:
        """Check if merchant should be prompted to upgrade KYC"""
        merchant = self.merchants.get(merchant_id)
        if not merchant:
            return None
        
        # Already at highest tier
        if merchant.current_tier >= KYCTier.BVN_VERIFIED:
            return None
        
        # Check if volume triggers upgrade prompt
        if merchant.current_tier == KYCTier.BANK_VERIFIED:
            if merchant.cumulative_volume_30d >= UPGRADE_TRIGGERS["monthly_volume_for_bvn"]:
                return {
                    "prompt": True,
                    "reason": "volume_threshold",
                    "current_tier": merchant.current_tier.name,
                    "suggested_tier": "BVN_VERIFIED",
                    "message": "You've processed over ₦500k this month! Verify your BVN to unlock instant payouts and higher limits.",
                    "benefits": ["Instant payouts", "₦1M per transaction", "Verified badge"],
                    "action_url": "/kyc/upgrade?tier=2"
                }
        
        if merchant.current_tier == KYCTier.PHONE_ONLY:
            return {
                "prompt": True,
                "reason": "basic_verification",
                "current_tier": merchant.current_tier.name,
                "suggested_tier": "BANK_VERIFIED",
                "message": "Add your bank account to increase your limits and receive faster payouts.",
                "benefits": ["₦100k per transaction", "24h payouts"],
                "action_url": "/kyc/upgrade?tier=1"
            }
        
        return None
    
    # ==========================================
    # STATISTICS & REPORTING
    # ==========================================
    
    def get_kyc_stats(self) -> Dict[str, Any]:
        """Get KYC statistics for dashboard"""
        tier_counts = {tier.name: 0 for tier in KYCTier}
        total_volume = 0
        verified_count = 0
        
        for merchant in self.merchants.values():
            tier_counts[merchant.current_tier.name] += 1
            total_volume += merchant.cumulative_volume_30d
            if merchant.verified_badge:
                verified_count += 1
        
        return {
            "total_merchants": len(self.merchants),
            "tier_distribution": tier_counts,
            "verified_merchants": verified_count,
            "total_volume_30d": total_volume,
            "pending_payouts": len([p for p in self.payout_requests.values() if p.status in ["pending", "kyc_required"]])
        }


# Global service instance
progressive_kyc = ProgressiveKYCService()
