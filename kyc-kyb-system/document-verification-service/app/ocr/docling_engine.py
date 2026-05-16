from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from typing import Dict, Any
import json
import re

class DoclingEngine:
    def __init__(self):
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        
        self.converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF, InputFormat.IMAGE],
            pipeline_options=pipeline_options
        )
    
    def extract_text(self, file_path: str) -> Dict[str, Any]:
        result = self.converter.convert(file_path)
        
        if not result or not result.document:
            return {"raw_text": "", "confidence": 0.0, "structured_data": {}}
        
        doc = result.document
        raw_text = doc.export_to_markdown()
        
        structured_data = {
            "tables": [],
            "sections": [],
            "metadata": {}
        }
        
        if hasattr(doc, 'tables') and doc.tables:
            for table in doc.tables:
                structured_data["tables"].append(self._table_to_dict(table))
        
        if hasattr(doc, 'sections') and doc.sections:
            for section in doc.sections:
                structured_data["sections"].append({
                    "title": getattr(section, 'title', ''),
                    "content": getattr(section, 'text', '')
                })
        
        return {
            "raw_text": raw_text,
            "confidence": 0.90,
            "structured_data": structured_data
        }
    
    def extract_national_id(self, file_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(file_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_field(raw_text, ["Name", "Full Name", "Surname"]),
            "nin": self._extract_nin(raw_text),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth", "Born"]),
            "gender": self._extract_gender(raw_text),
            "address": self._extract_field(raw_text, ["Address", "Residential Address"]),
            "state": self._extract_state(raw_text),
            "document_number": self._extract_field(raw_text, ["ID No", "Document No", "Card No"]),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Issued"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Valid Until"]),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_passport(self, file_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(file_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_field(raw_text, ["Name", "Full Name", "Surname"]),
            "passport_number": self._extract_passport_number(raw_text),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth"]),
            "gender": self._extract_gender(raw_text),
            "nationality": self._extract_field(raw_text, ["Nationality"]),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Date of Issue"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Date of Expiry"]),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_drivers_license(self, file_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(file_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_field(raw_text, ["Name", "Full Name"]),
            "license_number": self._extract_field(raw_text, ["License No", "DL", "License Number"]),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth"]),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Issued"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Valid Until"]),
            "address": self._extract_field(raw_text, ["Address"]),
            "state": self._extract_state(raw_text),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_utility_bill(self, file_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(file_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_field(raw_text, ["Customer Name", "Name", "Account Name"]),
            "address": self._extract_field(raw_text, ["Address", "Billing Address", "Service Address"]),
            "state": self._extract_state(raw_text),
            "bill_date": self._extract_date(raw_text, ["Bill Date", "Date", "Invoice Date"]),
            "account_number": self._extract_field(raw_text, ["Account No", "Customer No", "Account Number"]),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_cac_certificate(self, file_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(file_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "company_name": self._extract_field(raw_text, ["Company Name", "Name of Company"]),
            "rc_number": self._extract_rc_number(raw_text),
            "registration_date": self._extract_date(raw_text, ["Registration Date", "Incorporated", "Date of Incorporation"]),
            "company_type": self._extract_company_type(raw_text),
            "address": self._extract_field(raw_text, ["Address", "Registered Address", "Office Address"]),
            "state": self._extract_state(raw_text),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def _table_to_dict(self, table) -> Dict[str, Any]:
        return {
            "rows": getattr(table, 'num_rows', 0),
            "cols": getattr(table, 'num_cols', 0),
            "data": str(table)
        }
    
    def _extract_field(self, text: str, keywords: list) -> str:
        for keyword in keywords:
            pattern = f"{keyword}[:\s]+(.{{5,100}})"
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value = match.group(1).strip()
                value = re.split(r'\n|  ', value)[0]
                return value
        return ""
    
    def _extract_date(self, text: str, keywords: list) -> str:
        date_patterns = [
            r"\d{2}[/-]\d{2}[/-]\d{4}",
            r"\d{4}[/-]\d{2}[/-]\d{2}",
            r"\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}",
        ]
        
        for keyword in keywords:
            for pattern in date_patterns:
                regex = f"{keyword}[:\s]+({pattern})"
                match = re.search(regex, text, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
        
        return ""
    
    def _extract_gender(self, text: str) -> str:
        match = re.search(r"(?:Gender|Sex)[:\s]+(Male|Female|M|F)", text, re.IGNORECASE)
        if match:
            gender = match.group(1).upper()
            return "Male" if gender in ["MALE", "M"] else "Female"
        return ""
    
    def _extract_nin(self, text: str) -> str:
        match = re.search(r"(?:NIN|National ID)[:\s]+(\d{11})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_passport_number(self, text: str) -> str:
        match = re.search(r"(?:Passport No|P)[:\s]+([A-Z]\d{8})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_rc_number(self, text: str) -> str:
        match = re.search(r"(?:RC|RC No|Registration No)[:\s]+(\d{6,10})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_state(self, text: str) -> str:
        nigerian_states = [
            "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
            "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
            "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
            "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT"
        ]
        for state in nigerian_states:
            if state.lower() in text.lower():
                return state
        return ""
    
    def _extract_company_type(self, text: str) -> str:
        types = ["Limited", "PLC", "LTD", "Private Limited", "Public Limited", "LLC"]
        for company_type in types:
            if company_type.lower() in text.lower():
                return company_type
        return ""
