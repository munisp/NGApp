"""
Webhook Service for KYC/KYB Verification Callbacks
Sends async notifications when verification processes complete
"""

import httpx
import hashlib
import hmac
import json
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    KYC_STARTED = "kyc.started"
    KYC_COMPLETED = "kyc.completed"
    KYC_FAILED = "kyc.failed"
    
    DOCUMENT_UPLOADED = "document.uploaded"
    DOCUMENT_VERIFIED = "document.verified"
    DOCUMENT_REJECTED = "document.rejected"
    
    LIVENESS_PASSED = "liveness.passed"
    LIVENESS_FAILED = "liveness.failed"
    
    NIN_VERIFIED = "nin.verified"
    NIN_FAILED = "nin.failed"
    
    BVN_VERIFIED = "bvn.verified"
    BVN_FAILED = "bvn.failed"
    
    AML_CLEAR = "aml.clear"
    AML_HIT = "aml.hit"
    
    RISK_SCORED = "risk.scored"
    RISK_LEVEL_CHANGED = "risk.level_changed"
    
    KYB_STARTED = "kyb.started"
    KYB_COMPLETED = "kyb.completed"
    KYB_FAILED = "kyb.failed"


@dataclass
class WebhookPayload:
    event_type: str
    customer_id: str
    timestamp: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class WebhookDeliveryResult:
    success: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    error_message: Optional[str] = None
    attempts: int = 0
    delivered_at: Optional[datetime] = None


