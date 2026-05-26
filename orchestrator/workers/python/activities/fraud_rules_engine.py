"""
Advanced Fraud Rules Engine with Configurable Rules and Decision Tracking
"""

import logging
import uuid
import re
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from temporalio import activity

logger = logging.getLogger(__name__)


class RuleCategory(str, Enum):
    VELOCITY = "velocity"
    GEO_ANOMALY = "geo_anomaly"
    DEVICE = "device"
    BENEFICIARY = "beneficiary"
    AMOUNT = "amount"
    TIME_BASED = "time_based"
    SANCTIONS = "sanctions"
    BEHAVIORAL = "behavioral"
    CUSTOM = "custom"


class ConditionOperator(str, Enum):
    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NOT_IN = "not_in"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    REGEX = "regex"
    EXISTS = "exists"
    NOT_EXISTS = "not_exists"
    CHANGED = "changed"
    VELOCITY_EXCEEDS = "velocity_exceeds"


class ActionType(str, Enum):
    APPROVE = "approve"
    DECLINE = "decline"
    REVIEW = "review"
    STEP_UP_AUTH = "step_up_auth"
    HOLD = "hold"
    FLAG = "flag"
    NOTIFY = "notify"
    LIMIT_REDUCE = "limit_reduce"
    BLOCK_DEVICE = "block_device"
    BLOCK_IP = "block_ip"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Decision(str, Enum):
    APPROVE = "approve"
    DECLINE = "decline"
    REVIEW = "review"
    STEP_UP = "step_up"


@dataclass
class RuleCondition:
    type: str
    field: str
    operator: ConditionOperator
    value: Any
    time_window_minutes: Optional[int] = None
    aggregation: Optional[str] = None
    children: Optional[List['RuleCondition']] = None


@dataclass
class RuleAction:
    type: ActionType
    params: Optional[Dict[str, Any]] = None


@dataclass
class RiskRule:
    id: str
    name: str
    description: str
    category: RuleCategory
    condition: RuleCondition
    action: RuleAction
    priority: int
    enabled: bool
    created_at: datetime
    updated_at: datetime
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TriggeredRule:
    rule_id: str
    rule_name: str
    category: RuleCategory
    action: RuleAction
    matched_condition: str
    contribution: int


