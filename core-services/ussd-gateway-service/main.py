"""
USSD Gateway Service - Feature Phone Support for African Markets

This service provides USSD menu-based access to the remittance platform,
enabling feature phone users to:
- Check wallet balance
- Send money to saved beneficiaries
- Buy airtime
- View recent transactions

Architecture:
- Receives USSD callbacks from telco aggregators (Africa's Talking, Infobip, etc.)
- Maintains session state for multi-step menus
- Calls existing backend services (wallet, transaction, airtime)
- Returns USSD-formatted responses
"""

from fastapi import FastAPI, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import httpx
import logging
import uuid
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="USSD Gateway Service",
    description="Feature phone access to Nigerian Remittance Platform",
    version="1.0.0"
)

# Configuration
WALLET_SERVICE_URL = os.getenv("WALLET_SERVICE_URL", "http://wallet-service:8000")
TRANSACTION_SERVICE_URL = os.getenv("TRANSACTION_SERVICE_URL", "http://transaction-service:8000")
AIRTIME_SERVICE_URL = os.getenv("AIRTIME_SERVICE_URL", "http://airtime-service:8000")
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "5"))


class USSDRequest(BaseModel):
    """Standard USSD callback request from telco aggregator"""
    session_id: str
    phone_number: str
    service_code: str
    text: str
    network_code: Optional[str] = None


class USSDResponse(BaseModel):
    """USSD response format"""
    session_id: str
    response: str
    end_session: bool = False


class MenuState(str, Enum):
    """USSD menu states"""
    MAIN_MENU = "main_menu"
    CHECK_BALANCE = "check_balance"
    SEND_MONEY = "send_money"
    SEND_MONEY_SELECT_BENEFICIARY = "send_money_select_beneficiary"
    SEND_MONEY_ENTER_AMOUNT = "send_money_enter_amount"
    SEND_MONEY_CONFIRM = "send_money_confirm"
    BUY_AIRTIME = "buy_airtime"
    BUY_AIRTIME_ENTER_PHONE = "buy_airtime_enter_phone"
    BUY_AIRTIME_ENTER_AMOUNT = "buy_airtime_enter_amount"
    BUY_AIRTIME_CONFIRM = "buy_airtime_confirm"
    RECENT_TRANSACTIONS = "recent_transactions"
    ENTER_PIN = "enter_pin"


class USSDSession:
    """In-memory session store (use Redis in production)"""
    sessions: Dict[str, Dict[str, Any]] = {}
    
    @classmethod
    def get(cls, session_id: str) -> Optional[Dict[str, Any]]:
        session = cls.sessions.get(session_id)
        if session and session.get("expires_at", datetime.min) > datetime.utcnow():
            return session
        return None
    
    @classmethod
    def set(cls, session_id: str, data: Dict[str, Any]) -> None:
        data["expires_at"] = datetime.utcnow() + timedelta(minutes=SESSION_TTL_MINUTES)
        cls.sessions[session_id] = data
    
    @classmethod
    def delete(cls, session_id: str) -> None:
        cls.sessions.pop(session_id, None)
    
    @classmethod
    def cleanup_expired(cls) -> int:
        now = datetime.utcnow()
        expired = [k for k, v in cls.sessions.items() if v.get("expires_at", datetime.min) < now]
        for k in expired:
            del cls.sessions[k]
        return len(expired)


# Mock user data (in production, fetch from user service)
MOCK_USERS = {
    "+2348012345678": {
        "user_id": "user-001",
        "name": "Adebayo Okonkwo",
        "pin": "1234",
        "balance": 150000.00,
        "currency": "NGN",
        "beneficiaries": [
            {"id": "ben-001", "name": "Mama", "phone": "+2348087654321", "bank": "GTBank"},
            {"id": "ben-002", "name": "Chidi", "phone": "+2348098765432", "bank": "Access"},
            {"id": "ben-003", "name": "Ngozi", "phone": "+2348076543210", "bank": "Zenith"},
        ],
        "recent_transactions": [
            {"type": "sent", "amount": 5000, "to": "Mama", "date": "Dec 10"},
            {"type": "received", "amount": 25000, "from": "Emeka", "date": "Dec 8"},
            {"type": "airtime", "amount": 1000, "network": "MTN", "date": "Dec 5"},
        ]
    }
}


def get_user_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    """Get user data by phone number"""
    # Normalize phone number
    normalized = phone.replace(" ", "").replace("-", "")
    if not normalized.startswith("+"):
        normalized = "+234" + normalized.lstrip("0")
    return MOCK_USERS.get(normalized)


def format_currency(amount: float, currency: str = "NGN") -> str:
    """Format amount for USSD display"""
    if currency == "NGN":
        return f"N{amount:,.2f}"
    return f"{currency} {amount:,.2f}"


