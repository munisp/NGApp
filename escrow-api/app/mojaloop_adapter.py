"""
Mojaloop Adapter for SocialEscrow Platform

Implements FSPIOP (Financial Services Provider Interoperability Protocol) integration
for interoperable payments across Nigerian banks and mobile money providers.

Mojaloop provides:
- DFSP (Digital Financial Service Provider) interoperability
- Quote/Transfer/Settlement lifecycle
- Real-time gross settlement
- FX conversion support
- Regulatory compliance for African markets

Architecture:
- TigerBeetle = Internal source-of-truth ledger
- Mojaloop = External clearing/transfer rail for bank/wallet integration
"""

import os
import json
import uuid
import hmac
import hashlib
import logging
import asyncio
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from functools import wraps
import aiohttp

logger = logging.getLogger(__name__)

# Mojaloop configuration
MOJALOOP_HUB_URL = os.getenv("MOJALOOP_HUB_URL", "http://localhost:4000")
MOJALOOP_ALS_URL = os.getenv("MOJALOOP_ALS_URL", "http://localhost:4002")  # Account Lookup Service
MOJALOOP_QUOTES_URL = os.getenv("MOJALOOP_QUOTES_URL", "http://localhost:4003")
MOJALOOP_TRANSFERS_URL = os.getenv("MOJALOOP_TRANSFERS_URL", "http://localhost:4004")
MOJALOOP_SETTLEMENT_URL = os.getenv("MOJALOOP_SETTLEMENT_URL", "http://localhost:4005")

# Our DFSP identity
ESCROW_DFSP_ID = os.getenv("ESCROW_DFSP_ID", "socialescrow")
ESCROW_DFSP_NAME = os.getenv("ESCROW_DFSP_NAME", "SocialEscrow Nigeria")

# API keys and certificates
MOJALOOP_API_KEY = os.getenv("MOJALOOP_API_KEY", "")
MOJALOOP_CLIENT_CERT = os.getenv("MOJALOOP_CLIENT_CERT", "")
MOJALOOP_CLIENT_KEY = os.getenv("MOJALOOP_CLIENT_KEY", "")

# Callback URL for async responses
CALLBACK_BASE_URL = os.getenv("CALLBACK_BASE_URL", "http://localhost:8000")


class TransferState(Enum):
    """Mojaloop transfer states"""
    RECEIVED = "RECEIVED"
    RESERVED = "RESERVED"
    COMMITTED = "COMMITTED"
    ABORTED = "ABORTED"


class QuoteState(Enum):
    """Mojaloop quote states"""
    RECEIVED = "RECEIVED"
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class PartyIdType(Enum):
    """Mojaloop party identifier types"""
    MSISDN = "MSISDN"  # Phone number
    ACCOUNT_ID = "ACCOUNT_ID"
    IBAN = "IBAN"
    ALIAS = "ALIAS"
    BUSINESS = "BUSINESS"
    DEVICE = "DEVICE"
    EMAIL = "EMAIL"
    PERSONAL_ID = "PERSONAL_ID"


@dataclass
class Party:
    """Mojaloop party (payer or payee)"""
    party_id_type: PartyIdType
    party_id_value: str
    fsp_id: Optional[str] = None  # DFSP ID
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    merchant_classification_code: Optional[str] = None
    
    def to_fspiop(self) -> Dict[str, Any]:
        """Convert to FSPIOP format"""
        result = {
            "partyIdInfo": {
                "partyIdType": self.party_id_type.value,
                "partyIdentifier": self.party_id_value,
            }
        }
        if self.fsp_id:
            result["partyIdInfo"]["fspId"] = self.fsp_id
        if self.name:
            result["name"] = self.name
        if self.first_name or self.last_name:
            result["personalInfo"] = {
                "complexName": {
                    "firstName": self.first_name or "",
                    "lastName": self.last_name or ""
                }
            }
        if self.merchant_classification_code:
            result["merchantClassificationCode"] = self.merchant_classification_code
        return result


@dataclass
class Money:
    """Mojaloop money amount"""
    amount: str  # String representation for precision
    currency: str = "NGN"
    
    def to_fspiop(self) -> Dict[str, str]:
        return {"amount": self.amount, "currency": self.currency}


