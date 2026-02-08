"""
Telegram Bot API Service with full middleware integration.
Supports: Commands, inline keyboards, webhooks, media, Kafka events, Redis sessions, Temporal workflows.
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

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

app = FastAPI(title="Telegram Bot API Service", version="1.0.0")

# Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "fintech_telegram_secret")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
TEMPORAL_ADDRESS = os.getenv("TEMPORAL_ADDRESS", "temporal:7233")


class UpdateType(str, Enum):
    MESSAGE = "message"
    CALLBACK_QUERY = "callback_query"
    INLINE_QUERY = "inline_query"
    EDITED_MESSAGE = "edited_message"


class ChatType(str, Enum):
    PRIVATE = "private"
    GROUP = "group"
    SUPERGROUP = "supergroup"
    CHANNEL = "channel"


@dataclass
class TelegramUser:
    user_id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    language_code: Optional[str]
    linked_account_id: Optional[str] = None


@dataclass
class TelegramChat:
    chat_id: int
    chat_type: ChatType
    title: Optional[str]
    username: Optional[str]
    user: Optional[TelegramUser] = None


@dataclass
class TelegramMessage:
    message_id: str
    chat_id: int
    user_id: Optional[int]
    text: Optional[str]
    reply_to: Optional[str]
    created_at: float
    sent_at: Optional[float] = None
    delivered: bool = False


@dataclass
class BotSession:
    session_id: str
    chat_id: int
    user_id: int
    state: str
    context: dict
    started_at: float
    last_activity: float


# In-memory stores
users: dict[int, TelegramUser] = {}
chats: dict[int, TelegramChat] = {}
messages: dict[str, TelegramMessage] = {}
sessions: dict[str, BotSession] = {}
callback_handlers: dict[str, dict] = {}

# Bot commands
BOT_COMMANDS = [
    {"command": "start", "description": "Start the bot and see welcome message"},
    {"command": "help", "description": "Show available commands"},
    {"command": "balance", "description": "Check your account balance"},
    {"command": "transfer", "description": "Transfer money to another user"},
    {"command": "history", "description": "View transaction history"},
    {"command": "statement", "description": "Request account statement"},
    {"command": "pay", "description": "Pay a bill or merchant"},
    {"command": "airtime", "description": "Buy airtime"},
    {"command": "settings", "description": "Account settings"},
    {"command": "support", "description": "Contact customer support"},
    {"command": "link", "description": "Link your bank account"},
    {"command": "unlink", "description": "Unlink your bank account"},
]


# Kafka event publishing (simulated)
async def publish_kafka_event(topic: str, event: dict):
    event["timestamp"] = time.time()
    event["service"] = "telegram"
    print(f"[Kafka] Publishing to {topic}: {event.get('event_type', 'unknown')}")


# Temporal workflow triggers (simulated)
async def trigger_workflow(workflow_type: str, input_data: dict):
    workflow_id = f"{workflow_type}-{uuid.uuid4().hex[:8]}"
    print(f"[Temporal] Triggering workflow {workflow_type}: {workflow_id}")
    return workflow_id


def get_session_key(chat_id: int, user_id: int) -> str:
    return f"{chat_id}:{user_id}"


async def get_or_create_session(chat_id: int, user_id: int) -> BotSession:
    key = get_session_key(chat_id, user_id)
    if key not in sessions:
        sessions[key] = BotSession(
            session_id=f"sess_{uuid.uuid4().hex[:12]}",
            chat_id=chat_id,
            user_id=user_id,
            state="idle",
            context={},
            started_at=time.time(),
            last_activity=time.time(),
        )
    sessions[key].last_activity = time.time()
    return sessions[key]


async def send_message_internal(chat_id: int, text: str, reply_markup: Optional[dict] = None, parse_mode: str = "HTML") -> TelegramMessage:
    msg_id = f"tg_{uuid.uuid4().hex[:12]}"
    
    message = TelegramMessage(
        message_id=msg_id,
        chat_id=chat_id,
        user_id=None,
        text=text,
        reply_to=None,
        created_at=time.time(),
        sent_at=time.time(),
        delivered=True,
    )
    messages[msg_id] = message
    
    await publish_kafka_event("telegram.messages.outbound", {
        "event_type": "message_sent",
        "message_id": msg_id,
        "chat_id": chat_id,
    })
    
    return message


async def send_inline_keyboard(chat_id: int, text: str, buttons: list[list[dict]]) -> TelegramMessage:
    reply_markup = {"inline_keyboard": buttons}
    return await send_message_internal(chat_id, text, reply_markup)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "telegram",
        "version": "1.0.0",
        "bot_configured": bool(TELEGRAM_BOT_TOKEN),
        "active_sessions": len(sessions),
        "registered_users": len(users),
        "messages_sent": len(messages),
        "commands": len(BOT_COMMANDS),
        "middleware": {
            "kafka": KAFKA_BROKERS,
            "redis": REDIS_URL,
            "temporal": TEMPORAL_ADDRESS,
        }
    }


@app.post("/webhook")
async def receive_webhook(request: Request):
    """Receive webhook updates from Telegram."""
    data = await request.json()
    
    # Process update
    if "message" in data:
        await process_message(data["message"])
    elif "callback_query" in data:
        await process_callback_query(data["callback_query"])
    elif "inline_query" in data:
        await process_inline_query(data["inline_query"])
    
    return {"ok": True}


async def process_message(msg: dict):
    """Process incoming message."""
    chat = msg.get("chat", {})
    user = msg.get("from", {})
    text = msg.get("text", "")
    
    chat_id = chat.get("id")
    user_id = user.get("id")
    
    # Store/update user
    if user_id and user_id not in users:
        users[user_id] = TelegramUser(
            user_id=user_id,
            username=user.get("username"),
            first_name=user.get("first_name", ""),
            last_name=user.get("last_name"),
            language_code=user.get("language_code"),
        )
    
    # Get session
    session = await get_or_create_session(chat_id, user_id)
    
    # Publish to Kafka
    await publish_kafka_event("telegram.messages.inbound", {
        "event_type": "message_received",
        "chat_id": chat_id,
        "user_id": user_id,
        "text": text[:100],
    })
    
    # Handle commands
    if text.startswith("/"):
        await handle_command(chat_id, user_id, text, session)
    else:
        await handle_text(chat_id, user_id, text, session)


async def handle_command(chat_id: int, user_id: int, text: str, session: BotSession):
    """Handle bot commands."""
    command = text.split()[0].lower().replace("/", "").split("@")[0]
    args = text.split()[1:] if len(text.split()) > 1 else []
    
    if command == "start":
        await send_welcome(chat_id, user_id)
    elif command == "help":
        await send_help(chat_id)
    elif command == "balance":
        await handle_balance(chat_id, user_id)
    elif command == "transfer":
        await start_transfer_flow(chat_id, user_id, session)
    elif command == "history":
        await handle_history(chat_id, user_id)
    elif command == "statement":
        await handle_statement(chat_id, user_id)
    elif command == "pay":
        await start_payment_flow(chat_id, user_id, session)
    elif command == "airtime":
        await start_airtime_flow(chat_id, user_id, session)
    elif command == "settings":
        await show_settings(chat_id, user_id)
    elif command == "support":
        await handle_support(chat_id, user_id)
    elif command == "link":
        await start_link_flow(chat_id, user_id, session)
    elif command == "unlink":
        await handle_unlink(chat_id, user_id)
    else:
        await send_message_internal(chat_id, "Unknown command. Use /help to see available commands.")


async def handle_text(chat_id: int, user_id: int, text: str, session: BotSession):
    """Handle regular text based on session state."""
    state = session.state
    
    if state == "awaiting_transfer_amount":
        try:
            amount = float(text.replace(",", ""))
            session.context["amount"] = amount
            session.state = "awaiting_transfer_recipient"
            await send_message_internal(chat_id, f"Amount: {amount:,.2f} NGN\n\nEnter recipient phone number or username:")
        except ValueError:
            await send_message_internal(chat_id, "Invalid amount. Please enter a valid number:")
    
    elif state == "awaiting_transfer_recipient":
        session.context["recipient"] = text
        session.state = "confirming_transfer"
        amount = session.context.get("amount", 0)
        await send_inline_keyboard(chat_id, 
            f"<b>Confirm Transfer</b>\n\nAmount: {amount:,.2f} NGN\nTo: {text}\n\nProceed?",
            [[
                {"text": "Confirm", "callback_data": "transfer_confirm"},
                {"text": "Cancel", "callback_data": "transfer_cancel"},
            ]]
        )
    
    elif state == "awaiting_airtime_amount":
        try:
            amount = float(text.replace(",", ""))
            session.context["amount"] = amount
            session.state = "awaiting_airtime_phone"
            await send_message_internal(chat_id, f"Amount: {amount:,.2f} NGN\n\nEnter phone number:")
        except ValueError:
            await send_message_internal(chat_id, "Invalid amount. Please enter a valid number:")
    
    elif state == "awaiting_airtime_phone":
        session.context["phone"] = text
        session.state = "confirming_airtime"
        amount = session.context.get("amount", 0)
        await send_inline_keyboard(chat_id,
            f"<b>Confirm Airtime Purchase</b>\n\nAmount: {amount:,.2f} NGN\nPhone: {text}\n\nProceed?",
            [[
                {"text": "Confirm", "callback_data": "airtime_confirm"},
                {"text": "Cancel", "callback_data": "airtime_cancel"},
            ]]
        )
    
    else:
        # Default response
        await send_inline_keyboard(chat_id,
            "How can I help you today?",
            [
                [{"text": "Check Balance", "callback_data": "action_balance"}],
                [{"text": "Transfer Money", "callback_data": "action_transfer"}],
                [{"text": "Buy Airtime", "callback_data": "action_airtime"}],
                [{"text": "Transaction History", "callback_data": "action_history"}],
            ]
        )


async def process_callback_query(query: dict):
    """Process callback query from inline keyboard."""
    callback_id = query.get("id")
    chat_id = query.get("message", {}).get("chat", {}).get("id")
    user_id = query.get("from", {}).get("id")
    data = query.get("data", "")
    
    session = await get_or_create_session(chat_id, user_id)
    
    await publish_kafka_event("telegram.callbacks", {
        "event_type": "callback_received",
        "chat_id": chat_id,
        "user_id": user_id,
        "callback_data": data,
    })
    
    if data == "action_balance":
        await handle_balance(chat_id, user_id)
    elif data == "action_transfer":
        await start_transfer_flow(chat_id, user_id, session)
    elif data == "action_airtime":
        await start_airtime_flow(chat_id, user_id, session)
    elif data == "action_history":
        await handle_history(chat_id, user_id)
    elif data == "transfer_confirm":
        await confirm_transfer(chat_id, user_id, session)
    elif data == "transfer_cancel":
        session.state = "idle"
        session.context = {}
        await send_message_internal(chat_id, "Transfer cancelled.")
    elif data == "airtime_confirm":
        await confirm_airtime(chat_id, user_id, session)
    elif data == "airtime_cancel":
        session.state = "idle"
        session.context = {}
        await send_message_internal(chat_id, "Airtime purchase cancelled.")


async def process_inline_query(query: dict):
    """Process inline query."""
    query_id = query.get("id")
    query_text = query.get("query", "")
    user_id = query.get("from", {}).get("id")
    
    await publish_kafka_event("telegram.inline_queries", {
        "event_type": "inline_query",
        "user_id": user_id,
        "query": query_text[:50],
    })


async def send_welcome(chat_id: int, user_id: int):
    """Send welcome message."""
    user = users.get(user_id)
    name = user.first_name if user else "there"
    
    await send_message_internal(chat_id, f"""
