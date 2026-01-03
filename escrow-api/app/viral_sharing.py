"""
Viral Sharing Mechanics

Implements shareable artifacts that drive organic growth:
- Transaction receipts with verification badges
- Seller trust badges for social media
- Shareable checkout links with rich previews
- "Verified Transaction" badges for completed orders
- Referral link generation and tracking

Every completed transaction generates shareable proof artifacts that become
recognizable trust marks in Nigerian social commerce.
"""

import os
import logging
import uuid
import hashlib
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum
from dataclasses import dataclass, field, asdict
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/share", tags=["Viral Sharing"])


# =============================================================================
# Configuration
# =============================================================================

BASE_URL = os.getenv("BASE_URL", "https://app-eeeyetyo.fly.dev")
SHORT_LINK_PREFIX = os.getenv("SHORT_LINK_PREFIX", "https://escr.ow")  # Short domain for links


# =============================================================================
# Badge Types
# =============================================================================

class BadgeType(str, Enum):
    """Types of shareable badges"""
    SELLER_TRUST = "seller_trust"
    TRANSACTION_VERIFIED = "transaction_verified"
    BUYER_PROTECTED = "buyer_protected"
    TOP_SELLER = "top_seller"
    FAST_SHIPPER = "fast_shipper"
    HIGHLY_RATED = "highly_rated"


class SharePlatform(str, Enum):
    """Platforms for sharing"""
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TWITTER = "twitter"
    TELEGRAM = "telegram"
    COPY_LINK = "copy_link"


# =============================================================================
# Badge Definitions
# =============================================================================

@dataclass
class BadgeDefinition:
    """Definition of a shareable badge"""
    badge_type: BadgeType
    name: str
    description: str
    icon: str  # Emoji or icon code
    color: str  # Hex color
    requirements: Dict[str, Any]


BADGE_DEFINITIONS: Dict[BadgeType, BadgeDefinition] = {
    BadgeType.SELLER_TRUST: BadgeDefinition(
        badge_type=BadgeType.SELLER_TRUST,
        name="Verified Seller",
        description="This seller is verified and protected by SocialEscrow",
        icon="shield",
        color="#22C55E",
        requirements={"bank_verified": True}
    ),
    BadgeType.TRANSACTION_VERIFIED: BadgeDefinition(
        badge_type=BadgeType.TRANSACTION_VERIFIED,
        name="Verified Transaction",
        description="This transaction was completed successfully via SocialEscrow",
        icon="check-circle",
        color="#3B82F6",
        requirements={"transaction_completed": True}
    ),
    BadgeType.BUYER_PROTECTED: BadgeDefinition(
        badge_type=BadgeType.BUYER_PROTECTED,
        name="Buyer Protected",
        description="Your payment is protected until you confirm delivery",
        icon="lock",
        color="#8B5CF6",
        requirements={}
    ),
    BadgeType.TOP_SELLER: BadgeDefinition(
        badge_type=BadgeType.TOP_SELLER,
        name="Top Seller",
        description="One of our highest-rated sellers",
        icon="star",
        color="#F59E0B",
        requirements={"completed_transactions": 50, "rating": 4.5}
    ),
    BadgeType.FAST_SHIPPER: BadgeDefinition(
        badge_type=BadgeType.FAST_SHIPPER,
        name="Fast Shipper",
        description="Ships orders within 24 hours",
        icon="zap",
        color="#EF4444",
        requirements={"avg_ship_time_hours": 24}
    ),
    BadgeType.HIGHLY_RATED: BadgeDefinition(
        badge_type=BadgeType.HIGHLY_RATED,
        name="Highly Rated",
        description="Consistently receives 5-star reviews",
        icon="thumbs-up",
        color="#10B981",
        requirements={"rating": 4.8, "total_ratings": 10}
    ),
}


# =============================================================================
# Shareable Artifacts
# =============================================================================

