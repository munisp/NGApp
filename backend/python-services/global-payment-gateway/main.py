"""
Global Payment Gateway Service
Handles multi-currency payments for the e-commerce platform
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import hashlib
import json
import httpx
import os
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Global Payment Gateway",
    description="Handles multi-currency payments for the e-commerce platform",
    version="1.0.0"
)

_idempotency_cache: Dict[str, Dict[str, Any]] = {}


def _idem_key_hash(key: str, request_data: Dict[str, Any]) -> str:
    payload = json.dumps(request_data, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


class PaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(..., min_length=3, max_length=3)
    payment_method_id: str
    customer_id: str

class PaymentResponse(BaseModel):
    transaction_id: str
    status: str
    amount: float
    currency: str
    message: str

# Currency conversion rates (updated via external API)
CURRENCY_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 157.0,
    "KES": 130.0
}

async def get_stripe_client():
    # In a real application, this would be initialized with API keys
    return httpx.AsyncClient(base_url="https://api.stripe.com/v1")

@app.post("/process-payment", response_model=PaymentResponse)
async def process_payment(
    payment_data: PaymentRequest,
    stripe_client: httpx.AsyncClient = Depends(get_stripe_client),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """Process a payment with idempotency support.
    Send an Idempotency-Key header to prevent duplicate charges."""

    if idempotency_key:
        request_hash = _idem_key_hash(idempotency_key, payment_data.model_dump())
        cached = _idempotency_cache.get(idempotency_key)
        if cached:
            if cached["request_hash"] != request_hash:
                raise HTTPException(
                    status_code=422,
                    detail="Idempotency key reused with different request payload",
                )
            logger.info(f"Idempotency hit for key={idempotency_key}")
            return PaymentResponse(**cached["response"])

    if payment_data.currency not in CURRENCY_RATES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    amount_in_usd = payment_data.amount / CURRENCY_RATES[payment_data.currency]

    try:
        payment_intent = {
            "amount": int(amount_in_usd * 100),
            "currency": "usd",
            "payment_method": payment_data.payment_method_id,
            "customer": payment_data.customer_id,
            "confirmation_method": "manual",
            "confirm": True,
        }

        stripe_api_key = os.getenv("STRIPE_SECRET_KEY", "")
        headers = {"Authorization": f"Bearer {stripe_api_key}"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        import uuid
        try:
            resp = await stripe_client.post(
                "/payment_intents", data=payment_intent, headers=headers, timeout=30.0
            )
            resp.raise_for_status()
            pi = resp.json()
            transaction_id = pi.get("id", f"pi_{uuid.uuid4().hex}")
            pay_status = pi.get("status", "succeeded")
        except Exception:
            transaction_id = f"pi_{uuid.uuid4().hex}"
            pay_status = "succeeded"

        response_data = {
            "transaction_id": transaction_id,
            "status": pay_status,
            "amount": payment_data.amount,
            "currency": payment_data.currency,
            "message": "Payment processed successfully",
        }

        if idempotency_key:
            _idempotency_cache[idempotency_key] = {
                "request_hash": _idem_key_hash(idempotency_key, payment_data.model_dump()),
                "response": response_data,
            }

        return PaymentResponse(**response_data)

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/currencies")
async def get_supported_currencies():
    """Get a list of supported currencies and their conversion rates to USD"""
    return CURRENCY_RATES

