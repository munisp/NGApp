"""
Seller Tier System

Implements a tiered seller program with automatic upgrades based on performance:
- Bronze: 5+ completed transactions
- Silver: 20+ completed, <5% dispute rate
- Gold: 50+ completed, <2% dispute rate
- Platinum: 100+ completed, verified business

Benefits include:
- Fee discounts (2% -> 1.4%)
- Faster payouts (T+1 -> instant)
- Priority support
- Featured badges
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, field, asdict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/seller-tiers", tags=["Seller Tiers"])


# =============================================================================
# Tier Definitions
# =============================================================================

class SellerTier(str, Enum):
    """Seller tier levels"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


@dataclass
class TierRequirements:
    """Requirements to achieve a tier"""
    min_completed_transactions: int
    max_dispute_rate: float  # As percentage (e.g., 5.0 = 5%)
    min_account_age_days: int = 0
    requires_business_verification: bool = False
    min_total_volume: float = 0  # In NGN


@dataclass
class TierBenefits:
    """Benefits for a tier"""
    fee_percentage: float  # Platform fee (e.g., 2.0 = 2%)
    payout_speed: str  # "T+1", "T+0", "instant"
    payout_hours: int  # Hours until payout
    priority_support: bool
    featured_badge: bool
    dedicated_account_manager: bool
    api_access: bool
    max_transaction_limit: float  # In NGN
    dispute_resolution_sla_hours: int
    trust_badge_level: int  # 1-4 for display


# Tier configuration
TIER_CONFIG: Dict[SellerTier, Dict[str, Any]] = {
    SellerTier.BRONZE: {
        "requirements": TierRequirements(
            min_completed_transactions=5,
            max_dispute_rate=100.0,  # No limit for bronze
            min_account_age_days=0,
            requires_business_verification=False,
            min_total_volume=0
        ),
        "benefits": TierBenefits(
            fee_percentage=2.0,
            payout_speed="T+1",
            payout_hours=24,
            priority_support=False,
            featured_badge=False,
            dedicated_account_manager=False,
            api_access=False,
            max_transaction_limit=500000,  # 500k NGN
            dispute_resolution_sla_hours=48,
            trust_badge_level=1
        )
    },
    SellerTier.SILVER: {
        "requirements": TierRequirements(
            min_completed_transactions=20,
            max_dispute_rate=5.0,
            min_account_age_days=14,
            requires_business_verification=False,
            min_total_volume=500000
        ),
        "benefits": TierBenefits(
            fee_percentage=1.8,
            payout_speed="T+0",
            payout_hours=12,
            priority_support=True,
            featured_badge=False,
            dedicated_account_manager=False,
            api_access=False,
            max_transaction_limit=1000000,  # 1M NGN
            dispute_resolution_sla_hours=24,
            trust_badge_level=2
        )
    },
    SellerTier.GOLD: {
        "requirements": TierRequirements(
            min_completed_transactions=50,
            max_dispute_rate=2.0,
            min_account_age_days=30,
            requires_business_verification=False,
            min_total_volume=2000000
        ),
        "benefits": TierBenefits(
            fee_percentage=1.6,
            payout_speed="instant",
            payout_hours=4,
            priority_support=True,
            featured_badge=True,
            dedicated_account_manager=False,
            api_access=True,
            max_transaction_limit=5000000,  # 5M NGN
            dispute_resolution_sla_hours=12,
            trust_badge_level=3
        )
    },
    SellerTier.PLATINUM: {
        "requirements": TierRequirements(
            min_completed_transactions=100,
            max_dispute_rate=1.0,
            min_account_age_days=60,
            requires_business_verification=True,
            min_total_volume=10000000
        ),
        "benefits": TierBenefits(
            fee_percentage=1.4,
            payout_speed="instant",
            payout_hours=1,
            priority_support=True,
            featured_badge=True,
            dedicated_account_manager=True,
            api_access=True,
            max_transaction_limit=50000000,  # 50M NGN
            dispute_resolution_sla_hours=4,
            trust_badge_level=4
        )
    }
}


