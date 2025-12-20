"""
Pidgin English and Nigerian WhatsApp NLP Normalization

Provides text normalization for Nigerian social commerce:
- Pidgin English expressions
- WhatsApp/Instagram abbreviations
- Nigerian slang and colloquialisms
- Price negotiation patterns
- Intent detection for commerce

Improves commerce detection accuracy for Nigerian market.
"""

import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class IntentType(str, Enum):
    """Types of commerce intent"""
    BUY = "buy"
    SELL = "sell"
    INQUIRE = "inquire"
    NEGOTIATE = "negotiate"
    CONFIRM = "confirm"
    DECLINE = "decline"
    DELIVERY = "delivery"
    PAYMENT = "payment"
    COMPLAINT = "complaint"
    GREETING = "greeting"
    UNKNOWN = "unknown"


@dataclass
class NormalizedText:
    """Result of text normalization"""
    original: str
    normalized: str
    detected_intents: List[IntentType]
    confidence: float
    extracted_entities: Dict[str, Any] = field(default_factory=dict)
    pidgin_detected: bool = False
    slang_count: int = 0


# Pidgin English to Standard English mappings
PIDGIN_MAPPINGS = {
    # Common expressions
    "abeg": "please",
    "wetin": "what",
    "dey": "is/are",
    "na": "is/it's",
    "oya": "okay/let's go",
    "sha": "anyway",
    "shey": "is it/right",
    "abi": "or/right",
    "wahala": "problem",
    "no wahala": "no problem",
    "e go be": "it will be fine",
    "how far": "hello/how are you",
    "i dey": "i am fine",
    "wetin dey": "what's happening",
    "make i": "let me",
    "no vex": "don't be angry",
    "e don do": "it's done",
    "e never do": "it's not done",
    "e sweet": "it's good",
    "e no sweet": "it's not good",
    "chop": "eat/spend",
    "gist": "story/gossip",
    "jara": "bonus/extra",
    "kpakpa": "exactly/correct",
    "ehen": "yes/okay",
    "ehn ehn": "really/is that so",
    "walahi": "i swear",
    "shebi": "isn't it",
    "comot": "leave/remove",
    "enter": "go in/start",
    "waka": "walk/go",
    "yarn": "talk/speak",
    "sabi": "know/understand",
    "no sabi": "don't know",
    "belle": "stomach/pregnant",
    "bodi": "body",
    "pikin": "child",
    "oga": "boss/sir",
    "madam": "ma'am",
    "bros": "brother",
    "sista": "sister",
    "guy": "man/friend",
    "babe": "woman/girlfriend",
    "maga": "victim/fool",
    "runs": "hustle/scheme",
    "levels": "situation/status",
    "package": "deal/arrangement",
    "ginger": "motivate/excite",
    "pepper": "trouble/hot",
    "cruise": "fun/joke",
    "vibes": "mood/energy",
    "flex": "show off/enjoy",
    "sapa": "broke/poverty",
    "soft life": "easy life",
    "hard guy": "tough person",
    
    # Commerce specific
    "last price": "final price",
    "last last": "final/eventually",
    "manage am": "accept it",
    "sharp sharp": "quickly",
    "one time": "immediately",
    "for real": "seriously",
    "legit": "legitimate",
    "original": "authentic",
    "tokunbo": "used/imported",
    "brand new": "new",
    "fairly used": "second hand",
    "london used": "imported used",
    "belgium": "high quality used",
    "cotonou": "smuggled goods",
    "correct": "good quality",
    "rubbish": "bad quality",
    "die": "very/extremely",
    "mad": "very/crazy",
    "scatter": "amazing/destroy",
    "burst": "amazing/explode",
    "tear": "amazing",
    
    # Negotiation
    "abeg reduce": "please reduce price",
    "too much": "too expensive",
    "e cost": "it's expensive",
    "e cheap": "it's cheap",
    "add small": "add a little more",
    "minus small": "reduce a little",
    "final": "last offer",
    "no go": "won't work",
    "e go work": "it will work",
    "we go see": "we'll see",
    "make we talk": "let's negotiate",
    "come down": "reduce price",
    "jack up": "increase price",
    
    # Delivery
    "send am": "send it",
    "bring am": "bring it",
    "carry am": "take it",
    "drop am": "deliver it",
    "pick am": "pick it up",
    "reach": "arrive",
    "land": "arrive",
    
    # Payment
    "pay am": "pay for it",
    "send money": "transfer money",
    "cash out": "withdraw",
    "top up": "add money",
    "balance": "remaining amount",
    "complete": "full payment",
    "part payment": "partial payment",
    "deposit": "initial payment",
}

