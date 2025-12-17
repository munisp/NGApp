"""
Marketplace Discovery Features

Provides buyer traffic and seller discovery:
- Seller listings and search
- Category browsing
- Featured sellers
- Trending products
- Location-based discovery
- Recommendations

This closes the gap with marketplaces like Jumia/Jiji that have built-in buyer traffic.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass, field
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query
import uuid
import logging
import math

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/marketplace", tags=["Marketplace Discovery"])


# ============================================
# ENUMS
# ============================================

class ListingStatus(str, Enum):
    """Listing status"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    ACTIVE = "active"
    PAUSED = "paused"
    SOLD_OUT = "sold_out"
    EXPIRED = "expired"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ListingType(str, Enum):
    """Type of listing"""
    PRODUCT = "product"
    SERVICE = "service"
    DIGITAL = "digital"


class SortOption(str, Enum):
    """Sort options for search"""
    RELEVANCE = "relevance"
    PRICE_LOW = "price_low"
    PRICE_HIGH = "price_high"
    NEWEST = "newest"
    POPULAR = "popular"
    RATING = "rating"
    DISTANCE = "distance"


class VerificationLevel(str, Enum):
    """Seller verification level"""
    UNVERIFIED = "unverified"
    PHONE_VERIFIED = "phone_verified"
    ID_VERIFIED = "id_verified"
    BUSINESS_VERIFIED = "business_verified"


# ============================================
# CATEGORIES
# ============================================

CATEGORIES = {
    "electronics": {
        "name": "Electronics",
        "icon": "smartphone",
        "subcategories": ["phones", "laptops", "tablets", "accessories", "gaming", "audio", "cameras"]
    },
    "fashion": {
        "name": "Fashion",
        "icon": "shirt",
        "subcategories": ["men", "women", "children", "shoes", "bags", "jewelry", "watches"]
    },
    "vehicles": {
        "name": "Vehicles",
        "icon": "car",
        "subcategories": ["cars", "motorcycles", "parts", "accessories"]
    },
    "property": {
        "name": "Property",
        "icon": "home",
        "subcategories": ["rent", "sale", "land", "commercial"]
    },
    "home_garden": {
        "name": "Home & Garden",
        "icon": "sofa",
        "subcategories": ["furniture", "appliances", "decor", "kitchen", "garden"]
    },
    "health_beauty": {
        "name": "Health & Beauty",
        "icon": "heart",
        "subcategories": ["skincare", "makeup", "haircare", "perfumes", "supplements"]
    },
    "services": {
        "name": "Services",
        "icon": "briefcase",
        "subcategories": ["repairs", "cleaning", "tutoring", "events", "freelance"]
    },
    "food": {
        "name": "Food & Drinks",
        "icon": "utensils",
        "subcategories": ["groceries", "prepared", "snacks", "drinks", "catering"]
    }
}

NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
    "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
    "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
    "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
    "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
]


# ============================================
# DATA MODELS
# ============================================

@dataclass
class SellerProfile:
    """Seller profile for marketplace"""
    seller_id: str
    name: str
    username: str
    bio: str
    
    # Contact
    phone: str
    whatsapp: Optional[str]
    email: Optional[str]
    instagram: Optional[str]
    
    # Location
    city: str
    state: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Verification
    verification_level: VerificationLevel = VerificationLevel.UNVERIFIED
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    
    # Media
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    
    # Stats
    total_listings: int = 0
    total_sales: int = 0
    total_revenue_ngn: int = 0
    rating: float = 0.0
    review_count: int = 0
    response_rate_pct: int = 100
    response_time_hours: int = 1
    
    # Badges
    badges: List[str] = field(default_factory=list)
    
    # Settings
    is_active: bool = True
    accepts_escrow: bool = True
    
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_active_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Listing:
    """Product/service listing"""
    listing_id: str
    seller_id: str
    
    # Basic info
    title: str
    description: str
    listing_type: ListingType
    category: str
    subcategory: str
    
    # Status
    status: ListingStatus
    
    # Pricing
    price_ngn: int
    compare_at_price_ngn: Optional[int] = None
    is_negotiable: bool = True
    
    # Media
    images: List[str] = field(default_factory=list)
    video_url: Optional[str] = None
    
    # Location
    city: str = ""
    state: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Condition (for products)
    condition: str = "new"  # new, used, refurbished
    
    # Inventory
    quantity: int = 1
    
    # Shipping
    offers_delivery: bool = True
    delivery_fee_ngn: int = 0
    pickup_available: bool = True
    
    # Stats
    view_count: int = 0
    inquiry_count: int = 0
    favorite_count: int = 0
    share_count: int = 0
    
    # Escrow
    escrow_enabled: bool = True
    
    # Tags
    tags: List[str] = field(default_factory=list)
    
    # Dates
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    
    # Boost
    is_featured: bool = False
    is_boosted: bool = False
    boost_expires_at: Optional[datetime] = None


