"""
Document Processing Pipeline for KYB
Integrates Docling, PaddleOCR, and VLM for comprehensive document understanding
"""

import asyncio
import hashlib
import json
import logging
import os
import tempfile
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DocumentType(str, Enum):
    # KYB Document Types (Business Verification)
    CERTIFICATE_OF_INCORPORATION = "CERTIFICATE_OF_INCORPORATION"
    BANKING_LICENSE = "BANKING_LICENSE"
    MEMORANDUM_OF_ASSOCIATION = "MEMORANDUM_OF_ASSOCIATION"
    ARTICLES_OF_ASSOCIATION = "ARTICLES_OF_ASSOCIATION"
    BOARD_RESOLUTION = "BOARD_RESOLUTION"
    SHAREHOLDER_REGISTER = "SHAREHOLDER_REGISTER"
    TAX_CERTIFICATE = "TAX_CERTIFICATE"
    AML_POLICY = "AML_POLICY"
    FINANCIAL_STATEMENTS = "FINANCIAL_STATEMENTS"
    BANK_STATEMENT = "BANK_STATEMENT"
    
    # KYC Document Types (Individual Verification)
    DIRECTOR_ID = "DIRECTOR_ID"
    UBO_ID = "UBO_ID"
    PROOF_OF_ADDRESS = "PROOF_OF_ADDRESS"
    PASSPORT = "PASSPORT"
    NATIONAL_ID = "NATIONAL_ID"
    DRIVERS_LICENSE = "DRIVERS_LICENSE"
    UTILITY_BILL = "UTILITY_BILL"
    SELFIE = "SELFIE"
    AUTHORIZATION_LETTER = "AUTHORIZATION_LETTER"


class ProcessingStatus(str, Enum):
    PENDING = "PENDING"
    PARSING = "PARSING"
    OCR = "OCR"
    EXTRACTION = "EXTRACTION"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float


@dataclass
class ExtractedField:
    value: str
    confidence: float
    bounding_box: Optional[BoundingBox] = None
    page_number: int = 1
    source: str = "unknown"  # docling, paddleocr, vlm


@dataclass
class DocumentBlock:
    """Represents a block of content from Docling parsing"""
    block_id: str
    block_type: str  # text, table, figure, header, footer
    content: str
    page_number: int
    bounding_box: Optional[BoundingBox] = None
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class OCRResult:
    """Result from PaddleOCR processing"""
    text: str
    confidence: float
    bounding_box: BoundingBox
    page_number: int


@dataclass
class DocumentStructure:
    """Structured document representation from Docling"""
    document_id: str
    file_name: str
    total_pages: int
    blocks: List[DocumentBlock]
    tables: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    needs_ocr_pages: List[int]  # Pages that need OCR (scanned/image)


@dataclass
class ExtractionResult:
    """Final extraction result combining all processing stages"""
    document_id: str
    document_type: DocumentType
    extracted_fields: Dict[str, ExtractedField]
    raw_text: str
    confidence: float
    processing_time_ms: int
    engines_used: List[str]
    warnings: List[str] = field(default_factory=list)