# WhatsApp/Instagram abbreviations
ABBREVIATIONS = {
    "dm": "direct message",
    "pm": "private message",
    "pls": "please",
    "plz": "please",
    "thx": "thanks",
    "tnx": "thanks",
    "ty": "thank you",
    "np": "no problem",
    "nw": "no worries",
    "ok": "okay",
    "k": "okay",
    "kk": "okay",
    "lol": "laughing",
    "lmao": "laughing",
    "brb": "be right back",
    "ttyl": "talk to you later",
    "asap": "as soon as possible",
    "rn": "right now",
    "atm": "at the moment",
    "tbh": "to be honest",
    "imo": "in my opinion",
    "idk": "i don't know",
    "idc": "i don't care",
    "ngl": "not gonna lie",
    "fr": "for real",
    "ong": "on god",
    "omg": "oh my god",
    "smh": "shaking my head",
    "fyi": "for your information",
    "btw": "by the way",
    "wbu": "what about you",
    "hbu": "how about you",
    "hmu": "hit me up",
    "lmk": "let me know",
    "wyd": "what you doing",
    "wya": "where you at",
    "otw": "on the way",
    "eta": "estimated time of arrival",
    "pic": "picture",
    "pics": "pictures",
    "vid": "video",
    "vids": "videos",
    "info": "information",
    "deets": "details",
    "specs": "specifications",
    "qty": "quantity",
    "avail": "available",
    "unavail": "unavailable",
    "oos": "out of stock",
    "cod": "cash on delivery",
    "pod": "pay on delivery",
    "bnew": "brand new",
    "fu": "fairly used",
    "nego": "negotiable",
    "fixed": "fixed price",
    "swipe": "swipe up",
    "link": "link in bio",
    "bio": "biography/profile",
}

