"""
Seller Growth Wallet

Instead of flat discounts, sellers earn rebates into a growth wallet:
- 0.4% of each completed transaction goes to growth wallet
- Tier upgrade bonuses added to wallet
- Wallet balance can be spent on:
  - Boosted trust badge placement
  - SMS/WhatsApp notifications to buyers
  - Delivery discounts via logistics partners
  - Insurance top-ups
  - Featured listing placement

This converts platform take rate into growth spend that routes through monetizable services.
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

router = APIRouter(prefix="/api/v1/growth-wallet", tags=["Growth Wallet"])


# =============================================================================
# Configuration
# =============================================================================

REBATE_PERCENTAGE = 0.4  # 0.4% rebate on completed transactions
MIN_WITHDRAWAL_AMOUNT = 1000  # Minimum 1000 NGN to withdraw
WALLET_EXPIRY_MONTHS = 24  # Wallet credits expire after 24 months


# =============================================================================
# Wallet Services (Things sellers can spend wallet on)
# =============================================================================

class WalletServiceCategory(str, Enum):
    """Categories of services available for wallet spend"""
    VISIBILITY = "visibility"
    COMMUNICATION = "communication"
    LOGISTICS = "logistics"
    PROTECTION = "protection"
    MARKETING = "marketing"


@dataclass
class WalletService:
    """Service that can be purchased with wallet balance"""
    service_id: str
    name: str
    description: str
    category: WalletServiceCategory
    cost_ngn: float
    duration_days: int = 0  # 0 = one-time, >0 = subscription
    partner: Optional[str] = None
    is_active: bool = True
    min_tier: str = "bronze"  # Minimum seller tier required


# Service catalog
WALLET_SERVICES: List[WalletService] = [
    # Visibility services
    WalletService(
        service_id="badge_boost_7d",
        name="Trust Badge Boost (7 days)",
        description="Your trust badge appears larger and more prominent on checkout pages",
        category=WalletServiceCategory.VISIBILITY,
        cost_ngn=500,
        duration_days=7
    ),
    WalletService(
        service_id="badge_boost_30d",
        name="Trust Badge Boost (30 days)",
        description="Your trust badge appears larger and more prominent on checkout pages",
        category=WalletServiceCategory.VISIBILITY,
        cost_ngn=1500,
        duration_days=30
    ),
    WalletService(
        service_id="featured_seller_7d",
        name="Featured Seller (7 days)",
        description="Appear in 'Featured Sellers' section on buyer app",
        category=WalletServiceCategory.VISIBILITY,
        cost_ngn=2000,
        duration_days=7,
        min_tier="silver"
    ),
    WalletService(
        service_id="featured_seller_30d",
        name="Featured Seller (30 days)",
        description="Appear in 'Featured Sellers' section on buyer app",
        category=WalletServiceCategory.VISIBILITY,
        cost_ngn=6000,
        duration_days=30,
        min_tier="silver"
    ),
    
    # Communication services
    WalletService(
        service_id="sms_pack_50",
        name="SMS Pack (50 messages)",
        description="Send order updates and promotions to buyers via SMS",
        category=WalletServiceCategory.COMMUNICATION,
        cost_ngn=500,
        partner="Termii/Africa's Talking"
    ),
    WalletService(
        service_id="sms_pack_200",
        name="SMS Pack (200 messages)",
        description="Send order updates and promotions to buyers via SMS",
        category=WalletServiceCategory.COMMUNICATION,
        cost_ngn=1500,
        partner="Termii/Africa's Talking"
    ),
    WalletService(
        service_id="whatsapp_pack_100",
        name="WhatsApp Pack (100 messages)",
        description="Send order updates via WhatsApp Business API",
        category=WalletServiceCategory.COMMUNICATION,
        cost_ngn=800,
        partner="WhatsApp Business"
    ),
    WalletService(
        service_id="whatsapp_pack_500",
        name="WhatsApp Pack (500 messages)",
        description="Send order updates via WhatsApp Business API",
        category=WalletServiceCategory.COMMUNICATION,
        cost_ngn=3000,
        partner="WhatsApp Business"
    ),
    
    # Logistics services
    WalletService(
        service_id="delivery_discount_500",
        name="Delivery Discount Voucher (500 NGN)",
        description="500 NGN off delivery for your next 5 orders",
        category=WalletServiceCategory.LOGISTICS,
        cost_ngn=400,  # Subsidized by logistics partner
        partner="GIG Logistics/Kwik"
    ),
    WalletService(
        service_id="delivery_discount_2000",
        name="Delivery Discount Voucher (2000 NGN)",
        description="2000 NGN off delivery for your next 20 orders",
        category=WalletServiceCategory.LOGISTICS,
        cost_ngn=1400,  # Subsidized by logistics partner
        partner="GIG Logistics/Kwik"
    ),
    WalletService(
        service_id="express_delivery_upgrade",
        name="Express Delivery Upgrade (10 orders)",
        description="Upgrade 10 orders to express delivery at no extra cost",
        category=WalletServiceCategory.LOGISTICS,
        cost_ngn=2500,
        partner="GIG Logistics/Kwik",
        min_tier="silver"
    ),
    
    # Protection services
    WalletService(
        service_id="insurance_topup_basic",
        name="Insurance Top-up (Basic)",
        description="Extend protection coverage by 5000 NGN per transaction",
        category=WalletServiceCategory.PROTECTION,
        cost_ngn=200,
        partner="SocialEscrow Insurance Pool"
    ),
    WalletService(
        service_id="insurance_topup_premium",
        name="Insurance Top-up (Premium)",
        description="Extend protection coverage by 20000 NGN per transaction",
        category=WalletServiceCategory.PROTECTION,
        cost_ngn=600,
        partner="SocialEscrow Insurance Pool",
        min_tier="silver"
    ),
    WalletService(
        service_id="chargeback_protection",
        name="Chargeback Protection (30 days)",
        description="Protection against fraudulent chargebacks up to 50000 NGN",
        category=WalletServiceCategory.PROTECTION,
        cost_ngn=1500,
        duration_days=30,
        min_tier="gold"
    ),
    
    # Marketing services
    WalletService(
        service_id="promo_banner_7d",
        name="Promotional Banner (7 days)",
        description="Your custom banner displayed on buyer checkout pages",
        category=WalletServiceCategory.MARKETING,
        cost_ngn=3000,
        duration_days=7,
        min_tier="silver"
    ),
    WalletService(
        service_id="buyer_retargeting_100",
        name="Buyer Retargeting (100 contacts)",
        description="Send promotional messages to past buyers",
        category=WalletServiceCategory.MARKETING,
        cost_ngn=1000,
        min_tier="silver"
    ),
    WalletService(
        service_id="analytics_premium_30d",
        name="Premium Analytics (30 days)",
        description="Advanced sales analytics, buyer insights, and conversion tracking",
        category=WalletServiceCategory.MARKETING,
        cost_ngn=2000,
        duration_days=30,
        min_tier="gold"
    ),
]


# =============================================================================
# Wallet Data Models
# =============================================================================

@dataclass
class WalletTransaction:
    """Record of wallet credit or debit"""
    transaction_id: str
    seller_id: str
    amount: float  # Positive = credit, negative = debit
    transaction_type: str  # "rebate", "bonus", "spend", "withdrawal", "expire"
    description: str
    reference_id: Optional[str] = None  # Escrow ID or service ID
    balance_after: float = 0
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class ActiveService:
    """Active service purchased by seller"""
    activation_id: str
    seller_id: str
    service_id: str
    service_name: str
    activated_at: str
    expires_at: Optional[str] = None
    remaining_uses: Optional[int] = None  # For usage-based services
    status: str = "active"  # active, expired, exhausted


@dataclass
class SellerWallet:
    """Seller's growth wallet"""
    seller_id: str
    balance: float = 0.0
    lifetime_earned: float = 0.0
    lifetime_spent: float = 0.0
    lifetime_withdrawn: float = 0.0
    pending_rebates: float = 0.0  # Rebates from incomplete transactions
    created_at: str = ""
    last_activity_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()
        if not self.last_activity_at:
            self.last_activity_at = datetime.utcnow().isoformat()


