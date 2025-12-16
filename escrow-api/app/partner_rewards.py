"""
Partner-Funded Rewards System

Implements rewards funded by partner commissions rather than platform margin:
- Telco partners fund airtime/data rewards
- Logistics partners fund delivery discounts
- Banks fund cashback on their rails
- Platform takes a cut of partner commissions

This creates sustainable incentives without burning cash on subsidies.
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

router = APIRouter(prefix="/api/v1/partner-rewards", tags=["Partner Rewards"])


# =============================================================================
# Partner Configuration
# =============================================================================

class PartnerCategory(str, Enum):
    """Categories of partners"""
    TELCO = "telco"
    LOGISTICS = "logistics"
    BANKING = "banking"
    INSURANCE = "insurance"
    RETAIL = "retail"


class RewardFulfillmentStatus(str, Enum):
    """Status of reward fulfillment"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


@dataclass
class Partner:
    """Partner definition"""
    partner_id: str
    name: str
    category: PartnerCategory
    logo_url: str
    commission_rate: float  # Percentage we earn from partner
    is_active: bool = True
    api_endpoint: Optional[str] = None
    api_key_env: Optional[str] = None  # Environment variable name for API key
    supported_rewards: List[str] = field(default_factory=list)


@dataclass
class PartnerReward:
    """Reward offered by a partner"""
    reward_id: str
    partner_id: str
    name: str
    description: str
    category: PartnerCategory
    face_value: float  # Value to user in NGN
    cost_to_platform: float  # What we pay partner
    points_cost: int  # Points required from user
    commission_earned: float  # What we earn
    is_active: bool = True
    min_buyer_status: str = "new"
    min_seller_tier: str = "bronze"
    daily_limit: int = -1  # -1 = unlimited
    total_limit: int = -1  # -1 = unlimited
    valid_until: Optional[str] = None


# =============================================================================
# Partner Definitions
# =============================================================================

PARTNERS: Dict[str, Partner] = {
    "mtn": Partner(
        partner_id="mtn",
        name="MTN Nigeria",
        category=PartnerCategory.TELCO,
        logo_url="/static/partners/mtn.png",
        commission_rate=8.0,  # 8% commission on airtime
        api_endpoint="https://api.mtn.ng/v1/airtime",
        api_key_env="MTN_API_KEY",
        supported_rewards=["airtime", "data"]
    ),
    "airtel": Partner(
        partner_id="airtel",
        name="Airtel Nigeria",
        category=PartnerCategory.TELCO,
        logo_url="/static/partners/airtel.png",
        commission_rate=7.5,
        api_endpoint="https://api.airtel.ng/v1/airtime",
        api_key_env="AIRTEL_API_KEY",
        supported_rewards=["airtime", "data"]
    ),
    "glo": Partner(
        partner_id="glo",
        name="Glo Nigeria",
        category=PartnerCategory.TELCO,
        logo_url="/static/partners/glo.png",
        commission_rate=7.0,
        api_endpoint="https://api.glo.ng/v1/airtime",
        api_key_env="GLO_API_KEY",
        supported_rewards=["airtime", "data"]
    ),
    "9mobile": Partner(
        partner_id="9mobile",
        name="9Mobile",
        category=PartnerCategory.TELCO,
        logo_url="/static/partners/9mobile.png",
        commission_rate=6.5,
        api_endpoint="https://api.9mobile.ng/v1/airtime",
        api_key_env="9MOBILE_API_KEY",
        supported_rewards=["airtime", "data"]
    ),
    "gig_logistics": Partner(
        partner_id="gig_logistics",
        name="GIG Logistics",
        category=PartnerCategory.LOGISTICS,
        logo_url="/static/partners/gig.png",
        commission_rate=5.0,  # 5% commission on delivery bookings
        api_endpoint="https://api.giglogistics.com/v1",
        api_key_env="GIG_API_KEY",
        supported_rewards=["delivery_discount", "free_delivery"]
    ),
    "kwik": Partner(
        partner_id="kwik",
        name="Kwik Delivery",
        category=PartnerCategory.LOGISTICS,
        logo_url="/static/partners/kwik.png",
        commission_rate=4.5,
        api_endpoint="https://api.kwik.delivery/v1",
        api_key_env="KWIK_API_KEY",
        supported_rewards=["delivery_discount", "express_delivery"]
    ),
    "opay": Partner(
        partner_id="opay",
        name="OPay",
        category=PartnerCategory.BANKING,
        logo_url="/static/partners/opay.png",
        commission_rate=0.5,  # 0.5% on transactions through OPay
        api_endpoint="https://api.opayweb.com/v1",
        api_key_env="OPAY_API_KEY",
        supported_rewards=["cashback", "fee_waiver"]
    ),
    "palmpay": Partner(
        partner_id="palmpay",
        name="PalmPay",
        category=PartnerCategory.BANKING,
        logo_url="/static/partners/palmpay.png",
        commission_rate=0.5,
        api_endpoint="https://api.palmpay.com/v1",
        api_key_env="PALMPAY_API_KEY",
        supported_rewards=["cashback", "fee_waiver"]
    ),
    "kuda": Partner(
        partner_id="kuda",
        name="Kuda Bank",
        category=PartnerCategory.BANKING,
        logo_url="/static/partners/kuda.png",
        commission_rate=0.3,
        api_endpoint="https://api.kuda.com/v1",
        api_key_env="KUDA_API_KEY",
        supported_rewards=["cashback", "account_bonus"]
    ),
}


