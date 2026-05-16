import httpx
import logging
from datetime import datetime
from typing import Dict, Any
import uuid
import os

from app.models import (
    CACVerificationRequest,
    CACVerificationResponse,
    VerificationStatus
)

logger = logging.getLogger(__name__)


class CACVerificationService:
    """Service for CAC (Corporate Affairs Commission) verification"""
    
    def __init__(self):
        self.cac_api_url = os.getenv("CAC_API_URL", "https://api.cac.gov.ng/v1")
        self.cac_api_key = os.getenv("CAC_API_KEY", "")
        self.timeout = 30.0
        
    async def verify_cac(self, request: CACVerificationRequest) -> CACVerificationResponse:
        """
        Verify CAC registration number
        
        Args:
            request: CAC verification request
            
        Returns:
            CACVerificationResponse with verification results
        """
        verification_id = str(uuid.uuid4())
        
        try:
            # Call CAC API
            verification_data = await self._call_cac_api(request)
            
            # Validate company name
            is_verified = self._validate_company_data(request, verification_data)
            
            if is_verified:
                return CACVerificationResponse(
                    verification_id=verification_id,
                    cac_number=request.cac_number,
                    customer_id=request.customer_id,
                    status=VerificationStatus.VERIFIED,
                    verified=True,
                    verification_data=verification_data,
                    verified_at=datetime.utcnow(),
                    created_at=datetime.utcnow()
                )
            else:
                return CACVerificationResponse(
                    verification_id=verification_id,
                    cac_number=request.cac_number,
                    customer_id=request.customer_id,
                    status=VerificationStatus.FAILED,
                    verified=False,
                    error_message="Company name mismatch",
                    created_at=datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"CAC verification failed: {str(e)}")
            return CACVerificationResponse(
                verification_id=verification_id,
                cac_number=request.cac_number,
                customer_id=request.customer_id,
                status=VerificationStatus.FAILED,
                verified=False,
                error_message=str(e),
                created_at=datetime.utcnow()
            )
    
    async def _call_cac_api(self, request: CACVerificationRequest) -> Dict[str, Any]:
        """
        Call CAC API to verify registration
        
        Args:
            request: CAC verification request
            
        Returns:
            Verification data from CAC
        """
        headers = {
            "Authorization": f"Bearer {self.cac_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "rc_number": request.cac_number,
            "company_name": request.company_name
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.cac_api_url}/verify",
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"CAC verification successful for RC: {request.cac_number}")
                
                return data
                
            except httpx.HTTPStatusError as e:
                logger.error(f"CAC API error: {e.response.status_code} - {e.response.text}")
                # In development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return self._get_mock_cac_data(request)
                raise Exception(f"CAC API error: {e.response.status_code}")
                
            except httpx.RequestError as e:
                logger.error(f"CAC API request error: {str(e)}")
                # In development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return self._get_mock_cac_data(request)
                raise Exception(f"CAC API request failed: {str(e)}")
    
    def _get_mock_cac_data(self, request: CACVerificationRequest) -> Dict[str, Any]:
        """
        Get mock CAC data for development/testing
        
        Args:
            request: CAC verification request
            
        Returns:
            Mock CAC data
        """
        return {
            "rc_number": request.cac_number,
            "company_name": request.company_name,
            "company_type": "LIMITED LIABILITY COMPANY",
            "registration_date": "2020-01-15",
            "status": "ACTIVE",
            "address": "123 Business District, Victoria Island, Lagos",
            "state": "Lagos",
            "email": "info@company.com",
            "phone": "08012345678",
            "directors": [
                {
                    "name": "John Doe",
                    "position": "Managing Director",
                    "appointment_date": "2020-01-15"
                }
            ],
            "share_capital": "10000000",
            "verification_date": datetime.utcnow().isoformat()
        }
    
    def _validate_company_data(
        self, 
        request: CACVerificationRequest, 
        verification_data: Dict[str, Any]
    ) -> bool:
        """
        Validate company data against request
        
        Args:
            request: Original verification request
            verification_data: Data returned from CAC
            
        Returns:
            True if data matches, False otherwise
        """
        # Check if RC number matches
        if verification_data.get("rc_number") != request.cac_number:
            logger.warning(f"RC number mismatch for customer {request.customer_id}")
            return False
        
        # Check company name (allow partial match)
        api_company_name = verification_data.get("company_name", "").lower()
        request_company_name = request.company_name.lower()
        
        if request_company_name not in api_company_name and api_company_name not in request_company_name:
            logger.warning(f"Company name mismatch for customer {request.customer_id}")
            return False
        
        # Check if company is active
        if verification_data.get("status", "").upper() != "ACTIVE":
            logger.warning(f"Company not active for customer {request.customer_id}")
            return False
        
        return True
    
    async def get_company_details(self, cac_number: str) -> Dict[str, Any]:
        """
        Get detailed company information from CAC
        
        Args:
            cac_number: CAC registration number
            
        Returns:
            Company details
        """
        headers = {
            "Authorization": f"Bearer {self.cac_api_key}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(
                    f"{self.cac_api_url}/company/{cac_number}",
                    headers=headers
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"Company details retrieved for RC: {cac_number}")
                
                return data
                
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.error(f"CAC API error: {str(e)}")
                # In development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return self._get_mock_cac_data(
                        CACVerificationRequest(
                            cac_number=cac_number,
                            company_name="Mock Company Ltd",
                            customer_id="mock-customer-id"
                        )
                    )
                raise Exception(f"CAC API failed: {str(e)}")
