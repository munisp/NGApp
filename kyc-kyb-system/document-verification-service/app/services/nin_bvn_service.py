"""
NIN/BVN Verification Service
Integrates with NIMC (National Identity Management Commission) and NIBSS (Nigeria Inter-Bank Settlement System)
"""

import httpx
import hashlib
import hmac
import base64
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import logging
import redis
from app.config import settings

logger = logging.getLogger(__name__)


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    NOT_FOUND = "not_found"
    MISMATCH = "mismatch"
    EXPIRED = "expired"
    ERROR = "error"
    PENDING = "pending"


@dataclass
class NINVerificationResult:
    status: VerificationStatus
    nin: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    photo_base64: Optional[str] = None
    address: Optional[str] = None
    state_of_origin: Optional[str] = None
    lga_of_origin: Optional[str] = None
    confidence_score: float = 0.0
    match_details: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    verified_at: Optional[datetime] = None


@dataclass
class BVNVerificationResult:
    status: VerificationStatus
    bvn: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    enrollment_bank: Optional[str] = None
    enrollment_branch: Optional[str] = None
    level_of_account: Optional[str] = None
    lga_of_origin: Optional[str] = None
    state_of_origin: Optional[str] = None
    photo_base64: Optional[str] = None
    confidence_score: float = 0.0
    match_details: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    verified_at: Optional[datetime] = None


