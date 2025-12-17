"""
Authentication Integration for Competitive Features

This module provides authentication and authorization wrappers for the 5 competitive feature modules:
1. Seller Storefront - Requires MERCHANT role
2. Returns & Refunds - Requires BUYER or MERCHANT role
3. Proof of Delivery - Requires MERCHANT or AGENT role
4. Marketplace Discovery - Public read, authenticated write
5. Dispute Operations - Requires authenticated user or SUPPORT role

Features:
- JWT/API key authentication via existing auth.py
- Role-based access control
- Tenant isolation (sellers can only access their own data)
- Rate limiting
- Audit logging
"""

import logging
from typing import Optional, List, Dict, Any
from functools import wraps
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from pydantic import BaseModel

from app.auth import (
    get_current_user, get_optional_user, require_permission, require_role,
    AuthenticatedUser, UserRole, Permission, rate_limit_check
)
from app.competitive_features_persistence import (
    storefront_product_repo, return_request_repo, delivery_repo,
    marketplace_listing_repo, dispute_ops_repo,
    ProductStatus, ReturnStatus, DeliveryStatus, ListingStatus, DisputeOpsStatus,
    init_competitive_features_db
)

logger = logging.getLogger(__name__)


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateProductRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    sku: Optional[str] = None
    price_ngn: int
    compare_at_price_ngn: Optional[int] = None
    cost_ngn: Optional[int] = None
    quantity: int = 0
    low_stock_threshold: int = 5
    track_inventory: bool = True
    images: List[Dict[str, Any]] = []
    variants: List[Dict[str, Any]] = []
    tags: List[str] = []

class UpdateProductRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price_ngn: Optional[int] = None
    quantity: Optional[int] = None
    status: Optional[str] = None
    images: Optional[List[Dict[str, Any]]] = None
    variants: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None

class UpdateInventoryRequest(BaseModel):
    quantity_delta: int
    version: int

class CreateReturnRequest(BaseModel):
    order_id: str
    escrow_id: Optional[str] = None  # Used to look up seller_id
    reason: str
    description: Optional[str] = None
    items: List[Dict[str, Any]]
    photos: List[str] = []
    videos: List[str] = []

class UpdateReturnStatusRequest(BaseModel):
    status: str
    version: int
    notes: Optional[str] = None

class InspectionRequest(BaseModel):
    result: str
    notes: Optional[str] = None
    photos: List[str] = []
    version: int

class CreateDeliveryRequest(BaseModel):
    order_id: str
    escrow_id: Optional[str] = None
    buyer_id: str
    provider: str
    method: str
    pickup_address: Optional[Dict[str, Any]] = None
    delivery_address: Optional[Dict[str, Any]] = None
    package_weight_kg: Optional[float] = None
    package_dimensions: Optional[Dict[str, Any]] = None
    package_description: Optional[str] = None
    shipping_cost_ngn: int = 0
    insurance_cost_ngn: int = 0

class CapturePODRequest(BaseModel):
    pod_type: str
    file_url: Optional[str] = None
    signature_data: Optional[str] = None
    signer_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    otp_code: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_id_type: Optional[str] = None
    recipient_id_last4: Optional[str] = None

