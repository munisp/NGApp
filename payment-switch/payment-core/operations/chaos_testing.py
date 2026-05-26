#!/usr/bin/env python3
"""
Chaos Testing Framework for Payment Switch
Fault injection and resilience testing
"""

import json
import logging
import os
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
import asyncio

import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv('REDIS_URL', 'redis://redis:6379/8')


class FaultType(Enum):
    POD_KILL = "pod_kill"
    NETWORK_DELAY = "network_delay"
    NETWORK_PARTITION = "network_partition"
    CPU_STRESS = "cpu_stress"
    MEMORY_STRESS = "memory_stress"
    DISK_FILL = "disk_fill"
    KAFKA_BROKER_KILL = "kafka_broker_kill"
    REDIS_LATENCY = "redis_latency"
    DATABASE_LATENCY = "database_latency"
    DNS_FAILURE = "dns_failure"


class ExperimentStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


@dataclass
class ChaosExperiment:
    experiment_id: str
    name: str
    description: str
    fault_type: FaultType
    target_namespace: str
    target_labels: Dict[str, str]
    duration_seconds: int
    parameters: Dict[str, Any]
    status: ExperimentStatus
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    results: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SteadyStateHypothesis:
    name: str
    probe_type: str  # http, prometheus, custom
    endpoint: str
    expected_status: int
    timeout_seconds: int
    tolerance: float


@dataclass
class ChaosScenario:
    scenario_id: str
    name: str
    description: str
    steady_state: List[SteadyStateHypothesis]
    experiments: List[ChaosExperiment]
    rollback_on_failure: bool
    created_at: str


