import sys as _sys, os as _os
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), ".."))
from shared.middleware import apply_middleware, ErrorResponse
from shared.observability import setup_logging, get_logger, metrics_router, MetricsMiddleware
"""
E-commerce Integration Service
Connects e-commerce platform with QR codes, payments, inventory, and WhatsApp
Port: 8012
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

apply_middleware(app)
setup_logging("e-commerce-integration-service")
app.include_router(metrics_router)

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid
import httpx
import os

app = FastAPI(
    title="E-commerce Integration Service",
    description="Integrates e-commerce with QR codes, payments, inventory, and WhatsApp",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS","http://localhost:5173,http://localhost:5174,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
QR_CODE_SERVICE_URL = os.getenv("QR_CODE_SERVICE_URL", "http://localhost:8032")
PAYMENT_GATEWAY_URL = os.getenv("PAYMENT_GATEWAY_URL", "http://localhost:8015")
INVENTORY_SERVICE_URL = os.getenv("INVENTORY_SERVICE_URL", "http://localhost:8020")
ECOMMERCE_SERVICE_URL = os.getenv("ECOMMERCE_SERVICE_URL", "http://localhost:8010")
ENHANCED_ECOMMERCE_URL = os.getenv("ENHANCED_ECOMMERCE_URL", "http://localhost:8011")
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://graph.facebook.com/v18.0")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")

# ==================== PYDANTIC MODELS ====================

class OrderCheckoutRequest(BaseModel):
    """Complete order checkout with payment"""
    order_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    delivery_address: str
    payment_method: str  # qr_code, mobile_money, cash_on_delivery
    items: List[Dict[str, Any]]
    subtotal: Decimal
    delivery_fee: Decimal
    discount: Decimal
    total: Decimal
    coupon_code: Optional[str] = None

class QRPaymentRequest(BaseModel):
    """Generate QR code for order payment"""
    order_id: str
    amount: Decimal
    currency: str = "NGN"
    description: str

class InventorySyncRequest(BaseModel):
    """Sync inventory after order"""
    store_id: str
    items: List[Dict[str, Any]]  # [{product_id, variant_id, quantity}]

class WhatsAppNotification(BaseModel):
    """Send WhatsApp notification"""
    phone_number: str
    message_type: str  # order_confirmation, shipping_update, delivery_confirmation
    order_details: Dict[str, Any]

# ==================== HELPER FUNCTIONS ====================

async def call_service(url: str, method: str = "GET", data: Optional[Dict] = None):
    """Generic service caller"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "GET":
                response = await client.get(url)
            elif method == "POST":
                response = await client.post(url, json=data)
            elif method == "PUT":
                response = await client.put(url, json=data)
            elif method == "DELETE":
                response = await client.delete(url)
            
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Service error: {response.text}"
                )
            
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")

async def generate_qr_code_for_order(order_id: str, amount: Decimal, currency: str, description: str):
    """Generate QR code for order payment"""
    qr_data = {
        "qr_type": "payment",
        "amount": float(amount),
        "currency": currency,
        "description": description,
        "metadata": {
            "order_id": order_id,
            "payment_type": "order_payment"
        }
    }
    
    return await call_service(
        f"{QR_CODE_SERVICE_URL}/qr/generate",
        method="POST",
        data=qr_data
    )

async def process_payment(order_id: str, amount: Decimal, payment_method: str, customer_info: Dict):
    """Process payment through payment gateway"""
    payment_data = {
        "order_id": order_id,
        "amount": float(amount),
        "currency": "NGN",
        "payment_method": payment_method,
        "customer_name": customer_info.get("name"),
        "customer_phone": customer_info.get("phone"),
        "customer_email": customer_info.get("email")
    }
    
    return await call_service(
        f"{PAYMENT_GATEWAY_URL}/payments/process",
        method="POST",
        data=payment_data
    )

async def update_inventory(store_id: str, items: List[Dict]):
    """Update inventory after order"""
    inventory_updates = []
    
    for item in items:
        update = {
            "product_id": item["product_id"],
            "variant_id": item.get("variant_id"),
            "quantity_change": -item["quantity"],  # Negative for reduction
            "reason": "order_placed",
            "reference_id": item.get("order_id")
        }
        inventory_updates.append(update)
    
    return await call_service(
        f"{INVENTORY_SERVICE_URL}/inventory/bulk-update",
        method="POST",
        data={"store_id": store_id, "updates": inventory_updates}
    )