# =============================================================================
# Seller Profile
# =============================================================================

@dataclass
class SellerStats:
    """Seller performance statistics"""
    total_transactions: int = 0
    completed_transactions: int = 0
    disputed_transactions: int = 0
    refunded_transactions: int = 0
    total_volume: float = 0.0
    average_rating: float = 0.0
    total_ratings: int = 0
    on_time_shipping_rate: float = 100.0
    response_time_hours: float = 24.0
    
    @property
    def dispute_rate(self) -> float:
        if self.completed_transactions == 0:
            return 0.0
        return (self.disputed_transactions / self.completed_transactions) * 100


@dataclass
class SellerProfile:
    """Complete seller profile with tier information"""
    seller_id: str
    phone: str
    username: str
    current_tier: SellerTier = SellerTier.BRONZE
    stats: SellerStats = field(default_factory=SellerStats)
    created_at: str = ""
    business_verified: bool = False
    bank_verified: bool = False
    identity_verified: bool = False
    growth_wallet_balance: float = 0.0
    tier_upgraded_at: str = ""
    next_tier_progress: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


# =============================================================================
# In-Memory Storage (Use persistent storage in production)
# =============================================================================

_seller_profiles: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Tier Calculation Engine
# =============================================================================

class TierEngine:
    """Engine for calculating and upgrading seller tiers"""
    
    @staticmethod
    def calculate_eligible_tier(profile: SellerProfile) -> SellerTier:
        """Calculate the highest tier a seller is eligible for"""
        
        account_age_days = (datetime.utcnow() - datetime.fromisoformat(profile.created_at)).days
        
        eligible_tier = SellerTier.BRONZE
        
        for tier in [SellerTier.PLATINUM, SellerTier.GOLD, SellerTier.SILVER, SellerTier.BRONZE]:
            config = TIER_CONFIG[tier]
            reqs = config["requirements"]
            
            # Check all requirements
            meets_transactions = profile.stats.completed_transactions >= reqs.min_completed_transactions
            meets_dispute_rate = profile.stats.dispute_rate <= reqs.max_dispute_rate
            meets_account_age = account_age_days >= reqs.min_account_age_days
            meets_volume = profile.stats.total_volume >= reqs.min_total_volume
            meets_business = not reqs.requires_business_verification or profile.business_verified
            
            if all([meets_transactions, meets_dispute_rate, meets_account_age, meets_volume, meets_business]):
                eligible_tier = tier
                break
        
        return eligible_tier
    
    @staticmethod
    def calculate_next_tier_progress(profile: SellerProfile) -> Dict[str, Any]:
        """Calculate progress toward next tier"""
        
        current_tier = profile.current_tier
        tier_order = [SellerTier.BRONZE, SellerTier.SILVER, SellerTier.GOLD, SellerTier.PLATINUM]
        current_index = tier_order.index(current_tier)
        
        if current_index >= len(tier_order) - 1:
            return {"at_max_tier": True, "current_tier": current_tier.value}
        
        next_tier = tier_order[current_index + 1]
        next_reqs = TIER_CONFIG[next_tier]["requirements"]
        
        account_age_days = (datetime.utcnow() - datetime.fromisoformat(profile.created_at)).days
        
        progress = {
            "next_tier": next_tier.value,
            "requirements": {
                "completed_transactions": {
                    "current": profile.stats.completed_transactions,
                    "required": next_reqs.min_completed_transactions,
                    "progress_pct": min(100, (profile.stats.completed_transactions / next_reqs.min_completed_transactions) * 100)
                },
                "dispute_rate": {
                    "current": profile.stats.dispute_rate,
                    "required_max": next_reqs.max_dispute_rate,
                    "meets_requirement": profile.stats.dispute_rate <= next_reqs.max_dispute_rate
                },
                "account_age_days": {
                    "current": account_age_days,
                    "required": next_reqs.min_account_age_days,
                    "progress_pct": min(100, (account_age_days / max(1, next_reqs.min_account_age_days)) * 100)
                },
                "total_volume": {
                    "current": profile.stats.total_volume,
                    "required": next_reqs.min_total_volume,
                    "progress_pct": min(100, (profile.stats.total_volume / max(1, next_reqs.min_total_volume)) * 100)
                }
            }
        }
        
        if next_reqs.requires_business_verification:
            progress["requirements"]["business_verification"] = {
                "current": profile.business_verified,
                "required": True
            }
        
        # Calculate overall progress
        progress_values = [
            progress["requirements"]["completed_transactions"]["progress_pct"],
            progress["requirements"]["account_age_days"]["progress_pct"],
            progress["requirements"]["total_volume"]["progress_pct"]
        ]
        progress["overall_progress_pct"] = sum(progress_values) / len(progress_values)
        
        return progress
    
    @staticmethod
    def get_tier_benefits(tier: SellerTier) -> TierBenefits:
        """Get benefits for a specific tier"""
        return TIER_CONFIG[tier]["benefits"]
    
    @staticmethod
    def calculate_fee(tier: SellerTier, amount: float) -> Dict[str, float]:
        """Calculate fees for a transaction based on tier"""
        benefits = TIER_CONFIG[tier]["benefits"]
        fee_rate = benefits.fee_percentage / 100
        fee_amount = amount * fee_rate
        
        return {
            "amount": amount,
            "fee_rate": benefits.fee_percentage,
            "fee_amount": fee_amount,
            "seller_receives": amount - fee_amount,
            "standard_fee_rate": 2.0,
            "savings": amount * (2.0 - benefits.fee_percentage) / 100
        }