class NINBVNVerificationService:
    """
    Service for verifying Nigerian National Identification Number (NIN) and 
    Bank Verification Number (BVN) through official NIMC and NIBSS APIs.
    """
    
    def __init__(self):
        self.nimc_base_url = settings.NIMC_API_URL or "https://api.nimc.gov.ng/v1"
        self.nimc_api_key = settings.NIMC_API_KEY
        self.nimc_secret_key = settings.NIMC_SECRET_KEY
        
        self.nibss_base_url = settings.NIBSS_API_URL or "https://api.nibss-plc.com.ng/bvn/v2"
        self.nibss_api_key = settings.NIBSS_API_KEY
        self.nibss_secret_key = settings.NIBSS_SECRET_KEY
        self.nibss_organization_code = settings.NIBSS_ORGANIZATION_CODE
        
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST or "localhost",
            port=settings.REDIS_PORT or 6379,
            db=settings.REDIS_DB or 0,
            decode_responses=True
        )
        
        self.cache_ttl = 86400 * 30  # 30 days cache for verified results
        
        self.http_client = httpx.AsyncClient(
            timeout=30.0,
            headers={"Content-Type": "application/json"}
        )
    
    def _generate_nimc_signature(self, payload: str, timestamp: str) -> str:
        """Generate HMAC signature for NIMC API authentication"""
        message = f"{timestamp}{payload}"
        signature = hmac.new(
            self.nimc_secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def _generate_nibss_signature(self, payload: str) -> str:
        """Generate signature for NIBSS API authentication"""
        signature = hmac.new(
            self.nibss_secret_key.encode(),
            payload.encode(),
            hashlib.sha512
        ).digest()
        return base64.b64encode(signature).decode()
    
    def _get_cached_nin(self, nin: str) -> Optional[NINVerificationResult]:
        """Retrieve cached NIN verification result"""
        cache_key = f"nin_verification:{nin}"
        cached = self.redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            return NINVerificationResult(**data)
        return None
    
    def _cache_nin_result(self, result: NINVerificationResult):
        """Cache NIN verification result"""
        cache_key = f"nin_verification:{result.nin}"
        data = {
            "status": result.status.value,
            "nin": result.nin,
            "first_name": result.first_name,
            "last_name": result.last_name,
            "middle_name": result.middle_name,
            "date_of_birth": result.date_of_birth,
            "gender": result.gender,
            "phone": result.phone,
            "address": result.address,
            "state_of_origin": result.state_of_origin,
            "lga_of_origin": result.lga_of_origin,
            "confidence_score": result.confidence_score,
            "verified_at": result.verified_at.isoformat() if result.verified_at else None
        }
        self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(data))
    
    def _get_cached_bvn(self, bvn: str) -> Optional[BVNVerificationResult]:
        """Retrieve cached BVN verification result"""
        cache_key = f"bvn_verification:{bvn}"
        cached = self.redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            return BVNVerificationResult(**data)
        return None
    
    def _cache_bvn_result(self, result: BVNVerificationResult):
        """Cache BVN verification result"""
        cache_key = f"bvn_verification:{result.bvn}"
        data = {
            "status": result.status.value,
            "bvn": result.bvn,
            "first_name": result.first_name,
            "last_name": result.last_name,
            "middle_name": result.middle_name,
            "date_of_birth": result.date_of_birth,
            "phone": result.phone,
            "email": result.email,
            "gender": result.gender,
            "enrollment_bank": result.enrollment_bank,
            "state_of_origin": result.state_of_origin,
            "lga_of_origin": result.lga_of_origin,
            "confidence_score": result.confidence_score,
            "verified_at": result.verified_at.isoformat() if result.verified_at else None
        }
        self.redis_client.setex(cache_key, self.cache_ttl, json.dumps(data))
    
    async def verify_nin(
        self,
        nin: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        date_of_birth: Optional[str] = None,
        use_cache: bool = True
    ) -> NINVerificationResult:
        """
        Verify NIN against NIMC database.
        
        Args:
            nin: 11-digit National Identification Number
            first_name: Customer's first name for matching
            last_name: Customer's last name for matching
            date_of_birth: Customer's DOB (YYYY-MM-DD) for matching
            use_cache: Whether to use cached results
            
        Returns:
            NINVerificationResult with verification status and details
        """
        if len(nin) != 11 or not nin.isdigit():
            return NINVerificationResult(
                status=VerificationStatus.ERROR,
                nin=nin,
                error_message="Invalid NIN format. Must be 11 digits."
            )
        
        if use_cache:
            cached = self._get_cached_nin(nin)
            if cached:
                logger.info(f"NIN verification cache hit for {nin[:4]}****")
                return cached
        
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            payload = json.dumps({"nin": nin})
            signature = self._generate_nimc_signature(payload, timestamp)
            
            headers = {
                "Authorization": f"Bearer {self.nimc_api_key}",
                "X-Timestamp": timestamp,
                "X-Signature": signature,
                "Content-Type": "application/json"
            }
            
            response = await self.http_client.post(
                f"{self.nimc_base_url}/verify",
                headers=headers,
                json={"nin": nin}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                match_score = 1.0
                match_details = {}
                
                if first_name and data.get("firstName"):
                    name_match = self._fuzzy_match(first_name, data["firstName"])
                    match_details["first_name_match"] = name_match
                    match_score *= name_match
                
                if last_name and data.get("lastName"):
                    name_match = self._fuzzy_match(last_name, data["lastName"])
                    match_details["last_name_match"] = name_match
                    match_score *= name_match
                
                if date_of_birth and data.get("dateOfBirth"):
                    dob_match = 1.0 if date_of_birth == data["dateOfBirth"] else 0.0
                    match_details["dob_match"] = dob_match
                    match_score *= dob_match
                
                status = VerificationStatus.VERIFIED if match_score >= 0.8 else VerificationStatus.MISMATCH
                
                result = NINVerificationResult(
                    status=status,
                    nin=nin,
                    first_name=data.get("firstName"),
                    last_name=data.get("lastName"),
                    middle_name=data.get("middleName"),
                    date_of_birth=data.get("dateOfBirth"),
                    gender=data.get("gender"),
                    phone=data.get("phone"),
                    photo_base64=data.get("photo"),
                    address=data.get("residentialAddress"),
                    state_of_origin=data.get("stateOfOrigin"),
                    lga_of_origin=data.get("lgaOfOrigin"),
                    confidence_score=match_score,
                    match_details=match_details,
                    verified_at=datetime.utcnow()
                )
                
                if status == VerificationStatus.VERIFIED:
                    self._cache_nin_result(result)
                
                return result
                
            elif response.status_code == 404:
                return NINVerificationResult(
                    status=VerificationStatus.NOT_FOUND,
                    nin=nin,
                    error_message="NIN not found in NIMC database"
                )
            else:
                logger.error(f"NIMC API error: {response.status_code} - {response.text}")
                return NINVerificationResult(
                    status=VerificationStatus.ERROR,
                    nin=nin,
                    error_message=f"NIMC API error: {response.status_code}"
                )
                
        except httpx.TimeoutException:
            logger.error("NIMC API timeout")
            return NINVerificationResult(
                status=VerificationStatus.ERROR,
                nin=nin,
                error_message="NIMC API timeout"
            )
        except Exception as e:
            logger.error(f"NIN verification error: {str(e)}")
            return NINVerificationResult(
                status=VerificationStatus.ERROR,
                nin=nin,
                error_message=str(e)
            )
    
    async def verify_bvn(
        self,
        bvn: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        date_of_birth: Optional[str] = None,
        use_cache: bool = True
    ) -> BVNVerificationResult:
        """
        Verify BVN against NIBSS database.
        
        Args:
            bvn: 11-digit Bank Verification Number
            first_name: Customer's first name for matching
            last_name: Customer's last name for matching
            date_of_birth: Customer's DOB (YYYY-MM-DD) for matching
            use_cache: Whether to use cached results
            
        Returns:
            BVNVerificationResult with verification status and details
        """
        if len(bvn) != 11 or not bvn.isdigit():
            return BVNVerificationResult(
                status=VerificationStatus.ERROR,
                bvn=bvn,
                error_message="Invalid BVN format. Must be 11 digits."
            )
        
        if use_cache:
            cached = self._get_cached_bvn(bvn)
            if cached:
                logger.info(f"BVN verification cache hit for {bvn[:4]}****")
                return cached
        
        try:
            payload = json.dumps({
                "bvn": bvn,
                "organizationCode": self.nibss_organization_code
            })
            signature = self._generate_nibss_signature(payload)
            
            headers = {
                "Authorization": f"Bearer {self.nibss_api_key}",
                "X-Signature": signature,
                "Content-Type": "application/json"
            }
            
            response = await self.http_client.post(
                f"{self.nibss_base_url}/VerifySingleBVN",
                headers=headers,
                json={
                    "bvn": bvn,
                    "organizationCode": self.nibss_organization_code
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("ResponseCode") != "00":
                    return BVNVerificationResult(
                        status=VerificationStatus.NOT_FOUND,
                        bvn=bvn,
                        error_message=data.get("ResponseMessage", "BVN not found")
                    )
                
                bvn_data = data.get("BVN", {})
                
                match_score = 1.0
                match_details = {}
                
                if first_name and bvn_data.get("FirstName"):
                    name_match = self._fuzzy_match(first_name, bvn_data["FirstName"])
                    match_details["first_name_match"] = name_match
                    match_score *= name_match
                
                if last_name and bvn_data.get("LastName"):
                    name_match = self._fuzzy_match(last_name, bvn_data["LastName"])
                    match_details["last_name_match"] = name_match
                    match_score *= name_match
                
                if date_of_birth and bvn_data.get("DateOfBirth"):
                    nibss_dob = bvn_data["DateOfBirth"][:10]  # NIBSS returns datetime
                    dob_match = 1.0 if date_of_birth == nibss_dob else 0.0
                    match_details["dob_match"] = dob_match
                    match_score *= dob_match
                
                status = VerificationStatus.VERIFIED if match_score >= 0.8 else VerificationStatus.MISMATCH
                
                result = BVNVerificationResult(
                    status=status,
                    bvn=bvn,
                    first_name=bvn_data.get("FirstName"),
                    last_name=bvn_data.get("LastName"),
                    middle_name=bvn_data.get("MiddleName"),
                    date_of_birth=bvn_data.get("DateOfBirth", "")[:10],
                    phone=bvn_data.get("PhoneNumber"),
                    email=bvn_data.get("Email"),
                    gender=bvn_data.get("Gender"),
                    enrollment_bank=bvn_data.get("EnrollmentBank"),
                    enrollment_branch=bvn_data.get("EnrollmentBranch"),
                    level_of_account=bvn_data.get("LevelOfAccount"),
                    state_of_origin=bvn_data.get("StateOfOrigin"),
                    lga_of_origin=bvn_data.get("LgaOfOrigin"),
                    photo_base64=bvn_data.get("Base64Image"),
                    confidence_score=match_score,
                    match_details=match_details,
                    verified_at=datetime.utcnow()
                )
                
                if status == VerificationStatus.VERIFIED:
                    self._cache_bvn_result(result)
                
                return result
                
            elif response.status_code == 404:
                return BVNVerificationResult(
                    status=VerificationStatus.NOT_FOUND,
                    bvn=bvn,
                    error_message="BVN not found in NIBSS database"
                )
            else:
                logger.error(f"NIBSS API error: {response.status_code} - {response.text}")
                return BVNVerificationResult(
                    status=VerificationStatus.ERROR,
                    bvn=bvn,
                    error_message=f"NIBSS API error: {response.status_code}"
                )
                
        except httpx.TimeoutException:
            logger.error("NIBSS API timeout")
            return BVNVerificationResult(
                status=VerificationStatus.ERROR,
                bvn=bvn,
                error_message="NIBSS API timeout"
            )
        except Exception as e:
            logger.error(f"BVN verification error: {str(e)}")
            return BVNVerificationResult(
                status=VerificationStatus.ERROR,
                bvn=bvn,
                error_message=str(e)
            )
    
    async def verify_nin_bvn_match(
        self,
        nin: str,
        bvn: str
    ) -> Dict[str, Any]:
        """
        Cross-verify NIN and BVN to ensure they belong to the same person.
        
        Args:
            nin: 11-digit National Identification Number
            bvn: 11-digit Bank Verification Number
            
        Returns:
            Dictionary with match status and confidence score
        """
        nin_result = await self.verify_nin(nin)
        bvn_result = await self.verify_bvn(bvn)
        
        if nin_result.status != VerificationStatus.VERIFIED:
            return {
                "match": False,
                "confidence": 0.0,
                "error": f"NIN verification failed: {nin_result.error_message or nin_result.status.value}"
            }
        
        if bvn_result.status != VerificationStatus.VERIFIED:
            return {
                "match": False,
                "confidence": 0.0,
                "error": f"BVN verification failed: {bvn_result.error_message or bvn_result.status.value}"
            }
        
        match_score = 1.0
        match_details = {}
        
        if nin_result.first_name and bvn_result.first_name:
            name_match = self._fuzzy_match(nin_result.first_name, bvn_result.first_name)
            match_details["first_name_match"] = name_match
            match_score *= name_match
        
        if nin_result.last_name and bvn_result.last_name:
            name_match = self._fuzzy_match(nin_result.last_name, bvn_result.last_name)
            match_details["last_name_match"] = name_match
            match_score *= name_match
        
        if nin_result.date_of_birth and bvn_result.date_of_birth:
            dob_match = 1.0 if nin_result.date_of_birth == bvn_result.date_of_birth else 0.0
            match_details["dob_match"] = dob_match
            match_score *= dob_match
        
        if nin_result.phone and bvn_result.phone:
            phone_match = 1.0 if nin_result.phone == bvn_result.phone else 0.5
            match_details["phone_match"] = phone_match
            match_score *= phone_match
        
        return {
            "match": match_score >= 0.7,
            "confidence": match_score,
            "match_details": match_details,
            "nin_data": {
                "first_name": nin_result.first_name,
                "last_name": nin_result.last_name,
                "date_of_birth": nin_result.date_of_birth
            },
            "bvn_data": {
                "first_name": bvn_result.first_name,
                "last_name": bvn_result.last_name,
                "date_of_birth": bvn_result.date_of_birth
            }
        }
    
    def _fuzzy_match(self, str1: str, str2: str) -> float:
        """Calculate fuzzy match score between two strings using Levenshtein distance"""
        str1 = str1.lower().strip()
        str2 = str2.lower().strip()
        
        if str1 == str2:
            return 1.0
        
        len1, len2 = len(str1), len(str2)
        if len1 == 0 or len2 == 0:
            return 0.0
        
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        
        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j
        
        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if str1[i-1] == str2[j-1] else 1
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost
                )
        
        distance = matrix[len1][len2]
        max_len = max(len1, len2)
        similarity = 1.0 - (distance / max_len)
        
        return similarity
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()
