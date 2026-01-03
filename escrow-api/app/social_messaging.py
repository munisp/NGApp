"""
Deep WhatsApp/Instagram In-Chat Flow for EscrowProtect
Enables escrow initiation directly from social media chats with
real-time notifications using WhatsApp Business API templates.
"""

import json
import hashlib
import hmac
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List, Dict
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class MessageChannel(str, Enum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    MESSENGER = "messenger"
    SMS = "sms"


class MessageType(str, Enum):
    ESCROW_LINK = "escrow_link"
    PAYMENT_RECEIVED = "payment_received"
    SELLER_ACCEPTED = "seller_accepted"
    ITEM_SHIPPED = "item_shipped"
    ITEM_DELIVERED = "item_delivered"
    FUNDS_RELEASED = "funds_released"
    DISPUTE_OPENED = "dispute_opened"
    DISPUTE_RESOLVED = "dispute_resolved"
    ACTION_REQUIRED = "action_required"
    REMINDER = "reminder"
    RECEIPT = "receipt"


class ConversationStatus(str, Enum):
    ACTIVE = "active"
    PENDING_RESPONSE = "pending_response"
    COMPLETED = "completed"
    EXPIRED = "expired"


# Database Models
class SocialConversation(Base):
    __tablename__ = "social_conversations"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # Channel info
    channel = Column(SQLEnum(MessageChannel), nullable=False)
    channel_conversation_id = Column(String(100), index=True)  # WhatsApp/IG thread ID
    
    # Participants
    buyer_phone = Column(String(20))
    buyer_handle = Column(String(100))
    seller_phone = Column(String(20))
    seller_handle = Column(String(100))
    
    # Escrow reference
    escrow_id = Column(String(36), ForeignKey("escrows.id"), index=True)
    
    # Context from social post
    source_post_url = Column(String(500))
    source_post_id = Column(String(100))
    item_title = Column(String(200))
    item_price = Column(Float)
    item_currency = Column(String(3), default="NGN")
    item_image_url = Column(String(500))
    
    # Status
    status = Column(SQLEnum(ConversationStatus), default=ConversationStatus.ACTIVE)
    last_message_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = Column(String(36), ForeignKey("social_conversations.id"), index=True)
    
    # Message details
    channel = Column(SQLEnum(MessageChannel), nullable=False)
    message_type = Column(SQLEnum(MessageType), nullable=False)
    template_name = Column(String(100))
    
    # Recipient
    recipient_phone = Column(String(20))
    recipient_handle = Column(String(100))
    
    # Content
    message_content = Column(Text)
    template_params = Column(Text)  # JSON
    
    # Delivery status
    external_message_id = Column(String(100))
    delivery_status = Column(String(20), default="pending")
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    
    # Error handling
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class EscrowLink(Base):
    __tablename__ = "escrow_links"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # Short link
    short_code = Column(String(20), unique=True, index=True)
    
    # Context
    seller_id = Column(String(36))
    seller_phone = Column(String(20))
    seller_handle = Column(String(100))
    
    item_title = Column(String(200))
    item_description = Column(Text)
    item_price = Column(Float)
    item_currency = Column(String(3), default="NGN")
    item_images = Column(Text)  # JSON array
    
    source_channel = Column(SQLEnum(MessageChannel))
    source_post_url = Column(String(500))
    
    # Usage
    click_count = Column(Integer, default=0)
    conversion_count = Column(Integer, default=0)
    
    # Validity
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models
class CreateEscrowLinkRequest(BaseModel):
    seller_phone: Optional[str] = None
    seller_handle: Optional[str] = None
    item_title: str
    item_description: Optional[str] = None
    item_price: float
    item_currency: str = "NGN"
    item_images: Optional[List[str]] = None
    source_channel: Optional[MessageChannel] = None
    source_post_url: Optional[str] = None


class SendNotificationRequest(BaseModel):
    escrow_id: str
    message_type: MessageType
    recipient_phone: Optional[str] = None
    recipient_handle: Optional[str] = None
    channel: MessageChannel = MessageChannel.WHATSAPP
    custom_params: Optional[Dict[str, str]] = None


# WhatsApp Business API Client
class WhatsAppBusinessClient:
    """WhatsApp Business API client for sending template messages"""
    
    # Pre-approved template names
    TEMPLATES = {
        MessageType.ESCROW_LINK: "escrow_payment_link",
        MessageType.PAYMENT_RECEIVED: "payment_confirmation",
        MessageType.SELLER_ACCEPTED: "seller_accepted_order",
        MessageType.ITEM_SHIPPED: "item_shipped_tracking",
        MessageType.ITEM_DELIVERED: "delivery_confirmation",
        MessageType.FUNDS_RELEASED: "funds_released",
        MessageType.DISPUTE_OPENED: "dispute_notification",
        MessageType.DISPUTE_RESOLVED: "dispute_resolution",
        MessageType.ACTION_REQUIRED: "action_required",
        MessageType.REMINDER: "payment_reminder",
        MessageType.RECEIPT: "transaction_receipt",
    }
    
    def __init__(self, phone_number_id: str, access_token: str):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.base_url = f"https://graph.facebook.com/v18.0/{phone_number_id}"
    
    async def send_template_message(
        self,
        to_phone: str,
        template_name: str,
        language_code: str = "en",
        components: Optional[List[dict]] = None
    ) -> dict:
        """Send a template message via WhatsApp Business API"""
        
        # Normalize phone number (remove + and spaces)
        to_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")
        
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            }
        }
        
        if components:
            payload["template"]["components"] = components
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                json=payload,
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            return response.json()
    
    async def send_escrow_link(
        self,
        to_phone: str,
        seller_name: str,
        item_title: str,
        amount: float,
        currency: str,
        escrow_link: str
    ) -> dict:
        """Send escrow payment link"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": seller_name},
                    {"type": "text", "text": item_title},
                    {"type": "text", "text": f"{currency} {amount:,.2f}"},
                ]
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": escrow_link}
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.ESCROW_LINK],
            components=components
        )
    
    async def send_payment_confirmation(
        self,
        to_phone: str,
        buyer_name: str,
        item_title: str,
        amount: float,
        currency: str,
        escrow_id: str
    ) -> dict:
        """Send payment received confirmation"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": buyer_name},
                    {"type": "text", "text": item_title},
                    {"type": "text", "text": f"{currency} {amount:,.2f}"},
                    {"type": "text", "text": escrow_id[:8].upper()},
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.PAYMENT_RECEIVED],
            components=components
        )
    
    async def send_shipping_notification(
        self,
        to_phone: str,
        item_title: str,
        tracking_number: str,
        courier_name: str,
        tracking_link: str
    ) -> dict:
        """Send item shipped notification with tracking"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": item_title},
                    {"type": "text", "text": courier_name},
                    {"type": "text", "text": tracking_number},
                ]
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": tracking_link}
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.ITEM_SHIPPED],
            components=components
        )
    
    async def send_delivery_confirmation(
        self,
        to_phone: str,
        item_title: str,
        confirm_link: str
    ) -> dict:
        """Send delivery confirmation request"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": item_title},
                ]
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": confirm_link}
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.ITEM_DELIVERED],
            components=components
        )
    
    async def send_funds_released(
        self,
        to_phone: str,
        seller_name: str,
        amount: float,
        currency: str,
        bank_name: str
    ) -> dict:
        """Send funds released notification to seller"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": seller_name},
                    {"type": "text", "text": f"{currency} {amount:,.2f}"},
                    {"type": "text", "text": bank_name},
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.FUNDS_RELEASED],
            components=components
        )
    
    async def send_receipt(
        self,
        to_phone: str,
        receipt_type: str,
        amount: float,
        currency: str,
        receipt_link: str
    ) -> dict:
        """Send transaction receipt"""
        
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": receipt_type},
                    {"type": "text", "text": f"{currency} {amount:,.2f}"},
                ]
            },
            {
                "type": "button",
                "sub_type": "url",
                "index": "0",
                "parameters": [
                    {"type": "text", "text": receipt_link}
                ]
            }
        ]
        
        return await self.send_template_message(
            to_phone,
            self.TEMPLATES[MessageType.RECEIPT],
            components=components
        )


# Instagram Graph API Client
class InstagramMessagingClient:
    """Instagram Messaging API client"""
    
    def __init__(self, page_id: str, access_token: str):
        self.page_id = page_id
        self.access_token = access_token
        self.base_url = f"https://graph.facebook.com/v18.0/{page_id}"
    
    async def send_message(
        self,
        recipient_id: str,
        message_text: str,
        quick_replies: Optional[List[dict]] = None
    ) -> dict:
        """Send a message via Instagram"""
        
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": message_text}
        }
        
        if quick_replies:
            payload["message"]["quick_replies"] = quick_replies
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                json=payload,
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
            return response.json()
    
    async def send_escrow_link_message(
        self,
        recipient_id: str,
        seller_name: str,
        item_title: str,
        amount: float,
        currency: str,
        escrow_link: str
    ) -> dict:
        """Send escrow link via Instagram DM"""
        
        message = (
            f"🔒 Secure Payment Link\n\n"
            f"Seller: {seller_name}\n"
            f"Item: {item_title}\n"
            f"Amount: {currency} {amount:,.2f}\n\n"
            f"Pay securely with EscrowProtect:\n{escrow_link}\n\n"
            f"Your payment is protected until you confirm delivery."
        )
        
        return await self.send_message(recipient_id, message)


# Social Messaging Service
class SocialMessagingService:
    """Main service for social media messaging integration"""
    
    BASE_URL = "https://escrowprotect.ng"
    
    def __init__(
        self,
        event_bus: EventBus,
        redis_client: Any,
        whatsapp_client: Optional[WhatsAppBusinessClient] = None,
        instagram_client: Optional[InstagramMessagingClient] = None
    ):
        self.event_bus = event_bus
        self.redis = redis_client
        self.whatsapp = whatsapp_client
        self.instagram = instagram_client
    
    def _generate_short_code(self) -> str:
        """Generate short code for escrow link"""
        import string
        import random
        chars = string.ascii_letters + string.digits
        return ''.join(random.choices(chars, k=8))
    
    async def create_escrow_link(
        self,
        db,
        seller_id: str,
        request: CreateEscrowLinkRequest
    ) -> EscrowLink:
        """Create a shareable escrow link"""
        
        short_code = self._generate_short_code()
        
        link = EscrowLink(
            short_code=short_code,
            seller_id=seller_id,
            seller_phone=request.seller_phone,
            seller_handle=request.seller_handle,
            item_title=request.item_title,
            item_description=request.item_description,
            item_price=request.item_price,
            item_currency=request.item_currency,
            item_images=json.dumps(request.item_images) if request.item_images else None,
            source_channel=request.source_channel,
            source_post_url=request.source_post_url,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        
        db.add(link)
        db.commit()
        db.refresh(link)
        
        # Cache link
        await self.redis.set(
            f"escrow_link:{short_code}",
            json.dumps({
                "id": link.id,
                "seller_id": seller_id,
                "item_title": request.item_title,
                "item_price": request.item_price,
            }),
            ex=86400 * 30  # 30 days
        )
        
        # Publish event
        await self.event_bus.publish(Event(
            type="escrow_link.created",
            data={
                "link_id": link.id,
                "short_code": short_code,
                "seller_id": seller_id,
            }
        ))
        
        return link
    
    async def get_escrow_link_url(self, short_code: str) -> str:
        """Get full URL for escrow link"""
        return f"{self.BASE_URL}/pay/{short_code}"
    
    async def track_link_click(self, db, short_code: str):
        """Track when an escrow link is clicked"""
        
        link = db.query(EscrowLink).filter(
            EscrowLink.short_code == short_code
        ).first()
        
        if link:
            link.click_count += 1
            db.commit()
    
    async def send_notification(
        self,
        db,
        request: SendNotificationRequest
    ) -> MessageLog:
        """Send notification via specified channel"""
        
        # Get escrow details
        escrow = db.query("escrows").filter_by(id=request.escrow_id).first()
        if not escrow:
            raise ValueError("Escrow not found")
        
        # Create message log
        log = MessageLog(
            channel=request.channel,
            message_type=request.message_type,
            recipient_phone=request.recipient_phone,
            recipient_handle=request.recipient_handle,
            template_params=json.dumps(request.custom_params) if request.custom_params else None,
        )
        
        db.add(log)
        
        try:
            if request.channel == MessageChannel.WHATSAPP and self.whatsapp:
                result = await self._send_whatsapp_notification(
                    escrow, request.message_type, request.recipient_phone, request.custom_params
                )
                log.external_message_id = result.get("messages", [{}])[0].get("id")
                log.delivery_status = "sent"
            
            elif request.channel == MessageChannel.INSTAGRAM and self.instagram:
                result = await self._send_instagram_notification(
                    escrow, request.message_type, request.recipient_handle, request.custom_params
                )
                log.external_message_id = result.get("message_id")
                log.delivery_status = "sent"
            
            else:
                log.delivery_status = "channel_unavailable"
                log.error_message = f"Channel {request.channel} not configured"
        
        except Exception as e:
            log.delivery_status = "failed"
            log.error_message = str(e)
        
        db.commit()
        db.refresh(log)
        
        return log
    
    async def _send_whatsapp_notification(
        self,
        escrow,
        message_type: MessageType,
        phone: str,
        custom_params: Optional[Dict[str, str]]
    ) -> dict:
        """Send WhatsApp notification based on message type"""
        
        if message_type == MessageType.PAYMENT_RECEIVED:
            return await self.whatsapp.send_payment_confirmation(
                phone,
                escrow.buyer.name,
                escrow.listing.title,
                escrow.amount,
                escrow.currency,
                escrow.id
            )
        
        elif message_type == MessageType.ITEM_SHIPPED:
            tracking_link = f"{self.BASE_URL}/track/{custom_params.get('tracking_number', '')}"
            return await self.whatsapp.send_shipping_notification(
                phone,
                escrow.listing.title,
                custom_params.get("tracking_number", ""),
                custom_params.get("courier_name", ""),
                tracking_link
            )
        
        elif message_type == MessageType.ITEM_DELIVERED:
            confirm_link = f"{self.BASE_URL}/escrow/{escrow.id}/confirm"
            return await self.whatsapp.send_delivery_confirmation(
                phone,
                escrow.listing.title,
                confirm_link
            )
        
        elif message_type == MessageType.FUNDS_RELEASED:
            return await self.whatsapp.send_funds_released(
                phone,
                escrow.seller.name,
                escrow.amount,
                escrow.currency,
                custom_params.get("bank_name", "your bank")
            )
        
        elif message_type == MessageType.RECEIPT:
            receipt_link = f"{self.BASE_URL}/r/{custom_params.get('receipt_code', '')}"
            return await self.whatsapp.send_receipt(
                phone,
                custom_params.get("receipt_type", "Transaction"),
                escrow.amount,
                escrow.currency,
                receipt_link
            )
        
        else:
            raise ValueError(f"Unsupported message type: {message_type}")
    
    async def _send_instagram_notification(
        self,
        escrow,
        message_type: MessageType,
        handle: str,
        custom_params: Optional[Dict[str, str]]
    ) -> dict:
        """Send Instagram notification"""
        
        # For Instagram, we send text messages with links
        messages = {
            MessageType.PAYMENT_RECEIVED: (
                f"✅ Payment Received!\n\n"
                f"Your payment of {escrow.currency} {escrow.amount:,.2f} for "
                f"'{escrow.listing.title}' has been secured in escrow.\n\n"
                f"The seller has been notified and will ship your item soon."
            ),
            MessageType.ITEM_SHIPPED: (
                f"📦 Your Item Has Shipped!\n\n"
                f"'{escrow.listing.title}' is on its way.\n"
                f"Tracking: {custom_params.get('tracking_number', 'N/A')}\n\n"
                f"Track your delivery: {self.BASE_URL}/track/{custom_params.get('tracking_number', '')}"
            ),
            MessageType.ITEM_DELIVERED: (
                f"🎉 Delivery Confirmed!\n\n"
                f"Please confirm you received '{escrow.listing.title}'.\n\n"
                f"Confirm here: {self.BASE_URL}/escrow/{escrow.id}/confirm"
            ),
            MessageType.FUNDS_RELEASED: (
                f"💰 Funds Released!\n\n"
                f"{escrow.currency} {escrow.amount:,.2f} has been released to your account.\n\n"
                f"Thank you for using EscrowProtect!"
            ),
        }
        
        message = messages.get(message_type, f"Update on your escrow transaction: {escrow.id}")
        
        return await self.instagram.send_message(handle, message)
    
    async def handle_webhook(
        self,
        db,
        channel: MessageChannel,
        payload: dict
    ):
        """Handle incoming webhook from WhatsApp/Instagram"""
        
        if channel == MessageChannel.WHATSAPP:
            await self._handle_whatsapp_webhook(db, payload)
        elif channel == MessageChannel.INSTAGRAM:
            await self._handle_instagram_webhook(db, payload)
    
    async def _handle_whatsapp_webhook(self, db, payload: dict):
        """Handle WhatsApp webhook events"""
        
        # Handle message status updates
        if "statuses" in payload.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {}):
            statuses = payload["entry"][0]["changes"][0]["value"]["statuses"]
            for status in statuses:
                message_id = status.get("id")
                status_value = status.get("status")
                
                log = db.query(MessageLog).filter(
                    MessageLog.external_message_id == message_id
                ).first()
                
                if log:
                    log.delivery_status = status_value
                    if status_value == "delivered":
                        log.delivered_at = datetime.utcnow()
                    elif status_value == "read":
                        log.read_at = datetime.utcnow()
                    db.commit()
        
        # Handle incoming messages
        if "messages" in payload.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {}):
            messages = payload["entry"][0]["changes"][0]["value"]["messages"]
            for message in messages:
                await self._process_incoming_message(
                    db,
                    MessageChannel.WHATSAPP,
                    message.get("from"),
                    message.get("text", {}).get("body", "")
                )
    
    async def _handle_instagram_webhook(self, db, payload: dict):
        """Handle Instagram webhook events"""
        
        if "messaging" in payload.get("entry", [{}])[0]:
            for event in payload["entry"][0]["messaging"]:
                sender_id = event.get("sender", {}).get("id")
                message_text = event.get("message", {}).get("text", "")
                
                await self._process_incoming_message(
                    db,
                    MessageChannel.INSTAGRAM,
                    sender_id,
                    message_text
                )
    
    async def _process_incoming_message(
        self,
        db,
        channel: MessageChannel,
        sender: str,
        message: str
    ):
        """Process incoming message and respond if needed"""
        
        # Check for escrow-related keywords
        keywords = ["escrow", "pay", "protect", "secure", "track", "status"]
        message_lower = message.lower()
        
        if any(kw in message_lower for kw in keywords):
            # Publish event for further processing
            await self.event_bus.publish(Event(
                type="social.message_received",
                data={
                    "channel": channel.value,
                    "sender": sender,
                    "message": message,
                }
            ))


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/social", tags=["social"])


@router.post("/links")
async def create_escrow_link(
    request: CreateEscrowLinkRequest,
    seller_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Create a shareable escrow payment link"""
    from app.main import get_social_messaging_service
    service = get_social_messaging_service()
    
    link = await service.create_escrow_link(db, seller_id, request)
    url = await service.get_escrow_link_url(link.short_code)
    
    return {
        "link_id": link.id,
        "short_code": link.short_code,
        "url": url,
        "expires_at": link.expires_at.isoformat(),
    }


