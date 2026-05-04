#!/usr/bin/env python3
"""
AI Agent Engine for Banking Telephony
Integrates with VideoSDK and provides intelligent conversation handling
Supports multiple Nigerian languages and banking-specific scenarios
"""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import aiohttp
import aioredis
from sqlalchemy import create_engine, Column, String, DateTime, Float, Integer, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID
import speech_recognition as sr
import pyttsx3
from gtts import gTTS
import io
import wave
import numpy as np
from pydub import AudioSegment
import websockets
import threading
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Ollama client
from ollama_client import OllamaClient

# Language constants
class Language(Enum):
    ENGLISH = "english"
    HAUSA = "hausa"
    YORUBA = "yoruba"
    IGBO = "igbo"
    PIDGIN = "pidgin"

# Conversation states
class ConversationState(Enum):
    GREETING = "greeting"
    IDENTIFICATION = "identification"
    ISSUE_ASSESSMENT = "issue_assessment"
    RESOLUTION = "resolution"
    ESCALATION = "escalation"
    CLOSING = "closing"
    COMPLETED = "completed"

# Issue types
class IssueType(Enum):
    BLOCKED_ACCOUNT = "blocked_account"
    FRAUD_REPORT = "fraud_report"
    TRANSACTION_DISPUTE = "transaction_dispute"
    GENERAL_INQUIRY = "general_inquiry"
    TECHNICAL_SUPPORT = "technical_support"
    PRODUCT_INQUIRY = "product_inquiry"

# Resolution status
class ResolutionStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    ESCALATED = "escalated"
    FAILED = "failed"

@dataclass
class CustomerContext:
    customer_id: str
    bvn: str = ""
    name: str = ""
    phone_number: str = ""
    preferred_language: str = Language.ENGLISH.value
    account_status: str = ""
    risk_score: float = 0.0
    total_balance: float = 0.0
    recent_transactions: List[Dict] = field(default_factory=list)
    interaction_history: List[Dict] = field(default_factory=list)
    verification_status: str = "unverified"
    security_questions_passed: int = 0

@dataclass
class ConversationContext:
    conversation_id: str
    call_id: str
    customer_context: CustomerContext
    current_state: ConversationState = ConversationState.GREETING
    issue_type: Optional[IssueType] = None
    resolution_status: ResolutionStatus = ResolutionStatus.PENDING
    language: Language = Language.ENGLISH
    agent_personality: Dict[str, str] = field(default_factory=dict)
    conversation_history: List[Dict] = field(default_factory=list)
    extracted_entities: Dict[str, Any] = field(default_factory=dict)
    confidence_scores: Dict[str, float] = field(default_factory=dict)
    escalation_reasons: List[str] = field(default_factory=list)
    resolution_actions: List[str] = field(default_factory=list)
    start_time: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)

