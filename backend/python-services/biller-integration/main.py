"""
Biller Integration Service
Utility bill payment integration for Agent Banking Platform

Features:
- Electricity bill payments (AEDC, IKEDC, EKEDC, etc.)
- Water bill payments
- Internet/Cable TV (DSTV, GOtv, Startimes)
- Verification and payment processing
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import asyncpg
import httpx
import os
import logging
from decimal import Decimal

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/billers")
BAXI_API_KEY = os.getenv("BAXI_API_KEY", "")
BAXI_API_URL = os.getenv("BAXI_API_URL", "https://api.baxipay.com.ng/api/baxipay")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Biller Integration Service", version="1.0.0")
security = HTTPBearer()
db_pool = None

class BillerCategory(str, Enum):
    ELECTRICITY = "electricity"
    WATER = "water"
    INTERNET = "internet"
    CABLE_TV = "cable_tv"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESSFUL = "successful"
    FAILED = "failed"

class BillerPayment(BaseModel):
    customer_id: str = Field(..., description="Customer meter/account number")
    biller_code: str = Field(..., description="Biller service code")
    amount: Decimal
    customer_phone: str
    customer_email: Optional[str] = None

class PaymentResponse(BaseModel):
    id: str
    transaction_ref: str
    status: PaymentStatus
    amount: Decimal
    customer_id: str
    biller_code: str
    created_at: datetime
    token: Optional[str] = None

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS biller_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                transaction_ref VARCHAR(100) UNIQUE NOT NULL,
                customer_id VARCHAR(100) NOT NULL,
                biller_code VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                customer_phone VARCHAR(20) NOT NULL,
                customer_email VARCHAR(100),
                token TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMP,
                metadata JSONB DEFAULT '{}'
            );
            CREATE INDEX IF NOT EXISTS idx_biller_status ON biller_payments(status);
            CREATE INDEX IF NOT EXISTS idx_biller_customer ON biller_payments(customer_id);
        """)
    logger.info("Biller Integration Service started")

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()

async def verify_customer(customer_id: str, biller_code: str) -> Dict[str, Any]:
    """Verify customer with biller"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BAXI_API_URL}/superagent/transaction/verify",
                headers={"x-api-key": BAXI_API_KEY},
                json={
                    "service_type": biller_code,
                    "account_number": customer_id
                }
            )
            data = response.json()
            return data.get("data", {})
        except Exception as e:
            logger.error(f"Customer verification failed: {e}")
            return {}

@app.post("/verify")
async def verify_customer_endpoint(customer_id: str, biller_code: str):
    """Verify customer account with biller"""
    result = await verify_customer(customer_id, biller_code)
    if not result:
        raise HTTPException(status_code=400, detail="Customer verification failed")
    return result

@app.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: BillerPayment):
    """Process biller payment"""
    
    # Verify customer first
    customer_info = await verify_customer(payment.customer_id, payment.biller_code)
    if not customer_info:
        raise HTTPException(status_code=400, detail="Invalid customer ID")
    
    # Generate transaction reference
    import uuid
    transaction_ref = f"BILL{uuid.uuid4().hex[:12].upper()}"
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO biller_payments (
                transaction_ref, customer_id, biller_code, amount, 
                customer_phone, customer_email, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'processing')
            RETURNING *
        """, transaction_ref, payment.customer_id, payment.biller_code,
            payment.amount, payment.customer_phone, payment.customer_email)
        
        # Process payment with Baxi API
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{BAXI_API_URL}/superagent/transaction/process",
                    headers={"x-api-key": BAXI_API_KEY},
                    json={
                        "service_type": payment.biller_code,
                        "account_number": payment.customer_id,
                        "amount": float(payment.amount),
                        "phone": payment.customer_phone,
                        "agentReference": transaction_ref
                    }
                )
                result = response.json()
                
                if result.get("status") == "success":
                    token = result.get("data", {}).get("token")
                    await conn.execute("""
                        UPDATE biller_payments 
                        SET status = 'successful', token = $1, completed_at = NOW()
                        WHERE transaction_ref = $2
                    """, token, transaction_ref)
                    
                    return PaymentResponse(**dict(row), token=token, status=PaymentStatus.SUCCESSFUL)
                else:
                    await conn.execute("""
                        UPDATE biller_payments SET status = 'failed'
                        WHERE transaction_ref = $1
                    """, transaction_ref)
                    raise HTTPException(status_code=400, detail="Payment processing failed")
                    
            except Exception as e:
                logger.error(f"Payment processing error: {e}")
                await conn.execute("""
                    UPDATE biller_payments SET status = 'failed'
                    WHERE transaction_ref = $1
                """, transaction_ref)
                raise HTTPException(status_code=500, detail=str(e))

@app.get("/payments/{transaction_ref}", response_model=PaymentResponse)
async def get_payment(transaction_ref: str):
    """Get payment status"""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM biller_payments WHERE transaction_ref = $1
        """, transaction_ref)
        
        if not row:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        return PaymentResponse(**dict(row))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "biller-integration"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8104)
