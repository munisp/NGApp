"""
EPR-KGQA service for knowledge graph question answering.
"""

import logging
import json
import aiohttp
import asyncio
from typing import Dict, List, Optional, Any, Union, Tuple
from datetime import datetime
from uuid import UUID, uuid4

from ..config.config import config
from ..models.base_models import (
    KnowledgeGraphQuestion, KnowledgeGraphAnswer,
    LanguageCode
)

logger = logging.getLogger(__name__)

class EPRKGQAService:
    """Service for knowledge graph question answering."""
    
    def __init__(self):
        """Initialize the EPR-KGQA service."""
        self.host = config.eprkgqa.host
        self.port = config.eprkgqa.port
        self.api_key = config.eprkgqa.api_key
        self.api_base = config.eprkgqa.api_base
        self.session = None
    
    async def connect(self):
        """Connect to the EPR-KGQA service."""
        try:
            # Create session
            self.session = aiohttp.ClientSession()
            
            # Test connection
            async with self.session.get(f"{self.api_base}/health") as response:
                if response.status != 200:
                    logger.error(f"Failed to connect to EPR-KGQA service: {response.status}")
                    return False
                
                logger.info(f"Connected to EPR-KGQA service at {self.api_base}")
                return True
        except Exception as e:
            logger.error(f"Failed to connect to EPR-KGQA service: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from the EPR-KGQA service."""
        if self.session:
            await self.session.close()
            logger.info("Disconnected from EPR-KGQA service")
    
    async def ask_question(self, question: KnowledgeGraphQuestion) -> KnowledgeGraphAnswer:
        """
        Ask a question to the knowledge graph.
        
        Args:
            question: Knowledge graph question
            
        Returns:
            Knowledge graph answer
        """
        if not self.session:
            await self.connect()
        
        try:
            # Prepare request
            url = f"{self.api_base}/api/v1/question"
            headers = {
                "Content-Type": "application/json"
            }
            
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            
            # Convert question to dictionary
            question_dict = question.dict()
            
            # Start timer
            start_time = datetime.utcnow()
            
            # Send request
            async with self.session.post(url, json=question_dict, headers=headers) as response:
                # Calculate execution time
                end_time = datetime.utcnow()
                execution_time = (end_time - start_time).total_seconds()
                
                # Check response
                if response.status != 200:
                    logger.error(f"Failed to ask question: {response.status}")
                    
                    # Create error answer
                    answer = KnowledgeGraphAnswer(
                        question_id=question.question_id,
                        answer_text=f"Error: {response.status}",
                        confidence=0.0,
                        supporting_facts=[],
                        execution_time=execution_time,
                        metadata={
                            "error": True,
                            "status_code": response.status,
                            "question_text": question.question_text
                        }
                    )
                    
                    return answer
                
                # Parse response
                response_data = await response.json()
                
                # Create answer
                answer = KnowledgeGraphAnswer(
                    question_id=question.question_id,
                    answer_text=response_data.get("answer", ""),
                    confidence=response_data.get("confidence", 0.0),
                    supporting_facts=response_data.get("supporting_facts", []),
                    execution_time=execution_time,
                    metadata=response_data.get("metadata", {})
                )
                
                return answer
        except Exception as e:
            logger.error(f"Failed to ask question: {e}")
            
            # Calculate execution time
            end_time = datetime.utcnow()
            execution_time = (end_time - start_time).total_seconds()
            
            # Create error answer
            answer = KnowledgeGraphAnswer(
                question_id=question.question_id,
                answer_text=f"Error: {str(e)}",
                confidence=0.0,
                supporting_facts=[],
                execution_time=execution_time,
                metadata={
                    "error": True,
                    "exception": str(e),
                    "question_text": question.question_text
                }
            )
            
            return answer
    
    async def ask_banking_question(self, question_text: str, language: LanguageCode = LanguageCode.ENGLISH, context: Optional[Dict[str, Any]] = None) -> KnowledgeGraphAnswer:
        """
        Ask a banking-related question to the knowledge graph.
        
        Args:
            question_text: Question text
            language: Language code
            context: Optional context information
            
        Returns:
            Knowledge graph answer
        """
        # Create question
        question = KnowledgeGraphQuestion(
            question_id=str(uuid4()),
            question_text=question_text,
            language=language,
            context=context or {},
            metadata={
                "domain": "banking",
                "source": "banking_crm_integration"
            }
        )
        
        # Ask question
        answer = await self.ask_question(question)
        
        return answer
    
    async def ask_customer_question(self, question_text: str, customer_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Ask a customer-related question to the knowledge graph.
        
        Args:
            question_text: Question text
            customer_id: Customer ID
            language: Language code
            
        Returns:
            Knowledge graph answer
        """
        # Create context
        context = {
            "customer_id": customer_id,
            "entity_type": "customer"
        }
        
        # Create question
        question = KnowledgeGraphQuestion(
            question_id=str(uuid4()),
            question_text=question_text,
            language=language,
            context=context,
            metadata={
                "domain": "banking",
                "source": "banking_crm_integration",
                "entity_type": "customer",
                "customer_id": customer_id
            }
        )
        
        # Ask question
        answer = await self.ask_question(question)
        
        return answer
    
    async def ask_transaction_question(self, question_text: str, transaction_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Ask a transaction-related question to the knowledge graph.
        
        Args:
            question_text: Question text
            transaction_id: Transaction ID
            language: Language code
            
        Returns:
            Knowledge graph answer
        """
        # Create context
        context = {
            "transaction_id": transaction_id,
            "entity_type": "transaction"
        }
        
        # Create question
        question = KnowledgeGraphQuestion(
            question_id=str(uuid4()),
            question_text=question_text,
            language=language,
            context=context,
            metadata={
                "domain": "banking",
                "source": "banking_crm_integration",
                "entity_type": "transaction",
                "transaction_id": transaction_id
            }
        )
        
        # Ask question
        answer = await self.ask_question(question)
        
        return answer
    
    async def ask_fraud_question(self, question_text: str, alert_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Ask a fraud-related question to the knowledge graph.
        
        Args:
            question_text: Question text
            alert_id: Fraud alert ID
            language: Language code
            
        Returns:
            Knowledge graph answer
        """
        # Create context
        context = {
            "alert_id": alert_id,
            "entity_type": "fraud_alert"
        }
        
        # Create question
        question = KnowledgeGraphQuestion(
            question_id=str(uuid4()),
            question_text=question_text,
            language=language,
            context=context,
            metadata={
                "domain": "banking",
                "source": "banking_crm_integration",
                "entity_type": "fraud_alert",
                "alert_id": alert_id
            }
        )
        
        # Ask question
        answer = await self.ask_question(question)
        
        return answer
    
    async def get_customer_insights(self, customer_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Get insights for a customer.
        
        Args:
            customer_id: Customer ID
            language: Language code
            
        Returns:
            Knowledge graph answer with customer insights
        """
        # Create question text based on language
        if language == LanguageCode.ENGLISH:
            question_text = f"What are the key insights for customer {customer_id}?"
        elif language == LanguageCode.HAUSA:
            question_text = f"Menene muhimman bayanai game da abokin ciniki {customer_id}?"
        elif language == LanguageCode.YORUBA:
            question_text = f"Kini awọn imọran pataki fun onibara {customer_id}?"
        elif language == LanguageCode.IGBO:
            question_text = f"Gịnị bụ isi echiche maka onye ahịa {customer_id}?"
        elif language == LanguageCode.PIDGIN:
            question_text = f"Wetin be di important tins wey we know about customer {customer_id}?"
        else:
            question_text = f"What are the key insights for customer {customer_id}?"
        
        # Ask customer question
        answer = await self.ask_customer_question(question_text, customer_id, language)
        
        return answer
    
    async def get_fraud_risk_assessment(self, transaction_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Get fraud risk assessment for a transaction.
        
        Args:
            transaction_id: Transaction ID
            language: Language code
            
        Returns:
            Knowledge graph answer with fraud risk assessment
        """
        # Create question text based on language
        if language == LanguageCode.ENGLISH:
            question_text = f"What is the fraud risk assessment for transaction {transaction_id}?"
        elif language == LanguageCode.HAUSA:
            question_text = f"Menene nazarin haɗarin zamba don ma'amala {transaction_id}?"
        elif language == LanguageCode.YORUBA:
            question_text = f"Kini ìṣiro ewu ẹtan fun iṣowo {transaction_id}?"
        elif language == LanguageCode.IGBO:
            question_text = f"Gịnị bụ nyocha ihe ize ndụ aghụghọ maka azụmahịa {transaction_id}?"
        elif language == LanguageCode.PIDGIN:
            question_text = f"Wetin be di fraud risk assessment for transaction {transaction_id}?"
        else:
            question_text = f"What is the fraud risk assessment for transaction {transaction_id}?"
        
        # Ask transaction question
        answer = await self.ask_transaction_question(question_text, transaction_id, language)
        
        return answer
    
    async def get_next_best_action(self, customer_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Get next best action for a customer.
        
        Args:
            customer_id: Customer ID
            language: Language code
            
        Returns:
            Knowledge graph answer with next best action
        """
        # Create question text based on language
        if language == LanguageCode.ENGLISH:
            question_text = f"What is the next best action for customer {customer_id}?"
        elif language == LanguageCode.HAUSA:
            question_text = f"Menene mafi kyau na gaba don abokin ciniki {customer_id}?"
        elif language == LanguageCode.YORUBA:
            question_text = f"Kini igbese ti o dara julọ fun onibara {customer_id}?"
        elif language == LanguageCode.IGBO:
            question_text = f"Gịnị bụ omume kachasị mma maka onye ahịa {customer_id}?"
        elif language == LanguageCode.PIDGIN:
            question_text = f"Wetin be di next best action for customer {customer_id}?"
        else:
            question_text = f"What is the next best action for customer {customer_id}?"
        
        # Ask customer question
        answer = await self.ask_customer_question(question_text, customer_id, language)
        
        return answer
    
    async def get_fraud_investigation_summary(self, alert_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Get fraud investigation summary for an alert.
        
        Args:
            alert_id: Fraud alert ID
            language: Language code
            
        Returns:
            Knowledge graph answer with fraud investigation summary
        """
        # Create question text based on language
        if language == LanguageCode.ENGLISH:
            question_text = f"What is the investigation summary for fraud alert {alert_id}?"
        elif language == LanguageCode.HAUSA:
            question_text = f"Menene taƙaitaccen bayani game da binciken zamba {alert_id}?"
        elif language == LanguageCode.YORUBA:
            question_text = f"Kini ìsọníṣókí ìwádìí fun ìkìlọ̀ ẹtan {alert_id}?"
        elif language == LanguageCode.IGBO:
            question_text = f"Gịnị bụ nchịkọta nyocha maka ịdọ aka ná ntị aghụghọ {alert_id}?"
        elif language == LanguageCode.PIDGIN:
            question_text = f"Wetin be di investigation summary for fraud alert {alert_id}?"
        else:
            question_text = f"What is the investigation summary for fraud alert {alert_id}?"
        
        # Ask fraud question
        answer = await self.ask_fraud_question(question_text, alert_id, language)
        
        return answer
    
    async def get_customer_product_recommendations(self, customer_id: str, language: LanguageCode = LanguageCode.ENGLISH) -> KnowledgeGraphAnswer:
        """
        Get product recommendations for a customer.
        
        Args:
            customer_id: Customer ID
            language: Language code
            
        Returns:
            Knowledge graph answer with product recommendations
        """
        # Create question text based on language
        if language == LanguageCode.ENGLISH:
            question_text = f"What products should be recommended to customer {customer_id}?"
        elif language == LanguageCode.HAUSA:
            question_text = f"Wanne kayayyaki ya kamata a ba da shawarar abokin ciniki {customer_id}?"
        elif language == LanguageCode.YORUBA:
            question_text = f"Awọn ọjà wo ni a gbọdọ ṣe ìdámọ̀ràn fún onibara {customer_id}?"
        elif language == LanguageCode.IGBO:
            question_text = f"Kedu ngwugwu kwesịrị ịtụ aro nye onye ahịa {customer_id}?"
        elif language == LanguageCode.PIDGIN:
            question_text = f"Wetin be di products wey we suppose recommend give customer {customer_id}?"
        else:
            question_text = f"What products should be recommended to customer {customer_id}?"
        
        # Ask customer question
        answer = await self.ask_customer_question(question_text, customer_id, language)
        
        return answer

