"""
CAC (Corporate Affairs Commission) Service
Real implementation for Nigerian business/company verification
"""

import os
import logging
import hashlib
import hmac
import time
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CAC_API_URL = os.getenv("CAC_API_URL", "https://api.cac.gov.ng/v1")
CAC_API_KEY = os.getenv("CAC_API_KEY", "")
CAC_API_SECRET = os.getenv("CAC_API_SECRET", "")
CAC_ENVIRONMENT = os.getenv("CAC_ENVIRONMENT", "sandbox")
CAC_USE_MOCK = os.getenv("CAC_USE_MOCK", "false").lower() == "true"
CAC_TIMEOUT = int(os.getenv("CAC_TIMEOUT", "30"))
CAC_RETRY_COUNT = int(os.getenv("CAC_RETRY_COUNT", "3"))

REQUEST_COUNT = Counter("cac_requests_total", "Total CAC API requests", ["method", "status"])
REQUEST_LATENCY = Histogram("cac_request_latency_seconds", "CAC API request latency")
VERIFICATION_COUNT = Counter("cac_verifications_total", "Total company verifications", ["status"])


class CompanyVerificationRequest(BaseModel):
    rc_number: str = Field(..., description="Registration number (RC or BN number)")
    company_name: Optional[str] = Field(None, description="Company name for additional verification")
    company_type: Optional[str] = Field(None, description="Type: LLC, PLC, BN, IT, etc.")


class DirectorInfo(BaseModel):
    name: str
    designation: str
    nationality: Optional[str] = None
    date_of_appointment: Optional[str] = None


class CompanyDetails(BaseModel):
    rc_number: str
    company_name: str
    company_type: str
    registration_date: str
    status: str
    address: Optional[str] = None
    state: Optional[str] = None
    lga: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    share_capital: Optional[float] = None
    share_capital_currency: Optional[str] = None
    business_activity: Optional[str] = None
    directors: Optional[List[DirectorInfo]] = None


class CompanyVerificationResponse(BaseModel):
    success: bool
    rc_number: str
    verified: bool
    match_score: float = Field(ge=0, le=1)
    company: Optional[CompanyDetails] = None
    message: str
    timestamp: str
    request_id: str


class CompanySearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Search query (company name or RC number)")
    company_type: Optional[str] = Field(None, description="Filter by company type")
    state: Optional[str] = Field(None, description="Filter by state")
    limit: int = Field(default=10, ge=1, le=100)


class CompanySearchResult(BaseModel):
    rc_number: str
    company_name: str
    company_type: str
    status: str
    state: Optional[str] = None


class CompanySearchResponse(BaseModel):
    success: bool
    query: str
    total_results: int
    results: List[CompanySearchResult]
    timestamp: str
    request_id: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    mock_mode: bool
    timestamp: str


class CACClient:
    """Client for CAC API integration"""
    
    def __init__(self):
        self.base_url = CAC_API_URL
        self.api_key = CAC_API_KEY
        self.api_secret = CAC_API_SECRET
        self.environment = CAC_ENVIRONMENT
        self.timeout = CAC_TIMEOUT
        self.retry_count = CAC_RETRY_COUNT
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
    
    async def verify_company(self, request: CompanyVerificationRequest) -> dict:
        """Verify company registration against CAC database"""
        client = await self.get_client()
        
        payload = {
            "rc_number": request.rc_number,
            "verification_type": "full"
        }
        
        if request.company_name:
            payload["company_name"] = request.company_name
        if request.company_type:
            payload["company_type"] = request.company_type
        
        for attempt in range(self.retry_count):
            try:
                with REQUEST_LATENCY.time():
                    response = await client.post("/verify/company", json=payload)
                
                REQUEST_COUNT.labels(method="verify_company", status=response.status_code).inc()
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return {
                        "verified": False,
                        "match_score": 0.0,
                        "message": "Company not found in CAC database"
                    }
                elif response.status_code == 429:
                    logger.warning(f"Rate limited, attempt {attempt + 1}/{self.retry_count}")
                    await asyncio.sleep(2 ** attempt)
                    continue
                else:
                    logger.error(f"CAC API error: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"CAC API error: {response.text}"
                    )
            except httpx.TimeoutException:
                logger.warning(f"Timeout on attempt {attempt + 1}/{self.retry_count}")
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=504, detail="CAC API timeout")
            except httpx.RequestError as e:
                logger.error(f"Request error: {e}")
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=503, detail=f"CAC API unavailable: {str(e)}")
        
        raise HTTPException(status_code=503, detail="CAC API unavailable after retries")
    
    async def search_companies(self, request: CompanySearchRequest) -> dict:
        """Search for companies in CAC database"""
        client = await self.get_client()
        
        params = {
            "query": request.query,
            "limit": request.limit
        }
        
        if request.company_type:
            params["company_type"] = request.company_type
        if request.state:
            params["state"] = request.state
        
        for attempt in range(self.retry_count):
            try:
                with REQUEST_LATENCY.time():
                    response = await client.get("/search/companies", params=params)
                
                REQUEST_COUNT.labels(method="search_companies", status=response.status_code).inc()
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"CAC API error: {response.status_code}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"CAC API error: {response.text}"
                    )
            except httpx.TimeoutException:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=504, detail="CAC API timeout")
            except httpx.RequestError as e:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=503, detail=f"CAC API unavailable: {str(e)}")
        
        raise HTTPException(status_code=503, detail="CAC API unavailable after retries")
    
    async def get_company_details(self, rc_number: str) -> dict:
        """Get detailed company information"""
        client = await self.get_client()
        
        for attempt in range(self.retry_count):
            try:
                with REQUEST_LATENCY.time():
                    response = await client.get(f"/companies/{rc_number}")
                
                REQUEST_COUNT.labels(method="get_company_details", status=response.status_code).inc()
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    raise HTTPException(status_code=404, detail="Company not found")
                else:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"CAC API error: {response.text}"
                    )
            except httpx.TimeoutException:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=504, detail="CAC API timeout")
            except httpx.RequestError as e:
                if attempt == self.retry_count - 1:
                    raise HTTPException(status_code=503, detail=f"CAC API unavailable: {str(e)}")
        
        raise HTTPException(status_code=503, detail="CAC API unavailable after retries")
    
    async def close(self):
        if self._client:
            await self._client.aclose()