# =============================================================================
# In-Memory Storage (Use persistent storage in production)
# =============================================================================

_wallets: Dict[str, Dict[str, Any]] = {}
_wallet_transactions: List[Dict[str, Any]] = []
_active_services: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# Wallet Engine
# =============================================================================

class WalletEngine:
    """Engine for managing growth wallet operations"""
    
    @staticmethod
    def calculate_rebate(transaction_amount: float) -> float:
        """Calculate rebate amount for a transaction"""
        return transaction_amount * (REBATE_PERCENTAGE / 100)
    
    @staticmethod
    def get_available_services(seller_tier: str, wallet_balance: float) -> List[Dict[str, Any]]:
        """Get services available to a seller based on tier and balance"""
        
        tier_order = ["bronze", "silver", "gold", "platinum"]
        seller_tier_index = tier_order.index(seller_tier.lower())
        
        available = []
        for service in WALLET_SERVICES:
            if not service.is_active:
                continue
            
            min_tier_index = tier_order.index(service.min_tier.lower())
            if seller_tier_index < min_tier_index:
                continue
            
            available.append({
                **asdict(service),
                "can_afford": wallet_balance >= service.cost_ngn,
                "amount_needed": max(0, service.cost_ngn - wallet_balance)
            })
        
        return available
    
    @staticmethod
    def get_active_services(seller_id: str) -> List[Dict[str, Any]]:
        """Get currently active services for a seller"""
        
        now = datetime.utcnow()
        active = []
        
        for activation_id, service_data in _active_services.items():
            if service_data["seller_id"] != seller_id:
                continue
            
            if service_data["status"] != "active":
                continue
            
            # Check expiry
            if service_data.get("expires_at"):
                expires_at = datetime.fromisoformat(service_data["expires_at"])
                if now > expires_at:
                    service_data["status"] = "expired"
                    _active_services[activation_id] = service_data
                    continue
            
            # Check remaining uses
            if service_data.get("remaining_uses") is not None:
                if service_data["remaining_uses"] <= 0:
                    service_data["status"] = "exhausted"
                    _active_services[activation_id] = service_data
                    continue
            
            active.append(service_data)
        
        return active