@dataclass
class Quote:
    """Mojaloop quote"""
    quote_id: str
    transaction_id: str
    payer: Party
    payee: Party
    amount: Money
    fees: Optional[Money] = None
    transfer_amount: Optional[Money] = None
    expiration: Optional[datetime] = None
    state: QuoteState = QuoteState.RECEIVED
    ilp_packet: Optional[str] = None
    condition: Optional[str] = None
    
    def to_fspiop(self) -> Dict[str, Any]:
        result = {
            "quoteId": self.quote_id,
            "transactionId": self.transaction_id,
            "payer": self.payer.to_fspiop(),
            "payee": self.payee.to_fspiop(),
            "amountType": "SEND",
            "amount": self.amount.to_fspiop(),
            "transactionType": {
                "scenario": "TRANSFER",
                "initiator": "PAYER",
                "initiatorType": "CONSUMER"
            }
        }
        if self.expiration:
            result["expiration"] = self.expiration.isoformat() + "Z"
        return result


@dataclass
class Transfer:
    """Mojaloop transfer"""
    transfer_id: str
    quote_id: str
    payer_fsp: str
    payee_fsp: str
    amount: Money
    ilp_packet: str
    condition: str
    expiration: datetime
    state: TransferState = TransferState.RECEIVED
    fulfilment: Optional[str] = None
    completed_timestamp: Optional[datetime] = None
    
    def to_fspiop(self) -> Dict[str, Any]:
        return {
            "transferId": self.transfer_id,
            "payerFsp": self.payer_fsp,
            "payeeFsp": self.payee_fsp,
            "amount": self.amount.to_fspiop(),
            "ilpPacket": self.ilp_packet,
            "condition": self.condition,
            "expiration": self.expiration.isoformat() + "Z"
        }


class MojaloopError(Exception):
    """Mojaloop API error"""
    def __init__(self, error_code: str, error_description: str, http_status: int = 500):
        self.error_code = error_code
        self.error_description = error_description
        self.http_status = http_status
        super().__init__(f"{error_code}: {error_description}")


