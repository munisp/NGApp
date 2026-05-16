import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import uuid
import os

from app.models import (
    NINVerificationRequest,
    NINVerificationResponse,
    VerificationStatus,
    BiometricVerificationRequest,
    BiometricVerificationResponse
)

logger = logging.getLogger(__name__)


class NINVerificationService:
    """Service for NIN verification using NIMC API"""
    
    def __init__(self):
        self.nimc_api_url = os.getenv("NIMC_API_URL", "https://api.nimc.gov.ng/v1")
        self.nimc_api_key = os.getenv("NIMC_API_KEY", "")
        self.timeout = 30.0
        
    async def verify_nin(self, request: NINVerificationRequest) -> NINVerificationResponse:
        """
        Verify NIN using NIMC API
        
        Args:
            request: NIN verification request
            
        Returns:
            NINVerificationResponse with verification results
        """
        verification_id = str(uuid.uuid4())
        
        try:
            # Call NIMC API
            verification_data = await self._call_nimc_api(request)
            
            # Validate response data
            is_verified = self._validate_verification_data(request, verification_data)
            
            if is_verified:
                return NINVerificationResponse(
                    verification_id=verification_id,
                    nin=request.nin,
                    customer_id=request.customer_id,
                    status=VerificationStatus.VERIFIED,
                    verified=True,
                    verification_data=verification_data,
                    verified_at=datetime.utcnow(),
                    created_at=datetime.utcnow()
                )
            else:
                return NINVerificationResponse(
                    verification_id=verification_id,
                    nin=request.nin,
                    customer_id=request.customer_id,
                    status=VerificationStatus.FAILED,
                    verified=False,
                    error_message="Verification data mismatch",
                    created_at=datetime.utcnow()
                )
                
        except Exception as e:
            logger.error(f"NIN verification failed: {str(e)}")
            return NINVerificationResponse(
                verification_id=verification_id,
                nin=request.nin,
                customer_id=request.customer_id,
                status=VerificationStatus.FAILED,
                verified=False,
                error_message=str(e),
                created_at=datetime.utcnow()
            )
    
    async def _call_nimc_api(self, request: NINVerificationRequest) -> Dict[str, Any]:
        """
        Call NIMC API to verify NIN
        
        Args:
            request: NIN verification request
            
        Returns:
            Verification data from NIMC
        """
        headers = {
            "Authorization": f"Bearer {self.nimc_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "nin": request.nin,
            "firstname": request.first_name,
            "lastname": request.last_name,
            "dob": request.date_of_birth,
            "phonenumber": request.phone_number
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.nimc_api_url}/verify",
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"NIN verification successful for NIN: {request.nin[:3]}***")
                
                return data
                
            except httpx.HTTPStatusError as e:
                logger.error(f"NIMC API error: {e.response.status_code} - {e.response.text}")
                # In production environment, handle specific error codes
                # For development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return self._get_mock_verification_data(request)
                raise Exception(f"NIMC API error: {e.response.status_code}")
                
            except httpx.RequestError as e:
                logger.error(f"NIMC API request error: {str(e)}")
                # In development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return self._get_mock_verification_data(request)
                raise Exception(f"NIMC API request failed: {str(e)}")
    
    def _get_mock_verification_data(self, request: NINVerificationRequest) -> Dict[str, Any]:
        """
        Get mock verification data for development/testing
        
        Args:
            request: NIN verification request
            
        Returns:
            Mock verification data
        """
        return {
            "nin": request.nin,
            "firstname": request.first_name or "John",
            "lastname": request.last_name or "Doe",
            "middlename": "Middle",
            "dob": request.date_of_birth or "1990-01-01",
            "gender": "M",
            "phone": request.phone_number or "08012345678",
            "email": "john.doe@example.com",
            "address": "123 Main Street, Lagos",
            "state": "Lagos",
            "lga": "Lagos Mainland",
            "photo": "base64_encoded_photo_data",
            "signature": "base64_encoded_signature_data",
            "verification_date": datetime.utcnow().isoformat()
        }
    
    def _validate_verification_data(
        self, 
        request: NINVerificationRequest, 
        verification_data: Dict[str, Any]
    ) -> bool:
        """
        Validate verification data against request
        
        Args:
            request: Original verification request
            verification_data: Data returned from NIMC
            
        Returns:
            True if data matches, False otherwise
        """
        # Check if NIN matches
        if verification_data.get("nin") != request.nin:
            logger.warning(f"NIN mismatch for customer {request.customer_id}")
            return False
        
        # Check first name if provided
        if request.first_name:
            api_firstname = verification_data.get("firstname", "").lower()
            if request.first_name.lower() not in api_firstname and api_firstname not in request.first_name.lower():
                logger.warning(f"First name mismatch for customer {request.customer_id}")
                return False
        
        # Check last name if provided
        if request.last_name:
            api_lastname = verification_data.get("lastname", "").lower()
            if request.last_name.lower() not in api_lastname and api_lastname not in request.last_name.lower():
                logger.warning(f"Last name mismatch for customer {request.customer_id}")
                return False
        
        # Check date of birth if provided
        if request.date_of_birth:
            if verification_data.get("dob") != request.date_of_birth:
                logger.warning(f"Date of birth mismatch for customer {request.customer_id}")
                return False
        
        return True
    
    async def verify_nin_with_biometrics(
        self, 
        request: BiometricVerificationRequest
    ) -> BiometricVerificationResponse:
        """
        Verify NIN with biometric data (fingerprint or face)
        
        Args:
            request: Biometric verification request
            
        Returns:
            BiometricVerificationResponse with match results
        """
        verification_id = str(uuid.uuid4())
        
        try:
            # Call NIMC biometric verification API
            match_result = await self._call_nimc_biometric_api(request)
            
            confidence_score = match_result.get("confidence_score", 0.0)
            biometric_match = confidence_score >= 0.85  # 85% threshold
            
            return BiometricVerificationResponse(
                verification_id=verification_id,
                nin=request.nin,
                customer_id=request.customer_id,
                biometric_match=biometric_match,
                confidence_score=confidence_score,
                status=VerificationStatus.VERIFIED if biometric_match else VerificationStatus.FAILED,
                verified_at=datetime.utcnow() if biometric_match else None,
                created_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Biometric verification failed: {str(e)}")
            return BiometricVerificationResponse(
                verification_id=verification_id,
                nin=request.nin,
                customer_id=request.customer_id,
                biometric_match=False,
                confidence_score=0.0,
                status=VerificationStatus.FAILED,
                created_at=datetime.utcnow()
            )
    
    async def _call_nimc_biometric_api(
        self, 
        request: BiometricVerificationRequest
    ) -> Dict[str, Any]:
        """
        Call NIMC biometric verification API
        
        Args:
            request: Biometric verification request
            
        Returns:
            Biometric match result
        """
        headers = {
            "Authorization": f"Bearer {self.nimc_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "nin": request.nin,
            "fingerprint": request.fingerprint_data,
            "face_image": request.face_image
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.nimc_api_url}/biometric-verify",
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"Biometric verification completed for NIN: {request.nin[:3]}***")
                
                return data
                
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.error(f"NIMC biometric API error: {str(e)}")
                # In development, return mock data
                if os.getenv("ENVIRONMENT") == "development":
                    return {"confidence_score": 0.92, "match": True}
                raise Exception(f"NIMC biometric API failed: {str(e)}")
    
    async def bulk_verify_nin(
        self, 
        requests: list[NINVerificationRequest]
    ) -> list[NINVerificationResponse]:
        """
        Bulk verify multiple NINs
        
        Args:
            requests: List of NIN verification requests
            
        Returns:
            List of verification responses
        """
        results = []
        
        for request in requests:
            result = await self.verify_nin(request)
            results.append(result)
        
        logger.info(f"Bulk verification completed: {len(results)} NINs processed")
        return results