@dataclass
class ShareableLink:
    """A shareable link with tracking"""
    link_id: str
    link_type: str  # "checkout", "receipt", "badge", "referral"
    short_url: str
    full_url: str
    seller_id: Optional[str] = None
    buyer_id: Optional[str] = None
    escrow_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    clicks: int = 0
    conversions: int = 0
    created_at: str = ""
    expires_at: Optional[str] = None
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class TransactionReceipt:
    """Shareable transaction receipt"""
    receipt_id: str
    escrow_id: str
    seller_id: str
    seller_name: str
    buyer_id: str
    buyer_name: str
    amount: float
    item_description: str
    transaction_date: str
    completion_date: str
    status: str
    verification_code: str
    share_url: str
    badges: List[str] = field(default_factory=list)


@dataclass
class SellerBadgeCard:
    """Shareable seller badge card for social media"""
    card_id: str
    seller_id: str
    seller_name: str
    seller_tier: str
    badges: List[str]
    stats: Dict[str, Any]
    share_url: str
    embed_code: str
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


# =============================================================================
# In-Memory Storage (Use persistent storage in production)
# =============================================================================

_shareable_links: Dict[str, Dict[str, Any]] = {}
_receipts: Dict[str, Dict[str, Any]] = {}
_badge_cards: Dict[str, Dict[str, Any]] = {}
_link_clicks: List[Dict[str, Any]] = []


# =============================================================================
# Link Generation
# =============================================================================

class LinkGenerator:
    """Generates short, trackable links"""
    
    @staticmethod
    def generate_short_code(length: int = 8) -> str:
        """Generate a short alphanumeric code"""
        chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        random_bytes = os.urandom(length)
        return ''.join(chars[b % len(chars)] for b in random_bytes)
    
    @staticmethod
    def generate_verification_code(escrow_id: str, seller_id: str) -> str:
        """Generate a verification code for receipts"""
        data = f"{escrow_id}:{seller_id}:{datetime.utcnow().date()}"
        hash_bytes = hashlib.sha256(data.encode()).digest()
        return base64.b32encode(hash_bytes[:5]).decode().rstrip('=')
    
    @staticmethod
    def create_checkout_link(
        seller_id: str,
        item_description: str,
        price: float,
        seller_name: str
    ) -> ShareableLink:
        """Create a shareable checkout link"""
        
        link_id = str(uuid.uuid4())
        short_code = LinkGenerator.generate_short_code()
        
        link = ShareableLink(
            link_id=link_id,
            link_type="checkout",
            short_url=f"{SHORT_LINK_PREFIX}/{short_code}",
            full_url=f"{BASE_URL}/checkout?seller={seller_id}&item={item_description}&price={price}",
            seller_id=seller_id,
            metadata={
                "item_description": item_description,
                "price": price,
                "seller_name": seller_name
            }
        )
        
        _shareable_links[short_code] = asdict(link)
        return link
    
    @staticmethod
    def create_receipt_link(receipt_id: str) -> str:
        """Create a shareable receipt link"""
        short_code = LinkGenerator.generate_short_code()
        
        link = ShareableLink(
            link_id=str(uuid.uuid4()),
            link_type="receipt",
            short_url=f"{SHORT_LINK_PREFIX}/r/{short_code}",
            full_url=f"{BASE_URL}/receipt/{receipt_id}",
            metadata={"receipt_id": receipt_id}
        )
        
        _shareable_links[short_code] = asdict(link)
        return link.short_url
    
    @staticmethod
    def create_referral_link(referrer_id: str, referral_code: str) -> ShareableLink:
        """Create a referral link"""
        
        link_id = str(uuid.uuid4())
        short_code = LinkGenerator.generate_short_code()
        
        link = ShareableLink(
            link_id=link_id,
            link_type="referral",
            short_url=f"{SHORT_LINK_PREFIX}/ref/{short_code}",
            full_url=f"{BASE_URL}/signup?ref={referral_code}",
            seller_id=referrer_id,
            metadata={"referral_code": referral_code}
        )
        
        _shareable_links[short_code] = asdict(link)
        return link


# =============================================================================
# Share Content Generator
# =============================================================================