class DoclingProcessor:
    """
    Docling-based document parsing and structure extraction
    Uses IBM's Docling library for PDF/document understanding
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._docling = None
        
    async def initialize(self):
        """Initialize Docling library"""
        try:
            from docling.document_converter import DocumentConverter
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions
            
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = False  # We'll use PaddleOCR separately
            pipeline_options.do_table_structure = True
            
            self._docling = DocumentConverter(
                allowed_formats=[InputFormat.PDF, InputFormat.IMAGE, InputFormat.DOCX],
                pdf_pipeline_options=pipeline_options
            )
            logger.info("Docling initialized successfully")
        except ImportError:
            logger.warning("Docling not installed, using fallback parser")
            self._docling = None
    
    async def parse_document(self, file_path: str) -> DocumentStructure:
        """
        Parse document using Docling to extract structure
        Returns structured representation with blocks, tables, and metadata
        """
        start_time = time.time()
        
        if self._docling is None:
            return await self._fallback_parse(file_path)
        
        try:
            # Convert document using Docling
            result = self._docling.convert(file_path)
            doc = result.document
            
            blocks = []
            tables = []
            needs_ocr_pages = []
            
            # Extract text blocks
            for i, item in enumerate(doc.texts):
                block = DocumentBlock(
                    block_id=f"block_{i}",
                    block_type=item.label if hasattr(item, 'label') else "text",
                    content=item.text,
                    page_number=item.prov[0].page if item.prov else 1,
                    confidence=1.0,
                    metadata={}
                )
                blocks.append(block)
                
                # Check if page needs OCR (low text confidence or image-based)
                if hasattr(item, 'confidence') and item.confidence < 0.5:
                    if item.prov and item.prov[0].page not in needs_ocr_pages:
                        needs_ocr_pages.append(item.prov[0].page)
            
            # Extract tables
            for i, table in enumerate(doc.tables):
                table_data = {
                    "table_id": f"table_{i}",
                    "page_number": table.prov[0].page if table.prov else 1,
                    "rows": [],
                    "headers": []
                }
                
                if hasattr(table, 'data'):
                    for row in table.data.table_cells:
                        table_data["rows"].append({
                            "row": row.row_span,
                            "col": row.col_span,
                            "text": row.text
                        })
                
                tables.append(table_data)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return DocumentStructure(
                document_id=hashlib.sha256(file_path.encode()).hexdigest()[:16],
                file_name=Path(file_path).name,
                total_pages=doc.num_pages if hasattr(doc, 'num_pages') else 1,
                blocks=blocks,
                tables=tables,
                metadata={
                    "processing_time_ms": processing_time,
                    "engine": "docling"
                },
                needs_ocr_pages=needs_ocr_pages
            )
            
        except Exception as e:
            logger.error(f"Docling parsing failed: {e}")
            return await self._fallback_parse(file_path)
    
    async def _fallback_parse(self, file_path: str) -> DocumentStructure:
        """Fallback parser when Docling is not available"""
        try:
            import PyPDF2
            
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                blocks = []
                needs_ocr_pages = []
                
                for page_num, page in enumerate(reader.pages, 1):
                    text = page.extract_text() or ""
                    
                    if len(text.strip()) < 50:  # Likely scanned page
                        needs_ocr_pages.append(page_num)
                    
                    blocks.append(DocumentBlock(
                        block_id=f"page_{page_num}",
                        block_type="text",
                        content=text,
                        page_number=page_num,
                        confidence=0.8
                    ))
                
                return DocumentStructure(
                    document_id=hashlib.sha256(file_path.encode()).hexdigest()[:16],
                    file_name=Path(file_path).name,
                    total_pages=len(reader.pages),
                    blocks=blocks,
                    tables=[],
                    metadata={"engine": "pypdf2_fallback"},
                    needs_ocr_pages=needs_ocr_pages
                )
        except Exception as e:
            logger.error(f"Fallback parsing failed: {e}")
            raise


class PaddleOCRProcessor:
    """
    PaddleOCR-based OCR processing for scanned documents
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self._ocr = None
        self.lang = config.get("lang", "en") if config else "en"
    
    async def initialize(self):
        """Initialize PaddleOCR"""
        try:
            from paddleocr import PaddleOCR
            
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang=self.lang,
                use_gpu=self.config.get("use_gpu", False),
                show_log=False
            )
            logger.info("PaddleOCR initialized successfully")
        except ImportError:
            logger.warning("PaddleOCR not installed")
            self._ocr = None
    
    async def process_image(self, image_path: str, page_number: int = 1) -> List[OCRResult]:
        """
        Process a single image/page with PaddleOCR
        Returns list of OCR results with bounding boxes
        """
        if self._ocr is None:
            logger.warning("PaddleOCR not available")
            return []
        
        try:
            result = self._ocr.ocr(image_path, cls=True)
            
            ocr_results = []
            if result and result[0]:
                for line in result[0]:
                    bbox_points = line[0]
                    text, confidence = line[1]
                    
                    # Convert polygon to bounding box
                    x_coords = [p[0] for p in bbox_points]
                    y_coords = [p[1] for p in bbox_points]
                    
                    bbox = BoundingBox(
                        x=min(x_coords),
                        y=min(y_coords),
                        width=max(x_coords) - min(x_coords),
                        height=max(y_coords) - min(y_coords)
                    )
                    
                    ocr_results.append(OCRResult(
                        text=text,
                        confidence=confidence,
                        bounding_box=bbox,
                        page_number=page_number
                    ))
            
            return ocr_results
            
        except Exception as e:
            logger.error(f"PaddleOCR processing failed: {e}")
            return []
    
    async def process_pdf_pages(self, pdf_path: str, pages: List[int]) -> Dict[int, List[OCRResult]]:
        """
        Process specific pages of a PDF with OCR
        """
        results = {}
        
        try:
            import pdf2image
            
            # Convert specific pages to images
            images = pdf2image.convert_from_path(
                pdf_path,
                first_page=min(pages),
                last_page=max(pages),
                dpi=300
            )
            
            for i, page_num in enumerate(pages):
                if i < len(images):
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                        images[i].save(tmp.name, 'PNG')
                        results[page_num] = await self.process_image(tmp.name, page_num)
                        os.unlink(tmp.name)
            
        except Exception as e:
            logger.error(f"PDF OCR processing failed: {e}")
        
        return results


