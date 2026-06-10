"""
OCR Document Processing Activities
"""

import logging
import re
from typing import Dict, Any, List
from datetime import datetime

import cv2
import numpy as np
from PIL import Image
import pytesseract
from temporalio import activity

logger = logging.getLogger(__name__)


class OCRProcessingActivities:
    """OCR and document processing activities"""
    
    def __init__(self):
        # OCR correction patterns (loaded from database in production)
        self.correction_patterns = {
            'tax_id': r'\b\d{2}-\d{7}\b',
            'business_license': r'\b[A-Z]{2}\d{6,8}\b',
            'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        }
    
    @activity.defn(name="ProcessDocuments")
    async def process_documents(self, document_urls: List[str]) -> Dict[str, Any]:
        """
        Process multiple documents with OCR
        
        Args:
            document_urls: List of document URLs
            
        Returns:
            Extracted data from all documents
        """
        logger.info(f"Processing {len(document_urls)} documents")
        
        results = {
            'documents': {},
            'accuracy': 0.0,
            'errors': []
        }
        
        total_confidence = 0
        processed_count = 0
        
        for url in document_urls:
            try:
                # Extract document type from URL
                doc_type = self._identify_document_type(url)
                
                # Process document
                extracted_data = await self.extract_text(url)
                
                # Apply correction patterns
                corrected_data = await self.correct_ocr_errors(extracted_data, doc_type)
                
                results['documents'][doc_type] = corrected_data
                total_confidence += corrected_data.get('confidence', 0)
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process document {url}: {e}")
                results['errors'].append(f"Failed to process {url}: {str(e)}")
        
        if processed_count > 0:
            results['accuracy'] = total_confidence / processed_count
        
        logger.info(f"Document processing complete: accuracy={results['accuracy']:.2f}")
        return results
    
    @activity.defn(name="ExtractText")
    async def extract_text(self, document_url: str) -> Dict[str, Any]:
        """
        Extract text from document using OCR
        
        Args:
            document_url: URL of document to process
            
        Returns:
            Extracted text and metadata
        """
        logger.info(f"Extracting text from {document_url}")
        
        try:
            # In production, download from S3
            # For now, simulate OCR extraction
            
            # Simulated OCR results
            extracted_data = {
                'raw_text': self._simulate_ocr_output(document_url),
                'confidence': np.random.uniform(0.85, 0.98),
                'language': 'en',
                'page_count': 1,
                'extracted_at': datetime.now().isoformat(),
            }
            
            logger.info(f"Text extraction complete: confidence={extracted_data['confidence']:.2f}")
            return extracted_data
            
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            raise
    
    @activity.defn(name="CorrectOCRErrors")
    async def correct_ocr_errors(self, ocr_data: Dict[str, Any], document_type: str) -> Dict[str, Any]:
        """
        Correct OCR errors using pattern matching
        
        Args:
            ocr_data: Raw OCR output
            document_type: Type of document
            
        Returns:
            Corrected data
        """
        logger.info(f"Correcting OCR errors for {document_type}")
        
        raw_text = ocr_data.get('raw_text', '')
        corrected_data = {
            'document_type': document_type,
            'raw_text': raw_text,
            'confidence': ocr_data.get('confidence', 0),
            'extracted_fields': {},
            'corrections_applied': []
        }
        
        # Extract structured fields based on document type
        if document_type == 'business_license':
            corrected_data['extracted_fields'] = self._extract_business_license(raw_text)
        elif document_type == 'tax_document':
            corrected_data['extracted_fields'] = self._extract_tax_document(raw_text)
        elif document_type == 'bank_statement':
            corrected_data['extracted_fields'] = self._extract_bank_statement(raw_text)
        else:
            corrected_data['extracted_fields'] = self._extract_generic(raw_text)
        
        logger.info(f"OCR correction complete: {len(corrected_data['extracted_fields'])} fields extracted")
        return corrected_data
    
    def _identify_document_type(self, url: str) -> str:
        """Identify document type from URL or filename"""
        url_lower = url.lower()
        
        if 'license' in url_lower:
            return 'business_license'
        elif 'tax' in url_lower or 'ein' in url_lower:
            return 'tax_document'
        elif 'bank' in url_lower or 'statement' in url_lower:
            return 'bank_statement'
        elif 'id' in url_lower or 'passport' in url_lower:
            return 'identity_document'
        else:
            return 'unknown'
    
    def _simulate_ocr_output(self, url: str) -> str:
        """Simulate OCR output for testing"""
        doc_type = self._identify_document_type(url)
        
        if doc_type == 'business_license':
            return """
            BUSINESS LICENSE
            License Number: BL1234567
            Business Name: Acme Corporation
            Issue Date: 01/15/2024
            Expiry Date: 01/15/2025
            Tax ID: 12-3456789
            """
        elif doc_type == 'tax_document':
            return """
            EMPLOYER IDENTIFICATION NUMBER
            EIN: 12-3456789
            Business Name: Acme Corporation
            Address: 123 Main St, New York, NY 10001
            """
        else:
            return "Sample document text"
    
    def _extract_business_license(self, text: str) -> Dict[str, str]:
        """Extract fields from business license"""
        fields = {}
        
        # License number
        license_match = re.search(self.correction_patterns['business_license'], text)
        if license_match:
            fields['license_number'] = license_match.group(0)
        
        # Tax ID
        tax_id_match = re.search(self.correction_patterns['tax_id'], text)
        if tax_id_match:
            fields['tax_id'] = tax_id_match.group(0)
        
        # Business name (simple extraction)
        name_match = re.search(r'Business Name:\s*(.+)', text, re.IGNORECASE)
        if name_match:
            fields['business_name'] = name_match.group(1).strip()
        
        # Dates
        date_pattern = r'\d{2}/\d{2}/\d{4}'
        dates = re.findall(date_pattern, text)
        if len(dates) >= 2:
            fields['issue_date'] = dates[0]
            fields['expiry_date'] = dates[1]
        
        return fields
    
    def _extract_tax_document(self, text: str) -> Dict[str, str]:
        """Extract fields from tax document"""
        fields = {}
        
        # EIN/Tax ID
        tax_id_match = re.search(self.correction_patterns['tax_id'], text)
        if tax_id_match:
            fields['ein'] = tax_id_match.group(0)
        
        # Business name
        name_match = re.search(r'Business Name:\s*(.+)', text, re.IGNORECASE)
        if name_match:
            fields['business_name'] = name_match.group(1).strip()
        
        # Address
        address_match = re.search(r'Address:\s*(.+)', text, re.IGNORECASE)
        if address_match:
            fields['address'] = address_match.group(1).strip()
        
        return fields
    
    def _extract_bank_statement(self, text: str) -> Dict[str, str]:
        """Extract fields from bank statement"""
        fields = {}
        
        # Account number (masked)
        account_match = re.search(r'Account.*?(\d{4})', text, re.IGNORECASE)
        if account_match:
            fields['account_last4'] = account_match.group(1)
        
        # Balance
        balance_match = re.search(r'Balance.*?\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
        if balance_match:
            fields['balance'] = balance_match.group(1)
        
        return fields
    
    def _extract_generic(self, text: str) -> Dict[str, str]:
        """Extract common fields from any document"""
        fields = {}
        
        # Email
        email_match = re.search(self.correction_patterns['email'], text)
        if email_match:
            fields['email'] = email_match.group(0)
        
        # Phone
        phone_match = re.search(self.correction_patterns['phone'], text)
        if phone_match:
            fields['phone'] = phone_match.group(0)
        
        return fields
