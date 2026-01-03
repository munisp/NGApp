"""
Transaction History & Shareable Receipts for EscrowProtect
Generates receipts for all transaction events that can be shared
back into WhatsApp/Instagram chats as credible proof.
"""

import hashlib
import json
import qrcode
import io
import base64
from datetime import datetime
from enum import Enum
from typing import Any, Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class ReceiptType(str, Enum):
    ESCROW_CREATED = "escrow_created"
    PAYMENT_RECEIVED = "payment_received"
    SELLER_ACCEPTED = "seller_accepted"
    ITEM_SHIPPED = "item_shipped"
    ITEM_DELIVERED = "item_delivered"
    FUNDS_RELEASED = "funds_released"
    REFUND_ISSUED = "refund_issued"
    DISPUTE_OPENED = "dispute_opened"
    DISPUTE_RESOLVED = "dispute_resolved"
    PAYOUT_COMPLETED = "payout_completed"


class TransactionType(str, Enum):
    ESCROW_DEPOSIT = "escrow_deposit"
    ESCROW_RELEASE = "escrow_release"
    ESCROW_REFUND = "escrow_refund"
    ESCROW_SPLIT = "escrow_split"
    PAYOUT = "payout"
    FEE_DEDUCTION = "fee_deduction"
    DISPUTE_REFUND = "dispute_refund"


# Database Models
class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    receipt_number = Column(String(30), unique=True, index=True)
    
    # References
    escrow_id = Column(String(36), ForeignKey("escrows.id"), index=True)
    user_id = Column(String(36), nullable=False, index=True)
    transaction_id = Column(String(36), ForeignKey("transaction_history.id"))
    
    # Receipt details
    receipt_type = Column(SQLEnum(ReceiptType), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # Amount
    amount = Column(Float)
    currency = Column(String(3), default="NGN")
    
    # Parties
    from_party = Column(String(200))
    to_party = Column(String(200))
    
    # Verification
    verification_hash = Column(String(64))  # SHA-256
    verification_url = Column(String(500))
    qr_code_data = Column(Text)  # Base64 encoded QR code
    
    # Sharing
    short_link = Column(String(100), unique=True, index=True)
    share_count = Column(Integer, default=0)
    last_shared_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(Text)  # Additional receipt data
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiry for sensitive receipts


class TransactionHistory(Base):
    __tablename__ = "transaction_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    
    # References
    escrow_id = Column(String(36), ForeignKey("escrows.id"), index=True)
    user_id = Column(String(36), nullable=False, index=True)
    
    # Transaction details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    reference = Column(String(100), unique=True, index=True)
    
    # Amount
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="NGN")
    
    # Parties
    from_account = Column(String(100))
    to_account = Column(String(100))
    
    # Status
    status = Column(String(20), default="completed")
    
    # Ledger reference
    ledger_entry_id = Column(String(100))
    
    # Metadata
    description = Column(Text)
    metadata_json = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    receipt = relationship("Receipt", backref="transaction", uselist=False)


class UserTransactionSummary(Base):
    __tablename__ = "user_transaction_summaries"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # Totals
    total_transactions = Column(Integer, default=0)
    total_volume = Column(Float, default=0.0)
    total_as_buyer = Column(Float, default=0.0)
    total_as_seller = Column(Float, default=0.0)
    
    # Counts
    successful_transactions = Column(Integer, default=0)
    disputed_transactions = Column(Integer, default=0)
    refunded_transactions = Column(Integer, default=0)
    
    # Last activity
    last_transaction_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Pydantic Models
class ReceiptResponse(BaseModel):
    id: str
    receipt_number: str
    receipt_type: ReceiptType
    title: str
    amount: Optional[float]
    currency: str
    from_party: Optional[str]
    to_party: Optional[str]
    verification_url: str
    short_link: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionHistoryResponse(BaseModel):
    id: str
    transaction_type: TransactionType
    reference: str
    amount: float
    currency: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ShareReceiptRequest(BaseModel):
    channel: str  # whatsapp, instagram, email, sms
    recipient: str  # phone number or handle