# Intent patterns
INTENT_PATTERNS = {
    IntentType.BUY: [
        r"(?i)i\s*want\s*(to\s*)?(buy|get|order|cop)",
        r"(?i)can\s*i\s*(buy|get|order|cop)",
        r"(?i)how\s*(do\s*i|can\s*i)\s*(buy|get|order)",
        r"(?i)interested\s*(in\s*buying)?",
        r"(?i)i('ll|'m\s*going\s*to)\s*(buy|get|take)",
        r"(?i)send\s*(me|it)",
        r"(?i)i\s*go\s*(buy|take|cop)",
        r"(?i)make\s*i\s*(buy|get|order)",
        r"(?i)abeg\s*(send|give)\s*me",
    ],
    IntentType.INQUIRE: [
        r"(?i)how\s*much",
        r"(?i)what('s|\s*is)\s*(the\s*)?price",
        r"(?i)price\s*\??",
        r"(?i)cost\s*\??",
        r"(?i)still\s*available",
        r"(?i)do\s*you\s*(have|sell)",
        r"(?i)is\s*(this|it)\s*available",
        r"(?i)e\s*cost\s*how\s*much",
        r"(?i)wetin\s*be\s*(the\s*)?price",
        r"(?i)last\s*price",
    ],
    IntentType.NEGOTIATE: [
        r"(?i)(can\s*you|pls|please)\s*reduce",
        r"(?i)too\s*(much|expensive|costly)",
        r"(?i)come\s*down\s*(small)?",
        r"(?i)abeg\s*reduce",
        r"(?i)last\s*(price|last)",
        r"(?i)final\s*(price|offer)?",
        r"(?i)i('ll|'m)\s*(pay|give)\s*\d+",
        r"(?i)what\s*of\s*\d+",
        r"(?i)make\s*am\s*\d+",
        r"(?i)e\s*too\s*cost",
    ],
    IntentType.CONFIRM: [
        r"(?i)okay|ok|k+",
        r"(?i)deal|done|agreed",
        r"(?i)i('ll|'m)\s*(take|buy)\s*it",
        r"(?i)send\s*(your\s*)?(account|details)",
        r"(?i)let('s)?\s*do\s*(it|this)",
        r"(?i)e\s*don\s*do",
        r"(?i)oya\s*(send|let)",
        r"(?i)no\s*wahala",
        r"(?i)we\s*don\s*agree",
    ],
    IntentType.DECLINE: [
        r"(?i)no\s*(thanks?|thank\s*you)",
        r"(?i)not\s*interested",
        r"(?i)too\s*(expensive|much)",
        r"(?i)i('ll)?\s*pass",
        r"(?i)maybe\s*later",
        r"(?i)e\s*no\s*go\s*work",
        r"(?i)forget\s*(it|am)",
        r"(?i)leave\s*am",
    ],
    IntentType.DELIVERY: [
        r"(?i)do\s*you\s*deliver",
        r"(?i)delivery\s*(to|in|available)",
        r"(?i)can\s*you\s*(send|deliver|ship)",
        r"(?i)how\s*(long|soon)",
        r"(?i)when\s*(will|can)\s*(it|you)",
        r"(?i)where\s*(are\s*you|is\s*your)",
        r"(?i)location\s*\??",
        r"(?i)you\s*dey\s*deliver",
        r"(?i)e\s*go\s*reach\s*when",
    ],
    IntentType.PAYMENT: [
        r"(?i)how\s*(do\s*i|can\s*i)\s*pay",
        r"(?i)payment\s*(method|option)",
        r"(?i)bank\s*(transfer|details|account)",
        r"(?i)send\s*(your\s*)?(account|details)",
        r"(?i)(opay|palmpay|kuda|gtb|access|zenith)",
        r"(?i)pay\s*on\s*delivery",
        r"(?i)cod|pod",
        r"(?i)transfer\s*(to|the)",
        r"(?i)i\s*don\s*pay",
        r"(?i)money\s*don\s*enter",
    ],
    IntentType.GREETING: [
        r"(?i)^(hi|hello|hey|good\s*(morning|afternoon|evening))$",
        r"(?i)^how\s*(far|you\s*dey)$",
        r"(?i)^(oga|madam|bros|sista)$",
        r"(?i)^e\s*kaaro$",
        r"(?i)^bawo\s*ni$",
    ],
    IntentType.COMPLAINT: [
        r"(?i)(bad|poor|terrible)\s*(quality|product|service)",
        r"(?i)not\s*(what|as)\s*(i\s*)?(ordered|expected)",
        r"(?i)refund|return|exchange",
        r"(?i)scam|fake|fraud",
        r"(?i)e\s*no\s*good",
        r"(?i)rubbish|nonsense",
        r"(?i)wahala\s*(dey|too\s*much)",
    ],
}

# Nigerian location aliases
LOCATION_ALIASES = {
    "vi": "victoria island",
    "v.i": "victoria island",
    "v.i.": "victoria island",
    "ph": "port harcourt",
    "p.h": "port harcourt",
    "p.h.": "port harcourt",
    "fct": "abuja",
    "lag": "lagos",
    "ib": "ibadan",
    "eko": "lagos",
    "gidi": "lagos",
    "9ja": "nigeria",
    "naija": "nigeria",
}