# =============================================================================
# Partner Rewards Catalog
# =============================================================================

PARTNER_REWARDS: List[PartnerReward] = [
    # MTN Rewards
    PartnerReward(
        reward_id="mtn_airtime_100",
        partner_id="mtn",
        name="MTN 100 NGN Airtime",
        description="100 NGN MTN airtime credited instantly",
        category=PartnerCategory.TELCO,
        face_value=100,
        cost_to_platform=92,  # 8% commission
        points_cost=8000,
        commission_earned=8
    ),
    PartnerReward(
        reward_id="mtn_airtime_500",
        partner_id="mtn",
        name="MTN 500 NGN Airtime",
        description="500 NGN MTN airtime credited instantly",
        category=PartnerCategory.TELCO,
        face_value=500,
        cost_to_platform=460,
        points_cost=35000,
        commission_earned=40
    ),
    PartnerReward(
        reward_id="mtn_data_1gb",
        partner_id="mtn",
        name="MTN 1GB Data",
        description="1GB MTN data valid for 30 days",
        category=PartnerCategory.TELCO,
        face_value=350,
        cost_to_platform=322,
        points_cost=25000,
        commission_earned=28
    ),
    
    # Airtel Rewards
    PartnerReward(
        reward_id="airtel_airtime_100",
        partner_id="airtel",
        name="Airtel 100 NGN Airtime",
        description="100 NGN Airtel airtime credited instantly",
        category=PartnerCategory.TELCO,
        face_value=100,
        cost_to_platform=92.5,
        points_cost=8000,
        commission_earned=7.5
    ),
    PartnerReward(
        reward_id="airtel_data_2gb",
        partner_id="airtel",
        name="Airtel 2GB Data",
        description="2GB Airtel data valid for 30 days",
        category=PartnerCategory.TELCO,
        face_value=500,
        cost_to_platform=462.5,
        points_cost=40000,
        commission_earned=37.5
    ),
    
    # GIG Logistics Rewards
    PartnerReward(
        reward_id="gig_delivery_500",
        partner_id="gig_logistics",
        name="GIG 500 NGN Delivery Voucher",
        description="500 NGN off your next GIG Logistics delivery",
        category=PartnerCategory.LOGISTICS,
        face_value=500,
        cost_to_platform=475,
        points_cost=40000,
        commission_earned=25
    ),
    PartnerReward(
        reward_id="gig_free_delivery",
        partner_id="gig_logistics",
        name="GIG Free Delivery (up to 1500 NGN)",
        description="Free delivery on your next order via GIG",
        category=PartnerCategory.LOGISTICS,
        face_value=1500,
        cost_to_platform=1425,
        points_cost=100000,
        commission_earned=75,
        min_buyer_status="trusted"
    ),
    
    # Kwik Delivery Rewards
    PartnerReward(
        reward_id="kwik_express",
        partner_id="kwik",
        name="Kwik Express Upgrade",
        description="Upgrade to express delivery at no extra cost",
        category=PartnerCategory.LOGISTICS,
        face_value=300,
        cost_to_platform=286.5,
        points_cost=25000,
        commission_earned=13.5
    ),
    
    # OPay Rewards
    PartnerReward(
        reward_id="opay_cashback_200",
        partner_id="opay",
        name="OPay 200 NGN Cashback",
        description="200 NGN cashback on your next OPay payment",
        category=PartnerCategory.BANKING,
        face_value=200,
        cost_to_platform=199,
        points_cost=18000,
        commission_earned=1,
        min_buyer_status="regular"
    ),
    PartnerReward(
        reward_id="opay_fee_waiver",
        partner_id="opay",
        name="OPay Fee Waiver",
        description="Zero fees on your next 3 OPay transactions",
        category=PartnerCategory.BANKING,
        face_value=150,
        cost_to_platform=149.25,
        points_cost=12000,
        commission_earned=0.75
    ),
    
    # PalmPay Rewards
    PartnerReward(
        reward_id="palmpay_cashback_500",
        partner_id="palmpay",
        name="PalmPay 500 NGN Cashback",
        description="500 NGN cashback on your next PalmPay payment",
        category=PartnerCategory.BANKING,
        face_value=500,
        cost_to_platform=497.5,
        points_cost=45000,
        commission_earned=2.5,
        min_buyer_status="trusted"
    ),
    
    # Kuda Rewards
    PartnerReward(
        reward_id="kuda_account_bonus",
        partner_id="kuda",
        name="Kuda Account Opening Bonus",
        description="Get 500 NGN when you open a Kuda account",
        category=PartnerCategory.BANKING,
        face_value=500,
        cost_to_platform=498.5,
        points_cost=0,  # Free for new users
        commission_earned=1.5,
        min_buyer_status="new"
    ),
]


