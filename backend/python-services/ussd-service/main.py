import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))

from fastapi import FastAPI, HTTPException, Request
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

CHANNEL_NAME = "ussd"
REDIS_URL = os.getenv("REDIS_URL", "")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")

app = FastAPI(
    title="USSD Service",
    description="USSD interactive menu service for Agent Banking (feature phones)",
    version="2.0.0"
)

from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
apply_middleware(app)
setup_logging("ussd-service")
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

def _get_session(session_id: str) -> dict:
    r = _get_redis()
    if r:
        try:
            data = r.get(f"ussd:session:{session_id}")
            if data:
                r.expire(f"ussd:session:{session_id}", 300)
                return json.loads(data)
        except Exception:
            pass
    return {"state": "main_menu", "data": {}, "history": []}

def _save_session(session_id: str, session: dict):
    r = _get_redis()
    if r:
        try:
            r.setex(f"ussd:session:{session_id}", 300, json.dumps(session, default=str))
        except Exception:
            pass

def _incr_counter(name: str) -> int:
    r = _get_redis()
    if r:
        return r.incr(f"ussd:counter:{name}")
    return 0


class USSDRequest(BaseModel):
    sessionId: str
    serviceCode: str
    phoneNumber: str
    text: str


MAIN_MENU = (
    "CON Welcome to Agent Banking\n"
    "1. Check Balance\n"
    "2. Transfer Money\n"
    "3. View Orders\n"
    "4. Mini Statement\n"
    "5. Customer Support\n"
    "0. Exit"
)


async def _handle_ussd_input(session_id: str, phone: str, text: str) -> str:
    _incr_counter("requests")
    session = _get_session(session_id)
    state = session.get("state", "main_menu")
    parts = text.split("*") if text else []
    current_input = parts[-1] if parts else ""

    if not text or text == "":
        session["state"] = "main_menu"
        _save_session(session_id, session)
        return MAIN_MENU

    if state == "main_menu":
        if current_input == "1":
            session["state"] = "enter_pin"
            session["data"]["action"] = "balance"
            _save_session(session_id, session)
            return "CON Enter your 4-digit PIN:"
        elif current_input == "2":
            session["state"] = "transfer_recipient"
            _save_session(session_id, session)
            return "CON Enter recipient phone number:"
        elif current_input == "3":
            session["state"] = "main_menu"
            _save_session(session_id, session)
            return "END Order viewing requires PIN. Feature coming soon."
        elif current_input == "4":
            session["state"] = "enter_pin"
            session["data"]["action"] = "statement"
            _save_session(session_id, session)
            return "CON Enter your 4-digit PIN:"
        elif current_input == "5":
            return (
                "END Customer Support\n"
                "Call: 0800-AGENT-BANK\n"
                "SMS: HELP to 33033\n"
                "WhatsApp: +234 803 123 4567"
            )
        elif current_input == "0":
            return "END Thank you for using Agent Banking."
        else:
            return "CON Invalid option.\n" + MAIN_MENU

    elif state == "enter_pin":
        action = session.get("data", {}).get("action", "")
        if len(current_input) == 4 and current_input.isdigit():
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        f"{API_BASE_URL}/auth/verify-pin",
                        json={"phone": phone, "pin": current_input}
                    )
                    if resp.status_code == 200 and resp.json().get("valid"):
                        if action == "balance":
                            bal_resp = await client.get(
                                f"{API_BASE_URL}/accounts/balance",
                                params={"phone": phone}
                            )
                            if bal_resp.status_code == 200:
                                bal = bal_resp.json()
                                return f"END Your Balance\nNGN {bal.get('balance', 0):,.2f}\nAvailable: NGN {bal.get('available_balance', 0):,.2f}"
                            return "END Unable to fetch balance. Try again later."
                        elif action == "statement":
                            stmt_resp = await client.get(
                                f"{API_BASE_URL}/transactions/mini-statement",
                                params={"phone": phone, "limit": 5}
                            )
                            if stmt_resp.status_code == 200:
                                txns = stmt_resp.json().get("transactions", [])
                                if not txns:
                                    return "END No recent transactions."
                                lines = "END Mini Statement\n"
                                for t in txns[:5]:
                                    lines += f"{t.get('date','')}: {t.get('type','')}: NGN {t.get('amount', 0):,.0f}\n"
                                return lines
                            return "END Unable to fetch statement. Try again later."
                    else:
                        return "END Invalid PIN. Please try again."
            except Exception as e:
                logger.error(f"USSD API call error: {e}")
                return "END Service temporarily unavailable."
        else:
            return "CON Invalid PIN format. Enter 4 digits:"

    elif state == "transfer_recipient":
        if len(current_input) >= 10 and current_input.isdigit():
            session["state"] = "transfer_amount"
            session["data"]["recipient"] = current_input
            _save_session(session_id, session)
            return "CON Enter amount to transfer (NGN):"
        else:
            return "CON Invalid phone number. Enter recipient phone:"

    elif state == "transfer_amount":
        try:
            amount = float(current_input)
            if amount <= 0:
                return "CON Amount must be positive. Enter amount:"
            session["state"] = "transfer_pin"
            session["data"]["amount"] = amount
            _save_session(session_id, session)
            recipient = session["data"].get("recipient", "")
            return f"CON Transfer NGN {amount:,.2f} to {recipient}\nEnter PIN to confirm:"
        except ValueError:
            return "CON Invalid amount. Enter amount (NGN):"

    elif state == "transfer_pin":
        if len(current_input) == 4 and current_input.isdigit():
            recipient = session["data"].get("recipient", "")
            amount = session["data"].get("amount", 0)
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        f"{API_BASE_URL}/transfers",
                        json={
                            "sender_phone": phone,
                            "recipient_phone": recipient,
                            "amount": amount,
                            "pin": current_input,
                            "channel": "ussd"
                        }
                    )
                    if resp.status_code == 200 and resp.json().get("success"):
                        _incr_counter("transfers")
                        return f"END Transfer successful!\nNGN {amount:,.2f} sent to {recipient}"
                    else:
                        error = resp.json().get("error", "Transfer failed")
                        return f"END {error}"
            except Exception as e:
                logger.error(f"Transfer API error: {e}")
                return "END Transfer service unavailable. Try again later."
        else:
            return "CON Invalid PIN. Enter 4-digit PIN:"

    return "END Session expired. Dial again to start."


@app.get("/")
async def root():
    return {
        "service": "ussd-service",
        "channel": CHANNEL_NAME,
        "version": "2.0.0",
        "status": "operational",
    }

@app.get("/health")
async def health_check():
    r = _get_redis()
    return {
        "status": "healthy",
        "service": "ussd-service",
        "redis": "connected" if r else "not_configured",
    }

@app.post("/ussd/callback")
async def ussd_callback(req: USSDRequest):
    response_text = await _handle_ussd_input(req.sessionId, req.phoneNumber, req.text)
    return response_text

@app.post("/process")
async def process_ussd(req: USSDRequest):
    return await ussd_callback(req)

@app.get("/metrics")
async def get_metrics():
    r = _get_redis()
    requests = int(r.get("ussd:counter:requests") or 0) if r else 0
    transfers = int(r.get("ussd:counter:transfers") or 0) if r else 0
    return {
        "channel": CHANNEL_NAME,
        "total_requests": requests,
        "total_transfers": transfers,
    }

@app.get("/stats")
async def get_statistics():
    return await get_metrics()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8141)
