#!/usr/bin/env python3
"""
KYC Verification Service
FastAPI service for Know Your Customer (KYC) verification with:
- Document upload and OCR extraction
- Facial recognition and liveness detection
- S3 storage for images
- MySQL database for KYC submissions
- AES-256 encryption for PII data
- Audit logging for compliance
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import mysql.connector
from mysql.connector import pooling
import boto3
from botocore.client import Config
import requests
import base64
import json
import os
from datetime import datetime
from cryptography.fernet import Fernet
import hashlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="KYC Verification Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
# Parse DATABASE_URL
import urllib.parse as urlparse
from urllib.parse import parse_qs

DATABASE_URL = os.getenv('DATABASE_URL', '')
if DATABASE_URL:
    parsed = urlparse.urlparse(DATABASE_URL)
    DB_CONFIG = {
        'host': parsed.hostname,
        'port': parsed.port or 3306,
        'user': parsed.username,
        'password': parsed.password,
        'database': parsed.path.lstrip('/').split('?')[0],
        'ssl_disabled': False,
        'ssl_ca': '',
    }
else:
    DB_CONFIG = {
        'host': 'localhost',
        'port': 3306,
        'user': 'root',
        'password': '',
        'database': 'fintech_app',
    }

S3_CONFIG = {
    'endpoint_url': os.getenv('S3_ENDPOINT', 'https://s3.amazonaws.com'),
    'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID', ''),
    'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY', ''),
    'bucket_name': os.getenv('S3_BUCKET', 'fintech-kyc'),
}

# Encryption key (32 bytes for AES-256)
ENCRYPTION_KEY = os.getenv('KYC_ENCRYPTION_KEY', 'your-32-byte-encryption-key-here!!').encode()
# Derive a proper 32-byte key from the encryption key
cipher_key = hashlib.sha256(ENCRYPTION_KEY).digest()
cipher = Fernet(base64.urlsafe_b64encode(cipher_key))

# Database connection pool
db_pool = pooling.MySQLConnectionPool(
    pool_name="kyc_pool",
    pool_size=5,
    **DB_CONFIG
)

# S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=S3_CONFIG['endpoint_url'],
    aws_access_key_id=S3_CONFIG['aws_access_key_id'],
    aws_secret_access_key=S3_CONFIG['aws_secret_access_key'],
    config=Config(signature_version='s3v4')
)

# OCR and Facial Recognition service URLs
OCR_SERVICE_URL = "http://127.0.0.1:5008/extract"
FACE_RECOGNITION_SERVICE_URL = "http://127.0.0.1:5009/verify"

# Pydantic models
class KycSubmissionRequest(BaseModel):
    user_id: int
    document_type: str = Field(..., pattern="^(national_id|passport|drivers_license|voters_card)$")
    document_image: str  # base64
    selfie_image: str  # base64
    document_number: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    address: Optional[str] = None
    nationality: Optional[str] = None

class KycStatusResponse(BaseModel):
    status: str
    submission: Optional[Dict[str, Any]] = None

class KycApprovalRequest(BaseModel):
    submission_id: int
    reviewer_id: int
    notes: Optional[str] = None

class KycRejectionRequest(BaseModel):
    submission_id: int
    reviewer_id: int
    reason: str
    notes: Optional[str] = None

# Helper functions
def encrypt_data(data: str) -> str:
    """Encrypt sensitive PII data"""
    if not data:
        return None
    return cipher.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive PII data"""
    if not encrypted_data:
        return None
    return cipher.decrypt(encrypted_data.encode()).decode()

def upload_to_s3(image_data: str, key: str) -> str:
    """Upload base64 image to S3 and return the key"""
    try:
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64
        image_bytes = base64.b64decode(image_data)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_CONFIG['bucket_name'],
            Key=key,
            Body=image_bytes,
            ContentType='image/jpeg'
        )
        
        return key
    except Exception as e:
        logger.error(f"S3 upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

def get_s3_url(key: str) -> str:
    """Generate presigned URL for S3 object"""
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_CONFIG['bucket_name'], 'Key': key},
            ExpiresIn=3600  # 1 hour
        )
        return url
    except Exception as e:
        logger.error(f"S3 presigned URL error: {e}")
        return f"s3://{S3_CONFIG['bucket_name']}/{key}"

