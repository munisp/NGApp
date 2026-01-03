"""
Logistics Integration Module for EscrowProtect
Integrates with Nigerian courier services (Gokada, Kwik, GIG Logistics, etc.)
for real-time delivery tracking and proof-of-delivery capture.
"""

import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean
from sqlalchemy.orm import relationship

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    PICKUP_SCHEDULED = "pickup_scheduled"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    DELIVERY_ATTEMPTED = "delivery_attempted"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class ProofOfDeliveryType(str, Enum):
    SIGNATURE = "signature"
    PHOTO = "photo"
    OTP = "otp"
    RECIPIENT_ID = "recipient_id"


class CourierProvider(str, Enum):
    GOKADA = "gokada"
    KWIK = "kwik"
    GIG_LOGISTICS = "gig_logistics"
    SENDBOX = "sendbox"
    TOPSHIP = "topship"
    KOBO360 = "kobo360"


# Database Models
class Shipment(Base):
    __tablename__ = "shipments"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=False, index=True)
    courier_provider = Column(SQLEnum(CourierProvider), nullable=False)
    tracking_number = Column(String(100), unique=True, index=True)
    external_shipment_id = Column(String(100))
    
    # Addresses
    pickup_address = Column(Text, nullable=False)
    pickup_city = Column(String(100))
    pickup_state = Column(String(100))
    pickup_phone = Column(String(20))
    pickup_name = Column(String(200))
    
    delivery_address = Column(Text, nullable=False)
    delivery_city = Column(String(100))
    delivery_state = Column(String(100))
    delivery_phone = Column(String(20))
    delivery_name = Column(String(200))
    
    # Package details
    package_description = Column(Text)
    package_weight_kg = Column(Float)
    package_dimensions = Column(String(100))  # LxWxH in cm
    declared_value = Column(Float)
    
    # Status tracking
    status = Column(SQLEnum(DeliveryStatus), default=DeliveryStatus.PENDING)
    status_history = Column(Text)  # JSON array of status changes
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    pickup_scheduled_at = Column(DateTime)
    picked_up_at = Column(DateTime)
    estimated_delivery_at = Column(DateTime)
    delivered_at = Column(DateTime)
    
    # Proof of delivery
    pod_type = Column(SQLEnum(ProofOfDeliveryType))
    pod_signature_url = Column(String(500))
    pod_photo_url = Column(String(500))
    pod_otp_verified = Column(Boolean, default=False)
    pod_recipient_name = Column(String(200))
    pod_recipient_id_number = Column(String(50))
    pod_notes = Column(Text)
    pod_captured_at = Column(DateTime)
    pod_latitude = Column(Float)
    pod_longitude = Column(Float)
    
    # Courier fees
    shipping_cost = Column(Float)
    insurance_cost = Column(Float)
    
    # Auto-release settings
    auto_release_enabled = Column(Boolean, default=True)
    auto_release_delay_hours = Column(Float, default=24.0)