async def send_whatsapp_notification(phone_number: str, message: str):
    """Send WhatsApp message"""
    if not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        print("WhatsApp not configured, skipping notification")
        return {"status": "skipped", "reason": "not_configured"}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{WHATSAPP_API_URL}/{WHATSAPP_PHONE_ID}/messages",
                headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_number,
                    "type": "text",
                    "text": {"body": message}
                }
            )
            return {"status": "sent", "response": response.json()}
    except Exception as e:
        print(f"WhatsApp error: {str(e)}")
        return {"status": "failed", "error": str(e)}

def format_order_confirmation_message(order_details: Dict) -> str:
    """Format order confirmation message"""
    items_text = "\n".join([
        f"• {item['product_name']} x{item['quantity']} - {item['currency']} {item['subtotal']}"
        for item in order_details['items']
    ])
    
    return f"""
🎉 Order Confirmed!

Order ID: {order_details['order_id']}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}

Items:
{items_text}

Subtotal: {order_details['currency']} {order_details['subtotal']}
Delivery: {order_details['currency']} {order_details['delivery_fee']}
Discount: {order_details['currency']} {order_details['discount']}
Total: {order_details['currency']} {order_details['total']}

Delivery Address:
{order_details['delivery_address']}

Payment Method: {order_details['payment_method']}

Thank you for shopping with us! We'll notify you when your order is shipped.
    """.strip()

def format_shipping_update_message(order_details: Dict) -> str:
    """Format shipping update message"""
    return f"""
📦 Your Order is On The Way!

Order ID: {order_details['order_id']}

Your order has been shipped and is on its way to you.

Tracking: {order_details.get('tracking_number', 'N/A')}
Expected Delivery: {order_details.get('expected_delivery', 'Soon')}

Delivery Address:
{order_details['delivery_address']}

Thank you for your patience!
    """.strip()

# ==================== ENDPOINTS ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check connectivity to other services
    services_status = {}
    
    try:
        qr_health = await call_service(f"{QR_CODE_SERVICE_URL}/health")
        services_status["qr_code_service"] = "healthy"
    except:
        services_status["qr_code_service"] = "unavailable"
    
    try:
        payment_health = await call_service(f"{PAYMENT_GATEWAY_URL}/health")
        services_status["payment_gateway"] = "healthy"
    except:
        services_status["payment_gateway"] = "unavailable"
    
    return {
        "status": "healthy",
        "service": "ecommerce-integration",
        "version": "1.0.0",
        "services": services_status,
        "features": [
            "qr_code_generation",
            "payment_processing",
            "inventory_sync",
            "whatsapp_notifications"
        ]
    }

@app.post("/checkout/complete")
async def complete_checkout(
    checkout_request: OrderCheckoutRequest,
    background_tasks: BackgroundTasks
):
    """
    Complete checkout process:
    1. Generate QR code for payment (if needed)
    2. Process payment
    3. Update inventory
    4. Send WhatsApp confirmation
    """
    
    order_id = checkout_request.order_id
    
    # Step 1: Generate QR code if payment method is QR
    qr_code_data = None
    if checkout_request.payment_method == "qr_code":
        try:
            qr_code_data = await generate_qr_code_for_order(
                order_id=order_id,
                amount=checkout_request.total,
                currency="NGN",
                description=f"Payment for Order {order_id}"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"QR code generation failed: {str(e)}")
    
    # Step 2: Process payment (skip for cash on delivery)
    payment_result = None
    if checkout_request.payment_method != "cash_on_delivery":
        try:
            payment_result = await process_payment(
                order_id=order_id,
                amount=checkout_request.total,
                payment_method=checkout_request.payment_method,
                customer_info={
                    "name": checkout_request.customer_name,
                    "phone": checkout_request.customer_phone,
                    "email": checkout_request.customer_email
                }
            )
        except Exception as e:
            # Payment failed, but we can still create the order as pending
            payment_result = {"status": "pending", "error": str(e)}
    
    # Step 3: Update inventory in background
    background_tasks.add_task(
        update_inventory,
        store_id=checkout_request.items[0].get("store_id", "default"),
        items=checkout_request.items
    )
    
    # Step 4: Send WhatsApp confirmation in background
    order_details = {
        "order_id": order_id,
        "items": checkout_request.items,
        "subtotal": checkout_request.subtotal,
        "delivery_fee": checkout_request.delivery_fee,
        "discount": checkout_request.discount,
        "total": checkout_request.total,
        "currency": "NGN",
        "delivery_address": checkout_request.delivery_address,
        "payment_method": checkout_request.payment_method
    }
    
    confirmation_message = format_order_confirmation_message(order_details)
    background_tasks.add_task(
        send_whatsapp_notification,
        phone_number=checkout_request.customer_phone,
        message=confirmation_message
    )
    
    return {
        "success": True,
        "order_id": order_id,
        "qr_code": qr_code_data,
        "payment": payment_result,
        "message": "Order placed successfully! You'll receive a WhatsApp confirmation shortly."
    }