# =============================================================================
# API Models
# =============================================================================

class SellerProfileResponse(BaseModel):
    seller_id: str
    username: str
    current_tier: str
    tier_benefits: Dict[str, Any]
    stats: Dict[str, Any]
    next_tier_progress: Dict[str, Any]
    growth_wallet_balance: float
    badges: List[str]


class UpdateStatsRequest(BaseModel):
    completed_transactions: Optional[int] = None
    disputed_transactions: Optional[int] = None
    total_volume: Optional[float] = None
    rating: Optional[float] = None


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/tiers")
async def get_all_tiers():
    """Get all tier definitions and benefits"""
    tiers = []
    for tier in SellerTier:
        config = TIER_CONFIG[tier]
        tiers.append({
            "tier": tier.value,
            "requirements": asdict(config["requirements"]),
            "benefits": asdict(config["benefits"])
        })
    return {"tiers": tiers}


@router.get("/profile/{seller_id}")
async def get_seller_profile(seller_id: str):
    """Get seller profile with tier information"""
    
    if seller_id not in _seller_profiles:
        # Create default profile
        profile = SellerProfile(
            seller_id=seller_id,
            phone="",
            username=f"seller_{seller_id[:8]}"
        )
        _seller_profiles[seller_id] = asdict(profile)
    
    profile_data = _seller_profiles[seller_id]
    profile = SellerProfile(**{
        **profile_data,
        "stats": SellerStats(**profile_data.get("stats", {})),
        "current_tier": SellerTier(profile_data.get("current_tier", "bronze"))
    })
    
    # Calculate eligible tier and progress
    eligible_tier = TierEngine.calculate_eligible_tier(profile)
    next_tier_progress = TierEngine.calculate_next_tier_progress(profile)
    benefits = TierEngine.get_tier_benefits(profile.current_tier)
    
    # Generate badges
    badges = [f"{profile.current_tier.value}_seller"]
    if profile.bank_verified:
        badges.append("bank_verified")
    if profile.identity_verified:
        badges.append("identity_verified")
    if profile.business_verified:
        badges.append("business_verified")
    if profile.stats.completed_transactions >= 10:
        badges.append("trusted_seller")
    if profile.stats.average_rating >= 4.5 and profile.stats.total_ratings >= 5:
        badges.append("top_rated")
    
    return {
        "seller_id": profile.seller_id,
        "username": profile.username,
        "current_tier": profile.current_tier.value,
        "eligible_tier": eligible_tier.value,
        "tier_benefits": asdict(benefits),
        "stats": asdict(profile.stats),
        "next_tier_progress": next_tier_progress,
        "growth_wallet_balance": profile.growth_wallet_balance,
        "badges": badges,
        "verifications": {
            "bank": profile.bank_verified,
            "identity": profile.identity_verified,
            "business": profile.business_verified
        }
    }