class TrackingEvent(Base):
    __tablename__ = "tracking_events"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    shipment_id = Column(String(36), ForeignKey("shipments.id"), nullable=False, index=True)
    
    status = Column(SQLEnum(DeliveryStatus), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    
    courier_event_id = Column(String(100))
    courier_event_code = Column(String(50))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    courier_timestamp = Column(DateTime)


# Pydantic Models
class CreateShipmentRequest(BaseModel):
    escrow_id: str
    courier_provider: CourierProvider
    
    pickup_address: str
    pickup_city: str
    pickup_state: str
    pickup_phone: str
    pickup_name: str
    
    delivery_address: str
    delivery_city: str
    delivery_state: str
    delivery_phone: str
    delivery_name: str
    
    package_description: str
    package_weight_kg: float = 1.0
    package_dimensions: Optional[str] = None
    declared_value: Optional[float] = None
    
    auto_release_enabled: bool = True
    auto_release_delay_hours: float = 24.0


class ShipmentResponse(BaseModel):
    id: str
    escrow_id: str
    tracking_number: str
    courier_provider: CourierProvider
    status: DeliveryStatus
    estimated_delivery_at: Optional[datetime]
    shipping_cost: Optional[float]
    
    class Config:
        from_attributes = True


class WebhookPayload(BaseModel):
    provider: CourierProvider
    tracking_number: str
    status: str
    description: Optional[str]
    location: Optional[str]
    timestamp: datetime
    signature: str
    
    # POD fields (optional)
    pod_type: Optional[ProofOfDeliveryType]
    pod_signature_url: Optional[str]
    pod_photo_url: Optional[str]
    pod_otp: Optional[str]
    pod_recipient_name: Optional[str]
    pod_latitude: Optional[float]
    pod_longitude: Optional[float]


# Courier Provider Clients
class BaseCourierClient:
    """Base class for courier provider integrations"""
    
    def __init__(self, api_key: str, api_secret: str, base_url: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def create_shipment(self, request: CreateShipmentRequest) -> dict:
        raise NotImplementedError
    
    async def get_tracking(self, tracking_number: str) -> dict:
        raise NotImplementedError
    
    async def cancel_shipment(self, tracking_number: str) -> bool:
        raise NotImplementedError
    
    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        expected = hmac.new(
            self.api_secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class GokadaClient(BaseCourierClient):
    """Gokada courier integration for Lagos deliveries"""
    
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(
            api_key=api_key,
            api_secret=api_secret,
            base_url="https://api.gokada.ng/v1"
        )
    
    async def create_shipment(self, request: CreateShipmentRequest) -> dict:
        payload = {
            "pickup": {
                "address": request.pickup_address,
                "city": request.pickup_city,
                "phone": request.pickup_phone,
                "name": request.pickup_name,
            },
            "delivery": {
                "address": request.delivery_address,
                "city": request.delivery_city,
                "phone": request.delivery_phone,
                "name": request.delivery_name,
            },
            "package": {
                "description": request.package_description,
                "weight": request.package_weight_kg,
                "value": request.declared_value or 0,
            },
            "webhook_url": "https://api.escrowprotect.ng/api/v1/logistics/webhook/gokada",
        }
        
        response = await self.client.post(
            f"{self.base_url}/deliveries",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        response.raise_for_status()
        return response.json()
    
    async def get_tracking(self, tracking_number: str) -> dict:
        response = await self.client.get(
            f"{self.base_url}/deliveries/{tracking_number}",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        response.raise_for_status()
        return response.json()


class KwikClient(BaseCourierClient):
    """Kwik Delivery integration for same-day deliveries"""
    
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(
            api_key=api_key,
            api_secret=api_secret,
            base_url="https://api.kwik.delivery/v2"
        )
    
    async def create_shipment(self, request: CreateShipmentRequest) -> dict:
        payload = {
            "origin": {
                "address": request.pickup_address,
                "city": request.pickup_city,
                "state": request.pickup_state,
                "contact_name": request.pickup_name,
                "contact_phone": request.pickup_phone,
            },
            "destination": {
                "address": request.delivery_address,
                "city": request.delivery_city,
                "state": request.delivery_state,
                "contact_name": request.delivery_name,
                "contact_phone": request.delivery_phone,
            },
            "package_details": {
                "description": request.package_description,
                "weight_kg": request.package_weight_kg,
                "dimensions": request.package_dimensions,
                "declared_value": request.declared_value,
            },
            "callback_url": "https://api.escrowprotect.ng/api/v1/logistics/webhook/kwik",
            "require_pod": True,
            "pod_type": "photo_and_signature",
        }
        
        response = await self.client.post(
            f"{self.base_url}/orders",
            json=payload,
            headers={
                "X-API-Key": self.api_key,
                "X-API-Secret": self.api_secret,
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_tracking(self, tracking_number: str) -> dict:
        response = await self.client.get(
            f"{self.base_url}/orders/{tracking_number}/tracking",
            headers={
                "X-API-Key": self.api_key,
                "X-API-Secret": self.api_secret,
            }
        )
        response.raise_for_status()
        return response.json()


class GIGLogisticsClient(BaseCourierClient):
    """GIG Logistics integration for nationwide deliveries"""
    
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(
            api_key=api_key,
            api_secret=api_secret,
            base_url="https://api.giglogistics.com/v1"
        )
    
    async def create_shipment(self, request: CreateShipmentRequest) -> dict:
        payload = {
            "sender": {
                "name": request.pickup_name,
                "phone": request.pickup_phone,
                "address": request.pickup_address,
                "city": request.pickup_city,
                "state": request.pickup_state,
            },
            "receiver": {
                "name": request.delivery_name,
                "phone": request.delivery_phone,
                "address": request.delivery_address,
                "city": request.delivery_city,
                "state": request.delivery_state,
            },
            "shipment": {
                "description": request.package_description,
                "weight": request.package_weight_kg,
                "value": request.declared_value,
                "payment_type": "prepaid",
            },
            "webhook": "https://api.escrowprotect.ng/api/v1/logistics/webhook/gig",
        }
        
        response = await self.client.post(
            f"{self.base_url}/shipments",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        response.raise_for_status()
        return response.json()
    
    async def get_tracking(self, tracking_number: str) -> dict:
        response = await self.client.get(
            f"{self.base_url}/shipments/{tracking_number}/track",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        response.raise_for_status()
        return response.json()


# Logistics Service
class LogisticsService:
    """Main logistics service coordinating all courier integrations"""
    
    def __init__(self, event_bus: EventBus, redis_client: Any):
        self.event_bus = event_bus
        self.redis = redis_client
        self.clients: dict[CourierProvider, BaseCourierClient] = {}
        
        # Status mapping from courier-specific to normalized
        self.status_mapping = {
            # Gokada statuses
            "pending": DeliveryStatus.PENDING,
            "assigned": DeliveryStatus.PICKUP_SCHEDULED,
            "picked_up": DeliveryStatus.PICKED_UP,
            "in_transit": DeliveryStatus.IN_TRANSIT,
            "arrived": DeliveryStatus.OUT_FOR_DELIVERY,
            "delivered": DeliveryStatus.DELIVERED,
            "failed": DeliveryStatus.DELIVERY_ATTEMPTED,
            "cancelled": DeliveryStatus.CANCELLED,
            
            # Kwik statuses
            "order_placed": DeliveryStatus.PENDING,
            "rider_assigned": DeliveryStatus.PICKUP_SCHEDULED,
            "pickup_complete": DeliveryStatus.PICKED_UP,
            "en_route": DeliveryStatus.IN_TRANSIT,
            "near_destination": DeliveryStatus.OUT_FOR_DELIVERY,
            "completed": DeliveryStatus.DELIVERED,
            "attempt_failed": DeliveryStatus.DELIVERY_ATTEMPTED,
            
            # GIG statuses
            "booked": DeliveryStatus.PENDING,
            "collected": DeliveryStatus.PICKED_UP,
            "hub_arrival": DeliveryStatus.IN_TRANSIT,
            "out_for_delivery": DeliveryStatus.OUT_FOR_DELIVERY,
            "pod_captured": DeliveryStatus.DELIVERED,
            "returned_to_sender": DeliveryStatus.RETURNED,
        }
    
    def register_client(self, provider: CourierProvider, client: BaseCourierClient):
        self.clients[provider] = client
    
    async def create_shipment(self, db, request: CreateShipmentRequest) -> Shipment:
        """Create a new shipment with the specified courier"""
        
        client = self.clients.get(request.courier_provider)
        if not client:
            raise ValueError(f"Courier provider {request.courier_provider} not configured")
        
        # Create shipment with courier
        courier_response = await client.create_shipment(request)
        
        # Create local shipment record
        shipment = Shipment(
            escrow_id=request.escrow_id,
            courier_provider=request.courier_provider,
            tracking_number=courier_response.get("tracking_number") or courier_response.get("order_id"),
            external_shipment_id=courier_response.get("id"),
            
            pickup_address=request.pickup_address,
            pickup_city=request.pickup_city,
            pickup_state=request.pickup_state,
            pickup_phone=request.pickup_phone,
            pickup_name=request.pickup_name,
            
            delivery_address=request.delivery_address,
            delivery_city=request.delivery_city,
            delivery_state=request.delivery_state,
            delivery_phone=request.delivery_phone,
            delivery_name=request.delivery_name,
            
            package_description=request.package_description,
            package_weight_kg=request.package_weight_kg,
            package_dimensions=request.package_dimensions,
            declared_value=request.declared_value,
            
            status=DeliveryStatus.PENDING,
            status_history=json.dumps([{
                "status": DeliveryStatus.PENDING.value,
                "timestamp": datetime.utcnow().isoformat(),
                "description": "Shipment created",
            }]),
            
            estimated_delivery_at=courier_response.get("estimated_delivery"),
            shipping_cost=courier_response.get("price") or courier_response.get("cost"),
            
            auto_release_enabled=request.auto_release_enabled,
            auto_release_delay_hours=request.auto_release_delay_hours,
        )
        
        db.add(shipment)
        db.commit()
        db.refresh(shipment)
        
        # Publish event
        await self.event_bus.publish(Event(
            type="shipment.created",
            data={
                "shipment_id": shipment.id,
                "escrow_id": shipment.escrow_id,
                "tracking_number": shipment.tracking_number,
                "courier": shipment.courier_provider.value,
            }
        ))
        
        # Cache tracking number -> shipment_id mapping
        await self.redis.set(
            f"tracking:{shipment.tracking_number}",
            shipment.id,
            ex=86400 * 30  # 30 days
        )
        
        return shipment
    
    async def process_webhook(self, db, payload: WebhookPayload) -> Shipment:
        """Process incoming webhook from courier provider"""
        
        # Get shipment by tracking number
        shipment_id = await self.redis.get(f"tracking:{payload.tracking_number}")
        if not shipment_id:
            shipment = db.query(Shipment).filter(
                Shipment.tracking_number == payload.tracking_number
            ).first()
            if not shipment:
                raise ValueError(f"Shipment not found: {payload.tracking_number}")
            shipment_id = shipment.id
        else:
            shipment = db.query(Shipment).filter(Shipment.id == shipment_id).first()
        
        # Verify webhook signature
        client = self.clients.get(payload.provider)
        if client and not client.verify_webhook_signature(
            json.dumps(payload.dict(), default=str),
            payload.signature
        ):
            raise ValueError("Invalid webhook signature")
        
        # Normalize status
        normalized_status = self.status_mapping.get(
            payload.status.lower(),
            DeliveryStatus.IN_TRANSIT
        )
        
        # Update shipment status
        old_status = shipment.status
        shipment.status = normalized_status
        
        # Update status history
        history = json.loads(shipment.status_history or "[]")
        history.append({
            "status": normalized_status.value,
            "timestamp": payload.timestamp.isoformat(),
            "description": payload.description,
            "location": payload.location,
        })
        shipment.status_history = json.dumps(history)
        
        # Create tracking event
        tracking_event = TrackingEvent(
            shipment_id=shipment.id,
            status=normalized_status,
            description=payload.description,
            location=payload.location,
            latitude=payload.pod_latitude,
            longitude=payload.pod_longitude,
            courier_timestamp=payload.timestamp,
        )
        db.add(tracking_event)
        
        # Handle proof of delivery
        if normalized_status == DeliveryStatus.DELIVERED:
            shipment.delivered_at = payload.timestamp
            
            if payload.pod_type:
                shipment.pod_type = payload.pod_type
                shipment.pod_signature_url = payload.pod_signature_url
                shipment.pod_photo_url = payload.pod_photo_url
                shipment.pod_recipient_name = payload.pod_recipient_name
                shipment.pod_latitude = payload.pod_latitude
                shipment.pod_longitude = payload.pod_longitude
                shipment.pod_captured_at = payload.timestamp
        
        elif normalized_status == DeliveryStatus.PICKED_UP:
            shipment.picked_up_at = payload.timestamp
        
        db.commit()
        db.refresh(shipment)
        
        # Publish status change event
        await self.event_bus.publish(Event(
            type="shipment.status_changed",
            data={
                "shipment_id": shipment.id,
                "escrow_id": shipment.escrow_id,
                "tracking_number": shipment.tracking_number,
                "old_status": old_status.value,
                "new_status": normalized_status.value,
                "has_pod": shipment.pod_type is not None,
            }
        ))
        
        # Trigger auto-release check if delivered
        if normalized_status == DeliveryStatus.DELIVERED and shipment.auto_release_enabled:
            await self.event_bus.publish(Event(
                type="shipment.delivered_auto_release_pending",
                data={
                    "shipment_id": shipment.id,
                    "escrow_id": shipment.escrow_id,
                    "auto_release_at": (
                        shipment.delivered_at + 
                        timedelta(hours=shipment.auto_release_delay_hours)
                    ).isoformat(),
                }
            ))
        
        return shipment
    
    async def get_tracking_info(self, db, tracking_number: str) -> dict:
        """Get comprehensive tracking information"""
        
        shipment = db.query(Shipment).filter(
            Shipment.tracking_number == tracking_number
        ).first()
        
        if not shipment:
            raise ValueError(f"Shipment not found: {tracking_number}")
        
        events = db.query(TrackingEvent).filter(
            TrackingEvent.shipment_id == shipment.id
        ).order_by(TrackingEvent.created_at.desc()).all()
        
        return {
            "shipment": {
                "id": shipment.id,
                "escrow_id": shipment.escrow_id,
                "tracking_number": shipment.tracking_number,
                "courier": shipment.courier_provider.value,
                "status": shipment.status.value,
                "estimated_delivery": shipment.estimated_delivery_at,
                "delivered_at": shipment.delivered_at,
            },
            "proof_of_delivery": {
                "type": shipment.pod_type.value if shipment.pod_type else None,
                "signature_url": shipment.pod_signature_url,
                "photo_url": shipment.pod_photo_url,
                "recipient_name": shipment.pod_recipient_name,
                "captured_at": shipment.pod_captured_at,
                "location": {
                    "latitude": shipment.pod_latitude,
                    "longitude": shipment.pod_longitude,
                } if shipment.pod_latitude else None,
            } if shipment.pod_type else None,
            "events": [
                {
                    "status": e.status.value,
                    "description": e.description,
                    "location": e.location,
                    "timestamp": e.courier_timestamp or e.created_at,
                }
                for e in events
            ],
        }
    
    async def capture_manual_pod(
        self,
        db,
        tracking_number: str,
        pod_type: ProofOfDeliveryType,
        signature_url: Optional[str] = None,
        photo_url: Optional[str] = None,
        otp: Optional[str] = None,
        recipient_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> Shipment:
        """Manually capture proof of delivery (for cases where courier doesn't provide it)"""
        
        shipment = db.query(Shipment).filter(
            Shipment.tracking_number == tracking_number
        ).first()
        
        if not shipment:
            raise ValueError(f"Shipment not found: {tracking_number}")
        
        shipment.pod_type = pod_type
        shipment.pod_signature_url = signature_url
        shipment.pod_photo_url = photo_url
        shipment.pod_recipient_name = recipient_name
        shipment.pod_latitude = latitude
        shipment.pod_longitude = longitude
        shipment.pod_captured_at = datetime.utcnow()
        
        # If OTP verification
        if pod_type == ProofOfDeliveryType.OTP:
            # Verify OTP from cache
            cached_otp = await self.redis.get(f"pod_otp:{tracking_number}")
            if cached_otp and cached_otp == otp:
                shipment.pod_otp_verified = True
            else:
                raise ValueError("Invalid OTP")
        
        # Update status to delivered if not already
        if shipment.status != DeliveryStatus.DELIVERED:
            shipment.status = DeliveryStatus.DELIVERED
            shipment.delivered_at = datetime.utcnow()
        
        db.commit()
        db.refresh(shipment)
        
        # Publish POD captured event
        await self.event_bus.publish(Event(
            type="shipment.pod_captured",
            data={
                "shipment_id": shipment.id,
                "escrow_id": shipment.escrow_id,
                "tracking_number": shipment.tracking_number,
                "pod_type": pod_type.value,
            }
        ))
        
        return shipment
    
    async def generate_delivery_otp(self, tracking_number: str) -> str:
        """Generate OTP for delivery verification"""
        import random
        otp = str(random.randint(100000, 999999))
        await self.redis.set(f"pod_otp:{tracking_number}", otp, ex=3600)  # 1 hour expiry
        return otp


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/logistics", tags=["logistics"])


@router.post("/shipments", response_model=ShipmentResponse)
async def create_shipment(
    request: CreateShipmentRequest,
    db: Session = Depends(get_db),
):
    """Create a new shipment for an escrow transaction"""
    try:
        # Get logistics service from app state
        from app.main import get_logistics_service
        service = get_logistics_service()
        shipment = await service.create_shipment(db, request)
        return ShipmentResponse.from_orm(shipment)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/shipments/{tracking_number}")
async def get_tracking(
    tracking_number: str,
    db: Session = Depends(get_db),
):
    """Get tracking information for a shipment"""
    try:
        from app.main import get_logistics_service
        service = get_logistics_service()
        return await service.get_tracking_info(db, tracking_number)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/webhook/{provider}")
async def handle_webhook(
    provider: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle incoming webhooks from courier providers"""
    try:
        body = await request.json()
        signature = request.headers.get("X-Webhook-Signature", "")
        
        payload = WebhookPayload(
            provider=CourierProvider(provider),
            tracking_number=body.get("tracking_number") or body.get("order_id"),
            status=body.get("status"),
            description=body.get("description") or body.get("message"),
            location=body.get("location"),
            timestamp=datetime.fromisoformat(body.get("timestamp", datetime.utcnow().isoformat())),
            signature=signature,
            pod_type=body.get("pod_type"),
            pod_signature_url=body.get("pod_signature_url"),
            pod_photo_url=body.get("pod_photo_url"),
            pod_recipient_name=body.get("pod_recipient_name"),
            pod_latitude=body.get("latitude"),
            pod_longitude=body.get("longitude"),
        )
        
        from app.main import get_logistics_service
        service = get_logistics_service()
        shipment = await service.process_webhook(db, payload)
        
        return {"status": "ok", "shipment_id": shipment.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/shipments/{tracking_number}/pod")
async def capture_pod(
    tracking_number: str,
    pod_type: ProofOfDeliveryType,
    signature_url: Optional[str] = None,
    photo_url: Optional[str] = None,
    otp: Optional[str] = None,
    recipient_name: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Manually capture proof of delivery"""
    try:
        from app.main import get_logistics_service
        service = get_logistics_service()
        shipment = await service.capture_manual_pod(
            db, tracking_number, pod_type,
            signature_url, photo_url, otp,
            recipient_name, latitude, longitude
        )
        return {"status": "ok", "shipment_id": shipment.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/shipments/{tracking_number}/generate-otp")
async def generate_otp(tracking_number: str):
    """Generate OTP for delivery verification"""
    from app.main import get_logistics_service
    service = get_logistics_service()
    otp = await service.generate_delivery_otp(tracking_number)
    return {"otp": otp, "expires_in": 3600}
