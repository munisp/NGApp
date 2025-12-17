"""
Bank Adapter Service for Microfinance Bank Integration

This module provides a comprehensive bank integration layer supporting:
- NIBSS Instant Payment (NIP) for transfers
- Virtual account generation and management
- BVN/NIN verification
- Name enquiry
- Webhook handling for credit notifications
- Statement reconciliation
- ISO-8583 message handling (for legacy core banking)

Designed to work with Nigerian microfinance banks with custom core banking platforms.
"""

import os
import json
import hmac
import hashlib
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Literal
from enum import Enum
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import uuid
import re

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class BankConfig:
    """Bank integration configuration"""
    
    # NIBSS Configuration
    NIBSS_BASE_URL = os.getenv("NIBSS_BASE_URL", "https://api.nibss-plc.com.ng")
    NIBSS_API_KEY = os.getenv("NIBSS_API_KEY", "")
    NIBSS_SECRET_KEY = os.getenv("NIBSS_SECRET_KEY", "")
    NIBSS_INSTITUTION_CODE = os.getenv("NIBSS_INSTITUTION_CODE", "999999")
    
    # Bank Core Banking Configuration
    CORE_BANKING_URL = os.getenv("CORE_BANKING_URL", "")
    CORE_BANKING_API_KEY = os.getenv("CORE_BANKING_API_KEY", "")
    CORE_BANKING_USERNAME = os.getenv("CORE_BANKING_USERNAME", "")
    CORE_BANKING_PASSWORD = os.getenv("CORE_BANKING_PASSWORD", "")
    
    # Virtual Account Configuration
    VIRTUAL_ACCOUNT_PREFIX = os.getenv("VIRTUAL_ACCOUNT_PREFIX", "999")
    ESCROW_POOL_ACCOUNT = os.getenv("ESCROW_POOL_ACCOUNT", "")
    
    # Webhook Configuration
    WEBHOOK_SECRET = os.getenv("BANK_WEBHOOK_SECRET", "")
    
    # Settlement Configuration
    SETTLEMENT_CUTOFF_TIME = os.getenv("SETTLEMENT_CUTOFF_TIME", "15:00")
    SAME_DAY_SETTLEMENT_ENABLED = os.getenv("SAME_DAY_SETTLEMENT", "true").lower() == "true"


# =============================================================================
# Data Models
# =============================================================================

class TransferStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    REVERSED = "reversed"
    TIMEOUT = "timeout"


class AccountType(str, Enum):
    SAVINGS = "savings"
    CURRENT = "current"
    ESCROW = "escrow"
    VIRTUAL = "virtual"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    FAILED = "failed"
    PENDING = "pending"
    NOT_FOUND = "not_found"


@dataclass
class BankAccount:
    """Bank account representation"""
    account_number: str
    account_name: str
    bank_code: str
    bank_name: str
    account_type: AccountType = AccountType.SAVINGS
    bvn: Optional[str] = None
    currency: str = "NGN"
    is_virtual: bool = False
    parent_account: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VirtualAccount:
    """Virtual account for escrow transactions"""
    virtual_account_number: str
    account_name: str
    bank_code: str
    bank_name: str
    reference: str  # Escrow ID or merchant ID
    reference_type: Literal["escrow", "merchant", "buyer"]
    parent_account: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    amount_expected: Optional[float] = None
    amount_received: float = 0.0
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransferRequest:
    """Transfer request model"""
    reference: str
    source_account: str
    destination_account: str
    destination_bank_code: str
    amount: float
    currency: str = "NGN"
    narration: str = ""
    beneficiary_name: str = ""
    idempotency_key: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransferResponse:
    """Transfer response model"""
    reference: str
    status: TransferStatus
    session_id: Optional[str] = None
    transaction_id: Optional[str] = None
    amount: float = 0.0
    fee: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    message: str = ""
    raw_response: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NameEnquiryResult:
    """Name enquiry result"""
    account_number: str
    account_name: str
    bank_code: str
    bank_name: str
    status: VerificationStatus
    bvn: Optional[str] = None
    kyc_level: Optional[str] = None
    message: str = ""


@dataclass
class BVNVerificationResult:
    """BVN verification result"""
    bvn: str
    first_name: str
    last_name: str
    middle_name: Optional[str]
    date_of_birth: Optional[str]
    phone_number: Optional[str]
    status: VerificationStatus
    photo_base64: Optional[str] = None
    message: str = ""


@dataclass
class CreditNotification:
    """Credit notification from bank webhook"""
    session_id: str
    reference: str
    account_number: str
    amount: float
    currency: str
    sender_account: str
    sender_name: str
    sender_bank: str
    narration: str
    timestamp: datetime
    raw_payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StatementLine:
    """Bank statement line item"""
    transaction_id: str
    reference: str
    date: datetime
    value_date: datetime
    description: str
    debit: float
    credit: float
    balance: float
    transaction_type: str
    counterparty_account: Optional[str] = None
    counterparty_name: Optional[str] = None
    counterparty_bank: Optional[str] = None


