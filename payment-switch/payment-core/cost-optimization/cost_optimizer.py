#!/usr/bin/env python3
"""
Cost Optimization Service for Payment Switch
Auto-scaling, spot instances, data lifecycle, and cost attribution
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/11')


class ResourceType(Enum):
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    DATABASE = "database"
    CACHE = "cache"
    STREAMING = "streaming"


class ScalingPolicy(Enum):
    CPU_BASED = "cpu_based"
    MEMORY_BASED = "memory_based"
    REQUEST_BASED = "request_based"
    QUEUE_BASED = "queue_based"
    SCHEDULE_BASED = "schedule_based"


@dataclass
class CostAllocation:
    team: str
    service: str
    resource_type: ResourceType
    cost_usd: float
    usage_hours: float
    period_start: str
    period_end: str


@dataclass
class ScalingRule:
    name: str
    service: str
    policy: ScalingPolicy
    min_replicas: int
    max_replicas: int
    target_value: float
    scale_up_threshold: float
    scale_down_threshold: float
    cooldown_seconds: int


@dataclass
class DataLifecyclePolicy:
    name: str
    table_pattern: str
    hot_retention_days: int
    warm_retention_days: int
    cold_retention_days: int
    archive_after_days: int
    delete_after_days: int


@dataclass
class SpotInstanceConfig:
    service: str
    spot_percentage: float
    fallback_to_on_demand: bool
    max_spot_price_multiplier: float
    interruption_behavior: str  # terminate, stop, hibernate


# Default scaling rules
DEFAULT_SCALING_RULES: List[ScalingRule] = [
    ScalingRule(
        name="payment-api-cpu",
        service="payment-api",
        policy=ScalingPolicy.CPU_BASED,
        min_replicas=3,
        max_replicas=20,
        target_value=70,
        scale_up_threshold=80,
        scale_down_threshold=50,
        cooldown_seconds=300
    ),
    ScalingRule(
        name="fraud-service-request",
        service="fraud-service",
        policy=ScalingPolicy.REQUEST_BASED,
        min_replicas=2,
        max_replicas=15,
        target_value=1000,  # requests per second
        scale_up_threshold=1500,
        scale_down_threshold=500,
        cooldown_seconds=180
    ),
    ScalingRule(
        name="flink-queue",
        service="flink-taskmanager",
        policy=ScalingPolicy.QUEUE_BASED,
        min_replicas=2,
        max_replicas=10,
        target_value=10000,  # messages in queue
        scale_up_threshold=50000,
        scale_down_threshold=5000,
        cooldown_seconds=600
    ),
    ScalingRule(
        name="spark-schedule",
        service="spark-worker",
        policy=ScalingPolicy.SCHEDULE_BASED,
        min_replicas=0,
        max_replicas=20,
        target_value=0,
        scale_up_threshold=0,
        scale_down_threshold=0,
        cooldown_seconds=0
    ),
]

# Default data lifecycle policies
DEFAULT_LIFECYCLE_POLICIES: List[DataLifecyclePolicy] = [
    DataLifecyclePolicy(
        name="bronze-events",
        table_pattern="bronze.*",
        hot_retention_days=7,
        warm_retention_days=30,
        cold_retention_days=90,
        archive_after_days=365,
        delete_after_days=2555  # 7 years for compliance
    ),
    DataLifecyclePolicy(
        name="silver-transactions",
        table_pattern="silver.transactions",
        hot_retention_days=30,
        warm_retention_days=90,
        cold_retention_days=365,
        archive_after_days=730,
        delete_after_days=2555
    ),
    DataLifecyclePolicy(
        name="gold-metrics",
        table_pattern="gold.*",
        hot_retention_days=90,
        warm_retention_days=365,
        cold_retention_days=730,
        archive_after_days=1095,
        delete_after_days=2555
    ),
    DataLifecyclePolicy(
        name="audit-logs",
        table_pattern="audit.*",
        hot_retention_days=30,
        warm_retention_days=365,
        cold_retention_days=730,
        archive_after_days=2555,
        delete_after_days=3650  # 10 years
    ),
]

# Spot instance configurations
DEFAULT_SPOT_CONFIGS: List[SpotInstanceConfig] = [
    SpotInstanceConfig(
        service="spark-worker",
        spot_percentage=80,
        fallback_to_on_demand=True,
        max_spot_price_multiplier=0.6,
        interruption_behavior="terminate"
    ),
    SpotInstanceConfig(
        service="flink-taskmanager",
        spot_percentage=50,
        fallback_to_on_demand=True,
        max_spot_price_multiplier=0.7,
        interruption_behavior="terminate"
    ),
    SpotInstanceConfig(
        service="ml-training",
        spot_percentage=90,
        fallback_to_on_demand=True,
        max_spot_price_multiplier=0.5,
        interruption_behavior="terminate"
    ),
]


class CostOptimizer:
    """Service for cost optimization"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "cost_optimizer:"
        self.scaling_rules = {r.name: r for r in DEFAULT_SCALING_RULES}
        self.lifecycle_policies = {p.name: p for p in DEFAULT_LIFECYCLE_POLICIES}
        self.spot_configs = {c.service: c for c in DEFAULT_SPOT_CONFIGS}
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Cost optimizer connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def record_cost(self, allocation: CostAllocation):
        """Record cost allocation"""
        key = f"{self.prefix}cost:{allocation.team}:{allocation.service}:{allocation.period_start}"
        data = {
            'team': allocation.team,
            'service': allocation.service,
            'resource_type': allocation.resource_type.value,
            'cost_usd': allocation.cost_usd,
            'usage_hours': allocation.usage_hours,
            'period_start': allocation.period_start,
            'period_end': allocation.period_end,
            'recorded_at': datetime.utcnow().isoformat()
        }
        self.redis_client.setex(key, 86400 * 90, json.dumps(data))  # 90 days retention
        
        # Update team total
        team_key = f"{self.prefix}team_total:{allocation.team}"
        self.redis_client.incrbyfloat(team_key, allocation.cost_usd)
    
    def get_cost_report(self, team: Optional[str] = None, days: int = 30) -> Dict[str, Any]:
        """Get cost report"""
        pattern = f"{self.prefix}cost:*"
        keys = self.redis_client.keys(pattern)
        
        costs = []
        for key in keys:
            data = self.redis_client.get(key)
            if data:
                cost = json.loads(data)
                if team is None or cost.get('team') == team:
                    costs.append(cost)
        
        # Aggregate by team and service
        by_team = {}
        by_service = {}
        by_resource = {}
        total = 0
        
        for cost in costs:
            team_name = cost.get('team', 'unknown')
            service = cost.get('service', 'unknown')
            resource = cost.get('resource_type', 'unknown')
            amount = cost.get('cost_usd', 0)
            
            by_team[team_name] = by_team.get(team_name, 0) + amount
            by_service[service] = by_service.get(service, 0) + amount
            by_resource[resource] = by_resource.get(resource, 0) + amount
            total += amount
        
        return {
            'generated_at': datetime.utcnow().isoformat(),
            'period_days': days,
            'total_cost_usd': total,
            'by_team': by_team,
            'by_service': by_service,
            'by_resource': by_resource,
            'cost_entries': len(costs)
        }
    
    def evaluate_scaling(self, service: str, current_metrics: Dict[str, float]) -> Dict[str, Any]:
        """Evaluate if scaling is needed"""
        rules = [r for r in self.scaling_rules.values() if r.service == service]
        
        if not rules:
            return {'action': 'none', 'reason': 'No scaling rules defined'}
        
        for rule in rules:
            if rule.policy == ScalingPolicy.CPU_BASED:
                cpu = current_metrics.get('cpu_percent', 0)
                if cpu > rule.scale_up_threshold:
                    return {
                        'action': 'scale_up',
                        'rule': rule.name,
                        'current_value': cpu,
                        'threshold': rule.scale_up_threshold,
                        'reason': f'CPU {cpu}% exceeds threshold {rule.scale_up_threshold}%'
                    }
                if cpu < rule.scale_down_threshold:
                    return {
                        'action': 'scale_down',
                        'rule': rule.name,
                        'current_value': cpu,
                        'threshold': rule.scale_down_threshold,
                        'reason': f'CPU {cpu}% below threshold {rule.scale_down_threshold}%'
                    }
            
            elif rule.policy == ScalingPolicy.REQUEST_BASED:
                rps = current_metrics.get('requests_per_second', 0)
                if rps > rule.scale_up_threshold:
                    return {
                        'action': 'scale_up',
                        'rule': rule.name,
                        'current_value': rps,
                        'threshold': rule.scale_up_threshold,
                        'reason': f'RPS {rps} exceeds threshold {rule.scale_up_threshold}'
                    }
                if rps < rule.scale_down_threshold:
                    return {
                        'action': 'scale_down',
                        'rule': rule.name,
                        'current_value': rps,
                        'threshold': rule.scale_down_threshold,
                        'reason': f'RPS {rps} below threshold {rule.scale_down_threshold}'
                    }
            
            elif rule.policy == ScalingPolicy.QUEUE_BASED:
                queue_size = current_metrics.get('queue_size', 0)
                if queue_size > rule.scale_up_threshold:
                    return {
                        'action': 'scale_up',
                        'rule': rule.name,
                        'current_value': queue_size,
                        'threshold': rule.scale_up_threshold,
                        'reason': f'Queue size {queue_size} exceeds threshold {rule.scale_up_threshold}'
                    }
                if queue_size < rule.scale_down_threshold:
                    return {
                        'action': 'scale_down',
                        'rule': rule.name,
                        'current_value': queue_size,
                        'threshold': rule.scale_down_threshold,
                        'reason': f'Queue size {queue_size} below threshold {rule.scale_down_threshold}'
                    }
        
        return {'action': 'none', 'reason': 'Metrics within thresholds'}
    
    def get_lifecycle_actions(self, table_name: str, data_age_days: int) -> Dict[str, Any]:
        """Determine lifecycle actions for data"""
        for policy in self.lifecycle_policies.values():
            if self._matches_pattern(table_name, policy.table_pattern):
                if data_age_days > policy.delete_after_days:
                    return {'action': 'delete', 'policy': policy.name}
                if data_age_days > policy.archive_after_days:
                    return {'action': 'archive', 'policy': policy.name, 'target': 'glacier'}
                if data_age_days > policy.cold_retention_days:
                    return {'action': 'move_to_cold', 'policy': policy.name, 'target': 's3-ia'}
                if data_age_days > policy.warm_retention_days:
                    return {'action': 'move_to_warm', 'policy': policy.name, 'target': 's3-standard'}
                return {'action': 'keep_hot', 'policy': policy.name}
        
        return {'action': 'none', 'reason': 'No matching policy'}
    
    def _matches_pattern(self, table_name: str, pattern: str) -> bool:
        """Check if table name matches pattern"""
        if pattern.endswith('*'):
            return table_name.startswith(pattern[:-1])
        return table_name == pattern
    
    def get_spot_recommendation(self, service: str) -> Dict[str, Any]:
        """Get spot instance recommendation for service"""
        config = self.spot_configs.get(service)
        
        if not config:
            return {
                'use_spot': False,
                'reason': 'No spot configuration for service'
            }
        
        return {
            'use_spot': True,
            'spot_percentage': config.spot_percentage,
            'fallback_to_on_demand': config.fallback_to_on_demand,
            'max_price_multiplier': config.max_spot_price_multiplier,
            'interruption_behavior': config.interruption_behavior,
            'estimated_savings_percent': (1 - config.max_spot_price_multiplier) * 100
        }
    
    def get_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Get cost optimization recommendations"""
        recommendations = []
        
        # Spot instance recommendations
        for service, config in self.spot_configs.items():
            savings = (1 - config.max_spot_price_multiplier) * 100
            recommendations.append({
                'type': 'spot_instances',
                'service': service,
                'description': f'Use {config.spot_percentage}% spot instances for {service}',
                'estimated_savings_percent': savings,
                'risk': 'low' if config.fallback_to_on_demand else 'medium'
            })
        
        # Data lifecycle recommendations
        for policy in self.lifecycle_policies.values():
            recommendations.append({
                'type': 'data_lifecycle',
                'table_pattern': policy.table_pattern,
                'description': f'Apply lifecycle policy: hot({policy.hot_retention_days}d) -> warm({policy.warm_retention_days}d) -> cold({policy.cold_retention_days}d) -> archive({policy.archive_after_days}d)',
                'estimated_savings_percent': 40,
                'risk': 'low'
            })
        
        # Scaling recommendations
        recommendations.append({
            'type': 'auto_scaling',
            'description': 'Enable auto-scaling for all services based on defined rules',
            'services': list(self.scaling_rules.keys()),
            'estimated_savings_percent': 25,
            'risk': 'low'
        })
        
        # Reserved capacity recommendations
        recommendations.append({
            'type': 'reserved_capacity',
            'description': 'Purchase reserved capacity for baseline workloads (TigerBeetle, Kafka, Redis)',
            'services': ['tigerbeetle', 'kafka', 'redis'],
            'estimated_savings_percent': 30,
            'risk': 'low'
        })
        
        return recommendations
    
    def get_cost_dashboard_data(self) -> Dict[str, Any]:
        """Get data for cost dashboard"""
        report = self.get_cost_report()
        recommendations = self.get_optimization_recommendations()
        
        # Calculate potential savings
        total_cost = report.get('total_cost_usd', 0)
        potential_savings = sum(r.get('estimated_savings_percent', 0) for r in recommendations) / len(recommendations) if recommendations else 0
        
        return {
            'current_cost': report,
            'recommendations': recommendations,
            'potential_savings_percent': potential_savings,
            'potential_savings_usd': total_cost * potential_savings / 100,
            'scaling_rules': len(self.scaling_rules),
            'lifecycle_policies': len(self.lifecycle_policies),
            'spot_configs': len(self.spot_configs)
        }


# Singleton instance
_optimizer: Optional[CostOptimizer] = None

def get_cost_optimizer() -> CostOptimizer:
    global _optimizer
    if _optimizer is None:
        _optimizer = CostOptimizer()
        _optimizer.initialize()
    return _optimizer
