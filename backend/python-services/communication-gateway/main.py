import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
"""
Communication Gateway Service
Unified omni-channel message routing across WhatsApp, Telegram, USSD, SMS
Port: 8115
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uvicorn
import os
import json
import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:8140")
TELEGRAM_SERVICE_URL = os.getenv("TELEGRAM_SERVICE_URL", "http://localhost:8159")
USSD_SERVICE_URL = os.getenv("USSD_SERVICE_URL", "http://localhost:8141")
SMS_GATEWAY_URL = os.getenv("SMS_GATEWAY_URL", "http://localhost:8142")

app = FastAPI(
    title="Communication Gateway",
    description="Unified omni-channel message routing for Agent Banking",
    version="2.0.0"
)

from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
apply_middleware(app)
setup_logging("communication-gateway")
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


CHANNEL_URLS = {
    "whatsapp": WHATSAPP_SERVICE_URL,
    "telegram": TELEGRAM_SERVICE_URL,
    "ussd": USSD_SERVICE_URL,
    "sms": SMS_GATEWAY_URL,
}


class SendRequest(BaseModel):
    channel: str
    recipient: str
    content: str
    metadata: Optional[Dict[str, Any]] = None


class ConversationContext(BaseModel):
    user_id: str
    channel: str


async def _route_to_channel(channel: str, endpoint: str, payload: dict) -> dict:
    base_url = CHANNEL_URLS.get(channel)
    if not base_url:
        raise HTTPException(status_code=400, detail=f"Unknown channel: {channel}")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(f"{base_url}{endpoint}", json=payload)
        if resp.status_code < 300:
            return resp.json()
        raise HTTPException(status_code=resp.status_code, detail=resp.text[:500])


@app.get("/")
async def root():
    return {
        "service": "communication-gateway",
        "version": "2.0.0",
        "channels": list(CHANNEL_URLS.keys()),
        "status": "operational",
    }

@app.get("/health")
async def health_check():
    channel_health = {}
    for ch, url in CHANNEL_URLS.items():
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{url}/health")
                channel_health[ch] = "healthy" if resp.status_code == 200 else "degraded"
        except Exception:
            channel_health[ch] = "unreachable"
    return {"status": "healthy", "channels": channel_health}

@app.post("/send")
async def send_message(req: SendRequest):
    channel = req.channel.lower()
    r = _get_redis()

    if channel == "whatsapp":
        result = await _route_to_channel("whatsapp", "/send", {
            "recipient": req.recipient, "content": req.content, "message_type": "text"
        })
    elif channel == "telegram":
        result = await _route_to_channel("telegram", "/send", {
            "chat_id": int(req.recipient), "text": req.content
        })
    elif channel == "sms":
        result = await _route_to_channel("sms", "/api/v1/sms-gateway/send", {
            "recipient": req.recipient, "message": req.content
        })
    elif channel == "ussd":
        raise HTTPException(status_code=400, detail="USSD is pull-based; use /ussd/callback instead")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported channel: {channel}")

    if r:
        r.incr(f"gateway:sent:{channel}")
        r.lpush(f"gateway:conversation:{req.recipient}", json.dumps({
            "channel": channel, "direction": "outbound", "content": req.content,
            "timestamp": datetime.utcnow().isoformat()
        }, default=str))
        r.ltrim(f"gateway:conversation:{req.recipient}", 0, 99)

    return {"status": "sent", "channel": channel, "result": result}

@app.get("/conversation/{user_id}")
async def get_conversation(user_id: str, limit: int = 20):
    r = _get_redis()
    if not r:
        return {"messages": [], "note": "Redis not configured"}
    raw = r.lrange(f"gateway:conversation:{user_id}", 0, limit - 1)
    messages = [json.loads(m) for m in raw]
    return {"user_id": user_id, "messages": messages, "total": len(messages)}

@app.get("/channels")
async def list_channels():
    return {"channels": [
        {"name": "whatsapp", "url": WHATSAPP_SERVICE_URL, "protocol": "Meta Cloud API"},
        {"name": "telegram", "url": TELEGRAM_SERVICE_URL, "protocol": "Telegram Bot API"},
        {"name": "ussd", "url": USSD_SERVICE_URL, "protocol": "USSD Gateway (pull)"},
        {"name": "sms", "url": SMS_GATEWAY_URL, "protocol": "Africa's Talking / Twilio"},
    ]}

@app.get("/metrics")
async def get_metrics():
    r = _get_redis()
    if not r:
        return {"channels": {}}
    metrics = {}
    for ch in CHANNEL_URLS:
        metrics[ch] = int(r.get(f"gateway:sent:{ch}") or 0)
    return {"messages_sent": metrics}

@app.get("/stats")
async def get_statistics():
    return await get_metrics()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8115)