class ShareContentGenerator:
    """Generates platform-specific share content"""
    
    @staticmethod
    def generate_checkout_share(
        platform: SharePlatform,
        seller_name: str,
        item_description: str,
        price: float,
        checkout_url: str
    ) -> Dict[str, str]:
        """Generate share content for checkout link"""
        
        price_formatted = f"{price:,.0f}"
        
        messages = {
            SharePlatform.WHATSAPP: f"Buy {item_description} from {seller_name} for N{price_formatted}\n\nProtected by SocialEscrow - Your payment is safe until you confirm delivery\n\n{checkout_url}",
            SharePlatform.INSTAGRAM: f"Buy {item_description} from {seller_name}\nN{price_formatted}\n\nProtected by SocialEscrow\nLink in bio or DM for link",
            SharePlatform.FACEBOOK: f"Check out {item_description} from {seller_name} for N{price_formatted}!\n\nYour payment is protected by SocialEscrow until you confirm delivery.\n\n{checkout_url}",
            SharePlatform.TWITTER: f"Buy {item_description} from {seller_name} for N{price_formatted}\n\nProtected by @SocialEscrow\n\n{checkout_url}",
            SharePlatform.TELEGRAM: f"Buy {item_description} from {seller_name} for N{price_formatted}\n\nProtected by SocialEscrow\n\n{checkout_url}",
            SharePlatform.COPY_LINK: checkout_url
        }
        
        share_urls = {
            SharePlatform.WHATSAPP: f"https://wa.me/?text={messages[SharePlatform.WHATSAPP].replace(' ', '%20').replace('\n', '%0A')}",
            SharePlatform.FACEBOOK: f"https://www.facebook.com/sharer/sharer.php?u={checkout_url}",
            SharePlatform.TWITTER: f"https://twitter.com/intent/tweet?text={messages[SharePlatform.TWITTER].replace(' ', '%20').replace('\n', '%0A')}",
            SharePlatform.TELEGRAM: f"https://t.me/share/url?url={checkout_url}&text={item_description}",
        }
        
        return {
            "message": messages.get(platform, checkout_url),
            "share_url": share_urls.get(platform, checkout_url),
            "platform": platform.value
        }
    
    @staticmethod
    def generate_receipt_share(
        platform: SharePlatform,
        seller_name: str,
        item_description: str,
        amount: float,
        receipt_url: str,
        verification_code: str
    ) -> Dict[str, str]:
        """Generate share content for transaction receipt"""
        
        amount_formatted = f"{amount:,.0f}"
        
        messages = {
            SharePlatform.WHATSAPP: f"Transaction Verified by SocialEscrow\n\nSeller: {seller_name}\nItem: {item_description}\nAmount: N{amount_formatted}\nVerification: {verification_code}\n\nView receipt: {receipt_url}",
            SharePlatform.INSTAGRAM: f"Successful purchase from {seller_name}\nVerified by SocialEscrow\nCode: {verification_code}",
            SharePlatform.FACEBOOK: f"Just completed a safe transaction with {seller_name} via SocialEscrow!\n\nItem: {item_description}\nAmount: N{amount_formatted}\n\nVerification code: {verification_code}\n\n{receipt_url}",
            SharePlatform.TWITTER: f"Verified transaction with {seller_name} via @SocialEscrow\n\nN{amount_formatted} - {item_description}\nCode: {verification_code}\n\n{receipt_url}",
            SharePlatform.TELEGRAM: f"Transaction Verified\n\nSeller: {seller_name}\nAmount: N{amount_formatted}\nCode: {verification_code}\n\n{receipt_url}",
            SharePlatform.COPY_LINK: receipt_url
        }
        
        return {
            "message": messages.get(platform, receipt_url),
            "platform": platform.value
        }
    
    @staticmethod
    def generate_seller_badge_share(
        platform: SharePlatform,
        seller_name: str,
        tier: str,
        completed_transactions: int,
        rating: float,
        badge_url: str
    ) -> Dict[str, str]:
        """Generate share content for seller badge"""
        
        tier_emoji = {"bronze": "🥉", "silver": "🥈", "gold": "🥇", "platinum": "💎"}.get(tier.lower(), "✓")
        
        messages = {
            SharePlatform.WHATSAPP: f"{tier_emoji} {seller_name} - Verified {tier.title()} Seller\n\n{completed_transactions}+ successful transactions\n{rating:.1f} star rating\n\nProtected by SocialEscrow\n\n{badge_url}",
            SharePlatform.INSTAGRAM: f"{tier_emoji} Verified {tier.title()} Seller\n{completed_transactions}+ transactions\n{rating:.1f} stars\nProtected by SocialEscrow",
            SharePlatform.FACEBOOK: f"I'm a verified {tier.title()} seller on SocialEscrow!\n\n{completed_transactions}+ successful transactions\n{rating:.1f} star rating\n\nShop with confidence - your payment is protected!\n\n{badge_url}",
            SharePlatform.TWITTER: f"{tier_emoji} Verified {tier.title()} Seller on @SocialEscrow\n\n{completed_transactions}+ transactions | {rating:.1f} stars\n\nShop safely: {badge_url}",
            SharePlatform.TELEGRAM: f"{tier_emoji} {seller_name}\nVerified {tier.title()} Seller\n\n{completed_transactions}+ transactions\n{rating:.1f} stars\n\n{badge_url}",
            SharePlatform.COPY_LINK: badge_url
        }
        
        return {
            "message": messages.get(platform, badge_url),
            "platform": platform.value
        }