class VLMProcessor:
    """
    Vision Language Model processor for document understanding and field extraction
    Supports multiple VLM backends:
    - ollama: Local LLaVA model via Ollama (default, fully on-premise)
    - openai: OpenAI GPT-4V
    - anthropic: Claude
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        # Default to Ollama with LLaVA for on-premise deployment
        self.provider = config.get("provider", "ollama") if config else "ollama"
        self.model = config.get("model", "llava:13b") if config else "llava:13b"
        self.api_key = config.get("api_key", os.getenv("OPENAI_API_KEY")) if config else os.getenv("OPENAI_API_KEY")
        # Ollama default URL
        self.ollama_url = config.get("ollama_url", os.getenv("OLLAMA_URL", "http://ollama:11434")) if config else "http://ollama:11434"
        self.base_url = config.get("base_url") if config else None
    
    async def extract_fields(
        self,
        document_type: DocumentType,
        document_structure: DocumentStructure,
        ocr_results: Optional[Dict[int, List[OCRResult]]] = None
    ) -> Dict[str, ExtractedField]:
        """
        Use VLM to extract structured fields from document
        """
        # Build context from document structure and OCR
        context = self._build_context(document_structure, ocr_results)
        
        # Get extraction schema for document type
        schema = self._get_extraction_schema(document_type)
        
        # Build prompt
        prompt = self._build_extraction_prompt(document_type, context, schema)
        
        try:
            # Call VLM API
            response = await self._call_vlm(prompt)
            
            # Parse response into extracted fields
            return self._parse_extraction_response(response, schema)
            
        except Exception as e:
            logger.error(f"VLM extraction failed: {e}")
            return {}
    
    def _build_context(
        self,
        structure: DocumentStructure,
        ocr_results: Optional[Dict[int, List[OCRResult]]]
    ) -> str:
        """Build context string from document structure and OCR"""
        context_parts = []
        
        # Add text blocks
        for block in structure.blocks:
            context_parts.append(f"[Page {block.page_number}] {block.content}")
        
        # Add OCR results for scanned pages
        if ocr_results:
            for page_num, results in ocr_results.items():
                ocr_text = " ".join([r.text for r in results])
                context_parts.append(f"[Page {page_num} OCR] {ocr_text}")
        
        # Add table data
        for table in structure.tables:
            table_text = f"[Table on Page {table.get('page_number', 1)}]"
            context_parts.append(table_text)
        
        return "\n\n".join(context_parts)
    
    def _get_extraction_schema(self, document_type: DocumentType) -> Dict[str, Any]:
        """Get extraction schema for document type"""
        schemas = {
            DocumentType.CERTIFICATE_OF_INCORPORATION: {
                "company_name": {"type": "string", "required": True},
                "registration_number": {"type": "string", "required": True},
                "incorporation_date": {"type": "date", "required": True},
                "registered_address": {"type": "string", "required": True},
                "company_type": {"type": "string", "required": False},
                "jurisdiction": {"type": "string", "required": True}
            },
            DocumentType.BANKING_LICENSE: {
                "license_number": {"type": "string", "required": True},
                "licensee_name": {"type": "string", "required": True},
                "license_type": {"type": "string", "required": True},
                "issue_date": {"type": "date", "required": True},
                "expiry_date": {"type": "date", "required": False},
                "issuing_authority": {"type": "string", "required": True},
                "permitted_activities": {"type": "list", "required": False}
            },
            DocumentType.BOARD_RESOLUTION: {
                "company_name": {"type": "string", "required": True},
                "resolution_date": {"type": "date", "required": True},
                "resolution_number": {"type": "string", "required": False},
                "subject": {"type": "string", "required": True},
                "authorized_signatories": {"type": "list", "required": True},
                "chairman_name": {"type": "string", "required": False}
            },
            DocumentType.DIRECTOR_ID: {
                "full_name": {"type": "string", "required": True},
                "document_number": {"type": "string", "required": True},
                "date_of_birth": {"type": "date", "required": True},
                "nationality": {"type": "string", "required": True},
                "expiry_date": {"type": "date", "required": False},
                "document_type": {"type": "string", "required": True}
            },
            DocumentType.FINANCIAL_STATEMENTS: {
                "company_name": {"type": "string", "required": True},
                "fiscal_year": {"type": "string", "required": True},
                "total_assets": {"type": "number", "required": True},
                "total_liabilities": {"type": "number", "required": True},
                "net_income": {"type": "number", "required": True},
                "auditor_name": {"type": "string", "required": False},
                "audit_opinion": {"type": "string", "required": False}
            },
            # KYC Document Schemas (Individual Verification)
            DocumentType.PASSPORT: {
                "full_name": {"type": "string", "required": True},
                "first_name": {"type": "string", "required": True},
                "last_name": {"type": "string", "required": True},
                "passport_number": {"type": "string", "required": True},
                "date_of_birth": {"type": "date", "required": True},
                "nationality": {"type": "string", "required": True},
                "gender": {"type": "string", "required": True},
                "issue_date": {"type": "date", "required": False},
                "expiry_date": {"type": "date", "required": True},
                "issuing_country": {"type": "string", "required": True},
                "issuing_authority": {"type": "string", "required": False},
                "mrz_line_1": {"type": "string", "required": False},
                "mrz_line_2": {"type": "string", "required": False},
                "place_of_birth": {"type": "string", "required": False}
            },
            DocumentType.NATIONAL_ID: {
                "full_name": {"type": "string", "required": True},
                "first_name": {"type": "string", "required": True},
                "last_name": {"type": "string", "required": True},
                "id_number": {"type": "string", "required": True},
                "date_of_birth": {"type": "date", "required": True},
                "nationality": {"type": "string", "required": True},
                "gender": {"type": "string", "required": False},
                "issue_date": {"type": "date", "required": False},
                "expiry_date": {"type": "date", "required": False},
                "address": {"type": "string", "required": False},
                "issuing_authority": {"type": "string", "required": False},
                "bvn": {"type": "string", "required": False},
                "nin": {"type": "string", "required": False}
            },
            DocumentType.DRIVERS_LICENSE: {
                "full_name": {"type": "string", "required": True},
                "license_number": {"type": "string", "required": True},
                "date_of_birth": {"type": "date", "required": True},
                "address": {"type": "string", "required": True},
                "issue_date": {"type": "date", "required": False},
                "expiry_date": {"type": "date", "required": True},
                "license_class": {"type": "string", "required": False},
                "restrictions": {"type": "string", "required": False},
                "issuing_authority": {"type": "string", "required": False}
            },
            DocumentType.UBO_ID: {
                "full_name": {"type": "string", "required": True},
                "document_number": {"type": "string", "required": True},
                "document_type": {"type": "string", "required": True},
                "date_of_birth": {"type": "date", "required": True},
                "nationality": {"type": "string", "required": True},
                "expiry_date": {"type": "date", "required": False},
                "ownership_percentage": {"type": "number", "required": False}
            },
            DocumentType.PROOF_OF_ADDRESS: {
                "full_name": {"type": "string", "required": True},
                "address": {"type": "string", "required": True},
                "document_date": {"type": "date", "required": True},
                "document_type": {"type": "string", "required": False},
                "issuer": {"type": "string", "required": False}
            },
            DocumentType.UTILITY_BILL: {
                "account_holder_name": {"type": "string", "required": True},
                "service_address": {"type": "string", "required": True},
                "bill_date": {"type": "date", "required": True},
                "account_number": {"type": "string", "required": False},
                "utility_provider": {"type": "string", "required": False},
                "utility_type": {"type": "string", "required": False}
            },
            DocumentType.AUTHORIZATION_LETTER: {
                "authorizing_entity": {"type": "string", "required": True},
                "authorized_person": {"type": "string", "required": True},
                "authorization_scope": {"type": "string", "required": True},
                "effective_date": {"type": "date", "required": True},
                "expiry_date": {"type": "date", "required": False},
                "signatory_name": {"type": "string", "required": True},
                "signatory_title": {"type": "string", "required": False}
            }
        }
        
        return schemas.get(document_type, {
            "document_title": {"type": "string", "required": False},
            "date": {"type": "date", "required": False},
            "key_entities": {"type": "list", "required": False}
        })
    
    def _build_extraction_prompt(
        self,
        document_type: DocumentType,
        context: str,
        schema: Dict[str, Any]
    ) -> str:
        """Build extraction prompt for VLM"""
        fields_desc = "\n".join([
            f"- {field}: {info['type']} {'(required)' if info.get('required') else '(optional)'}"
            for field, info in schema.items()
        ])
        
        return f"""You are a document extraction expert. Extract the following fields from this {document_type.value} document.