<b>Welcome to FinTech Bot, {name}!</b>

I can help you with:
- Check your account balance
- Transfer money
- Buy airtime
- Pay bills
- View transaction history
- And much more!

Use /help to see all available commands.
""")
    
    await send_inline_keyboard(chat_id, "Quick actions:", [
        [{"text": "Check Balance", "callback_data": "action_balance"}],
        [{"text": "Transfer Money", "callback_data": "action_transfer"}],
        [{"text": "Buy Airtime", "callback_data": "action_airtime"}],
    ])


async def send_help(chat_id: int):
    """Send help message with all commands."""
    commands_text = "\n".join([f"/{c['command']} - {c['description']}" for c in BOT_COMMANDS])
    await send_message_internal(chat_id, f"<b>Available Commands:</b>\n\n{commands_text}")


async def handle_balance(chat_id: int, user_id: int):
    """Handle balance inquiry."""
    await trigger_workflow("balance.inquiry", {"user_id": user_id, "channel": "telegram"})
    
    # Simulated balance response
    await send_message_internal(chat_id, """
<b>Account Balance</b>

Main Account: 125,000.00 NGN
Savings: 50,000.00 NGN
Investment: 75,000.00 NGN

<i>Last updated: just now</i>
""")


async def start_transfer_flow(chat_id: int, user_id: int, session: BotSession):
    """Start transfer flow."""
    session.state = "awaiting_transfer_amount"
    session.context = {"flow": "transfer"}
    await send_message_internal(chat_id, "Enter the amount to transfer (NGN):")


async def confirm_transfer(chat_id: int, user_id: int, session: BotSession):
    """Confirm and process transfer."""
    amount = session.context.get("amount", 0)
    recipient = session.context.get("recipient", "")
    
    await trigger_workflow("transfer.process", {
        "user_id": user_id,
        "amount": amount,
        "recipient": recipient,
        "channel": "telegram",
    })
    
    session.state = "idle"
    session.context = {}
    
    await send_message_internal(chat_id, f"""