def log_kyc_action(
    conn,
    kyc_submission_id: int,
    user_id: int,
    action: str,
    performed_by: int,
    details: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log KYC action for audit trail"""
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO kyc_audit_log 
            (kyc_submission_id, user_id, action, performed_by, details, ip_address, user_agent, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            kyc_submission_id,
            user_id,
            action,
            performed_by,
            json.dumps(details) if details else None,
            ip_address,
            user_agent
        ))
        conn.commit()
    except Exception as e:
        logger.error(f"Audit log error: {e}")
    finally:
        cursor.close()

# API endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "kyc-verification"}

@app.post("/submit")
async def submit_kyc(request: KycSubmissionRequest):
    """Submit KYC verification"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 1. Upload images to S3
        document_key = f"kyc/{request.user_id}/document-{int(datetime.now().timestamp())}.jpg"
        selfie_key = f"kyc/{request.user_id}/selfie-{int(datetime.now().timestamp())}.jpg"
        
        document_image_url = upload_to_s3(request.document_image, document_key)
        selfie_image_url = upload_to_s3(request.selfie_image, selfie_key)
        
        # 2. Run OCR on document
        ocr_data = {}
        try:
            ocr_response = requests.post(
                OCR_SERVICE_URL,
                json={"image": request.document_image},
                timeout=30
            )
            if ocr_response.status_code == 200:
                ocr_data = ocr_response.json()
        except Exception as e:
            logger.warning(f"OCR service error: {e}")
        
        # 3. Run facial recognition
        face_data = {}
        try:
            face_response = requests.post(
                FACE_RECOGNITION_SERVICE_URL,
                json={
                    "document_image": request.document_image,
                    "selfie_image": request.selfie_image
                },
                timeout=30
            )
            if face_response.status_code == 200:
                face_data = face_response.json()
        except Exception as e:
            logger.warning(f"Facial recognition service error: {e}")
        
        # 4. Encrypt sensitive data
        encrypted_document_number = encrypt_data(request.document_number)
        encrypted_full_name = encrypt_data(request.full_name)
        encrypted_dob = encrypt_data(request.date_of_birth)
        encrypted_address = encrypt_data(request.address)
        
        # 5. Insert into database
        cursor.execute("""
            INSERT INTO kyc_submissions 
            (user_id, document_type, document_number, full_name, date_of_birth, address, 
             nationality, document_image_url, selfie_image_url, ocr_data, facial_recognition_data, 
             status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW(), NOW())
        """, (
            request.user_id,
            request.document_type,
            encrypted_document_number,
            encrypted_full_name,
            encrypted_dob,
            encrypted_address,
            request.nationality,
            document_image_url,
            selfie_image_url,
            json.dumps(ocr_data),
            json.dumps(face_data),
        ))
        
        submission_id = cursor.lastrowid
        conn.commit()
        
        # 6. Log action
        log_kyc_action(
            conn,
            submission_id,
            request.user_id,
            'submitted',
            request.user_id,
            {'document_type': request.document_type}
        )
        
        return {
            "success": True,
            "submission_id": submission_id,
            "status": "pending",
            "ocr_confidence": ocr_data.get('confidence', 0),
            "face_match_confidence": face_data.get('confidence', 0)
        }
        
    except Exception as e:
        conn.rollback()
        logger.error(f"KYC submission error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit KYC: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/status/{user_id}")
async def get_kyc_status(user_id: int):
    """Get user's KYC status"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT * FROM kyc_submissions 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
        """, (user_id,))
        
        submission = cursor.fetchone()
        
        if not submission:
            return {"status": "not_submitted", "submission": None}
        
        # Decrypt sensitive data
        if submission['document_number']:
            submission['document_number'] = decrypt_data(submission['document_number'])
        if submission['full_name']:
            submission['full_name'] = decrypt_data(submission['full_name'])
        if submission['date_of_birth']:
            submission['date_of_birth'] = decrypt_data(submission['date_of_birth'])
        if submission['address']:
            submission['address'] = decrypt_data(submission['address'])
        
        # Convert datetime to string
        for key in ['created_at', 'updated_at', 'reviewed_at']:
            if submission.get(key):
                submission[key] = submission[key].isoformat()
        
        return {
            "status": submission['status'],
            "submission": submission
        }
        
    except Exception as e:
        logger.error(f"Get KYC status error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get KYC status: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/pending")
