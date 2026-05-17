import cv2
import numpy as np
from paddleocr import PaddleOCR
from typing import Dict, Any, List, Tuple
import re
from datetime import datetime

class PaddleOCREngine:
    def __init__(self):
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
    
    def extract_text(self, image_path: str) -> Dict[str, Any]:
        result = self.ocr.ocr(image_path, cls=True)
        
        if not result or not result[0]:
            return {"raw_text": "", "confidence": 0.0, "lines": []}
        
        lines = []
        total_confidence = 0.0
        text_parts = []
        
        for line in result[0]:
            box, (text, confidence) = line
            lines.append({
                "text": text,
                "confidence": confidence,
                "bbox": box
            })
            text_parts.append(text)
            total_confidence += confidence
        
        avg_confidence = total_confidence / len(lines) if lines else 0.0
        raw_text = " ".join(text_parts)
        
        return {
            "raw_text": raw_text,
            "confidence": avg_confidence,
            "lines": lines
        }
    
    def extract_national_id(self, image_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(image_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_name(raw_text),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth", "Born"]),
            "gender": self._extract_gender(raw_text),
            "nin": self._extract_nin(raw_text),
            "address": self._extract_address(raw_text),
            "state": self._extract_state(raw_text),
            "document_number": self._extract_document_number(raw_text),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Issued"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Valid Until"]),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_passport(self, image_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(image_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_name(raw_text),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth"]),
            "gender": self._extract_gender(raw_text),
            "nationality": self._extract_nationality(raw_text),
            "passport_number": self._extract_passport_number(raw_text),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Date of Issue"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Date of Expiry"]),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_drivers_license(self, image_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(image_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_name(raw_text),
            "date_of_birth": self._extract_date(raw_text, ["DOB", "Date of Birth"]),
            "license_number": self._extract_license_number(raw_text),
            "issue_date": self._extract_date(raw_text, ["Issue Date", "Issued"]),
            "expiry_date": self._extract_date(raw_text, ["Expiry", "Valid Until"]),
            "address": self._extract_address(raw_text),
            "state": self._extract_state(raw_text),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_utility_bill(self, image_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(image_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "full_name": self._extract_name(raw_text),
            "address": self._extract_address(raw_text),
            "state": self._extract_state(raw_text),
            "bill_date": self._extract_date(raw_text, ["Bill Date", "Date", "Invoice Date"]),
            "account_number": self._extract_account_number(raw_text),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def extract_cac_certificate(self, image_path: str) -> Dict[str, Any]:
        ocr_result = self.extract_text(image_path)
        raw_text = ocr_result["raw_text"]
        
        extracted = {
            "company_name": self._extract_company_name(raw_text),
            "rc_number": self._extract_rc_number(raw_text),
            "registration_date": self._extract_date(raw_text, ["Registration Date", "Incorporated"]),
            "company_type": self._extract_company_type(raw_text),
            "address": self._extract_address(raw_text),
            "state": self._extract_state(raw_text),
            "raw_text": raw_text,
            "confidence": ocr_result["confidence"]
        }
        
        return extracted
    
    def _extract_name(self, text: str) -> str:
        patterns = [
            r"(?:Name|Full Name|Surname)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)",
            r"([A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return ""
    
    def _extract_date(self, text: str, keywords: List[str]) -> str:
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
        
        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0).strip()
        
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
    
    def _extract_address(self, text: str) -> str:
        match = re.search(r"(?:Address|Residential Address)[:\s]+(.{20,100})", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
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
    
    def _extract_document_number(self, text: str) -> str:
        match = re.search(r"(?:ID No|Document No|Card No)[:\s]+([A-Z0-9]{8,15})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_passport_number(self, text: str) -> str:
        match = re.search(r"(?:Passport No|P)[:\s]+([A-Z]\d{8})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_license_number(self, text: str) -> str:
        match = re.search(r"(?:License No|DL)[:\s]+([A-Z0-9]{10,15})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_account_number(self, text: str) -> str:
        match = re.search(r"(?:Account No|Customer No)[:\s]+(\d{10,15})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_nationality(self, text: str) -> str:
        match = re.search(r"(?:Nationality)[:\s]+([A-Z][a-z]+)", text, re.IGNORECASE)
        return match.group(1) if match else "Nigerian"
    
    def _extract_company_name(self, text: str) -> str:
        match = re.search(r"(?:Company Name|Name of Company)[:\s]+(.{5,100})", text, re.IGNORECASE)
        return match.group(1).strip() if match else ""
    
    def _extract_rc_number(self, text: str) -> str:
        match = re.search(r"(?:RC|RC No|Registration No)[:\s]+(\d{6,10})", text, re.IGNORECASE)
        return match.group(1) if match else ""
    
    def _extract_company_type(self, text: str) -> str:
        types = ["Limited", "PLC", "LTD", "Private Limited", "Public Limited"]
        for company_type in types:
            if company_type.lower() in text.lower():
                return company_type
        return ""