<b>Transfer Successful!</b>

Amount: {amount:,.2f} NGN
To: {recipient}
Reference: TRF{uuid.uuid4().hex[:8].upper()}

<i>A confirmation SMS has been sent.</i>
""")


async def handle_history(chat_id: int, user_id: int):
    """Handle transaction history request."""
    await send_message_internal(chat_id, """
<b>Recent Transactions</b>

1. -5,000.00 NGN - Transfer to John
   <i>Today, 10:30 AM</i>

2. +50,000.00 NGN - Salary Credit
   <i>Yesterday, 9:00 AM</i>

3. -2,500.00 NGN - Airtime Purchase
   <i>Feb 5, 3:45 PM</i>

4. -15,000.00 NGN - Bill Payment (DSTV)
   <i>Feb 4, 11:20 AM</i>

Use /statement for full statement.
""")


async def handle_statement(chat_id: int, user_id: int):
    """Handle statement request."""
    await trigger_workflow("statement.generate", {"user_id": user_id, "channel": "telegram"})
    await send_message_internal(chat_id, "Your statement is being generated. You will receive it shortly via email.")


async def start_payment_flow(chat_id: int, user_id: int, session: BotSession):
    """Start bill payment flow."""
    await send_inline_keyboard(chat_id, "Select bill type:", [
        [{"text": "Electricity", "callback_data": "bill_electricity"}],
        [{"text": "Cable TV", "callback_data": "bill_cable"}],
        [{"text": "Internet", "callback_data": "bill_internet"}],
        [{"text": "Water", "callback_data": "bill_water"}],
    ])


async def start_airtime_flow(chat_id: int, user_id: int, session: BotSession):
    """Start airtime purchase flow."""
    session.state = "awaiting_airtime_amount"
    session.context = {"flow": "airtime"}
    await send_message_internal(chat_id, "Enter airtime amount (NGN):")


async def confirm_airtime(chat_id: int, user_id: int, session: BotSession):
    """Confirm and process airtime purchase."""
    amount = session.context.get("amount", 0)
    phone = session.context.get("phone", "")
    
    await trigger_workflow("airtime.purchase", {
        "user_id": user_id,
        "amount": amount,
        "phone": phone,
        "channel": "telegram",
    })
    
    session.state = "idle"
    session.context = {}
    
    await send_message_internal(chat_id, f"""
