"""
Dynamic Trust Scoring for SocialEscrow
Computes explainable trust scores based on transaction history, buyer feedback,
dispute rates, delivery timeliness, and feeds into marketplace ranking.
"""

import json
import math
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, String, Text, Float, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base, get_db
from app.event_streaming import EventBus, Event


class SellerTier(str, Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"


class RatingCategory(str, Enum):
    OVERALL = "overall"
    ITEM_QUALITY = "item_quality"
    COMMUNICATION = "communication"
    SHIPPING_SPEED = "shipping_speed"
    ACCURACY = "accuracy"
    VALUE = "value"


# Database Models
class TrustScore(Base):
    __tablename__ = "trust_scores"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), unique=True, nullable=False, index=True)
    
    # Overall score (0-100)
    overall_score = Column(Float, default=50.0)
    
    # Component scores (0-100 each)
    transaction_score = Column(Float, default=50.0)
    rating_score = Column(Float, default=50.0)
    dispute_score = Column(Float, default=100.0)  # Starts high, decreases with disputes
    delivery_score = Column(Float, default=50.0)
    verification_score = Column(Float, default=0.0)
    longevity_score = Column(Float, default=0.0)
    
    # Raw metrics
    total_transactions = Column(Integer, default=0)
    successful_transactions = Column(Integer, default=0)
    total_volume = Column(Float, default=0.0)
    
    total_ratings = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    rating_breakdown = Column(Text)  # JSON: {5: count, 4: count, ...}
    
    total_disputes = Column(Integer, default=0)
    disputes_won = Column(Integer, default=0)
    disputes_lost = Column(Integer, default=0)
    
    on_time_deliveries = Column(Integer, default=0)
    late_deliveries = Column(Integer, default=0)
    avg_delivery_days = Column(Float)
    
    refund_count = Column(Integer, default=0)
    refund_rate = Column(Float, default=0.0)
    
    # Tier
    tier = Column(SQLEnum(SellerTier), default=SellerTier.BRONZE)
    tier_updated_at = Column(DateTime)
    
    # Ranking
    marketplace_rank = Column(Integer)
    category_ranks = Column(Text)  # JSON: {category: rank}
    
    # Flags
    is_flagged = Column(Boolean, default=False)
    flag_reasons = Column(Text)
    
    # Score explanation
    score_breakdown = Column(Text)  # JSON explanation
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_calculated_at = Column(DateTime)


class TransactionRating(Base):
    __tablename__ = "transaction_ratings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    escrow_id = Column(String(36), ForeignKey("escrows.id"), nullable=False, index=True)
    
    # Parties
    rated_user_id = Column(String(36), nullable=False, index=True)
    rater_user_id = Column(String(36), nullable=False)
    rater_role = Column(String(20))  # buyer or seller
    
    # Ratings (1-5)
    overall_rating = Column(Integer, nullable=False)
    item_quality_rating = Column(Integer)
    communication_rating = Column(Integer)
    shipping_speed_rating = Column(Integer)
    accuracy_rating = Column(Integer)
    value_rating = Column(Integer)
    
    # Review
    review_text = Column(Text)
    review_photos = Column(Text)  # JSON array of URLs
    
    # Moderation
    is_verified_purchase = Column(Boolean, default=True)
    is_visible = Column(Boolean, default=True)
    moderation_status = Column(String(20), default="approved")
    
    # Response
    seller_response = Column(Text)
    seller_responded_at = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class TrustScoreHistory(Base):
    __tablename__ = "trust_score_history"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    
    overall_score = Column(Float)
    tier = Column(SQLEnum(SellerTier))
    
    change_reason = Column(String(100))
    change_details = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# Pydantic Models
class SubmitRatingRequest(BaseModel):
    escrow_id: str
    overall_rating: int = Field(..., ge=1, le=5)
    item_quality_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    shipping_speed_rating: Optional[int] = Field(None, ge=1, le=5)
    accuracy_rating: Optional[int] = Field(None, ge=1, le=5)
    value_rating: Optional[int] = Field(None, ge=1, le=5)
    review_text: Optional[str] = None
    review_photos: Optional[List[str]] = None


class TrustScoreResponse(BaseModel):
    user_id: str
    overall_score: float
    tier: SellerTier
    total_transactions: int
    average_rating: float
    total_ratings: int
    success_rate: float
    dispute_rate: float
    on_time_rate: float
    
    class Config:
        from_attributes = True