# =============================================================================
# In-Memory Storage (Use persistent storage in production)
# =============================================================================

_redemptions: Dict[str, Dict[str, Any]] = {}
_partner_transactions: List[Dict[str, Any]] = []
_daily_redemption_counts: Dict[str, Dict[str, int]] = {}  # {date: {reward_id: count}}


# =============================================================================
# Partner Rewards Engine
# =============================================================================

class PartnerRewardsEngine:
    """Engine for managing partner-funded rewards"""
    
    @staticmethod
    def get_available_rewards(
        user_type: str,  # "buyer" or "seller"
        status_or_tier: str,
        points_balance: int
    ) -> List[Dict[str, Any]]:
        """Get rewards available to a user"""
        
        buyer_status_order = ["new", "regular", "trusted", "vip"]
        seller_tier_order = ["bronze", "silver", "gold", "platinum"]
        
        if user_type == "buyer":
            status_index = buyer_status_order.index(status_or_tier.lower()) if status_or_tier.lower() in buyer_status_order else 0
        else:
            status_index = seller_tier_order.index(status_or_tier.lower()) if status_or_tier.lower() in seller_tier_order else 0
        
        available = []
        for reward in PARTNER_REWARDS:
            if not reward.is_active:
                continue
            
            # Check status/tier requirement
            if user_type == "buyer":
                min_index = buyer_status_order.index(reward.min_buyer_status.lower()) if reward.min_buyer_status.lower() in buyer_status_order else 0
            else:
                min_index = seller_tier_order.index(reward.min_seller_tier.lower()) if reward.min_seller_tier.lower() in seller_tier_order else 0
            
            if status_index < min_index:
                continue
            
            # Check daily limit
            today = datetime.utcnow().date().isoformat()
            daily_count = _daily_redemption_counts.get(today, {}).get(reward.reward_id, 0)
            if reward.daily_limit > 0 and daily_count >= reward.daily_limit:
                continue
            
            # Check validity
            if reward.valid_until:
                if datetime.utcnow() > datetime.fromisoformat(reward.valid_until):
                    continue
            
            partner = PARTNERS.get(reward.partner_id)
            
            available.append({
                **asdict(reward),
                "partner_name": partner.name if partner else "Unknown",
                "partner_logo": partner.logo_url if partner else "",
                "can_afford": points_balance >= reward.points_cost,
                "points_needed": max(0, reward.points_cost - points_balance),
                "savings": reward.face_value - (reward.points_cost / 100)  # Assuming 100 points = 1 NGN
            })
        
        return available
    
    @staticmethod
    def calculate_platform_economics(reward: PartnerReward) -> Dict[str, float]:
        """Calculate platform economics for a reward redemption"""
        
        return {
            "face_value": reward.face_value,
            "cost_to_platform": reward.cost_to_platform,
            "commission_earned": reward.commission_earned,
            "margin_percentage": (reward.commission_earned / reward.face_value) * 100,
            "points_value": reward.points_cost / 100,  # Assuming 100 points = 1 NGN
            "effective_discount": ((reward.face_value - (reward.points_cost / 100)) / reward.face_value) * 100
        }
    
    @staticmethod
    async def fulfill_reward(
        reward: PartnerReward,
        user_id: str,
        phone: Optional[str] = None,
        account_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fulfill a reward (call partner API)"""
        
        partner = PARTNERS.get(reward.partner_id)
        if not partner:
            return {"success": False, "error": "Partner not found"}
        
        # In production, call actual partner API
        # For now, simulate successful fulfillment
        
        fulfillment_id = str(uuid.uuid4())
        
        if reward.category == PartnerCategory.TELCO:
            # Simulate airtime/data fulfillment
            return {
                "success": True,
                "fulfillment_id": fulfillment_id,
                "partner": partner.name,
                "type": "airtime" if "airtime" in reward.reward_id else "data",
                "phone": phone,
                "amount": reward.face_value,
                "reference": f"EP-{fulfillment_id[:8].upper()}",
                "message": f"{reward.face_value} NGN {reward.name} sent to {phone}"
            }
        
        elif reward.category == PartnerCategory.LOGISTICS:
            # Generate voucher code
            voucher_code = f"EP-{partner.partner_id.upper()[:3]}-{uuid.uuid4().hex[:8].upper()}"
            return {
                "success": True,
                "fulfillment_id": fulfillment_id,
                "partner": partner.name,
                "type": "voucher",
                "voucher_code": voucher_code,
                "value": reward.face_value,
                "valid_until": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                "message": f"Use code {voucher_code} at checkout on {partner.name}"
            }
        
        elif reward.category == PartnerCategory.BANKING:
            # Simulate cashback/bonus
            return {
                "success": True,
                "fulfillment_id": fulfillment_id,
                "partner": partner.name,
                "type": "cashback" if "cashback" in reward.reward_id else "bonus",
                "amount": reward.face_value,
                "account": account_number,
                "message": f"{reward.face_value} NGN will be credited to your {partner.name} account"
            }
        
        return {"success": False, "error": "Unknown reward category"}


# =============================================================================
# API Models
# =============================================================================

class RedeemPartnerRewardRequest(BaseModel):
    reward_id: str
    phone: Optional[str] = None
    account_number: Optional[str] = None


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/partners")
async def get_partners():
    """Get all partners"""
    return {
        "partners": [asdict(p) for p in PARTNERS.values() if p.is_active],
        "categories": [c.value for c in PartnerCategory]
    }


@router.get("/partners/{partner_id}")
async def get_partner(partner_id: str):
    """Get partner details"""
    
    if partner_id not in PARTNERS:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner = PARTNERS[partner_id]
    rewards = [r for r in PARTNER_REWARDS if r.partner_id == partner_id and r.is_active]
    
    return {
        "partner": asdict(partner),
        "rewards": [asdict(r) for r in rewards]
    }


@router.get("/rewards")
async def get_all_rewards():
    """Get all partner rewards"""
    
    rewards_with_partners = []
    for reward in PARTNER_REWARDS:
        if not reward.is_active:
            continue
        
        partner = PARTNERS.get(reward.partner_id)
        rewards_with_partners.append({
            **asdict(reward),
            "partner_name": partner.name if partner else "Unknown",
            "partner_logo": partner.logo_url if partner else "",
            "economics": PartnerRewardsEngine.calculate_platform_economics(reward)
        })
    
    return {"rewards": rewards_with_partners}


@router.get("/rewards/category/{category}")
async def get_rewards_by_category(category: str):
    """Get rewards by category"""
    
    try:
        cat = PartnerCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    rewards = [
        {
            **asdict(r),
            "partner_name": PARTNERS.get(r.partner_id, Partner("", "", cat, "", 0)).name
        }
        for r in PARTNER_REWARDS 
        if r.is_active and r.category == cat
    ]
    
    return {"category": category, "rewards": rewards}


@router.get("/available/{user_id}")
async def get_available_rewards(
    user_id: str,
    user_type: str = "buyer",
    status_or_tier: str = "new",
    points_balance: int = 0
):
    """Get rewards available to a specific user"""
    
    rewards = PartnerRewardsEngine.get_available_rewards(
        user_type=user_type,
        status_or_tier=status_or_tier,
        points_balance=points_balance
    )
    
    return {
        "user_id": user_id,
        "user_type": user_type,
        "status_or_tier": status_or_tier,
        "points_balance": points_balance,
        "rewards": rewards,
        "affordable_count": len([r for r in rewards if r["can_afford"]])
    }


@router.post("/redeem/{user_id}")
async def redeem_partner_reward(user_id: str, request: RedeemPartnerRewardRequest):
    """Redeem a partner reward"""
    
    # Find reward
    reward = None
    for r in PARTNER_REWARDS:
        if r.reward_id == request.reward_id:
            reward = r
            break
    
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if not reward.is_active:
        raise HTTPException(status_code=400, detail="Reward is not available")
    
    # Check daily limit
    today = datetime.utcnow().date().isoformat()
    if today not in _daily_redemption_counts:
        _daily_redemption_counts[today] = {}
    
    daily_count = _daily_redemption_counts[today].get(reward.reward_id, 0)
    if reward.daily_limit > 0 and daily_count >= reward.daily_limit:
        raise HTTPException(status_code=400, detail="Daily limit reached for this reward")
    
    # Validate required fields
    if reward.category == PartnerCategory.TELCO and not request.phone:
        raise HTTPException(status_code=400, detail="Phone number required for telco rewards")
    
    # Fulfill reward
    fulfillment = await PartnerRewardsEngine.fulfill_reward(
        reward=reward,
        user_id=user_id,
        phone=request.phone,
        account_number=request.account_number
    )
    
    if not fulfillment["success"]:
        raise HTTPException(status_code=500, detail=fulfillment.get("error", "Fulfillment failed"))
    
    # Record redemption
    redemption_id = str(uuid.uuid4())
    redemption = {
        "redemption_id": redemption_id,
        "user_id": user_id,
        "reward_id": reward.reward_id,
        "reward_name": reward.name,
        "partner_id": reward.partner_id,
        "face_value": reward.face_value,
        "points_spent": reward.points_cost,
        "commission_earned": reward.commission_earned,
        "fulfillment": fulfillment,
        "status": RewardFulfillmentStatus.COMPLETED.value,
        "created_at": datetime.utcnow().isoformat()
    }
    _redemptions[redemption_id] = redemption
    
    # Update daily count
    _daily_redemption_counts[today][reward.reward_id] = daily_count + 1
    
    # Record transaction for analytics
    _partner_transactions.append({
        "transaction_id": str(uuid.uuid4()),
        "redemption_id": redemption_id,
        "partner_id": reward.partner_id,
        "reward_id": reward.reward_id,
        "face_value": reward.face_value,
        "cost_to_platform": reward.cost_to_platform,
        "commission_earned": reward.commission_earned,
        "created_at": datetime.utcnow().isoformat()
    })
    
    return {
        "success": True,
        "redemption_id": redemption_id,
        "reward": asdict(reward),
        "fulfillment": fulfillment,
        "economics": PartnerRewardsEngine.calculate_platform_economics(reward)
    }


@router.get("/redemptions/{user_id}")
async def get_user_redemptions(user_id: str):
    """Get user's redemption history"""
    
    user_redemptions = [
        r for r in _redemptions.values()
        if r["user_id"] == user_id
    ]
    user_redemptions.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "user_id": user_id,
        "redemptions": user_redemptions,
        "total_face_value": sum(r["face_value"] for r in user_redemptions),
        "total_points_spent": sum(r["points_spent"] for r in user_redemptions)
    }