cac_client = CACClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting CAC Service in {CAC_ENVIRONMENT} mode")
    logger.info(f"Mock mode: {CAC_USE_MOCK}")
    yield
    await cac_client.close()
    logger.info("CAC Service shutdown complete")


app = FastAPI(
    title="CAC Verification Service",
    description="Nigerian Corporate Affairs Commission verification service",
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
    return f"cac-{int(time.time() * 1000)}-{hashlib.md5(str(time.time()).encode()).hexdigest()[:8]}"


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="cac-service",
        version="1.0.0",
        environment=CAC_ENVIRONMENT,
        mock_mode=CAC_USE_MOCK,
        timestamp=datetime.utcnow().isoformat()
    )


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/verify/company", response_model=CompanyVerificationResponse)
async def verify_company(request: CompanyVerificationRequest, background_tasks: BackgroundTasks):
    """
    Verify a company registration against CAC database.
    
    This endpoint performs real-time verification against the CAC API.
    For production use, ensure CAC_API_KEY and CAC_API_SECRET are configured.
    """
    request_id = generate_request_id()
    logger.info(f"Company verification request: {request_id} - RC: {request.rc_number}")
    
    rc_number = request.rc_number.upper().strip()
    if not rc_number:
        raise HTTPException(status_code=400, detail="RC number is required")
    
    if CAC_USE_MOCK:
        VERIFICATION_COUNT.labels(status="mock").inc()
        return CompanyVerificationResponse(
            success=True,
            rc_number=rc_number,
            verified=True,
            match_score=0.95,
            company=CompanyDetails(
                rc_number=rc_number,
                company_name=request.company_name or "MOCK COMPANY LIMITED",
                company_type=request.company_type or "LLC",
                registration_date="2020-01-15",
                status="ACTIVE",
                address="123 Mock Street, Victoria Island",
                state="Lagos",
                lga="Eti-Osa",
                email="info@mockcompany.com",
                phone="+234-1-234-5678",
                share_capital=10000000.0,
                share_capital_currency="NGN",
                business_activity="General Commerce",
                directors=[
                    DirectorInfo(
                        name="John Doe",
                        designation="Managing Director",
                        nationality="Nigerian",
                        date_of_appointment="2020-01-15"
                    ),
                    DirectorInfo(
                        name="Jane Smith",
                        designation="Director",
                        nationality="Nigerian",
                        date_of_appointment="2020-01-15"
                    )
                ]
            ),
            message="Company verified successfully (MOCK MODE)",
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    
    if not CAC_API_KEY or not CAC_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="CAC API credentials not configured. Set CAC_API_KEY and CAC_API_SECRET."
        )
    
    try:
        result = await cac_client.verify_company(request)
        
        verified = result.get("verified", False)
        VERIFICATION_COUNT.labels(status="verified" if verified else "not_verified").inc()
        
        company_data = result.get("company")
        company = None
        if company_data:
            directors = []
            for d in company_data.get("directors", []):
                directors.append(DirectorInfo(
                    name=d.get("name", ""),
                    designation=d.get("designation", ""),
                    nationality=d.get("nationality"),
                    date_of_appointment=d.get("date_of_appointment")
                ))
            
            company = CompanyDetails(
                rc_number=company_data.get("rc_number", rc_number),
                company_name=company_data.get("company_name", ""),
                company_type=company_data.get("company_type", ""),
                registration_date=company_data.get("registration_date", ""),
                status=company_data.get("status", ""),
                address=company_data.get("address"),
                state=company_data.get("state"),
                lga=company_data.get("lga"),
                email=company_data.get("email"),
                phone=company_data.get("phone"),
                share_capital=company_data.get("share_capital"),
                share_capital_currency=company_data.get("share_capital_currency"),
                business_activity=company_data.get("business_activity"),
                directors=directors if directors else None
            )
        
        return CompanyVerificationResponse(
            success=True,
            rc_number=rc_number,
            verified=verified,
            match_score=result.get("match_score", 0.0),
            company=company,
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


@app.post("/search/companies", response_model=CompanySearchResponse)
async def search_companies(request: CompanySearchRequest):
    """
    Search for companies in CAC database.
    
    Search by company name or RC number with optional filters.
    """
    request_id = generate_request_id()
    logger.info(f"Company search request: {request_id} - Query: {request.query}")
    
    if CAC_USE_MOCK:
        return CompanySearchResponse(
            success=True,
            query=request.query,
            total_results=2,
            results=[
                CompanySearchResult(
                    rc_number="RC123456",
                    company_name=f"{request.query.upper()} ENTERPRISES LIMITED",
                    company_type="LLC",
                    status="ACTIVE",
                    state="Lagos"
                ),
                CompanySearchResult(
                    rc_number="BN789012",
                    company_name=f"{request.query.upper()} VENTURES",
                    company_type="BN",
                    status="ACTIVE",
                    state="Abuja"
                )
            ],
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    
    if not CAC_API_KEY or not CAC_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="CAC API credentials not configured"
        )
    
    try:
        result = await cac_client.search_companies(request)
        
        results = []
        for company in result.get("results", []):
            results.append(CompanySearchResult(
                rc_number=company.get("rc_number", ""),
                company_name=company.get("company_name", ""),
                company_type=company.get("company_type", ""),
                status=company.get("status", ""),
                state=company.get("state")
            ))
        
        return CompanySearchResponse(
            success=True,
            query=request.query,
            total_results=result.get("total_results", len(results)),
            results=results,
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/companies/{rc_number}", response_model=CompanyVerificationResponse)
async def get_company_details(rc_number: str):
    """
    Get detailed information about a specific company.
    """
    request_id = generate_request_id()
    rc_number = rc_number.upper().strip()
    logger.info(f"Company details request: {request_id} - RC: {rc_number}")
    
    if CAC_USE_MOCK:
        return CompanyVerificationResponse(
            success=True,
            rc_number=rc_number,
            verified=True,
            match_score=1.0,
            company=CompanyDetails(
                rc_number=rc_number,
                company_name="MOCK COMPANY LIMITED",
                company_type="LLC",
                registration_date="2020-01-15",
                status="ACTIVE",
                address="123 Mock Street, Victoria Island",
                state="Lagos",
                lga="Eti-Osa",
                email="info@mockcompany.com",
                phone="+234-1-234-5678",
                share_capital=10000000.0,
                share_capital_currency="NGN",
                business_activity="General Commerce",
                directors=[
                    DirectorInfo(
                        name="John Doe",
                        designation="Managing Director",
                        nationality="Nigerian",
                        date_of_appointment="2020-01-15"
                    )
                ]
            ),
            message="Company details retrieved (MOCK MODE)",
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    
    if not CAC_API_KEY or not CAC_API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="CAC API credentials not configured"
        )
    
    try:
        result = await cac_client.get_company_details(rc_number)
        
        directors = []
        for d in result.get("directors", []):
            directors.append(DirectorInfo(
                name=d.get("name", ""),
                designation=d.get("designation", ""),
                nationality=d.get("nationality"),
                date_of_appointment=d.get("date_of_appointment")
            ))
        
        company = CompanyDetails(
            rc_number=result.get("rc_number", rc_number),
            company_name=result.get("company_name", ""),
            company_type=result.get("company_type", ""),
            registration_date=result.get("registration_date", ""),
            status=result.get("status", ""),
            address=result.get("address"),
            state=result.get("state"),
            lga=result.get("lga"),
            email=result.get("email"),
            phone=result.get("phone"),
            share_capital=result.get("share_capital"),
            share_capital_currency=result.get("share_capital_currency"),
            business_activity=result.get("business_activity"),
            directors=directors if directors else None
        )
        
        return CompanyVerificationResponse(
            success=True,
            rc_number=rc_number,
            verified=True,
            match_score=1.0,
            company=company,
            message="Company details retrieved successfully",
            timestamp=datetime.utcnow().isoformat(),
            request_id=request_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get company details error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get company details: {str(e)}")


@app.get("/status")
async def service_status():
    """Get detailed service status including API connectivity"""
    status = {
        "service": "cac-service",
        "version": "1.0.0",
        "environment": CAC_ENVIRONMENT,
        "mock_mode": CAC_USE_MOCK,
        "api_configured": bool(CAC_API_KEY and CAC_API_SECRET),
        "api_url": CAC_API_URL,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    if not CAC_USE_MOCK and CAC_API_KEY:
        try:
            client = await cac_client.get_client()
            response = await client.get("/health", timeout=5.0)
            status["api_status"] = "connected" if response.status_code == 200 else "error"
        except Exception as e:
            status["api_status"] = f"unreachable: {str(e)}"
    else:
        status["api_status"] = "mock_mode" if CAC_USE_MOCK else "not_configured"
    
    return status


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9006)