class MojaloopAdapter:
    """
    Mojaloop FSPIOP adapter for SocialEscrow.
    
    Handles:
    - Party lookup (find DFSP for a phone number/account)
    - Quote creation (lock fees and FX rates)
    - Transfer initiation and fulfilment
    - Settlement position management
    - Callback handling for async responses
    """
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.connected = False
        self._pending_quotes: Dict[str, Quote] = {}
        self._pending_transfers: Dict[str, Transfer] = {}
        self._callbacks: Dict[str, Callable] = {}
        
    async def connect(self) -> bool:
        """Initialize HTTP session with mTLS if configured"""
        try:
            ssl_context = None
            if MOJALOOP_CLIENT_CERT and MOJALOOP_CLIENT_KEY:
                import ssl
                ssl_context = ssl.create_default_context()
                ssl_context.load_cert_chain(
                    MOJALOOP_CLIENT_CERT,
                    MOJALOOP_CLIENT_KEY
                )
            
            connector = aiohttp.TCPConnector(ssl=ssl_context) if ssl_context else None
            self.session = aiohttp.ClientSession(
                connector=connector,
                headers=self._get_default_headers()
            )
            
            # Test connection to hub
            async with self.session.get(f"{MOJALOOP_HUB_URL}/health") as resp:
                if resp.status == 200:
                    self.connected = True
                    logger.info(f"Connected to Mojaloop hub at {MOJALOOP_HUB_URL}")
                    return True
                    
        except Exception as e:
            logger.warning(f"Mojaloop connection failed: {e}")
            
        self.connected = False
        return False
    
    def _get_default_headers(self) -> Dict[str, str]:
        """Get default FSPIOP headers"""
        return {
            "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
            "Accept": "application/vnd.interoperability.parties+json;version=1.1",
            "FSPIOP-Source": ESCROW_DFSP_ID,
            "Date": datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT"),
        }
    
    def _generate_correlation_id(self) -> str:
        """Generate unique correlation ID for request tracking"""
        return str(uuid.uuid4())
    
    async def lookup_party(
        self,
        party_id_type: PartyIdType,
        party_id_value: str
    ) -> Optional[Party]:
        """
        Look up a party (payer/payee) to find their DFSP.
        
        This is the first step in any transfer - we need to know
        which bank/wallet the recipient uses.
        """
        if not self.session:
            await self.connect()
        
        if not self.connected:
            logger.warning("Mojaloop not connected, returning mock party")
            return Party(
                party_id_type=party_id_type,
                party_id_value=party_id_value,
                fsp_id="mock_dfsp",
                name="Mock User"
            )
        
        try:
            url = f"{MOJALOOP_ALS_URL}/parties/{party_id_type.value}/{party_id_value}"
            headers = {
                **self._get_default_headers(),
                "Content-Type": "application/vnd.interoperability.parties+json;version=1.1",
            }
            
            async with self.session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return Party(
                        party_id_type=party_id_type,
                        party_id_value=party_id_value,
                        fsp_id=data.get("party", {}).get("partyIdInfo", {}).get("fspId"),
                        name=data.get("party", {}).get("name"),
                        first_name=data.get("party", {}).get("personalInfo", {}).get("complexName", {}).get("firstName"),
                        last_name=data.get("party", {}).get("personalInfo", {}).get("complexName", {}).get("lastName"),
                    )
                elif resp.status == 202:
                    # Async response - will come via callback
                    logger.info(f"Party lookup accepted, waiting for callback")
                    return None
                else:
                    error = await resp.text()
                    raise MojaloopError("PARTY_NOT_FOUND", f"Party lookup failed: {error}", resp.status)
                    
        except aiohttp.ClientError as e:
            logger.error(f"Party lookup failed: {e}")
            raise MojaloopError("COMMUNICATION_ERROR", str(e))
    
    async def create_quote(
        self,
        payer: Party,
        payee: Party,
        amount: Money,
        transaction_id: Optional[str] = None,
        note: Optional[str] = None
    ) -> Quote:
        """
        Create a quote for a transfer.
        
        This locks in the fees and FX rate (if applicable) for a transfer.
        The quote has an expiration time after which it's no longer valid.
        """
        quote_id = str(uuid.uuid4())
        transaction_id = transaction_id or str(uuid.uuid4())
        
        quote = Quote(
            quote_id=quote_id,
            transaction_id=transaction_id,
            payer=payer,
            payee=payee,
            amount=amount,
            expiration=datetime.utcnow() + timedelta(minutes=30)
        )
        
        if not self.session:
            await self.connect()
        
        if not self.connected:
            # Mock quote for development
            quote.state = QuoteState.ACCEPTED
            quote.fees = Money(amount="0", currency=amount.currency)
            quote.transfer_amount = amount
            quote.ilp_packet = "mock_ilp_packet"
            quote.condition = "mock_condition"
            self._pending_quotes[quote_id] = quote
            return quote
        
        try:
            url = f"{MOJALOOP_QUOTES_URL}/quotes"
            headers = {
                **self._get_default_headers(),
                "Content-Type": "application/vnd.interoperability.quotes+json;version=1.1",
                "FSPIOP-Destination": payee.fsp_id or "",
            }
            
            payload = quote.to_fspiop()
            if note:
                payload["note"] = note
            
            async with self.session.post(url, json=payload, headers=headers) as resp:
                if resp.status in (200, 201, 202):
                    quote.state = QuoteState.PENDING
                    self._pending_quotes[quote_id] = quote
                    logger.info(f"Quote {quote_id} created, waiting for response")
                    return quote
                else:
                    error = await resp.text()
                    raise MojaloopError("QUOTE_FAILED", f"Quote creation failed: {error}", resp.status)
                    
        except aiohttp.ClientError as e:
            logger.error(f"Quote creation failed: {e}")
            raise MojaloopError("COMMUNICATION_ERROR", str(e))
    
    async def initiate_transfer(
        self,
        quote: Quote,
        idempotency_key: Optional[str] = None
    ) -> Transfer:
        """
        Initiate a transfer based on an accepted quote.
        
        This is the actual money movement. The transfer is held in RESERVED
        state until the payee DFSP fulfils it.
        """
        if quote.state != QuoteState.ACCEPTED:
            raise MojaloopError("INVALID_QUOTE_STATE", f"Quote must be ACCEPTED, got {quote.state}")
        
        if not quote.ilp_packet or not quote.condition:
            raise MojaloopError("MISSING_ILP_DATA", "Quote missing ILP packet or condition")
        
        # Use idempotency key to generate deterministic transfer ID
        if idempotency_key:
            transfer_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"transfer:{idempotency_key}"))
        else:
            transfer_id = str(uuid.uuid4())
        
        transfer = Transfer(
            transfer_id=transfer_id,
            quote_id=quote.quote_id,
            payer_fsp=quote.payer.fsp_id or ESCROW_DFSP_ID,
            payee_fsp=quote.payee.fsp_id or "",
            amount=quote.transfer_amount or quote.amount,
            ilp_packet=quote.ilp_packet,
            condition=quote.condition,
            expiration=datetime.utcnow() + timedelta(minutes=5)
        )
        
        if not self.session:
            await self.connect()
        
        if not self.connected:
            # Mock transfer for development
            transfer.state = TransferState.COMMITTED
            transfer.fulfilment = "mock_fulfilment"
            transfer.completed_timestamp = datetime.utcnow()
            self._pending_transfers[transfer_id] = transfer
            return transfer
        
        try:
            url = f"{MOJALOOP_TRANSFERS_URL}/transfers"
            headers = {
                **self._get_default_headers(),
                "Content-Type": "application/vnd.interoperability.transfers+json;version=1.1",
                "FSPIOP-Destination": transfer.payee_fsp,
            }
            
            async with self.session.post(url, json=transfer.to_fspiop(), headers=headers) as resp:
                if resp.status in (200, 201, 202):
                    transfer.state = TransferState.RESERVED
                    self._pending_transfers[transfer_id] = transfer
                    logger.info(f"Transfer {transfer_id} initiated, waiting for fulfilment")
                    return transfer
                else:
                    error = await resp.text()
                    raise MojaloopError("TRANSFER_FAILED", f"Transfer initiation failed: {error}", resp.status)
                    
        except aiohttp.ClientError as e:
            logger.error(f"Transfer initiation failed: {e}")
            raise MojaloopError("COMMUNICATION_ERROR", str(e))
    
    async def handle_quote_callback(self, quote_id: str, data: Dict[str, Any]) -> Quote:
        """
        Handle async quote response callback from Mojaloop.
        
        Called when the payee DFSP responds to our quote request.
        """
        quote = self._pending_quotes.get(quote_id)
        if not quote:
            raise MojaloopError("QUOTE_NOT_FOUND", f"Quote {quote_id} not found")
        
        if "errorInformation" in data:
            quote.state = QuoteState.REJECTED
            raise MojaloopError(
                data["errorInformation"].get("errorCode", "UNKNOWN"),
                data["errorInformation"].get("errorDescription", "Quote rejected")
            )
        
        # Extract quote response
        quote.fees = Money(
            amount=data.get("payeeFspFee", {}).get("amount", "0"),
            currency=data.get("payeeFspFee", {}).get("currency", quote.amount.currency)
        )
        quote.transfer_amount = Money(
            amount=data.get("transferAmount", {}).get("amount", quote.amount.amount),
            currency=data.get("transferAmount", {}).get("currency", quote.amount.currency)
        )
        quote.ilp_packet = data.get("ilpPacket")
        quote.condition = data.get("condition")
        
        if data.get("expiration"):
            quote.expiration = datetime.fromisoformat(data["expiration"].replace("Z", "+00:00"))
        
        quote.state = QuoteState.ACCEPTED
        logger.info(f"Quote {quote_id} accepted with fees {quote.fees.amount}")
        
        return quote
    
    async def handle_transfer_callback(self, transfer_id: str, data: Dict[str, Any]) -> Transfer:
        """
        Handle async transfer response callback from Mojaloop.
        
        Called when the payee DFSP fulfils or rejects the transfer.
        """
        transfer = self._pending_transfers.get(transfer_id)
        if not transfer:
            raise MojaloopError("TRANSFER_NOT_FOUND", f"Transfer {transfer_id} not found")
        
        if "errorInformation" in data:
            transfer.state = TransferState.ABORTED
            raise MojaloopError(
                data["errorInformation"].get("errorCode", "UNKNOWN"),
                data["errorInformation"].get("errorDescription", "Transfer failed")
            )
        
        transfer.fulfilment = data.get("fulfilment")
        transfer.state = TransferState.COMMITTED
        
        if data.get("completedTimestamp"):
            transfer.completed_timestamp = datetime.fromisoformat(
                data["completedTimestamp"].replace("Z", "+00:00")
            )
        else:
            transfer.completed_timestamp = datetime.utcnow()
        
        logger.info(f"Transfer {transfer_id} committed")
        
        return transfer
    
    async def get_settlement_position(self) -> Dict[str, Any]:
        """
        Get current settlement position for our DFSP.
        
        This shows our net position with other DFSPs.
        """
        if not self.session:
            await self.connect()
        
        if not self.connected:
            return {
                "dfspId": ESCROW_DFSP_ID,
                "currency": "NGN",
                "value": 0,
                "changedDate": datetime.utcnow().isoformat()
            }
        
        try:
            url = f"{MOJALOOP_SETTLEMENT_URL}/participants/{ESCROW_DFSP_ID}/positions"
            
            async with self.session.get(url, headers=self._get_default_headers()) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    logger.warning(f"Failed to get settlement position: {error}")
                    return {}
                    
        except aiohttp.ClientError as e:
            logger.error(f"Settlement position query failed: {e}")
            return {}
    
    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
            self.connected = False