# Trust Scoring Service
class TrustScoringService:
    """Service for computing and managing trust scores"""
    
    # Weights for overall score calculation
    WEIGHTS = {
        "transaction": 0.25,
        "rating": 0.30,
        "dispute": 0.20,
        "delivery": 0.15,
        "verification": 0.05,
        "longevity": 0.05,
    }
    
    # Tier thresholds
    TIER_THRESHOLDS = {
        SellerTier.DIAMOND: {"score": 90, "transactions": 500, "rating": 4.8},
        SellerTier.PLATINUM: {"score": 80, "transactions": 200, "rating": 4.5},
        SellerTier.GOLD: {"score": 70, "transactions": 100, "rating": 4.2},
        SellerTier.SILVER: {"score": 60, "transactions": 50, "rating": 4.0},
        SellerTier.BRONZE: {"score": 0, "transactions": 0, "rating": 0},
    }
    
    def __init__(self, event_bus: EventBus, redis_client: Any):
        self.event_bus = event_bus
        self.redis = redis_client
    
    async def get_or_create_trust_score(self, db, user_id: str) -> TrustScore:
        """Get or create trust score for a user"""
        
        trust_score = db.query(TrustScore).filter(
            TrustScore.user_id == user_id
        ).first()
        
        if not trust_score:
            trust_score = TrustScore(user_id=user_id)
            db.add(trust_score)
            db.commit()
            db.refresh(trust_score)
        
        return trust_score
    
    async def submit_rating(
        self,
        db,
        rater_id: str,
        rater_role: str,
        request: SubmitRatingRequest
    ) -> TransactionRating:
        """Submit a rating for a transaction"""
        
        # Get escrow to determine rated user
        escrow = db.query("escrows").filter_by(id=request.escrow_id).first()
        if not escrow:
            raise ValueError("Escrow not found")
        
        # Determine who is being rated
        if rater_role == "buyer":
            rated_user_id = escrow.seller_id
        else:
            rated_user_id = escrow.buyer_id
        
        # Check if already rated
        existing = db.query(TransactionRating).filter(
            TransactionRating.escrow_id == request.escrow_id,
            TransactionRating.rater_user_id == rater_id
        ).first()
        
        if existing:
            raise ValueError("Already rated this transaction")
        
        # Create rating
        rating = TransactionRating(
            escrow_id=request.escrow_id,
            rated_user_id=rated_user_id,
            rater_user_id=rater_id,
            rater_role=rater_role,
            overall_rating=request.overall_rating,
            item_quality_rating=request.item_quality_rating,
            communication_rating=request.communication_rating,
            shipping_speed_rating=request.shipping_speed_rating,
            accuracy_rating=request.accuracy_rating,
            value_rating=request.value_rating,
            review_text=request.review_text,
            review_photos=json.dumps(request.review_photos) if request.review_photos else None,
        )
        
        db.add(rating)
        db.commit()
        db.refresh(rating)
        
        # Update trust score
        await self.recalculate_trust_score(db, rated_user_id, "new_rating")
        
        # Publish event
        await self.event_bus.publish(Event(
            type="rating.submitted",
            data={
                "rating_id": rating.id,
                "escrow_id": request.escrow_id,
                "rated_user_id": rated_user_id,
                "overall_rating": request.overall_rating,
            }
        ))
        
        return rating
    
    async def recalculate_trust_score(
        self,
        db,
        user_id: str,
        reason: str = "manual"
    ) -> TrustScore:
        """Recalculate trust score for a user"""
        
        trust_score = await self.get_or_create_trust_score(db, user_id)
        old_score = trust_score.overall_score
        old_tier = trust_score.tier
        
        # Calculate transaction score
        trust_score.transaction_score = self._calculate_transaction_score(
            trust_score.total_transactions,
            trust_score.successful_transactions,
            trust_score.total_volume
        )
        
        # Calculate rating score
        ratings = db.query(TransactionRating).filter(
            TransactionRating.rated_user_id == user_id,
            TransactionRating.is_visible == True
        ).all()
        
        if ratings:
            trust_score.total_ratings = len(ratings)
            trust_score.average_rating = sum(r.overall_rating for r in ratings) / len(ratings)
            
            # Rating breakdown
            breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            for r in ratings:
                breakdown[r.overall_rating] += 1
            trust_score.rating_breakdown = json.dumps(breakdown)
            
            trust_score.rating_score = self._calculate_rating_score(
                trust_score.average_rating,
                trust_score.total_ratings
            )
        
        # Calculate dispute score
        trust_score.dispute_score = self._calculate_dispute_score(
            trust_score.total_disputes,
            trust_score.disputes_won,
            trust_score.disputes_lost,
            trust_score.total_transactions
        )
        
        # Calculate delivery score
        trust_score.delivery_score = self._calculate_delivery_score(
            trust_score.on_time_deliveries,
            trust_score.late_deliveries
        )
        
        # Calculate verification score
        verification = db.query("seller_verifications").filter_by(user_id=user_id).first()
        if verification:
            trust_score.verification_score = self._calculate_verification_score(verification)
        
        # Calculate longevity score
        trust_score.longevity_score = self._calculate_longevity_score(trust_score.created_at)
        
        # Calculate overall score
        trust_score.overall_score = (
            trust_score.transaction_score * self.WEIGHTS["transaction"] +
            trust_score.rating_score * self.WEIGHTS["rating"] +
            trust_score.dispute_score * self.WEIGHTS["dispute"] +
            trust_score.delivery_score * self.WEIGHTS["delivery"] +
            trust_score.verification_score * self.WEIGHTS["verification"] +
            trust_score.longevity_score * self.WEIGHTS["longevity"]
        )
        
        # Determine tier
        new_tier = self._determine_tier(
            trust_score.overall_score,
            trust_score.total_transactions,
            trust_score.average_rating
        )
        
        if new_tier != trust_score.tier:
            trust_score.tier = new_tier
            trust_score.tier_updated_at = datetime.utcnow()
        
        # Generate score breakdown explanation
        trust_score.score_breakdown = json.dumps({
            "overall_score": round(trust_score.overall_score, 1),
            "components": {
                "transaction": {
                    "score": round(trust_score.transaction_score, 1),
                    "weight": self.WEIGHTS["transaction"],
                    "contribution": round(trust_score.transaction_score * self.WEIGHTS["transaction"], 1),
                },
                "rating": {
                    "score": round(trust_score.rating_score, 1),
                    "weight": self.WEIGHTS["rating"],
                    "contribution": round(trust_score.rating_score * self.WEIGHTS["rating"], 1),
                },
                "dispute": {
                    "score": round(trust_score.dispute_score, 1),
                    "weight": self.WEIGHTS["dispute"],
                    "contribution": round(trust_score.dispute_score * self.WEIGHTS["dispute"], 1),
                },
                "delivery": {
                    "score": round(trust_score.delivery_score, 1),
                    "weight": self.WEIGHTS["delivery"],
                    "contribution": round(trust_score.delivery_score * self.WEIGHTS["delivery"], 1),
                },
                "verification": {
                    "score": round(trust_score.verification_score, 1),
                    "weight": self.WEIGHTS["verification"],
                    "contribution": round(trust_score.verification_score * self.WEIGHTS["verification"], 1),
                },
                "longevity": {
                    "score": round(trust_score.longevity_score, 1),
                    "weight": self.WEIGHTS["longevity"],
                    "contribution": round(trust_score.longevity_score * self.WEIGHTS["longevity"], 1),
                },
            },
            "metrics": {
                "total_transactions": trust_score.total_transactions,
                "success_rate": round(
                    (trust_score.successful_transactions / trust_score.total_transactions * 100)
                    if trust_score.total_transactions > 0 else 0, 1
                ),
                "average_rating": round(trust_score.average_rating, 2),
                "total_ratings": trust_score.total_ratings,
                "dispute_rate": round(
                    (trust_score.total_disputes / trust_score.total_transactions * 100)
                    if trust_score.total_transactions > 0 else 0, 1
                ),
                "on_time_rate": round(
                    (trust_score.on_time_deliveries / (trust_score.on_time_deliveries + trust_score.late_deliveries) * 100)
                    if (trust_score.on_time_deliveries + trust_score.late_deliveries) > 0 else 100, 1
                ),
            },
        })
        
        trust_score.last_calculated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(trust_score)
        
        # Record history if score changed significantly
        if abs(trust_score.overall_score - old_score) >= 1 or new_tier != old_tier:
            history = TrustScoreHistory(
                user_id=user_id,
                overall_score=trust_score.overall_score,
                tier=trust_score.tier,
                change_reason=reason,
                change_details=json.dumps({
                    "old_score": old_score,
                    "new_score": trust_score.overall_score,
                    "old_tier": old_tier.value if old_tier else None,
                    "new_tier": new_tier.value,
                }),
            )
            db.add(history)
            db.commit()
        
        # Cache score
        await self.redis.set(
            f"trust_score:{user_id}",
            json.dumps({
                "overall_score": trust_score.overall_score,
                "tier": trust_score.tier.value,
                "average_rating": trust_score.average_rating,
            }),
            ex=3600  # 1 hour cache
        )
        
        # Publish event
        await self.event_bus.publish(Event(
            type="trust_score.updated",
            data={
                "user_id": user_id,
                "overall_score": trust_score.overall_score,
                "tier": trust_score.tier.value,
                "reason": reason,
            }
        ))
        
        return trust_score
    
    def _calculate_transaction_score(
        self,
        total: int,
        successful: int,
        volume: float
    ) -> float:
        """Calculate transaction component score"""
        
        if total == 0:
            return 50.0
        
        # Success rate (0-50 points)
        success_rate = successful / total
        success_points = success_rate * 50
        
        # Volume bonus (0-30 points)
        # Logarithmic scale: 1M NGN = 30 points
        volume_points = min(30, math.log10(max(volume, 1)) * 5)
        
        # Transaction count bonus (0-20 points)
        # 100 transactions = 20 points
        count_points = min(20, total / 5)
        
        return min(100, success_points + volume_points + count_points)
    
    def _calculate_rating_score(self, avg_rating: float, total_ratings: int) -> float:
        """Calculate rating component score"""
        
        if total_ratings == 0:
            return 50.0
        
        # Base score from average rating (0-80 points)
        # 5.0 = 80, 4.0 = 60, 3.0 = 40, etc.
        base_score = (avg_rating - 1) * 20
        
        # Confidence bonus based on number of ratings (0-20 points)
        # More ratings = more confidence in the score
        confidence_bonus = min(20, math.log10(max(total_ratings, 1)) * 10)
        
        return min(100, base_score + confidence_bonus)
    
    def _calculate_dispute_score(
        self,
        total_disputes: int,
        won: int,
        lost: int,
        total_transactions: int
    ) -> float:
        """Calculate dispute component score"""
        
        if total_transactions == 0:
            return 100.0
        
        # Dispute rate penalty
        dispute_rate = total_disputes / total_transactions
        
        # Start at 100, lose points for disputes
        # 1% dispute rate = -10 points
        # 5% dispute rate = -50 points
        base_score = 100 - (dispute_rate * 1000)
        
        # Bonus for winning disputes (partial recovery)
        if total_disputes > 0:
            win_rate = won / total_disputes
            recovery = win_rate * 20  # Up to 20 points recovery
            base_score += recovery
        
        return max(0, min(100, base_score))
    
    def _calculate_delivery_score(self, on_time: int, late: int) -> float:
        """Calculate delivery component score"""
        
        total = on_time + late
        if total == 0:
            return 50.0
        
        on_time_rate = on_time / total
        return on_time_rate * 100
    
    def _calculate_verification_score(self, verification) -> float:
        """Calculate verification component score"""
        
        score = 0.0
        
        if verification.phone_verified:
            score += 20
        if verification.email_verified:
            score += 20
        if verification.id_verified:
            score += 30
        if verification.bvn_verified:
            score += 15
        if verification.cac_number:
            score += 15
        
        return min(100, score)
    
    def _calculate_longevity_score(self, created_at: datetime) -> float:
        """Calculate longevity component score"""
        
        if not created_at:
            return 0.0
        
        days_active = (datetime.utcnow() - created_at).days
        
        # 1 year = 100 points (linear)
        return min(100, days_active / 3.65)
    
    def _determine_tier(
        self,
        score: float,
        transactions: int,
        rating: float
    ) -> SellerTier:
        """Determine seller tier based on metrics"""
        
        for tier, thresholds in self.TIER_THRESHOLDS.items():
            if (score >= thresholds["score"] and
                transactions >= thresholds["transactions"] and
                rating >= thresholds["rating"]):
                return tier
        
        return SellerTier.BRONZE
    
    async def update_on_transaction_complete(
        self,
        db,
        user_id: str,
        amount: float,
        successful: bool
    ):
        """Update trust score when a transaction completes"""
        
        trust_score = await self.get_or_create_trust_score(db, user_id)
        
        trust_score.total_transactions += 1
        trust_score.total_volume += amount
        
        if successful:
            trust_score.successful_transactions += 1
        
        db.commit()
        
        await self.recalculate_trust_score(db, user_id, "transaction_complete")
    
    async def update_on_dispute(
        self,
        db,
        user_id: str,
        won: bool
    ):
        """Update trust score when a dispute is resolved"""
        
        trust_score = await self.get_or_create_trust_score(db, user_id)
        
        trust_score.total_disputes += 1
        if won:
            trust_score.disputes_won += 1
        else:
            trust_score.disputes_lost += 1
        
        db.commit()
        
        await self.recalculate_trust_score(db, user_id, "dispute_resolved")
    
    async def update_on_delivery(
        self,
        db,
        user_id: str,
        on_time: bool,
        delivery_days: float
    ):
        """Update trust score when a delivery is confirmed"""
        
        trust_score = await self.get_or_create_trust_score(db, user_id)
        
        if on_time:
            trust_score.on_time_deliveries += 1
        else:
            trust_score.late_deliveries += 1
        
        # Update average delivery days
        total_deliveries = trust_score.on_time_deliveries + trust_score.late_deliveries
        if trust_score.avg_delivery_days:
            trust_score.avg_delivery_days = (
                (trust_score.avg_delivery_days * (total_deliveries - 1) + delivery_days) /
                total_deliveries
            )
        else:
            trust_score.avg_delivery_days = delivery_days
        
        db.commit()
        
        await self.recalculate_trust_score(db, user_id, "delivery_confirmed")
    
    async def get_marketplace_ranking(
        self,
        db,
        category: Optional[str] = None,
        limit: int = 100
    ) -> List[dict]:
        """Get marketplace ranking of sellers"""
        
        query = db.query(TrustScore).filter(
            TrustScore.overall_score >= 50,
            TrustScore.total_transactions >= 5
        )
        
        rankings = query.order_by(
            TrustScore.overall_score.desc(),
            TrustScore.total_transactions.desc()
        ).limit(limit).all()
        
        return [
            {
                "rank": i + 1,
                "user_id": r.user_id,
                "overall_score": round(r.overall_score, 1),
                "tier": r.tier.value,
                "total_transactions": r.total_transactions,
                "average_rating": round(r.average_rating, 2),
            }
            for i, r in enumerate(rankings)
        ]