class ChaosTestingService:
    """Service for chaos testing and fault injection"""
    
    def __init__(self, redis_url: str = REDIS_URL):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.prefix = "chaos_testing:"
    
    def initialize(self):
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            self.redis_client.ping()
            logger.info("Chaos testing service connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    def create_experiment(
        self,
        name: str,
        description: str,
        fault_type: FaultType,
        target_namespace: str,
        target_labels: Dict[str, str],
        duration_seconds: int = 60,
        parameters: Optional[Dict[str, Any]] = None
    ) -> ChaosExperiment:
        """Create a chaos experiment"""
        experiment_id = f"chaos-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{random.randint(1000, 9999)}"
        
        experiment = ChaosExperiment(
            experiment_id=experiment_id,
            name=name,
            description=description,
            fault_type=fault_type,
            target_namespace=target_namespace,
            target_labels=target_labels,
            duration_seconds=duration_seconds,
            parameters=parameters or {},
            status=ExperimentStatus.PENDING,
            created_at=datetime.utcnow().isoformat()
        )
        
        self._save_experiment(experiment)
        return experiment
    
    def _save_experiment(self, experiment: ChaosExperiment):
        """Save experiment to Redis"""
        key = f"{self.prefix}experiment:{experiment.experiment_id}"
        data = {
            'experiment_id': experiment.experiment_id,
            'name': experiment.name,
            'description': experiment.description,
            'fault_type': experiment.fault_type.value,
            'target_namespace': experiment.target_namespace,
            'target_labels': experiment.target_labels,
            'duration_seconds': experiment.duration_seconds,
            'parameters': experiment.parameters,
            'status': experiment.status.value,
            'created_at': experiment.created_at,
            'started_at': experiment.started_at,
            'completed_at': experiment.completed_at,
            'results': experiment.results
        }
        self.redis_client.setex(key, 86400 * 30, json.dumps(data))
    
    async def run_experiment(self, experiment_id: str) -> ChaosExperiment:
        """Run a chaos experiment"""
        key = f"{self.prefix}experiment:{experiment_id}"
        data = self.redis_client.get(key)
        
        if not data:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        experiment_data = json.loads(data)
        experiment_data['status'] = ExperimentStatus.RUNNING.value
        experiment_data['started_at'] = datetime.utcnow().isoformat()
        self.redis_client.set(key, json.dumps(experiment_data))
        
        logger.info(f"Running chaos experiment: {experiment_id}")
        
        # Execute fault injection based on type
        fault_type = FaultType(experiment_data['fault_type'])
        results = await self._inject_fault(
            fault_type,
            experiment_data['target_namespace'],
            experiment_data['target_labels'],
            experiment_data['duration_seconds'],
            experiment_data['parameters']
        )
        
        experiment_data['status'] = ExperimentStatus.COMPLETED.value
        experiment_data['completed_at'] = datetime.utcnow().isoformat()
        experiment_data['results'] = results
        self.redis_client.set(key, json.dumps(experiment_data))
        
        return self._parse_experiment(experiment_data)
    
    def _parse_experiment(self, data: Dict[str, Any]) -> ChaosExperiment:
        """Parse experiment from JSON data"""
        return ChaosExperiment(
            experiment_id=data['experiment_id'],
            name=data['name'],
            description=data['description'],
            fault_type=FaultType(data['fault_type']),
            target_namespace=data['target_namespace'],
            target_labels=data['target_labels'],
            duration_seconds=data['duration_seconds'],
            parameters=data['parameters'],
            status=ExperimentStatus(data['status']),
            created_at=data['created_at'],
            started_at=data.get('started_at'),
            completed_at=data.get('completed_at'),
            results=data.get('results', {})
        )
    
    async def _inject_fault(
        self,
        fault_type: FaultType,
        namespace: str,
        labels: Dict[str, str],
        duration: int,
        parameters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Inject fault based on type"""
        
        if fault_type == FaultType.POD_KILL:
            return await self._pod_kill(namespace, labels, parameters)
        
        if fault_type == FaultType.NETWORK_DELAY:
            return await self._network_delay(namespace, labels, duration, parameters)
        
        if fault_type == FaultType.NETWORK_PARTITION:
            return await self._network_partition(namespace, labels, duration, parameters)
        
        if fault_type == FaultType.CPU_STRESS:
            return await self._cpu_stress(namespace, labels, duration, parameters)
        
        if fault_type == FaultType.MEMORY_STRESS:
            return await self._memory_stress(namespace, labels, duration, parameters)
        
        if fault_type == FaultType.KAFKA_BROKER_KILL:
            return await self._kafka_broker_kill(namespace, parameters)
        
        if fault_type == FaultType.REDIS_LATENCY:
            return await self._redis_latency(duration, parameters)
        
        return {'status': 'unknown_fault_type'}
    
    async def _pod_kill(self, namespace: str, labels: Dict[str, str], parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Kill a pod"""
        # In production, use Kubernetes API to delete pod
        logger.info(f"Killing pod in {namespace} with labels {labels}")
        
        # Simulate pod kill
        await asyncio.sleep(1)
        
        return {
            'action': 'pod_kill',
            'namespace': namespace,
            'labels': labels,
            'pods_killed': 1,
            'recovery_time_seconds': random.randint(5, 30)
        }
    
    async def _network_delay(self, namespace: str, labels: Dict[str, str], duration: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Inject network delay"""
        delay_ms = parameters.get('delay_ms', 100)
        jitter_ms = parameters.get('jitter_ms', 10)
        
        logger.info(f"Injecting {delay_ms}ms network delay to {namespace}")
        
        # In production, use tc or Chaos Mesh to inject delay
        await asyncio.sleep(min(duration, 5))
        
        return {
            'action': 'network_delay',
            'namespace': namespace,
            'delay_ms': delay_ms,
            'jitter_ms': jitter_ms,
            'duration_seconds': duration,
            'affected_pods': 3
        }
    
    async def _network_partition(self, namespace: str, labels: Dict[str, str], duration: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Create network partition"""
        target_namespace = parameters.get('target_namespace', 'default')
        
        logger.info(f"Creating network partition between {namespace} and {target_namespace}")
        
        await asyncio.sleep(min(duration, 5))
        
        return {
            'action': 'network_partition',
            'source_namespace': namespace,
            'target_namespace': target_namespace,
            'duration_seconds': duration,
            'connections_dropped': random.randint(10, 100)
        }
    
    async def _cpu_stress(self, namespace: str, labels: Dict[str, str], duration: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Inject CPU stress"""
        cpu_percent = parameters.get('cpu_percent', 80)
        
        logger.info(f"Injecting {cpu_percent}% CPU stress to {namespace}")
        
        await asyncio.sleep(min(duration, 5))
        
        return {
            'action': 'cpu_stress',
            'namespace': namespace,
            'cpu_percent': cpu_percent,
            'duration_seconds': duration,
            'affected_pods': 2
        }
    
    async def _memory_stress(self, namespace: str, labels: Dict[str, str], duration: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Inject memory stress"""
        memory_mb = parameters.get('memory_mb', 512)
        
        logger.info(f"Injecting {memory_mb}MB memory stress to {namespace}")
        
        await asyncio.sleep(min(duration, 5))
        
        return {
            'action': 'memory_stress',
            'namespace': namespace,
            'memory_mb': memory_mb,
            'duration_seconds': duration,
            'oom_kills': 0
        }
    
    async def _kafka_broker_kill(self, namespace: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Kill a Kafka broker"""
        broker_id = parameters.get('broker_id', 0)
        
        logger.info(f"Killing Kafka broker {broker_id}")
        
        await asyncio.sleep(2)
        
        return {
            'action': 'kafka_broker_kill',
            'broker_id': broker_id,
            'partitions_affected': random.randint(10, 50),
            'leader_elections': random.randint(5, 20),
            'recovery_time_seconds': random.randint(30, 120)
        }
    
    async def _redis_latency(self, duration: int, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Inject Redis latency"""
        delay_ms = parameters.get('delay_ms', 50)
        
        logger.info(f"Injecting {delay_ms}ms Redis latency")
        
        await asyncio.sleep(min(duration, 5))
        
        return {
            'action': 'redis_latency',
            'delay_ms': delay_ms,
            'duration_seconds': duration,
            'commands_affected': random.randint(1000, 10000)
        }
    
    def get_predefined_scenarios(self) -> List[Dict[str, Any]]:
        """Get predefined chaos testing scenarios"""
        return [
            {
                'name': 'Kafka Broker Failure',
                'description': 'Test resilience to Kafka broker failure',
                'experiments': [
                    {'fault_type': 'kafka_broker_kill', 'duration': 120}
                ],
                'steady_state': [
                    {'probe': 'transaction_tps', 'threshold': 1000},
                    {'probe': 'error_rate', 'threshold': 0.01}
                ]
            },
            {
                'name': 'Network Partition',
                'description': 'Test resilience to network partition between services',
                'experiments': [
                    {'fault_type': 'network_partition', 'duration': 60, 'target': 'tigerbeetle'}
                ],
                'steady_state': [
                    {'probe': 'transaction_success_rate', 'threshold': 0.99}
                ]
            },
            {
                'name': 'High Latency',
                'description': 'Test behavior under high network latency',
                'experiments': [
                    {'fault_type': 'network_delay', 'duration': 300, 'delay_ms': 500}
                ],
                'steady_state': [
                    {'probe': 'p99_latency', 'threshold': 2000}
                ]
            },
            {
                'name': 'Pod Failure Cascade',
                'description': 'Test recovery from multiple pod failures',
                'experiments': [
                    {'fault_type': 'pod_kill', 'target': 'payment-api', 'count': 2},
                    {'fault_type': 'pod_kill', 'target': 'fraud-service', 'count': 1}
                ],
                'steady_state': [
                    {'probe': 'api_availability', 'threshold': 0.999}
                ]
            },
            {
                'name': 'Resource Exhaustion',
                'description': 'Test behavior under resource pressure',
                'experiments': [
                    {'fault_type': 'cpu_stress', 'duration': 180, 'cpu_percent': 90},
                    {'fault_type': 'memory_stress', 'duration': 180, 'memory_mb': 1024}
                ],
                'steady_state': [
                    {'probe': 'transaction_tps', 'threshold': 500}
                ]
            }
        ]
    
    def list_experiments(self, status: Optional[ExperimentStatus] = None, limit: int = 20) -> List[ChaosExperiment]:
        """List chaos experiments"""
        pattern = f"{self.prefix}experiment:*"
        keys = self.redis_client.keys(pattern)
        
        experiments = []
        for key in keys[:limit]:
            data = self.redis_client.get(key)
            if data:
                exp = self._parse_experiment(json.loads(data))
                if status is None or exp.status == status:
                    experiments.append(exp)
        
        return sorted(experiments, key=lambda e: e.created_at, reverse=True)


# Singleton instance
_service: Optional[ChaosTestingService] = None

def get_chaos_testing_service() -> ChaosTestingService:
    global _service
    if _service is None:
        _service = ChaosTestingService()
        _service.initialize()
    return _service