@router.get("/analytics/summary")
async def get_partner_analytics_summary():
    """Get partner rewards analytics summary"""
    
    total_redemptions = len(_redemptions)
    total_face_value = sum(r["face_value"] for r in _redemptions.values())
    total_cost = sum(r.get("cost_to_platform", 0) for r in _partner_transactions)
    total_commission = sum(r.get("commission_earned", 0) for r in _partner_transactions)
    
    # Group by partner
    by_partner = {}
    for txn in _partner_transactions:
        partner_id = txn["partner_id"]
        if partner_id not in by_partner:
            by_partner[partner_id] = {
                "partner_name": PARTNERS.get(partner_id, Partner("", "Unknown", PartnerCategory.TELCO, "", 0)).name,
                "redemptions": 0,
                "face_value": 0,
                "commission_earned": 0
            }
        by_partner[partner_id]["redemptions"] += 1
        by_partner[partner_id]["face_value"] += txn["face_value"]
        by_partner[partner_id]["commission_earned"] += txn["commission_earned"]
    
    # Group by category
    by_category = {}
    for txn in _partner_transactions:
        reward = next((r for r in PARTNER_REWARDS if r.reward_id == txn["reward_id"]), None)
        if reward:
            cat = reward.category.value
            if cat not in by_category:
                by_category[cat] = {"redemptions": 0, "face_value": 0}
            by_category[cat]["redemptions"] += 1
            by_category[cat]["face_value"] += txn["face_value"]
    
    return {
        "summary": {
            "total_redemptions": total_redemptions,
            "total_face_value": total_face_value,
            "total_cost_to_platform": total_cost,
            "total_commission_earned": total_commission,
            "net_margin": total_commission,
            "margin_percentage": (total_commission / total_face_value * 100) if total_face_value > 0 else 0
        },
        "by_partner": by_partner,
        "by_category": by_category
    }


