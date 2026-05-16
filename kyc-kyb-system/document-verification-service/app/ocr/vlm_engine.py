from transformers import AutoProcessor, AutoModelForVision2Seq
from PIL import Image
import torch
from typing import Dict, Any
import json
import re

class VLMEngine:
    def __init__(self, model_name: str = "microsoft/Florence-2-large"):
        self.processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)
        self.model = AutoModelForVision2Seq.from_pretrained(model_name, trust_remote_code=True)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)
    
    def extract_text(self, image_path: str) -> Dict[str, Any]:
        image = Image.open(image_path).convert("RGB")
        
        prompt = "<OCR>"
        inputs = self.processor(text=prompt, images=image, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=1024,
                do_sample=False
            )
        
        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        return {
            "raw_text": generated_text,
            "confidence": 0.85,
            "method": "vlm"
        }
    
    def extract_with_prompt(self, image_path: str, prompt: str) -> Dict[str, Any]:
        image = Image.open(image_path).convert("RGB")
        
        inputs = self.processor(text=prompt, images=image, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=False
            )
        
        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        return {
            "result": generated_text,
            "confidence": 0.85
        }
    
    def extract_national_id(self, image_path: str) -> Dict[str, Any]:
        prompts = {
            "full_name": "Extract the full name from this Nigerian National ID card",
            "nin": "Extract the NIN (National Identification Number) from this ID card",
            "date_of_birth": "Extract the date of birth from this ID card",
            "gender": "Extract the gender from this ID card",
            "address": "Extract the address from this ID card",
            "state": "Extract the state of origin from this ID card"
        }
        
        extracted = {}
        for field, prompt in prompts.items():
            result = self.extract_with_prompt(image_path, prompt)
            extracted[field] = self._clean_extracted_value(result["result"])
        
        ocr_result = self.extract_text(image_path)
        extracted["raw_text"] = ocr_result["raw_text"]
        extracted["confidence"] = ocr_result["confidence"]
        
        return extracted
    
    def extract_passport(self, image_path: str) -> Dict[str, Any]:
        prompts = {
            "full_name": "Extract the full name from this passport",
            "passport_number": "Extract the passport number",
            "date_of_birth": "Extract the date of birth",
            "gender": "Extract the gender",
            "nationality": "Extract the nationality",
            "issue_date": "Extract the issue date",
            "expiry_date": "Extract the expiry date"
        }
        
        extracted = {}
        for field, prompt in prompts.items():
            result = self.extract_with_prompt(image_path, prompt)
            extracted[field] = self._clean_extracted_value(result["result"])
        
        ocr_result = self.extract_text(image_path)
        extracted["raw_text"] = ocr_result["raw_text"]
        extracted["confidence"] = ocr_result["confidence"]
        
        return extracted
    
    def extract_drivers_license(self, image_path: str) -> Dict[str, Any]:
        prompts = {
            "full_name": "Extract the full name from this driver's license",
            "license_number": "Extract the license number",
            "date_of_birth": "Extract the date of birth",
            "issue_date": "Extract the issue date",
            "expiry_date": "Extract the expiry date",
            "address": "Extract the address",
            "state": "Extract the state"
        }
        
        extracted = {}
        for field, prompt in prompts.items():
            result = self.extract_with_prompt(image_path, prompt)
            extracted[field] = self._clean_extracted_value(result["result"])
        
        ocr_result = self.extract_text(image_path)
        extracted["raw_text"] = ocr_result["raw_text"]
        extracted["confidence"] = ocr_result["confidence"]
        
        return extracted
    
    def extract_utility_bill(self, image_path: str) -> Dict[str, Any]:
        prompts = {
            "full_name": "Extract the customer name from this utility bill",
            "address": "Extract the billing address",
            "state": "Extract the state",
            "bill_date": "Extract the bill date",
            "account_number": "Extract the account number"
        }
        
        extracted = {}
        for field, prompt in prompts.items():
            result = self.extract_with_prompt(image_path, prompt)
            extracted[field] = self._clean_extracted_value(result["result"])
        
        ocr_result = self.extract_text(image_path)
        extracted["raw_text"] = ocr_result["raw_text"]
        extracted["confidence"] = ocr_result["confidence"]
        
        return extracted
    
    def extract_cac_certificate(self, image_path: str) -> Dict[str, Any]:
        prompts = {
            "company_name": "Extract the company name from this CAC certificate",
            "rc_number": "Extract the RC number",
            "registration_date": "Extract the registration date",
            "company_type": "Extract the company type",
            "address": "Extract the registered address",
            "state": "Extract the state"
        }
        
        extracted = {}
        for field, prompt in prompts.items():
            result = self.extract_with_prompt(image_path, prompt)
            extracted[field] = self._clean_extracted_value(result["result"])
        
        ocr_result = self.extract_text(image_path)
        extracted["raw_text"] = ocr_result["raw_text"]
        extracted["confidence"] = ocr_result["confidence"]
        
        return extracted
    
    def _clean_extracted_value(self, value: str) -> str:
        value = value.strip()
        value = re.sub(r'^[:\-\s]+', '', value)
        value = re.sub(r'[:\-\s]+$', '', value)
        return value