@dataclass
class Review:
    """Seller review"""
    review_id: str
    seller_id: str
    buyer_id: str
    order_id: str
    
    rating: int  # 1-5
    title: str
    content: str
    
    # Response
    seller_response: Optional[str] = None
    seller_responded_at: Optional[datetime] = None
    
    # Verification
    is_verified_purchase: bool = True
    
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SavedSearch:
    """User's saved search"""
    search_id: str
    user_id: str
    query: str
    filters: Dict[str, Any]
    notify_new_listings: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Favorite:
    """User's favorite listing"""
    favorite_id: str
    user_id: str
    listing_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)


# ============================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================

sellers_db: Dict[str, SellerProfile] = {}
listings_db: Dict[str, Listing] = {}
reviews_db: Dict[str, Review] = {}
saved_searches_db: Dict[str, SavedSearch] = {}
favorites_db: Dict[str, Favorite] = {}


# ============================================
# MARKETPLACE ENGINE
# ============================================

class MarketplaceEngine:
    """Core engine for marketplace discovery"""
    
    # ============================================
    # SELLER PROFILES
    # ============================================
    
    @staticmethod
    def create_seller_profile(
        seller_id: str,
        name: str,
        username: str,
        bio: str,
        phone: str,
        city: str,
        state: str,
        whatsapp: str = None,
        email: str = None,
        instagram: str = None,
        avatar_url: str = None
    ) -> SellerProfile:
        """Create a seller profile"""
        # Check username uniqueness
        for seller in sellers_db.values():
            if seller.username.lower() == username.lower():
                raise ValueError(f"Username {username} is already taken")
        
        profile = SellerProfile(
            seller_id=seller_id,
            name=name,
            username=username,
            bio=bio,
            phone=phone,
            whatsapp=whatsapp or phone,
            email=email,
            instagram=instagram,
            city=city,
            state=state,
            avatar_url=avatar_url,
            verification_level=VerificationLevel.PHONE_VERIFIED
        )
        
        sellers_db[seller_id] = profile
        logger.info(f"Created seller profile for {seller_id}")
        return profile
    
    @staticmethod
    def update_seller_profile(seller_id: str, updates: Dict[str, Any]) -> SellerProfile:
        """Update seller profile"""
        if seller_id not in sellers_db:
            raise ValueError(f"Seller {seller_id} not found")
        
        profile = sellers_db[seller_id]
        
        for key, value in updates.items():
            if hasattr(profile, key) and key not in ["seller_id", "created_at"]:
                setattr(profile, key, value)
        
        return profile
    
    @staticmethod
    def update_seller_stats(seller_id: str, sale_amount_ngn: int = 0, rating: int = None):
        """Update seller stats after a sale or review"""
        if seller_id not in sellers_db:
            return
        
        profile = sellers_db[seller_id]
        
        if sale_amount_ngn > 0:
            profile.total_sales += 1
            profile.total_revenue_ngn += sale_amount_ngn
        
        if rating:
            # Update average rating
            total_rating = profile.rating * profile.review_count + rating
            profile.review_count += 1
            profile.rating = round(total_rating / profile.review_count, 1)
        
        profile.last_active_at = datetime.utcnow()
    
    @staticmethod
    def get_seller_profile(seller_id: str) -> Optional[SellerProfile]:
        """Get seller profile"""
        return sellers_db.get(seller_id)
    
    @staticmethod
    def get_seller_by_username(username: str) -> Optional[SellerProfile]:
        """Get seller by username"""
        for seller in sellers_db.values():
            if seller.username.lower() == username.lower():
                return seller
        return None
    
    # ============================================
    # LISTINGS
    # ============================================
    
    @staticmethod
    def create_listing(
        seller_id: str,
        title: str,
        description: str,
        listing_type: ListingType,
        category: str,
        subcategory: str,
        price_ngn: int,
        images: List[str] = None,
        city: str = None,
        state: str = None,
        condition: str = "new",
        quantity: int = 1,
        offers_delivery: bool = True,
        delivery_fee_ngn: int = 0,
        is_negotiable: bool = True,
        tags: List[str] = None,
        compare_at_price_ngn: int = None
    ) -> Listing:
        """Create a new listing"""
        listing_id = f"lst_{uuid.uuid4().hex[:12]}"
        
        # Get seller location if not provided
        if seller_id in sellers_db and (not city or not state):
            seller = sellers_db[seller_id]
            city = city or seller.city
            state = state or seller.state
        
        listing = Listing(
            listing_id=listing_id,
            seller_id=seller_id,
            title=title,
            description=description,
            listing_type=listing_type,
            category=category,
            subcategory=subcategory,
            status=ListingStatus.ACTIVE,
            price_ngn=price_ngn,
            compare_at_price_ngn=compare_at_price_ngn,
            is_negotiable=is_negotiable,
            images=images or [],
            city=city or "",
            state=state or "",
            condition=condition,
            quantity=quantity,
            offers_delivery=offers_delivery,
            delivery_fee_ngn=delivery_fee_ngn,
            tags=tags or [],
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        
        listings_db[listing_id] = listing
        
        # Update seller stats
        if seller_id in sellers_db:
            sellers_db[seller_id].total_listings += 1
        
        logger.info(f"Created listing {listing_id} for seller {seller_id}")
        return listing
    
    @staticmethod
    def update_listing(listing_id: str, updates: Dict[str, Any]) -> Listing:
        """Update a listing"""
        if listing_id not in listings_db:
            raise ValueError(f"Listing {listing_id} not found")
        
        listing = listings_db[listing_id]
        
        for key, value in updates.items():
            if hasattr(listing, key) and key not in ["listing_id", "seller_id", "created_at"]:
                setattr(listing, key, value)
        
        listing.updated_at = datetime.utcnow()
        return listing
    
    @staticmethod
    def record_listing_view(listing_id: str):
        """Record a listing view"""
        if listing_id in listings_db:
            listings_db[listing_id].view_count += 1
    
    @staticmethod
    def record_listing_inquiry(listing_id: str):
        """Record a listing inquiry"""
        if listing_id in listings_db:
            listings_db[listing_id].inquiry_count += 1
    
    # ============================================
    # SEARCH & DISCOVERY
    # ============================================
    
    @staticmethod
    def search_listings(
        query: str = None,
        category: str = None,
        subcategory: str = None,
        min_price: int = None,
        max_price: int = None,
        condition: str = None,
        state: str = None,
        city: str = None,
        listing_type: ListingType = None,
        sort_by: SortOption = SortOption.RELEVANCE,
        escrow_only: bool = False,
        verified_sellers_only: bool = False,
        limit: int = 20,
        offset: int = 0,
        user_latitude: float = None,
        user_longitude: float = None
    ) -> Dict[str, Any]:
        """Search listings with filters"""
        results = [l for l in listings_db.values() if l.status == ListingStatus.ACTIVE]
        
        # Apply filters
        if query:
            query_lower = query.lower()
            results = [l for l in results if 
                      query_lower in l.title.lower() or 
                      query_lower in l.description.lower() or
                      any(query_lower in tag.lower() for tag in l.tags)]
        
        if category:
            results = [l for l in results if l.category == category]
        
        if subcategory:
            results = [l for l in results if l.subcategory == subcategory]
        
        if min_price is not None:
            results = [l for l in results if l.price_ngn >= min_price]
        
        if max_price is not None:
            results = [l for l in results if l.price_ngn <= max_price]
        
        if condition:
            results = [l for l in results if l.condition == condition]
        
        if state:
            results = [l for l in results if l.state == state]
        
        if city:
            results = [l for l in results if l.city.lower() == city.lower()]
        
        if listing_type:
            results = [l for l in results if l.listing_type == listing_type]
        
        if escrow_only:
            results = [l for l in results if l.escrow_enabled]
        
        if verified_sellers_only:
            verified_seller_ids = {s.seller_id for s in sellers_db.values() if s.is_verified}
            results = [l for l in results if l.seller_id in verified_seller_ids]
        
        # Calculate distance if user location provided
        if user_latitude and user_longitude:
            for listing in results:
                if listing.latitude and listing.longitude:
                    listing._distance = MarketplaceEngine._calculate_distance(
                        user_latitude, user_longitude,
                        listing.latitude, listing.longitude
                    )
                else:
                    listing._distance = float('inf')
        
        # Sort results
        if sort_by == SortOption.PRICE_LOW:
            results.sort(key=lambda l: l.price_ngn)
        elif sort_by == SortOption.PRICE_HIGH:
            results.sort(key=lambda l: l.price_ngn, reverse=True)
        elif sort_by == SortOption.NEWEST:
            results.sort(key=lambda l: l.created_at, reverse=True)
        elif sort_by == SortOption.POPULAR:
            results.sort(key=lambda l: l.view_count + l.inquiry_count * 5, reverse=True)
        elif sort_by == SortOption.DISTANCE and user_latitude:
            results.sort(key=lambda l: getattr(l, '_distance', float('inf')))
        else:
            # Relevance: featured first, then by engagement
            results.sort(key=lambda l: (
                -int(l.is_featured),
                -int(l.is_boosted),
                -(l.view_count + l.inquiry_count * 5)
            ))
        
        total_count = len(results)
        results = results[offset:offset + limit]
        
        return {
            "listings": results,
            "total_count": total_count,
            "offset": offset,
            "limit": limit,
            "has_more": offset + limit < total_count
        }
    
    @staticmethod
    def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km (Haversine formula)"""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    @staticmethod
    def get_featured_listings(limit: int = 10) -> List[Listing]:
        """Get featured listings"""
        featured = [l for l in listings_db.values() 
                   if l.status == ListingStatus.ACTIVE and (l.is_featured or l.is_boosted)]
        featured.sort(key=lambda l: l.view_count, reverse=True)
        return featured[:limit]
    
    @staticmethod
    def get_trending_listings(limit: int = 10, days: int = 7) -> List[Listing]:
        """Get trending listings based on recent engagement"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        recent = [l for l in listings_db.values() 
                 if l.status == ListingStatus.ACTIVE and l.created_at >= cutoff]
        
        # Score by engagement rate
        for listing in recent:
            age_hours = max(1, (datetime.utcnow() - listing.created_at).total_seconds() / 3600)
            listing._trend_score = (listing.view_count + listing.inquiry_count * 10) / age_hours
        
        recent.sort(key=lambda l: getattr(l, '_trend_score', 0), reverse=True)
        return recent[:limit]
    
    @staticmethod
    def get_nearby_listings(
        latitude: float,
        longitude: float,
        radius_km: float = 10,
        limit: int = 20
    ) -> List[Listing]:
        """Get listings near a location"""
        nearby = []
        
        for listing in listings_db.values():
            if listing.status != ListingStatus.ACTIVE:
                continue
            if not listing.latitude or not listing.longitude:
                continue
            
            distance = MarketplaceEngine._calculate_distance(
                latitude, longitude,
                listing.latitude, listing.longitude
            )
            
            if distance <= radius_km:
                listing._distance = distance
                nearby.append(listing)
        
        nearby.sort(key=lambda l: l._distance)
        return nearby[:limit]
    
    @staticmethod
    def get_category_listings(
        category: str,
        subcategory: str = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get listings by category"""
        return MarketplaceEngine.search_listings(
            category=category,
            subcategory=subcategory,
            limit=limit,
            offset=offset
        )
    
    @staticmethod
    def get_seller_listings(
        seller_id: str,
        status: ListingStatus = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Listing]:
        """Get listings for a seller"""
        listings = [l for l in listings_db.values() if l.seller_id == seller_id]
        
        if status:
            listings = [l for l in listings if l.status == status]
        
        listings.sort(key=lambda l: l.created_at, reverse=True)
        return listings[offset:offset + limit]
    
    @staticmethod
    def get_recommended_listings(
        user_id: str,
        limit: int = 10
    ) -> List[Listing]:
        """Get recommended listings for a user"""
        # Get user's favorites and searches
        user_favorites = [f for f in favorites_db.values() if f.user_id == user_id]
        favorite_listing_ids = {f.listing_id for f in user_favorites}
        
        # Get categories from favorites
        favorite_categories = set()
        for listing_id in favorite_listing_ids:
            if listing_id in listings_db:
                favorite_categories.add(listings_db[listing_id].category)
        
        # Get similar listings
        recommendations = []
        for listing in listings_db.values():
            if listing.status != ListingStatus.ACTIVE:
                continue
            if listing.listing_id in favorite_listing_ids:
                continue
            if listing.category in favorite_categories:
                recommendations.append(listing)
        
        # If not enough, add popular listings
        if len(recommendations) < limit:
            popular = [l for l in listings_db.values() 
                      if l.status == ListingStatus.ACTIVE and l.listing_id not in favorite_listing_ids]
            popular.sort(key=lambda l: l.view_count, reverse=True)
            recommendations.extend(popular[:limit - len(recommendations)])
        
        return recommendations[:limit]
    
    # ============================================
    # REVIEWS
    # ============================================
    
    @staticmethod
    def create_review(
        seller_id: str,
        buyer_id: str,
        order_id: str,
        rating: int,
        title: str,
        content: str
    ) -> Review:
        """Create a seller review"""
        if rating < 1 or rating > 5:
            raise ValueError("Rating must be between 1 and 5")
        
        review_id = f"rev_{uuid.uuid4().hex[:12]}"
        
        review = Review(
            review_id=review_id,
            seller_id=seller_id,
            buyer_id=buyer_id,
            order_id=order_id,
            rating=rating,
            title=title,
            content=content
        )
        
        reviews_db[review_id] = review
        
        # Update seller rating
        MarketplaceEngine.update_seller_stats(seller_id, rating=rating)
        
        logger.info(f"Created review {review_id} for seller {seller_id}")
        return review
    
    @staticmethod
    def respond_to_review(review_id: str, response: str) -> Review:
        """Seller responds to a review"""
        if review_id not in reviews_db:
            raise ValueError(f"Review {review_id} not found")
        
        review = reviews_db[review_id]
        review.seller_response = response
        review.seller_responded_at = datetime.utcnow()
        
        return review
    
    @staticmethod
    def get_seller_reviews(
        seller_id: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[Review]:
        """Get reviews for a seller"""
        reviews = [r for r in reviews_db.values() if r.seller_id == seller_id]
        reviews.sort(key=lambda r: r.created_at, reverse=True)
        return reviews[offset:offset + limit]
    
    # ============================================
    # FAVORITES & SAVED SEARCHES
    # ============================================
    
    @staticmethod
    def add_favorite(user_id: str, listing_id: str) -> Favorite:
        """Add listing to favorites"""
        # Check if already favorited
        for fav in favorites_db.values():
            if fav.user_id == user_id and fav.listing_id == listing_id:
                return fav
        
        favorite_id = f"fav_{uuid.uuid4().hex[:12]}"
        favorite = Favorite(
            favorite_id=favorite_id,
            user_id=user_id,
            listing_id=listing_id
        )
        
        favorites_db[favorite_id] = favorite
        
        # Update listing stats
        if listing_id in listings_db:
            listings_db[listing_id].favorite_count += 1
        
        return favorite
    
    @staticmethod
    def remove_favorite(user_id: str, listing_id: str):
        """Remove listing from favorites"""
        to_remove = None
        for fav_id, fav in favorites_db.items():
            if fav.user_id == user_id and fav.listing_id == listing_id:
                to_remove = fav_id
                break
        
        if to_remove:
            del favorites_db[to_remove]
            if listing_id in listings_db:
                listings_db[listing_id].favorite_count = max(0, listings_db[listing_id].favorite_count - 1)
    
    @staticmethod
    def get_user_favorites(user_id: str) -> List[Listing]:
        """Get user's favorite listings"""
        favorite_listing_ids = [f.listing_id for f in favorites_db.values() if f.user_id == user_id]
        return [listings_db[lid] for lid in favorite_listing_ids if lid in listings_db]
    
    @staticmethod
    def save_search(
        user_id: str,
        query: str,
        filters: Dict[str, Any],
        notify_new_listings: bool = True
    ) -> SavedSearch:
        """Save a search"""
        search_id = f"srch_{uuid.uuid4().hex[:12]}"
        
        saved_search = SavedSearch(
            search_id=search_id,
            user_id=user_id,
            query=query,
            filters=filters,
            notify_new_listings=notify_new_listings
        )
        
        saved_searches_db[search_id] = saved_search
        return saved_search
    
    @staticmethod
    def get_user_saved_searches(user_id: str) -> List[SavedSearch]:
        """Get user's saved searches"""
        return [s for s in saved_searches_db.values() if s.user_id == user_id]
    
    # ============================================
    # FEATURED SELLERS
    # ============================================
    
    @staticmethod
    def get_featured_sellers(limit: int = 10) -> List[SellerProfile]:
        """Get featured sellers"""
        sellers = list(sellers_db.values())
        
        # Score by verification, rating, and sales
        for seller in sellers:
            seller._score = (
                (10 if seller.is_verified else 0) +
                seller.rating * 2 +
                min(seller.total_sales / 10, 10) +
                (5 if "top_seller" in seller.badges else 0)
            )
        
        sellers.sort(key=lambda s: s._score, reverse=True)
        return sellers[:limit]
    
    @staticmethod
    def get_top_sellers_by_category(category: str, limit: int = 5) -> List[SellerProfile]:
        """Get top sellers in a category"""
        # Get sellers with listings in this category
        seller_ids_in_category = set()
        for listing in listings_db.values():
            if listing.category == category and listing.status == ListingStatus.ACTIVE:
                seller_ids_in_category.add(listing.seller_id)
        
        sellers = [sellers_db[sid] for sid in seller_ids_in_category if sid in sellers_db]
        sellers.sort(key=lambda s: (s.rating, s.total_sales), reverse=True)
        return sellers[:limit]
    
    # ============================================
    # ANALYTICS
    # ============================================
    
    @staticmethod
    def get_marketplace_stats() -> Dict[str, Any]:
        """Get marketplace statistics"""
        active_listings = [l for l in listings_db.values() if l.status == ListingStatus.ACTIVE]
        active_sellers = [s for s in sellers_db.values() if s.is_active]
        
        # Category breakdown
        category_counts = {}
        for listing in active_listings:
            category_counts[listing.category] = category_counts.get(listing.category, 0) + 1
        
        # State breakdown
        state_counts = {}
        for listing in active_listings:
            if listing.state:
                state_counts[listing.state] = state_counts.get(listing.state, 0) + 1
        
        return {
            "total_listings": len(active_listings),
            "total_sellers": len(active_sellers),
            "verified_sellers": len([s for s in active_sellers if s.is_verified]),
            "total_reviews": len(reviews_db),
            "average_rating": round(sum(s.rating for s in active_sellers) / len(active_sellers), 1) if active_sellers else 0,
            "category_breakdown": category_counts,
            "state_breakdown": state_counts,
            "escrow_enabled_listings": len([l for l in active_listings if l.escrow_enabled])
        }


# ============================================
# PYDANTIC MODELS FOR API
# ============================================

class CreateSellerProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_]+$")
    bio: str = Field(..., max_length=500)
    phone: str
    city: str
    state: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    avatar_url: Optional[str] = None


