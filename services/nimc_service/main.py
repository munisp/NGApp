"""
NIMC (National Identity Management Commission) Service
Real implementation for Nigerian NIN verification
"""

import os
import logging
import hashlib
import hmac
import time
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NIMC_API_URL = os.getenv("NIMC_API_URL", "https://api.nimc.gov.ng/v1")
NIMC_API_KEY = os.getenv("NIMC_API_KEY", "")
NIMC_API_SECRET = os.getenv("NIMC_API_SECRET", "")
NIMC_ENVIRONMENT = os.getenv("NIMC_ENVIRONMENT", "sandbox")
NIMC_USE_MOCK = os.getenv("NIMC_USE_MOCK", "false").lower() == "true"
NIMC_TIMEOUT = int(os.getenv("NIMC_TIMEOUT", "30"))
NIMC_RETRY_COUNT = int(os.getenv("NIMC_RETRY_COUNT", "3"))

REQUEST_COUNT = Counter("nimc_requests_total", "Total NIMC API requests", ["method", "status"])
REQUEST_LATENCY = Histogram("nimc_request_latency_seconds", "NIMC API request latency")
VERIFICATION_COUNT = Counter("nimc_verifications_total", "Total NIN verifications", ["status"])


class NINVerificationRequest(BaseModel):
    nin: str = Field(..., min_length=11, max_length=11, description="11-digit National Identification Number")
    first_name: Optional[str] = Field(None, description="First name for additional verification")
    last_name: Optional[str] = Field(None, description="Last name for additional verification")
    date_of_birth: Optional[str] = Field(None, description="Date of birth (YYYY-MM-DD)")
    phone_number: Optional[str] = Field(None, description="Phone number for OTP verification")


class NINVerificationResponse(BaseModel):
    success: bool
    nin: str
    verified: bool
    match_score: float = Field(ge=0, le=1)
    details: Optional[dict] = None
    message: str
    timestamp: str
    request_id: str


class BiometricVerificationRequest(BaseModel):
    nin: str = Field(..., min_length=11, max_length=11)
    fingerprint_data: Optional[str] = Field(None, description="Base64 encoded fingerprint template")
    face_image: Optional[str] = Field(None, description="Base64 encoded face image")


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    mock_mode: bool
    timestamp: str


class NIMCClient:
    """Client for NIMC API integration"""
    
    def __init__(self):
        self.base_url = NIMC_API_URL
        self.api_key = NIMC_API_KEY
        self.api_secret = NIMC_API_SECRET
        self.environment = NIMC_ENVIRONMENT
        self.timeout = NIMC_TIMEOUT
        self.retry_count = NIMC_RETRY_COUNT
        self._client: Optional[httpx.AsyncClient] = None
    
    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout),
                headers=self._get_headers()
            )
        return self._client
    
    def _get_headers(self) -> dict:
        timestamp = str(int(time.time()))
        signature = self._generate_signature(timestamp)
        return {
            "X-API-Key": self.api_key,
            "X-Timestamp": timestamp,
            "X-Signature": signature,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Environment": self.environment
        }
    
    def _generate_signature(self, timestamp: str) -> str:
        message = f"{self.api_key}{timestamp}"
        signature = hmac.new(
            self.api_secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    async def verify_nin(self, request: NINVerificationRequest) -> dict:
        """Verify NIN against NIMC database"""
        client = await self.get_client()
        
        payload = {
            "nin": request.nin,
            "verification_type": "basic"
        }
        
        if request.first_name:
            payload["first_name"] = request.first_name
        if request.last_name:
            payload["last_name"] = request.last_name
        if request.date_of_birth:
            payload["date_of_birth"] = request.date_of_birth
        
        for attempt in range(self.retry_count):
            try:
                with REQUEST_LATENCY.time():
                    response = await client.post("/verify/nin", json=payload)
                
                REQUEST_COUNT.labels(method="verify_nin", status=response.status_code).inc()
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return {
                        "verified": False,
                        "match_score": 0.0,
                        "message": "NIN not found in NIMC database"
                    }
                elif response.status_code == 429:
                    logger.warning(f"Rate limited, attempt {attempt + 1}/{self.retry_count}")
                    await asyncio.sleep(2 ** attempt)
                    continue
                else:
                    logger.error(f"NIMC API error: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"NIMC API error: {response.text}"
                    )
            except httpx.TimeoutException:
                logger.warning(f"Timeout on attempt {attempt + 1}/{self.retry_count}")
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=504, detail="NIMC API timeout")
            except httpx.RequestError as e:
                logger.error(f"Request error: {e}")
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=503, detail=f"NIMC API unavailable: {str(e)}")
        
        raise HTTPException(status_code=503, detail="NIMC API unavailable after retries")
    
    async def verify_biometric(self, request: BiometricVerificationRequest) -> dict:
        """Verify biometric data against NIMC database"""
        client = await self.get_client()
        
        payload = {
            "nin": request.nin,
            "verification_type": "biometric"
        }
        
        if request.fingerprint_data:
            payload["fingerprint_template"] = request.fingerprint_data
        if request.face_image:
            payload["face_image"] = request.face_image
        
        for attempt in range(self.retry_count):
            try:
                with REQUEST_LATENCY.time():
                    response = await client.post("/verify/biometric", json=payload)
                
                REQUEST_COUNT.labels(method="verify_biometric", status=response.status_code).inc()
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return {
                        "verified": False,
                        "match_score": 0.0,
                        "message": "NIN not found or biometric mismatch"
                    }
                else:
                    logger.error(f"NIMC API error: {response.status_code}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"NIMC API error: {response.text}"
                    )
            except httpx.TimeoutException:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=504, detail="NIMC API timeout")
            except httpx.RequestError as e:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=503, detail=f"NIMC API unavailable: {str(e)}")
        
        raise HTTPException(status_code=503, detail="NIMC API unavailable after retries")
    
    async def close(self):
        if self._client:
            await self._client.aclose()


