"""
WhatsApp Business API Service with full middleware integration.
Supports: Message templates, webhooks, media, interactive messages, Kafka events, Redis sessions, Temporal workflows.
"""
import asyncio
import hashlib
import hmac
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Header
from pydantic import BaseModel

app = FastAPI(title="WhatsApp Business API Service", version="1.0.0")

# Configuration
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com/v18.0")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "fintech_verify_token")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET", "")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
TEMPORAL_ADDRESS = os.getenv("TEMPORAL_ADDRESS", "temporal:7233")


class MessageType(str, Enum):
    TEXT = "text"
    TEMPLATE = "template"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    STICKER = "sticker"
    LOCATION = "location"
    CONTACTS = "contacts"
    INTERACTIVE = "interactive"
    REACTION = "reaction"


class MessageStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class TemplateCategory(str, Enum):
    AUTHENTICATION = "AUTHENTICATION"
    MARKETING = "MARKETING"
    UTILITY = "UTILITY"


@dataclass
class WhatsAppMessage:
    message_id: str
    phone_number: str
    message_type: MessageType
    content: dict
    status: MessageStatus
    created_at: float
    sent_at: Optional[float] = None
    delivered_at: Optional[float] = None
    read_at: Optional[float] = None
    error: Optional[str] = None
    template_name: Optional[str] = None
    conversation_id: Optional[str] = None


@dataclass
class Conversation:
    conversation_id: str
    phone_number: str
    user_id: Optional[str]
    started_at: float
    last_message_at: float
    message_count: int = 0
    context: dict = field(default_factory=dict)
    state: str = "active"


# In-memory stores (would be Redis in production)
messages: dict[str, WhatsAppMessage] = {}
conversations: dict[str, Conversation] = {}
templates: dict[str, dict] = {}
webhook_events: list[dict] = []

# Pre-defined message templates for fintech
FINTECH_TEMPLATES = {
    "otp_verification": {
        "name": "otp_verification",
        "language": "en",
        "category": TemplateCategory.AUTHENTICATION,
        "components": [
            {"type": "body", "text": "Your verification code is {{1}}. Valid for {{2}} minutes. Do not share this code."}
        ]
    },
    "transaction_alert": {
        "name": "transaction_alert",
        "language": "en",
        "category": TemplateCategory.UTILITY,
        "components": [
            {"type": "body", "text": "Transaction Alert: {{1}} of {{2}} {{3}} on your account ending {{4}}. Balance: {{5}} {{6}}. Ref: {{7}}"}
        ]
    },
    "payment_confirmation": {
        "name": "payment_confirmation",
        "language": "en",
        "category": TemplateCategory.UTILITY,
        "components": [
            {"type": "body", "text": "Payment of {{1}} {{2}} to {{3}} was successful. Transaction ID: {{4}}. Thank you for using our service."}
        ]
    },
    "loan_reminder": {
        "name": "loan_reminder",
        "language": "en",
        "category": TemplateCategory.UTILITY,
        "components": [
            {"type": "body", "text": "Reminder: Your loan repayment of {{1}} {{2}} is due on {{3}}. Please ensure sufficient balance to avoid penalties."}
        ]
    },
    "account_statement": {
        "name": "account_statement",
        "language": "en",
        "category": TemplateCategory.UTILITY,
        "components": [
            {"type": "body", "text": "Your account statement for {{1}} is ready. Opening: {{2}}, Closing: {{3}}, Transactions: {{4}}. Download: {{5}}"}
        ]
    },
    "kyc_status": {
        "name": "kyc_status",
        "language": "en",
        "category": TemplateCategory.UTILITY,
        "components": [
            {"type": "body", "text": "KYC Update: Your verification status is now {{1}}. {{2}}"}
        ]
    },
    "welcome_message": {
        "name": "welcome_message",
        "language": "en",
        "category": TemplateCategory.MARKETING,
        "components": [
            {"type": "body", "text": "Welcome to {{1}}! Your account is now active. Start exploring our services: Payments, Transfers, Savings, and more. Need help? Reply HELP."}
        ]
    },
    "promo_offer": {
        "name": "promo_offer",
        "language": "en",
        "category": TemplateCategory.MARKETING,
        "components": [
            {"type": "body", "text": "Special Offer: {{1}}. Valid until {{2}}. T&C apply. Reply STOP to opt out."}
        ]
    },
}