@dataclass
class RiskDecision:
    id: str
    transaction_id: str
    timestamp: datetime
    risk_score: int
    risk_level: RiskLevel
    decision: Decision
    triggered_rules: List[TriggeredRule]
    reason_codes: List[str]
    processing_time_ms: int
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TransactionContext:
    transaction_id: str
    customer_id: str
    amount: float
    currency: str
    payment_method: str
    timestamp: datetime
    merchant_id: Optional[str] = None
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None
    geo_location: Optional[Dict[str, Any]] = None
    beneficiary: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class FraudRulesEngine:
    def __init__(self):
        self.rules: Dict[str, RiskRule] = {}
        self.decisions: Dict[str, RiskDecision] = {}
        self.velocity_store: Dict[str, Dict[str, Any]] = {}
        self.customer_history: Dict[str, List[Dict[str, Any]]] = {}
        self._initialize_default_rules()

    def _initialize_default_rules(self):
        default_rules = [
            {
                "name": "High Amount Transaction",
                "description": "Flag transactions above 1M NGN",
                "category": RuleCategory.AMOUNT,
                "condition": RuleCondition(
                    type="simple",
                    field="amount",
                    operator=ConditionOperator.GT,
                    value=1000000
                ),
                "action": RuleAction(type=ActionType.REVIEW),
                "priority": 10,
            },
            {
                "name": "Velocity - Daily Transaction Count",
                "description": "Block if more than 10 transactions in 24 hours",
                "category": RuleCategory.VELOCITY,
                "condition": RuleCondition(
                    type="simple",
                    field="customer_id",
                    operator=ConditionOperator.VELOCITY_EXCEEDS,
                    value=10,
                    time_window_minutes=1440,
                    aggregation="count"
                ),
                "action": RuleAction(
                    type=ActionType.DECLINE,
                    params={"reason": "VELOCITY_LIMIT_EXCEEDED"}
                ),
                "priority": 5,
            },
            {
                "name": "Velocity - Daily Amount Limit",
                "description": "Review if daily amount exceeds 5M NGN",
                "category": RuleCategory.VELOCITY,
                "condition": RuleCondition(
                    type="simple",
                    field="customer_id",
                    operator=ConditionOperator.VELOCITY_EXCEEDS,
                    value=5000000,
                    time_window_minutes=1440,
                    aggregation="sum"
                ),
                "action": RuleAction(type=ActionType.REVIEW),
                "priority": 8,
            },
            {
                "name": "New Device Detection",
                "description": "Step-up auth for new device",
                "category": RuleCategory.DEVICE,
                "condition": RuleCondition(
                    type="simple",
                    field="device_fingerprint",
                    operator=ConditionOperator.CHANGED,
                    value=True
                ),
                "action": RuleAction(
                    type=ActionType.STEP_UP_AUTH,
                    params={"method": "2fa"}
                ),
                "priority": 15,
            },
            {
                "name": "Geo Anomaly - Country Change",
                "description": "Flag transactions from new country",
                "category": RuleCategory.GEO_ANOMALY,
                "condition": RuleCondition(
                    type="simple",
                    field="geo_location.country",
                    operator=ConditionOperator.CHANGED,
                    value=True
                ),
                "action": RuleAction(
                    type=ActionType.FLAG,
                    params={"reason": "GEO_ANOMALY"}
                ),
                "priority": 12,
            },
            {
                "name": "High Risk Country",
                "description": "Block transactions from sanctioned countries",
                "category": RuleCategory.SANCTIONS,
                "condition": RuleCondition(
                    type="simple",
                    field="geo_location.country",
                    operator=ConditionOperator.IN,
                    value=["KP", "IR", "SY", "CU"]
                ),
                "action": RuleAction(
                    type=ActionType.DECLINE,
                    params={"reason": "SANCTIONED_COUNTRY"}
                ),
                "priority": 1,
            },
            {
                "name": "Night Time Large Transaction",
                "description": "Flag large transactions between 1AM-5AM",
                "category": RuleCategory.TIME_BASED,
                "condition": RuleCondition(
                    type="and",
                    field="",
                    operator=ConditionOperator.EQ,
                    value=None,
                    children=[
                        RuleCondition(type="simple", field="hour", operator=ConditionOperator.GTE, value=1),
                        RuleCondition(type="simple", field="hour", operator=ConditionOperator.LTE, value=5),
                        RuleCondition(type="simple", field="amount", operator=ConditionOperator.GT, value=500000)
                    ]
                ),
                "action": RuleAction(
                    type=ActionType.FLAG,
                    params={"reason": "UNUSUAL_TIME"}
                ),
                "priority": 20,
            },
        ]

        for rule_data in default_rules:
            self.add_rule(
                name=rule_data["name"],
                description=rule_data["description"],
                category=rule_data["category"],
                condition=rule_data["condition"],
                action=rule_data["action"],
                priority=rule_data["priority"]
            )

    def add_rule(
        self,
        name: str,
        description: str,
        category: RuleCategory,
        condition: RuleCondition,
        action: RuleAction,
        priority: int,
        enabled: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> RiskRule:
        rule = RiskRule(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            category=category,
            condition=condition,
            action=action,
            priority=priority,
            enabled=enabled,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            metadata=metadata
        )
        self.rules[rule.id] = rule
        return rule

    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> Optional[RiskRule]:
        if rule_id not in self.rules:
            return None
        rule = self.rules[rule_id]
        for key, value in updates.items():
            if hasattr(rule, key):
                setattr(rule, key, value)
        rule.updated_at = datetime.now()
        return rule

    def delete_rule(self, rule_id: str) -> bool:
        if rule_id in self.rules:
            del self.rules[rule_id]
            return True
        return False

    def get_rule(self, rule_id: str) -> Optional[RiskRule]:
        return self.rules.get(rule_id)

    def list_rules(self, category: Optional[RuleCategory] = None) -> List[RiskRule]:
        rules = list(self.rules.values())
        if category:
            rules = [r for r in rules if r.category == category]
        return sorted(rules, key=lambda r: r.priority)

    def evaluate(self, context: TransactionContext) -> RiskDecision:
        start_time = datetime.now()
        triggered_rules: List[TriggeredRule] = []
        reason_codes: List[str] = []
        total_score = 0

        sorted_rules = [r for r in self.list_rules() if r.enabled]

        for rule in sorted_rules:
            matched = self._evaluate_condition(rule.condition, context)

            if matched:
                contribution = self._calculate_contribution(rule)
                total_score += contribution

                triggered_rules.append(TriggeredRule(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    category=rule.category,
                    action=rule.action,
                    matched_condition=str(rule.condition),
                    contribution=contribution
                ))

                reason_code = f"{rule.category.value.upper()}_{rule.name.replace(' ', '_').upper()}"
                reason_codes.append(reason_code)

                if rule.action.type == ActionType.DECLINE:
                    break

        risk_score = min(100, total_score)
        risk_level = self._calculate_risk_level(risk_score)
        decision = self._determine_decision(triggered_rules, risk_score)

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        risk_decision = RiskDecision(
            id=str(uuid.uuid4()),
            transaction_id=context.transaction_id,
            timestamp=datetime.now(),
            risk_score=risk_score,
            risk_level=risk_level,
            decision=decision,
            triggered_rules=triggered_rules,
            reason_codes=reason_codes,
            processing_time_ms=processing_time,
            metadata=context.metadata
        )

        self.decisions[risk_decision.id] = risk_decision
        self._update_velocity_store(context)

        return risk_decision

    def _evaluate_condition(self, condition: RuleCondition, context: TransactionContext) -> bool:
        if condition.type == "and" and condition.children:
            return all(self._evaluate_condition(c, context) for c in condition.children)

        if condition.type == "or" and condition.children:
            return any(self._evaluate_condition(c, context) for c in condition.children)

        if condition.type == "not" and condition.children:
            return not self._evaluate_condition(condition.children[0], context)

        field_value = self._get_field_value(condition.field, context)

        operator = condition.operator
        value = condition.value

        if operator == ConditionOperator.EQ:
            return field_value == value
        elif operator == ConditionOperator.NEQ:
            return field_value != value
        elif operator == ConditionOperator.GT:
            return field_value is not None and field_value > value
        elif operator == ConditionOperator.GTE:
            return field_value is not None and field_value >= value
        elif operator == ConditionOperator.LT:
            return field_value is not None and field_value < value
        elif operator == ConditionOperator.LTE:
            return field_value is not None and field_value <= value
        elif operator == ConditionOperator.IN:
            return field_value in value if isinstance(value, list) else False
        elif operator == ConditionOperator.NOT_IN:
            return field_value not in value if isinstance(value, list) else True
        elif operator == ConditionOperator.CONTAINS:
            return value in str(field_value) if field_value else False
        elif operator == ConditionOperator.NOT_CONTAINS:
            return value not in str(field_value) if field_value else True
        elif operator == ConditionOperator.REGEX:
            return bool(re.match(value, str(field_value))) if field_value else False
        elif operator == ConditionOperator.EXISTS:
            return field_value is not None
        elif operator == ConditionOperator.NOT_EXISTS:
            return field_value is None
        elif operator == ConditionOperator.VELOCITY_EXCEEDS:
            return self._check_velocity(context, condition)
        elif operator == ConditionOperator.CHANGED:
            return self._check_changed(context, condition.field)

        return False

    def _get_field_value(self, field: str, context: TransactionContext) -> Any:
        if field == "hour":
            return context.timestamp.hour

        parts = field.split(".")
        value = context

        for part in parts:
            if hasattr(value, part):
                value = getattr(value, part)
            elif isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return None

        return value

    def _check_velocity(self, context: TransactionContext, condition: RuleCondition) -> bool:
        key = f"{context.customer_id}:{condition.field}"
        data = self.velocity_store.get(key)

        if not data:
            return False

        window_ms = (condition.time_window_minutes or 60) * 60 * 1000
        cutoff = datetime.now() - timedelta(milliseconds=window_ms)
        valid_timestamps = [t for t in data.get("timestamps", []) if t > cutoff]

        if condition.aggregation == "count":
            return len(valid_timestamps) >= condition.value

        if condition.aggregation == "sum":
            return data.get("sum", 0) >= condition.value

        return False

    def _check_changed(self, context: TransactionContext, field: str) -> bool:
        history = self.customer_history.get(context.customer_id, [])
        if not history:
            return False

        current_value = self._get_field_value(field, context)
        for past in history[-5:]:
            past_value = past.get(field)
            if past_value and past_value != current_value:
                return True

        return False

    def _update_velocity_store(self, context: TransactionContext):
        key = f"{context.customer_id}:customer_id"
        existing = self.velocity_store.get(key, {"count": 0, "sum": 0, "timestamps": []})

        existing["count"] = existing.get("count", 0) + 1
        existing["sum"] = existing.get("sum", 0) + context.amount
        existing["timestamps"] = existing.get("timestamps", []) + [datetime.now()]

        if len(existing["timestamps"]) > 1000:
            existing["timestamps"] = existing["timestamps"][-1000:]

        self.velocity_store[key] = existing

        if context.customer_id not in self.customer_history:
            self.customer_history[context.customer_id] = []

        self.customer_history[context.customer_id].append({
            "device_fingerprint": context.device_fingerprint,
            "geo_location": context.geo_location,
            "ip_address": context.ip_address,
            "timestamp": context.timestamp
        })

    def _calculate_contribution(self, rule: RiskRule) -> int:
        base_scores = {
            RuleCategory.SANCTIONS: 100,
            RuleCategory.VELOCITY: 30,
            RuleCategory.GEO_ANOMALY: 25,
            RuleCategory.DEVICE: 20,
            RuleCategory.BENEFICIARY: 20,
            RuleCategory.AMOUNT: 15,
            RuleCategory.TIME_BASED: 10,
            RuleCategory.BEHAVIORAL: 15,
            RuleCategory.CUSTOM: 10,
        }
        return base_scores.get(rule.category, 10)

    def _calculate_risk_level(self, score: int) -> RiskLevel:
        if score >= 80:
            return RiskLevel.CRITICAL
        if score >= 50:
            return RiskLevel.HIGH
        if score >= 25:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _determine_decision(self, triggered_rules: List[TriggeredRule], risk_score: int) -> Decision:
        has_decline = any(r.action.type == ActionType.DECLINE for r in triggered_rules)
        if has_decline:
            return Decision.DECLINE

        has_step_up = any(r.action.type == ActionType.STEP_UP_AUTH for r in triggered_rules)
        if has_step_up:
            return Decision.STEP_UP

        has_review = any(r.action.type == ActionType.REVIEW for r in triggered_rules)
        if has_review or risk_score >= 50:
            return Decision.REVIEW

        return Decision.APPROVE

    def get_decision(self, decision_id: str) -> Optional[RiskDecision]:
        return self.decisions.get(decision_id)

    def get_decision_by_transaction(self, transaction_id: str) -> Optional[RiskDecision]:
        for decision in self.decisions.values():
            if decision.transaction_id == transaction_id:
                return decision
        return None

    def get_stats(self) -> Dict[str, Any]:
        all_decisions = list(self.decisions.values())
        by_decision: Dict[str, int] = {}
        by_risk_level: Dict[str, int] = {}
        rule_triggered_count: Dict[str, Dict[str, Any]] = {}
        total_processing_time = 0

        for d in all_decisions:
            by_decision[d.decision.value] = by_decision.get(d.decision.value, 0) + 1
            by_risk_level[d.risk_level.value] = by_risk_level.get(d.risk_level.value, 0) + 1
            total_processing_time += d.processing_time_ms

            for tr in d.triggered_rules:
                if tr.rule_id not in rule_triggered_count:
                    rule_triggered_count[tr.rule_id] = {"name": tr.rule_name, "count": 0}
                rule_triggered_count[tr.rule_id]["count"] += 1

        top_triggered_rules = sorted(
            [{"rule_id": k, "rule_name": v["name"], "count": v["count"]} 
             for k, v in rule_triggered_count.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]

        return {
            "total_decisions": len(all_decisions),
            "by_decision": by_decision,
            "by_risk_level": by_risk_level,
            "avg_processing_time_ms": total_processing_time / len(all_decisions) if all_decisions else 0,
            "top_triggered_rules": top_triggered_rules
        }


class FraudRulesEngineActivities:
    def __init__(self):
        self.engine = FraudRulesEngine()

    @activity.defn(name="EvaluateFraudRules")
    async def evaluate_fraud_rules(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Evaluating fraud rules for transaction {transaction_data.get('transaction_id')}")

        context = TransactionContext(
            transaction_id=transaction_data.get("transaction_id", str(uuid.uuid4())),
            customer_id=transaction_data.get("customer_id", ""),
            amount=transaction_data.get("amount", 0),
            currency=transaction_data.get("currency", "NGN"),
            payment_method=transaction_data.get("payment_method", "card"),
            timestamp=datetime.now(),
            merchant_id=transaction_data.get("merchant_id"),
            device_fingerprint=transaction_data.get("device_fingerprint"),
            ip_address=transaction_data.get("ip_address"),
            geo_location=transaction_data.get("geo_location"),
            beneficiary=transaction_data.get("beneficiary"),
            metadata=transaction_data.get("metadata")
        )

        decision = self.engine.evaluate(context)

        return {
            "decision_id": decision.id,
            "transaction_id": decision.transaction_id,
            "risk_score": decision.risk_score,
            "risk_level": decision.risk_level.value,
            "decision": decision.decision.value,
            "reason_codes": decision.reason_codes,
            "triggered_rules_count": len(decision.triggered_rules),
            "processing_time_ms": decision.processing_time_ms
        }

    @activity.defn(name="GetFraudEngineStats")
    async def get_fraud_engine_stats(self) -> Dict[str, Any]:
        return self.engine.get_stats()

    @activity.defn(name="AddFraudRule")
    async def add_fraud_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        condition = RuleCondition(
            type=rule_data.get("condition_type", "simple"),
            field=rule_data.get("condition_field", ""),
            operator=ConditionOperator(rule_data.get("condition_operator", "eq")),
            value=rule_data.get("condition_value")
        )

        action = RuleAction(
            type=ActionType(rule_data.get("action_type", "review")),
            params=rule_data.get("action_params")
        )

        rule = self.engine.add_rule(
            name=rule_data.get("name", "Custom Rule"),
            description=rule_data.get("description", ""),
            category=RuleCategory(rule_data.get("category", "custom")),
            condition=condition,
            action=action,
            priority=rule_data.get("priority", 50),
            enabled=rule_data.get("enabled", True)
        )

        return {
            "rule_id": rule.id,
            "name": rule.name,
            "category": rule.category.value,
            "priority": rule.priority,
            "enabled": rule.enabled
        }