FIELDS TO EXTRACT:
{fields_desc}

DOCUMENT CONTENT:
{context}

INSTRUCTIONS:
1. Extract each field with its value and confidence score (0-1)
2. If a field is not found, set value to null
3. For dates, use ISO format (YYYY-MM-DD)
4. For numbers, extract numeric values only
5. Return JSON format

OUTPUT FORMAT:
{{
  "field_name": {{
    "value": "extracted value",
    "confidence": 0.95,
    "source_page": 1
  }}
}}

Extract the fields now:"""
    
    async def _call_vlm(self, prompt: str, image_path: Optional[str] = None) -> str:
        """Call VLM API based on configured provider"""
        if self.provider == "ollama":
            return await self._call_ollama(prompt, image_path)
        elif self.provider == "openai":
            return await self._call_openai(prompt, image_path)
        elif self.provider == "anthropic":
            return await self._call_anthropic(prompt)
        else:
            return await self._call_local(prompt)
    
    async def _call_ollama(self, prompt: str, image_path: Optional[str] = None) -> str:
        """
        Call Ollama API with LLaVA model for vision-language understanding
        LLaVA (Large Language and Vision Assistant) is a multimodal model
        that can understand both text and images
        """
        import base64
        
        # Build the request payload
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 2000,
            }
        }
        
        # If image is provided, encode it for LLaVA
        if image_path and os.path.exists(image_path):
            with open(image_path, "rb") as img_file:
                image_data = base64.b64encode(img_file.read()).decode("utf-8")
                payload["images"] = [image_data]
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload,
                    timeout=180.0  # Longer timeout for local inference
                )
                
                if response.status_code != 200:
                    logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                    raise Exception(f"Ollama API error: {response.status_code}")
                
                data = response.json()
                return data.get("response", "")
                
            except httpx.ConnectError:
                logger.error(f"Cannot connect to Ollama at {self.ollama_url}")
                raise Exception(f"Cannot connect to Ollama at {self.ollama_url}. Ensure Ollama is running.")
            except httpx.TimeoutException:
                logger.error("Ollama request timed out")
                raise Exception("Ollama request timed out. Model may be loading or GPU is busy.")
    
    async def _call_ollama_chat(self, prompt: str, image_path: Optional[str] = None) -> str:
        """
        Alternative Ollama API using chat endpoint for better conversation handling
        """
        import base64
        
        messages = [{"role": "user", "content": prompt}]
        
        # If image is provided, use multimodal format
        if image_path and os.path.exists(image_path):
            with open(image_path, "rb") as img_file:
                image_data = base64.b64encode(img_file.read()).decode("utf-8")
                messages = [{
                    "role": "user",
                    "content": prompt,
                    "images": [image_data]
                }]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.1,
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=180.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama chat API error: {response.status_code}")
            
            data = response.json()
            return data.get("message", {}).get("content", "")
    
    async def _call_openai(self, prompt: str, image_path: Optional[str] = None) -> str:
        """Call OpenAI API with optional vision support"""
        import base64
        
        messages = []
        
        # Build message content with optional image
        if image_path and os.path.exists(image_path):
            with open(image_path, "rb") as img_file:
                image_data = base64.b64encode(img_file.read()).decode("utf-8")
                # Determine image type
                if image_path.lower().endswith(".png"):
                    media_type = "image/png"
                else:
                    media_type = "image/jpeg"
                
                messages = [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_data}"
                            }
                        }
                    ]
                }]
        else:
            messages = [{"role": "user", "content": prompt}]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 2000
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.text}")
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    async def _call_anthropic(self, prompt: str) -> str:
        """Call Anthropic API"""
        api_key = self.config.get("anthropic_api_key", os.getenv("ANTHROPIC_API_KEY"))
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01"
                },
                json={
                    "model": self.config.get("anthropic_model", "claude-3-sonnet-20240229"),
                    "max_tokens": 2000,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Anthropic API error: {response.text}")
            
            data = response.json()
            return data["content"][0]["text"]
    
    async def _call_local(self, prompt: str) -> str:
        """Call local VLM endpoint"""
        base_url = self.base_url or "http://localhost:8000"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1
                },
                timeout=120.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Local VLM error: {response.text}")
            
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    def _parse_extraction_response(
        self,
        response: str,
        schema: Dict[str, Any]
    ) -> Dict[str, ExtractedField]:
        """Parse VLM response into extracted fields"""
        try:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(response)
            
            fields = {}
            for field_name, field_data in data.items():
                if isinstance(field_data, dict):
                    fields[field_name] = ExtractedField(
                        value=str(field_data.get("value", "")),
                        confidence=float(field_data.get("confidence", 0.5)),
                        page_number=int(field_data.get("source_page", 1)),
                        source="vlm"
                    )
                else:
                    fields[field_name] = ExtractedField(
                        value=str(field_data),
                        confidence=0.7,
                        source="vlm"
                    )
            
            return fields
            
        except Exception as e:
            logger.error(f"Failed to parse VLM response: {e}")
            return {}


class DocumentProcessingPipeline:
    """
    Main document processing pipeline that orchestrates Docling, PaddleOCR, and VLM
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.docling = DoclingProcessor(config.get("docling"))
        self.paddleocr = PaddleOCRProcessor(config.get("paddleocr"))
        self.vlm = VLMProcessor(config.get("vlm"))
        self._initialized = False
    
    async def initialize(self):
        """Initialize all processors"""
        await self.docling.initialize()
        await self.paddleocr.initialize()
        self._initialized = True
        logger.info("Document processing pipeline initialized")
    
    async def process_document(
        self,
        file_path: str,
        document_type: DocumentType,
        options: Optional[Dict[str, Any]] = None
    ) -> ExtractionResult:
        """
        Process a document through the full pipeline:
        1. Docling: Parse structure and layout
        2. PaddleOCR: OCR for scanned pages
        3. VLM: Extract structured fields
        """
        if not self._initialized:
            await self.initialize()
        
        start_time = time.time()
        engines_used = []
        warnings = []
        
        # Step 1: Parse document structure with Docling
        logger.info(f"Parsing document structure: {file_path}")
        structure = await self.docling.parse_document(file_path)
        engines_used.append("docling")
        
        # Step 2: OCR for scanned pages
        ocr_results = None
        if structure.needs_ocr_pages:
            logger.info(f"Running OCR on pages: {structure.needs_ocr_pages}")
            ocr_results = await self.paddleocr.process_pdf_pages(
                file_path,
                structure.needs_ocr_pages
            )
            engines_used.append("paddleocr")
        
        # Step 3: Extract fields with VLM
        logger.info("Extracting fields with VLM")
        extracted_fields = await self.vlm.extract_fields(
            document_type,
            structure,
            ocr_results
        )
        engines_used.append("vlm")
        
        # Build raw text
        raw_text_parts = [block.content for block in structure.blocks]
        if ocr_results:
            for page_results in ocr_results.values():
                raw_text_parts.extend([r.text for r in page_results])
        raw_text = "\n".join(raw_text_parts)
        
        # Calculate overall confidence
        if extracted_fields:
            confidence = sum(f.confidence for f in extracted_fields.values()) / len(extracted_fields)
        else:
            confidence = 0.0
            warnings.append("No fields extracted")
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return ExtractionResult(
            document_id=structure.document_id,
            document_type=document_type,
            extracted_fields=extracted_fields,
            raw_text=raw_text,
            confidence=confidence,
            processing_time_ms=processing_time,
            engines_used=engines_used,
            warnings=warnings
        )