# =============================================================================
# API Models
# =============================================================================

class CreateCheckoutLinkRequest(BaseModel):
    seller_id: str
    seller_name: str
    item_description: str
    price: float


class CreateReceiptRequest(BaseModel):
    escrow_id: str
    seller_id: str
    seller_name: str
    buyer_id: str
    buyer_name: str
    amount: float
    item_description: str


class GenerateShareContentRequest(BaseModel):
    platform: SharePlatform
    content_type: str  # "checkout", "receipt", "badge"
    content_id: str


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/badges")
async def get_badge_definitions():
    """Get all badge definitions"""
    return {
        "badges": {k.value: asdict(v) for k, v in BADGE_DEFINITIONS.items()}
    }


@router.post("/checkout-link")
async def create_checkout_link(request: CreateCheckoutLinkRequest):
    """Create a shareable checkout link"""
    
    link = LinkGenerator.create_checkout_link(
        seller_id=request.seller_id,
        item_description=request.item_description,
        price=request.price,
        seller_name=request.seller_name
    )
    
    # Generate share content for all platforms
    share_content = {}
    for platform in SharePlatform:
        share_content[platform.value] = ShareContentGenerator.generate_checkout_share(
            platform=platform,
            seller_name=request.seller_name,
            item_description=request.item_description,
            price=request.price,
            checkout_url=link.short_url
        )
    
    return {
        "link_id": link.link_id,
        "short_url": link.short_url,
        "full_url": link.full_url,
        "share_content": share_content,
        "og_preview": {
            "title": f"Buy {request.item_description} from {request.seller_name}",
            "description": f"N{request.price:,.0f} - Protected by SocialEscrow",
            "image": f"{BASE_URL}/api/v1/share/og-image/checkout/{link.link_id}"
        }
    }


@router.post("/receipt")
async def create_transaction_receipt(request: CreateReceiptRequest):
    """Create a shareable transaction receipt"""
    
    receipt_id = str(uuid.uuid4())
    verification_code = LinkGenerator.generate_verification_code(
        request.escrow_id, 
        request.seller_id
    )
    
    receipt = TransactionReceipt(
        receipt_id=receipt_id,
        escrow_id=request.escrow_id,
        seller_id=request.seller_id,
        seller_name=request.seller_name,
        buyer_id=request.buyer_id,
        buyer_name=request.buyer_name,
        amount=request.amount,
        item_description=request.item_description,
        transaction_date=datetime.utcnow().isoformat(),
        completion_date=datetime.utcnow().isoformat(),
        status="completed",
        verification_code=verification_code,
        share_url=LinkGenerator.create_receipt_link(receipt_id),
        badges=[BadgeType.TRANSACTION_VERIFIED.value]
    )
    
    _receipts[receipt_id] = asdict(receipt)
    
    # Generate share content for all platforms
    share_content = {}
    for platform in SharePlatform:
        share_content[platform.value] = ShareContentGenerator.generate_receipt_share(
            platform=platform,
            seller_name=request.seller_name,
            item_description=request.item_description,
            amount=request.amount,
            receipt_url=receipt.share_url,
            verification_code=verification_code
        )
    
    return {
        "receipt_id": receipt_id,
        "verification_code": verification_code,
        "share_url": receipt.share_url,
        "share_content": share_content,
        "receipt": asdict(receipt)
    }