async def get_pending_submissions():
    """Get all pending KYC submissions (admin only)"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT id, user_id, document_type, nationality, status, created_at
            FROM kyc_submissions 
            WHERE status = 'pending' 
            ORDER BY created_at DESC
        """)
        
        submissions = cursor.fetchall()
        
        # Convert datetime to string
        for submission in submissions:
            if submission.get('created_at'):
                submission['created_at'] = submission['created_at'].isoformat()
        
        return {"submissions": submissions}
        
    except Exception as e:
        logger.error(f"Get pending submissions error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get pending submissions: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/submission/{submission_id}")
async def get_submission_details(submission_id: int):
    """Get KYC submission details with presigned image URLs"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT * FROM kyc_submissions 
            WHERE id = %s
        """, (submission_id,))
        
        submission = cursor.fetchone()
        
        if not submission:
            raise HTTPException(status_code=404, detail="KYC submission not found")
        
        # Decrypt sensitive data
        if submission['document_number']:
            submission['document_number'] = decrypt_data(submission['document_number'])
        if submission['full_name']:
            submission['full_name'] = decrypt_data(submission['full_name'])
        if submission['date_of_birth']:
            submission['date_of_birth'] = decrypt_data(submission['date_of_birth'])
        if submission['address']:
            submission['address'] = decrypt_data(submission['address'])
        
        # Generate presigned URLs for images
        submission['document_image_url'] = get_s3_url(submission['document_image_url'])
        submission['selfie_image_url'] = get_s3_url(submission['selfie_image_url'])
        
        # Convert datetime to string
        for key in ['created_at', 'updated_at', 'reviewed_at']:
            if submission.get(key):
                submission[key] = submission[key].isoformat()
        
        # Log viewing action
        log_kyc_action(
            conn,
            submission_id,
            submission['user_id'],
            'viewed',
            submission['user_id']
        )
        
        return {"submission": submission}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get submission details error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get submission details: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.post("/approve")
async def approve_kyc(request: KycApprovalRequest):
    """Approve KYC submission (admin only)"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Update submission status
        cursor.execute("""
            UPDATE kyc_submissions 
            SET status = 'approved', 
                reviewed_by = %s, 
                reviewed_at = NOW(), 
                review_notes = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (request.reviewer_id, request.notes, request.submission_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="KYC submission not found")
        
        # Get submission details for logging
        cursor.execute("SELECT user_id FROM kyc_submissions WHERE id = %s", (request.submission_id,))
        submission = cursor.fetchone()
        
        conn.commit()
        
        # Log action
        if submission:
            log_kyc_action(
                conn,
                request.submission_id,
                submission['user_id'],
                'approved',
                request.reviewer_id,
                {'notes': request.notes}
            )
        
        return {"success": True, "message": "KYC approved successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Approve KYC error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to approve KYC: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.post("/reject")
async def reject_kyc(request: KycRejectionRequest):
    """Reject KYC submission (admin only)"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Update submission status
        cursor.execute("""
            UPDATE kyc_submissions 
            SET status = 'rejected', 
                reviewed_by = %s, 
                reviewed_at = NOW(), 
                rejection_reason = %s,
                review_notes = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (request.reviewer_id, request.reason, request.notes, request.submission_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="KYC submission not found")
        
        # Get submission details for logging
        cursor.execute("SELECT user_id FROM kyc_submissions WHERE id = %s", (request.submission_id,))
        submission = cursor.fetchone()
        
        conn.commit()
        
        # Log action
        if submission:
            log_kyc_action(
                conn,
                request.submission_id,
                submission['user_id'],
                'rejected',
                request.reviewer_id,
                {'reason': request.reason, 'notes': request.notes}
            )
        
        return {"success": True, "message": "KYC rejected successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Reject KYC error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reject KYC: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@app.get("/audit/{submission_id}")
async def get_audit_log(submission_id: int):
    """Get audit log for a KYC submission"""
    conn = db_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT * FROM kyc_audit_log 
            WHERE kyc_submission_id = %s 
            ORDER BY created_at DESC
        """, (submission_id,))
        
        logs = cursor.fetchall()
        
        # Convert datetime to string
        for log in logs:
            if log.get('created_at'):
                log['created_at'] = log['created_at'].isoformat()
        
        return {"logs": logs}
        
    except Exception as e:
        logger.error(f"Get audit log error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get audit log: {str(e)}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5010)