class WebhookService:
    """
    Service for sending webhook notifications to registered endpoints.
    Supports retry logic, signature verification, and delivery tracking.
    """
    
    def __init__(self):
        self.secret_key = settings.WEBHOOK_SECRET or "default-webhook-secret"
        self.retry_count = settings.WEBHOOK_RETRY_COUNT
        self.timeout = settings.WEBHOOK_TIMEOUT
        self.http_client = httpx.AsyncClient(timeout=self.timeout)
        
        self.registered_webhooks: Dict[str, List[str]] = {}
    
    def _generate_signature(self, payload: str, timestamp: str) -> str:
        """Generate HMAC-SHA256 signature for webhook payload"""
        message = f"{timestamp}.{payload}"
        signature = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    def register_webhook(self, customer_id: str, webhook_url: str):
        """Register a webhook URL for a customer"""
        if customer_id not in self.registered_webhooks:
            self.registered_webhooks[customer_id] = []
        if webhook_url not in self.registered_webhooks[customer_id]:
            self.registered_webhooks[customer_id].append(webhook_url)
            logger.info(f"Registered webhook for customer {customer_id}: {webhook_url}")
    
    def unregister_webhook(self, customer_id: str, webhook_url: str):
        """Unregister a webhook URL for a customer"""
        if customer_id in self.registered_webhooks:
            if webhook_url in self.registered_webhooks[customer_id]:
                self.registered_webhooks[customer_id].remove(webhook_url)
                logger.info(f"Unregistered webhook for customer {customer_id}: {webhook_url}")
    
    def get_webhooks(self, customer_id: str) -> List[str]:
        """Get all registered webhook URLs for a customer"""
        return self.registered_webhooks.get(customer_id, [])
    
    async def send_webhook(
        self,
        webhook_url: str,
        payload: WebhookPayload
    ) -> WebhookDeliveryResult:
        """
        Send a webhook notification to a single URL with retry logic.
        
        Args:
            webhook_url: The URL to send the webhook to
            payload: The webhook payload
            
        Returns:
            WebhookDeliveryResult with delivery status
        """
        payload_json = json.dumps(asdict(payload), default=str)
        timestamp = datetime.utcnow().isoformat()
        signature = self._generate_signature(payload_json, timestamp)
        
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Timestamp": timestamp,
            "X-Webhook-Event": payload.event_type,
            "User-Agent": "InsurePlatform-KYC-Webhook/1.0"
        }
        
        for attempt in range(1, self.retry_count + 1):
            try:
                response = await self.http_client.post(
                    webhook_url,
                    content=payload_json,
                    headers=headers
                )
                
                if response.status_code >= 200 and response.status_code < 300:
                    logger.info(f"Webhook delivered successfully to {webhook_url} (attempt {attempt})")
                    return WebhookDeliveryResult(
                        success=True,
                        status_code=response.status_code,
                        response_body=response.text[:500],
                        attempts=attempt,
                        delivered_at=datetime.utcnow()
                    )
                else:
                    logger.warning(f"Webhook delivery failed to {webhook_url}: {response.status_code}")
                    
            except httpx.TimeoutException:
                logger.warning(f"Webhook timeout to {webhook_url} (attempt {attempt})")
            except Exception as e:
                logger.error(f"Webhook error to {webhook_url}: {str(e)}")
            
            if attempt < self.retry_count:
                await asyncio.sleep(2 ** attempt)
        
        return WebhookDeliveryResult(
            success=False,
            error_message=f"Failed after {self.retry_count} attempts",
            attempts=self.retry_count
        )
    
    async def broadcast_webhook(
        self,
        customer_id: str,
        event_type: WebhookEventType,
        data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, WebhookDeliveryResult]:
        """
        Broadcast a webhook to all registered URLs for a customer.
        
        Args:
            customer_id: The customer ID
            event_type: The type of event
            data: The event data
            metadata: Optional metadata
            
        Returns:
            Dictionary mapping webhook URLs to delivery results
        """
        webhook_urls = self.get_webhooks(customer_id)
        if not webhook_urls:
            logger.info(f"No webhooks registered for customer {customer_id}")
            return {}
        
        payload = WebhookPayload(
            event_type=event_type.value,
            customer_id=customer_id,
            timestamp=datetime.utcnow().isoformat(),
            data=data,
            metadata=metadata
        )
        
        results = {}
        tasks = [self.send_webhook(url, payload) for url in webhook_urls]
        delivery_results = await asyncio.gather(*tasks)
        
        for url, result in zip(webhook_urls, delivery_results):
            results[url] = result
        
        return results
    
    async def notify_kyc_started(
        self,
        customer_id: str,
        workflow_id: str,
        kyc_type: str = "individual"
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify that KYC process has started"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.KYC_STARTED,
            data={
                "workflow_id": workflow_id,
                "kyc_type": kyc_type,
                "status": "in_progress"
            }
        )
    
    async def notify_kyc_completed(
        self,
        customer_id: str,
        workflow_id: str,
        risk_level: str,
        risk_score: float,
        verification_details: Dict[str, Any]
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify that KYC process has completed successfully"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.KYC_COMPLETED,
            data={
                "workflow_id": workflow_id,
                "status": "verified",
                "risk_level": risk_level,
                "risk_score": risk_score,
                "verification_details": verification_details
            }
        )
    
    async def notify_kyc_failed(
        self,
        customer_id: str,
        workflow_id: str,
        reason: str,
        failed_checks: List[str]
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify that KYC process has failed"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.KYC_FAILED,
            data={
                "workflow_id": workflow_id,
                "status": "failed",
                "reason": reason,
                "failed_checks": failed_checks
            }
        )
    
    async def notify_document_verified(
        self,
        customer_id: str,
        document_id: str,
        document_type: str,
        confidence_score: float,
        extracted_data: Dict[str, Any]
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify that a document has been verified"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.DOCUMENT_VERIFIED,
            data={
                "document_id": document_id,
                "document_type": document_type,
                "status": "verified",
                "confidence_score": confidence_score,
                "extracted_data": extracted_data
            }
        )
    
    async def notify_document_rejected(
        self,
        customer_id: str,
        document_id: str,
        document_type: str,
        reason: str,
        fraud_indicators: Optional[List[str]] = None
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify that a document has been rejected"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.DOCUMENT_REJECTED,
            data={
                "document_id": document_id,
                "document_type": document_type,
                "status": "rejected",
                "reason": reason,
                "fraud_indicators": fraud_indicators or []
            }
        )
    
    async def notify_liveness_result(
        self,
        customer_id: str,
        check_id: str,
        is_live: bool,
        liveness_score: float,
        face_match_score: Optional[float] = None
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify liveness check result"""
        event_type = WebhookEventType.LIVENESS_PASSED if is_live else WebhookEventType.LIVENESS_FAILED
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=event_type,
            data={
                "check_id": check_id,
                "is_live": is_live,
                "liveness_score": liveness_score,
                "face_match_score": face_match_score
            }
        )
    
    async def notify_nin_verification(
        self,
        customer_id: str,
        nin: str,
        verified: bool,
        confidence_score: float,
        match_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify NIN verification result"""
        event_type = WebhookEventType.NIN_VERIFIED if verified else WebhookEventType.NIN_FAILED
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=event_type,
            data={
                "nin": f"{nin[:4]}****{nin[-3:]}",
                "verified": verified,
                "confidence_score": confidence_score,
                "match_details": match_details
            }
        )
    
    async def notify_bvn_verification(
        self,
        customer_id: str,
        bvn: str,
        verified: bool,
        confidence_score: float,
        match_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify BVN verification result"""
        event_type = WebhookEventType.BVN_VERIFIED if verified else WebhookEventType.BVN_FAILED
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=event_type,
            data={
                "bvn": f"{bvn[:4]}****{bvn[-3:]}",
                "verified": verified,
                "confidence_score": confidence_score,
                "match_details": match_details
            }
        )
    
    async def notify_aml_result(
        self,
        customer_id: str,
        screening_id: str,
        is_clear: bool,
        risk_level: str,
        hit_count: int = 0
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify AML screening result"""
        event_type = WebhookEventType.AML_CLEAR if is_clear else WebhookEventType.AML_HIT
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=event_type,
            data={
                "screening_id": screening_id,
                "is_clear": is_clear,
                "risk_level": risk_level,
                "hit_count": hit_count
            }
        )
    
    async def notify_risk_scored(
        self,
        customer_id: str,
        risk_score_id: str,
        overall_score: float,
        risk_level: str,
        dd_level: str,
        recommendations: Dict[str, Any]
    ) -> Dict[str, WebhookDeliveryResult]:
        """Notify risk score calculation result"""
        return await self.broadcast_webhook(
            customer_id=customer_id,
            event_type=WebhookEventType.RISK_SCORED,
            data={
                "risk_score_id": risk_score_id,
                "overall_score": overall_score,
                "risk_level": risk_level,
                "dd_level": dd_level,
                "recommendations": recommendations
            }
        )
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()


webhook_service = WebhookService()