# =============================================================================
# API Models
# =============================================================================

class CreditWalletRequest(BaseModel):
    escrow_id: str
    transaction_amount: float
    transaction_completed: bool = True


class PurchaseServiceRequest(BaseModel):
    service_id: str


class WithdrawRequest(BaseModel):
    amount: float
    bank_account_id: str


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/services")
async def get_all_services():
    """Get all available wallet services"""
    return {
        "services": [asdict(s) for s in WALLET_SERVICES if s.is_active],
        "categories": [c.value for c in WalletServiceCategory]
    }


@router.get("/services/{category}")
async def get_services_by_category(category: str):
    """Get services by category"""
    try:
        cat = WalletServiceCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid category")
    
    services = [asdict(s) for s in WALLET_SERVICES if s.is_active and s.category == cat]
    return {"category": category, "services": services}


@router.get("/{seller_id}")
async def get_wallet(seller_id: str):
    """Get seller's growth wallet"""
    
    if seller_id not in _wallets:
        # Create default wallet
        wallet = SellerWallet(seller_id=seller_id)
        _wallets[seller_id] = asdict(wallet)
    
    wallet_data = _wallets[seller_id]
    
    # Get active services
    active_services = WalletEngine.get_active_services(seller_id)
    
    # Calculate potential earnings (based on average transaction)
    avg_transaction = 50000  # Assume 50k NGN average
    potential_rebate = WalletEngine.calculate_rebate(avg_transaction)
    
    return {
        "seller_id": seller_id,
        "balance": wallet_data["balance"],
        "lifetime_earned": wallet_data["lifetime_earned"],
        "lifetime_spent": wallet_data["lifetime_spent"],
        "lifetime_withdrawn": wallet_data["lifetime_withdrawn"],
        "pending_rebates": wallet_data["pending_rebates"],
        "active_services": active_services,
        "active_services_count": len(active_services),
        "rebate_rate": f"{REBATE_PERCENTAGE}%",
        "example_rebate": f"On a {avg_transaction:,.0f} NGN transaction, you earn {potential_rebate:,.0f} NGN"
    }


