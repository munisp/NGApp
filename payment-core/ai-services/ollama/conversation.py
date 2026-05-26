#!/usr/bin/env python3
"""
Conversation Manager for AI Telephony Service
"""

import os
import json
import time
import logging
import asyncio
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
import uuid

from .ollama_client import OllamaClient
from .models import ConversationState

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("conversation_manager")

class ConversationManager:
    """Manager for AI telephony conversations"""
    
    def __init__(self, ollama_client: OllamaClient, db_pool, redis_client):
        """Initialize the conversation manager"""
        self.ollama_client = ollama_client
        self.db_pool = db_pool
        self.redis_client = redis_client
        
        # Language-specific models
        self.language_models = {
            "english": "llama3",
            "hausa": "llama3",  # Ideally would use a Hausa-tuned model
            "yoruba": "llama3",  # Ideally would use a Yoruba-tuned model
            "igbo": "llama3",    # Ideally would use an Igbo-tuned model
            "pidgin": "llama3"   # Ideally would use a Nigerian Pidgin-tuned model
        }
        
        # Conversation templates
        self.templates = {
            "fraud_verification": {
                "english": self._load_template("fraud_verification_english.json"),
                "hausa": self._load_template("fraud_verification_hausa.json"),
                "yoruba": self._load_template("fraud_verification_yoruba.json"),
                "igbo": self._load_template("fraud_verification_igbo.json"),
                "pidgin": self._load_template("fraud_verification_pidgin.json")
            },
            "product_promotion": {
                "english": self._load_template("product_promotion_english.json"),
                "hausa": self._load_template("product_promotion_hausa.json"),
                "yoruba": self._load_template("product_promotion_yoruba.json"),
                "igbo": self._load_template("product_promotion_igbo.json"),
                "pidgin": self._load_template("product_promotion_pidgin.json")
            },
            "blocked_account": {
                "english": self._load_template("blocked_account_english.json"),
                "hausa": self._load_template("blocked_account_hausa.json"),
                "yoruba": self._load_template("blocked_account_yoruba.json"),
                "igbo": self._load_template("blocked_account_igbo.json"),
                "pidgin": self._load_template("blocked_account_pidgin.json")
            }
        }
    
    def _load_template(self, filename: str) -> Dict[str, Any]:
        """Load a conversation template from file"""
        try:
            template_path = os.path.join(
                os.path.dirname(__file__), 
                "templates", 
                filename
            )
            
            if os.path.exists(template_path):
                with open(template_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            else:
                # Return a default template if file doesn't exist
                return {
                    "system_prompt": "You are an AI banking assistant helping with customer verification.",
                    "greeting": "Hello, this is [BANK_NAME] security verification. We've detected unusual activity on your account.",
                    "verification_questions": [
                        "Can you confirm your full name?",
                        "Did you recently make a transaction of [AMOUNT] at [MERCHANT]?",
                        "Can you verify the last 4 digits of your account number?"
                    ],
                    "confirmation_message": "Thank you for confirming this information.",
                    "fraud_response": "We'll block this transaction and secure your account immediately.",
                    "legitimate_response": "Thank you for confirming this transaction. Your account is secure.",
                    "farewell": "Thank you for your time. Have a great day."
                }
        except Exception as e:
            logger.error(f"Failed to load template {filename}: {e}")
            # Return a minimal default template
            return {
                "system_prompt": "You are an AI banking assistant helping with customer verification.",
                "greeting": "Hello, this is the bank security verification."
            }
    
    async def create_conversation(self, conversation_id: str, context: Dict[str, Any]) -> str:
        """Create a new conversation"""
        # Determine conversation type based on context
        if "fraud_case_id" in context:
            conversation_type = "fraud_verification"
        elif "product_id" in context:
            conversation_type = "product_promotion"
        elif "blocked_account" in context:
            conversation_type = "blocked_account"
        else:
            conversation_type = "general"
        
        # Get language
        language = context.get("language", "english").lower()
        if language not in self.language_models:
            logger.warning(f"Language {language} not supported, falling back to English")
            language = "english"
        
        # Get template
        template = self.templates.get(conversation_type, {}).get(language, {})
        if not template:
            logger.warning(f"Template not found for {conversation_type} in {language}")
            # Use English template as fallback
            template = self.templates.get(conversation_type, {}).get("english", {})
        
        # Create conversation state
        conversation_state = {
            "id": conversation_id,
            "type": conversation_type,
            "language": language,
            "context": context,
            "messages": [],
            "current_step": "greeting",
            "verification_result": None,
            "entities": {},
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # Add system message
        system_prompt = template.get("system_prompt", "You are an AI banking assistant.")
        conversation_state["messages"].append({
            "role": "system",
            "content": self._fill_template(system_prompt, context)
        })
        
        # Store conversation state in Redis
        await self.redis_client.set(
            f"conversation:{conversation_id}",
            json.dumps(conversation_state),
            ex=86400  # Expire after 24 hours
        )
        
        # Store in database for persistence
        await self._store_conversation_in_db(conversation_state)
        
        return conversation_id
    
    async def start_conversation(self, conversation_id: str) -> None:
        """Start a conversation"""
        # Get conversation state
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            return
        
        # Get template
        template = self.templates.get(conversation["type"], {}).get(conversation["language"], {})
        if not template:
            logger.warning(f"Template not found for {conversation['type']} in {conversation['language']}")
            return
        
        # Send greeting
        greeting = template.get("greeting", "Hello, this is the bank calling.")
        greeting = self._fill_template(greeting, conversation["context"])
        
        # Add greeting to messages
        conversation["messages"].append({
            "role": "assistant",
            "content": greeting
        })
        
        # Update conversation state
        conversation["current_step"] = "verification"
        conversation["updated_at"] = datetime.now().isoformat()
        
        # Store updated conversation
        await self.redis_client.set(
            f"conversation:{conversation_id}",
            json.dumps(conversation),
            ex=86400  # Expire after 24 hours
        )
        
        # Update database
        await self._update_conversation_in_db(conversation)
        
        # Process next step
        await self._process_next_step(conversation)
    
    async def process_user_input(self, conversation_id: str, user_input: str) -> Dict[str, Any]:
        """Process user input in a conversation"""
        # Get conversation state
        conversation = await self.get_conversation(conversation_id)
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            return {"error": "Conversation not found"}
        
        # Add user message
        conversation["messages"].append({
            "role": "user",
            "content": user_input
        })
        
        # Extract entities from user input
        entities = await self._extract_entities(user_input, conversation)
        for entity, value in entities.items():
            conversation["entities"][entity] = value
        
        # Determine intent
        intent = await self._classify_intent(user_input, conversation)
        
        # Update conversation state based on intent
        if intent == "confirm_fraud":
            conversation["verification_result"] = "confirmed_fraud"
            conversation["current_step"] = "fraud_response"
        elif intent == "confirm_legitimate":
            conversation["verification_result"] = "confirmed_legitimate"
            conversation["current_step"] = "legitimate_response"
        elif intent == "need_more_info":
            conversation["current_step"] = "verification"
        elif intent == "end_conversation":
            conversation["current_step"] = "farewell"
        else:
            # Continue with current step
            pass
        
        # Update timestamp
        conversation["updated_at"] = datetime.now().isoformat()
        
        # Store updated conversation
        await self.redis_client.set(
            f"conversation:{conversation_id}",
            json.dumps(conversation),
            ex=86400  # Expire after 24 hours
        )
        
        # Update database
        await self._update_conversation_in_db(conversation)
        
        # Process next step
        response = await self._process_next_step(conversation)
        
        return response
    
    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation state"""
        # Try to get from Redis first
        conversation_json = await self.redis_client.get(f"conversation:{conversation_id}")
        if conversation_json:
            return json.loads(conversation_json)
        
        # If not in Redis, try to get from database
        async with self.db_pool.cursor() as cursor:
            await cursor.execute(
                """
                SELECT state FROM conversations WHERE id = %s
                """,
                (conversation_id,)
            )
            result = await cursor.fetchone()
            if result:
                conversation = result[0]
                
                # Store in Redis for future access
                await self.redis_client.set(
                    f"conversation:{conversation_id}",
                    json.dumps(conversation),
                    ex=86400  # Expire after 24 hours
                )
                
                return conversation
        
        return None
    
    async def _process_next_step(self, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Process the next step in the conversation"""
        # Get template
        template = self.templates.get(conversation["type"], {}).get(conversation["language"], {})
        if not template:
            logger.warning(f"Template not found for {conversation['type']} in {conversation['language']}")
            return {"error": "Template not found"}
        
        # Get current step
        current_step = conversation["current_step"]
        
        # Generate response based on current step
        if current_step == "greeting":
            # Already handled in start_conversation
            pass
        elif current_step == "verification":
            # Get verification questions
            questions = template.get("verification_questions", [])
            if not questions:
                # No predefined questions, generate dynamically
                response = await self._generate_response(conversation)
            else:
                # Use predefined questions
                question_index = len([m for m in conversation["messages"] if m["role"] == "assistant"]) - 1
                if question_index < len(questions):
                    question = questions[question_index]
                    response = self._fill_template(question, conversation["context"])
                else:
                    # All questions asked, move to confirmation
                    conversation["current_step"] = "confirmation"
                    response = self._fill_template(
                        template.get("confirmation_message", "Thank you for confirming this information."),
                        conversation["context"]
                    )
        elif current_step == "confirmation":
            # Analyze conversation to determine verification result
            if conversation["verification_result"] is None:
                verification_result = await self._determine_verification_result(conversation)
                conversation["verification_result"] = verification_result
            
            # Move to appropriate response
            if conversation["verification_result"] == "confirmed_fraud":
                conversation["current_step"] = "fraud_response"
                response = self._fill_template(
                    template.get("fraud_response", "We'll block this transaction and secure your account immediately."),
                    conversation["context"]
                )
            elif conversation["verification_result"] == "confirmed_legitimate":
                conversation["current_step"] = "legitimate_response"
                response = self._fill_template(
                    template.get("legitimate_response", "Thank you for confirming this transaction. Your account is secure."),
                    conversation["context"]
                )
            else:
                # Inconclusive, ask more questions
                conversation["current_step"] = "verification"
                response = await self._generate_response(conversation)
        elif current_step == "fraud_response":
            # Move to farewell
            conversation["current_step"] = "farewell"
            response = self._fill_template(
                template.get("farewell", "Thank you for your time. Have a great day."),
                conversation["context"]
            )
        elif current_step == "legitimate_response":
            # Move to farewell
            conversation["current_step"] = "farewell"
            response = self._fill_template(
                template.get("farewell", "Thank you for your time. Have a great day."),
                conversation["context"]
            )
        elif current_step == "farewell":
            # End conversation
            conversation["current_step"] = "ended"
            response = None
        else:
            # Unknown step, generate response
            response = await self._generate_response(conversation)
        
        # Add response to messages if not None
        if response:
            conversation["messages"].append({
                "role": "assistant",
                "content": response
            })
        
        # Update timestamp
        conversation["updated_at"] = datetime.now().isoformat()
        
        # Store updated conversation
        await self.redis_client.set(
            f"conversation:{conversation['id']}",
            json.dumps(conversation),
            ex=86400  # Expire after 24 hours
        )
        
        # Update database
        await self._update_conversation_in_db(conversation)
        
        return {
            "conversation_id": conversation["id"],
            "response": response,
            "current_step": conversation["current_step"],
            "verification_result": conversation["verification_result"]
        }
    
    async def _generate_response(self, conversation: Dict[str, Any]) -> str:
        """Generate a response using the LLM"""
        # Get language-specific model
        language = conversation["language"]
        model = self.language_models.get(language, "llama3")
        
        # Get messages for context
        messages = conversation["messages"]
        
        # Generate response
        try:
            response = await self.ollama_client.chat_completion(
                messages=messages,
                model=model,
                temperature=0.7,
                max_tokens=256
            )
            
            return response["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"Failed to generate response: {e}")
            
            # Fallback response
            if conversation["type"] == "fraud_verification":
                return "Can you please confirm if you made this transaction?"
            elif conversation["type"] == "product_promotion":
                return "Would you be interested in learning more about our products?"
            elif conversation["type"] == "blocked_account":
                return "We need to verify your identity to unblock your account. Can you confirm your details?"
            else:
                return "How can I assist you today?"
    
    async def _extract_entities(self, text: str, conversation: Dict[str, Any]) -> Dict[str, Any]:
        """Extract entities from user input"""
        # Get language-specific model
        language = conversation["language"]
        model = self.language_models.get(language, "llama3")
        
        # Create prompt for entity extraction
        entity_prompt = f"""
        Extract the following entities from the text. Return a JSON object with the entities as keys and their values.
        Entities to extract:
        - name: The customer's full name
        - confirmation: Whether the customer confirms or denies the transaction (yes/no/unclear)
        - account_number: Any account number mentioned (last 4 digits)
        - additional_info: Any additional information provided
        
        Text: "{text}"
        
        JSON:
        """
        
        try:
            # Generate entity extraction
            response = await self.ollama_client.generate_completion(
                prompt=entity_prompt,
                model=model,
                temperature=0.3,
                max_tokens=256
            )
            
            # Parse JSON response
            content = response["choices"][0]["text"].strip()
            
            # Extract JSON part
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = content[json_start:json_end]
                try:
                    entities = json.loads(json_str)
                    return entities
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse entity JSON: {json_str}")
            
            # Fallback: empty entities
            return {}
        except Exception as e:
            logger.error(f"Failed to extract entities: {e}")
            return {}
    
    async def _classify_intent(self, text: str, conversation: Dict[str, Any]) -> str:
        """Classify user intent"""
        # Get language-specific model
        language = conversation["language"]
        model = self.language_models.get(language, "llama3")
        
        # Create prompt for intent classification
        intent_prompt = f"""
        Classify the intent of the following text. Return one of these intents:
        - confirm_fraud: The user confirms this is fraudulent activity
        - confirm_legitimate: The user confirms this is legitimate activity
        - need_more_info: The user needs more information or is uncertain
        - end_conversation: The user wants to end the conversation
        - other: Any other intent
        
        Text: "{text}"
        
        Intent:
        """
        
        try:
            # Generate intent classification
            response = await self.ollama_client.generate_completion(
                prompt=intent_prompt,
                model=model,
                temperature=0.3,
                max_tokens=32
            )
            
            # Parse response
            content = response["choices"][0]["text"].strip().lower()
            
            # Map to intent
            if "confirm_fraud" in content:
                return "confirm_fraud"
            elif "confirm_legitimate" in content:
                return "confirm_legitimate"
            elif "need_more_info" in content:
                return "need_more_info"
            elif "end_conversation" in content:
                return "end_conversation"
            else:
                return "other"
        except Exception as e:
            logger.error(f"Failed to classify intent: {e}")
            return "other"
    
    async def _determine_verification_result(self, conversation: Dict[str, Any]) -> str:
        """Determine verification result based on conversation"""
        # Get language-specific model
        language = conversation["language"]
        model = self.language_models.get(language, "llama3")
        
        # Create prompt for verification result
        verification_prompt = f"""
        Based on the following conversation between a bank representative and a customer about a potentially fraudulent transaction, determine if the transaction is:
        - confirmed_fraud: The customer confirms they did not make the transaction
        - confirmed_legitimate: The customer confirms they made the transaction
        - inconclusive: Cannot determine with confidence
        
        Conversation:
        {self._format_conversation_for_prompt(conversation)}
        
        Result:
        """
        
        try:
            # Generate verification result
            response = await self.ollama_client.generate_completion(
                prompt=verification_prompt,
                model=model,
                temperature=0.3,
                max_tokens=32
            )
            
            # Parse response
            content = response["choices"][0]["text"].strip().lower()
            
            # Map to result
            if "confirmed_fraud" in content:
                return "confirmed_fraud"
            elif "confirmed_legitimate" in content:
                return "confirmed_legitimate"
            else:
                return "inconclusive"
        except Exception as e:
            logger.error(f"Failed to determine verification result: {e}")
            return "inconclusive"
    
    def _format_conversation_for_prompt(self, conversation: Dict[str, Any]) -> str:
        """Format conversation for use in prompts"""
        formatted = ""
        for message in conversation["messages"]:
            if message["role"] == "system":
                continue
            
            role = "Bank" if message["role"] == "assistant" else "Customer"
            formatted += f"{role}: {message['content']}\n\n"
        
        return formatted
    
    def _fill_template(self, template: str, context: Dict[str, Any]) -> str:
        """Fill template with context values"""
        if not template:
            return ""
        
        result = template
        
        # Replace placeholders
        if "[BANK_NAME]" in result:
            result = result.replace("[BANK_NAME]", context.get("bank_name", "our bank"))
        
        if "[AMOUNT]" in result and "transaction" in context:
            amount = context["transaction"].get("amount", "")
            currency = context["transaction"].get("currency", "")
            result = result.replace("[AMOUNT]", f"{amount} {currency}")
        
        if "[MERCHANT]" in result and "transaction" in context:
            result = result.replace("[MERCHANT]", context["transaction"].get("merchant", "a merchant"))
        
        if "[LOCATION]" in result and "transaction" in context:
            result = result.replace("[LOCATION]", context["transaction"].get("location", "a location"))
        
        if "[DATE]" in result and "transaction" in context:
            date = context["transaction"].get("timestamp", "")
            if date:
                try:
                    date_obj = datetime.fromisoformat(date)
                    date_str = date_obj.strftime("%B %d, %Y")
                    result = result.replace("[DATE]", date_str)
                except:
                    result = result.replace("[DATE]", "recently")
            else:
                result = result.replace("[DATE]", "recently")
        
        if "[TIME]" in result and "transaction" in context:
            time_val = context["transaction"].get("timestamp", "")
            if time_val:
                try:
                    time_obj = datetime.fromisoformat(time_val)
                    time_str = time_obj.strftime("%I:%M %p")
                    result = result.replace("[TIME]", time_str)
                except:
                    result = result.replace("[TIME]", "recently")
            else:
                result = result.replace("[TIME]", "recently")
        
        if "[CUSTOMER_NAME]" in result and "customer" in context:
            result = result.replace("[CUSTOMER_NAME]", context["customer"].get("name", "valued customer"))
        
        return result
    
    async def _store_conversation_in_db(self, conversation: Dict[str, Any]) -> None:
        """Store conversation in database"""
        try:
            async with self.db_pool.cursor() as cursor:
                await cursor.execute(
                    """
                    INSERT INTO conversations (
                        id, type, language, state, created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE
                    SET state = EXCLUDED.state, updated_at = EXCLUDED.updated_at
                    """,
                    (
                        conversation["id"],
                        conversation["type"],
                        conversation["language"],
                        json.dumps(conversation),
                        datetime.fromisoformat(conversation["created_at"]),
                        datetime.fromisoformat(conversation["updated_at"])
                    )
                )
        except Exception as e:
            logger.error(f"Failed to store conversation in database: {e}")
    
    async def _update_conversation_in_db(self, conversation: Dict[str, Any]) -> None:
        """Update conversation in database"""
        try:
            async with self.db_pool.cursor() as cursor:
                await cursor.execute(
                    """
                    UPDATE conversations
                    SET state = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    (
                        json.dumps(conversation),
                        datetime.fromisoformat(conversation["updated_at"]),
                        conversation["id"]
                    )
                )
        except Exception as e:
            logger.error(f"Failed to update conversation in database: {e}")

# Example conversation templates
FRAUD_VERIFICATION_ENGLISH = {
    "system_prompt": "You are an AI banking assistant for [BANK_NAME]. Your task is to verify a potentially fraudulent transaction with the customer. Be polite, professional, and security-focused. Speak naturally but concisely. Your goal is to determine if the customer made the transaction or if it's fraudulent.",
    "greeting": "Hello, this is [BANK_NAME] security verification. We've detected unusual activity on your account. There was a transaction for [AMOUNT] at [MERCHANT] on [DATE] at [TIME]. I'm calling to verify if this was you.",
    "verification_questions": [
        "Could you please confirm your full name?",
        "Did you make a transaction of [AMOUNT] at [MERCHANT] on [DATE]?",
        "Can you verify the last 4 digits of your account number for security purposes?"
    ],
    "confirmation_message": "Thank you for confirming this information.",
    "fraud_response": "I understand this transaction wasn't authorized by you. I've immediately flagged this as fraudulent and blocked the transaction. Our security team will investigate this matter and prevent any unauthorized access to your account. We'll also issue a new card to you within 3-5 business days.",
    "legitimate_response": "Thank you for confirming this transaction. We appreciate your patience while we ensure the security of your account. Your account is secure and no further action is needed.",
    "farewell": "Thank you for your time today. If you have any questions or notice any other unusual activity, please don't hesitate to contact us. Have a great day!"
}