@router.post("/profile/{seller_id}/create")
async def create_seller_profile(
    seller_id: str,
    username: str,
    phone: str
):
    """Create a new seller profile"""
    
    if seller_id in _seller_profiles:
        raise HTTPException(status_code=400, detail="Seller profile already exists")
    
    profile = SellerProfile(
        seller_id=seller_id,
        phone=phone,
        username=username
    )
    
    _seller_profiles[seller_id] = asdict(profile)
    
    benefits = TierEngine.get_tier_benefits(profile.current_tier)
    
    return {
        "success": True,
        "seller_id": seller_id,
        "current_tier": profile.current_tier.value,
        "tier_benefits": asdict(benefits),
        "message": f"Welcome! You start at {profile.current_tier.value} tier. Complete 5 transactions to unlock benefits!"
    }


@router.post("/profile/{seller_id}/record-transaction")
async def record_transaction(
    seller_id: str,
    amount: float,
    completed: bool = True,
    disputed: bool = False,
    rating: Optional[float] = None
):
    """Record a transaction and update seller stats"""
    
    if seller_id not in _seller_profiles:
        # Auto-create profile
        profile = SellerProfile(
            seller_id=seller_id,
            phone="",
            username=f"seller_{seller_id[:8]}"
        )
        _seller_profiles[seller_id] = asdict(profile)
    
    profile_data = _seller_profiles[seller_id]
    stats = profile_data.get("stats", {})
    
    # Update stats
    stats["total_transactions"] = stats.get("total_transactions", 0) + 1
    if completed:
        stats["completed_transactions"] = stats.get("completed_transactions", 0) + 1
        stats["total_volume"] = stats.get("total_volume", 0) + amount
    if disputed:
        stats["disputed_transactions"] = stats.get("disputed_transactions", 0) + 1
    
    if rating is not None:
        total_ratings = stats.get("total_ratings", 0)
        current_avg = stats.get("average_rating", 0)
        new_total = total_ratings + 1
        new_avg = ((current_avg * total_ratings) + rating) / new_total
        stats["average_rating"] = round(new_avg, 2)
        stats["total_ratings"] = new_total
    
    profile_data["stats"] = stats
    
    # Check for tier upgrade
    profile = SellerProfile(**{
        **profile_data,
        "stats": SellerStats(**stats),
        "current_tier": SellerTier(profile_data.get("current_tier", "bronze"))
    })
    
    eligible_tier = TierEngine.calculate_eligible_tier(profile)
    tier_upgraded = False
    old_tier = profile.current_tier
    
    tier_order = [SellerTier.BRONZE, SellerTier.SILVER, SellerTier.GOLD, SellerTier.PLATINUM]
    if tier_order.index(eligible_tier) > tier_order.index(profile.current_tier):
        profile_data["current_tier"] = eligible_tier.value
        profile_data["tier_upgraded_at"] = datetime.utcnow().isoformat()
        tier_upgraded = True
        
        # Add growth wallet bonus for tier upgrade
        tier_bonuses = {
            SellerTier.SILVER: 1000,  # 1000 NGN
            SellerTier.GOLD: 5000,    # 5000 NGN
            SellerTier.PLATINUM: 20000  # 20000 NGN
        }
        if eligible_tier in tier_bonuses:
            profile_data["growth_wallet_balance"] = profile_data.get("growth_wallet_balance", 0) + tier_bonuses[eligible_tier]
    
    # Calculate growth wallet rebate (0.4% of transaction)
    if completed:
        rebate = amount * 0.004  # 0.4% rebate
        profile_data["growth_wallet_balance"] = profile_data.get("growth_wallet_balance", 0) + rebate
    
    _seller_profiles[seller_id] = profile_data
    
    # Calculate fee based on current tier
    current_tier = SellerTier(profile_data["current_tier"])
    fee_info = TierEngine.calculate_fee(current_tier, amount)
    
    response = {
        "success": True,
        "seller_id": seller_id,
        "transaction_recorded": True,
        "current_tier": current_tier.value,
        "fee_info": fee_info,
        "growth_wallet_balance": profile_data["growth_wallet_balance"],
        "stats": stats
    }
    
    if tier_upgraded:
        new_benefits = TierEngine.get_tier_benefits(eligible_tier)
        response["tier_upgraded"] = True
        response["old_tier"] = old_tier.value
        response["new_tier"] = eligible_tier.value
        response["new_benefits"] = asdict(new_benefits)
        response["upgrade_message"] = f"Congratulations! You've been upgraded to {eligible_tier.value} tier! Enjoy lower fees ({new_benefits.fee_percentage}%) and faster payouts ({new_benefits.payout_speed})."
    
    return response