# Initialize templates
for name, template in FINTECH_TEMPLATES.items():
    templates[name] = template


class SendTextRequest(BaseModel):
    phone_number: str
    message: str
    preview_url: bool = False


class SendTemplateRequest(BaseModel):
    phone_number: str
    template_name: str
    language: str = "en"
    components: list[dict] = []


class SendMediaRequest(BaseModel):
    phone_number: str
    media_type: MessageType
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    filename: Optional[str] = None


class SendInteractiveRequest(BaseModel):
    phone_number: str
    interactive_type: str  # button, list, product, product_list
    header: Optional[dict] = None
    body: dict
    footer: Optional[dict] = None
    action: dict


class BulkSendRequest(BaseModel):
    phone_numbers: list[str]
    template_name: str
    language: str = "en"
    components: list[dict] = []


# Kafka event publishing (simulated)
async def publish_kafka_event(topic: str, event: dict):
    """Publish event to Kafka topic."""
    event["timestamp"] = time.time()
    event["service"] = "whatsapp"
    print(f"[Kafka] Publishing to {topic}: {event.get('event_type', 'unknown')}")
    # In production: await kafka_producer.send(topic, event)


# Redis session management (simulated)
async def get_conversation(phone_number: str) -> Optional[Conversation]:
    """Get or create conversation for phone number."""
    for conv in conversations.values():
        if conv.phone_number == phone_number and conv.state == "active":
            return conv
    return None


async def create_conversation(phone_number: str, user_id: Optional[str] = None) -> Conversation:
    """Create new conversation."""
    conv_id = f"conv_{uuid.uuid4().hex[:12]}"
    conv = Conversation(
        conversation_id=conv_id,
        phone_number=phone_number,
        user_id=user_id,
        started_at=time.time(),
        last_message_at=time.time(),
    )
    conversations[conv_id] = conv
    return conv