# Receipt Service
class ReceiptService:
    """Service for generating and managing receipts"""
    
    BASE_URL = "https://escrowprotect.ng"
    
    def __init__(self, event_bus: EventBus, redis_client: Any, storage_client: Any):
        self.event_bus = event_bus
        self.redis = redis_client
        self.storage = storage_client
    
    def _generate_receipt_number(self, receipt_type: ReceiptType) -> str:
        """Generate unique receipt number"""
        prefix_map = {
            ReceiptType.ESCROW_CREATED: "ESC",
            ReceiptType.PAYMENT_RECEIVED: "PAY",
            ReceiptType.SELLER_ACCEPTED: "ACC",
            ReceiptType.ITEM_SHIPPED: "SHP",
            ReceiptType.ITEM_DELIVERED: "DLV",
            ReceiptType.FUNDS_RELEASED: "REL",
            ReceiptType.REFUND_ISSUED: "REF",
            ReceiptType.DISPUTE_OPENED: "DSP",
            ReceiptType.DISPUTE_RESOLVED: "RSL",
            ReceiptType.PAYOUT_COMPLETED: "PYT",
        }
        prefix = prefix_map.get(receipt_type, "RCP")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(1000, 9999)
        return f"{prefix}-{timestamp}-{suffix}"
    
    def _generate_short_link(self) -> str:
        """Generate short link for receipt sharing"""
        import string
        import random
        chars = string.ascii_letters + string.digits
        code = ''.join(random.choices(chars, k=8))
        return f"r/{code}"
    
    def _generate_verification_hash(self, receipt_data: dict) -> str:
        """Generate SHA-256 hash for receipt verification"""
        data_string = json.dumps(receipt_data, sort_keys=True, default=str)
        return hashlib.sha256(data_string.encode()).hexdigest()
    
    def _generate_qr_code(self, verification_url: str) -> str:
        """Generate QR code as base64 string"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(verification_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()
    
    async def create_receipt(
        self,
        db,
        receipt_type: ReceiptType,
        escrow_id: str,
        user_id: str,
        title: str,
        amount: Optional[float] = None,
        currency: str = "NGN",
        from_party: Optional[str] = None,
        to_party: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[dict] = None,
        transaction_id: Optional[str] = None,
    ) -> Receipt:
        """Create a new receipt"""
        
        receipt_number = self._generate_receipt_number(receipt_type)
        short_link = self._generate_short_link()
        
        # Build receipt data for verification
        receipt_data = {
            "receipt_number": receipt_number,
            "receipt_type": receipt_type.value,
            "escrow_id": escrow_id,
            "amount": amount,
            "currency": currency,
            "from_party": from_party,
            "to_party": to_party,
            "created_at": datetime.utcnow().isoformat(),
        }
        
        verification_hash = self._generate_verification_hash(receipt_data)
        verification_url = f"{self.BASE_URL}/verify/{receipt_number}"
        qr_code_data = self._generate_qr_code(verification_url)
        
        receipt = Receipt(
            receipt_number=receipt_number,
            escrow_id=escrow_id,
            user_id=user_id,
            transaction_id=transaction_id,
            receipt_type=receipt_type,
            title=title,
            description=description,
            amount=amount,
            currency=currency,
            from_party=from_party,
            to_party=to_party,
            verification_hash=verification_hash,
            verification_url=verification_url,
            qr_code_data=qr_code_data,
            short_link=short_link,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
        
        # Cache short link mapping
        await self.redis.set(
            f"receipt_link:{short_link}",
            receipt.id,
            ex=86400 * 365  # 1 year
        )
        
        # Publish event
        await self.event_bus.publish(Event(
            type="receipt.created",
            data={
                "receipt_id": receipt.id,
                "receipt_number": receipt_number,
                "receipt_type": receipt_type.value,
                "escrow_id": escrow_id,
                "user_id": user_id,
            }
        ))
        
        return receipt
    
    async def get_receipt_by_short_link(self, db, short_link: str) -> Optional[Receipt]:
        """Get receipt by short link"""
        receipt_id = await self.redis.get(f"receipt_link:{short_link}")
        if receipt_id:
            return db.query(Receipt).filter(Receipt.id == receipt_id).first()
        return db.query(Receipt).filter(Receipt.short_link == short_link).first()
    
    async def verify_receipt(self, db, receipt_number: str) -> dict:
        """Verify receipt authenticity"""
        receipt = db.query(Receipt).filter(
            Receipt.receipt_number == receipt_number
        ).first()
        
        if not receipt:
            return {"valid": False, "error": "Receipt not found"}
        
        # Rebuild verification hash
        receipt_data = {
            "receipt_number": receipt.receipt_number,
            "receipt_type": receipt.receipt_type.value,
            "escrow_id": receipt.escrow_id,
            "amount": receipt.amount,
            "currency": receipt.currency,
            "from_party": receipt.from_party,
            "to_party": receipt.to_party,
            "created_at": receipt.created_at.isoformat(),
        }
        
        expected_hash = self._generate_verification_hash(receipt_data)
        
        return {
            "valid": expected_hash == receipt.verification_hash,
            "receipt_number": receipt.receipt_number,
            "receipt_type": receipt.receipt_type.value,
            "title": receipt.title,
            "amount": receipt.amount,
            "currency": receipt.currency,
            "created_at": receipt.created_at.isoformat(),
        }
    
    async def share_receipt(
        self,
        db,
        receipt_id: str,
        channel: str,
        recipient: str
    ) -> dict:
        """Share receipt via specified channel"""
        
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt:
            raise ValueError("Receipt not found")
        
        share_url = f"{self.BASE_URL}/{receipt.short_link}"
        
        # Update share count
        receipt.share_count += 1
        receipt.last_shared_at = datetime.utcnow()
        db.commit()
        
        # Generate share message
        message = self._generate_share_message(receipt, share_url)
        
        # Publish share event for async processing
        await self.event_bus.publish(Event(
            type="receipt.share_requested",
            data={
                "receipt_id": receipt_id,
                "channel": channel,
                "recipient": recipient,
                "message": message,
                "share_url": share_url,
            }
        ))
        
        return {
            "status": "queued",
            "share_url": share_url,
            "message": message,
        }
    
    def _generate_share_message(self, receipt: Receipt, share_url: str) -> str:
        """Generate shareable message for receipt"""
        
        amount_str = f"₦{receipt.amount:,.2f}" if receipt.amount else ""
        
        messages = {
            ReceiptType.ESCROW_CREATED: f"🔒 Escrow Created\n{receipt.title}\n{amount_str}\n\nVerify: {share_url}",
            ReceiptType.PAYMENT_RECEIVED: f"✅ Payment Received\n{receipt.title}\n{amount_str}\n\nVerify: {share_url}",
            ReceiptType.ITEM_SHIPPED: f"📦 Item Shipped\n{receipt.title}\n\nTrack & Verify: {share_url}",
            ReceiptType.ITEM_DELIVERED: f"🎉 Item Delivered\n{receipt.title}\n\nVerify: {share_url}",
            ReceiptType.FUNDS_RELEASED: f"💰 Funds Released\n{receipt.title}\n{amount_str}\n\nVerify: {share_url}",
            ReceiptType.REFUND_ISSUED: f"↩️ Refund Issued\n{receipt.title}\n{amount_str}\n\nVerify: {share_url}",
        }
        
        return messages.get(
            receipt.receipt_type,
            f"📄 {receipt.title}\n{amount_str}\n\nVerify: {share_url}"
        )
    
    async def generate_receipt_pdf(self, db, receipt_id: str) -> bytes:
        """Generate PDF version of receipt"""
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch
        
        receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not receipt:
            raise ValueError("Receipt not found")
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawString(1*inch, height - 1*inch, "EscrowProtect")
        
        c.setFont("Helvetica", 12)
        c.drawString(1*inch, height - 1.3*inch, "Transaction Receipt")
        
        # Receipt details
        y = height - 2*inch
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1*inch, y, receipt.title)
        
        y -= 0.5*inch
        c.setFont("Helvetica", 11)
        details = [
            f"Receipt Number: {receipt.receipt_number}",
            f"Type: {receipt.receipt_type.value.replace('_', ' ').title()}",
            f"Date: {receipt.created_at.strftime('%B %d, %Y %H:%M UTC')}",
        ]
        
        if receipt.amount:
            details.append(f"Amount: ₦{receipt.amount:,.2f} {receipt.currency}")
        if receipt.from_party:
            details.append(f"From: {receipt.from_party}")
        if receipt.to_party:
            details.append(f"To: {receipt.to_party}")
        
        for detail in details:
            c.drawString(1*inch, y, detail)
            y -= 0.3*inch
        
        # QR Code
        if receipt.qr_code_data:
            qr_image = base64.b64decode(receipt.qr_code_data)
            qr_buffer = io.BytesIO(qr_image)
            c.drawImage(qr_buffer, width - 2.5*inch, height - 3*inch, 1.5*inch, 1.5*inch)
        
        # Verification
        y -= 0.5*inch
        c.setFont("Helvetica", 9)
        c.drawString(1*inch, y, f"Verification URL: {receipt.verification_url}")
        y -= 0.2*inch
        c.drawString(1*inch, y, f"Hash: {receipt.verification_hash[:32]}...")
        
        # Footer
        c.setFont("Helvetica", 8)
        c.drawString(1*inch, 0.5*inch, "This receipt is digitally signed and can be verified at escrowprotect.ng")
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()


# Transaction History Service
class TransactionHistoryService:
    """Service for managing transaction history"""
    
    def __init__(self, event_bus: EventBus, receipt_service: ReceiptService):
        self.event_bus = event_bus
        self.receipt_service = receipt_service
    
    def _generate_reference(self, transaction_type: TransactionType) -> str:
        """Generate unique transaction reference"""
        prefix_map = {
            TransactionType.ESCROW_DEPOSIT: "DEP",
            TransactionType.ESCROW_RELEASE: "REL",
            TransactionType.ESCROW_REFUND: "REF",
            TransactionType.ESCROW_SPLIT: "SPL",
            TransactionType.PAYOUT: "PYT",
            TransactionType.FEE_DEDUCTION: "FEE",
            TransactionType.DISPUTE_REFUND: "DRF",
        }
        prefix = prefix_map.get(transaction_type, "TXN")
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(100000, 999999)
        return f"{prefix}{timestamp}{suffix}"
    
    async def record_transaction(
        self,
        db,
        transaction_type: TransactionType,
        escrow_id: str,
        user_id: str,
        amount: float,
        currency: str = "NGN",
        from_account: Optional[str] = None,
        to_account: Optional[str] = None,
        description: Optional[str] = None,
        ledger_entry_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        generate_receipt: bool = True,
    ) -> TransactionHistory:
        """Record a transaction in history"""
        
        reference = self._generate_reference(transaction_type)
        
        transaction = TransactionHistory(
            escrow_id=escrow_id,
            user_id=user_id,
            transaction_type=transaction_type,
            reference=reference,
            amount=amount,
            currency=currency,
            from_account=from_account,
            to_account=to_account,
            description=description,
            ledger_entry_id=ledger_entry_id,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        # Update user summary
        await self._update_user_summary(db, user_id, transaction_type, amount)
        
        # Generate receipt if requested
        if generate_receipt:
            receipt_type_map = {
                TransactionType.ESCROW_DEPOSIT: ReceiptType.PAYMENT_RECEIVED,
                TransactionType.ESCROW_RELEASE: ReceiptType.FUNDS_RELEASED,
                TransactionType.ESCROW_REFUND: ReceiptType.REFUND_ISSUED,
                TransactionType.PAYOUT: ReceiptType.PAYOUT_COMPLETED,
                TransactionType.DISPUTE_REFUND: ReceiptType.DISPUTE_RESOLVED,
            }
            
            receipt_type = receipt_type_map.get(transaction_type)
            if receipt_type:
                await self.receipt_service.create_receipt(
                    db=db,
                    receipt_type=receipt_type,
                    escrow_id=escrow_id,
                    user_id=user_id,
                    title=description or f"{transaction_type.value.replace('_', ' ').title()}",
                    amount=amount,
                    currency=currency,
                    from_party=from_account,
                    to_party=to_account,
                    transaction_id=transaction.id,
                )
        
        # Publish event
        await self.event_bus.publish(Event(
            type="transaction.recorded",
            data={
                "transaction_id": transaction.id,
                "reference": reference,
                "transaction_type": transaction_type.value,
                "escrow_id": escrow_id,
                "user_id": user_id,
                "amount": amount,
            }
        ))
        
        return transaction
    
    async def _update_user_summary(
        self,
        db,
        user_id: str,
        transaction_type: TransactionType,
        amount: float
    ):
        """Update user's transaction summary"""
        
        summary = db.query(UserTransactionSummary).filter(
            UserTransactionSummary.user_id == user_id
        ).first()
        
        if not summary:
            summary = UserTransactionSummary(user_id=user_id)
            db.add(summary)
        
        summary.total_transactions += 1
        summary.total_volume += amount
        summary.last_transaction_at = datetime.utcnow()
        
        if transaction_type == TransactionType.ESCROW_DEPOSIT:
            summary.total_as_buyer += amount
        elif transaction_type in [TransactionType.ESCROW_RELEASE, TransactionType.PAYOUT]:
            summary.total_as_seller += amount
        elif transaction_type in [TransactionType.ESCROW_REFUND, TransactionType.DISPUTE_REFUND]:
            summary.refunded_transactions += 1
        
        db.commit()
    
    async def get_user_history(
        self,
        db,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
        transaction_type: Optional[TransactionType] = None,
    ) -> List[TransactionHistory]:
        """Get user's transaction history"""
        
        query = db.query(TransactionHistory).filter(
            TransactionHistory.user_id == user_id
        )
        
        if transaction_type:
            query = query.filter(TransactionHistory.transaction_type == transaction_type)
        
        return query.order_by(
            TransactionHistory.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    async def get_escrow_history(self, db, escrow_id: str) -> List[TransactionHistory]:
        """Get all transactions for an escrow"""
        
        return db.query(TransactionHistory).filter(
            TransactionHistory.escrow_id == escrow_id
        ).order_by(TransactionHistory.created_at.asc()).all()


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["receipts", "history"])