@router.get("/analytics/partner/{partner_id}")
async def get_partner_analytics(partner_id: str):
    """Get analytics for a specific partner"""
    
    if partner_id not in PARTNERS:
        raise HTTPException(status_code=404, detail="Partner not found")
    
    partner = PARTNERS[partner_id]
    partner_txns = [t for t in _partner_transactions if t["partner_id"] == partner_id]
    
    total_redemptions = len(partner_txns)
    total_face_value = sum(t["face_value"] for t in partner_txns)
    total_commission = sum(t["commission_earned"] for t in partner_txns)
    
    # Group by reward
    by_reward = {}
    for txn in partner_txns:
        reward_id = txn["reward_id"]
        if reward_id not in by_reward:
            reward = next((r for r in PARTNER_REWARDS if r.reward_id == reward_id), None)
            by_reward[reward_id] = {
                "reward_name": reward.name if reward else "Unknown",
                "redemptions": 0,
                "face_value": 0
            }
        by_reward[reward_id]["redemptions"] += 1
        by_reward[reward_id]["face_value"] += txn["face_value"]
    
    return {
        "partner": asdict(partner),
        "analytics": {
            "total_redemptions": total_redemptions,
            "total_face_value": total_face_value,
            "total_commission_earned": total_commission,
            "average_redemption_value": total_face_value / total_redemptions if total_redemptions > 0 else 0
        },
        "by_reward": by_reward
    }


