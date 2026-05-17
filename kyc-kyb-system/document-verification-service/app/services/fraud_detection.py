import cv2
import numpy as np
from typing import Dict, Any
from app.models.document import DocumentType
import logging

logger = logging.getLogger(__name__)

class FraudDetector:
    def detect_fraud(self, image_path: str, extracted_data: Dict[str, Any], document_type: DocumentType) -> Dict[str, Any]:
        indicators = {}
        fraud_score = 0
        
        image_checks = self._check_image_quality(image_path)
        indicators.update(image_checks["indicators"])
        fraud_score += image_checks["score"]
        
        text_checks = self._check_text_consistency(extracted_data, document_type)
        indicators.update(text_checks["indicators"])
        fraud_score += text_checks["score"]
        
        tampering_checks = self._check_tampering(image_path)
        indicators.update(tampering_checks["indicators"])
        fraud_score += tampering_checks["score"]
        
        authenticity_score = max(0, 100 - fraud_score) / 100.0
        is_fraud = fraud_score > 50
        
        return {
            "is_fraud": is_fraud,
            "fraud_score": fraud_score,
            "authenticity_score": authenticity_score,
            "indicators": indicators
        }
    
    def _check_image_quality(self, image_path: str) -> Dict[str, Any]:
        indicators = {}
        score = 0
        
        try:
            image = cv2.imread(image_path)
            
            if image is None:
                indicators["invalid_image"] = True
                return {"indicators": indicators, "score": 100}
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            if laplacian_var < 100:
                indicators["blurry_image"] = True
                score += 20
            
            brightness = np.mean(gray)
            if brightness < 50 or brightness > 200:
                indicators["poor_lighting"] = True
                score += 10
            
            height, width = image.shape[:2]
            if height < 600 or width < 800:
                indicators["low_resolution"] = True
                score += 15
            
        except Exception as e:
            logger.error(f"Image quality check failed: {str(e)}")
            indicators["check_failed"] = True
            score += 30
        
        return {"indicators": indicators, "score": score}
    
    def _check_text_consistency(self, extracted_data: Dict[str, Any], document_type: DocumentType) -> Dict[str, Any]:
        indicators = {}
        score = 0
        
        required_fields = self._get_required_fields(document_type)
        
        missing_fields = []
        for field in required_fields:
            if not extracted_data.get(field):
                missing_fields.append(field)
        
        if missing_fields:
            indicators["missing_fields"] = missing_fields
            score += len(missing_fields) * 5
        
        if document_type == DocumentType.NATIONAL_ID:
            nin = extracted_data.get("nin", "")
            if nin and not self._validate_nin(nin):
                indicators["invalid_nin_format"] = True
                score += 25
        
        if document_type == DocumentType.PASSPORT:
            passport_num = extracted_data.get("passport_number", "")
            if passport_num and not self._validate_passport_number(passport_num):
                indicators["invalid_passport_format"] = True
                score += 25
        
        dob = extracted_data.get("date_of_birth", "")
        if dob and not self._validate_date(dob):
            indicators["invalid_date_format"] = True
            score += 10
        
        return {"indicators": indicators, "score": score}
    
    def _check_tampering(self, image_path: str) -> Dict[str, Any]:
        indicators = {}
        score = 0
        
        try:
            image = cv2.imread(image_path)
            
            if image is None:
                return {"indicators": indicators, "score": 0}
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            if edge_density > 0.15:
                indicators["excessive_edges"] = True
                score += 15
            
            noise_level = np.std(gray)
            if noise_level > 50:
                indicators["high_noise"] = True
                score += 10
            
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            color_variance = np.var(hsv[:,:,0])
            if color_variance < 100:
                indicators["low_color_variance"] = True
                score += 10
            
        except Exception as e:
            logger.error(f"Tampering check failed: {str(e)}")
        
        return {"indicators": indicators, "score": score}
    
    def _get_required_fields(self, document_type: DocumentType) -> list:
        fields_map = {
            DocumentType.NATIONAL_ID: ["full_name", "nin", "date_of_birth"],
            DocumentType.PASSPORT: ["full_name", "passport_number", "date_of_birth", "nationality"],
            DocumentType.DRIVERS_LICENSE: ["full_name", "license_number", "date_of_birth"],
            DocumentType.UTILITY_BILL: ["full_name", "address"],
            DocumentType.CAC_CERTIFICATE: ["company_name", "rc_number"]
        }
        return fields_map.get(document_type, [])
    
    def _validate_nin(self, nin: str) -> bool:
        return len(nin) == 11 and nin.isdigit()
    
    def _validate_passport_number(self, passport_num: str) -> bool:
        return len(passport_num) == 9 and passport_num[0].isalpha() and passport_num[1:].isdigit()
    
    def _validate_date(self, date_str: str) -> bool:
        import re
        patterns = [
            r"\d{2}[/-]\d{2}[/-]\d{4}",
            r"\d{4}[/-]\d{2}[/-]\d{2}",
            r"\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}"
        ]
        return any(re.match(pattern, date_str) for pattern in patterns)
