from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Request
from sqlalchemy.orm import Session
from typing import Optional
from app.services.liveness_service import LivenessDetectionService
from app.services.face_matching import FaceMatchingService
from app.models.liveness import LivenessType, LivenessResponse
from app.database import get_db
from app.middleware.rbac import require_roles, Roles
import aiofiles
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/check", response_model=LivenessResponse)
@require_roles([Roles.KYC_ANALYST, Roles.SYSTEM_ADMIN])
async def check_liveness(
    request: Request,
    customer_id: str = Form(...),
    liveness_type: LivenessType = Form(LivenessType.PASSIVE),
    document_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_ext = os.path.splitext(file.filename)[1]
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{file_ext}")
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    service = LivenessDetectionService(db)
    check = await service.check_liveness(customer_id, file_path, liveness_type, document_id)
    
    return LivenessResponse.from_orm(check)

@router.get("/{check_id}", response_model=LivenessResponse)
@require_roles([Roles.KYC_ANALYST, Roles.COMPLIANCE_OFFICER, Roles.RISK_MANAGER, Roles.KYC_OPERATOR, Roles.SYSTEM_ADMIN])
async def get_liveness_check(request: Request, check_id: str, db: Session = Depends(get_db)):
    service = LivenessDetectionService(db)
    check = service.get_liveness_check(check_id)
    
    if not check:
        raise HTTPException(status_code=404, detail="Liveness check not found")
    
    return LivenessResponse.from_orm(check)

@router.get("/customer/{customer_id}", response_model=list[LivenessResponse])
@require_roles([Roles.KYC_ANALYST, Roles.COMPLIANCE_OFFICER, Roles.RISK_MANAGER, Roles.KYC_OPERATOR, Roles.SYSTEM_ADMIN])
async def get_customer_checks(request: Request, customer_id: str, db: Session = Depends(get_db)):
    service = LivenessDetectionService(db)
    checks = service.get_customer_checks(customer_id)
    
    return [LivenessResponse.from_orm(check) for check in checks]

@router.post("/match-faces")
@require_roles([Roles.KYC_ANALYST, Roles.SYSTEM_ADMIN])
async def match_faces(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(...)
):
    image1_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{os.path.splitext(image1.filename)[1]}")
    image2_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{os.path.splitext(image2.filename)[1]}")
    
    async with aiofiles.open(image1_path, 'wb') as out_file:
        content = await image1.read()
        await out_file.write(content)
    
    async with aiofiles.open(image2_path, 'wb') as out_file:
        content = await image2.read()
        await out_file.write(content)
    
    service = FaceMatchingService()
    result = service.match_faces(image1_path, image2_path)
    
    os.remove(image1_path)
    os.remove(image2_path)
    
    return result

@router.post("/extract-features")
@require_roles([Roles.KYC_ANALYST, Roles.SYSTEM_ADMIN])
async def extract_features(request: Request, file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}")
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    service = FaceMatchingService()
    features = service.extract_face_features(file_path)
    
    os.remove(file_path)
    
    return features