class PidginNormalizer:
    """
    Normalizes Nigerian Pidgin English and social media text
    for improved commerce detection.
    """
    
    def __init__(self):
        self.pidgin_pattern = self._compile_patterns(PIDGIN_MAPPINGS)
        self.abbrev_pattern = self._compile_patterns(ABBREVIATIONS)
        self.location_pattern = self._compile_patterns(LOCATION_ALIASES)
    
    def _compile_patterns(self, mappings: Dict[str, str]) -> re.Pattern:
        """Compile regex pattern for word boundary matching"""
        escaped = [re.escape(k) for k in sorted(mappings.keys(), key=len, reverse=True)]
        pattern = r'\b(' + '|'.join(escaped) + r')\b'
        return re.compile(pattern, re.IGNORECASE)
    
    def normalize(self, text: str) -> NormalizedText:
        """
        Normalize text by expanding Pidgin and abbreviations.
        Detect intents and extract entities.
        """
        original = text
        normalized = text
        slang_count = 0
        pidgin_detected = False
        
        # Expand Pidgin expressions
        def replace_pidgin(match):
            nonlocal slang_count, pidgin_detected
            word = match.group(0).lower()
            if word in PIDGIN_MAPPINGS:
                slang_count += 1
                pidgin_detected = True
                return PIDGIN_MAPPINGS[word]
            return match.group(0)
        
        normalized = self.pidgin_pattern.sub(replace_pidgin, normalized)
        
        # Expand abbreviations
        def replace_abbrev(match):
            nonlocal slang_count
            word = match.group(0).lower()
            if word in ABBREVIATIONS:
                slang_count += 1
                return ABBREVIATIONS[word]
            return match.group(0)
        
        normalized = self.abbrev_pattern.sub(replace_abbrev, normalized)
        
        # Expand location aliases
        def replace_location(match):
            word = match.group(0).lower()
            if word in LOCATION_ALIASES:
                return LOCATION_ALIASES[word]
            return match.group(0)
        
        normalized = self.location_pattern.sub(replace_location, normalized)
        
        # Detect intents
        intents = self._detect_intents(text)
        
        # Extract entities
        entities = self._extract_entities(text)
        
        # Calculate confidence
        confidence = self._calculate_confidence(intents, entities, slang_count)
        
        return NormalizedText(
            original=original,
            normalized=normalized,
            detected_intents=intents,
            confidence=confidence,
            extracted_entities=entities,
            pidgin_detected=pidgin_detected,
            slang_count=slang_count,
        )
    
    def _detect_intents(self, text: str) -> List[IntentType]:
        """Detect commerce intents in text"""
        intents = []
        
        for intent_type, patterns in INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text):
                    if intent_type not in intents:
                        intents.append(intent_type)
                    break
        
        if not intents:
            intents.append(IntentType.UNKNOWN)
        
        return intents
    
    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        entities = {}
        
        # Extract prices (Nigerian patterns)
        price_patterns = [
            r'₦\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(\d+(?:\.\d+)?)\s*k\b',
            r'(\d+(?:\.\d+)?)\s*m\b',
            r'NGN\s*(\d{1,3}(?:,\d{3})*)',
        ]
        
        prices = []
        for pattern in price_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    value = float(match.replace(',', ''))
                    if 'k' in pattern.lower():
                        value *= 1000
                    elif 'm' in pattern.lower():
                        value *= 1000000
                    prices.append(value)
                except ValueError:
                    pass
        
        if prices:
            entities['prices'] = prices
        
        # Extract phone numbers
        phone_pattern = r'(?:\+?234|0)[789]\d{9}'
        phones = re.findall(phone_pattern, text)
        if phones:
            entities['phone_numbers'] = phones
        
        # Extract quantities
        qty_pattern = r'(\d+)\s*(pieces?|pcs?|units?|cartons?|bags?|packs?|dozen)'
        qty_matches = re.findall(qty_pattern, text, re.IGNORECASE)
        if qty_matches:
            entities['quantities'] = [{'amount': int(m[0]), 'unit': m[1]} for m in qty_matches]
        
        # Extract locations
        locations = []
        for alias, full_name in LOCATION_ALIASES.items():
            if re.search(r'\b' + re.escape(alias) + r'\b', text, re.IGNORECASE):
                if full_name not in locations:
                    locations.append(full_name)
        
        # Check for common Nigerian locations
        nigerian_locations = [
            'lagos', 'abuja', 'port harcourt', 'ibadan', 'kano', 'kaduna',
            'benin', 'enugu', 'warri', 'calabar', 'owerri', 'uyo',
            'lekki', 'ikeja', 'victoria island', 'yaba', 'surulere',
            'ajah', 'ikorodu', 'festac', 'oshodi', 'apapa',
        ]
        for loc in nigerian_locations:
            if re.search(r'\b' + re.escape(loc) + r'\b', text, re.IGNORECASE):
                if loc not in locations:
                    locations.append(loc)
        
        if locations:
            entities['locations'] = locations
        
        # Extract payment methods
        payment_methods = []
        payment_keywords = {
            'opay': 'OPay',
            'palmpay': 'PalmPay',
            'kuda': 'Kuda',
            'gtb': 'GTBank',
            'gtbank': 'GTBank',
            'access': 'Access Bank',
            'zenith': 'Zenith Bank',
            'uba': 'UBA',
            'first bank': 'First Bank',
            'fcmb': 'FCMB',
            'fidelity': 'Fidelity Bank',
            'bank transfer': 'Bank Transfer',
            'pay on delivery': 'Pay on Delivery',
            'cod': 'Cash on Delivery',
            'pod': 'Pay on Delivery',
        }
        
        for keyword, method in payment_keywords.items():
            if re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE):
                if method not in payment_methods:
                    payment_methods.append(method)
        
        if payment_methods:
            entities['payment_methods'] = payment_methods
        
        return entities
    
    def _calculate_confidence(
        self, 
        intents: List[IntentType], 
        entities: Dict[str, Any],
        slang_count: int
    ) -> float:
        """Calculate confidence score for commerce detection"""
        confidence = 0.0
        
        # Intent-based confidence
        commerce_intents = {
            IntentType.BUY, IntentType.SELL, IntentType.INQUIRE,
            IntentType.NEGOTIATE, IntentType.CONFIRM, IntentType.PAYMENT,
            IntentType.DELIVERY
        }
        
        for intent in intents:
            if intent in commerce_intents:
                confidence += 0.2
        
        # Entity-based confidence
        if 'prices' in entities:
            confidence += 0.3
        if 'phone_numbers' in entities:
            confidence += 0.1
        if 'locations' in entities:
            confidence += 0.1
        if 'payment_methods' in entities:
            confidence += 0.15
        if 'quantities' in entities:
            confidence += 0.1
        
        # Slang indicates authentic Nigerian commerce
        if slang_count > 0:
            confidence += min(slang_count * 0.05, 0.15)
        
        return min(confidence, 1.0)
    
    def is_commerce_intent(self, text: str) -> Tuple[bool, float]:
        """
        Quick check if text has commerce intent.
        Returns (is_commerce, confidence)
        """
        result = self.normalize(text)
        
        commerce_intents = {
            IntentType.BUY, IntentType.SELL, IntentType.INQUIRE,
            IntentType.NEGOTIATE, IntentType.CONFIRM, IntentType.PAYMENT,
            IntentType.DELIVERY
        }
        
        has_commerce_intent = any(i in commerce_intents for i in result.detected_intents)
        
        return has_commerce_intent, result.confidence
    
    def extract_negotiation_price(self, text: str) -> Optional[float]:
        """Extract price from negotiation message"""
        # Patterns for price offers
        patterns = [
            r'(?:i\'?ll?\s*(?:pay|give|offer))\s*₦?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:what\s*(?:of|about))\s*₦?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',
            r'(?:make\s*(?:it|am))\s*₦?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',
            r'₦?\s*(\d+(?:,\d{3})*)\s*(?:last|final)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1).replace(',', ''))
                except ValueError:
                    pass
        
        return None


# Global instance
pidgin_normalizer = PidginNormalizer()


# Convenience functions
def normalize_text(text: str) -> NormalizedText:
    """Normalize Nigerian Pidgin/slang text"""
    return pidgin_normalizer.normalize(text)


def detect_commerce_intent(text: str) -> Tuple[bool, float]:
    """Check if text has commerce intent"""
    return pidgin_normalizer.is_commerce_intent(text)


def extract_price_offer(text: str) -> Optional[float]:
    """Extract price from negotiation message"""
    return pidgin_normalizer.extract_negotiation_price(text)