@router.get("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
):
    """Get receipt by ID"""
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return ReceiptResponse.from_orm(receipt)


@router.get("/r/{short_link}")
async def get_receipt_by_link(
    short_link: str,
    db: Session = Depends(get_db),
):
    """Get receipt by short link"""
    from app.main import get_receipt_service
    service = get_receipt_service()
    receipt = await service.get_receipt_by_short_link(db, f"r/{short_link}")
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return ReceiptResponse.from_orm(receipt)


@router.get("/verify/{receipt_number}")
async def verify_receipt(
    receipt_number: str,
    db: Session = Depends(get_db),
):
    """Verify receipt authenticity"""
    from app.main import get_receipt_service
    service = get_receipt_service()
    return await service.verify_receipt(db, receipt_number)


@router.post("/receipts/{receipt_id}/share")
async def share_receipt(
    receipt_id: str,
    request: ShareReceiptRequest,
    db: Session = Depends(get_db),
):
    """Share receipt via specified channel"""
    try:
        from app.main import get_receipt_service
        service = get_receipt_service()
        return await service.share_receipt(db, receipt_id, request.channel, request.recipient)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/receipts/{receipt_id}/pdf")
async def download_receipt_pdf(
    receipt_id: str,
    db: Session = Depends(get_db),
):
    """Download receipt as PDF"""
    try:
        from app.main import get_receipt_service
        service = get_receipt_service()
        pdf_bytes = await service.generate_receipt_pdf(db, receipt_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=receipt_{receipt_id}.pdf"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/users/{user_id}/receipts")