@router.post("/{seller_id}/credit")
async def credit_wallet(seller_id: str, request: CreditWalletRequest):
    """Credit wallet with rebate from completed transaction"""
    
    if seller_id not in _wallets:
        wallet = SellerWallet(seller_id=seller_id)
        _wallets[seller_id] = asdict(wallet)
    
    wallet_data = _wallets[seller_id]
    
    rebate_amount = WalletEngine.calculate_rebate(request.transaction_amount)
    
    if request.transaction_completed:
        # Add to balance immediately
        wallet_data["balance"] = wallet_data.get("balance", 0) + rebate_amount
        wallet_data["lifetime_earned"] = wallet_data.get("lifetime_earned", 0) + rebate_amount
        
        # Record transaction
        transaction = WalletTransaction(
            transaction_id=str(uuid.uuid4()),
            seller_id=seller_id,
            amount=rebate_amount,
            transaction_type="rebate",
            description=f"Rebate from {request.transaction_amount:,.0f} NGN transaction",
            reference_id=request.escrow_id,
            balance_after=wallet_data["balance"]
        )
        _wallet_transactions.append(asdict(transaction))
    else:
        # Add to pending (will be credited when transaction completes)
        wallet_data["pending_rebates"] = wallet_data.get("pending_rebates", 0) + rebate_amount
    
    wallet_data["last_activity_at"] = datetime.utcnow().isoformat()
    _wallets[seller_id] = wallet_data
    
    return {
        "success": True,
        "seller_id": seller_id,
        "rebate_amount": rebate_amount,
        "transaction_amount": request.transaction_amount,
        "rebate_rate": f"{REBATE_PERCENTAGE}%",
        "new_balance": wallet_data["balance"],
        "pending_rebates": wallet_data["pending_rebates"],
        "status": "credited" if request.transaction_completed else "pending"
    }


@router.post("/{seller_id}/bonus")
async def add_bonus(seller_id: str, amount: float, reason: str):
    """Add bonus to wallet (tier upgrade, promotion, etc.)"""
    
    if seller_id not in _wallets:
        wallet = SellerWallet(seller_id=seller_id)
        _wallets[seller_id] = asdict(wallet)
    
    wallet_data = _wallets[seller_id]
    
    wallet_data["balance"] = wallet_data.get("balance", 0) + amount
    wallet_data["lifetime_earned"] = wallet_data.get("lifetime_earned", 0) + amount
    wallet_data["last_activity_at"] = datetime.utcnow().isoformat()
    
    # Record transaction
    transaction = WalletTransaction(
        transaction_id=str(uuid.uuid4()),
        seller_id=seller_id,
        amount=amount,
        transaction_type="bonus",
        description=reason,
        balance_after=wallet_data["balance"]
    )
    _wallet_transactions.append(asdict(transaction))
    
    _wallets[seller_id] = wallet_data
    
    return {
        "success": True,
        "seller_id": seller_id,
        "bonus_amount": amount,
        "reason": reason,
        "new_balance": wallet_data["balance"]
    }