class AIAgentEngine:
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Initialize Ollama client
        self.ollama_client = OllamaClient()
        
        # Initialize database connection
        self.db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/banking_crm")
        self.engine = create_engine(self.db_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Initialize Redis for session management
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client = None
        
        # Active conversations
        self.active_conversations: Dict[str, ConversationContext] = {}
        
        # Language models and prompts
        self.language_models = self._initialize_language_models()
        self.conversation_prompts = self._initialize_conversation_prompts()
        
        # Speech recognition and synthesis
        self.speech_recognizer = sr.Recognizer()
        self.tts_engines = self._initialize_tts_engines()
        
        # Banking knowledge base
        self.banking_knowledge = self._initialize_banking_knowledge()
        
        # Thread pool for concurrent processing
        self.executor = ThreadPoolExecutor(max_workers=10)
        
        # WebSocket connections for real-time updates
        self.websocket_connections = set()
        
    async def initialize(self):
        """Initialize the AI Agent Engine"""
        self.logger.info("Initializing AI Agent Engine")
        
        # Initialize Ollama client
        await self.ollama_client.initialize()
        
        # Initialize Redis connection
        self.redis_client = aioredis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
        
        # Test database connection
        try:
            with self.engine.connect() as conn:
                conn.execute("SELECT 1")
            self.logger.info("Database connection successful")
        except Exception as e:
            self.logger.error(f"Database connection failed: {e}")
            raise
        
        # Load customer data cache
        await self._load_customer_cache()
        
        self.logger.info("AI Agent Engine initialized successfully")
    
    def _initialize_language_models(self) -> Dict[str, Dict]:
        """Initialize language-specific models and configurations"""
        return {
            Language.ENGLISH.value: {
                "model": "llama3",
                "voice_model": "en-NG-female-1",
                "speech_recognition_lang": "en-NG",
                "cultural_context": "Nigerian English, professional banking context"
            },
            Language.HAUSA.value: {
                "model": "llama3",
                "voice_model": "ha-NG-female-1", 
                "speech_recognition_lang": "ha-NG",
                "cultural_context": "Northern Nigerian Hausa culture, Islamic banking considerations"
            },
            Language.YORUBA.value: {
                "model": "llama3",
                "voice_model": "yo-NG-female-1",
                "speech_recognition_lang": "yo-NG", 
                "cultural_context": "Southwestern Nigerian Yoruba culture, respect for elders"
            },
            Language.IGBO.value: {
                "model": "llama3",
                "voice_model": "ig-NG-female-1",
                "speech_recognition_lang": "ig-NG",
                "cultural_context": "Southeastern Nigerian Igbo culture, business-oriented"
            },
            Language.PIDGIN.value: {
                "model": "llama3",
                "voice_model": "pcm-NG-male-1",
                "speech_recognition_lang": "pcm-NG",
                "cultural_context": "Nigerian Pidgin English, casual and friendly"
            }
        }
    
    def _initialize_conversation_prompts(self) -> Dict[str, Dict]:
        """Initialize conversation prompts for different languages and scenarios"""
        return {
            Language.ENGLISH.value: {
                "system_prompt": """You are Sarah, a professional and empathetic AI banking agent for a Nigerian bank. 
                You speak Nigerian English and understand local banking practices. You are helpful, patient, and security-conscious.
                Always verify customer identity before discussing account details. Be culturally sensitive and professional.
                
                Key responsibilities:
                - Verify customer identity using security questions
                - Help resolve banking issues (blocked accounts, transaction disputes, etc.)
                - Provide product information and assistance
                - Escalate complex issues to human agents when necessary
                - Maintain customer confidentiality and security
                
                Communication style:
                - Professional but warm
                - Use "Sir" or "Madam" appropriately
                - Be patient with elderly customers
                - Explain banking terms clearly
                - Show empathy for customer concerns""",
                
                "greeting": "Good {time_of_day}! Thank you for calling {bank_name}. My name is Sarah, and I'm here to assist you today. May I please have your name and the phone number registered with your account?",
                
                "identity_verification": "Thank you, {customer_name}. For security purposes, I need to verify your identity. Can you please provide me with your date of birth and the last four digits of your BVN?",
                
                "blocked_account": "I understand your account has been blocked, and I sincerely apologize for any inconvenience this may have caused. Let me check the reason for the block and see how I can assist you in resolving this matter quickly.",
                
                "fraud_alert": "I see there's been some unusual activity on your account. For your security, we've temporarily restricted some transactions. Can you please confirm if you made a transaction of ₦{amount} at {location} on {date}?",
                
                "escalation": "I understand your concern, {customer_name}. This matter requires specialized attention, so I'm going to connect you with one of our senior customer service representatives who can better assist you. Please hold on while I transfer your call."
            },
            
            Language.HAUSA.value: {
                "system_prompt": """Kai Aisha ce, wakilan banki mai hankali da tausayi ga bankin Najeriya. 
                Kana magana da Hausa kuma ka fahimci al'adun banki na gida. Kana da taimako, hakuri, da kula da tsaro.
                Ko da yaushe ka tabbatar da asalin abokin ciniki kafin ka tattauna bayanan asusun. Ka kasance mai hankali da al'ada kuma ka kasance mai sana'a.
                
                Muhimman ayyuka:
                - Tabbatar da asalin abokin ciniki ta amfani da tambayoyin tsaro
                - Taimaka wajen warware matsalolin banki (toshe asusun, jayayya kan ma'amala, da sauransu)
                - Bayar da bayanin samfur da taimako
                - Kai matsaloli masu wahala ga wakilai na mutane lokacin da ya cancanta
                - Kiyaye sirrin abokin ciniki da tsaro
                
                Salon sadarwa:
                - Mai sana'a amma mai dumi
                - Yi amfani da "Malam" ko "Hajiya" yadda ya dace
                - Ka kasance mai hakuri da manya
                - Bayyana kalmomin banki a sarari
                - Nuna tausayi ga damuwar abokin ciniki""",
                
                "greeting": "{time_of_day} mai kyau! Na gode da kiran {bank_name}. Sunana Aisha, kuma ina nan don in taimake ku yau. Zan iya samun sunanku da lambar wayar da aka yi rajista da asusunku?",
                
                "identity_verification": "Na gode, {customer_name}. Don tsaro, ina bukatar in tabbatar da asalinku. Za ku iya ba ni ranar haihuwarku da lambobi hudu na karshe na BVN ku?",
                
                "blocked_account": "Na fahimci cewa an toshe asusunku, kuma ina ba da hakuri sosai don duk wani matsala da wannan ya haifar. Bari in duba dalilin toshewar in ga yadda zan iya taimaka muku wajen warware wannan al'amari da sauri.",
                
                "fraud_alert": "Na ga an samu wasu ayyukan da ba na al'ada ba a asusunku. Don tsaronku, mun hana wasu ma'amaloli na dan lokaci. Za ku iya tabbatar da cewa kun yi ma'amala ta ₦{amount} a {location} a ranar {date}?",
                
                "escalation": "Na fahimci damuwarku, {customer_name}. Wannan al'amari yana bukatar kulawa ta musamman, don haka zan hadar da ku da daya daga cikin manyan wakilanmu na sabis na abokan ciniki wanda zai iya taimaka muku sosai. Don Allah ku jira yayin da nake canja kiran ku."
            },
            
            Language.YORUBA.value: {
                "system_prompt": """Iwo ni Adunni, asoju banki ti o ni itoju ati aanu fun banki kan ni Nigeria.
                O n so ede Yoruba ati pe o ni oye awon asa banki agbegbe. O ni iranlowo, suuru, ati akiyesi aabo.
                Nigbagbogbo ri daju pe o ri idi onibara daju ki o to jiroro nipa awon alaye akanti. Jeki o ni itoju asa ati pe o jeki o ni ise.
                
                Awon ojuse pataki:
                - Ri idi onibara daju nipa lilo awon ibeere aabo
                - Ran ni lowo lati yanju awon isoro banki (dina akanti, ariyanjiyan idunadura, ati beebeelo)
                - Pese alaye oja ati iranlowo
                - Gbe awon isoro to nira si awon asoju eniyan nigba ti o ba ye
                - Pa idi onibara ati aabo mo
                
                Iru ibaraenisepo:
                - Ise sugbon gbona
                - Lo "Baba" tabi "Mama" bi o ti ye
                - Ni suuru pelu awon agbalagba
                - Salaye awon oro banki ni kedere
                - Fi aanu han fun awon ibakcdun onibara""",
                
                "greeting": "E ku {time_of_day}! E se fun pipe si {bank_name}. Oruko mi ni Adunni, mo si wa nibi lati ran yin lowo loni. Se mo le gba oruko yin ati nọmba foonu ti e fi forukọsilẹ pelu akanti yin?",
                
                "identity_verification": "E se, {customer_name}. Fun aabo, mo nilo lati ri idi yin daju. Se e le fun mi ni ojo ibi yin ati awon nọmba merin ti o kẹhin ti BVN yin?",
                
                "blocked_account": "Mo ye pe a ti di akanti yin, mo si toro gafara fun eyikeyi wahala ti eyi le ti fa. Jeki n wo idi ti a fi di i ki n wo bi mo se le ran yin lowo lati yanju oro yi ni kiakia.",
                
                "fraud_alert": "Mo ri pe awon iṣe ti ko wọpọ wa lori akanti yin. Fun aabo yin, a ti dena awon idunadura kan fun igba diẹ. Se e le jẹrisi pe e ṣe idunadura ti ₦{amount} ni {location} ni ọjọ {date}?",
                
                "escalation": "Mo ye ibakcdun yin, {customer_name}. Oro yi nilo akiyesi pataki, nitori naa mo fe so yin po pelu ọkan ninu awon asoju wa ti o ga ti sabisi onibara ti o le ran yin lowo daradara. E jọwọ duro nigba ti mo n gbe ipe yin kọja."
            },
            
            Language.IGBO.value: {
                "system_prompt": """I bu Chioma, onye nnochite anya ulo aku nke nwere obi oma na nwere obi ebere maka ulo aku Nigeria.
                I na-asu Igbo ma ghota omenala ulo aku nke obodo. I nwere enyemaka, ndidi, na nlebara anya nchekwa.
                Mgbe niile jide n'aka na i chọpụtara onye ahia tupu i kwurie banyere nkọwa akaụntụ. Bụrụ onye nwere mmasị na omenala ma bụrụkwa onye ọkachamara.
                
                Ọrụ ndị dị mkpa:
                - Chọpụta onye ahia site na iji ajụjụ nchekwa
                - Nyere aka idozi nsogbu ulo aku (gbochie akaụntụ, esemokwu azụmahịa, na ndị ọzọ)
                - Nye ozi ngwaahịa na enyemaka
                - Bulie nsogbu ndị siri ike nye ndị nnọchite anya mmadụ mgbe ọ dị mkpa
                - Chebe nzuzo onye ahia na nchekwa
                
                Ụdị nkwurịta okwu:
                - Ọkachamara ma na-ekpo ọkụ
                - Jiri "Nna" ma ọ bụ "Nne" dị ka o si kwesị
                - Nwee ndidi na ndị agadi
                - Kọwaa okwu ulo aku nke ọma
                - Gosi ọmịiko maka nchegbu onye ahia""",
                
                "greeting": "Ndewo {time_of_day}! Dalu maka ịkpọ {bank_name}. Aha m bụ Chioma, anọ m ebe a inyere gị aka taa. Enwere m ike inweta aha gị na nọmba ekwentị nke edebanye na akaụntụ gị?",
                
                "identity_verification": "Dalu, {customer_name}. Maka nchekwa, achọrọ m ịchọpụta onye ị bụ. Ị nwere ike inye m ụbọchị ọmụmụ gị na ọnụọgụgụ anọ ikpeazụ nke BVN gị?",
                
                "blocked_account": "Aghọtara m na egbochiri akaụntụ gị, ana m arịọ mgbaghara maka nsogbu ọ bụla nke a nwere ike ibute. Ka m lelee ihe kpatara egbochi ahụ ma hụ otú m ga-esi nyere gị aka idozi okwu a ngwa ngwa.",
                
                "fraud_alert": "Ahụrụ m na enwere ụfọdụ ọrụ na-adịghị anya na akaụntụ gị. Maka nchekwa gị, anyị egbochila ụfọdụ azụmahịa ruo nwa oge. Ị nwere ike ikwenye na i mere azụmahịa nke ₦{amount} na {location} na ụbọchị {date}?",
                
                "escalation": "Aghọtara m nchegbu gị, {customer_name}. Okwu a chọrọ nlebara anya pụrụ iche, ya mere aga m ejikọ gị na otu n'ime ndị nnọchite anya anyị dị elu nke ọrụ ndị ahia nke nwere ike inyere gị aka nke ọma. Biko chere ka m na-ebufe oku gị."
            },
            
            Language.PIDGIN.value: {
                "system_prompt": """You be Emeka, one banking agent wey dey help people for Nigerian bank.
                You sabi talk Pidgin well well and you understand how banking dey work for Naija. You dey helpful, get patience, and you dey careful about security.
                Always make sure say you know who dey call you before you talk about account matter. Dey respectful and professional.
                
                Wetin you suppose do:
                - Check say na the real customer dey call by asking security questions
                - Help solve banking problems (blocked account, transaction wahala, etc.)
                - Give information about bank products
                - Send difficult matter to human agents when e necessary
                - Keep customer information secret and safe
                
                How you go talk:
                - Professional but friendly
                - Use "Oga" or "Madam" as e fit
                - Get patience with old people
                - Explain banking terms make dem understand
                - Show say you care about customer problems""",
                
                "greeting": "How far! Thank you for calling {bank_name}. My name na Emeka, I dey here to help you today. Wetin be your name and the phone number wey you register with your account?",
                
                "identity_verification": "Thank you, {customer_name}. For security, I need to confirm say na you be the real owner of this account. You fit give me your date of birth and the last four digits of your BVN?",
                
                "blocked_account": "I understand say dem don block your account, and I sorry well well for any wahala wey this thing cause you. Make I check wetin cause the block and see how I fit help you solve this matter sharp sharp.",
                
                "fraud_alert": "I see say some strange activity dey happen for your account. For your safety, we don temporary stop some transactions. You fit confirm say na you do transaction of ₦{amount} for {location} on {date}?",
                
                "escalation": "I understand your concern, {customer_name}. This matter need special attention, so I go connect you with one of our senior customer service people wey go fit help you better. Please hold on make I transfer your call."
            }
        }
    
    def _initialize_tts_engines(self) -> Dict[str, Any]:
        """Initialize text-to-speech engines for different languages"""
        engines = {}
        
        for lang in Language:
            try:
                engine = pyttsx3.init()
                # Configure voice properties based on language
                voices = engine.getProperty('voices')
                
                # Set appropriate voice for each language
                if lang == Language.ENGLISH:
                    # Look for Nigerian English voice or fallback to English
                    for voice in voices:
                        if 'english' in voice.name.lower() or 'en' in voice.id.lower():
                            engine.setProperty('voice', voice.id)
                            break
                
                # Set speech rate and volume
                engine.setProperty('rate', 150)  # Slower for clarity
                engine.setProperty('volume', 0.9)
                
                engines[lang.value] = engine
                
            except Exception as e:
                self.logger.error(f"Failed to initialize TTS engine for {lang.value}: {e}")
                engines[lang.value] = None
        
        return engines
    
    def _initialize_banking_knowledge(self) -> Dict[str, Any]:
        """Initialize banking knowledge base for different scenarios"""
        return {
            "blocked_account_reasons": {
                "fraud_suspected": {
                    "description": "Account blocked due to suspected fraudulent activity",
                    "resolution_steps": [
                        "Verify customer identity",
                        "Review recent transactions",
                        "Confirm legitimate transactions",
                        "Unblock account if verified",
                        "Update security settings"
                    ],
                    "required_verification": ["security_questions", "otp_verification"],
                    "escalation_criteria": ["high_value_transactions", "multiple_fraud_indicators"]
                },
                "kyc_incomplete": {
                    "description": "Account blocked due to incomplete KYC documentation",
                    "resolution_steps": [
                        "Identify missing documents",
                        "Guide customer on document submission",
                        "Schedule document verification",
                        "Temporary unblock if possible"
                    ],
                    "required_verification": ["document_upload", "address_verification"],
                    "escalation_criteria": ["document_authenticity_concerns"]
                },
                "regulatory_compliance": {
                    "description": "Account blocked for regulatory compliance review",
                    "resolution_steps": [
                        "Explain compliance requirements",
                        "Collect additional information",
                        "Escalate to compliance team",
                        "Schedule compliance interview"
                    ],
                    "required_verification": ["source_of_funds", "business_verification"],
                    "escalation_criteria": ["always_escalate"]
                }
            },
            
            "transaction_dispute_types": {
                "unauthorized_transaction": {
                    "description": "Customer claims transaction was not authorized",
                    "resolution_steps": [
                        "Verify transaction details",
                        "Check transaction location and device",
                        "Block card if necessary",
                        "Initiate chargeback process",
                        "Issue provisional credit"
                    ],
                    "investigation_required": True,
                    "provisional_credit": True
                },
                "duplicate_charge": {
                    "description": "Customer charged multiple times for same transaction",
                    "resolution_steps": [
                        "Verify duplicate transactions",
                        "Contact merchant if necessary",
                        "Process refund for duplicate charges"
                    ],
                    "investigation_required": False,
                    "provisional_credit": True
                },
                "merchant_dispute": {
                    "description": "Dispute with merchant regarding goods/services",
                    "resolution_steps": [
                        "Collect transaction evidence",
                        "Contact merchant for resolution",
                        "Mediate between customer and merchant",
                        "Process chargeback if necessary"
                    ],
                    "investigation_required": True,
                    "provisional_credit": False
                }
            },
            
            "product_information": {
                "savings_account": {
                    "features": ["No minimum balance", "Free debit card", "Mobile banking", "USSD banking"],
                    "interest_rate": "2.5% per annum",
                    "charges": "No monthly maintenance fee"
                },
                "current_account": {
                    "features": ["Checkbook facility", "Overdraft facility", "Business banking", "Bulk transfers"],
                    "minimum_balance": "₦10,000",
                    "charges": "₦500 monthly maintenance fee"
                },
                "fixed_deposit": {
                    "features": ["Guaranteed returns", "Flexible tenure", "Auto-renewal option"],
                    "interest_rates": {
                        "30_days": "5.0%",
                        "90_days": "6.0%", 
                        "180_days": "7.0%",
                        "365_days": "8.0%"
                    },
                    "minimum_amount": "₦50,000"
                }
            },
            
            "security_questions": [
                "What is your mother's maiden name?",
                "What is the name of your first school?",
                "What is your favorite food?",
                "What is the name of your first pet?",
                "In which city were you born?",
                "What is your father's middle name?"
            ]
        }
    
    async def _load_customer_cache(self):
        """Load frequently accessed customer data into Redis cache"""
        try:
            # This would load customer data from database into Redis
            # For now, we'll just log that cache loading is complete
            self.logger.info("Customer cache loaded successfully")
        except Exception as e:
            self.logger.error(f"Failed to load customer cache: {e}")
    
    async def start_conversation(self, call_id: str, customer_phone: str, 
                                language: str = Language.ENGLISH.value,
                                issue_type: str = None) -> ConversationContext:
        """Start a new conversation"""
        conversation_id = str(uuid.uuid4())
        
        # Get customer context
        customer_context = await self._get_customer_context(customer_phone)
        
        # Create conversation context
        conversation = ConversationContext(
            conversation_id=conversation_id,
            call_id=call_id,
            customer_context=customer_context,
            language=Language(language),
            issue_type=IssueType(issue_type) if issue_type else None
        )
        
        # Store conversation
        self.active_conversations[conversation_id] = conversation
        
        # Cache conversation in Redis
        await self.redis_client.setex(
            f"conversation:{conversation_id}",
            3600,  # 1 hour TTL
            json.dumps(self._serialize_conversation(conversation))
        )
        
        self.logger.info(f"Started conversation {conversation_id} for call {call_id}")
        
        return conversation
    
    async def process_audio_input(self, conversation_id: str, audio_data: bytes) -> Dict[str, Any]:
        """Process audio input from customer"""
        if conversation_id not in self.active_conversations:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        conversation = self.active_conversations[conversation_id]
        
        try:
            # Convert audio to text
            text = await self._speech_to_text(audio_data, conversation.language)
            
            if not text:
                return {
                    "success": False,
                    "error": "Could not understand audio input",
                    "response_audio": await self._generate_clarification_response(conversation)
                }
            
            # Process the text input
            response = await self.process_text_input(conversation_id, text)
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error processing audio input: {e}")
            return {
                "success": False,
                "error": str(e),
                "response_audio": await self._generate_error_response(conversation)
            }
    
    async def process_text_input(self, conversation_id: str, text: str) -> Dict[str, Any]:
        """Process text input from customer"""
        if conversation_id not in self.active_conversations:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        conversation = self.active_conversations[conversation_id]
        conversation.last_activity = datetime.now()
        
        # Add customer input to conversation history
        conversation.conversation_history.append({
            "timestamp": datetime.now().isoformat(),
            "speaker": "customer",
            "text": text,
            "language": conversation.language.value
        })
        
        try:
            # Extract entities and intent from customer input
            entities = await self._extract_entities(text, conversation)
            intent = await self._classify_intent(text, conversation)
            
            # Update conversation context with extracted information
            conversation.extracted_entities.update(entities)
            
            # Generate appropriate response based on current state and intent
            response_text = await self._generate_response(conversation, intent, entities)
            
            # Convert response to audio
            response_audio = await self._text_to_speech(response_text, conversation.language)
            
            # Add agent response to conversation history
            conversation.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "speaker": "agent",
                "text": response_text,
                "language": conversation.language.value
            })
            
            # Update conversation state if necessary
            await self._update_conversation_state(conversation, intent, entities)
            
            # Check if escalation is needed
            escalation_needed = await self._check_escalation_criteria(conversation, intent, entities)
            
            # Update Redis cache
            await self.redis_client.setex(
                f"conversation:{conversation_id}",
                3600,
                json.dumps(self._serialize_conversation(conversation))
            )
            
            return {
                "success": True,
                "response_text": response_text,
                "response_audio": response_audio,
                "conversation_state": conversation.current_state.value,
                "escalation_needed": escalation_needed,
                "extracted_entities": entities,
                "confidence_score": conversation.confidence_scores.get("overall", 0.8)
            }
            
        except Exception as e:
            self.logger.error(f"Error processing text input: {e}")
            error_response = await self._generate_error_response(conversation)
            return {
                "success": False,
                "error": str(e),
                "response_audio": error_response
            }
    
    async def _get_customer_context(self, phone_number: str) -> CustomerContext:
        """Get customer context from database and cache"""
        try:
            # Try to get from Redis cache first
            cached_data = await self.redis_client.get(f"customer:{phone_number}")
            if cached_data:
                data = json.loads(cached_data)
                return CustomerContext(**data)
            
            # If not in cache, get from database
            with self.SessionLocal() as db:
                # This would be actual database query
                # For now, return mock data
                customer_context = CustomerContext(
                    customer_id=str(uuid.uuid4()),
                    name="John Doe",
                    phone_number=phone_number,
                    preferred_language=Language.ENGLISH.value,
                    account_status="active",
                    risk_score=25.0,
                    total_balance=150000.0
                )
                
                # Cache for future use
                await self.redis_client.setex(
                    f"customer:{phone_number}",
                    1800,  # 30 minutes TTL
                    json.dumps(customer_context.__dict__)
                )
                
                return customer_context
                
        except Exception as e:
            self.logger.error(f"Error getting customer context: {e}")
            # Return minimal context
            return CustomerContext(
                customer_id=str(uuid.uuid4()),
                phone_number=phone_number
            )
    
    async def _speech_to_text(self, audio_data: bytes, language: Language) -> str:
        """Convert speech to text"""
        try:
            # Convert bytes to audio format that speech_recognition can handle
            audio_segment = AudioSegment.from_raw(
                io.BytesIO(audio_data),
                sample_width=2,
                frame_rate=16000,
                channels=1
            )
            
            # Export to wav format
            wav_io = io.BytesIO()
            audio_segment.export(wav_io, format="wav")
            wav_io.seek(0)
            
            # Use speech recognition
            with sr.AudioFile(wav_io) as source:
                audio = self.speech_recognizer.record(source)
            
            # Get language code for speech recognition
            lang_config = self.language_models.get(language.value, {})
            lang_code = lang_config.get("speech_recognition_lang", "en-US")
            
            # Recognize speech
            text = self.speech_recognizer.recognize_google(audio, language=lang_code)
            
            self.logger.info(f"Speech to text result: {text}")
            return text
            
        except sr.UnknownValueError:
            self.logger.warning("Could not understand audio")
            return ""
        except sr.RequestError as e:
            self.logger.error(f"Speech recognition error: {e}")
            return ""
        except Exception as e:
            self.logger.error(f"Error in speech to text: {e}")
            return ""
    
    async def _text_to_speech(self, text: str, language: Language) -> bytes:
        """Convert text to speech"""
        try:
            # Use gTTS for better language support
            lang_code = {
                Language.ENGLISH: "en",
                Language.HAUSA: "ha", 
                Language.YORUBA: "yo",
                Language.IGBO: "ig",
                Language.PIDGIN: "en"  # Use English for Pidgin
            }.get(language, "en")
            
            # Generate speech
            tts = gTTS(text=text, lang=lang_code, slow=False)
            
            # Save to bytes
            audio_io = io.BytesIO()
            tts.write_to_fp(audio_io)
            audio_io.seek(0)
            
            return audio_io.read()
            
        except Exception as e:
            self.logger.error(f"Error in text to speech: {e}")
            # Return empty bytes if TTS fails
            return b""
    
    async def _extract_entities(self, text: str, conversation: ConversationContext) -> Dict[str, Any]:
        """Extract entities from customer input using NLP"""
        try:
            # Use Ollama for entity extraction
            prompt = f"""
            Extract relevant banking entities from the following customer message in {conversation.language.value}:
            
            Message: "{text}"
            
            Extract the following entities if present:
            - account_number: Any account number mentioned
            - amount: Any monetary amount mentioned
            - date: Any date mentioned
            - location: Any location mentioned
            - transaction_id: Any transaction reference
            - card_number: Any card number (last 4 digits only)
            - issue_type: Type of banking issue (blocked_account, fraud_report, etc.)
            - urgency_level: How urgent the customer sounds (low, medium, high, critical)
            - emotion: Customer's emotional state (calm, frustrated, angry, worried)
            - verification_info: Any verification information provided
            
            Return as JSON format only.
            """
            
            response = await self.ollama_client.chat_completion([
                {"role": "system", "content": "You are an expert at extracting banking-related entities from customer conversations. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ])
            
            entities_text = response["choices"][0]["message"]["content"]
            
            # Handle potential JSON parsing issues
            try:
                entities = json.loads(entities_text)
            except json.JSONDecodeError:
                # Try to extract JSON from the text if it's not pure JSON
                import re
                json_match = re.search(r'\{.*\}', entities_text, re.DOTALL)
                if json_match:
                    entities = json.loads(json_match.group(0))
                else:
                    entities = {}
            
            return entities
            
        except Exception as e:
            self.logger.error(f"Error extracting entities: {e}")
            return {}
    
    async def _classify_intent(self, text: str, conversation: ConversationContext) -> str:
        """Classify customer intent"""
        try:
            # Use Ollama for intent classification
            prompt = f"""
            Classify the intent of this customer message in a banking context:
            
            Message: "{text}"
            Current conversation state: {conversation.current_state.value}
            Language: {conversation.language.value}
            
            Possible intents:
            - greeting: Customer is greeting or starting conversation
            - identity_verification: Customer is providing identity information
            - issue_reporting: Customer is reporting a problem
            - information_request: Customer is asking for information
            - transaction_inquiry: Customer is asking about transactions
            - complaint: Customer is making a complaint
            - confirmation: Customer is confirming something
            - denial: Customer is denying something
            - escalation_request: Customer wants to speak to human agent
            - closing: Customer is ending the conversation
            
            Return only the intent name.
            """
            
            response = await self.ollama_client.chat_completion([
                {"role": "system", "content": "You are an expert at classifying customer intents in banking conversations. Return only the intent name."},
                {"role": "user", "content": prompt}
            ])
            
            intent = response["choices"][0]["message"]["content"].strip()
            return intent
            
        except Exception as e:
            self.logger.error(f"Error classifying intent: {e}")
            return "unknown"
    
    async def _generate_response(self, conversation: ConversationContext, 
                                intent: str, entities: Dict[str, Any]) -> str:
        """Generate appropriate response based on conversation context"""
        try:
            # Get conversation prompts for the language
            prompts = self.conversation_prompts.get(conversation.language.value, {})
            system_prompt = prompts.get("system_prompt", "")
            
            # Build context for the AI model
            context = self._build_conversation_context(conversation, intent, entities)
            
            # Generate response using Ollama
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context}
            ]
            
            # Add conversation history for context
            for msg in conversation.conversation_history[-6:]:  # Last 6 messages for context
                role = "user" if msg["speaker"] == "customer" else "assistant"
                messages.append({"role": role, "content": msg["text"]})
            
            response = await self.ollama_client.chat_completion(
                messages=messages,
                model=self.language_models[conversation.language.value]["model"],
                temperature=0.7,
                max_tokens=200
            )
            
            response_text = response["choices"][0]["message"]["content"]
            
            # Post-process response for banking context
            response_text = self._post_process_response(response_text, conversation, entities)
            
            return response_text
            
        except Exception as e:
            self.logger.error(f"Error generating response: {e}")
            return self._get_fallback_response(conversation, intent)
    
    def _build_conversation_context(self, conversation: ConversationContext, 
                                   intent: str, entities: Dict[str, Any]) -> str:
        """Build context string for AI model"""
        context_parts = [
            f"Customer: {conversation.customer_context.name}",
            f"Phone: {conversation.customer_context.phone_number}",
            f"Account Status: {conversation.customer_context.account_status}",
            f"Current State: {conversation.current_state.value}",
            f"Customer Intent: {intent}",
            f"Language: {conversation.language.value}",
        ]
        
        if conversation.issue_type:
            context_parts.append(f"Issue Type: {conversation.issue_type.value}")
        
        if entities:
            context_parts.append(f"Extracted Entities: {json.dumps(entities)}")
        
        if conversation.customer_context.verification_status != "verified":
            context_parts.append("Customer identity not yet verified - require verification before discussing account details")
        
        return "\n".join(context_parts)
    
    def _post_process_response(self, response: str, conversation: ConversationContext, 
                              entities: Dict[str, Any]) -> str:
        """Post-process AI response for banking context"""
        # Replace placeholders with actual values
        replacements = {
            "{customer_name}": conversation.customer_context.name or "valued customer",
            "{bank_name}": "First Bank of Nigeria",
            "{time_of_day}": self._get_time_of_day(),
            "{amount}": entities.get("amount", "the specified amount"),
            "{location}": entities.get("location", "the mentioned location"),
            "{date}": entities.get("date", "the specified date")
        }
        
        for placeholder, value in replacements.items():
            response = response.replace(placeholder, value)
        
        return response
    
    def _get_time_of_day(self) -> str:
        """Get appropriate greeting based on time of day"""
        hour = datetime.now().hour
        if hour < 12:
            return "morning"
        elif hour < 17:
            return "afternoon"
        else:
            return "evening"
    
    def _get_fallback_response(self, conversation: ConversationContext, intent: str) -> str:
        """Get fallback response when AI generation fails"""
        fallback_responses = {
            Language.ENGLISH.value: "I apologize, but I'm having difficulty processing your request right now. Let me connect you with one of our human agents who can better assist you.",
            Language.HAUSA.value: "Na yi hakuri, amma ina da matsala wajen sarrafa bukatarku a yanzu. Bari in hadar da ku da daya daga cikin wakilanmu na mutane wanda zai iya taimaka muku sosai.",
            Language.YORUBA.value: "Mo toro gafara, sugbon mo n ni isoro lati se ibeere yin ni bayi. Jeki n so yin po pelu ọkan ninu awon asoju wa ti eniyan ti o le ran yin lowo daradara.",
            Language.IGBO.value: "Ana m arịọ mgbaghara, mana enwere m nsogbu ịhazi arịrịọ gị ugbu a. Ka m jikọọ gị na otu n'ime ndị nnọchite anya anyị mmadụ nke nwere ike inyere gị aka nke ọma.",
            Language.PIDGIN.value: "I sorry, but I dey get problem to process your request now. Make I connect you with one of our human agents wey go fit help you better."
        }
        
        return fallback_responses.get(conversation.language.value, fallback_responses[Language.ENGLISH.value])
    
    async def _update_conversation_state(self, conversation: ConversationContext, 
                                        intent: str, entities: Dict[str, Any]):
        """Update conversation state based on intent and entities"""
        current_state = conversation.current_state
        
        # State transition logic
        if current_state == ConversationState.GREETING:
            if intent == "identity_verification" or "verification_info" in entities:
                conversation.current_state = ConversationState.IDENTIFICATION
            elif intent == "issue_reporting":
                conversation.current_state = ConversationState.ISSUE_ASSESSMENT
        
        elif current_state == ConversationState.IDENTIFICATION:
            if self._is_identity_verified(conversation, entities):
                conversation.customer_context.verification_status = "verified"
                if conversation.issue_type:
                    conversation.current_state = ConversationState.RESOLUTION
                else:
                    conversation.current_state = ConversationState.ISSUE_ASSESSMENT
        
        elif current_state == ConversationState.ISSUE_ASSESSMENT:
            if intent == "issue_reporting" and entities.get("issue_type"):
                conversation.issue_type = IssueType(entities["issue_type"])
                conversation.current_state = ConversationState.RESOLUTION
        
        elif current_state == ConversationState.RESOLUTION:
            if intent == "escalation_request" or entities.get("urgency_level") == "critical":
                conversation.current_state = ConversationState.ESCALATION
            elif intent == "confirmation" and conversation.resolution_status == ResolutionStatus.RESOLVED:
                conversation.current_state = ConversationState.CLOSING
        
        elif current_state == ConversationState.CLOSING:
            if intent == "closing":
                conversation.current_state = ConversationState.COMPLETED
    
    def _is_identity_verified(self, conversation: ConversationContext, entities: Dict[str, Any]) -> bool:
        """Check if customer identity is sufficiently verified"""
        verification_score = 0
        
        # Check if customer provided verification information
        if entities.get("verification_info"):
            verification_score += 1
        
        # Check if customer answered security questions correctly
        if conversation.customer_context.security_questions_passed >= 2:
            verification_score += 2
        
        # Check if customer provided correct personal information
        if entities.get("date") or entities.get("account_number"):
            verification_score += 1
        
        return verification_score >= 2
    
    async def _check_escalation_criteria(self, conversation: ConversationContext, 
                                        intent: str, entities: Dict[str, Any]) -> bool:
        """Check if conversation should be escalated to human agent"""
        escalation_reasons = []
        
        # Customer explicitly requests human agent
        if intent == "escalation_request":
            escalation_reasons.append("customer_request")
        
        # High urgency or critical issues
        if entities.get("urgency_level") == "critical":
            escalation_reasons.append("critical_urgency")
        
        # Customer is very frustrated or angry
        if entities.get("emotion") in ["angry", "very_frustrated"]:
            escalation_reasons.append("customer_emotion")
        
        # Complex issues that require human intervention
        if conversation.issue_type in [IssueType.FRAUD_REPORT]:
            escalation_reasons.append("complex_issue")
        
        # Conversation has been going on too long
        if len(conversation.conversation_history) > 20:
            escalation_reasons.append("long_conversation")
        
        # AI confidence is low
        if conversation.confidence_scores.get("overall", 1.0) < 0.5:
            escalation_reasons.append("low_confidence")
        
        if escalation_reasons:
            conversation.escalation_reasons.extend(escalation_reasons)
            return True
        
        return False
    
    async def _generate_clarification_response(self, conversation: ConversationContext) -> bytes:
        """Generate audio response asking for clarification"""
        clarification_messages = {
            Language.ENGLISH.value: "I'm sorry, I didn't catch that. Could you please repeat what you said?",
            Language.HAUSA.value: "Yi hakuri, ban ji ba. Za ku iya sake faɗin abin da kuka faɗa?",
            Language.YORUBA.value: "Ma binu, mi o gbo. Se e le tun so ohun ti e so?",
            Language.IGBO.value: "Ndo, anụghị m nke ahụ. Ị nwere ike ikwughachi ihe ị kwuru?",
            Language.PIDGIN.value: "Sorry, I no hear am well. You fit talk am again?"
        }
        
        message = clarification_messages.get(conversation.language.value, clarification_messages[Language.ENGLISH.value])
        return await self._text_to_speech(message, conversation.language)
    
    async def _generate_error_response(self, conversation: ConversationContext) -> bytes:
        """Generate audio response for errors"""
        error_messages = {
            Language.ENGLISH.value: "I apologize, but I'm experiencing some technical difficulties. Let me connect you with one of our human agents.",
            Language.HAUSA.value: "Na yi hakuri, amma ina fuskantar matsalolin fasaha. Bari in hadar da ku da daya daga cikin wakilanmu na mutane.",
            Language.YORUBA.value: "Mo toro gafara, sugbon mo n ni awon isoro imọ-ẹrọ. Jeki n so yin po pelu ọkan ninu awon asoju wa ti eniyan.",
            Language.IGBO.value: "Ana m arịọ mgbaghara, mana enwere m ụfọdụ nsogbu teknụzụ. Ka m jikọọ gị na otu n'ime ndị nnọchite anya anyị mmadụ.",
            Language.PIDGIN.value: "I sorry, but I dey get some technical problem. Make I connect you with one of our human agents."
        }
        
        message = error_messages.get(conversation.language.value, error_messages[Language.ENGLISH.value])
        return await self._text_to_speech(message, conversation.language)
    
    def _serialize_conversation(self, conversation: ConversationContext) -> Dict[str, Any]:
        """Serialize conversation context for storage"""
        return {
            "conversation_id": conversation.conversation_id,
            "call_id": conversation.call_id,
            "customer_context": conversation.customer_context.__dict__,
            "current_state": conversation.current_state.value,
            "issue_type": conversation.issue_type.value if conversation.issue_type else None,
            "resolution_status": conversation.resolution_status.value,
            "language": conversation.language.value,
            "conversation_history": conversation.conversation_history,
            "extracted_entities": conversation.extracted_entities,
            "confidence_scores": conversation.confidence_scores,
            "escalation_reasons": conversation.escalation_reasons,
            "resolution_actions": conversation.resolution_actions,
            "start_time": conversation.start_time.isoformat(),
            "last_activity": conversation.last_activity.isoformat()
        }
    
    async def get_conversation_summary(self, conversation_id: str) -> Dict[str, Any]:
        """Get conversation summary for reporting"""
        if conversation_id not in self.active_conversations:
            # Try to get from Redis
            cached_data = await self.redis_client.get(f"conversation:{conversation_id}")
            if not cached_data:
                raise ValueError(f"Conversation {conversation_id} not found")
            
            conversation_data = json.loads(cached_data)
        else:
            conversation = self.active_conversations[conversation_id]
            conversation_data = self._serialize_conversation(conversation)
        
        # Generate summary
        summary = {
            "conversation_id": conversation_data["conversation_id"],
            "call_id": conversation_data["call_id"],
            "customer_name": conversation_data["customer_context"]["name"],
            "language": conversation_data["language"],
            "issue_type": conversation_data["issue_type"],
            "resolution_status": conversation_data["resolution_status"],
            "duration_minutes": self._calculate_conversation_duration(conversation_data),
            "message_count": len(conversation_data["conversation_history"]),
            "escalated": len(conversation_data["escalation_reasons"]) > 0,
            "escalation_reasons": conversation_data["escalation_reasons"],
            "key_entities": conversation_data["extracted_entities"],
            "resolution_actions": conversation_data["resolution_actions"]
        }
        
        return summary
    
    def _calculate_conversation_duration(self, conversation_data: Dict[str, Any]) -> float:
        """Calculate conversation duration in minutes"""
        start_time = datetime.fromisoformat(conversation_data["start_time"])
        last_activity = datetime.fromisoformat(conversation_data["last_activity"])
        duration = (last_activity - start_time).total_seconds() / 60
        return round(duration, 2)
    
    async def end_conversation(self, conversation_id: str, resolution_status: str = None) -> Dict[str, Any]:
        """End conversation and generate final summary"""
        if conversation_id not in self.active_conversations:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        conversation = self.active_conversations[conversation_id]
        
        # Update final status
        if resolution_status:
            conversation.resolution_status = ResolutionStatus(resolution_status)
        
        conversation.current_state = ConversationState.COMPLETED
        
        # Generate final summary
        summary = await self.get_conversation_summary(conversation_id)
        
        # Store final conversation data
        await self.redis_client.setex(
            f"conversation_final:{conversation_id}",
            86400,  # 24 hours TTL
            json.dumps(self._serialize_conversation(conversation))
        )
        
        # Remove from active conversations
        del self.active_conversations[conversation_id]
        
        self.logger.info(f"Ended conversation {conversation_id} with status {conversation.resolution_status.value}")
        
        return summary
    
    async def get_active_conversations(self) -> List[Dict[str, Any]]:
        """Get list of active conversations"""
        active_list = []
        
        for conversation_id, conversation in self.active_conversations.items():
            active_list.append({
                "conversation_id": conversation_id,
                "call_id": conversation.call_id,
                "customer_name": conversation.customer_context.name,
                "language": conversation.language.value,
                "current_state": conversation.current_state.value,
                "duration_minutes": (datetime.now() - conversation.start_time).total_seconds() / 60,
                "last_activity": conversation.last_activity.isoformat()
            })
        
        return active_list

# Example usage and testing
async def main():
    """Main function for testing the AI Agent Engine"""
    engine = AIAgentEngine()
    await engine.initialize()
    
    # Start a test conversation
    conversation = await engine.start_conversation(
        call_id="test-call-123",
        customer_phone="+2348012345678",
        language=Language.ENGLISH.value,
        issue_type=IssueType.BLOCKED_ACCOUNT.value
    )
    
    print(f"Started conversation: {conversation.conversation_id}")
    
    # Simulate customer inputs
    test_inputs = [
        "Hello, my account has been blocked",
        "My name is John Doe and my phone number is 08012345678",
        "My date of birth is January 15, 1985 and my BVN ends with 1234",
        "I tried to make a transfer yesterday but it was declined",
        "Yes, I made that transaction at the ATM in Victoria Island",
        "Thank you for your help"
    ]
    
    for i, text_input in enumerate(test_inputs):
        print(f"\nCustomer: {text_input}")
        
        response = await engine.process_text_input(conversation.conversation_id, text_input)
        
        if response["success"]:
            print(f"Agent: {response['response_text']}")
            print(f"State: {response['conversation_state']}")
            if response["escalation_needed"]:
                print("*** ESCALATION NEEDED ***")
        else:
            print(f"Error: {response['error']}")
    
    # Get conversation summary
    summary = await engine.get_conversation_summary(conversation.conversation_id)
    print(f"\nConversation Summary: {json.dumps(summary, indent=2)}")
    
    # End conversation
    final_summary = await engine.end_conversation(conversation.conversation_id, "resolved")
    print(f"\nFinal Summary: {json.dumps(final_summary, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())