async def get_user_receipts(
    user_id: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get user's receipts"""
    receipts = db.query(Receipt).filter(
        Receipt.user_id == user_id
    ).order_by(Receipt.created_at.desc()).offset(offset).limit(limit).all()
    
    return [ReceiptResponse.from_orm(r) for r in receipts]


@router.get("/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: str,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    transaction_type: Optional[TransactionType] = None,
    db: Session = Depends(get_db),
):
    """Get user's transaction history"""
    from app.main import get_transaction_history_service
    service = get_transaction_history_service()
    transactions = await service.get_user_history(db, user_id, limit, offset, transaction_type)
    return [TransactionHistoryResponse.from_orm(t) for t in transactions]


@router.get("/users/{user_id}/summary")
async def get_user_summary(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get user's transaction summary"""
    summary = db.query(UserTransactionSummary).filter(
        UserTransactionSummary.user_id == user_id
    ).first()
    
    if not summary:
        return {
            "total_transactions": 0,
            "total_volume": 0,
            "total_as_buyer": 0,
            "total_as_seller": 0,
            "successful_transactions": 0,
            "disputed_transactions": 0,
            "refunded_transactions": 0,
        }
    
    return {
        "total_transactions": summary.total_transactions,
        "total_volume": summary.total_volume,
        "total_as_buyer": summary.total_as_buyer,
        "total_as_seller": summary.total_as_seller,
        "successful_transactions": summary.successful_transactions,
        "disputed_transactions": summary.disputed_transactions,
        "refunded_transactions": summary.refunded_transactions,
        "last_transaction_at": summary.last_transaction_at,
    }


@router.get("/escrows/{escrow_id}/history")
async def get_escrow_history(
    escrow_id: str,
    db: Session = Depends(get_db),
):
    """Get all transactions and receipts for an escrow"""
    from app.main import get_transaction_history_service
    service = get_transaction_history_service()
    
    transactions = await service.get_escrow_history(db, escrow_id)
    receipts = db.query(Receipt).filter(Receipt.escrow_id == escrow_id).all()
    
    return {
        "transactions": [TransactionHistoryResponse.from_orm(t) for t in transactions],
        "receipts": [ReceiptResponse.from_orm(r) for r in receipts],
    }