# Temporal workflow triggers (simulated)
async def trigger_workflow(workflow_type: str, input_data: dict):
    """Trigger Temporal workflow."""
    workflow_id = f"{workflow_type}-{uuid.uuid4().hex[:8]}"
    print(f"[Temporal] Triggering workflow {workflow_type}: {workflow_id}")
    # In production: await temporal_client.start_workflow(workflow_type, input_data, id=workflow_id)
    return workflow_id


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify webhook signature from Meta."""
    if not WHATSAPP_APP_SECRET:
        return True  # Skip verification in dev mode
    expected = hmac.new(
        WHATSAPP_APP_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "whatsapp",
        "version": "1.0.0",
        "connected": bool(WHATSAPP_ACCESS_TOKEN),
        "phone_number_id": WHATSAPP_PHONE_NUMBER_ID or "not_configured",
        "templates_count": len(templates),
        "active_conversations": len([c for c in conversations.values() if c.state == "active"]),
        "messages_sent": len(messages),
        "middleware": {
            "kafka": KAFKA_BROKERS,
            "redis": REDIS_URL,
            "temporal": TEMPORAL_ADDRESS,
        }
    }


@app.get("/webhook")
async def verify_webhook(
    hub_mode: str = None,
    hub_verify_token: str = None,
    hub_challenge: str = None
):
    """Webhook verification endpoint for Meta."""
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        return int(hub_challenge) if hub_challenge else ""
    raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook")
async def receive_webhook(
    request: Request,
    x_hub_signature_256: str = Header(None)
):
    """Receive webhook events from WhatsApp."""
    body = await request.body()
    
    # Verify signature
    if x_hub_signature_256 and not verify_webhook_signature(body, x_hub_signature_256):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    data = await request.json()
    webhook_events.append({"received_at": time.time(), "data": data})
    
    # Process webhook entries
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") == "messages":
                value = change.get("value", {})
                
                # Process incoming messages
                for msg in value.get("messages", []):
                    await process_incoming_message(msg, value.get("contacts", []))
                
                # Process status updates
                for status in value.get("statuses", []):
                    await process_status_update(status)
    
    return {"status": "received"}


async def process_incoming_message(msg: dict, contacts: list):
    """Process incoming WhatsApp message."""
    phone_number = msg.get("from")
    msg_type = msg.get("type")
    msg_id = msg.get("id")
    
    # Get or create conversation
    conv = await get_conversation(phone_number)
    if not conv:
        conv = await create_conversation(phone_number)
    
    conv.last_message_at = time.time()
    conv.message_count += 1
    
    # Extract message content
    content = {}
    if msg_type == "text":
        content = {"text": msg.get("text", {}).get("body", "")}
    elif msg_type == "image":
        content = msg.get("image", {})
    elif msg_type == "document":
        content = msg.get("document", {})
    elif msg_type == "interactive":
        content = msg.get("interactive", {})
    
    # Store message
    message = WhatsAppMessage(
        message_id=msg_id,
        phone_number=phone_number,
        message_type=MessageType(msg_type) if msg_type in MessageType.__members__.values() else MessageType.TEXT,
        content=content,
        status=MessageStatus.DELIVERED,
        created_at=time.time(),
        conversation_id=conv.conversation_id,
    )
    messages[msg_id] = message
    
    # Publish to Kafka
    await publish_kafka_event("whatsapp.messages.inbound", {
        "event_type": "message_received",
        "message_id": msg_id,
        "phone_number": phone_number,
        "message_type": msg_type,
        "content": content,
        "conversation_id": conv.conversation_id,
    })
    
    # Handle commands
    if msg_type == "text":
        text = content.get("text", "").upper().strip()
        if text == "HELP":
            await send_help_menu(phone_number)
        elif text == "BALANCE":
            await trigger_workflow("balance.inquiry", {"phone_number": phone_number})
        elif text == "STATEMENT":
            await trigger_workflow("statement.request", {"phone_number": phone_number})
        elif text.startswith("PAY "):
            await trigger_workflow("payment.initiate", {"phone_number": phone_number, "command": text})


async def process_status_update(status: dict):
    """Process message status update."""
    msg_id = status.get("id")
    status_value = status.get("status")
    
    if msg_id in messages:
        msg = messages[msg_id]
        if status_value == "sent":
            msg.status = MessageStatus.SENT
            msg.sent_at = time.time()
        elif status_value == "delivered":
            msg.status = MessageStatus.DELIVERED
            msg.delivered_at = time.time()
        elif status_value == "read":
            msg.status = MessageStatus.READ
            msg.read_at = time.time()
        elif status_value == "failed":
            msg.status = MessageStatus.FAILED
            msg.error = status.get("errors", [{}])[0].get("message", "Unknown error")
    
    # Publish to Kafka
    await publish_kafka_event("whatsapp.messages.status", {
        "event_type": "status_update",
        "message_id": msg_id,
        "status": status_value,
    })


async def send_help_menu(phone_number: str):
    """Send interactive help menu."""
    await send_interactive_internal(phone_number, {
        "type": "list",
        "header": {"type": "text", "text": "How can we help?"},
        "body": {"text": "Select an option below:"},
        "action": {
            "button": "View Options",
            "sections": [
                {
                    "title": "Account Services",
                    "rows": [
                        {"id": "balance", "title": "Check Balance", "description": "View your account balance"},
                        {"id": "statement", "title": "Get Statement", "description": "Request account statement"},
                        {"id": "transfer", "title": "Transfer Money", "description": "Send money to others"},
                    ]
                },
                {
                    "title": "Support",
                    "rows": [
                        {"id": "agent", "title": "Talk to Agent", "description": "Connect with support"},
                        {"id": "faq", "title": "FAQs", "description": "Frequently asked questions"},
                    ]
                }
            ]
        }
    })


async def send_message_internal(phone_number: str, message_type: str, content: dict) -> WhatsAppMessage:
    """Internal function to send WhatsApp message."""
    msg_id = f"wamid.{uuid.uuid4().hex}"
    
    message = WhatsAppMessage(
        message_id=msg_id,
        phone_number=phone_number,
        message_type=MessageType(message_type),
        content=content,
        status=MessageStatus.PENDING,
        created_at=time.time(),
    )
    messages[msg_id] = message
    
    # Simulate API call
    # In production: response = await httpx.post(f"{WHATSAPP_API_URL}/{WHATSAPP_PHONE_NUMBER_ID}/messages", ...)
    message.status = MessageStatus.SENT
    message.sent_at = time.time()
    
    # Publish to Kafka
    await publish_kafka_event("whatsapp.messages.outbound", {
        "event_type": "message_sent",
        "message_id": msg_id,
        "phone_number": phone_number,
        "message_type": message_type,
    })
    
    return message


async def send_interactive_internal(phone_number: str, interactive: dict) -> WhatsAppMessage:
    """Send interactive message."""
    return await send_message_internal(phone_number, "interactive", interactive)


@app.post("/messages/text")
async def send_text_message(req: SendTextRequest):
    """Send text message."""
    message = await send_message_internal(req.phone_number, "text", {
        "body": req.message,
        "preview_url": req.preview_url,
    })
    
    return {
        "message_id": message.message_id,
        "status": message.status.value,
        "phone_number": req.phone_number,
    }


@app.post("/messages/template")
async def send_template_message(req: SendTemplateRequest):
    """Send template message."""
    if req.template_name not in templates:
        raise HTTPException(status_code=400, detail=f"Template {req.template_name} not found")
    
    message = await send_message_internal(req.phone_number, "template", {
        "name": req.template_name,
        "language": {"code": req.language},
        "components": req.components,
    })
    message.template_name = req.template_name
    
    return {
        "message_id": message.message_id,
        "status": message.status.value,
        "phone_number": req.phone_number,
        "template": req.template_name,
    }


@app.post("/messages/media")
async def send_media_message(req: SendMediaRequest):
    """Send media message (image, document, audio, video)."""
    if req.media_type not in [MessageType.IMAGE, MessageType.DOCUMENT, MessageType.AUDIO, MessageType.VIDEO]:
        raise HTTPException(status_code=400, detail="Invalid media type")
    
    content = {}
    if req.media_url:
        content["link"] = req.media_url
    elif req.media_id:
        content["id"] = req.media_id
    else:
        raise HTTPException(status_code=400, detail="Either media_url or media_id required")
    
    if req.caption:
        content["caption"] = req.caption
    if req.filename:
        content["filename"] = req.filename
    
    message = await send_message_internal(req.phone_number, req.media_type.value, content)
    
    return {
        "message_id": message.message_id,
        "status": message.status.value,
        "phone_number": req.phone_number,
        "media_type": req.media_type.value,
    }


@app.post("/messages/interactive")
async def send_interactive_message(req: SendInteractiveRequest):
    """Send interactive message (buttons, lists, products)."""
    interactive = {
        "type": req.interactive_type,
        "body": req.body,
        "action": req.action,
    }
    if req.header:
        interactive["header"] = req.header
    if req.footer:
        interactive["footer"] = req.footer
    
    message = await send_interactive_internal(req.phone_number, interactive)
    
    return {
        "message_id": message.message_id,
        "status": message.status.value,
        "phone_number": req.phone_number,
        "interactive_type": req.interactive_type,
    }


@app.post("/messages/bulk")
async def send_bulk_messages(req: BulkSendRequest):
    """Send bulk template messages."""
    if req.template_name not in templates:
        raise HTTPException(status_code=400, detail=f"Template {req.template_name} not found")
    
    results = []
    for phone in req.phone_numbers:
        try:
            message = await send_message_internal(phone, "template", {
                "name": req.template_name,
                "language": {"code": req.language},
                "components": req.components,
            })
            results.append({"phone_number": phone, "message_id": message.message_id, "status": "sent"})
        except Exception as e:
            results.append({"phone_number": phone, "status": "failed", "error": str(e)})
    
    # Trigger bulk notification workflow
    await trigger_workflow("notification.bulk", {
        "channel": "whatsapp",
        "template": req.template_name,
        "recipients": len(req.phone_numbers),
    })
    
    return {
        "total": len(req.phone_numbers),
        "sent": len([r for r in results if r["status"] == "sent"]),
        "failed": len([r for r in results if r["status"] == "failed"]),
        "results": results,
    }


@app.get("/messages/{message_id}")
async def get_message(message_id: str):
    """Get message by ID."""
    if message_id not in messages:
        raise HTTPException(status_code=404, detail="Message not found")
    
    msg = messages[message_id]
    return {
        "message_id": msg.message_id,
        "phone_number": msg.phone_number,
        "message_type": msg.message_type.value,
        "status": msg.status.value,
        "content": msg.content,
        "created_at": msg.created_at,
        "sent_at": msg.sent_at,
        "delivered_at": msg.delivered_at,
        "read_at": msg.read_at,
        "error": msg.error,
    }


@app.get("/conversations")
async def list_conversations(status: str = "active", limit: int = 50):
    """List conversations."""
    results = [
        {
            "conversation_id": c.conversation_id,
            "phone_number": c.phone_number,
            "user_id": c.user_id,
            "started_at": c.started_at,
            "last_message_at": c.last_message_at,
            "message_count": c.message_count,
            "state": c.state,
        }
        for c in conversations.values()
        if c.state == status
    ][:limit]
    
    return {"conversations": results, "total": len(results)}


@app.get("/conversations/{conversation_id}")
async def get_conversation_details(conversation_id: str):
    """Get conversation details with messages."""
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[conversation_id]
    conv_messages = [
        {
            "message_id": m.message_id,
            "message_type": m.message_type.value,
            "content": m.content,
            "status": m.status.value,
            "created_at": m.created_at,
        }
        for m in messages.values()
        if m.conversation_id == conversation_id
    ]
    
    return {
        "conversation_id": conv.conversation_id,
        "phone_number": conv.phone_number,
        "user_id": conv.user_id,
        "started_at": conv.started_at,
        "last_message_at": conv.last_message_at,
        "message_count": conv.message_count,
        "state": conv.state,
        "context": conv.context,
        "messages": conv_messages,
    }


@app.get("/templates")
async def list_templates():
    """List available message templates."""
    return {
        "templates": [
            {
                "name": t["name"],
                "language": t["language"],
                "category": t["category"].value if isinstance(t["category"], TemplateCategory) else t["category"],
                "components": t["components"],
            }
            for t in templates.values()
        ],
        "total": len(templates),
    }


@app.get("/metrics")
async def get_metrics():
    """Get service metrics."""
    status_counts = {}
    for msg in messages.values():
        status_counts[msg.status.value] = status_counts.get(msg.status.value, 0) + 1
    
    type_counts = {}
    for msg in messages.values():
        type_counts[msg.message_type.value] = type_counts.get(msg.message_type.value, 0) + 1
    
    return {
        "total_messages": len(messages),
        "active_conversations": len([c for c in conversations.values() if c.state == "active"]),
        "status_counts": status_counts,
        "type_counts": type_counts,
        "templates_used": len(set(m.template_name for m in messages.values() if m.template_name)),
        "webhook_events_received": len(webhook_events),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("WHATSAPP_SERVICE_PORT", "8130"))
    uvicorn.run(app, host="0.0.0.0", port=port)
