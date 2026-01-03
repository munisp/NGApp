"""
Fraud Detection Service for SocialEscrow
Nigerian-specific fraud pattern detection and risk scoring

Common Nigerian fraud patterns:
1. Fake bank alert screenshots
2. Account impersonation
3. Bait-and-switch (different item shipped)
4. Velocity abuse (many transactions quickly)
5. Device farming (multiple accounts per device)
6. New account high-value transactions
"""

import re
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class FraudType(str, Enum):
    FAKE_ALERT = "fake_alert"
    IMPERSONATION = "impersonation"
    VELOCITY = "velocity"
    DEVICE_FARMING = "device_farming"
    NEW_ACCOUNT_HIGH_VALUE = "new_account_high_value"
    SUSPICIOUS_BANK_CHANGE = "suspicious_bank_change"
    KNOWN_FRAUDSTER = "known_fraudster"
    BLACKLISTED_DEVICE = "blacklisted_device"
    UNUSUAL_PATTERN = "unusual_pattern"

@dataclass
class RiskSignal:
    """Individual risk signal detected"""
    signal_type: FraudType
    score: float  # 0.0 to 1.0
    description: str
    evidence: Dict[str, Any]
    action_required: str  # none, review, block, require_kyc

@dataclass
class RiskAssessment:
    """Complete risk assessment for a transaction or user"""
    risk_level: RiskLevel
    risk_score: float  # 0.0 to 100.0
    signals: List[RiskSignal]
    recommended_action: str
    requires_kyc: bool
    requires_review: bool
    auto_block: bool