# FastAPI Router
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/trust", tags=["trust"])


@router.get("/score/{user_id}")
async def get_trust_score(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Get trust score for a user"""
    from app.main import get_trust_scoring_service
    service = get_trust_scoring_service()
    
    trust_score = await service.get_or_create_trust_score(db, user_id)
    
    return {
        "user_id": user_id,
        "overall_score": round(trust_score.overall_score, 1),
        "tier": trust_score.tier.value,
        "total_transactions": trust_score.total_transactions,
        "average_rating": round(trust_score.average_rating, 2),
        "total_ratings": trust_score.total_ratings,
        "success_rate": round(
            (trust_score.successful_transactions / trust_score.total_transactions * 100)
            if trust_score.total_transactions > 0 else 0, 1
        ),
        "dispute_rate": round(
            (trust_score.total_disputes / trust_score.total_transactions * 100)
            if trust_score.total_transactions > 0 else 0, 1
        ),
        "on_time_rate": round(
            (trust_score.on_time_deliveries / (trust_score.on_time_deliveries + trust_score.late_deliveries) * 100)
            if (trust_score.on_time_deliveries + trust_score.late_deliveries) > 0 else 100, 1
        ),
        "breakdown": json.loads(trust_score.score_breakdown) if trust_score.score_breakdown else None,
    }


@router.post("/ratings")
async def submit_rating(
    request: SubmitRatingRequest,
    rater_id: str = Query(...),
    rater_role: str = Query(...),
    db: Session = Depends(get_db),
):
    """Submit a rating for a transaction"""
    try:
        from app.main import get_trust_scoring_service
        service = get_trust_scoring_service()
        rating = await service.submit_rating(db, rater_id, rater_role, request)
        return {"rating_id": rating.id, "status": "submitted"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ratings/{user_id}")
async def get_user_ratings(
    user_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get ratings for a user"""
    ratings = db.query(TransactionRating).filter(
        TransactionRating.rated_user_id == user_id,
        TransactionRating.is_visible == True
    ).order_by(TransactionRating.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "overall_rating": r.overall_rating,
            "review_text": r.review_text,
            "rater_role": r.rater_role,
            "created_at": r.created_at.isoformat(),
            "seller_response": r.seller_response,
        }
        for r in ratings
    ]


@router.get("/rankings")
async def get_marketplace_rankings(
    category: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    """Get marketplace seller rankings"""
    from app.main import get_trust_scoring_service
    service = get_trust_scoring_service()
    return await service.get_marketplace_ranking(db, category, limit)


@router.post("/recalculate/{user_id}")
async def recalculate_trust_score(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Manually trigger trust score recalculation"""
    from app.main import get_trust_scoring_service
    service = get_trust_scoring_service()
    trust_score = await service.recalculate_trust_score(db, user_id, "manual")
    return {"overall_score": trust_score.overall_score, "tier": trust_score.tier.value}
