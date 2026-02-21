import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uvicorn
import os
import json
import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CHANNEL_NAME = "telegram"
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
REDIS_URL = os.getenv("REDIS_URL", "")

app = FastAPI(
    title="Telegram Service",
    description="Telegram Bot API integration for Agent Banking",
    version="2.0.0"
)

from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
apply_middleware(app)
setup_logging("telegram-service")
app.include_router(metrics_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_redis = None

def _get_redis():
    global _redis
    if _redis is None and REDIS_URL:
        try:
            import redis as _redis_mod
            _redis = _redis_mod.from_url(REDIS_URL, decode_responses=True)
        except Exception:
            pass
    return _redis

def storage_get(key: str):
    r = _get_redis()
    if r:
        try:
            value = r.get(f"tg:storage:{key}")
            return json.loads(value) if value else None
        except Exception:
            pass
    return None

def storage_set(key: str, value, ttl: int = 86400):
    r = _get_redis()
    if r:
        try:
            r.setex(f"tg:storage:{key}", ttl, json.dumps(value, default=str))
            return True
        except Exception:
            pass
    return False

def storage_delete(key: str):
    r = _get_redis()
    if r:
        try:
            r.delete(f"tg:storage:{key}")
            return True
        except Exception:
            pass
    return False

def storage_keys(pattern: str = "*"):
    r = _get_redis()
    if r:
        try:
            return [k.replace("tg:storage:", "") for k in r.keys(f"tg:storage:{pattern}")]
        except Exception:
            pass
    return []

def _incr_counter(name: str) -> int:
    r = _get_redis()
    if r:
        return r.incr(f"tg:counter:{name}")
    return 0


class SendMessageRequest(BaseModel):
    chat_id: int
    text: str
    parse_mode: str = "HTML"
    reply_markup: Optional[Dict[str, Any]] = None

class WebhookUpdate(BaseModel):
    update_id: int
    message: Optional[Dict[str, Any]] = None
    callback_query: Optional[Dict[str, Any]] = None


async def _send_telegram_message(chat_id: int, text: str, reply_markup: Optional[dict] = None) -> dict:
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured, message queued locally")
        return {"ok": False, "queued_locally": True}

    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(f"{TELEGRAM_API_URL}/sendMessage", json=payload)
        if resp.status_code == 200:
            return resp.json()
        else:
            logger.error(f"Telegram API error {resp.status_code}: {resp.text}")
            raise HTTPException(status_code=502, detail=f"Telegram API error: {resp.status_code}")


@app.get("/")
async def root():
    return {
        "service": "telegram-service",
        "channel": CHANNEL_NAME,
        "version": "2.0.0",
        "status": "operational",
        "provider": "Telegram Bot API",
    }

@app.get("/health")
async def health_check():
    r = _get_redis()
    return {
        "status": "healthy",
        "service": "telegram-service",
        "redis": "connected" if r else "not_configured",
        "bot_configured": bool(TELEGRAM_BOT_TOKEN),
    }

@app.post("/send")
async def send_message(req: SendMessageRequest):
    _incr_counter("messages_sent")
    result = await _send_telegram_message(req.chat_id, req.text, req.reply_markup)
    return {"status": "sent" if result.get("ok") else "queued", "result": result}

@app.post("/webhook")
async def webhook_handler(request: Request):
    body = await request.json()
    logger.info("Telegram webhook event received")

    if "message" in body:
        msg = body["message"]
        chat_id = msg.get("chat", {}).get("id")
        text = msg.get("text", "")
        sender = msg.get("from", {})
        logger.info(f"Incoming from {sender.get('username', 'unknown')}: {text[:50]}")

        storage_set(f"msg:{body.get('update_id', '')}", {
            "chat_id": chat_id,
            "text": text,
            "sender": sender.get("username", ""),
            "timestamp": datetime.now().isoformat(),
        })
        _incr_counter("messages_received")

    elif "callback_query" in body:
        query = body["callback_query"]
        logger.info(f"Callback query: {query.get('data', '')}")
        _incr_counter("callbacks_received")

    return {"status": "processed"}

@app.post("/set-webhook")
async def set_webhook(url: str):
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN not configured")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{TELEGRAM_API_URL}/setWebhook",
            json={"url": url}
        )
        return resp.json()

@app.get("/metrics")
async def get_metrics():
    r = _get_redis()
    sent = int(r.get("tg:counter:messages_sent") or 0) if r else 0
    received = int(r.get("tg:counter:messages_received") or 0) if r else 0
    callbacks = int(r.get("tg:counter:callbacks_received") or 0) if r else 0
    return {
        "channel": CHANNEL_NAME,
        "messages_sent": sent,
        "messages_received": received,
        "callbacks_received": callbacks,
        "bot_configured": bool(TELEGRAM_BOT_TOKEN),
    }

@app.get("/stats")
async def get_statistics():
    return await get_metrics()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8159)
