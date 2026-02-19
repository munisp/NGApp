"""
USSD Service for Agent Banking Platform
Provides interactive menu system for feature phones
Supports balance inquiry, orders, products, and payments
"""

from fastapi import FastAPI, Request, Response
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
import logging
import json
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="USSD Service",
    description="Interactive USSD menus for feature phones",
    version="1.0.0"
)

# ============================================================================
# MODELS & ENUMS
# ============================================================================

class USSDRequest(BaseModel):
    sessionId: str
    serviceCode: str
    phoneNumber: str
    text: str

class MenuState(str, Enum):
    MAIN_MENU = "main_menu"
    CHECK_BALANCE = "check_balance"
    VIEW_ORDERS = "view_orders"
    VIEW_ORDER_DETAIL = "view_order_detail"
    BROWSE_PRODUCTS = "browse_products"
    VIEW_CATEGORY = "view_category"
    VIEW_PRODUCT = "view_product"
    MAKE_PAYMENT = "make_payment"
    CONFIRM_PAYMENT = "confirm_payment"
    CUSTOMER_SUPPORT = "customer_support"

# ============================================================================
# SESSION MANAGEMENT
# ============================================================================

class SessionManager:
    """Manage USSD session state"""
    
    def __init__(self):
        self.sessions = {}  # In production, use Redis
    
    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get session data"""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "state": MenuState.MAIN_MENU,
                "data": {},
                "history": [],
                "created_at": datetime.now()
            }
        return self.sessions[session_id]
    
    def update_session(self, session_id: str, state: MenuState, data: Dict[str, Any] = None):
        """Update session state"""
        session = self.get_session(session_id)
        session["history"].append(session["state"])
        session["state"] = state
        if data:
            session["data"].update(data)
    
    def go_back(self, session_id: str):
        """Go back to previous menu"""
        session = self.get_session(session_id)
        if session["history"]:
            session["state"] = session["history"].pop()
    
    def clear_session(self, session_id: str):
        """Clear session data"""
        if session_id in self.sessions:
            del self.sessions[session_id]

# ============================================================================
# MOCK DATA (Replace with actual API calls)
# ============================================================================

MOCK_USER_DATA = {
    "+254712345678": {
        "name": "John Doe",
        "balance": 25000,
        "currency": "KES"
    },
    "+234803555123": {
        "name": "Amina Ibrahim",
        "balance": 57290,
        "currency": "NGN"
    }
}

MOCK_ORDERS = [
    {
        "id": "ORD-001",
        "items": "Cooking Oil (5L) x2",
        "total": 17000,
        "currency": "NGN",
        "status": "pending"
    },
    {
        "id": "ORD-002",
        "items": "Premium Rice (50kg)",
        "total": 45000,
        "currency": "NGN",
        "status": "shipped"
    }
]

MOCK_CATEGORIES = [
    {"id": 1, "name": "Food & Groceries"},
    {"id": 2, "name": "Household"},
    {"id": 3, "name": "Personal Care"}
]

MOCK_PRODUCTS = {
    1: [  # Food & Groceries
        {"id": 101, "name": "Rice (50kg)", "price": 45000, "currency": "NGN"},
        {"id": 102, "name": "Cooking Oil (5L)", "price": 8500, "currency": "NGN"},
        {"id": 103, "name": "Sugar (2kg)", "price": 1800, "currency": "NGN"}
    ],
    2: [  # Household
        {"id": 201, "name": "Detergent (2kg)", "price": 3200, "currency": "NGN"},
        {"id": 202, "name": "Bathing Soap (12)", "price": 2400, "currency": "NGN"}
    ],
    3: [  # Personal Care
        {"id": 301, "name": "Toothpaste", "price": 500, "currency": "NGN"},
        {"id": 302, "name": "Body Lotion", "price": 1200, "currency": "NGN"}
    ]
}

# ============================================================================
# MENU BUILDERS
# ============================================================================

class MenuBuilder:
    """Build USSD menu responses"""
    
    @staticmethod
    def main_menu() -> str:
        """Main menu"""
        return (
            "CON Welcome to Mama Ada's Store\n"
            "1. Check Balance\n"
            "2. View Orders\n"
            "3. Browse Products\n"
            "4. Make Payment\n"
            "5. Customer Support\n"
            "0. Exit"
        )
    
    @staticmethod
    def check_balance(phone: str) -> str:
        """Display balance"""
        user = MOCK_USER_DATA.get(phone, {"balance": 0, "currency": "NGN"})
        return (
            f"END Your Balance\n"
            f"{user['currency']} {user['balance']:,.2f}\n\n"
            f"Thank you for using our service!"
        )
    
    @staticmethod
    def view_orders() -> str:
        """Display orders list"""
        if not MOCK_ORDERS:
            return "END You have no orders yet."
        
        menu = "CON Your Orders\n"
        for i, order in enumerate(MOCK_ORDERS[:5], 1):  # Show max 5
            menu += f"{i}. {order['id']}: {order['currency']} {order['total']:,.0f}\n"
        menu += "0. Back"
        return menu
    
    @staticmethod
    def view_order_detail(order_index: int) -> str:
        """Display order details"""
        if order_index < 0 or order_index >= len(MOCK_ORDERS):
            return "END Invalid order selection"
        
        order = MOCK_ORDERS[order_index]
        return (
            f"END Order Details\n"
            f"ID: {order['id']}\n"
            f"Items: {order['items']}\n"
            f"Total: {order['currency']} {order['total']:,.0f}\n"
            f"Status: {order['status'].upper()}"
        )
    
    @staticmethod
    def browse_products() -> str:
        """Display product categories"""
        menu = "CON Select Category\n"
        for i, cat in enumerate(MOCK_CATEGORIES, 1):
            menu += f"{i}. {cat['name']}\n"
        menu += "0. Back"
        return menu
    
    @staticmethod
    def view_category(category_id: int) -> str:
        """Display products in category"""
        products = MOCK_PRODUCTS.get(category_id, [])
        if not products:
            return "END No products in this category"
        
        menu = "CON Products\n"
        for i, product in enumerate(products, 1):
            menu += f"{i}. {product['name']} - {product['currency']} {product['price']:,.0f}\n"
        menu += "0. Back"
        return menu
    
    @staticmethod
    def view_product(category_id: int, product_index: int) -> str:
        """Display product details"""
        products = MOCK_PRODUCTS.get(category_id, [])
        if product_index < 0 or product_index >= len(products):
            return "END Invalid product selection"
        
        product = products[product_index]
        return (
            f"END {product['name']}\n"
            f"Price: {product['currency']} {product['price']:,.0f}\n\n"
            f"To order, call:\n"
            f"+234 803 123 4567"
        )
    
    @staticmethod
    def make_payment() -> str:
        """Payment entry"""
        return "CON Enter Order ID:"
    
    @staticmethod
    def confirm_payment(order_id: str) -> str:
        """Confirm payment"""
        # Find order
        order = next((o for o in MOCK_ORDERS if o["id"] == order_id.upper()), None)
        if not order:
            return "END Order not found. Please check the Order ID."
        
        return (
            f"CON Confirm Payment\n"
            f"Order: {order['id']}\n"
            f"Amount: {order['currency']} {order['total']:,.0f}\n\n"
            f"1. Confirm\n"
            f"2. Cancel"
        )
    
    @staticmethod
    def payment_success(order_id: str) -> str:
        """Payment success"""
        return (
            f"END Payment Successful!\n"
            f"Order {order_id} has been paid.\n\n"
            f"You will receive a confirmation via SMS."
        )
    
    @staticmethod
    def customer_support() -> str:
        """Customer support"""
        return (
            "END Customer Support\n\n"
            "Call: +234 803 123 4567\n"
            "Email: support@mamaada.com\n\n"
            "Hours: Mon-Sat 8AM-6PM"
        )
    
    @staticmethod
    def invalid_input() -> str:
        """Invalid input"""
        return "END Invalid input. Please try again."
    
    @staticmethod
    def exit_message() -> str:
        """Exit message"""
        return "END Thank you for using Mama Ada's Store!"

# ============================================================================
# USSD HANDLER
# ============================================================================

class USSDHandler:
    """Handle USSD requests and route to appropriate menus"""
    
    def __init__(self):
        self.session_manager = SessionManager()
        self.menu_builder = MenuBuilder()
    
    async def handle_request(self, ussd_request: USSDRequest) -> str:
        """Main request handler"""
        session_id = ussd_request.sessionId
        phone = ussd_request.phoneNumber
        text = ussd_request.text
        
        # Parse user input
        inputs = text.split("*") if text else []
        current_input = inputs[-1] if inputs else ""
        
        # Get session
        session = self.session_manager.get_session(session_id)
        current_state = session["state"]
        
        logger.info(f"USSD Request - Phone: {phone}, State: {current_state}, Input: {current_input}")
        
        # Route based on state
        if not text:
            # First interaction - show main menu
            return self.menu_builder.main_menu()
        
        # Main menu routing
        if current_state == MenuState.MAIN_MENU:
            return await self._handle_main_menu(session_id, current_input, phone)
        
        elif current_state == MenuState.VIEW_ORDERS:
            return await self._handle_view_orders(session_id, current_input)
        
        elif current_state == MenuState.BROWSE_PRODUCTS:
            return await self._handle_browse_products(session_id, current_input)
        
        elif current_state == MenuState.VIEW_CATEGORY:
            return await self._handle_view_category(session_id, current_input)
        
        elif current_state == MenuState.MAKE_PAYMENT:
            return await self._handle_make_payment(session_id, current_input)
        
        elif current_state == MenuState.CONFIRM_PAYMENT:
            return await self._handle_confirm_payment(session_id, current_input)
        
        else:
            return self.menu_builder.invalid_input()
    
    async def _handle_main_menu(self, session_id: str, input: str, phone: str) -> str:
        """Handle main menu selection"""
        if input == "1":
            # Check Balance
            return self.menu_builder.check_balance(phone)
        
        elif input == "2":
            # View Orders
            self.session_manager.update_session(session_id, MenuState.VIEW_ORDERS)
            return self.menu_builder.view_orders()
        
        elif input == "3":
            # Browse Products
            self.session_manager.update_session(session_id, MenuState.BROWSE_PRODUCTS)
            return self.menu_builder.browse_products()
        
        elif input == "4":
            # Make Payment
            self.session_manager.update_session(session_id, MenuState.MAKE_PAYMENT)
            return self.menu_builder.make_payment()
        
        elif input == "5":
            # Customer Support
            return self.menu_builder.customer_support()
        
        elif input == "0":
            # Exit
            self.session_manager.clear_session(session_id)
            return self.menu_builder.exit_message()
        
        else:
            return self.menu_builder.invalid_input()
    
    async def _handle_view_orders(self, session_id: str, input: str) -> str:
        """Handle order viewing"""
        if input == "0":
            self.session_manager.go_back(session_id)
            return self.menu_builder.main_menu()
        
        try:
            order_index = int(input) - 1
            return self.menu_builder.view_order_detail(order_index)
        except ValueError:
            return self.menu_builder.invalid_input()
    
    async def _handle_browse_products(self, session_id: str, input: str) -> str:
        """Handle product browsing"""
        if input == "0":
            self.session_manager.go_back(session_id)
            return self.menu_builder.main_menu()
        
        try:
            category_id = int(input)
            self.session_manager.update_session(
                session_id, 
                MenuState.VIEW_CATEGORY,
                {"category_id": category_id}
            )
            return self.menu_builder.view_category(category_id)
        except ValueError:
            return self.menu_builder.invalid_input()
    
    async def _handle_view_category(self, session_id: str, input: str) -> str:
        """Handle category product viewing"""
        if input == "0":
            self.session_manager.go_back(session_id)
            return self.menu_builder.browse_products()
        
        try:
            session = self.session_manager.get_session(session_id)
            category_id = session["data"].get("category_id", 1)
            product_index = int(input) - 1
            return self.menu_builder.view_product(category_id, product_index)
        except ValueError:
            return self.menu_builder.invalid_input()
    
    async def _handle_make_payment(self, session_id: str, input: str) -> str:
        """Handle payment initiation"""
        if input == "0":
            self.session_manager.go_back(session_id)
            return self.menu_builder.main_menu()
        
        # Store order ID and show confirmation
        self.session_manager.update_session(
            session_id,
            MenuState.CONFIRM_PAYMENT,
            {"order_id": input}
        )
        return self.menu_builder.confirm_payment(input)
    
    async def _handle_confirm_payment(self, session_id: str, input: str) -> str:
        """Handle payment confirmation"""
        if input == "1":
            # Confirmed
            session = self.session_manager.get_session(session_id)
            order_id = session["data"].get("order_id", "")
            
            # Process payment (in production, call payment API)
            # await self._process_payment(order_id)
            
            self.session_manager.clear_session(session_id)
            return self.menu_builder.payment_success(order_id)
        
        elif input == "2":
            # Cancelled
            self.session_manager.clear_session(session_id)
            return self.menu_builder.exit_message()
        
        else:
            return self.menu_builder.invalid_input()

# ============================================================================
# API ENDPOINTS
# ============================================================================

ussd_handler = USSDHandler()

@app.post("/ussd")
async def ussd_callback(request: Request):
    """USSD callback endpoint (Africa's Talking format)"""
    try:
        # Parse form data
        form_data = await request.form()
        
        ussd_request = USSDRequest(
            sessionId=form_data.get("sessionId", ""),
            serviceCode=form_data.get("serviceCode", ""),
            phoneNumber=form_data.get("phoneNumber", ""),
            text=form_data.get("text", "")
        )
        
        # Handle request
        response_text = await ussd_handler.handle_request(ussd_request)
        
        # Return plain text response
        return Response(content=response_text, media_type="text/plain")
    
    except Exception as e:
        logger.error(f"USSD error: {e}")
        return Response(content="END Service temporarily unavailable", media_type="text/plain")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ussd-service",
        "version": "1.0.0",
        "active_sessions": len(ussd_handler.session_manager.sessions)
    }

@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    return {
        "active_sessions": len(ussd_handler.session_manager.sessions),
        "total_categories": len(MOCK_CATEGORIES),
        "total_products": sum(len(products) for products in MOCK_PRODUCTS.values()),
        "total_orders": len(MOCK_ORDERS)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8021)