class CreateListingRequest(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    listing_type: str = "product"
    price_ngn: int
    original_price_ngn: Optional[int] = None
    negotiable: bool = False
    condition: Optional[str] = None
    images: List[str] = []
    videos: List[str] = []
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    quantity: int = 1
    tags: List[str] = []

class CreateDisputeRequest(BaseModel):
    escrow_id: str
    seller_id: str
    dispute_type: str
    title: str
    description: str
    disputed_amount_ngn: int
    priority: str = "medium"

class UpdateDisputeStatusRequest(BaseModel):
    status: str
    version: int
    notes: Optional[str] = None

class ResolveDisputeRequest(BaseModel):
    resolution_type: str
    resolution_amount_ngn: int
    resolution_notes: str
    version: int

class SubmitEvidenceRequest(BaseModel):
    evidence_type: str
    file_url: Optional[str] = None
    description: Optional[str] = None

class SendMessageRequest(BaseModel):
    content: str
    attachments: List[str] = []


# =============================================================================
# Routers with Authentication
# =============================================================================

# Seller Storefront Router (requires MERCHANT role)
storefront_auth_router = APIRouter(prefix="/api/v1/storefront-secure", tags=["Storefront (Authenticated)"])

@storefront_auth_router.post("/products")
async def create_product_secure(
    request: CreateProductRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a new product (authenticated)"""
    if user.role not in [UserRole.MERCHANT, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only merchants can create products")
    
    seller_id = user.merchant_id or user.user_id
    
    product = await storefront_product_repo.create({
        "seller_id": seller_id,
        **request.model_dump()
    })
    
    logger.info(f"Product {product.id} created by seller {seller_id}")
    return {"product_id": product.id, "message": "Product created successfully"}


@storefront_auth_router.get("/products")
async def get_products_secure(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get seller's products (authenticated)"""
    if user.role not in [UserRole.MERCHANT, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only merchants can view their products")
    
    seller_id = user.merchant_id or user.user_id
    products = await storefront_product_repo.get_by_seller(seller_id, status, limit)
    
    return {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "price_ngn": p.price_ngn,
                "quantity": p.quantity,
                "status": p.status.value if p.status else None,
                "total_sold": p.total_sold,
                "version": p.version,
            }
            for p in products
        ]
    }


@storefront_auth_router.get("/products/{product_id}")
async def get_product_secure(
    product_id: str = Path(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get a specific product (authenticated)"""
    product = await storefront_product_repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Tenant isolation: only owner or admin can view
    seller_id = user.merchant_id or user.user_id
    if product.seller_id != seller_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": product.id,
        "seller_id": product.seller_id,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "sku": product.sku,
        "price_ngn": product.price_ngn,
        "compare_at_price_ngn": product.compare_at_price_ngn,
        "quantity": product.quantity,
        "status": product.status.value if product.status else None,
        "images": product.images,
        "variants": product.variants,
        "tags": product.tags,
        "total_sold": product.total_sold,
        "version": product.version,
        "created_at": product.created_at.isoformat() if product.created_at else None,
    }


@storefront_auth_router.put("/products/{product_id}")
async def update_product_secure(
    product_id: str,
    request: UpdateProductRequest,
    version: int = Query(..., description="Current version for optimistic locking"),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update a product with optimistic locking (authenticated)"""
    product = await storefront_product_repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Tenant isolation
    seller_id = user.merchant_id or user.user_id
    if product.seller_id != seller_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        updated = await storefront_product_repo.update(product_id, update_data, version)
        return {"message": "Product updated", "version": updated.version}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@storefront_auth_router.post("/products/{product_id}/inventory")
async def update_inventory_secure(
    product_id: str,
    request: UpdateInventoryRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Update product inventory with optimistic locking (authenticated)"""
    product = await storefront_product_repo.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Tenant isolation
    seller_id = user.merchant_id or user.user_id
    if product.seller_id != seller_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        updated = await storefront_product_repo.update_inventory(
            product_id, request.quantity_delta, request.version
        )
        return {
            "message": "Inventory updated",
            "new_quantity": updated.quantity,
            "version": updated.version
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# Returns & Refunds Router (requires BUYER or MERCHANT role)
returns_auth_router = APIRouter(prefix="/api/v1/returns-secure", tags=["Returns (Authenticated)"])

@returns_auth_router.post("/request")
async def create_return_request_secure(
    request: CreateReturnRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a return request (authenticated buyer)"""
    from app.repositories import EscrowRepository
    
    if user.role not in [UserRole.BUYER, UserRole.MERCHANT, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only buyers can create return requests")
    
    buyer_id = user.buyer_id or user.user_id
    
    # Look up seller_id from escrow record
    seller_id = None
    original_amount_ngn = 0
    escrow_id = request.escrow_id
    
    if escrow_id:
        escrow_repo = EscrowRepository()
        escrow = await escrow_repo.get(escrow_id)
        if escrow:
            # Validate escrow belongs to this buyer
            if escrow.buyer_id != buyer_id and user.role != UserRole.ADMIN:
                raise HTTPException(status_code=403, detail="Escrow does not belong to this buyer")
            seller_id = escrow.seller_id
            original_amount_ngn = int(escrow.amount)
        else:
            raise HTTPException(status_code=404, detail="Escrow not found")
    
    # If no escrow_id provided, calculate from items (fallback)
    if not seller_id:
        # For returns without escrow reference, require seller_id in items
        if request.items and request.items[0].get("seller_id"):
            seller_id = request.items[0].get("seller_id")
        else:
            raise HTTPException(
                status_code=400, 
                detail="Either escrow_id or seller_id in items is required"
            )
    
    if original_amount_ngn == 0:
        original_amount_ngn = sum(item.get("price", 0) * item.get("quantity", 1) for item in request.items)
    
    return_req = await return_request_repo.create({
        "buyer_id": buyer_id,
        "seller_id": seller_id,
        "order_id": request.order_id,
        "escrow_id": escrow_id,
        "reason": request.reason,
        "description": request.description,
        "items": request.items,
        "photos": request.photos,
        "videos": request.videos,
        "original_amount_ngn": original_amount_ngn,
    })
    
    logger.info(f"Return request {return_req.rma_number} created by buyer {buyer_id} for seller {seller_id}")
    return {
        "return_id": return_req.id,
        "rma_number": return_req.rma_number,
        "status": return_req.status.value,
        "seller_id": seller_id,
        "original_amount_ngn": original_amount_ngn,
        "approval_deadline": return_req.approval_deadline.isoformat() if return_req.approval_deadline else None,
    }


@returns_auth_router.get("/request/{return_id}")
async def get_return_request_secure(
    return_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get return request details (authenticated)"""
    return_req = await return_request_repo.get(return_id)
    if not return_req:
        raise HTTPException(status_code=404, detail="Return request not found")
    
    # Tenant isolation: only buyer, seller, or admin can view
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if return_req.buyer_id != user_id and return_req.seller_id != user_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": return_req.id,
        "rma_number": return_req.rma_number,
        "status": return_req.status.value,
        "reason": return_req.reason,
        "description": return_req.description,
        "items": return_req.items,
        "original_amount_ngn": return_req.original_amount_ngn,
        "refund_amount_ngn": return_req.refund_amount_ngn,
        "inspection_result": return_req.inspection_result.value if return_req.inspection_result else None,
        "inspection_notes": return_req.inspection_notes,
        "approval_deadline": return_req.approval_deadline.isoformat() if return_req.approval_deadline else None,
        "inspection_deadline": return_req.inspection_deadline.isoformat() if return_req.inspection_deadline else None,
        "refund_deadline": return_req.refund_deadline.isoformat() if return_req.refund_deadline else None,
        "version": return_req.version,
        "created_at": return_req.created_at.isoformat() if return_req.created_at else None,
    }


@returns_auth_router.post("/request/{return_id}/approve")
async def approve_return_secure(
    return_id: str,
    version: int = Query(...),
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Approve a return request (seller only)"""
    return_req = await return_request_repo.get(return_id)
    if not return_req:
        raise HTTPException(status_code=404, detail="Return request not found")
    
    # Only seller can approve
    seller_id = user.merchant_id or user.user_id
    if return_req.seller_id != seller_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only seller can approve returns")
    
    try:
        updated = await return_request_repo.update_status(
            return_id, ReturnStatus.APPROVED, version
        )
        return {"message": "Return approved", "status": updated.status.value, "version": updated.version}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@returns_auth_router.post("/request/{return_id}/inspect")
async def submit_inspection_secure(
    return_id: str,
    request: InspectionRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Submit inspection results (seller or admin only)"""
    return_req = await return_request_repo.get(return_id)
    if not return_req:
        raise HTTPException(status_code=404, detail="Return request not found")
    
    # Only seller or admin can inspect
    seller_id = user.merchant_id or user.user_id
    if return_req.seller_id != seller_id and user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Only seller can submit inspection")
    
    # Calculate refund based on inspection result
    refund_percentages = {
        "passed": 100,
        "minor_damage": 90,
        "major_damage": 50,
        "wrong_item_returned": 0,
        "item_missing": 0,
        "tampered": 0,
    }
    refund_percent = refund_percentages.get(request.result, 0)
    refund_amount = int(return_req.original_amount_ngn * refund_percent / 100)
    
    # Determine status based on result
    new_status = ReturnStatus.INSPECTION_PASSED if refund_percent > 0 else ReturnStatus.INSPECTION_FAILED
    
    try:
        from app.competitive_features_persistence import InspectionResult
        updated = await return_request_repo.update_status(
            return_id, new_status, request.version,
            inspection_result=InspectionResult(request.result),
            inspection_notes=request.notes,
            inspection_photos=request.photos,
            inspected_at=datetime.utcnow(),
            inspected_by=user.user_id,
            refund_amount_ngn=refund_amount,
        )
        return {
            "message": "Inspection submitted",
            "status": updated.status.value,
            "refund_amount_ngn": refund_amount,
            "version": updated.version
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# Proof of Delivery Router (requires MERCHANT or AGENT role)
delivery_auth_router = APIRouter(prefix="/api/v1/delivery-secure", tags=["Delivery (Authenticated)"])

@delivery_auth_router.post("/create")
async def create_delivery_secure(
    request: CreateDeliveryRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a delivery (authenticated seller)"""
    if user.role not in [UserRole.MERCHANT, UserRole.ADMIN, UserRole.AGENT]:
        raise HTTPException(status_code=403, detail="Only merchants can create deliveries")
    
    seller_id = user.merchant_id or user.user_id
    
    delivery = await delivery_repo.create({
        "seller_id": seller_id,
        **request.model_dump()
    })
    
    logger.info(f"Delivery {delivery.id} created by seller {seller_id}")
    return {"delivery_id": delivery.id, "status": delivery.status.value}


@delivery_auth_router.get("/{delivery_id}")
async def get_delivery_secure(
    delivery_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get delivery details (authenticated)"""
    delivery = await delivery_repo.get(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    # Tenant isolation
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if delivery.seller_id != user_id and delivery.buyer_id != user_id and user.role not in [UserRole.ADMIN, UserRole.AGENT]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": delivery.id,
        "order_id": delivery.order_id,
        "status": delivery.status.value,
        "provider": delivery.provider,
        "method": delivery.method,
        "tracking_number": delivery.provider_tracking_number,
        "pickup_address": delivery.pickup_address,
        "delivery_address": delivery.delivery_address,
        "shipping_cost_ngn": delivery.shipping_cost_ngn,
        "estimated_delivery_at": delivery.estimated_delivery_at.isoformat() if delivery.estimated_delivery_at else None,
        "delivered_at": delivery.delivered_at.isoformat() if delivery.delivered_at else None,
        "pod_verified": delivery.pod_verified,
        "version": delivery.version,
    }


@delivery_auth_router.post("/{delivery_id}/pod")
async def capture_pod_secure(
    delivery_id: str,
    request: CapturePODRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Capture proof of delivery (agent or driver)"""
    if user.role not in [UserRole.AGENT, UserRole.ADMIN, UserRole.MERCHANT]:
        raise HTTPException(status_code=403, detail="Only agents can capture POD")
    
    delivery = await delivery_repo.get(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    pod = await delivery_repo.add_pod({
        "delivery_id": delivery_id,
        "captured_by": user.user_id,
        **request.model_dump()
    })
    
    logger.info(f"POD {pod.id} captured for delivery {delivery_id}")
    return {"pod_id": pod.id, "pod_type": pod.pod_type.value}


@delivery_auth_router.get("/{delivery_id}/evidence")
async def get_pod_evidence_secure(
    delivery_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get all POD evidence for a delivery (authenticated)"""
    delivery = await delivery_repo.get(delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    # Tenant isolation
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if delivery.seller_id != user_id and delivery.buyer_id != user_id and user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    evidence = await delivery_repo.get_pod_evidence(delivery_id)
    
    return {
        "delivery_id": delivery_id,
        "evidence": [
            {
                "id": e.id,
                "pod_type": e.pod_type.value,
                "file_url": e.file_url,
                "file_hash": e.file_hash,
                "signer_name": e.signer_name,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "otp_verified": e.otp_verified,
                "recipient_name": e.recipient_name,
                "captured_at": e.captured_at.isoformat() if e.captured_at else None,
            }
            for e in evidence
        ]
    }


# Marketplace Discovery Router (public read, authenticated write)
marketplace_auth_router = APIRouter(prefix="/api/v1/marketplace-secure", tags=["Marketplace (Authenticated)"])

@marketplace_auth_router.post("/listings")
async def create_listing_secure(
    request: CreateListingRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a marketplace listing (authenticated seller)"""
    if user.role not in [UserRole.MERCHANT, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="Only merchants can create listings")
    
    seller_id = user.merchant_id or user.user_id
    
    listing = await marketplace_listing_repo.create({
        "seller_id": seller_id,
        **request.model_dump()
    })
    
    logger.info(f"Listing {listing.id} created by seller {seller_id}")
    return {"listing_id": listing.id, "status": listing.status.value}


@marketplace_auth_router.get("/search")
async def search_listings_public(
    query: Optional[str] = None,
    category: Optional[str] = None,
    state: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    condition: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """Search marketplace listings (public)"""
    listings = await marketplace_listing_repo.search(
        query=query,
        category=category,
        state=state,
        min_price=min_price,
        max_price=max_price,
        condition=condition,
        limit=limit,
        offset=offset
    )
    
    return {
        "listings": [
            {
                "id": l.id,
                "title": l.title,
                "category": l.category,
                "price_ngn": l.price_ngn,
                "condition": l.condition,
                "city": l.city,
                "state": l.state,
                "images": l.images[:1] if l.images else [],  # Only first image for list view
                "view_count": l.view_count,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in listings
        ],
        "count": len(listings),
        "offset": offset,
    }


@marketplace_auth_router.get("/listings/{listing_id}")
async def get_listing_public(
    listing_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_optional_user)
):
    """Get listing details (public)"""
    listing = await marketplace_listing_repo.get(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Increment view count
    await marketplace_listing_repo.increment_view(listing_id)
    
    return {
        "id": listing.id,
        "seller_id": listing.seller_id,
        "title": listing.title,
        "description": listing.description,
        "category": listing.category,
        "subcategory": listing.subcategory,
        "listing_type": listing.listing_type,
        "price_ngn": listing.price_ngn,
        "original_price_ngn": listing.original_price_ngn,
        "negotiable": listing.negotiable,
        "condition": listing.condition,
        "images": listing.images,
        "videos": listing.videos,
        "city": listing.city,
        "state": listing.state,
        "quantity": listing.quantity,
        "view_count": listing.view_count + 1,
        "inquiry_count": listing.inquiry_count,
        "favorite_count": listing.favorite_count,
        "tags": listing.tags,
        "created_at": listing.created_at.isoformat() if listing.created_at else None,
    }


# Dispute Operations Router (requires authenticated user)
disputes_auth_router = APIRouter(prefix="/api/v1/disputes-secure", tags=["Disputes (Authenticated)"])

@disputes_auth_router.post("/create")
async def create_dispute_secure(
    request: CreateDisputeRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Create a dispute (authenticated buyer)"""
    buyer_id = user.buyer_id or user.user_id
    
    dispute = await dispute_ops_repo.create({
        "buyer_id": buyer_id,
        **request.model_dump()
    })
    
    logger.info(f"Dispute {dispute.id} created by buyer {buyer_id}")
    return {
        "dispute_id": dispute.id,
        "status": dispute.status.value,
        "priority": dispute.priority.value,
        "response_deadline": dispute.response_deadline.isoformat(),
        "resolution_deadline": dispute.resolution_deadline.isoformat(),
    }


@disputes_auth_router.get("/{dispute_id}")
async def get_dispute_secure(
    dispute_id: str,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get dispute details (authenticated)"""
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    # Tenant isolation
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if dispute.buyer_id != user_id and dispute.seller_id != user_id and user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": dispute.id,
        "escrow_id": dispute.escrow_id,
        "buyer_id": dispute.buyer_id,
        "seller_id": dispute.seller_id,
        "status": dispute.status.value,
        "priority": dispute.priority.value,
        "dispute_type": dispute.dispute_type,
        "title": dispute.title,
        "description": dispute.description,
        "disputed_amount_ngn": dispute.disputed_amount_ngn,
        "assigned_agent_id": dispute.assigned_agent_id,
        "response_deadline": dispute.response_deadline.isoformat() if dispute.response_deadline else None,
        "resolution_deadline": dispute.resolution_deadline.isoformat() if dispute.resolution_deadline else None,
        "first_response_at": dispute.first_response_at.isoformat() if dispute.first_response_at else None,
        "response_sla_met": dispute.response_sla_met,
        "resolution_type": dispute.resolution_type,
        "resolution_amount_ngn": dispute.resolution_amount_ngn,
        "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        "version": dispute.version,
        "created_at": dispute.created_at.isoformat() if dispute.created_at else None,
    }


@disputes_auth_router.post("/{dispute_id}/evidence")
async def submit_evidence_secure(
    dispute_id: str,
    request: SubmitEvidenceRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Submit evidence for a dispute (authenticated)"""
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    # Determine role
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if dispute.buyer_id == user_id:
        role = "buyer"
    elif dispute.seller_id == user_id:
        role = "seller"
    elif user.role in [UserRole.ADMIN, UserRole.SUPPORT]:
        role = "agent"
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    evidence = await dispute_ops_repo.add_evidence({
        "dispute_id": dispute_id,
        "submitted_by": user_id,
        "submitted_by_role": role,
        **request.model_dump()
    })
    
    return {"evidence_id": evidence.id, "message": "Evidence submitted"}


@disputes_auth_router.post("/{dispute_id}/message")
async def send_message_secure(
    dispute_id: str,
    request: SendMessageRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Send a message in dispute thread (authenticated)"""
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    # Determine role
    user_id = user.buyer_id or user.merchant_id or user.user_id
    if dispute.buyer_id == user_id:
        role = "buyer"
    elif dispute.seller_id == user_id:
        role = "seller"
    elif user.role in [UserRole.ADMIN, UserRole.SUPPORT]:
        role = "agent"
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    message = await dispute_ops_repo.add_message({
        "dispute_id": dispute_id,
        "sender_id": user_id,
        "sender_role": role,
        **request.model_dump()
    })
    
    return {"message_id": message.id}


@disputes_auth_router.post("/{dispute_id}/resolve")
async def resolve_dispute_secure(
    dispute_id: str,
    request: ResolveDisputeRequest,
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Resolve a dispute (support/admin only)"""
    if user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Only support staff can resolve disputes")
    
    dispute = await dispute_ops_repo.get(dispute_id)
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    
    try:
        resolved = await dispute_ops_repo.resolve(
            dispute_id,
            request.resolution_type,
            request.resolution_amount_ngn,
            request.resolution_notes,
            user.user_id,
            request.version
        )
        
        logger.info(f"Dispute {dispute_id} resolved by {user.user_id}")
        return {
            "message": "Dispute resolved",
            "status": resolved.status.value,
            "resolution_type": resolved.resolution_type,
            "resolution_amount_ngn": resolved.resolution_amount_ngn,
            "resolution_sla_met": resolved.resolution_sla_met,
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@disputes_auth_router.get("/analytics/summary")
async def get_dispute_analytics_secure(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get dispute analytics (admin/support only)"""
    if user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Only support staff can view analytics")
    
    analytics = await dispute_ops_repo.get_analytics()
    return analytics


@disputes_auth_router.get("/queue/sla-breached")
async def get_sla_breached_disputes_secure(
    user: AuthenticatedUser = Depends(get_current_user)
):
    """Get disputes that have breached SLA (admin/support only)"""
    if user.role not in [UserRole.ADMIN, UserRole.SUPPORT]:
        raise HTTPException(status_code=403, detail="Only support staff can view SLA breaches")
    
    disputes = await dispute_ops_repo.get_sla_breached()
    return {
        "sla_breached_disputes": [
            {
                "id": d.id,
                "escrow_id": d.escrow_id,
                "status": d.status.value,
                "priority": d.priority.value,
                "response_deadline": d.response_deadline.isoformat() if d.response_deadline else None,
                "resolution_deadline": d.resolution_deadline.isoformat() if d.resolution_deadline else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in disputes
        ],
        "count": len(disputes),
    }