@router.get("/links/{short_code}")
async def get_escrow_link(
    short_code: str,
    db: Session = Depends(get_db),
):
    """Get escrow link details"""
    from app.main import get_social_messaging_service
    service = get_social_messaging_service()
    
    # Track click
    await service.track_link_click(db, short_code)
    
    link = db.query(EscrowLink).filter(
        EscrowLink.short_code == short_code,
        EscrowLink.is_active == True
    ).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found or expired")
    
    return {
        "seller_id": link.seller_id,
        "item_title": link.item_title,
        "item_description": link.item_description,
        "item_price": link.item_price,
        "item_currency": link.item_currency,
        "item_images": json.loads(link.item_images) if link.item_images else [],
    }


@router.post("/notify")
async def send_notification(
    request: SendNotificationRequest,
    db: Session = Depends(get_db),
):
    """Send notification via social channel"""
    try:
        from app.main import get_social_messaging_service
        service = get_social_messaging_service()
        log = await service.send_notification(db, request)
        return {
            "message_id": log.id,
            "status": log.delivery_status,
            "external_id": log.external_message_id,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook/whatsapp")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle WhatsApp webhook"""
    payload = await request.json()
    
    from app.main import get_social_messaging_service
    service = get_social_messaging_service()
    await service.handle_webhook(db, MessageChannel.WHATSAPP, payload)
    
    return {"status": "ok"}


@router.get("/webhook/whatsapp")
async def whatsapp_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Verify WhatsApp webhook"""
    import os
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "escrowprotect_verify")
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        return int(hub_challenge)
    
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook/instagram")
async def instagram_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle Instagram webhook"""
    payload = await request.json()
    
    from app.main import get_social_messaging_service
    service = get_social_messaging_service()
    await service.handle_webhook(db, MessageChannel.INSTAGRAM, payload)
    
    return {"status": "ok"}