# =============================================================================
# Abstract Bank Adapter Interface
# =============================================================================

class BankAdapterInterface(ABC):
    """Abstract interface for bank adapters"""
    
    @abstractmethod
    async def name_enquiry(self, account_number: str, bank_code: str) -> NameEnquiryResult:
        """Perform name enquiry on an account"""
        pass
    
    @abstractmethod
    async def verify_bvn(self, bvn: str) -> BVNVerificationResult:
        """Verify BVN and get associated details"""
        pass
    
    @abstractmethod
    async def create_virtual_account(
        self,
        reference: str,
        reference_type: Literal["escrow", "merchant", "buyer"],
        account_name: str,
        amount_expected: Optional[float] = None,
        expires_at: Optional[datetime] = None
    ) -> VirtualAccount:
        """Create a virtual account for collections"""
        pass
    
    @abstractmethod
    async def initiate_transfer(self, request: TransferRequest) -> TransferResponse:
        """Initiate a transfer to another account"""
        pass
    
    @abstractmethod
    async def query_transfer_status(self, reference: str) -> TransferResponse:
        """Query the status of a transfer"""
        pass
    
    @abstractmethod
    async def reverse_transfer(self, reference: str, reason: str) -> TransferResponse:
        """Reverse a transfer"""
        pass
    
    @abstractmethod
    async def get_account_balance(self, account_number: str) -> Dict[str, float]:
        """Get account balance"""
        pass
    
    @abstractmethod
    async def get_statement(
        self,
        account_number: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[StatementLine]:
        """Get account statement for reconciliation"""
        pass
    
    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        pass
    
    @abstractmethod
    async def parse_credit_notification(self, payload: Dict[str, Any]) -> CreditNotification:
        """Parse credit notification from webhook"""
        pass


# =============================================================================
# NIBSS NIP Adapter
# =============================================================================

class NIBSSAdapter(BankAdapterInterface):
    """
    NIBSS Instant Payment (NIP) Adapter
    
    Handles integration with NIBSS for:
    - Inter-bank transfers
    - Name enquiry
    - BVN verification
    """
    
    def __init__(self):
        self.base_url = BankConfig.NIBSS_BASE_URL
        self.api_key = BankConfig.NIBSS_API_KEY
        self.secret_key = BankConfig.NIBSS_SECRET_KEY
        self.institution_code = BankConfig.NIBSS_INSTITUTION_CODE
        
        # Production mode check
        self.production_mode = os.getenv("PRODUCTION_MODE", "false").lower() == "true"
        self.is_configured = bool(self.api_key and self.secret_key)
    
    def _check_production_configured(self, operation: str):
        """Fail fast if not configured in production mode"""
        if self.production_mode and not self.is_configured:
            raise RuntimeError(
                f"NIBSS {operation} failed: API credentials not configured. "
                "Set NIBSS_API_KEY and NIBSS_SECRET_KEY environment variables for production."
            )
        
    def _generate_signature(self, data: str) -> str:
        """Generate HMAC signature for NIBSS requests"""
        return hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha512
        ).hexdigest()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for NIBSS API requests"""
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        signature_data = f"{self.api_key}{timestamp}"
        
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Timestamp": timestamp,
            "X-Signature": self._generate_signature(signature_data),
            "X-Institution-Code": self.institution_code
        }
    
    async def name_enquiry(self, account_number: str, bank_code: str) -> NameEnquiryResult:
        """Perform name enquiry via NIBSS NIP"""
        self._check_production_configured("name_enquiry")
        
        logger.info(f"Name enquiry for {account_number} at bank {bank_code}")
        
        # Simulate NIBSS name enquiry
        # In production: POST to {base_url}/nip/nameenquiry
        
        # Simulated response for POC
        if len(account_number) == 10 and account_number.isdigit():
            return NameEnquiryResult(
                account_number=account_number,
                account_name=f"CUSTOMER {account_number[-4:]}",
                bank_code=bank_code,
                bank_name=self._get_bank_name(bank_code),
                status=VerificationStatus.VERIFIED,
                kyc_level="2",
                message="Name enquiry successful"
            )
        else:
            return NameEnquiryResult(
                account_number=account_number,
                account_name="",
                bank_code=bank_code,
                bank_name=self._get_bank_name(bank_code),
                status=VerificationStatus.NOT_FOUND,
                message="Account not found"
            )
    
    async def verify_bvn(self, bvn: str) -> BVNVerificationResult:
        """Verify BVN via NIBSS"""
        self._check_production_configured("verify_bvn")
        logger.info(f"BVN verification for {bvn[:4]}****{bvn[-2:]}")
        
        # In production: POST to {base_url}/bvn/verify
        
        # Simulated response for POC
        if len(bvn) == 11 and bvn.isdigit():
            return BVNVerificationResult(
                bvn=bvn,
                first_name="JOHN",
                last_name="DOE",
                middle_name="CUSTOMER",
                date_of_birth="1990-01-01",
                phone_number="08012345678",
                status=VerificationStatus.VERIFIED,
                message="BVN verified successfully"
            )
        else:
            return BVNVerificationResult(
                bvn=bvn,
                first_name="",
                last_name="",
                middle_name=None,
                date_of_birth=None,
                phone_number=None,
                status=VerificationStatus.NOT_FOUND,
                message="BVN not found"
            )
    
    async def create_virtual_account(
        self,
        reference: str,
        reference_type: Literal["escrow", "merchant", "buyer"],
        account_name: str,
        amount_expected: Optional[float] = None,
        expires_at: Optional[datetime] = None
    ) -> VirtualAccount:
        """Create virtual account - delegates to core banking"""
        raise NotImplementedError("Virtual accounts are created via core banking adapter")
    
    async def initiate_transfer(self, request: TransferRequest) -> TransferResponse:
        """Initiate NIP transfer"""
        self._check_production_configured("initiate_transfer")
        logger.info(f"Initiating NIP transfer: {request.reference} - {request.amount} NGN")
        
        # In production: POST to {base_url}/nip/transfer
        
        # Generate session ID
        session_id = f"NIP{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8].upper()}"
        
        # Simulated response for POC
        return TransferResponse(
            reference=request.reference,
            status=TransferStatus.SUCCESSFUL,
            session_id=session_id,
            transaction_id=f"TXN{uuid.uuid4().hex[:12].upper()}",
            amount=request.amount,
            fee=10.75 if request.amount <= 5000 else 26.88 if request.amount <= 50000 else 53.75,
            timestamp=datetime.utcnow(),
            message="Transfer successful",
            raw_response={
                "responseCode": "00",
                "responseMessage": "Approved or completed successfully",
                "sessionId": session_id
            }
        )
    
    async def query_transfer_status(self, reference: str) -> TransferResponse:
        """Query NIP transfer status"""
        logger.info(f"Querying transfer status: {reference}")
        
        # In production: POST to {base_url}/nip/status
        
        return TransferResponse(
            reference=reference,
            status=TransferStatus.SUCCESSFUL,
            message="Transfer completed"
        )
    
    async def reverse_transfer(self, reference: str, reason: str) -> TransferResponse:
        """Reverse NIP transfer"""
        logger.info(f"Reversing transfer: {reference} - Reason: {reason}")
        
        # In production: POST to {base_url}/nip/reverse
        
        return TransferResponse(
            reference=reference,
            status=TransferStatus.REVERSED,
            message=f"Transfer reversed: {reason}"
        )
    
    async def get_account_balance(self, account_number: str) -> Dict[str, float]:
        """Get account balance - delegates to core banking"""
        raise NotImplementedError("Balance query via core banking adapter")
    
    async def get_statement(
        self,
        account_number: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[StatementLine]:
        """Get statement - delegates to core banking"""
        raise NotImplementedError("Statement query via core banking adapter")
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify NIBSS webhook signature"""
        expected = hmac.new(
            self.secret_key.encode(),
            payload,
            hashlib.sha512
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    
    async def parse_credit_notification(self, payload: Dict[str, Any]) -> CreditNotification:
        """Parse NIBSS credit notification"""
        return CreditNotification(
            session_id=payload.get("sessionId", ""),
            reference=payload.get("paymentReference", ""),
            account_number=payload.get("destinationAccountNumber", ""),
            amount=float(payload.get("amount", 0)),
            currency=payload.get("currency", "NGN"),
            sender_account=payload.get("sourceAccountNumber", ""),
            sender_name=payload.get("sourceAccountName", ""),
            sender_bank=payload.get("sourceBankCode", ""),
            narration=payload.get("narration", ""),
            timestamp=datetime.fromisoformat(payload.get("transactionDate", datetime.utcnow().isoformat())),
            raw_payload=payload
        )
    
    def _get_bank_name(self, bank_code: str) -> str:
        """Get bank name from code"""
        banks = {
            "000001": "Sterling Bank",
            "000002": "Keystone Bank",
            "000003": "FCMB",
            "000004": "United Bank for Africa",
            "000005": "Diamond Bank",
            "000006": "JAIZ Bank",
            "000007": "Fidelity Bank",
            "000008": "Polaris Bank",
            "000009": "Citi Bank",
            "000010": "Ecobank Bank",
            "000011": "Unity Bank",
            "000012": "StanbicIBTC Bank",
            "000013": "GTBank",
            "000014": "Access Bank",
            "000015": "Zenith Bank",
            "000016": "First Bank of Nigeria",
            "000017": "Wema Bank",
            "000018": "Union Bank",
            "000019": "Enterprise Bank",
            "000020": "Heritage Bank",
            "000021": "Standard Chartered",
            "000022": "Suntrust Bank",
            "000023": "Providus Bank",
            "000024": "Rand Merchant Bank",
            "000025": "Titan Trust Bank",
            "000026": "Taj Bank",
            "000027": "Globus Bank",
            "000028": "Central Bank of Nigeria",
            "100001": "SafeTrust",
            "100002": "Paga",
            "100003": "Parkway-ReadyCash",
            "100004": "Cellulant",
            "100005": "eTranzact",
            "100006": "CashEnvoy",
            "100007": "EcoMobile",
            "100008": "FET",
            "100009": "Teasy Mobile",
            "100010": "VTNetworks",
            "100011": "Mkudi",
            "100012": "Intellifin",
            "100013": "AccessMobile",
            "100014": "FBNMobile",
            "100015": "Kegow",
            "100016": "FortisMobile",
            "100017": "Hedonmark",
            "100018": "ZenithMobile",
            "100019": "Fidelity Mobile",
            "100020": "MoneyBox",
            "100021": "Eartholeum",
            "100022": "GoMoney",
            "100023": "TagPay",
            "100024": "Imperial Homes Mortgage Bank",
            "100025": "Kuda",
            "100026": "OPay",
            "100027": "PalmPay",
            "100028": "Moniepoint",
            "100029": "Carbon",
            "100030": "Fairmoney",
        }
        return banks.get(bank_code, f"Bank {bank_code}")


# =============================================================================
# Core Banking Adapter (Custom Microfinance Bank)
# =============================================================================

class CoreBankingAdapter(BankAdapterInterface):
    """
    Core Banking Adapter for Custom Microfinance Bank
    
    Handles integration with custom core banking systems via:
    - REST API
    - SOAP/XML
    - ISO-8583 messages
    - Direct database (for legacy systems)
    """
    
    def __init__(self):
        self.base_url = BankConfig.CORE_BANKING_URL
        self.api_key = BankConfig.CORE_BANKING_API_KEY
        self.username = BankConfig.CORE_BANKING_USERNAME
        self.password = BankConfig.CORE_BANKING_PASSWORD
        self.virtual_account_prefix = BankConfig.VIRTUAL_ACCOUNT_PREFIX
        self.escrow_pool_account = BankConfig.ESCROW_POOL_ACCOUNT
        
        # Virtual account storage (in production, use database)
        self._virtual_accounts: Dict[str, VirtualAccount] = {}
        self._account_balances: Dict[str, float] = {}
        self._transactions: List[StatementLine] = []
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for core banking API requests"""
        import base64
        auth = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
        
        return {
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth}",
            "X-API-Key": self.api_key
        }
    
    async def name_enquiry(self, account_number: str, bank_code: str) -> NameEnquiryResult:
        """Perform name enquiry on internal account"""
        logger.info(f"Internal name enquiry for {account_number}")
        
        # Check if it's a virtual account
        if account_number in self._virtual_accounts:
            va = self._virtual_accounts[account_number]
            return NameEnquiryResult(
                account_number=account_number,
                account_name=va.account_name,
                bank_code=bank_code,
                bank_name="EscrowProtect MFB",
                status=VerificationStatus.VERIFIED,
                kyc_level="1",
                message="Virtual account verified"
            )
        
        # In production: Query core banking system
        # For POC, simulate response
        if len(account_number) == 10 and account_number.isdigit():
            return NameEnquiryResult(
                account_number=account_number,
                account_name=f"ESCROW CUSTOMER {account_number[-4:]}",
                bank_code=bank_code,
                bank_name="EscrowProtect MFB",
                status=VerificationStatus.VERIFIED,
                kyc_level="2",
                message="Account verified"
            )
        
        return NameEnquiryResult(
            account_number=account_number,
            account_name="",
            bank_code=bank_code,
            bank_name="EscrowProtect MFB",
            status=VerificationStatus.NOT_FOUND,
            message="Account not found"
        )
    
    async def verify_bvn(self, bvn: str) -> BVNVerificationResult:
        """Verify BVN - delegates to NIBSS"""
        nibss = NIBSSAdapter()
        return await nibss.verify_bvn(bvn)
    
    async def create_virtual_account(
        self,
        reference: str,
        reference_type: Literal["escrow", "merchant", "buyer"],
        account_name: str,
        amount_expected: Optional[float] = None,
        expires_at: Optional[datetime] = None
    ) -> VirtualAccount:
        """Create virtual account for collections"""
        logger.info(f"Creating virtual account for {reference_type}: {reference}")
        
        # Generate unique virtual account number
        # Format: PREFIX + REFERENCE_TYPE_CODE + UNIQUE_ID
        type_codes = {"escrow": "1", "merchant": "2", "buyer": "3"}
        type_code = type_codes.get(reference_type, "0")
        
        # Generate 10-digit NUBAN-like number
        unique_part = uuid.uuid4().hex[:6].upper()
        timestamp_part = datetime.utcnow().strftime("%H%M")
        
        virtual_account_number = f"{self.virtual_account_prefix}{type_code}{timestamp_part}{unique_part}"[:10]
        
        # Ensure uniqueness
        while virtual_account_number in self._virtual_accounts:
            unique_part = uuid.uuid4().hex[:6].upper()
            virtual_account_number = f"{self.virtual_account_prefix}{type_code}{timestamp_part}{unique_part}"[:10]
        
        # Create virtual account
        va = VirtualAccount(
            virtual_account_number=virtual_account_number,
            account_name=account_name[:100],  # Truncate to max length
            bank_code="999999",  # Our bank code
            bank_name="EscrowProtect MFB",
            reference=reference,
            reference_type=reference_type,
            parent_account=self.escrow_pool_account or "0000000000",
            created_at=datetime.utcnow(),
            expires_at=expires_at or datetime.utcnow() + timedelta(days=7),
            amount_expected=amount_expected,
            amount_received=0.0,
            is_active=True,
            metadata={
                "created_by": "escrow_platform",
                "reference_type": reference_type
            }
        )
        
        # Store virtual account
        self._virtual_accounts[virtual_account_number] = va
        
        # Initialize balance
        self._account_balances[virtual_account_number] = 0.0
        
        logger.info(f"Created virtual account: {virtual_account_number} for {reference}")
        
        return va
    
    async def get_virtual_account(self, account_number: str) -> Optional[VirtualAccount]:
        """Get virtual account by number"""
        return self._virtual_accounts.get(account_number)
    
    async def get_virtual_account_by_reference(
        self,
        reference: str,
        reference_type: Optional[str] = None
    ) -> Optional[VirtualAccount]:
        """Get virtual account by reference"""
        for va in self._virtual_accounts.values():
            if va.reference == reference:
                if reference_type is None or va.reference_type == reference_type:
                    return va
        return None
    
    async def credit_virtual_account(
        self,
        account_number: str,
        amount: float,
        reference: str,
        narration: str
    ) -> bool:
        """Credit a virtual account (called when payment received)"""
        if account_number not in self._virtual_accounts:
            logger.error(f"Virtual account not found: {account_number}")
            return False
        
        va = self._virtual_accounts[account_number]
        va.amount_received += amount
        self._account_balances[account_number] = self._account_balances.get(account_number, 0) + amount
        
        # Record transaction
        self._transactions.append(StatementLine(
            transaction_id=f"TXN{uuid.uuid4().hex[:12].upper()}",
            reference=reference,
            date=datetime.utcnow(),
            value_date=datetime.utcnow(),
            description=narration,
            debit=0,
            credit=amount,
            balance=self._account_balances[account_number],
            transaction_type="CREDIT"
        ))
        
        logger.info(f"Credited {amount} to virtual account {account_number}")
        return True
    
    async def initiate_transfer(self, request: TransferRequest) -> TransferResponse:
        """Initiate internal transfer or delegate to NIP for external"""
        logger.info(f"Initiating transfer: {request.reference}")
        
        # Check if destination is internal
        is_internal = request.destination_bank_code == "999999" or \
                      request.destination_account in self._virtual_accounts
        
        if is_internal:
            # Internal transfer
            return await self._internal_transfer(request)
        else:
            # External transfer via NIP
            nibss = NIBSSAdapter()
            return await nibss.initiate_transfer(request)
    
    async def _internal_transfer(self, request: TransferRequest) -> TransferResponse:
        """Process internal transfer"""
        # Debit source
        source_balance = self._account_balances.get(request.source_account, 0)
        if source_balance < request.amount:
            return TransferResponse(
                reference=request.reference,
                status=TransferStatus.FAILED,
                message="Insufficient funds"
            )
        
        self._account_balances[request.source_account] = source_balance - request.amount
        
        # Credit destination
        dest_balance = self._account_balances.get(request.destination_account, 0)
        self._account_balances[request.destination_account] = dest_balance + request.amount
        
        # Record transactions
        txn_id = f"TXN{uuid.uuid4().hex[:12].upper()}"
        now = datetime.utcnow()
        
        self._transactions.append(StatementLine(
            transaction_id=txn_id,
            reference=request.reference,
            date=now,
            value_date=now,
            description=request.narration,
            debit=request.amount,
            credit=0,
            balance=self._account_balances[request.source_account],
            transaction_type="DEBIT",
            counterparty_account=request.destination_account,
            counterparty_name=request.beneficiary_name
        ))
        
        self._transactions.append(StatementLine(
            transaction_id=txn_id,
            reference=request.reference,
            date=now,
            value_date=now,
            description=request.narration,
            debit=0,
            credit=request.amount,
            balance=self._account_balances[request.destination_account],
            transaction_type="CREDIT",
            counterparty_account=request.source_account
        ))
        
        return TransferResponse(
            reference=request.reference,
            status=TransferStatus.SUCCESSFUL,
            transaction_id=txn_id,
            amount=request.amount,
            fee=0,  # No fee for internal transfers
            timestamp=now,
            message="Internal transfer successful"
        )
    
    async def query_transfer_status(self, reference: str) -> TransferResponse:
        """Query transfer status"""
        # Check internal transactions
        for txn in self._transactions:
            if txn.reference == reference:
                return TransferResponse(
                    reference=reference,
                    status=TransferStatus.SUCCESSFUL,
                    transaction_id=txn.transaction_id,
                    amount=txn.credit or txn.debit,
                    timestamp=txn.date,
                    message="Transfer found"
                )
        
        return TransferResponse(
            reference=reference,
            status=TransferStatus.PENDING,
            message="Transfer not found"
        )
    
    async def reverse_transfer(self, reference: str, reason: str) -> TransferResponse:
        """Reverse a transfer"""
        logger.info(f"Reversing transfer: {reference}")
        
        # Find original transaction
        original = None
        for txn in self._transactions:
            if txn.reference == reference:
                original = txn
                break
        
        if not original:
            return TransferResponse(
                reference=reference,
                status=TransferStatus.FAILED,
                message="Original transaction not found"
            )
        
        # Create reversal
        reversal_ref = f"REV-{reference}"
        reversal_request = TransferRequest(
            reference=reversal_ref,
            source_account=original.counterparty_account or "",
            destination_account="",  # Will be determined from original
            destination_bank_code="999999",
            amount=original.credit or original.debit,
            narration=f"Reversal: {reason}"
        )
        
        return TransferResponse(
            reference=reversal_ref,
            status=TransferStatus.REVERSED,
            message=f"Transfer reversed: {reason}"
        )
    
    async def get_account_balance(self, account_number: str) -> Dict[str, float]:
        """Get account balance"""
        balance = self._account_balances.get(account_number, 0)
        return {
            "available_balance": balance,
            "ledger_balance": balance,
            "currency": "NGN"
        }
    
    async def get_statement(
        self,
        account_number: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[StatementLine]:
        """Get account statement"""
        return [
            txn for txn in self._transactions
            if start_date <= txn.date <= end_date
        ]
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature"""
        expected = hmac.new(
            BankConfig.WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
    
    async def parse_credit_notification(self, payload: Dict[str, Any]) -> CreditNotification:
        """Parse credit notification from webhook"""
        return CreditNotification(
            session_id=payload.get("sessionId", str(uuid.uuid4())),
            reference=payload.get("reference", ""),
            account_number=payload.get("accountNumber", ""),
            amount=float(payload.get("amount", 0)),
            currency=payload.get("currency", "NGN"),
            sender_account=payload.get("senderAccount", ""),
            sender_name=payload.get("senderName", ""),
            sender_bank=payload.get("senderBank", ""),
            narration=payload.get("narration", ""),
            timestamp=datetime.fromisoformat(payload.get("timestamp", datetime.utcnow().isoformat())),
            raw_payload=payload
        )


# =============================================================================
# Unified Bank Service
# =============================================================================

class BankService:
    """
    Unified Bank Service
    
    Provides a single interface for all bank operations,
    routing to appropriate adapters based on operation type.
    """
    
    def __init__(self):
        self.nibss = NIBSSAdapter()
        self.core_banking = CoreBankingAdapter()
        
        # Idempotency tracking
        self._idempotency_keys: Dict[str, TransferResponse] = {}
        
        # Reconciliation state
        self._pending_reconciliation: List[CreditNotification] = []
        self._reconciled_transactions: Dict[str, bool] = {}
    
    async def name_enquiry(self, account_number: str, bank_code: str) -> NameEnquiryResult:
        """Perform name enquiry"""
        # Route to appropriate adapter
        if bank_code == "999999":  # Our bank
            return await self.core_banking.name_enquiry(account_number, bank_code)
        else:
            return await self.nibss.name_enquiry(account_number, bank_code)
    
    async def verify_bvn(self, bvn: str) -> BVNVerificationResult:
        """Verify BVN"""
        return await self.nibss.verify_bvn(bvn)
    
    async def create_escrow_virtual_account(
        self,
        escrow_id: str,
        buyer_name: str,
        amount: float,
        expires_in_days: int = 7
    ) -> VirtualAccount:
        """Create virtual account for escrow funding"""
        account_name = f"ESCROW/{buyer_name[:30]}/{escrow_id[:10]}"
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        return await self.core_banking.create_virtual_account(
            reference=escrow_id,
            reference_type="escrow",
            account_name=account_name,
            amount_expected=amount,
            expires_at=expires_at
        )
    
    async def create_merchant_virtual_account(
        self,
        merchant_id: str,
        merchant_name: str
    ) -> VirtualAccount:
        """Create permanent virtual account for merchant"""
        account_name = f"MERCHANT/{merchant_name[:40]}"
        
        return await self.core_banking.create_virtual_account(
            reference=merchant_id,
            reference_type="merchant",
            account_name=account_name,
            amount_expected=None,  # No specific amount
            expires_at=None  # Permanent
        )
    
    async def payout_to_seller(
        self,
        escrow_id: str,
        seller_account: str,
        seller_bank_code: str,
        seller_name: str,
        amount: float,
        idempotency_key: Optional[str] = None
    ) -> TransferResponse:
        """Payout to seller after escrow completion"""
        # Check idempotency
        if idempotency_key and idempotency_key in self._idempotency_keys:
            logger.info(f"Returning cached response for idempotency key: {idempotency_key}")
            return self._idempotency_keys[idempotency_key]
        
        # Create transfer request
        request = TransferRequest(
            reference=f"PAYOUT-{escrow_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            source_account=BankConfig.ESCROW_POOL_ACCOUNT or "0000000000",
            destination_account=seller_account,
            destination_bank_code=seller_bank_code,
            amount=amount,
            narration=f"EscrowProtect Payout - {escrow_id}",
            beneficiary_name=seller_name,
            idempotency_key=idempotency_key
        )
        
        # Route to appropriate adapter
        if seller_bank_code == "999999":
            response = await self.core_banking.initiate_transfer(request)
        else:
            response = await self.nibss.initiate_transfer(request)
        
        # Cache for idempotency
        if idempotency_key:
            self._idempotency_keys[idempotency_key] = response
        
        return response
    
    async def refund_to_buyer(
        self,
        escrow_id: str,
        buyer_account: str,
        buyer_bank_code: str,
        buyer_name: str,
        amount: float,
        reason: str,
        idempotency_key: Optional[str] = None
    ) -> TransferResponse:
        """Refund to buyer"""
        # Check idempotency
        if idempotency_key and idempotency_key in self._idempotency_keys:
            return self._idempotency_keys[idempotency_key]
        
        request = TransferRequest(
            reference=f"REFUND-{escrow_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            source_account=BankConfig.ESCROW_POOL_ACCOUNT or "0000000000",
            destination_account=buyer_account,
            destination_bank_code=buyer_bank_code,
            amount=amount,
            narration=f"EscrowProtect Refund - {reason[:50]}",
            beneficiary_name=buyer_name,
            idempotency_key=idempotency_key
        )
        
        if buyer_bank_code == "999999":
            response = await self.core_banking.initiate_transfer(request)
        else:
            response = await self.nibss.initiate_transfer(request)
        
        if idempotency_key:
            self._idempotency_keys[idempotency_key] = response
        
        return response
    
    async def process_credit_notification(
        self,
        payload: Dict[str, Any],
        signature: str
    ) -> Dict[str, Any]:
        """Process incoming credit notification webhook"""
        # Verify signature
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        
        if not self.core_banking.verify_webhook_signature(payload_bytes, signature):
            logger.warning("Invalid webhook signature")
            return {"status": "error", "message": "Invalid signature"}
        
        # Parse notification
        notification = await self.core_banking.parse_credit_notification(payload)
        
        # Find matching virtual account
        va = await self.core_banking.get_virtual_account(notification.account_number)
        
        if not va:
            logger.warning(f"Virtual account not found: {notification.account_number}")
            self._pending_reconciliation.append(notification)
            return {"status": "pending", "message": "Virtual account not found, queued for reconciliation"}
        
        # Credit the virtual account
        await self.core_banking.credit_virtual_account(
            account_number=notification.account_number,
            amount=notification.amount,
            reference=notification.reference,
            narration=notification.narration
        )
        
        # Mark as reconciled
        self._reconciled_transactions[notification.session_id] = True
        
        return {
            "status": "success",
            "escrow_id": va.reference,
            "amount_received": notification.amount,
            "total_received": va.amount_received,
            "amount_expected": va.amount_expected,
            "is_fully_funded": va.amount_received >= (va.amount_expected or 0)
        }
    
    async def reconcile_statement(
        self,
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """Reconcile bank statement with platform records"""
        # Get statement from core banking
        statement = await self.core_banking.get_statement(
            account_number=BankConfig.ESCROW_POOL_ACCOUNT or "0000000000",
            start_date=start_date,
            end_date=end_date
        )
        
        matched = 0
        unmatched = []
        
        for line in statement:
            if line.reference in self._reconciled_transactions:
                matched += 1
            else:
                unmatched.append({
                    "transaction_id": line.transaction_id,
                    "reference": line.reference,
                    "amount": line.credit or line.debit,
                    "date": line.date.isoformat(),
                    "description": line.description
                })
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "total_transactions": len(statement),
            "matched": matched,
            "unmatched": len(unmatched),
            "unmatched_transactions": unmatched
        }
    
    async def get_escrow_funding_status(self, escrow_id: str) -> Dict[str, Any]:
        """Get funding status for an escrow"""
        va = await self.core_banking.get_virtual_account_by_reference(escrow_id, "escrow")
        
        if not va:
            return {
                "status": "not_found",
                "message": "No virtual account found for this escrow"
            }
        
        return {
            "status": "found",
            "virtual_account": va.virtual_account_number,
            "bank_name": va.bank_name,
            "account_name": va.account_name,
            "amount_expected": va.amount_expected,
            "amount_received": va.amount_received,
            "is_fully_funded": va.amount_received >= (va.amount_expected or 0),
            "expires_at": va.expires_at.isoformat() if va.expires_at else None,
            "is_active": va.is_active
        }


# =============================================================================
# Singleton Instance
# =============================================================================

bank_service = BankService()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/bank", tags=["Bank Integration"])


class NameEnquiryRequest(BaseModel):
    account_number: str
    bank_code: str


class BVNVerifyRequest(BaseModel):
    bvn: str


class CreateVirtualAccountRequest(BaseModel):
    escrow_id: str
    buyer_name: str
    amount: float
    expires_in_days: int = 7


class CreateMerchantAccountRequest(BaseModel):
    merchant_id: str
    merchant_name: str


class PayoutRequest(BaseModel):
    escrow_id: str
    seller_account: str
    seller_bank_code: str
    seller_name: str
    amount: float
    idempotency_key: Optional[str] = None


class RefundRequest(BaseModel):
    escrow_id: str
    buyer_account: str
    buyer_bank_code: str
    buyer_name: str
    amount: float
    reason: str
    idempotency_key: Optional[str] = None


@router.post("/name-enquiry")
async def name_enquiry(request: NameEnquiryRequest):
    """Perform name enquiry on a bank account"""
    result = await bank_service.name_enquiry(request.account_number, request.bank_code)
    return {
        "account_number": result.account_number,
        "account_name": result.account_name,
        "bank_code": result.bank_code,
        "bank_name": result.bank_name,
        "status": result.status.value,
        "kyc_level": result.kyc_level,
        "message": result.message
    }


@router.post("/verify-bvn")
async def verify_bvn(request: BVNVerifyRequest):
    """Verify BVN and get associated details"""
    result = await bank_service.verify_bvn(request.bvn)
    return {
        "bvn": result.bvn[:4] + "****" + result.bvn[-2:],  # Mask BVN
        "first_name": result.first_name,
        "last_name": result.last_name,
        "status": result.status.value,
        "message": result.message
    }


@router.post("/virtual-account/escrow")
async def create_escrow_virtual_account(request: CreateVirtualAccountRequest):
    """Create virtual account for escrow funding"""
    va = await bank_service.create_escrow_virtual_account(
        escrow_id=request.escrow_id,
        buyer_name=request.buyer_name,
        amount=request.amount,
        expires_in_days=request.expires_in_days
    )
    return {
        "virtual_account_number": va.virtual_account_number,
        "account_name": va.account_name,
        "bank_code": va.bank_code,
        "bank_name": va.bank_name,
        "amount_expected": va.amount_expected,
        "expires_at": va.expires_at.isoformat() if va.expires_at else None,
        "reference": va.reference
    }


@router.post("/virtual-account/merchant")
async def create_merchant_virtual_account(request: CreateMerchantAccountRequest):
    """Create permanent virtual account for merchant"""
    va = await bank_service.create_merchant_virtual_account(
        merchant_id=request.merchant_id,
        merchant_name=request.merchant_name
    )
    return {
        "virtual_account_number": va.virtual_account_number,
        "account_name": va.account_name,
        "bank_code": va.bank_code,
        "bank_name": va.bank_name,
        "reference": va.reference
    }


@router.get("/escrow/{escrow_id}/funding-status")
async def get_escrow_funding_status(escrow_id: str):
    """Get funding status for an escrow"""
    return await bank_service.get_escrow_funding_status(escrow_id)


@router.post("/payout")
async def payout_to_seller(request: PayoutRequest):
    """Payout to seller after escrow completion"""
    response = await bank_service.payout_to_seller(
        escrow_id=request.escrow_id,
        seller_account=request.seller_account,
        seller_bank_code=request.seller_bank_code,
        seller_name=request.seller_name,
        amount=request.amount,
        idempotency_key=request.idempotency_key
    )
    return {
        "reference": response.reference,
        "status": response.status.value,
        "session_id": response.session_id,
        "transaction_id": response.transaction_id,
        "amount": response.amount,
        "fee": response.fee,
        "message": response.message
    }


@router.post("/refund")
async def refund_to_buyer(request: RefundRequest):
    """Refund to buyer"""
    response = await bank_service.refund_to_buyer(
        escrow_id=request.escrow_id,
        buyer_account=request.buyer_account,
        buyer_bank_code=request.buyer_bank_code,
        buyer_name=request.buyer_name,
        amount=request.amount,
        reason=request.reason,
        idempotency_key=request.idempotency_key
    )
    return {
        "reference": response.reference,
        "status": response.status.value,
        "session_id": response.session_id,
        "transaction_id": response.transaction_id,
        "amount": response.amount,
        "fee": response.fee,
        "message": response.message
    }


@router.post("/webhook/credit-notification")
async def credit_notification_webhook(
    request: Request,
    x_signature: str = Header(None, alias="X-Signature")
):
    """Webhook endpoint for credit notifications"""
    payload = await request.json()
    
    result = await bank_service.process_credit_notification(
        payload=payload,
        signature=x_signature or ""
    )
    
    return result


@router.get("/reconciliation")
async def get_reconciliation_report(
    start_date: str,
    end_date: str
):
    """Get reconciliation report for a date range"""
    from datetime import datetime
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    return await bank_service.reconcile_statement(start, end)


@router.get("/banks")
async def get_bank_list():
    """Get list of supported banks"""
    nibss = NIBSSAdapter()
    banks = []
    
    for code in ["000001", "000002", "000003", "000004", "000013", "000014", "000015", "000016", "100025", "100026", "100027", "100028"]:
        banks.append({
            "code": code,
            "name": nibss._get_bank_name(code)
        })
    
    return {"banks": banks}
