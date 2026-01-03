"""
Seller Onboarding Service for SocialEscrow
Reduces friction for sellers to claim payments

TIER 2: Seller Onboarding Friction Reduction
- Multi-channel nudges (WhatsApp + SMS)
- Minimal steps to claim payment
- Instant bank resolution (Paystack/Flutterwave)
- USSD claim for low-tech sellers
- Short claim codes
"""

import uuid
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

@dataclass
class ClaimCode:
    """Short claim code for easy sharing"""
    code: str  # 6-character alphanumeric
    escrow_id: str
    seller_phone: str
    amount: float
    expires_at: str
    claimed: bool = False
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class SellerOnboardingSession:
    """Tracks seller's onboarding progress"""
    seller_phone: str
    escrow_id: str
    
    # Progress tracking
    link_sent: bool = False
    link_opened: bool = False
    bank_entered: bool = False
    bank_verified: bool = False
    order_accepted: bool = False
    
    # Bank details
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    
    # Nudges sent
    nudges_sent: int = 0
    last_nudge_at: Optional[str] = None
    
    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

class SellerOnboardingService:
    """
    Service to reduce seller onboarding friction.
    
    Key features:
    1. Short claim codes (6 chars) that work via USSD, WhatsApp, or web
    2. Multi-channel notifications (WhatsApp preferred, SMS fallback)
    3. Instant bank account verification
    4. Progressive disclosure (minimal info first, more if needed)
    """
    
    # Nigerian banks with instant verification support
    SUPPORTED_BANKS = {
        "058": {"name": "GTBank", "code": "058", "ussd": "*737#"},
        "044": {"name": "Access Bank", "code": "044", "ussd": "*901#"},
        "057": {"name": "Zenith Bank", "code": "057", "ussd": "*966#"},
        "033": {"name": "UBA", "code": "033", "ussd": "*919#"},
        "011": {"name": "First Bank", "code": "011", "ussd": "*894#"},
        "214": {"name": "FCMB", "code": "214", "ussd": "*329#"},
        "070": {"name": "Fidelity Bank", "code": "070", "ussd": "*770#"},
        "221": {"name": "Stanbic IBTC", "code": "221", "ussd": "*909#"},
        "032": {"name": "Union Bank", "code": "032", "ussd": "*826#"},
        "035": {"name": "Wema Bank", "code": "035", "ussd": "*945#"},
        "999": {"name": "OPay", "code": "999", "ussd": None},
        "998": {"name": "PalmPay", "code": "998", "ussd": None},
        "997": {"name": "Kuda", "code": "997", "ussd": None},
        "996": {"name": "Moniepoint", "code": "996", "ussd": None},
    }
    
    # Nudge schedule (hours after initial notification)
    NUDGE_SCHEDULE = [24, 48, 72, 120, 168]  # 1, 2, 3, 5, 7 days
    
    def __init__(self):
        self.claim_codes: Dict[str, ClaimCode] = {}
        self.sessions: Dict[str, SellerOnboardingSession] = {}
        self.notification_queue: List[Dict[str, Any]] = []
    
    def generate_claim_code(self, escrow_id: str, seller_phone: str, amount: float) -> ClaimCode:
        """
        Generate a short, easy-to-share claim code.
        
        Format: 6 alphanumeric characters (e.g., "ABC123")
        - Easy to read over phone
        - Easy to type on feature phone
        - Works with USSD
        """
        # Generate unique code
        import random
        import string
        
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            # Avoid confusing characters
            code = code.replace('0', 'X').replace('O', 'Y').replace('I', 'Z').replace('1', 'W')
            if code not in self.claim_codes:
                break
        
        claim_code = ClaimCode(
            code=code,
            escrow_id=escrow_id,
            seller_phone=seller_phone,
            amount=amount,
            expires_at=(datetime.utcnow() + timedelta(days=7)).isoformat()
        )
        
        self.claim_codes[code] = claim_code
        
        logger.info(f"Generated claim code {code} for escrow {escrow_id}")
        
        return claim_code
    
    def validate_claim_code(self, code: str, phone: str = None) -> Optional[ClaimCode]:
        """
        Validate a claim code.
        
        Returns the claim code if valid, None otherwise.
        """
        code = code.upper().strip()
        claim = self.claim_codes.get(code)
        
        if not claim:
            return None
        
        # Check expiration
        if datetime.fromisoformat(claim.expires_at) < datetime.utcnow():
            return None
        
        # Check if already claimed
        if claim.claimed:
            return None
        
        # Optionally verify phone matches
        if phone:
            normalized_phone = self._normalize_phone(phone)
            if not (normalized_phone == claim.seller_phone or 
                    normalized_phone.endswith(claim.seller_phone[-10:])):
                return None
        
        return claim
    
    def start_onboarding(self, escrow_id: str, seller_phone: str, amount: float) -> Dict[str, Any]:
        """
        Start seller onboarding process.
        
        1. Generate claim code
        2. Create onboarding session
        3. Queue initial notification
        """
        seller_phone = self._normalize_phone(seller_phone)
        
        # Generate claim code
        claim_code = self.generate_claim_code(escrow_id, seller_phone, amount)
        
        # Create session
        session = SellerOnboardingSession(
            seller_phone=seller_phone,
            escrow_id=escrow_id,
            link_sent=True
        )
        self.sessions[escrow_id] = session
        
        # Generate claim URL
        base_url = "https://platform-verification-app-kvzjvakf.devinapps.com"
        claim_url = f"{base_url}?mode=seller&claim={claim_code.code}"
        
        # Queue WhatsApp notification
        whatsapp_message = (
            f"You have a payment of ₦{amount:,.0f} waiting!\n\n"
            f"Claim Code: {claim_code.code}\n\n"
            f"To receive payment:\n"
            f"1. Click: {claim_url}\n"
            f"2. Or dial *384*ESCROW# and enter code {claim_code.code}\n"
            f"3. Or reply with your bank details\n\n"
            f"This code expires in 7 days."
        )
        
        self.notification_queue.append({
            "type": "whatsapp",
            "to": seller_phone,
            "message": whatsapp_message,
            "escrow_id": escrow_id,
            "scheduled_at": datetime.utcnow().isoformat()
        })
        
        # Queue SMS fallback (sent 1 hour later if WhatsApp not delivered)
        sms_message = (
            f"SocialEscrow: N{amount:,.0f} waiting. "
            f"Code: {claim_code.code}. "
            f"Dial *384*ESCROW# or visit {claim_url}"
        )
        
        self.notification_queue.append({
            "type": "sms",
            "to": seller_phone,
            "message": sms_message,
            "escrow_id": escrow_id,
            "scheduled_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "fallback": True
        })
        
        return {
            "success": True,
            "claim_code": claim_code.code,
            "claim_url": claim_url,
            "whatsapp_link": f"https://wa.me/{seller_phone.replace('+', '')}?text={whatsapp_message.replace(' ', '%20').replace('\n', '%0A')}",
            "ussd_instructions": f"Dial *384*ESCROW# and enter code {claim_code.code}",
            "session_id": escrow_id
        }
    
    async def verify_bank_account(
        self,
        bank_code: str,
        account_number: str
    ) -> Dict[str, Any]:
        """
        Verify bank account using Paystack/Flutterwave API.
        
        In production, this calls the actual API.
        For POC, simulates verification.
        """
        # Validate inputs
        if len(account_number) != 10 or not account_number.isdigit():
            return {
                "success": False,
                "error": "Account number must be 10 digits"
            }
        
        if bank_code not in self.SUPPORTED_BANKS:
            return {
                "success": False,
                "error": "Bank not supported"
            }
        
        bank = self.SUPPORTED_BANKS[bank_code]
        
        # In production, call Paystack API:
        # POST https://api.paystack.co/bank/resolve
        # { "account_number": "0001234567", "bank_code": "058" }
        
        # Simulated response
        # Generate a realistic Nigerian name
        first_names = ["Chukwuemeka", "Oluwaseun", "Adebayo", "Chidinma", "Ngozi", "Emeka", "Funke", "Tunde"]
        last_names = ["Okonkwo", "Adeyemi", "Okafor", "Nnamdi", "Eze", "Balogun", "Afolabi", "Okoro"]
        import random
        account_name = f"{random.choice(first_names)} {random.choice(last_names)}"
        
        return {
            "success": True,
            "bank_code": bank_code,
            "bank_name": bank["name"],
            "account_number": account_number,
            "account_name": account_name,
            "verified": True,
            "verification_method": "paystack_resolve"
        }
    
    def update_session_bank(
        self,
        escrow_id: str,
        bank_code: str,
        bank_name: str,
        account_number: str,
        account_name: str
    ) -> SellerOnboardingSession:
        """
        Update session with verified bank details.
        """
        session = self.sessions.get(escrow_id)
        if not session:
            session = SellerOnboardingSession(
                seller_phone="",
                escrow_id=escrow_id
            )
            self.sessions[escrow_id] = session
        
        session.bank_code = bank_code
        session.bank_name = bank_name
        session.account_number = account_number
        session.account_name = account_name
        session.bank_entered = True
        session.bank_verified = True
        session.updated_at = datetime.utcnow().isoformat()
        
        return session
    
    def mark_order_accepted(self, escrow_id: str) -> SellerOnboardingSession:
        """
        Mark order as accepted by seller.
        """
        session = self.sessions.get(escrow_id)
        if session:
            session.order_accepted = True
            session.updated_at = datetime.utcnow().isoformat()
        return session
    
    def mark_claim_used(self, code: str) -> bool:
        """
        Mark a claim code as used.
        """
        claim = self.claim_codes.get(code.upper())
        if claim:
            claim.claimed = True
            return True
        return False
    
    def get_pending_nudges(self) -> List[Dict[str, Any]]:
        """
        Get sellers who need reminder nudges.
        """
        now = datetime.utcnow()
        nudges_to_send = []
        
        for escrow_id, session in self.sessions.items():
            if session.order_accepted:
                continue  # Already completed
            
            # Check if nudge is due
            created = datetime.fromisoformat(session.created_at)
            hours_since_created = (now - created).total_seconds() / 3600
            
            # Find next nudge time
            for nudge_hours in self.NUDGE_SCHEDULE:
                if hours_since_created >= nudge_hours and session.nudges_sent < self.NUDGE_SCHEDULE.index(nudge_hours) + 1:
                    nudges_to_send.append({
                        "escrow_id": escrow_id,
                        "seller_phone": session.seller_phone,
                        "nudge_number": session.nudges_sent + 1,
                        "hours_since_created": hours_since_created
                    })
                    break
        
        return nudges_to_send
    
    def send_nudge(self, escrow_id: str) -> Dict[str, Any]:
        """
        Send a reminder nudge to seller.
        """
        session = self.sessions.get(escrow_id)
        if not session:
            return {"success": False, "error": "Session not found"}
        
        # Find claim code
        claim_code = None
        for code, claim in self.claim_codes.items():
            if claim.escrow_id == escrow_id:
                claim_code = claim
                break
        
        if not claim_code:
            return {"success": False, "error": "Claim code not found"}
        
        nudge_number = session.nudges_sent + 1
        
        # Different messages for different nudge numbers
        if nudge_number == 1:
            message = (
                f"Reminder: You have ₦{claim_code.amount:,.0f} waiting!\n\n"
                f"Use code {claim_code.code} to claim.\n"
                f"Dial *384*ESCROW# or click the link we sent."
            )
        elif nudge_number == 2:
            message = (
                f"Don't miss out! ₦{claim_code.amount:,.0f} is waiting for you.\n\n"
                f"Code: {claim_code.code}\n"
                f"This expires in 5 days."
            )
        elif nudge_number == 3:
            message = (
                f"Last reminder: ₦{claim_code.amount:,.0f} expires in 4 days.\n\n"
                f"Code: {claim_code.code}\n"
                f"Claim now or the buyer will be refunded."
            )
        else:
            message = (
                f"URGENT: ₦{claim_code.amount:,.0f} expires soon!\n\n"
                f"Code: {claim_code.code}\n"
                f"Claim immediately to avoid losing this payment."
            )
        
        # Queue notification
        self.notification_queue.append({
            "type": "whatsapp",
            "to": session.seller_phone,
            "message": message,
            "escrow_id": escrow_id,
            "scheduled_at": datetime.utcnow().isoformat(),
            "nudge_number": nudge_number
        })
        
        # Update session
        session.nudges_sent = nudge_number
        session.last_nudge_at = datetime.utcnow().isoformat()
        session.updated_at = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "nudge_number": nudge_number,
            "message": message
        }
    
    def get_onboarding_stats(self) -> Dict[str, Any]:
        """
        Get onboarding funnel statistics.
        """
        total = len(self.sessions)
        link_opened = sum(1 for s in self.sessions.values() if s.link_opened)
        bank_entered = sum(1 for s in self.sessions.values() if s.bank_entered)
        bank_verified = sum(1 for s in self.sessions.values() if s.bank_verified)
        completed = sum(1 for s in self.sessions.values() if s.order_accepted)
        
        return {
            "total_sessions": total,
            "funnel": {
                "link_sent": total,
                "link_opened": link_opened,
                "bank_entered": bank_entered,
                "bank_verified": bank_verified,
                "order_accepted": completed
            },
            "conversion_rate": completed / total if total > 0 else 0,
            "drop_off_points": {
                "link_not_opened": total - link_opened,
                "bank_not_entered": link_opened - bank_entered,
                "bank_not_verified": bank_entered - bank_verified,
                "order_not_accepted": bank_verified - completed
            }
        }
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize Nigerian phone number to +234 format"""
        digits = ''.join(c for c in phone if c.isdigit())
        if digits.startswith('234') and len(digits) == 13:
            return f"+{digits}"
        elif digits.startswith('0') and len(digits) == 11:
            return f"+234{digits[1:]}"
        elif len(digits) == 10:
            return f"+234{digits}"
        return phone


# Global seller onboarding instance
seller_onboarding = SellerOnboardingService()