@router.get("/receipt/{receipt_id}")
async def get_receipt(receipt_id: str):
    """Get transaction receipt details"""
    
    if receipt_id not in _receipts:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    return _receipts[receipt_id]


@router.get("/receipt/{receipt_id}/verify")
async def verify_receipt(receipt_id: str, code: str):
    """Verify a transaction receipt"""
    
    if receipt_id not in _receipts:
        return {"valid": False, "error": "Receipt not found"}
    
    receipt = _receipts[receipt_id]
    
    if receipt["verification_code"] != code:
        return {"valid": False, "error": "Invalid verification code"}
    
    return {
        "valid": True,
        "receipt": receipt,
        "message": "This transaction was verified by SocialEscrow"
    }


@router.post("/seller-badge/{seller_id}")
async def create_seller_badge_card(
    seller_id: str,
    seller_name: str,
    tier: str = "bronze",
    completed_transactions: int = 0,
    rating: float = 0.0,
    total_ratings: int = 0
):
    """Create a shareable seller badge card"""
    
    card_id = str(uuid.uuid4())
    short_code = LinkGenerator.generate_short_code()
    share_url = f"{SHORT_LINK_PREFIX}/s/{short_code}"
    
    # Determine badges
    badges = [BadgeType.SELLER_TRUST.value]
    
    if completed_transactions >= 50 and rating >= 4.5:
        badges.append(BadgeType.TOP_SELLER.value)
    if rating >= 4.8 and total_ratings >= 10:
        badges.append(BadgeType.HIGHLY_RATED.value)
    
    # Generate embed code (HTML snippet for websites)
    embed_code = f'''<a href="{share_url}" target="_blank" rel="noopener">
  <img src="{BASE_URL}/api/v1/share/badge-image/{card_id}" 
       alt="Verified by SocialEscrow" 
       style="max-width: 200px; height: auto;" />
</a>'''
    
    card = SellerBadgeCard(
        card_id=card_id,
        seller_id=seller_id,
        seller_name=seller_name,
        seller_tier=tier,
        badges=badges,
        stats={
            "completed_transactions": completed_transactions,
            "rating": rating,
            "total_ratings": total_ratings
        },
        share_url=share_url,
        embed_code=embed_code
    )
    
    _badge_cards[card_id] = asdict(card)
    
    # Store link for tracking
    link = ShareableLink(
        link_id=str(uuid.uuid4()),
        link_type="badge",
        short_url=share_url,
        full_url=f"{BASE_URL}/seller/{seller_id}",
        seller_id=seller_id,
        metadata={"card_id": card_id}
    )
    _shareable_links[short_code] = asdict(link)
    
    # Generate share content for all platforms
    share_content = {}
    for platform in SharePlatform:
        share_content[platform.value] = ShareContentGenerator.generate_seller_badge_share(
            platform=platform,
            seller_name=seller_name,
            tier=tier,
            completed_transactions=completed_transactions,
            rating=rating,
            badge_url=share_url
        )
    
    return {
        "card_id": card_id,
        "share_url": share_url,
        "embed_code": embed_code,
        "badges": badges,
        "share_content": share_content,
        "card": asdict(card)
    }


@router.get("/seller-badge/{card_id}")
async def get_seller_badge_card(card_id: str):
    """Get seller badge card details"""
    
    if card_id not in _badge_cards:
        raise HTTPException(status_code=404, detail="Badge card not found")
    
    return _badge_cards[card_id]


@router.post("/referral-link/{referrer_id}")
async def create_referral_link(referrer_id: str, referral_code: str):
    """Create a referral link"""
    
    link = LinkGenerator.create_referral_link(referrer_id, referral_code)
    
    return {
        "link_id": link.link_id,
        "short_url": link.short_url,
        "full_url": link.full_url,
        "referral_code": referral_code,
        "share_message": f"Join SocialEscrow and get 1000 bonus points!\n\nUse my referral code: {referral_code}\n\n{link.short_url}"
    }


