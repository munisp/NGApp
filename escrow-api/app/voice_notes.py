"""
Voice Note Support for SocialEscrow
TIER 4: Voice Note Support in WhatsApp

Provides:
- Speech-to-text transcription for voice notes
- Commerce intent detection from voice
- Voice command processing
- Multi-language support (English, Pidgin, Yoruba, Igbo, Hausa)
"""

import uuid
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class Language(str, Enum):
    ENGLISH = "en"
    PIDGIN = "pcm"  # Nigerian Pidgin
    YORUBA = "yo"
    IGBO = "ig"
    HAUSA = "ha"

class VoiceCommandType(str, Enum):
    CREATE_ESCROW = "create_escrow"
    CHECK_STATUS = "check_status"
    CONFIRM_DELIVERY = "confirm_delivery"
    CANCEL_ESCROW = "cancel_escrow"
    HELP = "help"
    UNKNOWN = "unknown"

@dataclass
class TranscriptionResult:
    """Result of voice-to-text transcription"""
    id: str
    audio_url: str
    text: str
    language: Language
    confidence: float
    duration_seconds: float
    word_timestamps: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

@dataclass
class VoiceCommand:
    """Parsed voice command"""
    type: VoiceCommandType
    confidence: float
    parameters: Dict[str, Any] = field(default_factory=dict)
    original_text: str = ""
    language: Language = Language.ENGLISH

# Nigerian Pidgin commerce phrases
PIDGIN_COMMERCE_PHRASES = {
    # Buying intent
    "i wan buy": "I want to buy",
    "how much": "how much",
    "wetin be price": "what is the price",
    "e dey available": "is it available",
    "i go pay": "I will pay",
    "make i pay": "let me pay",
    "i don pay": "I have paid",
    "send am come": "send it to me",
    "deliver am": "deliver it",
    
    # Selling intent
    "i dey sell": "I am selling",
    "e dey for sale": "it is for sale",
    "na original": "it is original",
    "no be fake": "it is not fake",
    
    # Escrow specific
    "protect my money": "protect my money",
    "hold the money": "hold the money",
    "release the money": "release the money",
    "i don receive am": "I have received it",
    "e no reach": "it has not arrived",
    "e spoil": "it is damaged",
    
    # Numbers
    "one fifty k": "150000",
    "two hundred k": "200000",
    "fifty k": "50000",
    "twenty k": "20000",
}

# Yoruba commerce phrases
YORUBA_COMMERCE_PHRASES = {
    "mo fe ra": "I want to buy",
    "elo ni": "how much",
    "se o wa": "is it available",
    "mo ti san": "I have paid",
    "fi ran mi": "send to me",
}

# Igbo commerce phrases
IGBO_COMMERCE_PHRASES = {
    "achọrọ m ịzụ": "I want to buy",
    "ego ole": "how much",
    "ọ dị": "is it available",
    "akwụọla m ụgwọ": "I have paid",
}

# Hausa commerce phrases
HAUSA_COMMERCE_PHRASES = {
    "ina son saya": "I want to buy",
    "nawa ne": "how much",
    "akwai": "is it available",
    "na biya": "I have paid",
}