class UpdateSellerProfileRequest(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None


class CreateListingRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20, max_length=5000)
    listing_type: ListingType
    category: str
    subcategory: str
    price_ngn: int = Field(..., ge=100)
    images: Optional[List[str]] = None
    city: Optional[str] = None
    state: Optional[str] = None
    condition: str = "new"
    quantity: int = 1
    offers_delivery: bool = True
    delivery_fee_ngn: int = 0
    is_negotiable: bool = True
    tags: Optional[List[str]] = None
    compare_at_price_ngn: Optional[int] = None


class UpdateListingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price_ngn: Optional[int] = None
    status: Optional[ListingStatus] = None
    images: Optional[List[str]] = None
    condition: Optional[str] = None
    quantity: Optional[int] = None
    offers_delivery: Optional[bool] = None
    delivery_fee_ngn: Optional[int] = None
    is_negotiable: Optional[bool] = None
    tags: Optional[List[str]] = None


class SearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    condition: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    listing_type: Optional[ListingType] = None
    sort_by: SortOption = SortOption.RELEVANCE
    escrow_only: bool = False
    verified_sellers_only: bool = False
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CreateReviewRequest(BaseModel):
    order_id: str
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., min_length=5, max_length=100)
    content: str = Field(..., min_length=20, max_length=1000)