class FraudDetectionService:
    """
    Fraud detection service with Nigerian-specific patterns.
    
    Risk Score Calculation:
    - Each signal contributes a weighted score
    - Signals can be additive or multiplicative
    - Final score determines risk level and action
    
    Risk Levels:
    - LOW (0-25): Auto-approve
    - MEDIUM (26-50): Proceed with monitoring
    - HIGH (51-75): Require additional verification
    - CRITICAL (76-100): Block and review
    """
    
    # Thresholds
    LOW_RISK_THRESHOLD = 25
    MEDIUM_RISK_THRESHOLD = 50
    HIGH_RISK_THRESHOLD = 75
    
    # Nigerian-specific thresholds
    HIGH_VALUE_THRESHOLD_NGN = 500000  # ₦500,000
    VERY_HIGH_VALUE_THRESHOLD_NGN = 2000000  # ₦2,000,000
    NEW_ACCOUNT_DAYS = 7
    VELOCITY_WINDOW_HOURS = 24
    MAX_TRANSACTIONS_PER_DAY = 10
    MAX_VOLUME_PER_DAY_NGN = 1000000  # ₦1,000,000
    
    # Known fake alert templates (image hashes)
    FAKE_ALERT_HASHES = set()  # Would be populated from database
    
    # Blacklisted devices
    BLACKLISTED_DEVICES = set()  # Would be populated from database
    
    # Known fraudster phone patterns
    KNOWN_FRAUDSTER_PHONES = set()  # Would be populated from database
    
    def __init__(self):
        # In-memory storage for POC
        self.user_history: Dict[str, Dict] = {}
        self.device_history: Dict[str, Dict] = {}
        self.transaction_velocity: Dict[str, List[Dict]] = {}
    
    async def assess_transaction_risk(
        self,
        buyer_id: str,
        seller_id: Optional[str],
        amount: float,
        currency: str = "NGN",
        buyer_phone: str = None,
        seller_phone: str = None,
        device_fingerprint: str = None,
        ip_address: str = None,
        payment_screenshot: bytes = None,
        metadata: Dict[str, Any] = None
    ) -> RiskAssessment:
        """
        Assess risk for a new transaction.
        """
        signals: List[RiskSignal] = []
        metadata = metadata or {}
        
        # 1. Check for fake payment screenshot
        if payment_screenshot:
            fake_alert_signal = await self._check_fake_alert(payment_screenshot)
            if fake_alert_signal:
                signals.append(fake_alert_signal)
        
        # 2. Check velocity (too many transactions)
        velocity_signal = await self._check_velocity(buyer_id, amount)
        if velocity_signal:
            signals.append(velocity_signal)
        
        # 3. Check new account high value
        new_account_signal = await self._check_new_account_high_value(buyer_id, amount)
        if new_account_signal:
            signals.append(new_account_signal)
        
        # 4. Check device fingerprint
        if device_fingerprint:
            device_signal = await self._check_device(device_fingerprint, buyer_id)
            if device_signal:
                signals.append(device_signal)
        
        # 5. Check known fraudster phones
        if buyer_phone:
            phone_signal = await self._check_phone(buyer_phone, "buyer")
            if phone_signal:
                signals.append(phone_signal)
        
        if seller_phone:
            phone_signal = await self._check_phone(seller_phone, "seller")
            if phone_signal:
                signals.append(phone_signal)
        
        # 6. Check unusual patterns
        pattern_signal = await self._check_unusual_patterns(
            buyer_id, seller_id, amount, metadata
        )
        if pattern_signal:
            signals.append(pattern_signal)
        
        # Calculate final risk score
        risk_score = self._calculate_risk_score(signals)
        risk_level = self._get_risk_level(risk_score)
        
        # Determine actions
        requires_kyc = risk_score > self.MEDIUM_RISK_THRESHOLD or amount > self.HIGH_VALUE_THRESHOLD_NGN
        requires_review = risk_score > self.HIGH_RISK_THRESHOLD
        auto_block = risk_score > 90 or any(s.action_required == "block" for s in signals)
        
        recommended_action = self._get_recommended_action(
            risk_level, signals, amount, requires_kyc
        )
        
        # Record transaction for velocity tracking
        await self._record_transaction(buyer_id, amount)
        
        return RiskAssessment(
            risk_level=risk_level,
            risk_score=risk_score,
            signals=signals,
            recommended_action=recommended_action,
            requires_kyc=requires_kyc,
            requires_review=requires_review,
            auto_block=auto_block
        )
    
    async def assess_user_risk(
        self,
        user_id: str,
        phone: str = None,
        email: str = None,
        device_fingerprint: str = None,
        ip_address: str = None
    ) -> RiskAssessment:
        """
        Assess risk for a user (registration or login).
        """
        signals: List[RiskSignal] = []
        
        # Check phone against known fraudsters
        if phone:
            phone_signal = await self._check_phone(phone, "user")
            if phone_signal:
                signals.append(phone_signal)
        
        # Check device
        if device_fingerprint:
            device_signal = await self._check_device(device_fingerprint, user_id)
            if device_signal:
                signals.append(device_signal)
        
        # Check for multiple accounts from same device
        if device_fingerprint:
            farming_signal = await self._check_device_farming(device_fingerprint, user_id)
            if farming_signal:
                signals.append(farming_signal)
        
        risk_score = self._calculate_risk_score(signals)
        risk_level = self._get_risk_level(risk_score)
        
        return RiskAssessment(
            risk_level=risk_level,
            risk_score=risk_score,
            signals=signals,
            recommended_action=self._get_recommended_action(risk_level, signals, 0, False),
            requires_kyc=risk_score > self.MEDIUM_RISK_THRESHOLD,
            requires_review=risk_score > self.HIGH_RISK_THRESHOLD,
            auto_block=risk_score > 90
        )
    
    async def assess_bank_change_risk(
        self,
        user_id: str,
        old_bank_code: str,
        old_account_last4: str,
        new_bank_code: str,
        new_account_number: str,
        pending_payout_amount: float
    ) -> RiskAssessment:
        """
        Assess risk when seller changes bank account before payout.
        This is a common fraud vector - attacker gains access to seller account
        and changes bank details to steal payout.
        """
        signals: List[RiskSignal] = []
        
        # High-value payout with bank change is suspicious
        if pending_payout_amount > self.HIGH_VALUE_THRESHOLD_NGN:
            signals.append(RiskSignal(
                signal_type=FraudType.SUSPICIOUS_BANK_CHANGE,
                score=0.6,
                description=f"Bank account changed before high-value payout of ₦{pending_payout_amount:,.0f}",
                evidence={
                    "old_bank": old_bank_code,
                    "old_account_last4": old_account_last4,
                    "new_bank": new_bank_code,
                    "payout_amount": pending_payout_amount
                },
                action_required="require_kyc"
            ))
        
        # Different bank entirely is more suspicious than same bank different account
        if old_bank_code != new_bank_code:
            signals.append(RiskSignal(
                signal_type=FraudType.SUSPICIOUS_BANK_CHANGE,
                score=0.4,
                description="Bank changed to different institution",
                evidence={
                    "old_bank": old_bank_code,
                    "new_bank": new_bank_code
                },
                action_required="review"
            ))
        
        # Check user history for previous bank changes
        user_history = self.user_history.get(user_id, {})
        bank_changes = user_history.get("bank_changes", 0)
        if bank_changes > 2:
            signals.append(RiskSignal(
                signal_type=FraudType.SUSPICIOUS_BANK_CHANGE,
                score=0.5,
                description=f"User has changed bank {bank_changes} times",
                evidence={"bank_change_count": bank_changes},
                action_required="review"
            ))
        
        # Record bank change
        if user_id not in self.user_history:
            self.user_history[user_id] = {}
        self.user_history[user_id]["bank_changes"] = bank_changes + 1
        self.user_history[user_id]["last_bank_change"] = datetime.utcnow().isoformat()
        
        risk_score = self._calculate_risk_score(signals)
        risk_level = self._get_risk_level(risk_score)
        
        return RiskAssessment(
            risk_level=risk_level,
            risk_score=risk_score,
            signals=signals,
            recommended_action=self._get_recommended_action(risk_level, signals, pending_payout_amount, True),
            requires_kyc=risk_score > 30 or pending_payout_amount > self.HIGH_VALUE_THRESHOLD_NGN,
            requires_review=risk_score > 40,
            auto_block=risk_score > 80
        )
    
    async def _check_fake_alert(self, screenshot: bytes) -> Optional[RiskSignal]:
        """
        Check if payment screenshot matches known fake alert templates.
        
        Nigerian fake alerts often:
        - Have specific fonts/layouts
        - Missing transaction reference
        - Wrong bank colors/logos
        - Photoshopped amounts
        """
        # Calculate image hash
        image_hash = hashlib.sha256(screenshot).hexdigest()
        
        # Check against known fake templates
        if image_hash in self.FAKE_ALERT_HASHES:
            return RiskSignal(
                signal_type=FraudType.FAKE_ALERT,
                score=1.0,
                description="Payment screenshot matches known fake alert template",
                evidence={"image_hash": image_hash},
                action_required="block"
            )
        
        # In production, would use CV model to detect fake alerts
        # For now, return None (no fake detected)
        return None
    
    async def _check_velocity(self, user_id: str, amount: float) -> Optional[RiskSignal]:
        """
        Check transaction velocity (too many transactions or too much volume).
        """
        now = datetime.utcnow()
        window_start = now - timedelta(hours=self.VELOCITY_WINDOW_HOURS)
        
        # Get recent transactions
        recent = self.transaction_velocity.get(user_id, [])
        recent_in_window = [
            t for t in recent
            if datetime.fromisoformat(t["timestamp"]) > window_start
        ]
        
        # Check transaction count
        if len(recent_in_window) >= self.MAX_TRANSACTIONS_PER_DAY:
            return RiskSignal(
                signal_type=FraudType.VELOCITY,
                score=0.7,
                description=f"User has {len(recent_in_window)} transactions in last {self.VELOCITY_WINDOW_HOURS} hours",
                evidence={
                    "transaction_count": len(recent_in_window),
                    "window_hours": self.VELOCITY_WINDOW_HOURS
                },
                action_required="review"
            )
        
        # Check volume
        total_volume = sum(t["amount"] for t in recent_in_window) + amount
        if total_volume > self.MAX_VOLUME_PER_DAY_NGN:
            return RiskSignal(
                signal_type=FraudType.VELOCITY,
                score=0.6,
                description=f"User volume ₦{total_volume:,.0f} exceeds daily limit",
                evidence={
                    "total_volume": total_volume,
                    "limit": self.MAX_VOLUME_PER_DAY_NGN
                },
                action_required="require_kyc"
            )
        
        return None
    
    async def _check_new_account_high_value(self, user_id: str, amount: float) -> Optional[RiskSignal]:
        """
        Check if new account is attempting high-value transaction.
        """
        user_history = self.user_history.get(user_id, {})
        created_at = user_history.get("created_at")
        
        if created_at:
            account_age = datetime.utcnow() - datetime.fromisoformat(created_at)
            is_new = account_age.days < self.NEW_ACCOUNT_DAYS
        else:
            # No history = new account
            is_new = True
            self.user_history[user_id] = {"created_at": datetime.utcnow().isoformat()}
        
        if is_new and amount > self.HIGH_VALUE_THRESHOLD_NGN:
            score = 0.8 if amount > self.VERY_HIGH_VALUE_THRESHOLD_NGN else 0.5
            return RiskSignal(
                signal_type=FraudType.NEW_ACCOUNT_HIGH_VALUE,
                score=score,
                description=f"New account attempting ₦{amount:,.0f} transaction",
                evidence={
                    "amount": amount,
                    "account_age_days": account_age.days if created_at else 0,
                    "threshold": self.HIGH_VALUE_THRESHOLD_NGN
                },
                action_required="require_kyc"
            )
        
        return None
    
    async def _check_device(self, device_fingerprint: str, user_id: str) -> Optional[RiskSignal]:
        """
        Check device fingerprint against blacklist and history.
        """
        if device_fingerprint in self.BLACKLISTED_DEVICES:
            return RiskSignal(
                signal_type=FraudType.BLACKLISTED_DEVICE,
                score=1.0,
                description="Device is blacklisted due to previous fraud",
                evidence={"device_fingerprint": device_fingerprint[:16] + "..."},
                action_required="block"
            )
        
        # Record device for user
        if device_fingerprint not in self.device_history:
            self.device_history[device_fingerprint] = {"users": set(), "first_seen": datetime.utcnow().isoformat()}
        
        self.device_history[device_fingerprint]["users"].add(user_id)
        self.device_history[device_fingerprint]["last_seen"] = datetime.utcnow().isoformat()
        
        return None
    
    async def _check_device_farming(self, device_fingerprint: str, user_id: str) -> Optional[RiskSignal]:
        """
        Check if device is being used for multiple accounts (farming).
        """
        device_data = self.device_history.get(device_fingerprint, {})
        users = device_data.get("users", set())
        
        # More than 3 accounts from same device is suspicious
        if len(users) > 3:
            return RiskSignal(
                signal_type=FraudType.DEVICE_FARMING,
                score=0.7,
                description=f"Device associated with {len(users)} different accounts",
                evidence={
                    "account_count": len(users),
                    "device_fingerprint": device_fingerprint[:16] + "..."
                },
                action_required="review"
            )
        
        return None
    
    async def _check_phone(self, phone: str, role: str) -> Optional[RiskSignal]:
        """
        Check phone number against known fraudster list.
        """
        # Normalize phone
        normalized = self._normalize_phone(phone)
        
        if normalized in self.KNOWN_FRAUDSTER_PHONES:
            return RiskSignal(
                signal_type=FraudType.KNOWN_FRAUDSTER,
                score=1.0,
                description=f"{role.capitalize()} phone matches known fraudster",
                evidence={"phone_last4": normalized[-4:]},
                action_required="block"
            )
        
        return None
    
    async def _check_unusual_patterns(
        self,
        buyer_id: str,
        seller_id: Optional[str],
        amount: float,
        metadata: Dict[str, Any]
    ) -> Optional[RiskSignal]:
        """
        Check for unusual transaction patterns.
        """
        signals = []
        
        # Round number amounts (often fake)
        if amount > 100000 and amount % 100000 == 0:
            signals.append(("Round number amount", 0.2))
        
        # Very specific amounts (often legitimate)
        # No signal for this
        
        # Late night transactions (higher fraud rate)
        hour = datetime.utcnow().hour
        if 1 <= hour <= 5:  # 1 AM - 5 AM UTC (2 AM - 6 AM WAT)
            signals.append(("Late night transaction", 0.3))
        
        # Self-transaction (buyer == seller)
        if seller_id and buyer_id == seller_id:
            signals.append(("Self-transaction detected", 0.9))
        
        if signals:
            max_signal = max(signals, key=lambda x: x[1])
            return RiskSignal(
                signal_type=FraudType.UNUSUAL_PATTERN,
                score=max_signal[1],
                description=max_signal[0],
                evidence={"patterns": [s[0] for s in signals]},
                action_required="review" if max_signal[1] > 0.5 else "none"
            )
        
        return None
    
    async def _record_transaction(self, user_id: str, amount: float):
        """Record transaction for velocity tracking"""
        if user_id not in self.transaction_velocity:
            self.transaction_velocity[user_id] = []
        
        self.transaction_velocity[user_id].append({
            "amount": amount,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only last 100 transactions
        self.transaction_velocity[user_id] = self.transaction_velocity[user_id][-100:]
    
    def _calculate_risk_score(self, signals: List[RiskSignal]) -> float:
        """
        Calculate overall risk score from signals.
        Uses weighted combination with diminishing returns.
        """
        if not signals:
            return 0.0
        
        # Sort by score descending
        sorted_signals = sorted(signals, key=lambda s: s.score, reverse=True)
        
        # Weighted combination: highest signal counts most, others add diminishing amounts
        total_score = 0.0
        weight = 1.0
        
        for signal in sorted_signals:
            total_score += signal.score * weight * 100
            weight *= 0.5  # Each subsequent signal contributes half as much
        
        return min(100.0, total_score)
    
    def _get_risk_level(self, score: float) -> RiskLevel:
        """Get risk level from score"""
        if score <= self.LOW_RISK_THRESHOLD:
            return RiskLevel.LOW
        elif score <= self.MEDIUM_RISK_THRESHOLD:
            return RiskLevel.MEDIUM
        elif score <= self.HIGH_RISK_THRESHOLD:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL
    
    def _get_recommended_action(
        self,
        risk_level: RiskLevel,
        signals: List[RiskSignal],
        amount: float,
        requires_kyc: bool
    ) -> str:
        """Get recommended action based on risk assessment"""
        # Check for blocking signals
        if any(s.action_required == "block" for s in signals):
            return "block_transaction"
        
        if risk_level == RiskLevel.CRITICAL:
            return "block_and_review"
        
        if risk_level == RiskLevel.HIGH:
            if requires_kyc:
                return "require_bvn_verification"
            return "require_phone_verification"
        
        if risk_level == RiskLevel.MEDIUM:
            if amount > self.HIGH_VALUE_THRESHOLD_NGN:
                return "require_phone_verification"
            return "proceed_with_monitoring"
        
        return "approve"
    
    def _normalize_phone(self, phone: str) -> str:
        """Normalize Nigerian phone number"""
        digits = ''.join(c for c in phone if c.isdigit())
        if digits.startswith('234') and len(digits) == 13:
            return f"+{digits}"
        elif digits.startswith('0') and len(digits) == 11:
            return f"+234{digits[1:]}"
        elif len(digits) == 10:
            return f"+234{digits}"
        return phone
    
    async def report_fraud(
        self,
        user_id: str = None,
        phone: str = None,
        device_fingerprint: str = None,
        fraud_type: FraudType = None,
        evidence: Dict[str, Any] = None
    ):
        """
        Report confirmed fraud to update detection rules.
        """
        if phone:
            normalized = self._normalize_phone(phone)
            self.KNOWN_FRAUDSTER_PHONES.add(normalized)
            logger.info(f"Added phone to fraudster list: {normalized[-4:]}")
        
        if device_fingerprint:
            self.BLACKLISTED_DEVICES.add(device_fingerprint)
            logger.info(f"Blacklisted device: {device_fingerprint[:16]}...")
        
        # In production, would also:
        # - Update ML model with new fraud example
        # - Alert fraud team
        # - Update user risk score
        # - Potentially freeze related accounts


# Global fraud detection instance
fraud_detection = FraudDetectionService()