class VoiceNoteService:
    """
    Voice note processing service for WhatsApp integration.
    
    Features:
    1. Speech-to-text transcription (using Whisper API in production)
    2. Multi-language support with Nigerian languages
    3. Commerce intent detection from voice
    4. Voice command parsing
    """
    
    def __init__(self):
        self.transcriptions: Dict[str, TranscriptionResult] = {}
        self.commands: Dict[str, VoiceCommand] = {}
    
    async def transcribe_audio(
        self,
        audio_url: str,
        language_hint: Language = None
    ) -> TranscriptionResult:
        """
        Transcribe voice note to text.
        
        In production, this would call:
        - OpenAI Whisper API
        - Google Speech-to-Text
        - Azure Speech Services
        
        For POC, simulates transcription.
        """
        transcription_id = str(uuid.uuid4())
        
        # In production, download audio and send to Whisper API
        # For POC, simulate transcription
        
        # Simulated transcription result
        result = TranscriptionResult(
            id=transcription_id,
            audio_url=audio_url,
            text="",  # Would be filled by actual transcription
            language=language_hint or Language.ENGLISH,
            confidence=0.0,
            duration_seconds=0.0
        )
        
        self.transcriptions[transcription_id] = result
        
        logger.info(f"Transcription {transcription_id} created for audio {audio_url}")
        
        return result
    
    def detect_language(self, text: str) -> Tuple[Language, float]:
        """
        Detect language from text.
        
        Returns (language, confidence)
        """
        text_lower = text.lower()
        
        # Check for Pidgin markers
        pidgin_markers = ["dey", "wetin", "na", "abeg", "abi", "sha", "o", "wahala"]
        pidgin_count = sum(1 for marker in pidgin_markers if marker in text_lower)
        
        # Check for Yoruba markers
        yoruba_markers = ["ẹ", "ọ", "mo", "se", "ko", "wa", "ni"]
        yoruba_count = sum(1 for marker in yoruba_markers if marker in text_lower)
        
        # Check for Igbo markers
        igbo_markers = ["ọ", "ụ", "ndi", "na", "gi", "m"]
        igbo_count = sum(1 for marker in igbo_markers if marker in text_lower)
        
        # Check for Hausa markers
        hausa_markers = ["ina", "ba", "da", "ne", "ce", "ya"]
        hausa_count = sum(1 for marker in hausa_markers if marker in text_lower)
        
        # Determine language
        counts = {
            Language.PIDGIN: pidgin_count,
            Language.YORUBA: yoruba_count,
            Language.IGBO: igbo_count,
            Language.HAUSA: hausa_count,
        }
        
        max_count = max(counts.values())
        if max_count >= 2:
            language = max(counts, key=counts.get)
            confidence = min(0.9, 0.5 + (max_count * 0.1))
            return language, confidence
        
        return Language.ENGLISH, 0.8
    
    def translate_pidgin(self, text: str) -> str:
        """
        Translate Nigerian Pidgin to English for processing.
        """
        result = text.lower()
        
        for pidgin, english in PIDGIN_COMMERCE_PHRASES.items():
            result = result.replace(pidgin, english)
        
        return result
    
    def extract_commerce_data(self, text: str) -> Dict[str, Any]:
        """
        Extract commerce-related data from transcribed text.
        
        Extracts:
        - Price/amount
        - Phone numbers
        - Product mentions
        - Intent (buy/sell)
        """
        # Detect language and translate if needed
        language, lang_confidence = self.detect_language(text)
        
        if language == Language.PIDGIN:
            processed_text = self.translate_pidgin(text)
        else:
            processed_text = text.lower()
        
        result = {
            "original_text": text,
            "processed_text": processed_text,
            "language": language.value,
            "language_confidence": lang_confidence,
            "price": None,
            "phone": None,
            "intent": None,
            "product": None,
        }
        
        # Extract price
        price_patterns = [
            r'(\d+)\s*(?:thousand|k)',  # 150k, 150 thousand
            r'(?:naira|₦|ngn)\s*(\d+(?:,\d{3})*)',  # ₦150,000
            r'(\d+(?:,\d{3})*)\s*(?:naira|ngn)',  # 150,000 naira
            r'(\d+)\s*(?:hundred)\s*(?:thousand|k)',  # one hundred thousand
        ]
        
        for pattern in price_patterns:
            match = re.search(pattern, processed_text, re.IGNORECASE)
            if match:
                value = match.group(1).replace(',', '')
                if 'thousand' in processed_text or 'k' in processed_text.lower():
                    result["price"] = float(value) * 1000
                else:
                    result["price"] = float(value)
                break
        
        # Extract phone number
        phone_pattern = r'(?:0|\+?234)?[\s.-]?(?:70|80|81|90|91)[\s.-]?\d{1}[\s.-]?\d{3}[\s.-]?\d{4}'
        phone_match = re.search(phone_pattern, text)
        if phone_match:
            result["phone"] = self._normalize_phone(phone_match.group())
        
        # Detect intent
        buy_keywords = ["buy", "purchase", "want", "need", "get", "order", "pay"]
        sell_keywords = ["sell", "selling", "for sale", "available"]
        
        if any(kw in processed_text for kw in buy_keywords):
            result["intent"] = "buy"
        elif any(kw in processed_text for kw in sell_keywords):
            result["intent"] = "sell"
        
        return result
    
    def parse_voice_command(self, text: str) -> VoiceCommand:
        """
        Parse voice command from transcribed text.
        
        Supported commands:
        - "Create escrow for [amount] to [phone]"
        - "Check status of [escrow ID]"
        - "Confirm delivery for [escrow ID]"
        - "Cancel escrow [escrow ID]"
        - "Help" / "What can you do"
        """
        text_lower = text.lower()
        language, _ = self.detect_language(text)
        
        # Translate if Pidgin
        if language == Language.PIDGIN:
            processed = self.translate_pidgin(text_lower)
        else:
            processed = text_lower
        
        # Check for escrow creation
        escrow_patterns = [
            r'(?:create|make|start)\s*(?:an?\s*)?escrow\s*(?:for|of)?\s*(\d+[kK]?)\s*(?:to|for)?\s*(\d{10,11})?',
            r'(?:protect|secure)\s*(?:my\s*)?(?:payment|money)\s*(?:of|for)?\s*(\d+[kK]?)',
            r'escrow\s*(\d+[kK]?)\s*(\d{10,11})?',
        ]
        
        for pattern in escrow_patterns:
            match = re.search(pattern, processed)
            if match:
                amount_str = match.group(1)
                phone = match.group(2) if len(match.groups()) > 1 else None
                
                # Parse amount
                if amount_str.lower().endswith('k'):
                    amount = float(amount_str[:-1]) * 1000
                else:
                    amount = float(amount_str)
                
                return VoiceCommand(
                    type=VoiceCommandType.CREATE_ESCROW,
                    confidence=0.85,
                    parameters={
                        "amount": amount,
                        "seller_phone": self._normalize_phone(phone) if phone else None
                    },
                    original_text=text,
                    language=language
                )
        
        # Check for status check
        status_patterns = [
            r'(?:check|what\s*is|get)\s*(?:the\s*)?status\s*(?:of|for)?\s*(\S+)?',
            r'(?:how\s*is|where\s*is)\s*(?:my\s*)?(?:order|escrow|payment)',
        ]
        
        for pattern in status_patterns:
            match = re.search(pattern, processed)
            if match:
                escrow_id = match.group(1) if match.groups() else None
                return VoiceCommand(
                    type=VoiceCommandType.CHECK_STATUS,
                    confidence=0.8,
                    parameters={"escrow_id": escrow_id},
                    original_text=text,
                    language=language
                )
        
        # Check for delivery confirmation
        delivery_patterns = [
            r'(?:confirm|i\s*(?:have\s*)?received?|got)\s*(?:the\s*)?(?:delivery|item|package|order)',
            r'(?:i\s*don\s*receive|e\s*don\s*reach)',  # Pidgin
        ]
        
        for pattern in delivery_patterns:
            if re.search(pattern, processed):
                return VoiceCommand(
                    type=VoiceCommandType.CONFIRM_DELIVERY,
                    confidence=0.8,
                    parameters={},
                    original_text=text,
                    language=language
                )
        
        # Check for cancellation
        cancel_patterns = [
            r'(?:cancel|stop|abort)\s*(?:the\s*)?(?:escrow|order|payment)',
            r'(?:i\s*no\s*want\s*again|cancel\s*am)',  # Pidgin
        ]
        
        for pattern in cancel_patterns:
            if re.search(pattern, processed):
                return VoiceCommand(
                    type=VoiceCommandType.CANCEL_ESCROW,
                    confidence=0.75,
                    parameters={},
                    original_text=text,
                    language=language
                )
        
        # Check for help
        help_patterns = [
            r'(?:help|what\s*can\s*you\s*do|how\s*(?:does?\s*)?(?:this|it)\s*work)',
            r'(?:wetin\s*you\s*fit\s*do|help\s*me)',  # Pidgin
        ]
        
        for pattern in help_patterns:
            if re.search(pattern, processed):
                return VoiceCommand(
                    type=VoiceCommandType.HELP,
                    confidence=0.9,
                    parameters={},
                    original_text=text,
                    language=language
                )
        
        # Unknown command - try to extract commerce data
        commerce_data = self.extract_commerce_data(text)
        
        if commerce_data["price"] or commerce_data["phone"]:
            return VoiceCommand(
                type=VoiceCommandType.CREATE_ESCROW,
                confidence=0.6,
                parameters={
                    "amount": commerce_data["price"],
                    "seller_phone": commerce_data["phone"],
                    "inferred": True
                },
                original_text=text,
                language=language
            )
        
        return VoiceCommand(
            type=VoiceCommandType.UNKNOWN,
            confidence=0.3,
            parameters={"commerce_data": commerce_data},
            original_text=text,
            language=language
        )
    
    def generate_voice_response(
        self,
        command: VoiceCommand,
        result: Dict[str, Any] = None
    ) -> str:
        """
        Generate response text that can be converted to voice.
        
        Responses are in the same language as the command.
        """
        if command.language == Language.PIDGIN:
            return self._generate_pidgin_response(command, result)
        
        # English responses
        if command.type == VoiceCommandType.CREATE_ESCROW:
            if result and result.get("success"):
                return (
                    f"Escrow created successfully. "
                    f"Amount: {result.get('amount', 0):,.0f} Naira. "
                    f"Escrow ID: {result.get('escrow_id', 'unknown')}. "
                    f"The seller has been notified."
                )
            else:
                return "I couldn't create the escrow. Please try again with the amount and seller's phone number."
        
        elif command.type == VoiceCommandType.CHECK_STATUS:
            if result:
                return f"Your escrow status is: {result.get('status', 'unknown')}."
            else:
                return "Please provide the escrow ID to check the status."
        
        elif command.type == VoiceCommandType.CONFIRM_DELIVERY:
            if result and result.get("success"):
                return "Delivery confirmed. The payment will be released to the seller."
            else:
                return "I couldn't confirm the delivery. Please try again."
        
        elif command.type == VoiceCommandType.CANCEL_ESCROW:
            if result and result.get("success"):
                return "Escrow cancelled. Your refund is being processed."
            else:
                return "I couldn't cancel the escrow. It may already be completed."
        
        elif command.type == VoiceCommandType.HELP:
            return (
                "I can help you buy safely on social media. "
                "Say 'create escrow' followed by the amount and seller's phone number. "
                "You can also say 'check status', 'confirm delivery', or 'cancel escrow'."
            )
        
        else:
            return (
                "I didn't understand that. "
                "Try saying 'create escrow 50000 to 08012345678' "
                "or 'check status'."
            )
    
    def _generate_pidgin_response(
        self,
        command: VoiceCommand,
        result: Dict[str, Any] = None
    ) -> str:
        """Generate response in Nigerian Pidgin"""
        if command.type == VoiceCommandType.CREATE_ESCROW:
            if result and result.get("success"):
                return (
                    f"E don work! Escrow don create. "
                    f"Amount na {result.get('amount', 0):,.0f} Naira. "
                    f"Escrow ID na {result.get('escrow_id', 'unknown')}. "
                    f"We don tell the seller."
                )
            else:
                return "E no work o. Abeg try again with the amount and seller phone number."
        
        elif command.type == VoiceCommandType.CHECK_STATUS:
            if result:
                return f"Your escrow status na: {result.get('status', 'unknown')}."
            else:
                return "Abeg give me the escrow ID make I check am."
        
        elif command.type == VoiceCommandType.CONFIRM_DELIVERY:
            if result and result.get("success"):
                return "E don confirm! We go release the money give the seller."
            else:
                return "E no work. Abeg try again."
        
        elif command.type == VoiceCommandType.HELP:
            return (
                "I fit help you buy safe for social media. "
                "Talk say 'create escrow' plus the amount and seller phone. "
                "You fit also talk 'check status' or 'confirm delivery'."
            )
        
        else:
            return (
                "I no understand wetin you talk. "
                "Try talk 'create escrow 50000 to 08012345678' "
                "or 'check status'."
            )
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize Nigerian phone number to +234 format"""
        if not phone:
            return None
        digits = ''.join(c for c in phone if c.isdigit())
        if digits.startswith('234') and len(digits) == 13:
            return f"+{digits}"
        elif digits.startswith('0') and len(digits) == 11:
            return f"+234{digits[1:]}"
        elif len(digits) == 10:
            return f"+234{digits}"
        return phone


# Global voice note service instance
voice_note_service = VoiceNoteService()