class EscrowMojaloopIntegration:
    """
    High-level integration between SocialEscrow and Mojaloop.
    
    Orchestrates the flow:
    1. Buyer pays into escrow (Mojaloop inbound transfer)
    2. Funds held in TigerBeetle ledger
    3. Seller receives payout (Mojaloop outbound transfer)
    """
    
    def __init__(self):
        self.mojaloop = MojaloopAdapter()
        self._tigerbeetle = None
        
    async def _get_tigerbeetle(self):
        """Lazy load TigerBeetle ledger"""
        if self._tigerbeetle is None:
            from app.tigerbeetle_ledger import TigerBeetleLedger
            self._tigerbeetle = TigerBeetleLedger()
            await self._tigerbeetle.connect()
        return self._tigerbeetle
    
    async def process_buyer_payment(
        self,
        escrow_id: str,
        buyer_phone: str,
        seller_phone: str,
        amount_naira: float,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """
        Process buyer payment into escrow via Mojaloop.
        
        Flow:
        1. Look up buyer's DFSP (bank/wallet)
        2. Create quote for transfer
        3. Initiate transfer from buyer to SocialEscrow
        4. On fulfilment, create TigerBeetle escrow hold
        """
        from app.tigerbeetle_ledger import naira_to_kobo
        
        amount_kobo = naira_to_kobo(amount_naira)
        platform_fee_kobo = int(amount_kobo * 0.02)  # 2% fee
        
        # Step 1: Look up buyer's DFSP
        buyer_party = await self.mojaloop.lookup_party(
            PartyIdType.MSISDN,
            buyer_phone
        )
        
        if not buyer_party:
            return {"success": False, "error": "Buyer DFSP lookup pending"}
        
        # Our escrow account as payee
        escrow_party = Party(
            party_id_type=PartyIdType.BUSINESS,
            party_id_value=escrow_id,
            fsp_id=ESCROW_DFSP_ID,
            name=ESCROW_DFSP_NAME
        )
        
        # Step 2: Create quote
        quote = await self.mojaloop.create_quote(
            payer=buyer_party,
            payee=escrow_party,
            amount=Money(amount=str(amount_naira), currency="NGN"),
            note=f"Escrow payment for {escrow_id}"
        )
        
        if quote.state != QuoteState.ACCEPTED:
            return {
                "success": False,
                "error": "Quote not accepted",
                "quote_id": quote.quote_id,
                "quote_state": quote.state.value
            }
        
        # Step 3: Initiate transfer
        transfer = await self.mojaloop.initiate_transfer(
            quote=quote,
            idempotency_key=idempotency_key
        )
        
        if transfer.state != TransferState.COMMITTED:
            return {
                "success": False,
                "error": "Transfer not committed",
                "transfer_id": transfer.transfer_id,
                "transfer_state": transfer.state.value
            }
        
        # Step 4: Create TigerBeetle escrow hold
        ledger = await self._get_tigerbeetle()
        
        # Create accounts
        await ledger.create_user_accounts(buyer_phone)
        await ledger.create_user_accounts(seller_phone)
        await ledger.create_escrow_account(escrow_id)
        
        # Record the escrow deposit
        tb_result = await ledger.deposit_to_escrow(
            escrow_id=escrow_id,
            buyer_id=buyer_phone,
            amount=amount_kobo,
            platform_fee=platform_fee_kobo,
            idempotency_key=idempotency_key
        )
        
        return {
            "success": True,
            "escrow_id": escrow_id,
            "mojaloop_transfer_id": transfer.transfer_id,
            "mojaloop_quote_id": quote.quote_id,
            "tigerbeetle_transfer_id": tb_result.get("escrow_transfer_id"),
            "amount_naira": amount_naira,
            "platform_fee_naira": platform_fee_kobo / 100,
            "total_naira": (amount_kobo + platform_fee_kobo) / 100
        }
    
    async def process_seller_payout(
        self,
        escrow_id: str,
        seller_phone: str,
        buyer_phone: str,
        tigerbeetle_transfer_id: str,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """
        Process seller payout from escrow via Mojaloop.
        
        Flow:
        1. Release TigerBeetle escrow hold
        2. Look up seller's DFSP
        3. Create quote for payout
        4. Initiate transfer from SocialEscrow to seller
        """
        from app.tigerbeetle_ledger import kobo_to_naira
        
        ledger = await self._get_tigerbeetle()
        
        # Step 1: Release TigerBeetle escrow
        tb_result = await ledger.release_escrow(
            escrow_id=escrow_id,
            seller_id=seller_phone,
            escrow_transfer_id=int(tigerbeetle_transfer_id)
        )
        
        if not tb_result.get("success"):
            return {"success": False, "error": "TigerBeetle release failed", "details": tb_result}
        
        amount_kobo = tb_result.get("amount_released", 0)
        amount_naira = kobo_to_naira(amount_kobo)
        
        # Step 2: Look up seller's DFSP
        seller_party = await self.mojaloop.lookup_party(
            PartyIdType.MSISDN,
            seller_phone
        )
        
        if not seller_party:
            return {
                "success": False,
                "error": "Seller DFSP lookup pending",
                "tigerbeetle_released": True,
                "amount_naira": amount_naira
            }
        
        # Our escrow account as payer
        escrow_party = Party(
            party_id_type=PartyIdType.BUSINESS,
            party_id_value=escrow_id,
            fsp_id=ESCROW_DFSP_ID,
            name=ESCROW_DFSP_NAME
        )
        
        # Step 3: Create quote for payout
        quote = await self.mojaloop.create_quote(
            payer=escrow_party,
            payee=seller_party,
            amount=Money(amount=str(amount_naira), currency="NGN"),
            note=f"Escrow payout for {escrow_id}"
        )
        
        if quote.state != QuoteState.ACCEPTED:
            return {
                "success": False,
                "error": "Payout quote not accepted",
                "tigerbeetle_released": True,
                "quote_id": quote.quote_id
            }
        
        # Step 4: Initiate payout transfer
        transfer = await self.mojaloop.initiate_transfer(
            quote=quote,
            idempotency_key=f"payout:{idempotency_key}"
        )
        
        return {
            "success": transfer.state == TransferState.COMMITTED,
            "escrow_id": escrow_id,
            "mojaloop_transfer_id": transfer.transfer_id,
            "tigerbeetle_release_id": tb_result.get("release_transfer_id"),
            "amount_naira": amount_naira,
            "transfer_state": transfer.state.value
        }
    
    async def process_buyer_refund(
        self,
        escrow_id: str,
        buyer_phone: str,
        tigerbeetle_transfer_id: str,
        reason: str,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """
        Process buyer refund from escrow via Mojaloop.
        
        Flow:
        1. Void TigerBeetle escrow hold
        2. Look up buyer's DFSP
        3. Create quote for refund
        4. Initiate transfer from SocialEscrow to buyer
        """
        from app.tigerbeetle_ledger import kobo_to_naira
        
        ledger = await self._get_tigerbeetle()
        
        # Step 1: Refund TigerBeetle escrow
        tb_result = await ledger.refund_escrow(
            escrow_id=escrow_id,
            buyer_id=buyer_phone,
            escrow_transfer_id=int(tigerbeetle_transfer_id)
        )
        
        if not tb_result.get("success"):
            return {"success": False, "error": "TigerBeetle refund failed", "details": tb_result}
        
        amount_kobo = tb_result.get("amount_refunded", 0)
        amount_naira = kobo_to_naira(amount_kobo)
        
        # Step 2: Look up buyer's DFSP
        buyer_party = await self.mojaloop.lookup_party(
            PartyIdType.MSISDN,
            buyer_phone
        )
        
        if not buyer_party:
            return {
                "success": False,
                "error": "Buyer DFSP lookup pending",
                "tigerbeetle_refunded": True,
                "amount_naira": amount_naira
            }
        
        # Our escrow account as payer
        escrow_party = Party(
            party_id_type=PartyIdType.BUSINESS,
            party_id_value=escrow_id,
            fsp_id=ESCROW_DFSP_ID,
            name=ESCROW_DFSP_NAME
        )
        
        # Step 3: Create quote for refund
        quote = await self.mojaloop.create_quote(
            payer=escrow_party,
            payee=buyer_party,
            amount=Money(amount=str(amount_naira), currency="NGN"),
            note=f"Escrow refund: {reason}"
        )
        
        if quote.state != QuoteState.ACCEPTED:
            return {
                "success": False,
                "error": "Refund quote not accepted",
                "tigerbeetle_refunded": True,
                "quote_id": quote.quote_id
            }
        
        # Step 4: Initiate refund transfer
        transfer = await self.mojaloop.initiate_transfer(
            quote=quote,
            idempotency_key=f"refund:{idempotency_key}"
        )
        
        return {
            "success": transfer.state == TransferState.COMMITTED,
            "escrow_id": escrow_id,
            "mojaloop_transfer_id": transfer.transfer_id,
            "tigerbeetle_refund_id": tb_result.get("refund_transfer_id"),
            "amount_naira": amount_naira,
            "reason": reason,
            "transfer_state": transfer.state.value
        }


# Global instances
mojaloop_adapter = MojaloopAdapter()
escrow_mojaloop = EscrowMojaloopIntegration()


# Nigerian bank DFSP mappings (for reference)
NIGERIAN_DFSP_MAPPINGS = {
    "044": {"dfsp_id": "accessbank", "name": "Access Bank"},
    "050": {"dfsp_id": "ecobank", "name": "Ecobank Nigeria"},
    "070": {"dfsp_id": "fidelitybank", "name": "Fidelity Bank"},
    "011": {"dfsp_id": "firstbank", "name": "First Bank of Nigeria"},
    "058": {"dfsp_id": "gtbank", "name": "Guaranty Trust Bank"},
    "030": {"dfsp_id": "heritagebank", "name": "Heritage Bank"},
    "076": {"dfsp_id": "polarisbank", "name": "Polaris Bank"},
    "221": {"dfsp_id": "stanbicibtc", "name": "Stanbic IBTC Bank"},
    "232": {"dfsp_id": "sterlingbank", "name": "Sterling Bank"},
    "032": {"dfsp_id": "unionbank", "name": "Union Bank of Nigeria"},
    "033": {"dfsp_id": "uba", "name": "United Bank for Africa"},
    "035": {"dfsp_id": "wemabank", "name": "Wema Bank"},
    "057": {"dfsp_id": "zenithbank", "name": "Zenith Bank"},
    "999": {"dfsp_id": "opay", "name": "OPay"},
    "998": {"dfsp_id": "palmpay", "name": "PalmPay"},
    "997": {"dfsp_id": "kudabank", "name": "Kuda Bank"},
    "996": {"dfsp_id": "moniepoint", "name": "Moniepoint"},
}