@router.post("/{seller_id}/purchase")
async def purchase_service(seller_id: str, request: PurchaseServiceRequest):
    """Purchase a service with wallet balance"""
    
    if seller_id not in _wallets:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    wallet_data = _wallets[seller_id]
    balance = wallet_data.get("balance", 0)
    
    # Find service
    service = None
    for s in WALLET_SERVICES:
        if s.service_id == request.service_id:
            service = s
            break
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    if not service.is_active:
        raise HTTPException(status_code=400, detail="Service is not available")
    
    # Check balance
    if balance < service.cost_ngn:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Need {service.cost_ngn:,.0f} NGN, have {balance:,.0f} NGN"
        )
    
    # Deduct from wallet
    wallet_data["balance"] = balance - service.cost_ngn
    wallet_data["lifetime_spent"] = wallet_data.get("lifetime_spent", 0) + service.cost_ngn
    wallet_data["last_activity_at"] = datetime.utcnow().isoformat()
    
    # Record transaction
    transaction = WalletTransaction(
        transaction_id=str(uuid.uuid4()),
        seller_id=seller_id,
        amount=-service.cost_ngn,
        transaction_type="spend",
        description=f"Purchased: {service.name}",
        reference_id=request.service_id,
        balance_after=wallet_data["balance"]
    )
    _wallet_transactions.append(asdict(transaction))
    
    # Activate service
    activation_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    active_service = ActiveService(
        activation_id=activation_id,
        seller_id=seller_id,
        service_id=service.service_id,
        service_name=service.name,
        activated_at=now.isoformat()
    )
    
    if service.duration_days > 0:
        active_service.expires_at = (now + timedelta(days=service.duration_days)).isoformat()
    
    # Set remaining uses for usage-based services
    if "pack" in service.service_id.lower():
        # Extract number from service_id (e.g., "sms_pack_50" -> 50)
        parts = service.service_id.split("_")
        for part in parts:
            if part.isdigit():
                active_service.remaining_uses = int(part)
                break
    
    _active_services[activation_id] = asdict(active_service)
    _wallets[seller_id] = wallet_data
    
    return {
        "success": True,
        "activation_id": activation_id,
        "service": asdict(service),
        "cost": service.cost_ngn,
        "new_balance": wallet_data["balance"],
        "expires_at": active_service.expires_at,
        "remaining_uses": active_service.remaining_uses,
        "message": f"Successfully activated {service.name}!"
    }


@router.get("/{seller_id}/available-services")
async def get_available_services(seller_id: str, tier: str = "bronze"):
    """Get services available to a seller"""
    
    if seller_id not in _wallets:
        wallet = SellerWallet(seller_id=seller_id)
        _wallets[seller_id] = asdict(wallet)
    
    wallet_data = _wallets[seller_id]
    balance = wallet_data.get("balance", 0)
    
    services = WalletEngine.get_available_services(tier, balance)
    
    return {
        "seller_id": seller_id,
        "balance": balance,
        "tier": tier,
        "services": services,
        "affordable_count": len([s for s in services if s["can_afford"]])
    }


@router.get("/{seller_id}/active-services")
async def get_active_services(seller_id: str):
    """Get seller's active services"""
    
    active = WalletEngine.get_active_services(seller_id)
    
    return {
        "seller_id": seller_id,
        "active_services": active,
        "count": len(active)
    }


@router.post("/{seller_id}/use-service/{activation_id}")
async def use_service(seller_id: str, activation_id: str):
    """Use one unit of a usage-based service"""
    
    if activation_id not in _active_services:
        raise HTTPException(status_code=404, detail="Service activation not found")
    
    service_data = _active_services[activation_id]
    
    if service_data["seller_id"] != seller_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if service_data["status"] != "active":
        raise HTTPException(status_code=400, detail=f"Service is {service_data['status']}")
    
    if service_data.get("remaining_uses") is None:
        raise HTTPException(status_code=400, detail="This service is not usage-based")
    
    if service_data["remaining_uses"] <= 0:
        service_data["status"] = "exhausted"
        _active_services[activation_id] = service_data
        raise HTTPException(status_code=400, detail="No remaining uses")
    
    service_data["remaining_uses"] -= 1
    
    if service_data["remaining_uses"] <= 0:
        service_data["status"] = "exhausted"
    
    _active_services[activation_id] = service_data
    
    return {
        "success": True,
        "activation_id": activation_id,
        "service_name": service_data["service_name"],
        "remaining_uses": service_data["remaining_uses"],
        "status": service_data["status"]
    }