@router.get("/track/{short_code}")
async def track_link_click(short_code: str, source: Optional[str] = None):
    """Track a link click and redirect"""
    
    if short_code not in _shareable_links:
        raise HTTPException(status_code=404, detail="Link not found")
    
    link_data = _shareable_links[short_code]
    
    # Record click
    link_data["clicks"] = link_data.get("clicks", 0) + 1
    _shareable_links[short_code] = link_data
    
    # Record click event
    _link_clicks.append({
        "link_id": link_data["link_id"],
        "short_code": short_code,
        "source": source,
        "clicked_at": datetime.utcnow().isoformat()
    })
    
    return RedirectResponse(url=link_data["full_url"])


@router.post("/track/{short_code}/conversion")
async def track_conversion(short_code: str):
    """Track a conversion (e.g., completed purchase from shared link)"""
    
    if short_code not in _shareable_links:
        raise HTTPException(status_code=404, detail="Link not found")
    
    link_data = _shareable_links[short_code]
    link_data["conversions"] = link_data.get("conversions", 0) + 1
    _shareable_links[short_code] = link_data
    
    return {
        "success": True,
        "link_id": link_data["link_id"],
        "conversions": link_data["conversions"]
    }


@router.get("/analytics/{seller_id}")
async def get_sharing_analytics(seller_id: str):
    """Get sharing analytics for a seller"""
    
    # Find all links for this seller
    seller_links = [
        link for link in _shareable_links.values()
        if link.get("seller_id") == seller_id
    ]
    
    total_clicks = sum(link.get("clicks", 0) for link in seller_links)
    total_conversions = sum(link.get("conversions", 0) for link in seller_links)
    
    # Group by link type
    by_type = {}
    for link in seller_links:
        link_type = link.get("link_type", "unknown")
        if link_type not in by_type:
            by_type[link_type] = {"count": 0, "clicks": 0, "conversions": 0}
        by_type[link_type]["count"] += 1
        by_type[link_type]["clicks"] += link.get("clicks", 0)
        by_type[link_type]["conversions"] += link.get("conversions", 0)
    
    conversion_rate = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
    
    return {
        "seller_id": seller_id,
        "total_links": len(seller_links),
        "total_clicks": total_clicks,
        "total_conversions": total_conversions,
        "conversion_rate": f"{conversion_rate:.1f}%",
        "by_type": by_type,
        "top_performing_links": sorted(
            seller_links, 
            key=lambda x: x.get("conversions", 0), 
            reverse=True
        )[:5]
    }


@router.get("/og-image/checkout/{link_id}")
async def get_checkout_og_image(link_id: str):
    """Generate Open Graph image for checkout link (placeholder)"""
    
    # In production, generate actual image with seller info, price, etc.
    # For now, return a placeholder response
    return {
        "image_url": f"{BASE_URL}/static/og-checkout-placeholder.png",
        "width": 1200,
        "height": 630
    }


@router.get("/badge-image/{card_id}")
async def get_badge_image(card_id: str):
    """Generate badge image for embedding (placeholder)"""
    
    if card_id not in _badge_cards:
        raise HTTPException(status_code=404, detail="Badge card not found")
    
    card = _badge_cards[card_id]
    
    # In production, generate actual badge image
    # For now, return a placeholder response
    return {
        "image_url": f"{BASE_URL}/static/badge-placeholder.png",
        "seller_name": card["seller_name"],
        "tier": card["seller_tier"],
        "width": 200,
        "height": 80
    }


@router.get("/prompts/post-transaction/{escrow_id}")
async def get_post_transaction_prompts(escrow_id: str):
    """Get sharing prompts to show after a completed transaction"""
    
    return {
        "buyer_prompts": [
            {
                "type": "share_receipt",
                "title": "Share your verified purchase",
                "description": "Let others know this was a safe transaction",
                "cta": "Share Receipt"
            },
            {
                "type": "share_seller",
                "title": "Recommend this seller",
                "description": "Help others find trusted sellers",
                "cta": "Share Seller"
            },
            {
                "type": "refer_friend",
                "title": "Invite a friend",
                "description": "Get 1000 points when they make their first purchase",
                "cta": "Invite Friend"
            }
        ],
        "seller_prompts": [
            {
                "type": "share_success",
                "title": "Share your success",
                "description": "Show customers you're a verified seller",
                "cta": "Share Badge"
            },
            {
                "type": "create_checkout_link",
                "title": "Create a checkout link",
                "description": "Make it easy for customers to buy from you",
                "cta": "Create Link"
            }
        ]
    }
