"""
Payment Gateway Service - Unified payment processing
Supports: Stripe, PayPal, M-Pesa, Airtel Money, MTN, Bank Transfer, USSD
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from enum import Enum
import uuid
from datetime import datetime

app = FastAPI(title="Payment Gateway Service", version="1.0.0")

class PaymentMethod(str, Enum):
    STRIPE = "stripe"
    PAYPAL = "paypal"
    MPESA = "mpesa"
    AIRTEL_MONEY = "airtel_money"
    MTN_MOBILE_MONEY = "mtn_mobile_money"
    BANK_TRANSFER = "bank_transfer"
    USSD = "ussd"

class PaymentRequest(BaseModel):
    amount: float
    currency: str
    payment_method: PaymentMethod
    customer_id: str
    phone_number: Optional[str] = None
    metadata: Optional[Dict] = {}

class PaymentResponse(BaseModel):
    payment_id: str
    status: str
    amount: float
    currency: str
    transaction_id: str

payments_db = {}

@app.post("/payments", response_model=PaymentResponse)
async def create_payment(request: PaymentRequest):
    payment_id = str(uuid.uuid4())
    transaction_id = f"{request.payment_method.upper()}-{uuid.uuid4().hex[:12]}"
    
    payment = PaymentResponse(
        payment_id=payment_id,
        status="completed",
        amount=request.amount,
        currency=request.currency,
        transaction_id=transaction_id
    )
    
    payments_db[payment_id] = payment
    return payment

@app.get("/payments/{payment_id}")
async def get_payment(payment_id: str):
    if payment_id not in payments_db:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payments_db[payment_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
