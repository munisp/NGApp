"""
Trust Badge and Status Sharing Service for EscrowProtect
TIER 2: Escrow Trust Badge and Status Sharing

Creates recognizable visual indicators of escrow protection
that can be shared across social media platforms.
"""

import uuid
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass, field
import json
import base64

@dataclass
class TrustBadge:
    """Trust badge for an escrow transaction"""
    badge_id: str
    escrow_id: str
    
    # Status
    status: str  # pending, funded, shipped, delivered, completed, disputed
    
    # Display info
    amount: float
    currency: str = "NGN"
    seller_name: Optional[str] = None
    seller_verified: bool = False
    buyer_protected: bool = True
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    # Share tracking
    share_count: int = 0
    view_count: int = 0

class TrustBadgeService:
    """
    Service for generating and managing trust badges.
    
    Trust badges provide:
    1. Visual proof of escrow protection
    2. Real-time status updates
    3. Shareable status cards for social media
    4. Open Graph metadata for rich link previews
    """
    
    # Status display configurations
    STATUS_CONFIG = {
        "pending": {
            "label": "Awaiting Payment",
            "color": "#FFA500",
            "icon": "clock",
            "description": "Buyer is completing payment"
        },
        "funded": {
            "label": "Funds Secured",
            "color": "#4CAF50",
            "icon": "shield-check",
            "description": "Payment held in escrow"
        },
        "shipped": {
            "label": "Item Shipped",
            "color": "#2196F3",
            "icon": "truck",
            "description": "Seller has shipped the item"
        },
        "delivered": {
            "label": "Delivered",
            "color": "#9C27B0",
            "icon": "package",
            "description": "Item delivered, awaiting confirmation"
        },
        "completed": {
            "label": "Transaction Complete",
            "color": "#4CAF50",
            "icon": "check-circle",
            "description": "Payment released to seller"
        },
        "disputed": {
            "label": "Under Review",
            "color": "#F44336",
            "icon": "alert-triangle",
            "description": "Dispute in progress"
        },
        "refunded": {
            "label": "Refunded",
            "color": "#607D8B",
            "icon": "rotate-ccw",
            "description": "Payment returned to buyer"
        }
    }
    
    def __init__(self):
        self.badges: Dict[str, TrustBadge] = {}
        self.escrow_badges: Dict[str, str] = {}  # escrow_id -> badge_id
    
    def create_badge(
        self,
        escrow_id: str,
        amount: float,
        status: str = "pending",
        seller_name: str = None,
        seller_verified: bool = False
    ) -> TrustBadge:
        """
        Create a trust badge for an escrow.
        """
        badge_id = f"TB-{uuid.uuid4().hex[:12].upper()}"
        
        badge = TrustBadge(
            badge_id=badge_id,
            escrow_id=escrow_id,
            status=status,
            amount=amount,
            seller_name=seller_name,
            seller_verified=seller_verified
        )
        
        self.badges[badge_id] = badge
        self.escrow_badges[escrow_id] = badge_id
        
        return badge
    
    def update_badge_status(self, escrow_id: str, status: str) -> Optional[TrustBadge]:
        """
        Update badge status when escrow status changes.
        """
        badge_id = self.escrow_badges.get(escrow_id)
        if not badge_id:
            return None
        
        badge = self.badges.get(badge_id)
        if badge:
            badge.status = status
            badge.updated_at = datetime.utcnow().isoformat()
        
        return badge
    
    def get_badge(self, badge_id: str) -> Optional[TrustBadge]:
        """Get badge by ID"""
        badge = self.badges.get(badge_id)
        if badge:
            badge.view_count += 1
        return badge
    
    def get_badge_by_escrow(self, escrow_id: str) -> Optional[TrustBadge]:
        """Get badge by escrow ID"""
        badge_id = self.escrow_badges.get(escrow_id)
        if badge_id:
            return self.get_badge(badge_id)
        return None
    
    def generate_share_card(self, badge: TrustBadge) -> Dict[str, Any]:
        """
        Generate shareable status card data.
        
        Returns data for rendering a visual card that can be
        shared on WhatsApp, Instagram, Twitter, etc.
        """
        config = self.STATUS_CONFIG.get(badge.status, self.STATUS_CONFIG["pending"])
        
        # Generate share URL
        base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
        share_url = f"{base_url}/badge/{badge.badge_id}"
        
        # Generate share messages for different platforms
        share_message = (
            f"Transaction Protected by EscrowProtect\n"
            f"Amount: ₦{badge.amount:,.0f}\n"
            f"Status: {config['label']}\n"
            f"Verify: {share_url}"
        )
        
        return {
            "badge_id": badge.badge_id,
            "escrow_id": badge.escrow_id,
            "status": {
                "code": badge.status,
                "label": config["label"],
                "color": config["color"],
                "icon": config["icon"],
                "description": config["description"]
            },
            "amount": {
                "value": badge.amount,
                "formatted": f"₦{badge.amount:,.0f}",
                "currency": badge.currency
            },
            "seller": {
                "name": badge.seller_name or "Seller",
                "verified": badge.seller_verified
            },
            "protection": {
                "buyer_protected": badge.buyer_protected,
                "platform": "EscrowProtect",
                "guarantee": "100% Money-Back Guarantee"
            },
            "share": {
                "url": share_url,
                "message": share_message,
                "whatsapp": f"https://wa.me/?text={share_message.replace(' ', '%20').replace('\n', '%0A')}",
                "twitter": f"https://twitter.com/intent/tweet?text={share_message.replace(' ', '%20').replace('\n', '%0A')}",
                "copy_text": share_message
            },
            "timestamps": {
                "created": badge.created_at,
                "updated": badge.updated_at
            },
            "stats": {
                "views": badge.view_count,
                "shares": badge.share_count
            }
        }
    
    def generate_open_graph_meta(self, badge: TrustBadge) -> Dict[str, str]:
        """
        Generate Open Graph metadata for rich link previews.
        
        When the badge URL is shared on social media, this metadata
        creates a rich preview card.
        """
        config = self.STATUS_CONFIG.get(badge.status, self.STATUS_CONFIG["pending"])
        base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
        
        title = f"₦{badge.amount:,.0f} Protected Transaction"
        description = f"Status: {config['label']} - {config['description']}"
        
        return {
            "og:title": title,
            "og:description": description,
            "og:type": "website",
            "og:url": f"{base_url}/badge/{badge.badge_id}",
            "og:image": f"{base_url}/api/badge/{badge.badge_id}/image",
            "og:image:width": "1200",
            "og:image:height": "630",
            "og:site_name": "EscrowProtect",
            "twitter:card": "summary_large_image",
            "twitter:title": title,
            "twitter:description": description,
            "twitter:image": f"{base_url}/api/badge/{badge.badge_id}/image"
        }
    
    def generate_status_update_message(
        self,
        badge: TrustBadge,
        recipient: str = "buyer"
    ) -> Dict[str, str]:
        """
        Generate status update message to share back into chat.
        
        This allows automatic status updates to be sent to
        WhatsApp/Instagram DMs when escrow status changes.
        """
        config = self.STATUS_CONFIG.get(badge.status, self.STATUS_CONFIG["pending"])
        base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
        
        if recipient == "buyer":
            if badge.status == "funded":
                message = (
                    f"Payment Confirmed!\n\n"
                    f"₦{badge.amount:,.0f} is now held in escrow.\n"
                    f"The seller has been notified to ship your item.\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
            elif badge.status == "shipped":
                message = (
                    f"Item Shipped!\n\n"
                    f"Your order is on the way.\n"
                    f"Confirm delivery when you receive it.\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
            elif badge.status == "completed":
                message = (
                    f"Transaction Complete!\n\n"
                    f"₦{badge.amount:,.0f} has been released to the seller.\n"
                    f"Thank you for using EscrowProtect!\n\n"
                    f"Receipt: {base_url}/badge/{badge.badge_id}"
                )
            else:
                message = (
                    f"Status Update: {config['label']}\n\n"
                    f"{config['description']}\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
        else:  # seller
            if badge.status == "funded":
                message = (
                    f"Payment Received!\n\n"
                    f"₦{badge.amount:,.0f} is held in escrow.\n"
                    f"Ship the item to receive payment.\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
            elif badge.status == "delivered":
                message = (
                    f"Delivery Confirmed!\n\n"
                    f"Buyer has received the item.\n"
                    f"Payment will be released shortly.\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
            elif badge.status == "completed":
                message = (
                    f"Payment Released!\n\n"
                    f"₦{badge.amount:,.0f} has been sent to your bank account.\n"
                    f"Thank you for using EscrowProtect!\n\n"
                    f"Receipt: {base_url}/badge/{badge.badge_id}"
                )
            else:
                message = (
                    f"Status Update: {config['label']}\n\n"
                    f"{config['description']}\n\n"
                    f"Track: {base_url}/badge/{badge.badge_id}"
                )
        
        return {
            "message": message,
            "whatsapp_link": f"https://wa.me/?text={message.replace(' ', '%20').replace('\n', '%0A')}",
            "status": badge.status,
            "recipient": recipient
        }
    
    def record_share(self, badge_id: str, platform: str = "unknown") -> bool:
        """Record that a badge was shared"""
        badge = self.badges.get(badge_id)
        if badge:
            badge.share_count += 1
            return True
        return False
    
    def get_badge_html(self, badge: TrustBadge) -> str:
        """
        Generate embeddable HTML badge widget.
        
        This can be embedded in websites or emails.
        """
        config = self.STATUS_CONFIG.get(badge.status, self.STATUS_CONFIG["pending"])
        base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
        
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    max-width: 320px; border: 1px solid #e0e0e0; border-radius: 12px; 
                    padding: 16px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                <div style="width: 40px; height: 40px; background: {config['color']}; 
                            border-radius: 50%; display: flex; align-items: center; 
                            justify-content: center; margin-right: 12px;">
                    <span style="color: white; font-size: 20px;">&#10003;</span>
                </div>
                <div>
                    <div style="font-weight: 600; color: #333;">EscrowProtect</div>
                    <div style="font-size: 12px; color: #666;">Secure Transaction</div>
                </div>
            </div>
            <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <div style="font-size: 24px; font-weight: 700; color: #333;">₦{badge.amount:,.0f}</div>
                <div style="font-size: 14px; color: {config['color']}; font-weight: 500;">{config['label']}</div>
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 12px;">{config['description']}</div>
            <a href="{base_url}/badge/{badge.badge_id}" 
               style="display: block; text-align: center; background: #4CAF50; color: white; 
                      padding: 10px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Verify Transaction
            </a>
        </div>
        """
        
        return html


# Global trust badge service instance
trust_badge_service = TrustBadgeService()
