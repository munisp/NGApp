"""
Loyalty Points Engine

Implements a comprehensive loyalty program for buyers:
- Earn points on completed transactions
- Redeem for airtime, data, delivery vouchers, fee waivers
- Partner-funded rewards (telcos, logistics)
- Trusted buyer status with benefits

Point Economics:
- 1 NGN spent = 1 point earned
- 100 points = 1 NGN redemption value
- Points expire after 12 months of inactivity
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, field, asdict
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/loyalty", tags=["Loyalty Points"])


# =============================================================================
# Configuration
# =============================================================================

POINTS_PER_NGN = 1  # 1 point per 1 NGN spent
POINTS_TO_NGN_RATIO = 100  # 100 points = 1 NGN
POINTS_EXPIRY_MONTHS = 12
FIRST_PURCHASE_BONUS = 500  # 500 bonus points on first purchase
REFERRAL_BONUS = 1000  # 1000 points for referrer and referee


# =============================================================================
# Buyer Status Levels
# =============================================================================

class BuyerStatus(str, Enum):
    """Buyer trust status levels"""
    NEW = "new"
    REGULAR = "regular"
    TRUSTED = "trusted"
    VIP = "vip"


@dataclass
class StatusRequirements:
    """Requirements to achieve a status level"""
    min_completed_purchases: int
    min_total_spent: float  # In NGN
    max_dispute_rate: float  # As percentage
    min_account_age_days: int = 0


@dataclass
class StatusBenefits:
    """Benefits for a status level"""
    points_multiplier: float  # 1.0 = normal, 1.5 = 50% bonus
    dispute_resolution_priority: int  # 1 = highest priority
    max_transaction_limit: float  # In NGN
    fee_discount_pct: float  # Buyer fee discount
    exclusive_offers: bool
    early_access: bool


STATUS_CONFIG: Dict[BuyerStatus, Dict[str, Any]] = {
    BuyerStatus.NEW: {
        "requirements": StatusRequirements(
            min_completed_purchases=0,
            min_total_spent=0,
            max_dispute_rate=100.0
        ),
        "benefits": StatusBenefits(
            points_multiplier=1.0,
            dispute_resolution_priority=4,
            max_transaction_limit=100000,  # 100k NGN
            fee_discount_pct=0,
            exclusive_offers=False,
            early_access=False
        )
    },
    BuyerStatus.REGULAR: {
        "requirements": StatusRequirements(
            min_completed_purchases=3,
            min_total_spent=50000,
            max_dispute_rate=20.0,
            min_account_age_days=7
        ),
        "benefits": StatusBenefits(
            points_multiplier=1.2,
            dispute_resolution_priority=3,
            max_transaction_limit=500000,  # 500k NGN
            fee_discount_pct=10,
            exclusive_offers=False,
            early_access=False
        )
    },
    BuyerStatus.TRUSTED: {
        "requirements": StatusRequirements(
            min_completed_purchases=10,
            min_total_spent=200000,
            max_dispute_rate=10.0,
            min_account_age_days=30
        ),
        "benefits": StatusBenefits(
            points_multiplier=1.5,
            dispute_resolution_priority=2,
            max_transaction_limit=2000000,  # 2M NGN
            fee_discount_pct=25,
            exclusive_offers=True,
            early_access=True
        )
    },
    BuyerStatus.VIP: {
        "requirements": StatusRequirements(
            min_completed_purchases=25,
            min_total_spent=1000000,
            max_dispute_rate=5.0,
            min_account_age_days=90
        ),
        "benefits": StatusBenefits(
            points_multiplier=2.0,
            dispute_resolution_priority=1,
            max_transaction_limit=10000000,  # 10M NGN
            fee_discount_pct=50,
            exclusive_offers=True,
            early_access=True
        )
    }
}


# =============================================================================
# Reward Catalog
# =============================================================================

class RewardCategory(str, Enum):
    """Reward categories"""
    AIRTIME = "airtime"
    DATA = "data"
    DELIVERY = "delivery"
    FEE_WAIVER = "fee_waiver"
    CASHBACK = "cashback"
    PARTNER = "partner"


@dataclass
class Reward:
    """Reward definition"""
    reward_id: str
    name: str
    description: str
    category: RewardCategory
    points_cost: int
    ngn_value: float
    partner: Optional[str] = None
    is_active: bool = True
    min_status: BuyerStatus = BuyerStatus.NEW
    stock: int = -1  # -1 = unlimited


# Reward catalog
REWARD_CATALOG: List[Reward] = [
    # Airtime rewards (partner-funded by telcos)
    Reward(
        reward_id="airtime_100",
        name="100 NGN Airtime",
        description="100 NGN airtime for any network",
        category=RewardCategory.AIRTIME,
        points_cost=8000,  # 80 NGN worth of points (20% discount)
        ngn_value=100,
        partner="MTN/Airtel/Glo/9Mobile"
    ),
    Reward(
        reward_id="airtime_500",
        name="500 NGN Airtime",
        description="500 NGN airtime for any network",
        category=RewardCategory.AIRTIME,
        points_cost=35000,  # 350 NGN worth (30% discount for larger amount)
        ngn_value=500,
        partner="MTN/Airtel/Glo/9Mobile"
    ),
    Reward(
        reward_id="airtime_1000",
        name="1000 NGN Airtime",
        description="1000 NGN airtime for any network",
        category=RewardCategory.AIRTIME,
        points_cost=60000,  # 600 NGN worth (40% discount)
        ngn_value=1000,
        partner="MTN/Airtel/Glo/9Mobile",
        min_status=BuyerStatus.REGULAR
    ),
    
    # Data rewards
    Reward(
        reward_id="data_1gb",
        name="1GB Data Bundle",
        description="1GB data valid for 30 days",
        category=RewardCategory.DATA,
        points_cost=25000,
        ngn_value=350,
        partner="MTN/Airtel"
    ),
    Reward(
        reward_id="data_3gb",
        name="3GB Data Bundle",
        description="3GB data valid for 30 days",
        category=RewardCategory.DATA,
        points_cost=60000,
        ngn_value=1000,
        partner="MTN/Airtel",
        min_status=BuyerStatus.REGULAR
    ),
    
    # Delivery vouchers (partner-funded by logistics)
    Reward(
        reward_id="delivery_500",
        name="500 NGN Delivery Voucher",
        description="500 NGN off your next delivery",
        category=RewardCategory.DELIVERY,
        points_cost=40000,
        ngn_value=500,
        partner="GIG Logistics/Kwik"
    ),
    Reward(
        reward_id="delivery_free",
        name="Free Delivery (up to 1500 NGN)",
        description="Free delivery on your next order",
        category=RewardCategory.DELIVERY,
        points_cost=100000,
        ngn_value=1500,
        partner="GIG Logistics/Kwik",
        min_status=BuyerStatus.TRUSTED
    ),
    
    # Fee waivers
    Reward(
        reward_id="fee_waiver_1",
        name="1 Free Transaction",
        description="Zero buyer fee on your next transaction",
        category=RewardCategory.FEE_WAIVER,
        points_cost=20000,
        ngn_value=200,  # Estimated average fee
    ),
    Reward(
        reward_id="fee_waiver_3",
        name="3 Free Transactions",
        description="Zero buyer fee on your next 3 transactions",
        category=RewardCategory.FEE_WAIVER,
        points_cost=50000,
        ngn_value=600,
        min_status=BuyerStatus.REGULAR
    ),
    
    # Cashback (direct NGN credit)
    Reward(
        reward_id="cashback_500",
        name="500 NGN Cashback",
        description="500 NGN credit to your wallet",
        category=RewardCategory.CASHBACK,
        points_cost=50000,
        ngn_value=500,
        min_status=BuyerStatus.TRUSTED
    ),
    Reward(
        reward_id="cashback_2000",
        name="2000 NGN Cashback",
        description="2000 NGN credit to your wallet",
        category=RewardCategory.CASHBACK,
        points_cost=180000,
        ngn_value=2000,
        min_status=BuyerStatus.VIP
    ),
]


# =============================================================================
# Buyer Profile
# =============================================================================

@dataclass
class BuyerStats:
    """Buyer activity statistics"""
    total_purchases: int = 0
    completed_purchases: int = 0
    disputed_purchases: int = 0
    total_spent: float = 0.0
    
    @property
    def dispute_rate(self) -> float:
        if self.completed_purchases == 0:
            return 0.0
        return (self.disputed_purchases / self.completed_purchases) * 100


@dataclass
class PointsTransaction:
    """Record of points earned or spent"""
    transaction_id: str
    buyer_id: str
    points: int  # Positive = earned, negative = spent
    transaction_type: str  # "earn", "redeem", "bonus", "expire"
    description: str
    reference_id: Optional[str] = None  # Escrow ID or reward ID
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class BuyerProfile:
    """Complete buyer profile with loyalty information"""
    buyer_id: str
    phone: str
    name: str
    current_status: BuyerStatus = BuyerStatus.NEW
    stats: BuyerStats = field(default_factory=BuyerStats)
    points_balance: int = 0
    lifetime_points_earned: int = 0
    lifetime_points_redeemed: int = 0
    referral_code: str = ""
    referred_by: Optional[str] = None
    created_at: str = ""
    last_activity_at: str = ""
    fee_waivers_remaining: int = 0
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()
        if not self.last_activity_at:
            self.last_activity_at = datetime.utcnow().isoformat()
        if not self.referral_code:
            self.referral_code = f"EP{self.buyer_id[:6].upper()}"


# =============================================================================
# In-Memory Storage (Use persistent storage in production)
# =============================================================================

_buyer_profiles: Dict[str, Dict[str, Any]] = {}
_points_transactions: List[Dict[str, Any]] = []
_redemptions: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Loyalty Engine
# =============================================================================

class LoyaltyEngine:
    """Engine for managing loyalty points and rewards"""
    
    @staticmethod
    def calculate_eligible_status(profile: BuyerProfile) -> BuyerStatus:
        """Calculate the highest status a buyer is eligible for"""
        
        account_age_days = (datetime.utcnow() - datetime.fromisoformat(profile.created_at)).days
        
        eligible_status = BuyerStatus.NEW
        
        for status in [BuyerStatus.VIP, BuyerStatus.TRUSTED, BuyerStatus.REGULAR, BuyerStatus.NEW]:
            config = STATUS_CONFIG[status]
            reqs = config["requirements"]
            
            meets_purchases = profile.stats.completed_purchases >= reqs.min_completed_purchases
            meets_spent = profile.stats.total_spent >= reqs.min_total_spent
            meets_dispute = profile.stats.dispute_rate <= reqs.max_dispute_rate
            meets_age = account_age_days >= reqs.min_account_age_days
            
            if all([meets_purchases, meets_spent, meets_dispute, meets_age]):
                eligible_status = status
                break
        
        return eligible_status
    
    @staticmethod
    def calculate_points_earned(amount: float, status: BuyerStatus, is_first_purchase: bool = False) -> Dict[str, int]:
        """Calculate points earned for a transaction"""
        
        benefits = STATUS_CONFIG[status]["benefits"]
        
        base_points = int(amount * POINTS_PER_NGN)
        multiplier_bonus = int(base_points * (benefits.points_multiplier - 1))
        first_purchase_bonus = FIRST_PURCHASE_BONUS if is_first_purchase else 0
        
        total_points = base_points + multiplier_bonus + first_purchase_bonus
        
        return {
            "base_points": base_points,
            "multiplier_bonus": multiplier_bonus,
            "first_purchase_bonus": first_purchase_bonus,
            "total_points": total_points,
            "multiplier": benefits.points_multiplier
        }
    
    @staticmethod
    def get_available_rewards(status: BuyerStatus, points_balance: int) -> List[Dict[str, Any]]:
        """Get rewards available to a buyer based on status and points"""
        
        status_order = [BuyerStatus.NEW, BuyerStatus.REGULAR, BuyerStatus.TRUSTED, BuyerStatus.VIP]
        status_index = status_order.index(status)
        
        available = []
        for reward in REWARD_CATALOG:
            if not reward.is_active:
                continue
            
            min_status_index = status_order.index(reward.min_status)
            if status_index < min_status_index:
                continue
            
            if reward.stock == 0:
                continue
            
            available.append({
                **asdict(reward),
                "can_afford": points_balance >= reward.points_cost,
                "points_needed": max(0, reward.points_cost - points_balance)
            })
        
        return available
    
    @staticmethod
    def calculate_next_status_progress(profile: BuyerProfile) -> Dict[str, Any]:
        """Calculate progress toward next status level"""
        
        status_order = [BuyerStatus.NEW, BuyerStatus.REGULAR, BuyerStatus.TRUSTED, BuyerStatus.VIP]
        current_index = status_order.index(profile.current_status)
        
        if current_index >= len(status_order) - 1:
            return {"at_max_status": True, "current_status": profile.current_status.value}
        
        next_status = status_order[current_index + 1]
        next_reqs = STATUS_CONFIG[next_status]["requirements"]
        
        account_age_days = (datetime.utcnow() - datetime.fromisoformat(profile.created_at)).days
        
        progress = {
            "next_status": next_status.value,
            "requirements": {
                "completed_purchases": {
                    "current": profile.stats.completed_purchases,
                    "required": next_reqs.min_completed_purchases,
                    "progress_pct": min(100, (profile.stats.completed_purchases / max(1, next_reqs.min_completed_purchases)) * 100)
                },
                "total_spent": {
                    "current": profile.stats.total_spent,
                    "required": next_reqs.min_total_spent,
                    "progress_pct": min(100, (profile.stats.total_spent / max(1, next_reqs.min_total_spent)) * 100)
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
                }
            }
        }
        
        progress_values = [
            progress["requirements"]["completed_purchases"]["progress_pct"],
            progress["requirements"]["total_spent"]["progress_pct"],
            progress["requirements"]["account_age_days"]["progress_pct"]
        ]
        progress["overall_progress_pct"] = sum(progress_values) / len(progress_values)
        
        return progress


# =============================================================================
# API Models
# =============================================================================

class EarnPointsRequest(BaseModel):
    escrow_id: str
    amount: float
    completed: bool = True
    disputed: bool = False


class RedeemRewardRequest(BaseModel):
    reward_id: str
    phone: Optional[str] = None  # For airtime/data


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/status-levels")
async def get_status_levels():
    """Get all buyer status levels and benefits"""
    levels = []
    for status in BuyerStatus:
        config = STATUS_CONFIG[status]
        levels.append({
            "status": status.value,
            "requirements": asdict(config["requirements"]),
            "benefits": asdict(config["benefits"])
        })
    return {"status_levels": levels}


@router.get("/rewards")
async def get_reward_catalog():
    """Get all available rewards"""
    return {
        "rewards": [asdict(r) for r in REWARD_CATALOG if r.is_active]
    }


@router.get("/profile/{buyer_id}")
async def get_buyer_profile(buyer_id: str):
    """Get buyer loyalty profile"""
    
    if buyer_id not in _buyer_profiles:
        # Create default profile
        profile = BuyerProfile(
            buyer_id=buyer_id,
            phone="",
            name=f"buyer_{buyer_id[:8]}"
        )
        _buyer_profiles[buyer_id] = asdict(profile)
    
    profile_data = _buyer_profiles[buyer_id]
    profile = BuyerProfile(**{
        **profile_data,
        "stats": BuyerStats(**profile_data.get("stats", {})),
        "current_status": BuyerStatus(profile_data.get("current_status", "new"))
    })
    
    # Calculate eligible status and progress
    eligible_status = LoyaltyEngine.calculate_eligible_status(profile)
    next_status_progress = LoyaltyEngine.calculate_next_status_progress(profile)
    benefits = STATUS_CONFIG[profile.current_status]["benefits"]
    
    # Get available rewards
    available_rewards = LoyaltyEngine.get_available_rewards(
        profile.current_status, 
        profile.points_balance
    )
    
    return {
        "buyer_id": profile.buyer_id,
        "name": profile.name,
        "current_status": profile.current_status.value,
        "eligible_status": eligible_status.value,
        "status_benefits": asdict(benefits),
        "points_balance": profile.points_balance,
        "lifetime_points_earned": profile.lifetime_points_earned,
        "lifetime_points_redeemed": profile.lifetime_points_redeemed,
        "points_value_ngn": profile.points_balance / POINTS_TO_NGN_RATIO,
        "stats": asdict(profile.stats),
        "next_status_progress": next_status_progress,
        "referral_code": profile.referral_code,
        "fee_waivers_remaining": profile.fee_waivers_remaining,
        "available_rewards_count": len([r for r in available_rewards if r["can_afford"]])
    }


@router.post("/profile/{buyer_id}/create")
async def create_buyer_profile(
    buyer_id: str,
    name: str,
    phone: str,
    referral_code: Optional[str] = None
):
    """Create a new buyer profile"""
    
    if buyer_id in _buyer_profiles:
        raise HTTPException(status_code=400, detail="Buyer profile already exists")
    
    profile = BuyerProfile(
        buyer_id=buyer_id,
        phone=phone,
        name=name
    )
    
    # Handle referral
    referrer_bonus_applied = False
    if referral_code:
        # Find referrer
        for ref_id, ref_data in _buyer_profiles.items():
            if ref_data.get("referral_code") == referral_code:
                profile.referred_by = ref_id
                
                # Give bonus to both
                profile.points_balance += REFERRAL_BONUS
                profile.lifetime_points_earned += REFERRAL_BONUS
                
                ref_data["points_balance"] = ref_data.get("points_balance", 0) + REFERRAL_BONUS
                ref_data["lifetime_points_earned"] = ref_data.get("lifetime_points_earned", 0) + REFERRAL_BONUS
                _buyer_profiles[ref_id] = ref_data
                
                # Record transactions
                _points_transactions.append(asdict(PointsTransaction(
                    transaction_id=str(uuid.uuid4()),
                    buyer_id=buyer_id,
                    points=REFERRAL_BONUS,
                    transaction_type="bonus",
                    description=f"Referral bonus - referred by {referral_code}"
                )))
                _points_transactions.append(asdict(PointsTransaction(
                    transaction_id=str(uuid.uuid4()),
                    buyer_id=ref_id,
                    points=REFERRAL_BONUS,
                    transaction_type="bonus",
                    description=f"Referral bonus - referred {buyer_id[:8]}"
                )))
                
                referrer_bonus_applied = True
                break
    
    _buyer_profiles[buyer_id] = asdict(profile)
    
    return {
        "success": True,
        "buyer_id": buyer_id,
        "referral_code": profile.referral_code,
        "points_balance": profile.points_balance,
        "referral_bonus_applied": referrer_bonus_applied,
        "message": "Welcome! Complete your first purchase to earn bonus points."
    }


@router.post("/profile/{buyer_id}/earn")
async def earn_points(buyer_id: str, request: EarnPointsRequest):
    """Earn points from a completed transaction"""
    
    if buyer_id not in _buyer_profiles:
        # Auto-create profile
        profile = BuyerProfile(
            buyer_id=buyer_id,
            phone="",
            name=f"buyer_{buyer_id[:8]}"
        )
        _buyer_profiles[buyer_id] = asdict(profile)
    
    profile_data = _buyer_profiles[buyer_id]
    stats = profile_data.get("stats", {})
    
    # Update stats
    stats["total_purchases"] = stats.get("total_purchases", 0) + 1
    if request.completed:
        stats["completed_purchases"] = stats.get("completed_purchases", 0) + 1
        stats["total_spent"] = stats.get("total_spent", 0) + request.amount
    if request.disputed:
        stats["disputed_purchases"] = stats.get("disputed_purchases", 0) + 1
    
    profile_data["stats"] = stats
    profile_data["last_activity_at"] = datetime.utcnow().isoformat()
    
    # Calculate points earned
    is_first_purchase = stats.get("completed_purchases", 0) == 1
    current_status = BuyerStatus(profile_data.get("current_status", "new"))
    
    points_info = {"total_points": 0}
    if request.completed and not request.disputed:
        points_info = LoyaltyEngine.calculate_points_earned(
            request.amount, 
            current_status,
            is_first_purchase
        )
        
        profile_data["points_balance"] = profile_data.get("points_balance", 0) + points_info["total_points"]
        profile_data["lifetime_points_earned"] = profile_data.get("lifetime_points_earned", 0) + points_info["total_points"]
        
        # Record transaction
        _points_transactions.append(asdict(PointsTransaction(
            transaction_id=str(uuid.uuid4()),
            buyer_id=buyer_id,
            points=points_info["total_points"],
            transaction_type="earn",
            description=f"Earned from purchase of {request.amount} NGN",
            reference_id=request.escrow_id
        )))
    
    # Check for status upgrade
    profile = BuyerProfile(**{
        **profile_data,
        "stats": BuyerStats(**stats),
        "current_status": current_status
    })
    
    eligible_status = LoyaltyEngine.calculate_eligible_status(profile)
    status_upgraded = False
    old_status = current_status
    
    status_order = [BuyerStatus.NEW, BuyerStatus.REGULAR, BuyerStatus.TRUSTED, BuyerStatus.VIP]
    if status_order.index(eligible_status) > status_order.index(current_status):
        profile_data["current_status"] = eligible_status.value
        status_upgraded = True
        
        # Bonus points for status upgrade
        status_bonuses = {
            BuyerStatus.REGULAR: 500,
            BuyerStatus.TRUSTED: 2000,
            BuyerStatus.VIP: 10000
        }
        if eligible_status in status_bonuses:
            bonus = status_bonuses[eligible_status]
            profile_data["points_balance"] = profile_data.get("points_balance", 0) + bonus
            profile_data["lifetime_points_earned"] = profile_data.get("lifetime_points_earned", 0) + bonus
            
            _points_transactions.append(asdict(PointsTransaction(
                transaction_id=str(uuid.uuid4()),
                buyer_id=buyer_id,
                points=bonus,
                transaction_type="bonus",
                description=f"Status upgrade bonus - reached {eligible_status.value}"
            )))
    
    _buyer_profiles[buyer_id] = profile_data
    
    response = {
        "success": True,
        "buyer_id": buyer_id,
        "points_earned": points_info,
        "points_balance": profile_data["points_balance"],
        "current_status": profile_data["current_status"],
        "stats": stats
    }
    
    if status_upgraded:
        new_benefits = STATUS_CONFIG[eligible_status]["benefits"]
        response["status_upgraded"] = True
        response["old_status"] = old_status.value
        response["new_status"] = eligible_status.value
        response["new_benefits"] = asdict(new_benefits)
        response["upgrade_message"] = f"Congratulations! You've reached {eligible_status.value} status! Enjoy {new_benefits.points_multiplier}x points and {new_benefits.fee_discount_pct}% fee discount."
    
    return response


@router.post("/profile/{buyer_id}/redeem")
async def redeem_reward(buyer_id: str, request: RedeemRewardRequest):
    """Redeem points for a reward"""
    
    if buyer_id not in _buyer_profiles:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    profile_data = _buyer_profiles[buyer_id]
    current_status = BuyerStatus(profile_data.get("current_status", "new"))
    points_balance = profile_data.get("points_balance", 0)
    
    # Find reward
    reward = None
    for r in REWARD_CATALOG:
        if r.reward_id == request.reward_id:
            reward = r
            break
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if not reward.is_active:
        raise HTTPException(status_code=400, detail="Reward is not available")
    
    # Check status requirement
    status_order = [BuyerStatus.NEW, BuyerStatus.REGULAR, BuyerStatus.TRUSTED, BuyerStatus.VIP]
    if status_order.index(current_status) < status_order.index(reward.min_status):
        raise HTTPException(
            status_code=400, 
            detail=f"This reward requires {reward.min_status.value} status or higher"
        )
    
    # Check points
    if points_balance < reward.points_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient points. Need {reward.points_cost}, have {points_balance}"
        )
    
    # Check stock
    if reward.stock == 0:
        raise HTTPException(status_code=400, detail="Reward out of stock")
    
    # Process redemption
    redemption_id = str(uuid.uuid4())
    
    profile_data["points_balance"] = points_balance - reward.points_cost
    profile_data["lifetime_points_redeemed"] = profile_data.get("lifetime_points_redeemed", 0) + reward.points_cost
    profile_data["last_activity_at"] = datetime.utcnow().isoformat()
    
    # Handle fee waiver rewards
    if reward.category == RewardCategory.FEE_WAIVER:
        waivers = 1 if "1" in reward.reward_id else 3
        profile_data["fee_waivers_remaining"] = profile_data.get("fee_waivers_remaining", 0) + waivers
    
    _buyer_profiles[buyer_id] = profile_data
    
    # Record transaction
    _points_transactions.append(asdict(PointsTransaction(
        transaction_id=str(uuid.uuid4()),
        buyer_id=buyer_id,
        points=-reward.points_cost,
        transaction_type="redeem",
        description=f"Redeemed: {reward.name}",
        reference_id=redemption_id
    )))
    
    # Record redemption
    redemption = {
        "redemption_id": redemption_id,
        "buyer_id": buyer_id,
        "reward_id": reward.reward_id,
        "reward_name": reward.name,
        "points_spent": reward.points_cost,
        "ngn_value": reward.ngn_value,
        "category": reward.category.value,
        "status": "pending",  # pending, processing, completed, failed
        "phone": request.phone,
        "created_at": datetime.utcnow().isoformat()
    }
    _redemptions[redemption_id] = redemption
    
    # In production, trigger fulfillment (airtime API, delivery voucher, etc.)
    # For now, mark as completed
    redemption["status"] = "completed"
    redemption["completed_at"] = datetime.utcnow().isoformat()
    _redemptions[redemption_id] = redemption
    
    return {
        "success": True,
        "redemption_id": redemption_id,
        "reward": asdict(reward),
        "points_spent": reward.points_cost,
        "points_balance": profile_data["points_balance"],
        "status": "completed",
        "message": f"Successfully redeemed {reward.name}!"
    }


@router.get("/profile/{buyer_id}/rewards")
async def get_available_rewards(buyer_id: str):
    """Get rewards available to a specific buyer"""
    
    if buyer_id not in _buyer_profiles:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    profile_data = _buyer_profiles[buyer_id]
    current_status = BuyerStatus(profile_data.get("current_status", "new"))
    points_balance = profile_data.get("points_balance", 0)
    
    rewards = LoyaltyEngine.get_available_rewards(current_status, points_balance)
    
    return {
        "buyer_id": buyer_id,
        "points_balance": points_balance,
        "current_status": current_status.value,
        "rewards": rewards,
        "affordable_count": len([r for r in rewards if r["can_afford"]])
    }


@router.get("/profile/{buyer_id}/history")
async def get_points_history(buyer_id: str, limit: int = 20):
    """Get points transaction history"""
    
    if buyer_id not in _buyer_profiles:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    # Filter transactions for this buyer
    history = [t for t in _points_transactions if t["buyer_id"] == buyer_id]
    history.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "buyer_id": buyer_id,
        "transactions": history[:limit],
        "total_transactions": len(history)
    }


@router.get("/profile/{buyer_id}/redemptions")
async def get_redemption_history(buyer_id: str):
    """Get redemption history"""
    
    if buyer_id not in _buyer_profiles:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    # Filter redemptions for this buyer
    history = [r for r in _redemptions.values() if r["buyer_id"] == buyer_id]
    history.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "buyer_id": buyer_id,
        "redemptions": history
    }


@router.post("/profile/{buyer_id}/use-fee-waiver")
async def use_fee_waiver(buyer_id: str):
    """Use a fee waiver for the next transaction"""
    
    if buyer_id not in _buyer_profiles:
        raise HTTPException(status_code=404, detail="Buyer not found")
    
    profile_data = _buyer_profiles[buyer_id]
    waivers = profile_data.get("fee_waivers_remaining", 0)
    
    if waivers <= 0:
        raise HTTPException(status_code=400, detail="No fee waivers available")
    
    profile_data["fee_waivers_remaining"] = waivers - 1
    _buyer_profiles[buyer_id] = profile_data
    
    return {
        "success": True,
        "fee_waiver_applied": True,
        "fee_waivers_remaining": profile_data["fee_waivers_remaining"]
    }


@router.get("/referral/{referral_code}")
async def validate_referral_code(referral_code: str):
    """Validate a referral code"""
    
    for buyer_id, profile_data in _buyer_profiles.items():
        if profile_data.get("referral_code") == referral_code:
            return {
                "valid": True,
                "referral_code": referral_code,
                "referrer_name": profile_data.get("name", "")[:3] + "***",
                "bonus_points": REFERRAL_BONUS
            }
    
    return {
        "valid": False,
        "referral_code": referral_code
    }
