"""
Rule-Based Fraud Detection Engine

This module implements a flexible rule engine for fraud detection with
support for velocity checks, thresholds, blacklists, and custom rules.
"""

from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import redis
import json


class RuleAction(Enum):
    """Actions that can be taken when a rule is triggered."""
    APPROVE = "approve"
    REVIEW = "review"
    BLOCK = "block"
    FLAG = "flag"


class RuleSeverity(Enum):
    """Severity levels for rule violations."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class RuleResult:
    """Result of a rule evaluation."""
    rule_id: str
    rule_name: str
    triggered: bool
    action: RuleAction
    severity: RuleSeverity
    score: float
    reason: str
    metadata: Dict[str, Any]


class FraudRule:
    """Base class for fraud detection rules."""
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        action: RuleAction,
        severity: RuleSeverity,
        enabled: bool = True
    ):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.action = action
        self.severity = severity
        self.enabled = enabled
        
    def evaluate(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> RuleResult:
        """Evaluate the rule against a transaction."""
        raise NotImplementedError


class VelocityRule(FraudRule):
    """
    Velocity rule: Check transaction frequency and amount within a time window.
    """
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        time_window_seconds: int,
        max_transactions: int,
        max_amount: float,
        action: RuleAction = RuleAction.REVIEW,
        severity: RuleSeverity = RuleSeverity.MEDIUM,
        redis_client: Optional[redis.Redis] = None
    ):
        super().__init__(rule_id, rule_name, action, severity)
        self.time_window_seconds = time_window_seconds
        self.max_transactions = max_transactions
        self.max_amount = max_amount
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, decode_responses=True
        )
        
    def evaluate(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> RuleResult:
        """Check if transaction violates velocity limits."""
        if not self.enabled:
            return self._create_result(False, 0.0, "Rule disabled")
            
        account_id = transaction.get('account_id')
        amount = transaction.get('amount', 0)
        
        # Get recent transactions from Redis
        key = f"velocity:{account_id}:{self.time_window_seconds}"
        recent_txns = self.redis_client.lrange(key, 0, -1)
        
        # Count transactions and sum amounts
        txn_count = len(recent_txns)
        total_amount = sum(float(txn) for txn in recent_txns) + amount
        
        # Check violations
        count_violated = txn_count >= self.max_transactions
        amount_violated = total_amount > self.max_amount
        
        if count_violated or amount_violated:
            reason = []
            if count_violated:
                reason.append(
                    f"Transaction count ({txn_count}) exceeds limit ({self.max_transactions})"
                )
            if amount_violated:
                reason.append(
                    f"Total amount ({total_amount:.2f}) exceeds limit ({self.max_amount:.2f})"
                )
            
            score = min(1.0, (txn_count / self.max_transactions + 
                             total_amount / self.max_amount) / 2)
            
            return self._create_result(
                True,
                score,
                "; ".join(reason),
                {
                    'transaction_count': txn_count,
                    'total_amount': total_amount,
                    'time_window': self.time_window_seconds
                }
            )
        
        # Store current transaction
        self.redis_client.lpush(key, amount)
        self.redis_client.expire(key, self.time_window_seconds)
        
        return self._create_result(False, 0.0, "Velocity check passed")
        
    def _create_result(
        self,
        triggered: bool,
        score: float,
        reason: str,
        metadata: Optional[Dict] = None
    ) -> RuleResult:
        """Create a rule result."""
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            triggered=triggered,
            action=self.action if triggered else RuleAction.APPROVE,
            severity=self.severity,
            score=score,
            reason=reason,
            metadata=metadata or {}
        )


class ThresholdRule(FraudRule):
    """
    Threshold rule: Check if transaction amount exceeds a limit.
    """
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        threshold: float,
        action: RuleAction = RuleAction.REVIEW,
        severity: RuleSeverity = RuleSeverity.HIGH
    ):
        super().__init__(rule_id, rule_name, action, severity)
        self.threshold = threshold
        
    def evaluate(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> RuleResult:
        """Check if transaction amount exceeds threshold."""
        if not self.enabled:
            return self._create_result(False, 0.0, "Rule disabled")
            
        amount = transaction.get('amount', 0)
        
        if amount > self.threshold:
            score = min(1.0, amount / (self.threshold * 2))
            return self._create_result(
                True,
                score,
                f"Amount ({amount:.2f}) exceeds threshold ({self.threshold:.2f})",
                {'amount': amount, 'threshold': self.threshold}
            )
        
        return self._create_result(False, 0.0, "Amount within threshold")
        
    def _create_result(
        self,
        triggered: bool,
        score: float,
        reason: str,
        metadata: Optional[Dict] = None
    ) -> RuleResult:
        """Create a rule result."""
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            triggered=triggered,
            action=self.action if triggered else RuleAction.APPROVE,
            severity=self.severity,
            score=score,
            reason=reason,
            metadata=metadata or {}
        )


class BlacklistRule(FraudRule):
    """
    Blacklist rule: Check if account/merchant/device is blacklisted.
    """
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        blacklist_type: str,  # 'account', 'merchant', 'device', 'ip'
        action: RuleAction = RuleAction.BLOCK,
        severity: RuleSeverity = RuleSeverity.CRITICAL,
        redis_client: Optional[redis.Redis] = None
    ):
        super().__init__(rule_id, rule_name, action, severity)
        self.blacklist_type = blacklist_type
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, decode_responses=True
        )
        
    def evaluate(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> RuleResult:
        """Check if entity is blacklisted."""
        if not self.enabled:
            return self._create_result(False, 0.0, "Rule disabled")
            
        entity_id = transaction.get(f'{self.blacklist_type}_id')
        
        if not entity_id:
            return self._create_result(False, 0.0, f"No {self.blacklist_type}_id found")
        
        # Check blacklist in Redis
        key = f"blacklist:{self.blacklist_type}"
        is_blacklisted = self.redis_client.sismember(key, entity_id)
        
        if is_blacklisted:
            return self._create_result(
                True,
                1.0,
                f"{self.blacklist_type.capitalize()} {entity_id} is blacklisted",
                {
                    'blacklist_type': self.blacklist_type,
                    'entity_id': entity_id
                }
            )
        
        return self._create_result(False, 0.0, "Entity not blacklisted")
        
    def _create_result(
        self,
        triggered: bool,
        score: float,
        reason: str,
        metadata: Optional[Dict] = None
    ) -> RuleResult:
        """Create a rule result."""
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            triggered=triggered,
            action=self.action if triggered else RuleAction.APPROVE,
            severity=self.severity,
            score=score,
            reason=reason,
            metadata=metadata or {}
        )


class GeolocationRule(FraudRule):
    """
    Geolocation rule: Check for suspicious location patterns.
    """
    
    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        max_distance_km: float = 100,
        time_window_minutes: int = 30,
        action: RuleAction = RuleAction.REVIEW,
        severity: RuleSeverity = RuleSeverity.HIGH,
        redis_client: Optional[redis.Redis] = None
    ):
        super().__init__(rule_id, rule_name, action, severity)
        self.max_distance_km = max_distance_km
        self.time_window_minutes = time_window_minutes
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, decode_responses=True
        )
        
    def evaluate(
        self,
        transaction: Dict[str, Any],
        context: Dict[str, Any]
    ) -> RuleResult:
        """Check for impossible travel."""
        if not self.enabled:
            return self._create_result(False, 0.0, "Rule disabled")
            
        account_id = transaction.get('account_id')
        current_location = transaction.get('location', {})
        current_lat = current_location.get('latitude')
        current_lon = current_location.get('longitude')
        
        if not (current_lat and current_lon):
            return self._create_result(False, 0.0, "No location data")
        
        # Get last transaction location
        key = f"location:{account_id}"
        last_location_data = self.redis_client.get(key)
        
        if last_location_data:
            last_location = json.loads(last_location_data)
            last_lat = last_location['latitude']
            last_lon = last_location['longitude']
            last_time = datetime.fromisoformat(last_location['timestamp'])
            
            # Calculate distance
            distance = self._haversine_distance(
                last_lat, last_lon, current_lat, current_lon
            )
            
            # Calculate time difference
            current_time = datetime.now()
            time_diff_minutes = (current_time - last_time).total_seconds() / 60
            
            # Check if travel is impossible
            if time_diff_minutes <= self.time_window_minutes and distance > self.max_distance_km:
                score = min(1.0, distance / (self.max_distance_km * 2))
                return self._create_result(
                    True,
                    score,
                    f"Impossible travel: {distance:.2f}km in {time_diff_minutes:.1f} minutes",
                    {
                        'distance_km': distance,
                        'time_diff_minutes': time_diff_minutes,
                        'last_location': last_location,
                        'current_location': current_location
                    }
                )
        
        # Store current location
        location_data = {
            'latitude': current_lat,
            'longitude': current_lon,
            'timestamp': datetime.now().isoformat()
        }
        self.redis_client.setex(
            key,
            self.time_window_minutes * 60,
            json.dumps(location_data)
        )
        
        return self._create_result(False, 0.0, "Location check passed")
        
    def _haversine_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """Calculate distance between two points using Haversine formula."""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Earth radius in kilometers
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
        
    def _create_result(
        self,
        triggered: bool,
        score: float,
        reason: str,
        metadata: Optional[Dict] = None
    ) -> RuleResult:
        """Create a rule result."""
        return RuleResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            triggered=triggered,
            action=self.action if triggered else RuleAction.APPROVE,
            severity=self.severity,
            score=score,
            reason=reason,
            metadata=metadata or {}
        )


class RuleEngine:
    """
    Rule engine that manages and executes fraud detection rules.
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.rules: List[FraudRule] = []
        self.redis_client = redis_client or redis.Redis(
            host='localhost', port=6379, decode_responses=True
        )
        
    def add_rule(self, rule: FraudRule):
        """Add a rule to the engine."""
        self.rules.append(rule)
        
    def remove_rule(self, rule_id: str):
        """Remove a rule from the engine."""
        self.rules = [r for r in self.rules if r.rule_id != rule_id]
        
    def evaluate_transaction(
        self,
        transaction: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Tuple[RuleAction, float, List[RuleResult]]:
        """
        Evaluate a transaction against all rules.
        
        Returns:
            action: Final action to take
            score: Overall fraud score (0-1)
            results: List of individual rule results
        """
        context = context or {}
        results = []
        
        # Evaluate all rules
        for rule in self.rules:
            if rule.enabled:
                result = rule.evaluate(transaction, context)
                results.append(result)
        
        # Determine final action and score
        triggered_results = [r for r in results if r.triggered]
        
        if not triggered_results:
            return RuleAction.APPROVE, 0.0, results
        
        # Find highest severity action
        max_severity = max(r.severity.value for r in triggered_results)
        critical_results = [r for r in triggered_results 
                           if r.severity.value == max_severity]
        
        final_action = critical_results[0].action
        final_score = max(r.score for r in triggered_results)
        
        return final_action, final_score, results
        
    def get_rule_statistics(self) -> Dict[str, Any]:
        """Get statistics about rule performance."""
        return {
            'total_rules': len(self.rules),
            'enabled_rules': sum(1 for r in self.rules if r.enabled),
            'rules_by_severity': {
                severity.name: sum(1 for r in self.rules 
                                  if r.severity == severity)
                for severity in RuleSeverity
            }
        }


def create_default_rule_engine(redis_client: Optional[redis.Redis] = None) -> RuleEngine:
    """Create a rule engine with default fraud detection rules."""
    engine = RuleEngine(redis_client=redis_client)
    
    # Velocity rules
    engine.add_rule(VelocityRule(
        rule_id="VEL001",
        rule_name="High frequency transactions",
        time_window_seconds=300,  # 5 minutes
        max_transactions=10,
        max_amount=50000,
        action=RuleAction.REVIEW,
        severity=RuleSeverity.MEDIUM,
        redis_client=redis_client
    ))
    
    # Threshold rules
    engine.add_rule(ThresholdRule(
        rule_id="THR001",
        rule_name="Large transaction amount",
        threshold=100000,
        action=RuleAction.REVIEW,
        severity=RuleSeverity.HIGH
    ))
    
    # Blacklist rules
    engine.add_rule(BlacklistRule(
        rule_id="BLK001",
        rule_name="Blacklisted account",
        blacklist_type="account",
        action=RuleAction.BLOCK,
        severity=RuleSeverity.CRITICAL,
        redis_client=redis_client
    ))
    
    # Geolocation rules
    engine.add_rule(GeolocationRule(
        rule_id="GEO001",
        rule_name="Impossible travel detection",
        max_distance_km=100,
        time_window_minutes=30,
        action=RuleAction.REVIEW,
        severity=RuleSeverity.HIGH,
        redis_client=redis_client
    ))
    
    return engine
