from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentType, OCREngine, VerificationStatus
from app.ocr.paddleocr_engine import PaddleOCREngine
from app.ocr.vlm_engine import VLMEngine
from app.ocr.docling_engine import DoclingEngine
from app.services.fraud_detection import FraudDetector
import uuid
from datetime import datetime
import logging
from dapr.clients import DaprClient
import json

logger = logging.getLogger(__name__)

class DocumentVerificationService:
    def __init__(self, db: Session):
        self.db = db
        self.paddleocr = PaddleOCREngine()
        self.vlm = VLMEngine()
        self.docling = DoclingEngine()
        self.fraud_detector = FraudDetector()
        self.dapr_client = DaprClient()
    
    async def verify_document(
        self,
        customer_id: str,
        document_type: DocumentType,
        file_path: str,
        ocr_engine: OCREngine = OCREngine.PADDLEOCR
    ) -> Document:
        doc = Document(
            id=uuid.uuid4(),
            customer_id=uuid.UUID(customer_id),
            document_type=document_type,
            file_path=file_path,
            ocr_engine=ocr_engine,
            verification_status=VerificationStatus.PROCESSING
        )
        
        self.db.add(doc)
        self.db.commit()
        
        try:
            extracted_data = await self._extract_data(file_path, document_type, ocr_engine)
            
            doc.extracted_data = extracted_data
            doc.confidence_score = extracted_data.get("confidence", 0.0)
            doc.document_number = extracted_data.get("document_number") or extracted_data.get("nin") or extracted_data.get("passport_number") or extracted_data.get("rc_number")
            
            fraud_result = self.fraud_detector.detect_fraud(file_path, extracted_data, document_type)
            doc.fraud_indicators = fraud_result["indicators"]
            doc.authenticity_score = fraud_result["authenticity_score"]
            
            if fraud_result["is_fraud"]:
                doc.verification_status = VerificationStatus.REJECTED
            elif doc.confidence_score >= 0.7 and fraud_result["authenticity_score"] >= 0.6:
                doc.verification_status = VerificationStatus.VERIFIED
            else:
                doc.verification_status = VerificationStatus.PENDING
            
            doc.verified_at = datetime.utcnow()
            self.db.commit()
            
            await self._publish_event(doc)
            
            return doc
            
        except Exception as e:
            logger.error(f"Document verification failed: {str(e)}")
            doc.verification_status = VerificationStatus.FAILED
            self.db.commit()
            raise
    
    async def _extract_data(self, file_path: str, document_type: DocumentType, ocr_engine: OCREngine) -> Dict[str, Any]:
        engine = self._get_engine(ocr_engine)
        
        extraction_methods = {
            DocumentType.NATIONAL_ID: engine.extract_national_id,
            DocumentType.PASSPORT: engine.extract_passport,
            DocumentType.DRIVERS_LICENSE: engine.extract_drivers_license,
            DocumentType.UTILITY_BILL: engine.extract_utility_bill,
            DocumentType.CAC_CERTIFICATE: engine.extract_cac_certificate
        }
        
        method = extraction_methods.get(document_type, engine.extract_text)
        return method(file_path)
    
    def _get_engine(self, ocr_engine: OCREngine):
        engines = {
            OCREngine.PADDLEOCR: self.paddleocr,
            OCREngine.VLM: self.vlm,
            OCREngine.DOCLING: self.docling
        }
        return engines.get(ocr_engine, self.paddleocr)
    
    async def _publish_event(self, doc: Document):
        event_data = {
            "document_id": str(doc.id),
            "customer_id": str(doc.customer_id),
            "document_type": doc.document_type.value,
            "verification_status": doc.verification_status.value,
            "confidence_score": doc.confidence_score,
            "authenticity_score": doc.authenticity_score,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        try:
            self.dapr_client.publish_event(
                pubsub_name="kafka-pubsub",
                topic_name="kyc.document.verified",
                data=json.dumps(event_data)
            )
        except Exception as e:
            logger.error(f"Failed to publish event: {str(e)}")
    
    def get_document(self, document_id: str) -> Optional[Document]:
        return self.db.query(Document).filter(Document.id == uuid.UUID(document_id)).first()
    
    def get_customer_documents(self, customer_id: str) -> list[Document]:
        return self.db.query(Document).filter(Document.customer_id == uuid.UUID(customer_id)).all()
