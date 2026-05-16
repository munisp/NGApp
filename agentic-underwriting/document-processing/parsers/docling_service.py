"""
Docling Service for Advanced Document Parsing

This service uses Docling to parse complex documents including PDFs,
Word documents, and other formats into structured data.
"""

import os
from typing import Dict, Any, List, Optional
from pathlib import Path
import json
import asyncio
from datetime import datetime

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.pypdfium2_backend import PyPdfiumDocumentBackend


class DoclingService:
    """
    Service for parsing and structuring documents using Docling.
    Supports PDFs, Word documents, and other formats.
    """

    def __init__(self):
        """Initialize Docling service with optimal settings."""
        # Configure pipeline options
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True  # Enable OCR for scanned documents
        pipeline_options.do_table_structure = True  # Extract table structures
        pipeline_options.table_structure_options.do_cell_matching = True

        # Initialize document converter
        self.converter = DocumentConverter(
            allowed_formats=[
                InputFormat.PDF,
                InputFormat.DOCX,
                InputFormat.HTML,
                InputFormat.IMAGE,
            ],
            pipeline_options=pipeline_options,
        )

    async def parse_document(
        self, document_path: str
    ) -> Dict[str, Any]:
        """
        Parse a document into structured format.

        Args:
            document_path: Path to the document file

        Returns:
            Structured document data
        """
        try:
            # Convert document
            result = await asyncio.to_thread(
                self.converter.convert, document_path
            )

            # Extract structured data
            document_data = {
                "success": True,
                "document_path": document_path,
                "metadata": self._extract_metadata(result),
                "content": self._extract_content(result),
                "tables": self._extract_tables(result),
                "images": self._extract_images(result),
                "timestamp": datetime.utcnow().isoformat(),
            }

            return document_data

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "document_path": document_path,
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def parse_medical_report(
        self, document_path: str
    ) -> Dict[str, Any]:
        """
        Parse a medical report with specialized extraction.

        Args:
            document_path: Path to the medical report

        Returns:
            Structured medical data
        """
        # First parse the document
        parsed_doc = await self.parse_document(document_path)

        if not parsed_doc.get("success"):
            return parsed_doc

        # Extract medical-specific information
        medical_data = {
            "patient_info": self._extract_patient_info(parsed_doc),
            "test_results": self._extract_test_results(parsed_doc),
            "diagnoses": self._extract_diagnoses(parsed_doc),
            "medications": self._extract_medications(parsed_doc),
            "vital_signs": self._extract_vital_signs(parsed_doc),
        }

        parsed_doc["medical_data"] = medical_data
        return parsed_doc

    async def parse_financial_statement(
        self, document_path: str
    ) -> Dict[str, Any]:
        """
        Parse a financial statement (bank statement, payslip, etc.).

        Args:
            document_path: Path to the financial document

        Returns:
            Structured financial data
        """
        # Parse the document
        parsed_doc = await self.parse_document(document_path)

        if not parsed_doc.get("success"):
            return parsed_doc

        # Extract financial-specific information
        financial_data = {
            "account_info": self._extract_account_info(parsed_doc),
            "transactions": self._extract_transactions(parsed_doc),
            "balances": self._extract_balances(parsed_doc),
            "summary_stats": self._calculate_financial_stats(parsed_doc),
        }

        parsed_doc["financial_data"] = financial_data
        return parsed_doc

    async def parse_insurance_application(
        self, document_path: str
    ) -> Dict[str, Any]:
        """
        Parse an insurance application form.

        Args:
            document_path: Path to the application form

        Returns:
            Structured application data
        """
        parsed_doc = await self.parse_document(document_path)

        if not parsed_doc.get("success"):
            return parsed_doc

        # Extract application-specific fields
        application_data = {
            "applicant_info": self._extract_applicant_info(parsed_doc),
            "policy_details": self._extract_policy_details(parsed_doc),
            "beneficiaries": self._extract_beneficiaries(parsed_doc),
            "medical_history": self._extract_medical_history(parsed_doc),
            "declarations": self._extract_declarations(parsed_doc),
        }

        parsed_doc["application_data"] = application_data
        return parsed_doc

    def _extract_metadata(self, result: Any) -> Dict[str, Any]:
        """Extract document metadata."""
        try:
            doc = result.document
            return {
                "title": getattr(doc, "title", None),
                "author": getattr(doc, "author", None),
                "creation_date": getattr(doc, "creation_date", None),
                "page_count": getattr(doc, "page_count", 0),
                "language": getattr(doc, "language", None),
            }
        except Exception as e:
            return {"error": str(e)}

    def _extract_content(self, result: Any) -> Dict[str, Any]:
        """Extract document content."""
        try:
            doc = result.document
            
            # Extract text content
            full_text = doc.export_to_markdown() if hasattr(doc, "export_to_markdown") else ""
            
            # Extract sections
            sections = []
            if hasattr(doc, "sections"):
                for section in doc.sections:
                    sections.append({
                        "title": getattr(section, "title", ""),
                        "text": getattr(section, "text", ""),
                        "level": getattr(section, "level", 0),
                    })

            return {
                "full_text": full_text,
                "sections": sections,
            }
        except Exception as e:
            return {"error": str(e)}

    def _extract_tables(self, result: Any) -> List[Dict[str, Any]]:
        """Extract tables from document."""
        try:
            doc = result.document
            tables = []

            if hasattr(doc, "tables"):
                for table in doc.tables:
                    table_data = {
                        "rows": [],
                        "headers": [],
                    }

                    # Extract table data
                    if hasattr(table, "data"):
                        table_data["rows"] = table.data

                    if hasattr(table, "headers"):
                        table_data["headers"] = table.headers

                    tables.append(table_data)

            return tables
        except Exception as e:
            return [{"error": str(e)}]

    def _extract_images(self, result: Any) -> List[Dict[str, Any]]:
        """Extract images from document."""
        try:
            doc = result.document
            images = []

            if hasattr(doc, "pictures"):
                for idx, picture in enumerate(doc.pictures):
                    image_data = {
                        "index": idx,
                        "caption": getattr(picture, "caption", ""),
                        "page": getattr(picture, "page", 0),
                    }
                    images.append(image_data)

            return images
        except Exception as e:
            return [{"error": str(e)}]

    def _extract_patient_info(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract patient information from medical document."""
        import re

        text = parsed_doc.get("content", {}).get("full_text", "")

        # Simple pattern matching (would be enhanced with NER)
        patient_info = {}

        # Extract name
        name_pattern = r"Patient Name:?\s*([A-Za-z\s]+)"
        name_match = re.search(name_pattern, text, re.IGNORECASE)
        if name_match:
            patient_info["name"] = name_match.group(1).strip()

        # Extract age
        age_pattern = r"Age:?\s*(\d+)"
        age_match = re.search(age_pattern, text, re.IGNORECASE)
        if age_match:
            patient_info["age"] = int(age_match.group(1))

        return patient_info

    def _extract_test_results(self, parsed_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract test results from medical document."""
        # This would use table extraction and pattern matching
        tables = parsed_doc.get("tables", [])
        test_results = []

        for table in tables:
            # Assume test results are in tables
            if table.get("headers"):
                # Process table data
                pass

        return test_results

    def _extract_diagnoses(self, parsed_doc: Dict[str, Any]) -> List[str]:
        """Extract diagnoses from medical document."""
        # Would use medical NER or pattern matching
        return []

    def _extract_medications(self, parsed_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract medications from medical document."""
        return []

    def _extract_vital_signs(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract vital signs from medical document."""
        import re

        text = parsed_doc.get("content", {}).get("full_text", "")
        vital_signs = {}

        # Blood pressure
        bp_pattern = r"BP:?\s*(\d+/\d+)"
        bp_match = re.search(bp_pattern, text, re.IGNORECASE)
        if bp_match:
            vital_signs["blood_pressure"] = bp_match.group(1)

        # Temperature
        temp_pattern = r"Temp:?\s*(\d+\.?\d*)"
        temp_match = re.search(temp_pattern, text, re.IGNORECASE)
        if temp_match:
            vital_signs["temperature"] = float(temp_match.group(1))

        return vital_signs

    def _extract_account_info(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract account information from financial document."""
        import re

        text = parsed_doc.get("content", {}).get("full_text", "")
        account_info = {}

        # Extract account number
        account_pattern = r"Account\s*(?:Number|No\.?)?:?\s*(\d{10})"
        account_match = re.search(account_pattern, text, re.IGNORECASE)
        if account_match:
            account_info["account_number"] = account_match.group(1)

        return account_info

    def _extract_transactions(self, parsed_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract transactions from financial document."""
        # Would parse transaction tables
        return []

    def _extract_balances(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract balance information."""
        return {}

    def _calculate_financial_stats(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate financial statistics."""
        return {}

    def _extract_applicant_info(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract applicant information from insurance application."""
        return {}

    def _extract_policy_details(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract policy details from application."""
        return {}

    def _extract_beneficiaries(self, parsed_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract beneficiary information."""
        return []

    def _extract_medical_history(self, parsed_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Extract medical history from application."""
        return {}

    def _extract_declarations(self, parsed_doc: Dict[str, Any]) -> List[str]:
        """Extract declarations from application."""
        return []


# Example usage
async def main():
    """Example usage of Docling service."""
    service = DoclingService()

    # Example: Parse a medical report
    result = await service.parse_medical_report("/path/to/medical_report.pdf")
    print(json.dumps(result, indent=2))

    # Example: Parse a bank statement
    financial_result = await service.parse_financial_statement(
        "/path/to/bank_statement.pdf"
    )
    print(json.dumps(financial_result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