class SaveSearchRequest(BaseModel):
    query: str
    filters: Dict[str, Any]
    notify_new_listings: bool = True


# ============================================
# API ENDPOINTS
# ============================================

# Categories
@router.get("/categories")
async def get_categories():
    """Get all categories"""
    return {"categories": CATEGORIES}


@router.get("/states")
async def get_states():
    """Get Nigerian states"""
    return {"states": NIGERIAN_STATES}


# Seller profiles
@router.post("/sellers/{seller_id}")
async def create_seller_profile(seller_id: str, request: CreateSellerProfileRequest):
    """Create a seller profile"""
    try:
        profile = MarketplaceEngine.create_seller_profile(
            seller_id=seller_id,
            name=request.name,
            username=request.username,
            bio=request.bio,
            phone=request.phone,
            city=request.city,
            state=request.state,
            whatsapp=request.whatsapp,
            email=request.email,
            instagram=request.instagram,
            avatar_url=request.avatar_url
        )
        return {"profile": profile.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sellers/{seller_id}")
async def get_seller_profile(seller_id: str):
    """Get seller profile"""
    profile = MarketplaceEngine.get_seller_profile(seller_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {"profile": profile.__dict__}


@router.get("/sellers/username/{username}")
async def get_seller_by_username(username: str):
    """Get seller by username"""
    profile = MarketplaceEngine.get_seller_by_username(username)
    if not profile:
        raise HTTPException(status_code=404, detail="Seller not found")
    return {"profile": profile.__dict__}


@router.put("/sellers/{seller_id}")
async def update_seller_profile(seller_id: str, request: UpdateSellerProfileRequest):
    """Update seller profile"""
    try:
        updates = {k: v for k, v in request.dict().items() if v is not None}
        profile = MarketplaceEngine.update_seller_profile(seller_id, updates)
        return {"profile": profile.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sellers/featured")
async def get_featured_sellers(limit: int = Query(10, ge=1, le=50)):
    """Get featured sellers"""
    sellers = MarketplaceEngine.get_featured_sellers(limit)
    return {"sellers": [s.__dict__ for s in sellers]}


@router.get("/sellers/top/{category}")
async def get_top_sellers_by_category(category: str, limit: int = Query(5, ge=1, le=20)):
    """Get top sellers in a category"""
    sellers = MarketplaceEngine.get_top_sellers_by_category(category, limit)
    return {"sellers": [s.__dict__ for s in sellers]}


# Listings
@router.post("/listings/{seller_id}")
async def create_listing(seller_id: str, request: CreateListingRequest):
    """Create a new listing"""
    listing = MarketplaceEngine.create_listing(
        seller_id=seller_id,
        title=request.title,
        description=request.description,
        listing_type=request.listing_type,
        category=request.category,
        subcategory=request.subcategory,
        price_ngn=request.price_ngn,
        images=request.images,
        city=request.city,
        state=request.state,
        condition=request.condition,
        quantity=request.quantity,
        offers_delivery=request.offers_delivery,
        delivery_fee_ngn=request.delivery_fee_ngn,
        is_negotiable=request.is_negotiable,
        tags=request.tags,
        compare_at_price_ngn=request.compare_at_price_ngn
    )
    return {"listing": listing.__dict__}


@router.get("/listings/{listing_id}")
async def get_listing(listing_id: str, record_view: bool = True):
    """Get a listing"""
    if listing_id not in listings_db:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if record_view:
        MarketplaceEngine.record_listing_view(listing_id)
    
    listing = listings_db[listing_id]
    seller = sellers_db.get(listing.seller_id)
    
    return {
        "listing": listing.__dict__,
        "seller": seller.__dict__ if seller else None
    }


@router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, request: UpdateListingRequest):
    """Update a listing"""
    try:
        updates = {k: v for k, v in request.dict().items() if v is not None}
        listing = MarketplaceEngine.update_listing(listing_id, updates)
        return {"listing": listing.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/listings/seller/{seller_id}")
async def get_seller_listings(
    seller_id: str,
    status: Optional[ListingStatus] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get listings for a seller"""
    listings = MarketplaceEngine.get_seller_listings(seller_id, status, limit, offset)
    return {"listings": [l.__dict__ for l in listings], "count": len(listings)}


# Search & Discovery
@router.post("/search")
async def search_listings(request: SearchRequest):
    """Search listings"""
    results = MarketplaceEngine.search_listings(
        query=request.query,
        category=request.category,
        subcategory=request.subcategory,
        min_price=request.min_price,
        max_price=request.max_price,
        condition=request.condition,
        state=request.state,
        city=request.city,
        listing_type=request.listing_type,
        sort_by=request.sort_by,
        escrow_only=request.escrow_only,
        verified_sellers_only=request.verified_sellers_only,
        limit=request.limit,
        offset=request.offset,
        user_latitude=request.latitude,
        user_longitude=request.longitude
    )
    
    return {
        "listings": [l.__dict__ for l in results["listings"]],
        "total_count": results["total_count"],
        "offset": results["offset"],
        "limit": results["limit"],
        "has_more": results["has_more"]
    }


@router.get("/featured")
async def get_featured_listings(limit: int = Query(10, ge=1, le=50)):
    """Get featured listings"""
    listings = MarketplaceEngine.get_featured_listings(limit)
    return {"listings": [l.__dict__ for l in listings]}


@router.get("/trending")
async def get_trending_listings(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(7, ge=1, le=30)
):
    """Get trending listings"""
    listings = MarketplaceEngine.get_trending_listings(limit, days)
    return {"listings": [l.__dict__ for l in listings]}


@router.get("/nearby")
async def get_nearby_listings(
    latitude: float,
    longitude: float,
    radius_km: float = Query(10, ge=1, le=100),
    limit: int = Query(20, ge=1, le=100)
):
    """Get listings near a location"""
    listings = MarketplaceEngine.get_nearby_listings(latitude, longitude, radius_km, limit)
    return {"listings": [l.__dict__ for l in listings]}


@router.get("/category/{category}")
async def get_category_listings(
    category: str,
    subcategory: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get listings by category"""
    results = MarketplaceEngine.get_category_listings(category, subcategory, limit, offset)
    return {
        "listings": [l.__dict__ for l in results["listings"]],
        "total_count": results["total_count"],
        "has_more": results["has_more"]
    }


@router.get("/recommendations/{user_id}")
async def get_recommendations(user_id: str, limit: int = Query(10, ge=1, le=50)):
    """Get recommended listings for a user"""
    listings = MarketplaceEngine.get_recommended_listings(user_id, limit)
    return {"listings": [l.__dict__ for l in listings]}


# Reviews
@router.post("/reviews/{seller_id}/{buyer_id}")
async def create_review(seller_id: str, buyer_id: str, request: CreateReviewRequest):
    """Create a seller review"""
    try:
        review = MarketplaceEngine.create_review(
            seller_id=seller_id,
            buyer_id=buyer_id,
            order_id=request.order_id,
            rating=request.rating,
            title=request.title,
            content=request.content
        )
        return {"review": review.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reviews/{seller_id}")
async def get_seller_reviews(
    seller_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get reviews for a seller"""
    reviews = MarketplaceEngine.get_seller_reviews(seller_id, limit, offset)
    return {"reviews": [r.__dict__ for r in reviews], "count": len(reviews)}


@router.post("/reviews/{review_id}/respond")
async def respond_to_review(review_id: str, response: str = Query(...)):
    """Seller responds to a review"""
    try:
        review = MarketplaceEngine.respond_to_review(review_id, response)
        return {"review": review.__dict__}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# Favorites
@router.post("/favorites/{user_id}/{listing_id}")
async def add_favorite(user_id: str, listing_id: str):
    """Add listing to favorites"""
    favorite = MarketplaceEngine.add_favorite(user_id, listing_id)
    return {"favorite": favorite.__dict__}


@router.delete("/favorites/{user_id}/{listing_id}")
async def remove_favorite(user_id: str, listing_id: str):
    """Remove listing from favorites"""
    MarketplaceEngine.remove_favorite(user_id, listing_id)
    return {"success": True}


@router.get("/favorites/{user_id}")
async def get_user_favorites(user_id: str):
    """Get user's favorite listings"""
    listings = MarketplaceEngine.get_user_favorites(user_id)
    return {"listings": [l.__dict__ for l in listings]}


# Saved searches
@router.post("/saved-searches/{user_id}")
async def save_search(user_id: str, request: SaveSearchRequest):
    """Save a search"""
    saved_search = MarketplaceEngine.save_search(
        user_id=user_id,
        query=request.query,
        filters=request.filters,
        notify_new_listings=request.notify_new_listings
    )
    return {"saved_search": saved_search.__dict__}


@router.get("/saved-searches/{user_id}")
async def get_saved_searches(user_id: str):
    """Get user's saved searches"""
    searches = MarketplaceEngine.get_user_saved_searches(user_id)
    return {"saved_searches": [s.__dict__ for s in searches]}


# Analytics
@router.get("/stats")
async def get_marketplace_stats():
    """Get marketplace statistics"""
    stats = MarketplaceEngine.get_marketplace_stats()
    return {"stats": stats}