# FastAPI service for document processing
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

app = FastAPI(title="KYB Document Processing Service")

# Global pipeline instance
pipeline: Optional[DocumentProcessingPipeline] = None


@app.on_event("startup")
async def startup():
    global pipeline
    config = {
        "docling": {},
        "paddleocr": {
            "lang": os.getenv("OCR_LANG", "en"),
            "use_gpu": os.getenv("USE_GPU", "false").lower() == "true"
        },
        "vlm": {
            # Default to Ollama with LLaVA for fully on-premise deployment
            "provider": os.getenv("VLM_PROVIDER", "ollama"),
            "model": os.getenv("VLM_MODEL", "llava:13b"),
            "ollama_url": os.getenv("OLLAMA_URL", "http://ollama:11434"),
            # Fallback to OpenAI if configured
            "api_key": os.getenv("OPENAI_API_KEY"),
        }
    }
    pipeline = DocumentProcessingPipeline(config)
    await pipeline.initialize()
    logger.info(f"Document processor started with VLM provider: {config['vlm']['provider']}, model: {config['vlm']['model']}")


@app.post("/api/v1/process")
async def process_document(
    file: UploadFile = File(...),
    document_type: str = "CERTIFICATE_OF_INCORPORATION"
):
    """Process a document and extract fields"""
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        doc_type = DocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid document type: {document_type}")
    
    # Save uploaded file
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        result = await pipeline.process_document(tmp_path, doc_type)
        
        return JSONResponse({
            "document_id": result.document_id,
            "document_type": result.document_type.value,
            "extracted_fields": {
                k: {
                    "value": v.value,
                    "confidence": v.confidence,
                    "page_number": v.page_number,
                    "source": v.source
                }
                for k, v in result.extracted_fields.items()
            },
            "confidence": result.confidence,
            "processing_time_ms": result.processing_time_ms,
            "engines_used": result.engines_used,
            "warnings": result.warnings
        })
    finally:
        os.unlink(tmp_path)


@app.get("/health")
async def health():
    return {"status": "healthy", "initialized": pipeline is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
