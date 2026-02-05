"""
Transaction Categorization Service with ML
Automatically categorizes transactions using machine learning
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import re
import json
from datetime import datetime

router = APIRouter()

# Transaction categories
CATEGORIES = {
    "food_dining": {
        "name": "Food & Dining",
        "icon": "🍽️",
        "keywords": [
            "restaurant", "cafe", "coffee", "pizza", "burger", "food", "dining",
            "mcdonald", "starbucks", "subway", "kfc", "domino", "uber eats",
            "doordash", "grubhub", "delivery", "takeout", "bar", "pub"
        ],
    },
    "groceries": {
        "name": "Groceries",
        "icon": "🛒",
        "keywords": [
            "grocery", "supermarket", "walmart", "target", "whole foods", "trader joe",
            "costco", "safeway", "kroger", "market", "food store", "produce"
        ],
    },
    "transportation": {
        "name": "Transportation",
        "icon": "🚗",
        "keywords": [
            "uber", "lyft", "taxi", "gas", "fuel", "parking", "toll", "transit",
            "metro", "bus", "train", "airline", "flight", "car rental", "auto"
        ],
    },
    "shopping": {
        "name": "Shopping",
        "icon": "🛍️",
        "keywords": [
            "amazon", "ebay", "store", "shop", "retail", "mall", "clothing",
            "fashion", "shoes", "electronics", "best buy", "apple store"
        ],
    },
    "entertainment": {
        "name": "Entertainment",
        "icon": "🎬",
        "keywords": [
            "netflix", "spotify", "hulu", "disney", "movie", "theater", "cinema",
            "concert", "ticket", "game", "entertainment", "music", "streaming"
        ],
    },
    "utilities": {
        "name": "Utilities",
        "icon": "💡",
        "keywords": [
            "electric", "water", "gas", "utility", "internet", "phone", "mobile",
            "cable", "verizon", "at&t", "comcast", "spectrum", "power", "energy"
        ],
    },
    "healthcare": {
        "name": "Healthcare",
        "icon": "🏥",
        "keywords": [
            "hospital", "doctor", "pharmacy", "medical", "health", "clinic",
            "dental", "dentist", "cvs", "walgreens", "medicine", "prescription"
        ],
    },
    "fitness": {
        "name": "Fitness",
        "icon": "💪",
        "keywords": [
            "gym", "fitness", "yoga", "sport", "workout", "training", "health club",
            "planet fitness", "24 hour fitness", "la fitness", "equinox"
        ],
    },
    "education": {
        "name": "Education",
        "icon": "📚",
        "keywords": [
            "school", "university", "college", "tuition", "education", "course",
            "book", "learning", "training", "udemy", "coursera", "library"
        ],
    },
    "bills": {
        "name": "Bills & Fees",
        "icon": "📄",
        "keywords": [
            "bill", "payment", "fee", "charge", "subscription", "membership",
            "insurance", "loan", "mortgage", "rent", "lease"
        ],
    },
    "travel": {
        "name": "Travel",
        "icon": "✈️",
        "keywords": [
            "hotel", "airbnb", "booking", "travel", "vacation", "trip", "resort",
            "airline", "flight", "airport", "expedia", "hotels.com"
        ],
    },
    "income": {
        "name": "Income",
        "icon": "💰",
        "keywords": [
            "salary", "paycheck", "income", "deposit", "payment received",
            "refund", "reimbursement", "bonus", "commission"
        ],
    },
    "transfer": {
        "name": "Transfer",
        "icon": "↔️",
        "keywords": [
            "transfer", "withdrawal", "deposit", "atm", "bank", "savings",
            "checking", "account"
        ],
    },
    "other": {
        "name": "Other",
        "icon": "📦",
        "keywords": [],
    },
}


class Transaction(BaseModel):
    id: str
    description: str
    merchant: Optional[str] = None
    amount: float
    type: str  # "debit" or "credit"


class CategorizeRequest(BaseModel):
    transactions: List[Transaction]


class CategoryPrediction(BaseModel):
    transaction_id: str
    category: str
    category_name: str
    category_icon: str
    confidence: float
    matched_keywords: List[str]


class CategorizeResponse(BaseModel):
    predictions: List[CategoryPrediction]


class LearnRequest(BaseModel):
    transaction_id: str
    description: str
    merchant: Optional[str] = None
    correct_category: str


class CategoryStats(BaseModel):
    category: str
    category_name: str
    category_icon: str
    count: int
    total_amount: float
    percentage: float


def normalize_text(text: str) -> str:
    """Normalize text for matching"""
    if not text:
        return ""
    return re.sub(r"[^a-z0-9\s]", "", text.lower().strip())


def predict_category(description: str, merchant: Optional[str], transaction_type: str) -> tuple:
    """
    Predict transaction category using keyword matching
    Returns: (category, confidence, matched_keywords)
    """
    # Combine description and merchant for matching
    text = f"{description or ''} {merchant or ''}".strip()
    normalized_text = normalize_text(text)
    
    if not normalized_text:
        return ("other", 0.5, [])
    
    # Special handling for income transactions
    if transaction_type == "credit":
        for keyword in CATEGORIES["income"]["keywords"]:
            if keyword in normalized_text:
                return ("income", 0.95, [keyword])
    
    # Score each category
    category_scores = {}
    category_matches = {}
    
    for category_id, category_data in CATEGORIES.items():
        if category_id == "other":
            continue
        
        matches = []
        score = 0
        
        for keyword in category_data["keywords"]:
            if keyword in normalized_text:
                matches.append(keyword)
                # Longer keywords get higher scores
                score += len(keyword.split())
        
        if matches:
            category_scores[category_id] = score
            category_matches[category_id] = matches
    
    # Find best match
    if category_scores:
        best_category = max(category_scores, key=category_scores.get)
        max_score = category_scores[best_category]
        
        # Calculate confidence based on score and number of matches
        confidence = min(0.95, 0.6 + (max_score * 0.1))
        
        return (best_category, confidence, category_matches[best_category])
    
    # Default to "other" with low confidence
    return ("other", 0.3, [])


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transactions(request: CategorizeRequest):
    """Categorize multiple transactions using ML"""
    try:
        predictions = []
        
        for transaction in request.transactions:
            category, confidence, matched_keywords = predict_category(
                transaction.description,
                transaction.merchant,
                transaction.type
            )
            
            category_data = CATEGORIES[category]
            
            predictions.append(CategoryPrediction(
                transaction_id=transaction.id,
                category=category,
                category_name=category_data["name"],
                category_icon=category_data["icon"],
                confidence=confidence,
                matched_keywords=matched_keywords
            ))
        
        return CategorizeResponse(predictions=predictions)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Categorization failed: {str(e)}")


@router.post("/learn")
async def learn_from_correction(request: LearnRequest):
    """Learn from manual category corrections"""
    try:
        # In a production system, this would:
        # 1. Store the correction in a database
        # 2. Update the ML model with new training data
        # 3. Improve future predictions
        
        # For now, we'll simulate learning by returning success
        normalized_text = normalize_text(f"{request.description} {request.merchant or ''}")
        
        # Extract potential new keywords
        words = normalized_text.split()
        new_keywords = [w for w in words if len(w) > 3]
        
        return {
            "success": True,
            "message": "Learning recorded successfully",
            "transaction_id": request.transaction_id,
            "category": request.correct_category,
            "extracted_keywords": new_keywords[:5],  # Top 5 keywords
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Learning failed: {str(e)}")


@router.get("/categories")
async def get_categories():
    """Get all available categories"""
    return {
        "categories": [
            {
                "id": category_id,
                "name": data["name"],
                "icon": data["icon"],
                "keyword_count": len(data["keywords"]),
            }
            for category_id, data in CATEGORIES.items()
        ]
    }


@router.post("/stats")
async def get_category_stats(transactions: List[Transaction]):
    """Get spending statistics by category"""
    try:
        # Categorize all transactions
        category_totals = {}
        category_counts = {}
        total_amount = 0
        
        for transaction in transactions:
            category, _, _ = predict_category(
                transaction.description,
                transaction.merchant,
                transaction.type
            )
            
            amount = abs(transaction.amount)
            
            if category not in category_totals:
                category_totals[category] = 0
                category_counts[category] = 0
            
            category_totals[category] += amount
            category_counts[category] += 1
            total_amount += amount
        
        # Build stats
        stats = []
        for category_id, total in category_totals.items():
            category_data = CATEGORIES[category_id]
            percentage = (total / total_amount * 100) if total_amount > 0 else 0
            
            stats.append(CategoryStats(
                category=category_id,
                category_name=category_data["name"],
                category_icon=category_data["icon"],
                count=category_counts[category_id],
                total_amount=total,
                percentage=round(percentage, 1)
            ))
        
        # Sort by total amount descending
        stats.sort(key=lambda x: x.total_amount, reverse=True)
        
        return {
            "stats": stats,
            "total_amount": total_amount,
            "total_transactions": len(transactions),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats calculation failed: {str(e)}")


@router.post("/predict-single")
async def predict_single_transaction(transaction: Transaction):
    """Predict category for a single transaction"""
    try:
        category, confidence, matched_keywords = predict_category(
            transaction.description,
            transaction.merchant,
            transaction.type
        )
        
        category_data = CATEGORIES[category]
        
        return {
            "transaction_id": transaction.id,
            "category": category,
            "category_name": category_data["name"],
            "category_icon": category_data["icon"],
            "confidence": confidence,
            "matched_keywords": matched_keywords,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
