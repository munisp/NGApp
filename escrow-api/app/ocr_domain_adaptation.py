"""
OCR/NLP Domain Adaptation Module

This module provides domain-adapted OCR and NLP capabilities for Nigerian social commerce:
1. Nigerian-specific text validators (phone, price, location)
2. Pidgin English and code-mixed language processing
3. Feedback loop for continuous improvement
4. Fine-tuning pipeline for model adaptation
5. Multi-frame video OCR aggregation

Designed for Instagram, WhatsApp, TikTok, and Facebook content.
"""

import os
import re
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple, Literal
from enum import Enum
from dataclasses import dataclass, field
from collections import Counter
import uuid
import hashlib

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class OCRConfig:
    """OCR configuration"""
    
    # Model Configuration
    OCR_MODEL = os.getenv("OCR_MODEL", "deepseek-vl")
    NLP_MODEL = os.getenv("NLP_MODEL", "bert-base-multilingual")
    
    # Confidence Thresholds
    HIGH_CONFIDENCE_THRESHOLD = float(os.getenv("HIGH_CONFIDENCE_THRESHOLD", "0.95"))
    MEDIUM_CONFIDENCE_THRESHOLD = float(os.getenv("MEDIUM_CONFIDENCE_THRESHOLD", "0.80"))
    LOW_CONFIDENCE_THRESHOLD = float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.60"))
    
    # Feedback Configuration
    FEEDBACK_COLLECTION_ENABLED = os.getenv("FEEDBACK_COLLECTION_ENABLED", "true").lower() == "true"
    MIN_FEEDBACK_FOR_TRAINING = int(os.getenv("MIN_FEEDBACK_FOR_TRAINING", "100"))
    
    # Nigerian-specific Configuration
    NIGERIAN_PHONE_PREFIXES = ["080", "081", "090", "091", "070", "071"]
    NIGERIAN_CURRENCIES = ["NGN", "N", "₦", "#", "naira"]
    NIGERIAN_PRICE_PATTERNS = ["k", "K", "thousand", "m", "M", "million"]


# =============================================================================
# Data Models
# =============================================================================

class ContentType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    TEXT = "text"
    MIXED = "mixed"


class ExtractionConfidence(str, Enum):
    HIGH = "high"  # >= 95%
    MEDIUM = "medium"  # >= 80%
    LOW = "low"  # >= 60%
    VERY_LOW = "very_low"  # < 60%


class CommerceIntent(str, Enum):
    SELLING = "selling"
    BUYING = "buying"
    INQUIRY = "inquiry"
    NEGOTIATION = "negotiation"
    UNKNOWN = "unknown"


@dataclass
class PhoneNumber:
    """Extracted phone number"""
    raw: str
    normalized: str
    country_code: str = "+234"
    is_valid: bool = False
    is_whatsapp: bool = False
    confidence: float = 0.0


@dataclass
class Price:
    """Extracted price"""
    raw: str
    amount: float
    currency: str = "NGN"
    is_negotiable: bool = False
    confidence: float = 0.0


@dataclass
class Location:
    """Extracted location"""
    raw: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "Nigeria"
    is_delivery_location: bool = False
    confidence: float = 0.0


@dataclass
class CommerceSignal:
    """Commerce signal detected in content"""
    signal_type: str
    value: str
    confidence: float
    source: str  # "caption", "image", "video", "comment"
    position: Optional[Tuple[int, int]] = None  # For image/video coordinates


@dataclass
class ExtractionResult:
    """Complete extraction result"""
    content_id: str
    content_type: ContentType
    platform: str
    
    # Extracted entities
    phones: List[PhoneNumber]
    prices: List[Price]
    locations: List[Location]
    
    # Commerce signals
    signals: List[CommerceSignal]
    commerce_intent: CommerceIntent
    
    # Confidence
    overall_confidence: float
    confidence_level: ExtractionConfidence
    
    # Raw data
    raw_text: str
    ocr_text: Optional[str] = None
    
    # Metadata
    extraction_time_ms: int = 0
    model_version: str = "1.0.0"
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class FeedbackRecord:
    """User feedback on extraction"""
    extraction_id: str
    field: str  # "phone", "price", "location", "intent"
    extracted_value: str
    correct_value: Optional[str]
    is_correct: bool
    user_id: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TrainingExample:
    """Training example for fine-tuning"""
    input_text: str
    expected_output: Dict[str, Any]
    source: str
    verified: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)


# =============================================================================
# Nigerian Text Validators
# =============================================================================