nimc_client = NIMCClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting NIMC Service in {NIMC_ENVIRONMENT} mode")
    logger.info(f"Mock mode: {NIMC_USE_MOCK}")
    yield
    await nimc_client.close()
    logger.info("NIMC Service shutdown complete")


app = FastAPI(
    title="NIMC Verification Service",
    description="Nigerian National Identity Management Commission verification service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_request_id() -> str:
    return f"nimc-{int(time.time() * 1000)}-{hashlib.md5(str(time.time()).encode()).hexdigest()[:8]}"


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="nimc-service",
        version="1.0.0",
        environment=NIMC_ENVIRONMENT,
        mock_mode=NIMC_USE_MOCK,
        timestamp=datetime.utcnow().isoformat()
    )


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/verify/nin", response_model=NINVerificationResponse)
async def verify_nin(request: NINVerificationRequest, background_tasks: BackgroundTasks):
    """
    Verify a National Identification Number (NIN) against NIMC database.
    
    This endpoint performs real-time verification against the NIMC API.
    For production use, ensure NIMC_API_KEY and NIMC_API_SECRET are configured.
    """
    request_id = generate_request_id()
    logger.info(f"NIN verification request: {request_id}")
    
    if not request.nin.isdigit() or len(request.nin) != 11:
        raise HTTPException(status_code=400, detail="Invalid NIN format. Must be 11 digits.")
    
    if NIMC_USE_MOCK:
        VERIFICATION_COUNT.labels(status="mock").inc()
        return NINVerificationResponse(
            success=True,
            nin=request.nin,
            verified=True,
            match_score=0.95,
            details={
                "first_name": request.first_name or "MOCK",
                "last_name": request.last_name or "USER",
                "gender": "M",
                "date_of_birth": request.date_of_birth or "1990-01-01",
                "state_of_origin": "Lagos",
                "lga_of_origin": "Ikeja"
            },
            message="NIN verified successfully (MOCK MODE)",
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    
    if not NIMC_API_KEY or not NIMC_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="NIMC API credentials not configured. Set NIMC_API_KEY and NIMC_API_SECRET."
        )
    
    try:
        result = await nimc_client.verify_nin(request)
        
        verified = result.get("verified", False)
        VERIFICATION_COUNT.labels(status="verified" if verified else "not_verified").inc()
        
        return NINVerificationResponse(
            success=True,
            nin=request.nin,
            verified=verified,
            match_score=result.get("match_score", 0.0),
            details=result.get("details"),
            message=result.get("message", "Verification complete"),
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Verification error: {e}")
        VERIFICATION_COUNT.labels(status="error").inc()
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.post("/verify/biometric", response_model=NINVerificationResponse)
async def verify_biometric(request: BiometricVerificationRequest):
    """
    Verify biometric data (fingerprint/face) against NIMC database.
    
    This endpoint performs biometric verification against the NIMC API.
    Requires either fingerprint_data or face_image to be provided.
    """
    request_id = generate_request_id()
    logger.info(f"Biometric verification request: {request_id}")
    
    if not request.fingerprint_data and not request.face_image:
        raise HTTPException(
            status_code=400,
            detail="Either fingerprint_data or face_image must be provided"
        )
    
    if NIMC_USE_MOCK:
        VERIFICATION_COUNT.labels(status="mock_biometric").inc()
        return NINVerificationResponse(
            success=True,
            nin=request.nin,
            verified=True,
            match_score=0.92,
            details={
                "biometric_type": "fingerprint" if request.fingerprint_data else "face",
                "match_confidence": "high"
            },
            message="Biometric verified successfully (MOCK MODE)",
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    
    if not NIMC_API_KEY or not NIMC_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="NIMC API credentials not configured"
        )
    
    try:
        result = await nimc_client.verify_biometric(request)
        
        verified = result.get("verified", False)
        VERIFICATION_COUNT.labels(status="biometric_verified" if verified else "biometric_not_verified").inc()
        
        return NINVerificationResponse(
            success=True,
            nin=request.nin,
            verified=verified,
            match_score=result.get("match_score", 0.0),
            details=result.get("details"),
            message=result.get("message", "Biometric verification complete"),
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Biometric verification error: {e}")
        VERIFICATION_COUNT.labels(status="biometric_error").inc()
        raise HTTPException(status_code=500, detail=f"Biometric verification failed: {str(e)}")


@app.get("/status")
async def service_status():
    """Get detailed service status including API connectivity"""
    status = {
        "service": "nimc-service",
        "version": "1.0.0",
        "environment": NIMC_ENVIRONMENT,
        "mock_mode": NIMC_USE_MOCK,
        "api_configured": bool(NIMC_API_KEY and NIMC_API_SECRET),
        "api_url": NIMC_API_URL,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if not NIMC_USE_MOCK and NIMC_API_KEY:
        try:
            client = await nimc_client.get_client()
            response = await client.get("/health", timeout=5.0)
            status["api_status"] = "connected" if response.status_code == 200 else "error"
        except Exception as e:
            status["api_status"] = f"unreachable: {str(e)}"
    else:
        status["api_status"] = "mock_mode" if NIMC_USE_MOCK else "not_configured"
    
    return status


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9005)