<b>Airtime Purchase Successful!</b>

Amount: {amount:,.2f} NGN
Phone: {phone}
Reference: AIR{uuid.uuid4().hex[:8].upper()}
""")


async def show_settings(chat_id: int, user_id: int):
    """Show account settings."""
    await send_inline_keyboard(chat_id, "<b>Settings</b>\n\nManage your account:", [
        [{"text": "Notification Preferences", "callback_data": "settings_notifications"}],
        [{"text": "Security Settings", "callback_data": "settings_security"}],
        [{"text": "Linked Accounts", "callback_data": "settings_linked"}],
        [{"text": "Language", "callback_data": "settings_language"}],
    ])


async def handle_support(chat_id: int, user_id: int):
    """Handle support request."""
    await send_message_internal(chat_id, """
<b>Customer Support</b>

Need help? Choose an option:

- Call: 0800-FINTECH (0800-346-8324)
- Email: support@fintech.com
- Live Chat: Available 24/7

Or describe your issue and an agent will assist you shortly.
""")


async def start_link_flow(chat_id: int, user_id: int, session: BotSession):
    """Start account linking flow."""
    await send_message_internal(chat_id, """
<b>Link Your Account</b>

To link your bank account, please:
1. Open the FinTech mobile app
2. Go to Settings > Telegram
3. Enter this code: <code>TG{}</code>