@app.post("/orders/{order_id}/generate-qr")
async def generate_order_qr(order_id: str, qr_request: QRPaymentRequest):
    """Generate QR code for existing order"""
    
    try:
        qr_code_data = await generate_qr_code_for_order(
            order_id=order_id,
            amount=qr_request.amount,
            currency=qr_request.currency,
            description=qr_request.description
        )
        
        return {
            "success": True,
            "order_id": order_id,
            "qr_code": qr_code_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR generation failed: {str(e)}")

@app.post("/orders/{order_id}/notify-shipping")
async def notify_shipping(
    order_id: str,
    notification: WhatsAppNotification,
    background_tasks: BackgroundTasks
):
    """Send shipping notification to customer"""
    
    message = format_shipping_update_message(notification.order_details)
    
    background_tasks.add_task(
        send_whatsapp_notification,
        phone_number=notification.phone_number,
        message=message
    )
    
    return {
        "success": True,
        "message": "Shipping notification queued"
    }

@app.post("/inventory/sync")
async def sync_inventory(sync_request: InventorySyncRequest):
    """Manually sync inventory"""
    
    try:
        result = await update_inventory(
            store_id=sync_request.store_id,
            items=sync_request.items
        )
        
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inventory sync failed: {str(e)}")

@app.post("/products/{product_id}/generate-qr")
async def generate_product_qr(product_id: str):
    """Generate QR code for product page"""
    
    try:
        qr_data = {
            "qr_type": "product",
            "product_id": product_id,
            "metadata": {
                "type": "product_link",
                "url": f"https://shop.example.com/product/{product_id}"
            }
        }
        
        qr_code_data = await call_service(
            f"{QR_CODE_SERVICE_URL}/qr/generate",
            method="POST",
            data=qr_data
        )
        
        return {
            "success": True,
            "product_id": product_id,
            "qr_code": qr_code_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR generation failed: {str(e)}")

@app.post("/stores/{store_id}/generate-qr")
async def generate_store_qr(store_id: str):
    """Generate QR code for store homepage"""
    
    try:
        # Get store details
        store_data = await call_service(f"{ECOMMERCE_SERVICE_URL}/stores/{store_id}")
        
        qr_data = {
            "qr_type": "store",
            "store_id": store_id,
            "metadata": {
                "type": "store_link",
                "store_name": store_data.get("store_name"),
                "url": f"https://shop.example.com/{store_data.get('store_url')}"
            }
        }
        
        qr_code_data = await call_service(
            f"{QR_CODE_SERVICE_URL}/qr/generate",
            method="POST",
            data=qr_data
        )
        
        return {
            "success": True,
            "store_id": store_id,
            "qr_code": qr_code_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR generation failed: {str(e)}")

@app.get("/orders/{order_id}/status")
async def get_order_status(order_id: str):
    """Get comprehensive order status including payment and inventory"""
    
    try:
        # Get order details from e-commerce service
        order_data = await call_service(f"{ECOMMERCE_SERVICE_URL}/orders/{order_id}")
        
        # Get payment status
        payment_status = None
        try:
            payment_status = await call_service(f"{PAYMENT_GATEWAY_URL}/payments/order/{order_id}")
        except:
            payment_status = {"status": "unknown"}
        
        # Get inventory status for order items
        inventory_status = []
        for item in order_data.get("items", []):
            try:
                inv_data = await call_service(
                    f"{INVENTORY_SERVICE_URL}/inventory/product/{item['product_id']}"
                )
                inventory_status.append({
                    "product_id": item["product_id"],
                    "available": inv_data.get("quantity", 0)
                })
            except:
                inventory_status.append({
                    "product_id": item["product_id"],
                    "available": "unknown"
                })
        
        return {
            "order": order_data,
            "payment": payment_status,
            "inventory": inventory_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get order status: {str(e)}")

@app.post("/campaigns/{campaign_id}/apply")
async def apply_campaign_to_cart(
    campaign_id: str,
    cart_total: Decimal
):
    """Apply marketing campaign discount to cart"""
    
    try:
        discount_data = await call_service(
            f"{ENHANCED_ECOMMERCE_URL}/stores/default/campaigns/{campaign_id}/apply",
            method="POST",
            data={"cart_total": float(cart_total)}
        )
        
        return discount_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply campaign: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)

