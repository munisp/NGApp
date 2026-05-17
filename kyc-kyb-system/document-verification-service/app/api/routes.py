from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional
from app.services.document_service import DocumentVerificationService
from app.models.document import DocumentType, OCREngine, DocumentResponse
from app.database import get_db
import aiofiles
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/verify", response_model=DocumentResponse)
async def verify_document(
    customer_id: str = Form(...),
    document_type: DocumentType = Form(...),
    ocr_engine: Optional[OCREngine] = Form(OCREngine.PADDLEOCR),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_ext = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{file_ext}")
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    service = DocumentVerificationService(db)
    document = await service.verify_document(customer_id, document_type, file_path, ocr_engine)
    
    return DocumentResponse.from_orm(document)

@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    service = DocumentVerificationService(db)
    document = service.get_document(document_id)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return DocumentResponse.from_orm(document)

@router.get("/customer/{customer_id}", response_model=list[DocumentResponse])
def get_customer_documents(customer_id: str, db: Session = Depends(get_db)):
    service = DocumentVerificationService(db)
    documents = service.get_customer_documents(customer_id)
    
    return [DocumentResponse.from_orm(doc) for doc in documents]

@router.post("/{document_id}/validate")
async def validate_document(document_id: str, db: Session = Depends(get_db)):
    service = DocumentVerificationService(db)
    document = service.get_document(document_id)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "document_id": str(document.id),
        "is_valid": document.verification_status.value == "verified",
        "confidence_score": document.confidence_score,
        "authenticity_score": document.authenticity_score,
        "fraud_indicators": document.fraud_indicators
    }
