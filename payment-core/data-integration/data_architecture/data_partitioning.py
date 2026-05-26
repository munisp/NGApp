"""
Data Architecture Hardening - Partitioning, Archival, and Schema Governance
"""

import logging
import uuid
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class PartitionStrategy(str, Enum):
    TIME_BASED = "time_based"
    HASH_BASED = "hash_based"
    RANGE_BASED = "range_based"
    LIST_BASED = "list_based"
    COMPOSITE = "composite"


class StorageTier(str, Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    ARCHIVE = "archive"


class SchemaCompatibility(str, Enum):
    BACKWARD = "backward"
    FORWARD = "forward"
    FULL = "full"
    NONE = "none"


@dataclass
class PartitionConfig:
    table_name: str
    strategy: PartitionStrategy
    partition_key: str
    partition_interval: str
    retention_days: int
    archive_after_days: int
    storage_tier: StorageTier = StorageTier.HOT
    enabled: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Partition:
    id: str
    table_name: str
    partition_name: str
    partition_key_start: Any
    partition_key_end: Any
    row_count: int
    size_bytes: int
    storage_tier: StorageTier
    created_at: datetime
    last_accessed: datetime
    archived_at: Optional[datetime] = None


@dataclass
class ArchivalJob:
    id: str
    table_name: str
    partition_name: str
    source_tier: StorageTier
    target_tier: StorageTier
    status: str
    rows_processed: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    error: Optional[str] = None


@dataclass
class SchemaVersion:
    id: str
    subject: str
    version: int
    schema_type: str
    schema_definition: Dict[str, Any]
    compatibility: SchemaCompatibility
    fingerprint: str
    created_at: datetime
    deprecated_at: Optional[datetime] = None


@dataclass
class BackpressureConfig:
    consumer_id: str
    max_batch_size: int
    max_in_flight: int
    pause_threshold: float
    resume_threshold: float
    rate_limit_per_second: int
    enabled: bool = True


@dataclass
class TenantQuota:
    tenant_id: str
    max_requests_per_second: int
    max_concurrent_requests: int
    max_storage_bytes: int
    max_partitions: int
    priority: int
    enabled: bool = True


class PartitionManager:
    def __init__(self):
        self.configs: Dict[str, PartitionConfig] = {}
        self.partitions: Dict[str, List[Partition]] = {}
        self.archival_jobs: List[ArchivalJob] = []
        self._initialize_default_configs()

    def _initialize_default_configs(self):
        default_configs = [
            PartitionConfig(
                table_name="transactions",
                strategy=PartitionStrategy.TIME_BASED,
                partition_key="created_at",
                partition_interval="daily",
                retention_days=90,
                archive_after_days=30,
            ),
            PartitionConfig(
                table_name="audit_logs",
                strategy=PartitionStrategy.TIME_BASED,
                partition_key="timestamp",
                partition_interval="daily",
                retention_days=365,
                archive_after_days=90,
            ),
            PartitionConfig(
                table_name="webhook_logs",
                strategy=PartitionStrategy.TIME_BASED,
                partition_key="created_at",
                partition_interval="daily",
                retention_days=30,
                archive_after_days=14,
            ),
            PartitionConfig(
                table_name="ledger_entries",
                strategy=PartitionStrategy.TIME_BASED,
                partition_key="posted_at",
                partition_interval="monthly",
                retention_days=2555,
                archive_after_days=365,
            ),
            PartitionConfig(
                table_name="fraud_scores",
                strategy=PartitionStrategy.TIME_BASED,
                partition_key="scored_at",
                partition_interval="daily",
                retention_days=180,
                archive_after_days=60,
            ),
        ]

        for config in default_configs:
            self.configs[config.table_name] = config

    def add_partition_config(self, config: PartitionConfig) -> PartitionConfig:
        self.configs[config.table_name] = config
        logger.info(f"Added partition config for table: {config.table_name}")
        return config

    def get_partition_config(self, table_name: str) -> Optional[PartitionConfig]:
        return self.configs.get(table_name)

    def create_partition(self, table_name: str, partition_key_start: Any, partition_key_end: Any) -> Partition:
        config = self.configs.get(table_name)
        if not config:
            raise ValueError(f"No partition config found for table: {table_name}")

        partition = Partition(
            id=str(uuid.uuid4()),
            table_name=table_name,
            partition_name=f"{table_name}_{partition_key_start}_{partition_key_end}",
            partition_key_start=partition_key_start,
            partition_key_end=partition_key_end,
            row_count=0,
            size_bytes=0,
            storage_tier=config.storage_tier,
            created_at=datetime.now(),
            last_accessed=datetime.now(),
        )

        if table_name not in self.partitions:
            self.partitions[table_name] = []
        self.partitions[table_name].append(partition)

        logger.info(f"Created partition: {partition.partition_name}")
        return partition

    def get_partitions(self, table_name: str) -> List[Partition]:
        return self.partitions.get(table_name, [])

    def get_partitions_for_archival(self) -> List[Partition]:
        partitions_to_archive = []
        now = datetime.now()

        for table_name, partitions in self.partitions.items():
            config = self.configs.get(table_name)
            if not config:
                continue

            archive_threshold = now - timedelta(days=config.archive_after_days)

            for partition in partitions:
                if partition.storage_tier == StorageTier.HOT and partition.created_at < archive_threshold:
                    partitions_to_archive.append(partition)

        return partitions_to_archive

    def archive_partition(self, partition_id: str, target_tier: StorageTier) -> ArchivalJob:
        partition = None
        for partitions in self.partitions.values():
            for p in partitions:
                if p.id == partition_id:
                    partition = p
                    break

        if not partition:
            raise ValueError(f"Partition not found: {partition_id}")

        job = ArchivalJob(
            id=str(uuid.uuid4()),
            table_name=partition.table_name,
            partition_name=partition.partition_name,
            source_tier=partition.storage_tier,
            target_tier=target_tier,
            status="running",
            rows_processed=0,
            started_at=datetime.now(),
        )

        self.archival_jobs.append(job)

        job.rows_processed = partition.row_count
        job.status = "completed"
        job.completed_at = datetime.now()
        partition.storage_tier = target_tier
        partition.archived_at = datetime.now()

        logger.info(f"Archived partition {partition.partition_name} to {target_tier.value}")
        return job

    def get_archival_jobs(self, status: Optional[str] = None) -> List[ArchivalJob]:
        if status:
            return [j for j in self.archival_jobs if j.status == status]
        return self.archival_jobs

    def generate_partition_ddl(self, table_name: str) -> str:
        config = self.configs.get(table_name)
        if not config:
            raise ValueError(f"No partition config found for table: {table_name}")

        if config.strategy == PartitionStrategy.TIME_BASED:
            return f"""
-- Partition configuration for {table_name}
-- Strategy: {config.strategy.value}
-- Partition Key: {config.partition_key}
-- Interval: {config.partition_interval}

CREATE TABLE {table_name} (
    id UUID PRIMARY KEY,
    {config.partition_key} TIMESTAMP NOT NULL,
    -- other columns
    created_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE ({config.partition_key});

-- Create partitions
CREATE TABLE {table_name}_current PARTITION OF {table_name}
    FOR VALUES FROM (CURRENT_DATE) TO (CURRENT_DATE + INTERVAL '1 {config.partition_interval}');

-- Retention policy: {config.retention_days} days
-- Archive after: {config.archive_after_days} days
"""
        return f"-- Partition DDL for {table_name} with strategy {config.strategy.value}"


class SchemaRegistry:
    def __init__(self):
        self.schemas: Dict[str, List[SchemaVersion]] = {}
        self.compatibility_rules: Dict[str, SchemaCompatibility] = {}

    def register_schema(
        self,
        subject: str,
        schema_definition: Dict[str, Any],
        schema_type: str = "json",
        compatibility: Optional[SchemaCompatibility] = None
    ) -> SchemaVersion:
        if subject not in self.schemas:
            self.schemas[subject] = []
            self.compatibility_rules[subject] = compatibility or SchemaCompatibility.BACKWARD

        existing_versions = self.schemas[subject]
        new_version = len(existing_versions) + 1

        if existing_versions and compatibility != SchemaCompatibility.NONE:
            latest = existing_versions[-1]
            if not self._check_compatibility(latest.schema_definition, schema_definition, self.compatibility_rules[subject]):
                raise ValueError(f"Schema is not compatible with version {latest.version}")

        fingerprint = self._calculate_fingerprint(schema_definition)

        schema_version = SchemaVersion(
            id=str(uuid.uuid4()),
            subject=subject,
            version=new_version,
            schema_type=schema_type,
            schema_definition=schema_definition,
            compatibility=self.compatibility_rules[subject],
            fingerprint=fingerprint,
            created_at=datetime.now(),
        )

        self.schemas[subject].append(schema_version)
        logger.info(f"Registered schema {subject} version {new_version}")
        return schema_version

    def get_schema(self, subject: str, version: Optional[int] = None) -> Optional[SchemaVersion]:
        if subject not in self.schemas:
            return None

        versions = self.schemas[subject]
        if not versions:
            return None

        if version is None:
            return versions[-1]

        for v in versions:
            if v.version == version:
                return v

        return None

    def get_all_versions(self, subject: str) -> List[SchemaVersion]:
        return self.schemas.get(subject, [])

    def set_compatibility(self, subject: str, compatibility: SchemaCompatibility):
        self.compatibility_rules[subject] = compatibility
        logger.info(f"Set compatibility for {subject} to {compatibility.value}")

    def _check_compatibility(
        self,
        old_schema: Dict[str, Any],
        new_schema: Dict[str, Any],
        compatibility: SchemaCompatibility
    ) -> bool:
        if compatibility == SchemaCompatibility.NONE:
            return True

        old_fields = set(old_schema.get("properties", {}).keys())
        new_fields = set(new_schema.get("properties", {}).keys())

        if compatibility == SchemaCompatibility.BACKWARD:
            removed_fields = old_fields - new_fields
            return len(removed_fields) == 0

        if compatibility == SchemaCompatibility.FORWARD:
            added_required = set(new_schema.get("required", [])) - set(old_schema.get("required", []))
            return len(added_required) == 0

        if compatibility == SchemaCompatibility.FULL:
            return old_fields == new_fields

        return True

    def _calculate_fingerprint(self, schema_definition: Dict[str, Any]) -> str:
        import hashlib
        import json
        schema_str = json.dumps(schema_definition, sort_keys=True)
        return hashlib.sha256(schema_str.encode()).hexdigest()[:16]

    def validate_message(self, subject: str, message: Dict[str, Any], version: Optional[int] = None) -> bool:
        schema = self.get_schema(subject, version)
        if not schema:
            return False

        required_fields = schema.schema_definition.get("required", [])
        for field in required_fields:
            if field not in message:
                return False

        return True


class BackpressureController:
    def __init__(self):
        self.configs: Dict[str, BackpressureConfig] = {}
        self.current_load: Dict[str, float] = {}
        self.paused_consumers: set = set()

    def register_consumer(self, config: BackpressureConfig):
        self.configs[config.consumer_id] = config
        self.current_load[config.consumer_id] = 0.0
        logger.info(f"Registered consumer: {config.consumer_id}")

    def update_load(self, consumer_id: str, current_load: float):
        if consumer_id not in self.configs:
            return

        self.current_load[consumer_id] = current_load
        config = self.configs[consumer_id]

        if current_load >= config.pause_threshold and consumer_id not in self.paused_consumers:
            self.paused_consumers.add(consumer_id)
            logger.warning(f"Pausing consumer {consumer_id} due to high load: {current_load}")

        elif current_load <= config.resume_threshold and consumer_id in self.paused_consumers:
            self.paused_consumers.discard(consumer_id)
            logger.info(f"Resuming consumer {consumer_id}, load: {current_load}")

    def is_paused(self, consumer_id: str) -> bool:
        return consumer_id in self.paused_consumers

    def get_batch_size(self, consumer_id: str) -> int:
        config = self.configs.get(consumer_id)
        if not config:
            return 100

        load = self.current_load.get(consumer_id, 0)

        if load > 0.8:
            return max(1, config.max_batch_size // 4)
        elif load > 0.6:
            return max(1, config.max_batch_size // 2)
        else:
            return config.max_batch_size

    def get_rate_limit(self, consumer_id: str) -> int:
        config = self.configs.get(consumer_id)
        if not config:
            return 1000

        load = self.current_load.get(consumer_id, 0)

        if load > 0.8:
            return max(1, config.rate_limit_per_second // 4)
        elif load > 0.6:
            return max(1, config.rate_limit_per_second // 2)
        else:
            return config.rate_limit_per_second

    def get_status(self) -> Dict[str, Any]:
        return {
            "consumers": {
                cid: {
                    "load": self.current_load.get(cid, 0),
                    "paused": cid in self.paused_consumers,
                    "batch_size": self.get_batch_size(cid),
                    "rate_limit": self.get_rate_limit(cid),
                }
                for cid in self.configs.keys()
            }
        }


class TenantQuotaManager:
    def __init__(self):
        self.quotas: Dict[str, TenantQuota] = {}
        self.usage: Dict[str, Dict[str, float]] = {}

    def set_quota(self, quota: TenantQuota):
        self.quotas[quota.tenant_id] = quota
        if quota.tenant_id not in self.usage:
            self.usage[quota.tenant_id] = {
                "requests_per_second": 0,
                "concurrent_requests": 0,
                "storage_bytes": 0,
                "partitions": 0,
            }
        logger.info(f"Set quota for tenant: {quota.tenant_id}")

    def get_quota(self, tenant_id: str) -> Optional[TenantQuota]:
        return self.quotas.get(tenant_id)

    def check_quota(self, tenant_id: str, resource: str, requested: float) -> bool:
        quota = self.quotas.get(tenant_id)
        if not quota or not quota.enabled:
            return True

        current_usage = self.usage.get(tenant_id, {}).get(resource, 0)

        limits = {
            "requests_per_second": quota.max_requests_per_second,
            "concurrent_requests": quota.max_concurrent_requests,
            "storage_bytes": quota.max_storage_bytes,
            "partitions": quota.max_partitions,
        }

        limit = limits.get(resource, float('inf'))
        return current_usage + requested <= limit

    def record_usage(self, tenant_id: str, resource: str, amount: float):
        if tenant_id not in self.usage:
            self.usage[tenant_id] = {}
        self.usage[tenant_id][resource] = self.usage[tenant_id].get(resource, 0) + amount

    def get_usage(self, tenant_id: str) -> Dict[str, float]:
        return self.usage.get(tenant_id, {})

    def reset_usage(self, tenant_id: str, resource: Optional[str] = None):
        if tenant_id not in self.usage:
            return

        if resource:
            self.usage[tenant_id][resource] = 0
        else:
            self.usage[tenant_id] = {
                "requests_per_second": 0,
                "concurrent_requests": 0,
                "storage_bytes": 0,
                "partitions": 0,
            }


class DataArchitectureManager:
    def __init__(self):
        self.partition_manager = PartitionManager()
        self.schema_registry = SchemaRegistry()
        self.backpressure_controller = BackpressureController()
        self.tenant_quota_manager = TenantQuotaManager()
        self._initialize_default_schemas()

    def _initialize_default_schemas(self):
        transaction_schema = {
            "type": "object",
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "amount": {"type": "number"},
                "currency": {"type": "string"},
                "status": {"type": "string"},
                "created_at": {"type": "string", "format": "date-time"},
            },
            "required": ["id", "amount", "currency", "status"],
        }
        self.schema_registry.register_schema("transactions", transaction_schema)

        webhook_schema = {
            "type": "object",
            "properties": {
                "event_type": {"type": "string"},
                "payload": {"type": "object"},
                "timestamp": {"type": "string", "format": "date-time"},
            },
            "required": ["event_type", "payload"],
        }
        self.schema_registry.register_schema("webhooks", webhook_schema)

        ledger_entry_schema = {
            "type": "object",
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "account_id": {"type": "string"},
                "debit": {"type": "number"},
                "credit": {"type": "number"},
                "posted_at": {"type": "string", "format": "date-time"},
            },
            "required": ["id", "account_id", "debit", "credit"],
        }
        self.schema_registry.register_schema("ledger_entries", ledger_entry_schema)

    def run_archival_job(self) -> List[ArchivalJob]:
        partitions_to_archive = self.partition_manager.get_partitions_for_archival()
        jobs = []

        for partition in partitions_to_archive:
            target_tier = StorageTier.WARM
            if partition.storage_tier == StorageTier.WARM:
                target_tier = StorageTier.COLD

            job = self.partition_manager.archive_partition(partition.id, target_tier)
            jobs.append(job)

        return jobs

    def get_data_governance_report(self) -> Dict[str, Any]:
        partition_stats = {}
        for table_name, partitions in self.partition_manager.partitions.items():
            partition_stats[table_name] = {
                "total_partitions": len(partitions),
                "by_tier": {},
                "total_rows": sum(p.row_count for p in partitions),
                "total_size_bytes": sum(p.size_bytes for p in partitions),
            }
            for partition in partitions:
                tier = partition.storage_tier.value
                partition_stats[table_name]["by_tier"][tier] = partition_stats[table_name]["by_tier"].get(tier, 0) + 1

        schema_stats = {}
        for subject, versions in self.schema_registry.schemas.items():
            schema_stats[subject] = {
                "versions": len(versions),
                "latest_version": versions[-1].version if versions else 0,
                "compatibility": self.schema_registry.compatibility_rules.get(subject, SchemaCompatibility.BACKWARD).value,
            }

        return {
            "partitions": partition_stats,
            "schemas": schema_stats,
            "backpressure": self.backpressure_controller.get_status(),
            "generated_at": datetime.now().isoformat(),
        }