@app.post("/ussd/callback", response_model=USSDResponse)
async def ussd_callback(request: USSDRequest):
    """
    Main USSD callback endpoint.
    Receives requests from telco aggregator and returns menu responses.
    """
    logger.info(f"USSD request: session={request.session_id}, phone={request.phone_number}, text={request.text}")
    
    # Get or create session
    session = USSDSession.get(request.session_id)
    if session is None:
        session = {
            "phone": request.phone_number,
            "state": MenuState.MAIN_MENU,
            "data": {},
            "authenticated": False
        }
    
    # Get user
    user = get_user_by_phone(request.phone_number)
    if user is None:
        return USSDResponse(
            session_id=request.session_id,
            response="END Welcome to Remittance.\nYou are not registered.\nDownload our app or visit remittance.ng to register.",
            end_session=True
        )
    
    # Parse user input
    user_input = request.text.split("*")[-1] if request.text else ""
    
    # Process based on current state
    response_text, end_session = await process_menu(session, user, user_input)
    
    # Save session
    USSDSession.set(request.session_id, session)
    
    prefix = "END " if end_session else "CON "
    return USSDResponse(
        session_id=request.session_id,
        response=f"{prefix}{response_text}",
        end_session=end_session
    )


async def process_menu(session: Dict, user: Dict, user_input: str) -> tuple[str, bool]:
    """Process menu navigation and return response"""
    state = session.get("state", MenuState.MAIN_MENU)
    data = session.get("data", {})
    
    # Main Menu
    if state == MenuState.MAIN_MENU:
        if user_input == "":
            return (
                f"Welcome {user['name'].split()[0]}!\n"
                "1. Check Balance\n"
                "2. Send Money\n"
                "3. Buy Airtime\n"
                "4. Recent Transactions\n"
                "0. Exit"
            ), False
        
        if user_input == "1":
            session["state"] = MenuState.ENTER_PIN
            session["data"]["next_action"] = "check_balance"
            return "Enter your 4-digit PIN:", False
        
        if user_input == "2":
            session["state"] = MenuState.SEND_MONEY_SELECT_BENEFICIARY
            beneficiaries = user.get("beneficiaries", [])
            if not beneficiaries:
                return "You have no saved beneficiaries.\nAdd beneficiaries in the app.", True
            
            menu = "Select beneficiary:\n"
            for i, ben in enumerate(beneficiaries[:5], 1):
                menu += f"{i}. {ben['name']} ({ben['phone'][-4:]})\n"
            menu += "0. Back"
            return menu, False
        
        if user_input == "3":
            session["state"] = MenuState.BUY_AIRTIME_ENTER_PHONE
            return "Enter phone number for airtime\n(or 1 for your number):", False
        
        if user_input == "4":
            session["state"] = MenuState.ENTER_PIN
            session["data"]["next_action"] = "recent_transactions"
            return "Enter your 4-digit PIN:", False
        
        if user_input == "0":
            return "Thank you for using Remittance.\nGoodbye!", True
        
        return "Invalid option. Please try again.", False
    
    # PIN Entry
    if state == MenuState.ENTER_PIN:
        if len(user_input) != 4 or not user_input.isdigit():
            return "Invalid PIN. Enter 4 digits:", False
        
        if user_input != user.get("pin"):
            return "Incorrect PIN.\nPlease try again:", False
        
        session["authenticated"] = True
        next_action = data.get("next_action")
        
        if next_action == "check_balance":
            balance = format_currency(user["balance"], user["currency"])
            return f"Your balance is:\n{balance}\n\nThank you!", True
        
        if next_action == "recent_transactions":
            txns = user.get("recent_transactions", [])[:3]
            if not txns:
                return "No recent transactions.", True
            
            response = "Recent Transactions:\n"
            for txn in txns:
                if txn["type"] == "sent":
                    response += f"- Sent N{txn['amount']:,} to {txn['to']} ({txn['date']})\n"
                elif txn["type"] == "received":
                    response += f"- Received N{txn['amount']:,} from {txn['from']} ({txn['date']})\n"
                elif txn["type"] == "airtime":
                    response += f"- Airtime N{txn['amount']:,} {txn['network']} ({txn['date']})\n"
            return response, True
        
        if next_action == "confirm_send":
            # Process the transfer
            ben = data.get("beneficiary", {})
            amount = data.get("amount", 0)
            
            # In production, call transaction-service here
            new_balance = user["balance"] - amount
            
            return (
                f"Transfer Successful!\n"
                f"Sent {format_currency(amount)} to {ben['name']}\n"
                f"New balance: {format_currency(new_balance)}\n"
                f"Ref: TXN{datetime.now().strftime('%Y%m%d%H%M%S')}"
            ), True
        
        if next_action == "confirm_airtime":
            phone = data.get("airtime_phone", "")
            amount = data.get("amount", 0)
            
            # In production, call airtime-service here
            return (
                f"Airtime Purchase Successful!\n"
                f"{format_currency(amount)} sent to {phone}\n"
                f"Ref: AIR{datetime.now().strftime('%Y%m%d%H%M%S')}"
            ), True
        
        session["state"] = MenuState.MAIN_MENU
        return "PIN verified. Returning to menu...", False
    
    # Send Money - Select Beneficiary
    if state == MenuState.SEND_MONEY_SELECT_BENEFICIARY:
        if user_input == "0":
            session["state"] = MenuState.MAIN_MENU
            return await process_menu(session, user, "")
        
        try:
            idx = int(user_input) - 1
            beneficiaries = user.get("beneficiaries", [])
            if 0 <= idx < len(beneficiaries):
                session["data"]["beneficiary"] = beneficiaries[idx]
                session["state"] = MenuState.SEND_MONEY_ENTER_AMOUNT
                return f"Sending to {beneficiaries[idx]['name']}\nEnter amount (NGN):", False
        except ValueError:
            pass
        
        return "Invalid selection. Try again:", False
    
    # Send Money - Enter Amount
    if state == MenuState.SEND_MONEY_ENTER_AMOUNT:
        try:
            amount = float(user_input.replace(",", ""))
            if amount <= 0:
                return "Amount must be greater than 0:", False
            if amount > user["balance"]:
                return f"Insufficient balance.\nYour balance: {format_currency(user['balance'])}\nEnter amount:", False
            if amount > 100000:
                return "Maximum transfer is N100,000.\nEnter amount:", False
            
            session["data"]["amount"] = amount
            session["state"] = MenuState.SEND_MONEY_CONFIRM
            ben = session["data"]["beneficiary"]
            
            fee = 50 if amount <= 5000 else 100
            total = amount + fee
            
            return (
                f"Confirm Transfer:\n"
                f"To: {ben['name']}\n"
                f"Amount: {format_currency(amount)}\n"
                f"Fee: {format_currency(fee)}\n"
                f"Total: {format_currency(total)}\n"
                f"1. Confirm\n"
                f"0. Cancel"
            ), False
        except ValueError:
            return "Invalid amount. Enter numbers only:", False
    
    # Send Money - Confirm
    if state == MenuState.SEND_MONEY_CONFIRM:
        if user_input == "1":
            session["state"] = MenuState.ENTER_PIN
            session["data"]["next_action"] = "confirm_send"
            return "Enter your 4-digit PIN to confirm:", False
        
        if user_input == "0":
            session["state"] = MenuState.MAIN_MENU
            return "Transfer cancelled.\n" + (await process_menu(session, user, ""))[0], False
        
        return "Invalid option. 1 to confirm, 0 to cancel:", False
    
    # Buy Airtime - Enter Phone
    if state == MenuState.BUY_AIRTIME_ENTER_PHONE:
        if user_input == "1":
            phone = session["phone"]
        else:
            phone = user_input
        
        # Validate phone number
        if len(phone.replace("+", "").replace("234", "")) < 10:
            return "Invalid phone number.\nEnter 11-digit number:", False
        
        session["data"]["airtime_phone"] = phone
        session["state"] = MenuState.BUY_AIRTIME_ENTER_AMOUNT
        return "Enter airtime amount (NGN):\n(Min: 50, Max: 10,000)", False
    
    # Buy Airtime - Enter Amount
    if state == MenuState.BUY_AIRTIME_ENTER_AMOUNT:
        try:
            amount = float(user_input.replace(",", ""))
            if amount < 50:
                return "Minimum airtime is N50.\nEnter amount:", False
            if amount > 10000:
                return "Maximum airtime is N10,000.\nEnter amount:", False
            if amount > user["balance"]:
                return f"Insufficient balance.\nYour balance: {format_currency(user['balance'])}\nEnter amount:", False
            
            session["data"]["amount"] = amount
            session["state"] = MenuState.BUY_AIRTIME_CONFIRM
            phone = session["data"]["airtime_phone"]
            
            return (
                f"Confirm Airtime:\n"
                f"Phone: {phone}\n"
                f"Amount: {format_currency(amount)}\n"
                f"1. Confirm\n"
                f"0. Cancel"
            ), False
        except ValueError:
            return "Invalid amount. Enter numbers only:", False
    
    # Buy Airtime - Confirm
    if state == MenuState.BUY_AIRTIME_CONFIRM:
        if user_input == "1":
            session["state"] = MenuState.ENTER_PIN
            session["data"]["next_action"] = "confirm_airtime"
            return "Enter your 4-digit PIN to confirm:", False
        
        if user_input == "0":
            session["state"] = MenuState.MAIN_MENU
            return "Airtime cancelled.\n" + (await process_menu(session, user, ""))[0], False
        
        return "Invalid option. 1 to confirm, 0 to cancel:", False
    
    # Default: return to main menu
    session["state"] = MenuState.MAIN_MENU
    return await process_menu(session, user, "")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ussd-gateway", "timestamp": datetime.utcnow().isoformat()}


@app.post("/admin/cleanup-sessions")
async def cleanup_sessions():
    """Admin endpoint to cleanup expired sessions"""
    count = USSDSession.cleanup_expired()
    return {"cleaned_up": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
