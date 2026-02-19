"""
Agent Commerce Integration Service
E-commerce platform integration for agents

Features:
- Product catalog management
- Order processing
- Inventory tracking
- Commission calculation
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum
import asyncpg
import os
import logging
from decimal import Decimal

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/commerce")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Agent Commerce Integration Service", version="1.0.0")
db_pool = None

class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class Product(BaseModel):
    id: str
    name: str
    price: Decimal
    stock: int

class Order(BaseModel):
    agent_id: str
    product_id: str
    quantity: int
    customer_phone: str

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(200) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                stock INT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agent_id VARCHAR(100) NOT NULL,
                product_id UUID NOT NULL,
                quantity INT NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                customer_phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT NOW()
            );
        """)
    logger.info("Agent Commerce Integration Service started")

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()

@app.get("/products", response_model=List[Product])
async def list_products():
    """List available products"""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM products LIMIT 50")
        return [Product(**dict(row)) for row in rows]

@app.post("/orders")
async def create_order(order: Order):
    """Create new order"""
    async with db_pool.acquire() as conn:
        product = await conn.fetchrow("SELECT * FROM products WHERE id = $1", order.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        total = Decimal(product['price']) * order.quantity
        
        row = await conn.fetchrow("""
            INSERT INTO orders (agent_id, product_id, quantity, total_amount, customer_phone)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        """, order.agent_id, order.product_id, order.quantity, total, order.customer_phone)
        
        return {"order_id": str(row['id']), "total_amount": float(total), "status": "pending"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "agent-commerce-integration"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8211)