class NigerianPhoneValidator:
    """Validates and normalizes Nigerian phone numbers"""
    
    VALID_PREFIXES = OCRConfig.NIGERIAN_PHONE_PREFIXES
    
    # Network mappings
    NETWORK_PREFIXES = {
        "0803": "MTN", "0806": "MTN", "0703": "MTN", "0706": "MTN",
        "0813": "MTN", "0816": "MTN", "0810": "MTN", "0814": "MTN",
        "0903": "MTN", "0906": "MTN", "0913": "MTN", "0916": "MTN",
        "0805": "Glo", "0807": "Glo", "0705": "Glo", "0815": "Glo",
        "0811": "Glo", "0905": "Glo", "0915": "Glo",
        "0802": "Airtel", "0808": "Airtel", "0708": "Airtel",
        "0812": "Airtel", "0701": "Airtel", "0902": "Airtel", "0901": "Airtel",
        "0809": "9mobile", "0817": "9mobile", "0818": "9mobile",
        "0908": "9mobile", "0909": "9mobile",
    }
    
    @classmethod
    def extract_phones(cls, text: str) -> List[PhoneNumber]:
        """Extract and validate Nigerian phone numbers from text"""
        phones = []
        
        # Pattern for Nigerian phone numbers
        patterns = [
            r'(?:(?:\+234|234|0)[\s.-]?)([789][01]\d[\s.-]?\d{3}[\s.-]?\d{4})',
            r'(?:(?:\+234|234|0))([789][01]\d{8})',
            r'0([789][01]\d[\s.-]?\d{3}[\s.-]?\d{4})',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                raw = match.group(0)
                # Clean the number
                digits = re.sub(r'[\s.-]', '', raw)
                digits = re.sub(r'^(\+?234|234)', '0', digits)
                
                if len(digits) == 11 and digits.startswith('0'):
                    # Validate prefix
                    prefix = digits[:4]
                    is_valid = prefix in cls.NETWORK_PREFIXES or digits[:3] in cls.VALID_PREFIXES
                    
                    # Normalize to international format
                    normalized = f"+234{digits[1:]}"
                    
                    phones.append(PhoneNumber(
                        raw=raw,
                        normalized=normalized,
                        country_code="+234",
                        is_valid=is_valid,
                        is_whatsapp=cls._is_likely_whatsapp(text, raw),
                        confidence=0.95 if is_valid else 0.7
                    ))
        
        # Deduplicate by normalized number
        seen = set()
        unique_phones = []
        for phone in phones:
            if phone.normalized not in seen:
                seen.add(phone.normalized)
                unique_phones.append(phone)
        
        return unique_phones
    
    @classmethod
    def _is_likely_whatsapp(cls, text: str, phone: str) -> bool:
        """Check if phone is likely a WhatsApp number"""
        # Look for WhatsApp indicators near the phone number
        whatsapp_indicators = [
            "whatsapp", "wa", "dm", "message", "chat", "text",
            "📱", "💬", "wa.me", "whatsap"
        ]
        
        text_lower = text.lower()
        phone_pos = text_lower.find(phone.lower())
        
        if phone_pos == -1:
            return False
        
        # Check 50 characters before and after
        context = text_lower[max(0, phone_pos-50):phone_pos+len(phone)+50]
        
        return any(indicator in context for indicator in whatsapp_indicators)


class NigerianPriceValidator:
    """Validates and normalizes Nigerian prices"""
    
    CURRENCY_SYMBOLS = ["₦", "N", "#", "NGN", "naira"]
    
    @classmethod
    def extract_prices(cls, text: str) -> List[Price]:
        """Extract and validate Nigerian prices from text"""
        prices = []
        
        # Patterns for Nigerian prices
        patterns = [
            # ₦50,000 or N50,000 or #50,000
            r'[₦N#]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            # 50,000 NGN or 50000 naira
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:NGN|naira)',
            # 50k or 50K (thousands)
            r'(\d+(?:\.\d+)?)\s*[kK](?:\s|$|,|\.)',
            # 1.5m or 1.5M (millions)
            r'(\d+(?:\.\d+)?)\s*[mM](?:\s|$|,|\.)',
            # Price: 50000 or Cost: 50,000
            r'(?:price|cost|amount|pay|selling|sold)[\s:]*[₦N#]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                raw = match.group(0)
                amount_str = match.group(1)
                
                # Parse amount
                amount = cls._parse_amount(amount_str, raw)
                
                if amount and amount > 0:
                    # Check if negotiable
                    is_negotiable = cls._is_negotiable(text, raw)
                    
                    prices.append(Price(
                        raw=raw,
                        amount=amount,
                        currency="NGN",
                        is_negotiable=is_negotiable,
                        confidence=0.9 if amount >= 100 else 0.7
                    ))
        
        # Deduplicate by amount
        seen = set()
        unique_prices = []
        for price in prices:
            if price.amount not in seen:
                seen.add(price.amount)
                unique_prices.append(price)
        
        return unique_prices
    
    @classmethod
    def _parse_amount(cls, amount_str: str, raw: str) -> Optional[float]:
        """Parse amount from string"""
        try:
            # Remove commas
            clean = amount_str.replace(",", "")
            amount = float(clean)
            
            # Check for k/K suffix
            if re.search(r'[kK](?:\s|$|,|\.)', raw):
                amount *= 1000
            # Check for m/M suffix
            elif re.search(r'[mM](?:\s|$|,|\.)', raw):
                amount *= 1000000
            
            return amount
        except ValueError:
            return None
    
    @classmethod
    def _is_negotiable(cls, text: str, price_raw: str) -> bool:
        """Check if price is negotiable"""
        negotiable_indicators = [
            "negotiable", "nego", "slightly nego", "last price",
            "final price", "or best offer", "obo", "make offer"
        ]
        
        text_lower = text.lower()
        return any(indicator in text_lower for indicator in negotiable_indicators)


class NigerianLocationValidator:
    """Validates and normalizes Nigerian locations"""
    
    # Major Nigerian cities and states
    NIGERIAN_STATES = {
        "lagos": "Lagos",
        "abuja": "FCT",
        "kano": "Kano",
        "ibadan": "Oyo",
        "port harcourt": "Rivers",
        "ph": "Rivers",
        "benin": "Edo",
        "kaduna": "Kaduna",
        "enugu": "Enugu",
        "onitsha": "Anambra",
        "aba": "Abia",
        "warri": "Delta",
        "calabar": "Cross River",
        "uyo": "Akwa Ibom",
        "owerri": "Imo",
        "jos": "Plateau",
        "ilorin": "Kwara",
        "abeokuta": "Ogun",
        "akure": "Ondo",
        "osogbo": "Osun",
    }
    
    # Lagos areas
    LAGOS_AREAS = [
        "ikeja", "lekki", "vi", "victoria island", "ikoyi", "surulere",
        "yaba", "maryland", "ojuelegba", "mushin", "oshodi", "festac",
        "ajah", "sangotedo", "epe", "ikorodu", "badagry", "apapa",
        "marina", "obalende", "ebute metta", "agege", "ogba", "berger"
    ]
    
    @classmethod
    def extract_locations(cls, text: str) -> List[Location]:
        """Extract and validate Nigerian locations from text"""
        locations = []
        text_lower = text.lower()
        
        # Check for states/cities
        for city, state in cls.NIGERIAN_STATES.items():
            if city in text_lower:
                # Find the actual text match for proper casing
                pattern = re.compile(re.escape(city), re.IGNORECASE)
                match = pattern.search(text)
                if match:
                    locations.append(Location(
                        raw=match.group(0),
                        city=city.title(),
                        state=state,
                        country="Nigeria",
                        is_delivery_location=cls._is_delivery_location(text, match.group(0)),
                        confidence=0.9
                    ))
        
        # Check for Lagos areas
        for area in cls.LAGOS_AREAS:
            if area in text_lower:
                pattern = re.compile(re.escape(area), re.IGNORECASE)
                match = pattern.search(text)
                if match:
                    locations.append(Location(
                        raw=match.group(0),
                        city=area.title(),
                        state="Lagos",
                        country="Nigeria",
                        is_delivery_location=cls._is_delivery_location(text, match.group(0)),
                        confidence=0.85
                    ))
        
        # Deduplicate
        seen = set()
        unique_locations = []
        for loc in locations:
            key = f"{loc.city}-{loc.state}"
            if key not in seen:
                seen.add(key)
                unique_locations.append(loc)
        
        return unique_locations
    
    @classmethod
    def _is_delivery_location(cls, text: str, location: str) -> bool:
        """Check if location is mentioned as delivery location"""
        delivery_indicators = [
            "deliver", "delivery", "ship", "shipping", "send to",
            "pickup", "pick up", "collect", "location"
        ]
        
        text_lower = text.lower()
        loc_pos = text_lower.find(location.lower())
        
        if loc_pos == -1:
            return False
        
        # Check 50 characters before
        context = text_lower[max(0, loc_pos-50):loc_pos]
        
        return any(indicator in context for indicator in delivery_indicators)


# =============================================================================
# Pidgin English Processor
# =============================================================================

class PidginProcessor:
    """Process Nigerian Pidgin English and code-mixed text"""
    
    # Common Pidgin words and their meanings
    PIDGIN_DICTIONARY = {
        "wetin": "what",
        "dey": "is/are",
        "na": "is/it's",
        "abi": "right?/or",
        "shey": "is it?",
        "wahala": "problem",
        "jara": "bonus/extra",
        "kpakpakpa": "plenty",
        "oya": "come on/let's go",
        "abeg": "please",
        "how much": "price inquiry",
        "last price": "final price",
        "no vex": "don't be angry",
        "e don sell": "it's sold",
        "still dey": "still available",
        "dm": "direct message",
        "pm": "private message",
        "swipe": "swipe to see more",
        "link in bio": "link in profile",
        "cop": "buy",
        "drip": "stylish item",
        "sabi": "know/understand",
        "chop": "eat/use",
        "ginger": "motivate/excite",
        "pepper dem": "show off",
        "no dulling": "don't miss out",
        "grab am": "buy it",
        "rush am": "buy quickly",
        "e remain small": "almost sold out",
        "first come": "first come first served",
        "serious buyer": "genuine buyer",
        "time waster": "not serious buyer",
    }
    
    # Commerce-related Pidgin phrases
    COMMERCE_PHRASES = {
        "how much": CommerceIntent.INQUIRY,
        "price": CommerceIntent.INQUIRY,
        "last price": CommerceIntent.NEGOTIATION,
        "final price": CommerceIntent.NEGOTIATION,
        "i wan buy": CommerceIntent.BUYING,
        "i dey sell": CommerceIntent.SELLING,
        "for sale": CommerceIntent.SELLING,
        "available": CommerceIntent.SELLING,
        "dm to order": CommerceIntent.SELLING,
        "interested": CommerceIntent.BUYING,
        "i need": CommerceIntent.BUYING,
        "who wan buy": CommerceIntent.SELLING,
        "who dey sell": CommerceIntent.BUYING,
    }
    
    @classmethod
    def detect_commerce_intent(cls, text: str) -> Tuple[CommerceIntent, float]:
        """Detect commerce intent from text"""
        text_lower = text.lower()
        
        intent_scores = {
            CommerceIntent.SELLING: 0,
            CommerceIntent.BUYING: 0,
            CommerceIntent.INQUIRY: 0,
            CommerceIntent.NEGOTIATION: 0,
        }
        
        # Check for commerce phrases
        for phrase, intent in cls.COMMERCE_PHRASES.items():
            if phrase in text_lower:
                intent_scores[intent] += 1
        
        # Additional selling indicators
        selling_indicators = [
            "for sale", "selling", "available", "dm to order",
            "order now", "buy now", "grab", "cop", "get yours",
            "limited stock", "swipe up", "link in bio"
        ]
        for indicator in selling_indicators:
            if indicator in text_lower:
                intent_scores[CommerceIntent.SELLING] += 0.5
        
        # Additional buying indicators
        buying_indicators = [
            "looking for", "i need", "who dey sell", "where can i",
            "interested", "i want", "i wan"
        ]
        for indicator in buying_indicators:
            if indicator in text_lower:
                intent_scores[CommerceIntent.BUYING] += 0.5
        
        # Get highest scoring intent
        max_intent = max(intent_scores, key=intent_scores.get)
        max_score = intent_scores[max_intent]
        
        if max_score == 0:
            return CommerceIntent.UNKNOWN, 0.0
        
        # Normalize confidence
        total_score = sum(intent_scores.values())
        confidence = max_score / total_score if total_score > 0 else 0
        
        return max_intent, min(confidence, 1.0)
    
    @classmethod
    def normalize_text(cls, text: str) -> str:
        """Normalize Pidgin text to standard English"""
        normalized = text
        
        for pidgin, english in cls.PIDGIN_DICTIONARY.items():
            # Case-insensitive replacement
            pattern = re.compile(re.escape(pidgin), re.IGNORECASE)
            normalized = pattern.sub(english, normalized)
        
        return normalized
    
    @classmethod
    def extract_seller_cta(cls, text: str) -> List[str]:
        """Extract seller call-to-action phrases"""
        ctas = []
        
        cta_patterns = [
            r'dm\s*(?:to\s*)?(?:order|buy|cop)',
            r'(?:call|whatsapp|text)\s*(?:to\s*)?(?:order|buy)',
            r'link\s*in\s*bio',
            r'swipe\s*(?:up|left|right)',
            r'click\s*(?:link|button)',
            r'order\s*(?:now|today)',
            r'buy\s*(?:now|today)',
            r'grab\s*(?:yours|it|am)',
            r'cop\s*(?:yours|it|am)',
        ]
        
        text_lower = text.lower()
        
        for pattern in cta_patterns:
            matches = re.finditer(pattern, text_lower)
            for match in matches:
                ctas.append(match.group(0))
        
        return ctas


# =============================================================================
# Feedback Loop System
# =============================================================================

class FeedbackLoop:
    """
    Feedback collection and processing for model improvement
    
    Collects:
    - Extraction corrections from users
    - Confidence calibration data
    - New patterns and edge cases
    """
    
    def __init__(self):
        self.feedback_records: List[FeedbackRecord] = []
        self.training_examples: List[TrainingExample] = []
        self.pattern_frequency: Dict[str, int] = Counter()
        self.error_patterns: Dict[str, List[str]] = {}
    
    async def record_feedback(
        self,
        extraction_id: str,
        field: str,
        extracted_value: str,
        correct_value: Optional[str],
        is_correct: bool,
        user_id: Optional[str] = None
    ) -> FeedbackRecord:
        """Record user feedback on extraction"""
        
        record = FeedbackRecord(
            extraction_id=extraction_id,
            field=field,
            extracted_value=extracted_value,
            correct_value=correct_value,
            is_correct=is_correct,
            user_id=user_id
        )
        
        self.feedback_records.append(record)
        
        # Track error patterns
        if not is_correct and correct_value:
            error_key = f"{field}:{extracted_value}"
            if error_key not in self.error_patterns:
                self.error_patterns[error_key] = []
            self.error_patterns[error_key].append(correct_value)
        
        logger.info(f"Recorded feedback for {extraction_id}: {field} = {is_correct}")
        
        return record
    
    async def create_training_example(
        self,
        input_text: str,
        expected_output: Dict[str, Any],
        source: str = "user_feedback"
    ) -> TrainingExample:
        """Create training example from feedback"""
        
        example = TrainingExample(
            input_text=input_text,
            expected_output=expected_output,
            source=source,
            verified=False
        )
        
        self.training_examples.append(example)
        
        return example
    
    def get_accuracy_metrics(self) -> Dict[str, Any]:
        """Calculate accuracy metrics from feedback"""
        
        if not self.feedback_records:
            return {"total_feedback": 0, "accuracy": 0}
        
        total = len(self.feedback_records)
        correct = sum(1 for r in self.feedback_records if r.is_correct)
        
        # Per-field accuracy
        field_accuracy = {}
        for field in ["phone", "price", "location", "intent"]:
            field_records = [r for r in self.feedback_records if r.field == field]
            if field_records:
                field_correct = sum(1 for r in field_records if r.is_correct)
                field_accuracy[field] = field_correct / len(field_records)
        
        return {
            "total_feedback": total,
            "accuracy": correct / total,
            "field_accuracy": field_accuracy,
            "error_patterns_count": len(self.error_patterns),
            "training_examples_count": len(self.training_examples)
        }
    
    def get_common_errors(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most common extraction errors"""
        
        errors = []
        for error_key, corrections in self.error_patterns.items():
            field, extracted = error_key.split(":", 1)
            errors.append({
                "field": field,
                "extracted_value": extracted,
                "corrections": corrections,
                "frequency": len(corrections)
            })
        
        # Sort by frequency
        errors.sort(key=lambda x: x["frequency"], reverse=True)
        
        return errors[:limit]
    
    def should_trigger_retraining(self) -> bool:
        """Check if we have enough feedback to trigger retraining"""
        return len(self.training_examples) >= OCRConfig.MIN_FEEDBACK_FOR_TRAINING
    
    async def export_training_data(self) -> List[Dict[str, Any]]:
        """Export training data for fine-tuning"""
        
        return [
            {
                "input": example.input_text,
                "output": example.expected_output,
                "source": example.source,
                "verified": example.verified,
                "created_at": example.created_at.isoformat()
            }
            for example in self.training_examples
        ]


# =============================================================================
# Multi-Frame Video OCR Aggregator
# =============================================================================

class VideoOCRAggregator:
    """
    Aggregates OCR results from multiple video frames
    
    Strategies:
    - Majority voting for text
    - Confidence-weighted aggregation
    - Temporal consistency checking
    """
    
    @classmethod
    def aggregate_frame_results(
        cls,
        frame_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Aggregate OCR results from multiple frames"""
        
        if not frame_results:
            return {"text": "", "confidence": 0, "phones": [], "prices": []}
        
        # Collect all extracted text
        all_texts = []
        all_phones = []
        all_prices = []
        all_locations = []
        
        for result in frame_results:
            if result.get("text"):
                all_texts.append(result["text"])
            all_phones.extend(result.get("phones", []))
            all_prices.extend(result.get("prices", []))
            all_locations.extend(result.get("locations", []))
        
        # Aggregate text using majority voting
        aggregated_text = cls._aggregate_text(all_texts)
        
        # Aggregate phones by frequency
        aggregated_phones = cls._aggregate_by_frequency(
            all_phones,
            key_func=lambda p: p.get("normalized", p.get("raw", ""))
        )
        
        # Aggregate prices by frequency
        aggregated_prices = cls._aggregate_by_frequency(
            all_prices,
            key_func=lambda p: str(p.get("amount", 0))
        )
        
        # Aggregate locations by frequency
        aggregated_locations = cls._aggregate_by_frequency(
            all_locations,
            key_func=lambda l: f"{l.get('city', '')}-{l.get('state', '')}"
        )
        
        # Calculate overall confidence
        frame_confidences = [r.get("confidence", 0) for r in frame_results]
        overall_confidence = sum(frame_confidences) / len(frame_confidences) if frame_confidences else 0
        
        # Boost confidence if consistent across frames
        consistency_bonus = cls._calculate_consistency_bonus(frame_results)
        overall_confidence = min(1.0, overall_confidence + consistency_bonus)
        
        return {
            "text": aggregated_text,
            "confidence": overall_confidence,
            "phones": aggregated_phones,
            "prices": aggregated_prices,
            "locations": aggregated_locations,
            "frame_count": len(frame_results),
            "consistency_score": consistency_bonus
        }
    
    @classmethod
    def _aggregate_text(cls, texts: List[str]) -> str:
        """Aggregate text using longest common subsequence approach"""
        if not texts:
            return ""
        
        if len(texts) == 1:
            return texts[0]
        
        # Simple approach: return the longest text that appears most frequently
        text_counter = Counter(texts)
        most_common = text_counter.most_common(1)
        
        if most_common:
            return most_common[0][0]
        
        # Fallback: return longest text
        return max(texts, key=len)
    
    @classmethod
    def _aggregate_by_frequency(
        cls,
        items: List[Dict[str, Any]],
        key_func: callable
    ) -> List[Dict[str, Any]]:
        """Aggregate items by frequency"""
        
        if not items:
            return []
        
        # Group by key
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for item in items:
            key = key_func(item)
            if key not in groups:
                groups[key] = []
            groups[key].append(item)
        
        # Return items that appear in multiple frames, sorted by frequency
        aggregated = []
        for key, group in groups.items():
            if len(group) >= 1:  # At least 1 occurrence
                # Use the item with highest confidence
                best_item = max(group, key=lambda x: x.get("confidence", 0))
                best_item["frame_count"] = len(group)
                aggregated.append(best_item)
        
        # Sort by frame count (frequency)
        aggregated.sort(key=lambda x: x.get("frame_count", 0), reverse=True)
        
        return aggregated
    
    @classmethod
    def _calculate_consistency_bonus(cls, frame_results: List[Dict[str, Any]]) -> float:
        """Calculate consistency bonus based on agreement across frames"""
        
        if len(frame_results) < 2:
            return 0
        
        # Check phone consistency
        phone_sets = [
            set(p.get("normalized", "") for p in r.get("phones", []))
            for r in frame_results
        ]
        
        # Check price consistency
        price_sets = [
            set(str(p.get("amount", 0)) for p in r.get("prices", []))
            for r in frame_results
        ]
        
        # Calculate intersection ratio
        phone_intersection = set.intersection(*phone_sets) if phone_sets and all(phone_sets) else set()
        price_intersection = set.intersection(*price_sets) if price_sets and all(price_sets) else set()
        
        phone_bonus = 0.05 if phone_intersection else 0
        price_bonus = 0.05 if price_intersection else 0
        
        return phone_bonus + price_bonus


# =============================================================================
# Main Extraction Service
# =============================================================================

class ExtractionService:
    """
    Main extraction service for Nigerian social commerce content
    
    Combines:
    - Phone extraction and validation
    - Price extraction and validation
    - Location extraction and validation
    - Commerce intent detection
    - Pidgin/code-mixed language processing
    - Multi-frame video aggregation
    - Feedback loop for improvement
    """
    
    def __init__(self):
        self.phone_validator = NigerianPhoneValidator()
        self.price_validator = NigerianPriceValidator()
        self.location_validator = NigerianLocationValidator()
        self.pidgin_processor = PidginProcessor()
        self.video_aggregator = VideoOCRAggregator()
        self.feedback_loop = FeedbackLoop()
        
        # Extraction cache
        self._extraction_cache: Dict[str, ExtractionResult] = {}
    
    async def extract_from_text(
        self,
        text: str,
        platform: str = "instagram",
        content_id: Optional[str] = None
    ) -> ExtractionResult:
        """Extract commerce data from text"""
        
        start_time = datetime.utcnow()
        content_id = content_id or f"txt_{uuid.uuid4().hex[:12]}"
        
        # Extract entities
        phones = self.phone_validator.extract_phones(text)
        prices = self.price_validator.extract_prices(text)
        locations = self.location_validator.extract_locations(text)
        
        # Detect commerce intent
        intent, intent_confidence = self.pidgin_processor.detect_commerce_intent(text)
        
        # Extract seller CTAs
        ctas = self.pidgin_processor.extract_seller_cta(text)
        
        # Build commerce signals
        signals = []
        
        for phone in phones:
            signals.append(CommerceSignal(
                signal_type="phone",
                value=phone.normalized,
                confidence=phone.confidence,
                source="text"
            ))
        
        for price in prices:
            signals.append(CommerceSignal(
                signal_type="price",
                value=f"{price.amount} {price.currency}",
                confidence=price.confidence,
                source="text"
            ))
        
        for location in locations:
            signals.append(CommerceSignal(
                signal_type="location",
                value=f"{location.city}, {location.state}",
                confidence=location.confidence,
                source="text"
            ))
        
        for cta in ctas:
            signals.append(CommerceSignal(
                signal_type="cta",
                value=cta,
                confidence=0.9,
                source="text"
            ))
        
        # Calculate overall confidence
        confidences = [s.confidence for s in signals]
        overall_confidence = sum(confidences) / len(confidences) if confidences else 0.5
        
        # Determine confidence level
        if overall_confidence >= OCRConfig.HIGH_CONFIDENCE_THRESHOLD:
            confidence_level = ExtractionConfidence.HIGH
        elif overall_confidence >= OCRConfig.MEDIUM_CONFIDENCE_THRESHOLD:
            confidence_level = ExtractionConfidence.MEDIUM
        elif overall_confidence >= OCRConfig.LOW_CONFIDENCE_THRESHOLD:
            confidence_level = ExtractionConfidence.LOW
        else:
            confidence_level = ExtractionConfidence.VERY_LOW
        
        # Calculate extraction time
        extraction_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        result = ExtractionResult(
            content_id=content_id,
            content_type=ContentType.TEXT,
            platform=platform,
            phones=phones,
            prices=prices,
            locations=locations,
            signals=signals,
            commerce_intent=intent,
            overall_confidence=overall_confidence,
            confidence_level=confidence_level,
            raw_text=text,
            extraction_time_ms=extraction_time_ms
        )
        
        # Cache result
        self._extraction_cache[content_id] = result
        
        return result
    
    async def extract_from_video_frames(
        self,
        frame_results: List[Dict[str, Any]],
        caption: str = "",
        platform: str = "instagram",
        content_id: Optional[str] = None
    ) -> ExtractionResult:
        """Extract commerce data from video frames + caption"""
        
        start_time = datetime.utcnow()
        content_id = content_id or f"vid_{uuid.uuid4().hex[:12]}"
        
        # Aggregate frame results
        aggregated = self.video_aggregator.aggregate_frame_results(frame_results)
        
        # Combine with caption
        combined_text = f"{caption}\n{aggregated.get('text', '')}"
        
        # Extract from combined text
        text_result = await self.extract_from_text(
            text=combined_text,
            platform=platform,
            content_id=f"{content_id}_text"
        )
        
        # Merge with frame-extracted data
        all_phones = text_result.phones + [
            PhoneNumber(**p) if isinstance(p, dict) else p
            for p in aggregated.get("phones", [])
        ]
        
        all_prices = text_result.prices + [
            Price(**p) if isinstance(p, dict) else p
            for p in aggregated.get("prices", [])
        ]
        
        all_locations = text_result.locations + [
            Location(**l) if isinstance(l, dict) else l
            for l in aggregated.get("locations", [])
        ]
        
        # Deduplicate
        seen_phones = set()
        unique_phones = []
        for phone in all_phones:
            if phone.normalized not in seen_phones:
                seen_phones.add(phone.normalized)
                unique_phones.append(phone)
        
        seen_prices = set()
        unique_prices = []
        for price in all_prices:
            if price.amount not in seen_prices:
                seen_prices.add(price.amount)
                unique_prices.append(price)
        
        # Calculate extraction time
        extraction_time_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Boost confidence based on frame consistency
        overall_confidence = min(1.0, text_result.overall_confidence + aggregated.get("consistency_score", 0))
        
        result = ExtractionResult(
            content_id=content_id,
            content_type=ContentType.VIDEO,
            platform=platform,
            phones=unique_phones,
            prices=unique_prices,
            locations=all_locations,
            signals=text_result.signals,
            commerce_intent=text_result.commerce_intent,
            overall_confidence=overall_confidence,
            confidence_level=text_result.confidence_level,
            raw_text=caption,
            ocr_text=aggregated.get("text", ""),
            extraction_time_ms=extraction_time_ms
        )
        
        # Cache result
        self._extraction_cache[content_id] = result
        
        return result
    
    async def submit_feedback(
        self,
        content_id: str,
        field: str,
        extracted_value: str,
        correct_value: Optional[str],
        is_correct: bool,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Submit feedback on extraction"""
        
        record = await self.feedback_loop.record_feedback(
            extraction_id=content_id,
            field=field,
            extracted_value=extracted_value,
            correct_value=correct_value,
            is_correct=is_correct,
            user_id=user_id
        )
        
        # If correction provided, create training example
        if not is_correct and correct_value and content_id in self._extraction_cache:
            original = self._extraction_cache[content_id]
            
            # Create training example
            expected_output = {field: correct_value}
            await self.feedback_loop.create_training_example(
                input_text=original.raw_text,
                expected_output=expected_output,
                source="user_correction"
            )
        
        return {
            "feedback_id": f"fb_{uuid.uuid4().hex[:12]}",
            "recorded": True,
            "should_retrain": self.feedback_loop.should_trigger_retraining()
        }
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get extraction metrics"""
        return {
            "accuracy": self.feedback_loop.get_accuracy_metrics(),
            "common_errors": self.feedback_loop.get_common_errors(5),
            "cache_size": len(self._extraction_cache),
            "training_examples": len(self.feedback_loop.training_examples)
        }


# =============================================================================
# Singleton Instance
# =============================================================================

extraction_service = ExtractionService()


# =============================================================================
# FastAPI Router
# =============================================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/ocr", tags=["OCR Domain Adaptation"])


class ExtractTextRequest(BaseModel):
    text: str
    platform: str = "instagram"
    content_id: Optional[str] = None


class ExtractVideoRequest(BaseModel):
    frame_results: List[Dict[str, Any]]
    caption: str = ""
    platform: str = "instagram"
    content_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    content_id: str
    field: str
    extracted_value: str
    correct_value: Optional[str] = None
    is_correct: bool
    user_id: Optional[str] = None


@router.post("/extract/text")
async def extract_from_text(request: ExtractTextRequest):
    """Extract commerce data from text"""
    
    result = await extraction_service.extract_from_text(
        text=request.text,
        platform=request.platform,
        content_id=request.content_id
    )
    
    return {
        "content_id": result.content_id,
        "content_type": result.content_type.value,
        "platform": result.platform,
        "phones": [
            {
                "raw": p.raw,
                "normalized": p.normalized,
                "is_valid": p.is_valid,
                "is_whatsapp": p.is_whatsapp,
                "confidence": p.confidence
            }
            for p in result.phones
        ],
        "prices": [
            {
                "raw": p.raw,
                "amount": p.amount,
                "currency": p.currency,
                "is_negotiable": p.is_negotiable,
                "confidence": p.confidence
            }
            for p in result.prices
        ],
        "locations": [
            {
                "raw": l.raw,
                "city": l.city,
                "state": l.state,
                "is_delivery_location": l.is_delivery_location,
                "confidence": l.confidence
            }
            for l in result.locations
        ],
        "commerce_intent": result.commerce_intent.value,
        "overall_confidence": result.overall_confidence,
        "confidence_level": result.confidence_level.value,
        "extraction_time_ms": result.extraction_time_ms
    }


@router.post("/extract/video")
async def extract_from_video(request: ExtractVideoRequest):
    """Extract commerce data from video frames"""
    
    result = await extraction_service.extract_from_video_frames(
        frame_results=request.frame_results,
        caption=request.caption,
        platform=request.platform,
        content_id=request.content_id
    )
    
    return {
        "content_id": result.content_id,
        "content_type": result.content_type.value,
        "platform": result.platform,
        "phones": [
            {
                "raw": p.raw,
                "normalized": p.normalized,
                "is_valid": p.is_valid,
                "is_whatsapp": p.is_whatsapp,
                "confidence": p.confidence
            }
            for p in result.phones
        ],
        "prices": [
            {
                "raw": p.raw,
                "amount": p.amount,
                "currency": p.currency,
                "is_negotiable": p.is_negotiable,
                "confidence": p.confidence
            }
            for p in result.prices
        ],
        "locations": [
            {
                "raw": l.raw,
                "city": l.city,
                "state": l.state,
                "is_delivery_location": l.is_delivery_location,
                "confidence": l.confidence
            }
            for l in result.locations
        ],
        "commerce_intent": result.commerce_intent.value,
        "overall_confidence": result.overall_confidence,
        "confidence_level": result.confidence_level.value,
        "ocr_text": result.ocr_text,
        "extraction_time_ms": result.extraction_time_ms
    }


@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """Submit feedback on extraction"""
    
    return await extraction_service.submit_feedback(
        content_id=request.content_id,
        field=request.field,
        extracted_value=request.extracted_value,
        correct_value=request.correct_value,
        is_correct=request.is_correct,
        user_id=request.user_id
    )


@router.get("/metrics")
async def get_metrics():
    """Get extraction metrics"""
    return extraction_service.get_metrics()


@router.get("/training-data")
async def get_training_data():
    """Export training data for fine-tuning"""
    return {
        "training_examples": await extraction_service.feedback_loop.export_training_data(),
        "should_retrain": extraction_service.feedback_loop.should_trigger_retraining()
    }


@router.post("/validate/phone")
async def validate_phone(phone: str):
    """Validate a Nigerian phone number"""
    phones = NigerianPhoneValidator.extract_phones(phone)
    
    if phones:
        p = phones[0]
        return {
            "valid": p.is_valid,
            "normalized": p.normalized,
            "is_whatsapp": p.is_whatsapp,
            "confidence": p.confidence
        }
    
    return {"valid": False, "message": "No valid phone number found"}


@router.post("/validate/price")
async def validate_price(text: str):
    """Extract and validate prices from text"""
    prices = NigerianPriceValidator.extract_prices(text)
    
    return {
        "prices": [
            {
                "raw": p.raw,
                "amount": p.amount,
                "currency": p.currency,
                "is_negotiable": p.is_negotiable,
                "confidence": p.confidence
            }
            for p in prices
        ]
    }


@router.post("/detect-intent")
async def detect_intent(text: str):
    """Detect commerce intent from text"""
    intent, confidence = PidginProcessor.detect_commerce_intent(text)
    
    return {
        "intent": intent.value,
        "confidence": confidence
    }
