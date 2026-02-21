"""
Global Payment Gateway Service
Handles multi-currency payments for the e-commerce platform
"""

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any
import httpx

app = FastAPI(
    title="Global Payment Gateway",
    description="Handles multi-currency payments for the e-commerce platform",
    version="1.0.0"
)

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
    stripe_client: httpx.AsyncClient = Depends(get_stripe_client)
):
    """Process a payment through a global payment provider (e.g., Stripe)"""
    
    # Convert amount to USD for processing
    if payment_data.currency not in CURRENCY_RATES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    
    amount_in_usd = payment_data.amount / CURRENCY_RATES[payment_data.currency]
    
    try:
        # Create Stripe payment intent
        # In a real implementation, you would use the Stripe SDK
        payment_intent = {
            "amount": int(amount_in_usd * 100),  # Stripe expects amount in cents
            "currency": "usd",
            "payment_method": payment_data.payment_method_id,
            "customer": payment_data.customer_id,
            "confirmation_method": "manual",
            "confirm": True,
        }

        # Execute Stripe API call
        # response = await stripe_client.post("/payment_intents", json=payment_intent)
        # response.raise_for_status()
        # payment_intent_response = response.json()

        # Process Stripe response
        import uuid
        transaction_id = f"pi_{uuid.uuid4().hex}"
        status = "succeeded"
        message = "Payment processed successfully"

        return PaymentResponse(
            transaction_id=transaction_id,
            status=status,
            amount=payment_data.amount,
            currency=payment_data.currency,
            message=message
        )

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/currencies")
async def get_supported_currencies():
    """Get a list of supported currencies and their conversion rates to USD"""
    return CURRENCY_RATES

