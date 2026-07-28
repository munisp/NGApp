from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from app.models import (
    NINVerificationRequest,
    NINVerificationResponse,
    CACVerificationRequest,
    CACVerificationResponse,
    BulkNINVerificationRequest,
    BulkNINVerificationResponse,
    BiometricVerificationRequest,
    BiometricVerificationResponse
)
from app.services.nin_service import NINVerificationService
from app.services.cac_service import CACVerificationService
from app.services.kafka_producer import KafkaEventProducer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global services
nin_service: NINVerificationService = None
cac_service: CACVerificationService = None
kafka_producer: KafkaEventProducer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global nin_service, cac_service, kafka_producer
    
    # Startup
    logger.info("Starting Verification Service...")
    nin_service = NINVerificationService()
    cac_service = CACVerificationService()
    kafka_producer = KafkaEventProducer()
    logger.info("Verification Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Verification Service...")
    if kafka_producer:
        kafka_producer.close()
    logger.info("Verification Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Insurance Verification Service",
    description="NIN, CAC, and biometric verification service for insurance platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "verification-service",
        "version": "1.0.0"
    }


@app.post("/api/v1/verify/nin", response_model=NINVerificationResponse)
async def verify_nin(request: NINVerificationRequest):
    """
    Verify National Identification Number (NIN)
    
    Args:
        request: NIN verification request
        
    Returns:
        NINVerificationResponse with verification results
    """
    try:
        logger.info(f"NIN verification request for customer: {request.customer_id}")
        
        # Verify NIN
        response = await nin_service.verify_nin(request)
        
        # Publish event to Kafka
        await kafka_producer.publish_nin_verified_event(
            verification_id=response.verification_id,
            customer_id=request.customer_id,
            nin=request.nin,
            verified=response.verified,
            metadata={"status": response.status.value}
        )
        
        return response
        
    except Exception as e:
        logger.error(f"NIN verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/verify/nin/biometric", response_model=BiometricVerificationResponse)
async def verify_nin_biometric(request: BiometricVerificationRequest):
    """
    Verify NIN with biometric data (fingerprint or face)
    
    Args:
        request: Biometric verification request
        
    Returns:
        BiometricVerificationResponse with match results
    """
    try:
        logger.info(f"Biometric verification request for customer: {request.customer_id}")
        
        # Verify with biometrics
        response = await nin_service.verify_nin_with_biometrics(request)
        
        # Publish event to Kafka
        await kafka_producer.publish_nin_verified_event(
            verification_id=response.verification_id,
            customer_id=request.customer_id,
            nin=request.nin,
            verified=response.biometric_match,
            metadata={
                "biometric_match": response.biometric_match,
                "confidence_score": response.confidence_score
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Biometric verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/verify/nin/bulk", response_model=BulkNINVerificationResponse)
async def bulk_verify_nin(request: BulkNINVerificationRequest):
    """
    Bulk verify multiple NINs
    
    Args:
        request: Bulk NIN verification request
        
    Returns:
        BulkNINVerificationResponse with all verification results
    """
    try:
        logger.info(f"Bulk NIN verification request: {len(request.verifications)} records")
        
        # Verify all NINs
        results = await nin_service.bulk_verify_nin(request.verifications)
        
        # Count successes and failures
        successful_count = sum(1 for r in results if r.verified)
        failed_count = len(results) - successful_count
        
        # Generate batch ID
        import uuid
        batch_id = str(uuid.uuid4())
        
        # Publish events for each verification
        for result in results:
            await kafka_producer.publish_nin_verified_event(
                verification_id=result.verification_id,
                customer_id=result.customer_id,
                nin=result.nin,
                verified=result.verified,
                metadata={"batch_id": batch_id}
            )
        
        return BulkNINVerificationResponse(
            batch_id=batch_id,
            total_count=len(results),
            successful_count=successful_count,
            failed_count=failed_count,
            results=results
        )
        
    except Exception as e:
        logger.error(f"Bulk NIN verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/verify/cac", response_model=CACVerificationResponse)
async def verify_cac(request: CACVerificationRequest):
    """
    Verify Corporate Affairs Commission (CAC) registration
    
    Args:
        request: CAC verification request
        
    Returns:
        CACVerificationResponse with verification results
    """
    try:
        logger.info(f"CAC verification request for customer: {request.customer_id}")
        
        # Verify CAC
        response = await cac_service.verify_cac(request)
        
        # Publish event to Kafka
        await kafka_producer.publish_cac_verified_event(
            verification_id=response.verification_id,
            customer_id=request.customer_id,
            cac_number=request.cac_number,
            verified=response.verified,
            metadata={"status": response.status.value}
        )
        
        return response
        
    except Exception as e:
        logger.error(f"CAC verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/company/{cac_number}")
async def get_company_details(cac_number: str):
    """
    Get detailed company information from CAC
    
    Args:
        cac_number: CAC registration number
        
    Returns:
        Company details
    """
    try:
        logger.info(f"Company details request for RC: {cac_number}")
        
        details = await cac_service.get_company_details(cac_number)
        
        return details
        
    except Exception as e:
        logger.error(f"Company details error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("ENVIRONMENT") == "development"
    )