The code expires in 10 minutes.
""".format(uuid.uuid4().hex[:6].upper()))


async def handle_unlink(chat_id: int, user_id: int):
    """Handle account unlinking."""
    user = users.get(user_id)
    if user and user.linked_account_id:
        user.linked_account_id = None
        await send_message_internal(chat_id, "Your account has been unlinked successfully.")
    else:
        await send_message_internal(chat_id, "No linked account found. Use /link to link your account.")


@app.post("/messages/send")
async def send_message(chat_id: int, text: str, parse_mode: str = "HTML"):
    """Send message to chat."""
    message = await send_message_internal(chat_id, text, parse_mode=parse_mode)
    return {"message_id": message.message_id, "chat_id": chat_id, "status": "sent"}


@app.post("/messages/keyboard")
async def send_keyboard_message(chat_id: int, text: str, buttons: list[list[dict]]):
    """Send message with inline keyboard."""
    message = await send_inline_keyboard(chat_id, text, buttons)
    return {"message_id": message.message_id, "chat_id": chat_id, "status": "sent"}


@app.get("/users")
async def list_users(limit: int = 50):
    """List registered users."""
    return {
        "users": [
            {
                "user_id": u.user_id,
                "username": u.username,
                "first_name": u.first_name,
                "linked": bool(u.linked_account_id),
            }
            for u in list(users.values())[:limit]
        ],
        "total": len(users),
    }


@app.get("/sessions")
async def list_sessions(limit: int = 50):
    """List active sessions."""
    return {
        "sessions": [
            {
                "session_id": s.session_id,
                "chat_id": s.chat_id,
                "user_id": s.user_id,
                "state": s.state,
                "last_activity": s.last_activity,
            }
            for s in list(sessions.values())[:limit]
        ],
        "total": len(sessions),
    }


@app.get("/commands")
async def get_commands():
    """Get bot commands."""
    return {"commands": BOT_COMMANDS}


@app.get("/metrics")
async def get_metrics():
    """Get service metrics."""
    return {
        "total_users": len(users),
        "active_sessions": len([s for s in sessions.values() if time.time() - s.last_activity < 3600]),
        "total_messages": len(messages),
        "linked_accounts": len([u for u in users.values() if u.linked_account_id]),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("TELEGRAM_SERVICE_PORT", "8131"))
    uvicorn.run(app, host="0.0.0.0", port=port)