@router.get("/economics/simulation")
async def simulate_economics(
    monthly_transactions: int = 10000,
    average_transaction_value: float = 50000,
    reward_redemption_rate: float = 10.0  # Percentage of users who redeem
):
    """Simulate partner rewards economics"""
    
    # Calculate expected redemptions
    expected_redemptions = int(monthly_transactions * (reward_redemption_rate / 100))
    
    # Assume average reward face value of 300 NGN
    avg_face_value = 300
    avg_commission_rate = 5.0  # Average across all partners
    
    total_face_value = expected_redemptions * avg_face_value
    total_commission = total_face_value * (avg_commission_rate / 100)
    
    # Platform economics
    platform_fee_rate = 2.0  # 2% platform fee
    total_platform_fees = monthly_transactions * average_transaction_value * (platform_fee_rate / 100)
    
    return {
        "inputs": {
            "monthly_transactions": monthly_transactions,
            "average_transaction_value": average_transaction_value,
            "reward_redemption_rate": f"{reward_redemption_rate}%"
        },
        "projections": {
            "expected_redemptions": expected_redemptions,
            "total_reward_face_value": total_face_value,
            "partner_commission_earned": total_commission,
            "platform_transaction_fees": total_platform_fees,
            "total_revenue": total_platform_fees + total_commission,
            "partner_rewards_contribution": f"{(total_commission / (total_platform_fees + total_commission) * 100):.1f}%"
        },
        "insights": [
            f"Partner rewards add {total_commission:,.0f} NGN to monthly revenue",
            f"This represents {(total_commission / total_platform_fees * 100):.1f}% additional revenue on top of platform fees",
            "Rewards drive user engagement without burning platform margin"
        ]
    }
