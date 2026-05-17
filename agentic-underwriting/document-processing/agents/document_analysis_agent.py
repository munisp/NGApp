"""
Document Analysis Agent for Underwriting

This agent coordinates PaddleOCR, VLM, and Docling services to perform
comprehensive document analysis for insurance underwriting.
"""

import os
from typing import Dict, Any, List, Optional
import json
import asyncio
from datetime import datetime
from pathlib import Path

from langchain.agents import AgentExecutor, create_structured_chat_agent
from langchain.tools import Tool
from langchain_community.llms import Ollama
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferMemory

# Import our document processing services
import sys
sys.path.append(str(Path(__file__).parent.parent))

from ocr.paddle_ocr_service import PaddleOCRService
from vlm.vision_language_service import VisionLanguageService
from parsers.docling_service import DoclingService


class DocumentAnalysisAgent:
    """
    Agent that analyzes documents for insurance underwriting using
    multiple specialized services (OCR, VLM, Docling).
    """

    def __init__(
        self,
        llm_model: str = "qwen2.5:latest",
        ollama_base_url: str = "http://localhost:11434",
    ):
        """
        Initialize Document Analysis Agent.

        Args:
            llm_model: Ollama model for agent reasoning
            ollama_base_url: Base URL for Ollama API
        """
        # Initialize services
        self.ocr_service = PaddleOCRService(lang="en", use_gpu=False)
        self.vlm_service = VisionLanguageService(
            model="llava:latest", ollama_base_url=ollama_base_url
        )
        self.docling_service = DoclingService()

        # Initialize LLM
        self.llm = Ollama(
            model=llm_model,
            base_url=ollama_base_url,
            temperature=0.1,  # Low temperature for consistent analysis
        )

        # Create tools
        self.tools = self._create_tools()

        # Create agent
        self.agent = self._create_agent()

    def _create_tools(self) -> List[Tool]:
        """Create tools for the agent."""
        tools = [
            Tool(
                name="extract_text_ocr",
                func=self._tool_extract_text_ocr,
                description="""
                Extract text from a document image using OCR.
                Input: path to image file
                Output: extracted text and confidence score
                Use this for scanned documents or photos of documents.
                """,
            ),
            Tool(
                name="verify_document_authenticity",
                func=self._tool_verify_authenticity,
                description="""
                Verify if a document appears authentic using visual analysis.
                Input: JSON with 'image_path' and 'document_type'
                Output: authenticity assessment with score and recommendation
                Use this to detect forged or tampered documents.
                """,
            ),
            Tool(
                name="extract_structured_fields",
                func=self._tool_extract_structured_fields,
                description="""
                Extract specific fields from a document using VLM.
                Input: JSON with 'image_path' and 'fields' (list of field names)
                Output: extracted field values
                Use this to get specific information like name, date, amounts.
                """,
            ),
            Tool(
                name="parse_document_structure",
                func=self._tool_parse_document,
                description="""
                Parse a document into structured format with sections, tables, etc.
                Input: path to document file (PDF, DOCX, etc.)
                Output: structured document data with metadata, content, tables
                Use this for complex documents like medical reports or financial statements.
                """,
            ),
            Tool(
                name="compare_documents",
                func=self._tool_compare_documents,
                description="""
                Compare two documents (e.g., face match, signature match).
                Input: JSON with 'image_path1', 'image_path2', 'comparison_type'
                Output: comparison result with similarity score
                Use this to verify identity or detect fraud.
                """,
            ),
            Tool(
                name="analyze_medical_document",
                func=self._tool_analyze_medical,
                description="""
                Analyze a medical document and extract health information.
                Input: path to medical document
                Output: structured medical data with diagnoses, test results, etc.
                Use this for medical reports, lab results, prescriptions.
                """,
            ),
            Tool(
                name="analyze_financial_document",
                func=self._tool_analyze_financial,
                description="""
                Analyze a financial document and extract financial information.
                Input: path to financial document
                Output: structured financial data with transactions, balances, etc.
                Use this for bank statements, payslips, tax returns.
                """,
            ),
        ]

        return tools

    async def _tool_extract_text_ocr(self, image_path: str) -> str:
        """Tool: Extract text using OCR."""
        result = await self.ocr_service.extract_text_from_image(image_path)
        return json.dumps(result, indent=2)

    async def _tool_verify_authenticity(self, input_json: str) -> str:
        """Tool: Verify document authenticity."""
        try:
            data = json.loads(input_json)
            image_path = data["image_path"]
            document_type = data["document_type"]

            result = await self.vlm_service.verify_document_authenticity(
                image_path, document_type
            )
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_extract_structured_fields(self, input_json: str) -> str:
        """Tool: Extract structured fields."""
        try:
            data = json.loads(input_json)
            image_path = data["image_path"]
            fields = data["fields"]

            result = await self.vlm_service.extract_document_fields(
                image_path, fields
            )
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_parse_document(self, document_path: str) -> str:
        """Tool: Parse document structure."""
        result = await self.docling_service.parse_document(document_path)
        return json.dumps(result, indent=2)

    async def _tool_compare_documents(self, input_json: str) -> str:
        """Tool: Compare two documents."""
        try:
            data = json.loads(input_json)
            image_path1 = data["image_path1"]
            image_path2 = data["image_path2"]
            comparison_type = data["comparison_type"]

            result = await self.vlm_service.compare_documents(
                image_path1, image_path2, comparison_type
            )
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    async def _tool_analyze_medical(self, document_path: str) -> str:
        """Tool: Analyze medical document."""
        # Use both Docling and VLM
        docling_result = await self.docling_service.parse_medical_report(
            document_path
        )
        vlm_result = await self.vlm_service.analyze_medical_document(
            document_path
        )

        combined_result = {
            "docling_analysis": docling_result,
            "vlm_analysis": vlm_result,
        }

        return json.dumps(combined_result, indent=2)

    async def _tool_analyze_financial(self, document_path: str) -> str:
        """Tool: Analyze financial document."""
        # Use both Docling and VLM
        docling_result = await self.docling_service.parse_financial_statement(
            document_path
        )
        vlm_result = await self.vlm_service.analyze_financial_document(
            document_path
        )

        combined_result = {
            "docling_analysis": docling_result,
            "vlm_analysis": vlm_result,
        }

        return json.dumps(combined_result, indent=2)

    def _create_agent(self) -> AgentExecutor:
        """Create the LangChain agent."""
        # Create prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a document analysis expert for insurance underwriting.
            
            Your role is to analyze documents submitted by insurance applicants and extract
            relevant information for underwriting decisions.
            
            You have access to multiple tools:
            - OCR for text extraction
            - VLM for visual understanding and authenticity verification
            - Docling for structured document parsing
            - Document comparison tools
            
            When analyzing documents:
            1. First determine the document type
            2. Choose the appropriate tool(s) for analysis
            3. Extract all relevant information
            4. Verify authenticity if suspicious
            5. Provide a comprehensive summary
            
            Always provide structured output with:
            - Document type
            - Key extracted fields
            - Authenticity assessment
            - Risk flags (if any)
            - Recommendation for underwriter
            """),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        # Create memory
        memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
        )

        # Create agent
        agent = create_structured_chat_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt,
        )

        # Create executor
        agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            memory=memory,
            verbose=True,
            max_iterations=10,
            handle_parsing_errors=True,
        )

        return agent_executor

    async def analyze_underwriting_documents(
        self, documents: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Analyze all documents for an underwriting application.

        Args:
            documents: List of documents with 'path' and 'type' keys

        Returns:
            Comprehensive analysis of all documents
        """
        results = {
            "analysis_timestamp": datetime.utcnow().isoformat(),
            "total_documents": len(documents),
            "document_analyses": [],
            "overall_assessment": {},
            "red_flags": [],
            "recommendation": "",
        }

        # Analyze each document
        for doc in documents:
            doc_path = doc["path"]
            doc_type = doc["type"]

            # Create analysis prompt
            prompt = f"""
            Analyze this {doc_type} document located at: {doc_path}
            
            Extract all relevant information for insurance underwriting.
            Verify authenticity and flag any concerns.
            """

            # Run agent
            try:
                response = await asyncio.to_thread(
                    self.agent.invoke,
                    {"input": prompt}
                )

                doc_analysis = {
                    "document_path": doc_path,
                    "document_type": doc_type,
                    "analysis": response["output"],
                    "success": True,
                }

            except Exception as e:
                doc_analysis = {
                    "document_path": doc_path,
                    "document_type": doc_type,
                    "error": str(e),
                    "success": False,
                }

            results["document_analyses"].append(doc_analysis)

        # Generate overall assessment
        results["overall_assessment"] = await self._generate_overall_assessment(
            results["document_analyses"]
        )

        return results

    async def _generate_overall_assessment(
        self, document_analyses: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate overall assessment from all document analyses."""
        # Use LLM to synthesize findings
        prompt = f"""
        Based on the following document analyses, provide an overall assessment
        for insurance underwriting:
        
        {json.dumps(document_analyses, indent=2)}
        
        Provide:
        1. Overall authenticity score (0-100)
        2. Key risk factors identified
        3. Missing documents or information
        4. Recommendation (APPROVE, REJECT, MANUAL_REVIEW)
        5. Reasoning for recommendation
        
        Return as JSON.
        """

        try:
            response = await asyncio.to_thread(
                self.llm.invoke,
                prompt
            )

            # Parse JSON from response
            import re
            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            else:
                return {"raw_assessment": response}

        except Exception as e:
            return {"error": str(e)}


# Example usage
async def main():
    """Example usage of Document Analysis Agent."""
    agent = DocumentAnalysisAgent()

    # Example: Analyze underwriting documents
    documents = [
        {"path": "/path/to/nin_card.jpg", "type": "national_id"},
        {"path": "/path/to/medical_report.pdf", "type": "medical_report"},
        {"path": "/path/to/bank_statement.pdf", "type": "bank_statement"},
        {"path": "/path/to/selfie.jpg", "type": "selfie"},
    ]

    result = await agent.analyze_underwriting_documents(documents)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