@router.get("/{seller_id}/history")
async def get_wallet_history(seller_id: str, limit: int = 20):
    """Get wallet transaction history"""
    
    history = [t for t in _wallet_transactions if t["seller_id"] == seller_id]
    history.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "seller_id": seller_id,
        "transactions": history[:limit],
        "total_transactions": len(history)
    }


@router.post("/{seller_id}/withdraw")
async def withdraw_to_bank(seller_id: str, request: WithdrawRequest):
    """Withdraw wallet balance to bank account"""
    
    if seller_id not in _wallets:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    wallet_data = _wallets[seller_id]
    balance = wallet_data.get("balance", 0)
    
    if request.amount < MIN_WITHDRAWAL_AMOUNT:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal is {MIN_WITHDRAWAL_AMOUNT:,.0f} NGN"
        )
    
    if request.amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Have {balance:,.0f} NGN"
        )
    
    # Deduct from wallet
    wallet_data["balance"] = balance - request.amount
    wallet_data["lifetime_withdrawn"] = wallet_data.get("lifetime_withdrawn", 0) + request.amount
    wallet_data["last_activity_at"] = datetime.utcnow().isoformat()
    
    # Record transaction
    transaction = WalletTransaction(
        transaction_id=str(uuid.uuid4()),
        seller_id=seller_id,
        amount=-request.amount,
        transaction_type="withdrawal",
        description=f"Withdrawal to bank account {request.bank_account_id[-4:]}",
        reference_id=request.bank_account_id,
        balance_after=wallet_data["balance"]
    )
    _wallet_transactions.append(asdict(transaction))
    
    _wallets[seller_id] = wallet_data
    
    # In production, trigger bank transfer here
    
    return {
        "success": True,
        "seller_id": seller_id,
        "amount_withdrawn": request.amount,
        "new_balance": wallet_data["balance"],
        "bank_account": f"****{request.bank_account_id[-4:]}",
        "status": "processing",
        "message": "Withdrawal initiated. Funds will arrive within 24 hours."
    }


@router.get("/{seller_id}/summary")
async def get_wallet_summary(seller_id: str):
    """Get comprehensive wallet summary"""
    
    if seller_id not in _wallets:
        wallet = SellerWallet(seller_id=seller_id)
        _wallets[seller_id] = asdict(wallet)
    
    wallet_data = _wallets[seller_id]
    active_services = WalletEngine.get_active_services(seller_id)
    
    # Calculate stats
    history = [t for t in _wallet_transactions if t["seller_id"] == seller_id]
    
    rebates = sum(t["amount"] for t in history if t["transaction_type"] == "rebate")
    bonuses = sum(t["amount"] for t in history if t["transaction_type"] == "bonus")
    spent = sum(abs(t["amount"]) for t in history if t["transaction_type"] == "spend")
    withdrawn = sum(abs(t["amount"]) for t in history if t["transaction_type"] == "withdrawal")
    
    return {
        "seller_id": seller_id,
        "current_balance": wallet_data["balance"],
        "breakdown": {
            "total_rebates_earned": rebates,
            "total_bonuses_earned": bonuses,
            "total_spent_on_services": spent,
            "total_withdrawn": withdrawn
        },
        "active_services": {
            "count": len(active_services),
            "services": [s["service_name"] for s in active_services]
        },
        "rebate_info": {
            "rate": f"{REBATE_PERCENTAGE}%",
            "description": f"Earn {REBATE_PERCENTAGE}% back on every completed transaction"
        },
        "tips": [
            "Complete more transactions to earn more rebates",
            "Use your balance on visibility services to attract more buyers",
            "SMS and WhatsApp packs help you stay connected with customers"
        ]
    }