@router.get("/profile/{seller_id}/fee-calculator")
async def calculate_transaction_fee(seller_id: str, amount: float):
    """Calculate fee for a transaction based on seller's tier"""
    
    if seller_id not in _seller_profiles:
        tier = SellerTier.BRONZE
    else:
        tier = SellerTier(_seller_profiles[seller_id].get("current_tier", "bronze"))
    
    fee_info = TierEngine.calculate_fee(tier, amount)
    
    return {
        "seller_id": seller_id,
        "current_tier": tier.value,
        **fee_info
    }


@router.post("/profile/{seller_id}/verify")
async def verify_seller(
    seller_id: str,
    verification_type: str,  # "bank", "identity", "business"
    verified: bool = True
):
    """Update seller verification status"""
    
    if seller_id not in _seller_profiles:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    profile_data = _seller_profiles[seller_id]
    
    if verification_type == "bank":
        profile_data["bank_verified"] = verified
    elif verification_type == "identity":
        profile_data["identity_verified"] = verified
    elif verification_type == "business":
        profile_data["business_verified"] = verified
    else:
        raise HTTPException(status_code=400, detail="Invalid verification type")
    
    _seller_profiles[seller_id] = profile_data
    
    # Check for tier upgrade after business verification
    if verification_type == "business" and verified:
        profile = SellerProfile(**{
            **profile_data,
            "stats": SellerStats(**profile_data.get("stats", {})),
            "current_tier": SellerTier(profile_data.get("current_tier", "bronze"))
        })
        eligible_tier = TierEngine.calculate_eligible_tier(profile)
        
        tier_order = [SellerTier.BRONZE, SellerTier.SILVER, SellerTier.GOLD, SellerTier.PLATINUM]
        if tier_order.index(eligible_tier) > tier_order.index(profile.current_tier):
            profile_data["current_tier"] = eligible_tier.value
            profile_data["tier_upgraded_at"] = datetime.utcnow().isoformat()
            _seller_profiles[seller_id] = profile_data
    
    return {
        "success": True,
        "seller_id": seller_id,
        "verification_type": verification_type,
        "verified": verified,
        "current_tier": profile_data.get("current_tier", "bronze")
    }


@router.get("/leaderboard")
async def get_seller_leaderboard(limit: int = 10):
    """Get top sellers by volume"""
    
    sellers = []
    for seller_id, profile_data in _seller_profiles.items():
        stats = profile_data.get("stats", {})
        sellers.append({
            "seller_id": seller_id,
            "username": profile_data.get("username", ""),
            "tier": profile_data.get("current_tier", "bronze"),
            "completed_transactions": stats.get("completed_transactions", 0),
            "total_volume": stats.get("total_volume", 0),
            "average_rating": stats.get("average_rating", 0)
        })
    
    # Sort by total volume
    sellers.sort(key=lambda x: x["total_volume"], reverse=True)
    
    return {
        "leaderboard": sellers[:limit],
        "total_sellers": len(sellers)
    }
