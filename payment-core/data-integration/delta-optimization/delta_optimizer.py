#!/usr/bin/env python3
"""
Delta Lake Optimization Service for Payment Switch
Partitioning, Z-ordering, compaction, and vacuum operations
"""

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DELTA_BASE_PATH = os.getenv('DELTA_BASE_PATH', 's3a://lakehouse/delta')


class OptimizationType(Enum):
    OPTIMIZE = "optimize"
    ZORDER = "zorder"
    VACUUM = "vacuum"
    COMPACT = "compact"
    ANALYZE = "analyze"


@dataclass
class TableOptimizationConfig:
    table_name: str
    partition_columns: List[str]
    zorder_columns: List[str]
    optimize_schedule: str  # cron expression
    vacuum_retention_hours: int
    target_file_size_mb: int
    auto_compact: bool


@dataclass
class OptimizationJob:
    job_id: str
    table_name: str
    optimization_type: OptimizationType
    status: str
    started_at: str
    completed_at: Optional[str]
    files_before: int
    files_after: int
    bytes_removed: int
    duration_seconds: float
    details: Dict[str, Any]


# Table optimization configurations
TABLE_CONFIGS: Dict[str, TableOptimizationConfig] = {
    "bronze.domain_events": TableOptimizationConfig(
        table_name="bronze.domain_events",
        partition_columns=["event_date", "event_type"],
        zorder_columns=["correlation_id", "timestamp"],
        optimize_schedule="0 2 * * *",  # 2 AM daily
        vacuum_retention_hours=168,  # 7 days
        target_file_size_mb=128,
        auto_compact=True
    ),
    "bronze.ledger_events": TableOptimizationConfig(
        table_name="bronze.ledger_events",
        partition_columns=["event_date"],
        zorder_columns=["account_id", "timestamp"],
        optimize_schedule="0 2 * * *",
        vacuum_retention_hours=168,
        target_file_size_mb=128,
        auto_compact=True
    ),
    "silver.transactions": TableOptimizationConfig(
        table_name="silver.transactions",
        partition_columns=["transaction_date", "status"],
        zorder_columns=["payer_id", "payee_id", "timestamp"],
        optimize_schedule="0 3 * * *",  # 3 AM daily
        vacuum_retention_hours=720,  # 30 days
        target_file_size_mb=256,
        auto_compact=True
    ),
    "silver.fraud_alerts": TableOptimizationConfig(
        table_name="silver.fraud_alerts",
        partition_columns=["alert_date", "severity"],
        zorder_columns=["transaction_id", "alert_time"],
        optimize_schedule="0 3 * * *",
        vacuum_retention_hours=2160,  # 90 days
        target_file_size_mb=128,
        auto_compact=True
    ),
    "silver.settlements": TableOptimizationConfig(
        table_name="silver.settlements",
        partition_columns=["settlement_date"],
        zorder_columns=["participant_id", "window_id"],
        optimize_schedule="0 4 * * *",  # 4 AM daily
        vacuum_retention_hours=8760,  # 365 days
        target_file_size_mb=256,
        auto_compact=True
    ),
    "gold.transaction_metrics": TableOptimizationConfig(
        table_name="gold.transaction_metrics",
        partition_columns=["metric_date"],
        zorder_columns=["window_start"],
        optimize_schedule="0 5 * * *",  # 5 AM daily
        vacuum_retention_hours=720,
        target_file_size_mb=64,
        auto_compact=True
    ),
    "gold.participant_metrics": TableOptimizationConfig(
        table_name="gold.participant_metrics",
        partition_columns=["metric_date"],
        zorder_columns=["participant_id"],
        optimize_schedule="0 5 * * *",
        vacuum_retention_hours=720,
        target_file_size_mb=64,
        auto_compact=True
    ),
    "gold.fraud_summary": TableOptimizationConfig(
        table_name="gold.fraud_summary",
        partition_columns=["summary_date"],
        zorder_columns=["alert_type"],
        optimize_schedule="0 5 * * *",
        vacuum_retention_hours=720,
        target_file_size_mb=32,
        auto_compact=True
    ),
}


class DeltaOptimizer:
    """Service for optimizing Delta Lake tables"""
    
    def __init__(self, base_path: str = DELTA_BASE_PATH):
        self.base_path = base_path
        self._spark = None
        self.job_history: List[OptimizationJob] = []
    
    def initialize(self):
        """Initialize Spark session for Delta Lake operations"""
        try:
            # In production, create Spark session with Delta Lake support
            # from pyspark.sql import SparkSession
            # self._spark = SparkSession.builder \
            #     .appName("DeltaOptimizer") \
            #     .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
            #     .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
            #     .getOrCreate()
            logger.info("Delta optimizer initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Delta optimizer: {e}")
            raise
    
    def get_table_config(self, table_name: str) -> Optional[TableOptimizationConfig]:
        """Get optimization config for a table"""
        return TABLE_CONFIGS.get(table_name)
    
    def optimize_table(self, table_name: str, where_clause: Optional[str] = None) -> OptimizationJob:
        """Run OPTIMIZE on a Delta table"""
        config = self.get_table_config(table_name)
        if not config:
            raise ValueError(f"No optimization config for table {table_name}")
        
        job_id = f"opt-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        start_time = datetime.utcnow()
        
        logger.info(f"Starting OPTIMIZE for {table_name}")
        
        # In production, execute:
        # sql = f"OPTIMIZE {table_name}"
        # if where_clause:
        #     sql += f" WHERE {where_clause}"
        # self._spark.sql(sql)
        
        # Simulate optimization
        files_before = 150
        files_after = 25
        
        job = OptimizationJob(
            job_id=job_id,
            table_name=table_name,
            optimization_type=OptimizationType.OPTIMIZE,
            status="completed",
            started_at=start_time.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            files_before=files_before,
            files_after=files_after,
            bytes_removed=0,
            duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
            details={
                'where_clause': where_clause,
                'target_file_size_mb': config.target_file_size_mb
            }
        )
        
        self.job_history.append(job)
        logger.info(f"OPTIMIZE completed: {files_before} -> {files_after} files")
        
        return job
    
    def zorder_table(self, table_name: str, columns: Optional[List[str]] = None) -> OptimizationJob:
        """Run OPTIMIZE with Z-ORDER on a Delta table"""
        config = self.get_table_config(table_name)
        if not config:
            raise ValueError(f"No optimization config for table {table_name}")
        
        zorder_cols = columns or config.zorder_columns
        if not zorder_cols:
            raise ValueError(f"No Z-ORDER columns specified for {table_name}")
        
        job_id = f"zorder-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        start_time = datetime.utcnow()
        
        logger.info(f"Starting Z-ORDER for {table_name} on columns {zorder_cols}")
        
        # In production, execute:
        # cols = ", ".join(zorder_cols)
        # self._spark.sql(f"OPTIMIZE {table_name} ZORDER BY ({cols})")
        
        # Simulate Z-ORDER
        files_before = 150
        files_after = 30
        
        job = OptimizationJob(
            job_id=job_id,
            table_name=table_name,
            optimization_type=OptimizationType.ZORDER,
            status="completed",
            started_at=start_time.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            files_before=files_before,
            files_after=files_after,
            bytes_removed=0,
            duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
            details={
                'zorder_columns': zorder_cols
            }
        )
        
        self.job_history.append(job)
        logger.info(f"Z-ORDER completed: {files_before} -> {files_after} files")
        
        return job
    
    def vacuum_table(self, table_name: str, retention_hours: Optional[int] = None) -> OptimizationJob:
        """Run VACUUM on a Delta table to remove old files"""
        config = self.get_table_config(table_name)
        if not config:
            raise ValueError(f"No optimization config for table {table_name}")
        
        hours = retention_hours or config.vacuum_retention_hours
        
        job_id = f"vacuum-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        start_time = datetime.utcnow()
        
        logger.info(f"Starting VACUUM for {table_name} with {hours}h retention")
        
        # In production, execute:
        # self._spark.sql(f"VACUUM {table_name} RETAIN {hours} HOURS")
        
        # Simulate VACUUM
        bytes_removed = 1024 * 1024 * 500  # 500 MB
        
        job = OptimizationJob(
            job_id=job_id,
            table_name=table_name,
            optimization_type=OptimizationType.VACUUM,
            status="completed",
            started_at=start_time.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            files_before=0,
            files_after=0,
            bytes_removed=bytes_removed,
            duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
            details={
                'retention_hours': hours
            }
        )
        
        self.job_history.append(job)
        logger.info(f"VACUUM completed: {bytes_removed / 1024 / 1024:.1f} MB removed")
        
        return job
    
    def analyze_table(self, table_name: str) -> Dict[str, Any]:
        """Analyze table statistics"""
        config = self.get_table_config(table_name)
        if not config:
            raise ValueError(f"No optimization config for table {table_name}")
        
        logger.info(f"Analyzing table {table_name}")
        
        # In production, query Delta Lake metadata
        # df = self._spark.sql(f"DESCRIBE DETAIL {table_name}")
        # history = self._spark.sql(f"DESCRIBE HISTORY {table_name}")
        
        # Simulate analysis
        return {
            'table_name': table_name,
            'analyzed_at': datetime.utcnow().isoformat(),
            'num_files': 45,
            'size_bytes': 1024 * 1024 * 1024 * 2,  # 2 GB
            'num_partitions': 30,
            'partition_columns': config.partition_columns,
            'zorder_columns': config.zorder_columns,
            'last_optimize': (datetime.utcnow() - timedelta(hours=12)).isoformat(),
            'last_vacuum': (datetime.utcnow() - timedelta(days=1)).isoformat(),
            'avg_file_size_mb': 45.5,
            'min_file_size_mb': 1.2,
            'max_file_size_mb': 128.0,
            'small_files_count': 8,
            'recommendations': self._get_recommendations(table_name)
        }
    
    def _get_recommendations(self, table_name: str) -> List[str]:
        """Get optimization recommendations for a table"""
        recommendations = []
        
        # Simulate analysis-based recommendations
        recommendations.append("Consider running OPTIMIZE to reduce small files")
        recommendations.append("Z-ORDER on frequently filtered columns can improve query performance")
        
        return recommendations
    
    def run_scheduled_optimization(self) -> List[OptimizationJob]:
        """Run scheduled optimization for all tables"""
        jobs = []
        
        for table_name, config in TABLE_CONFIGS.items():
            try:
                # Run OPTIMIZE with Z-ORDER
                job = self.zorder_table(table_name)
                jobs.append(job)
                
                # Run VACUUM
                vacuum_job = self.vacuum_table(table_name)
                jobs.append(vacuum_job)
                
            except Exception as e:
                logger.error(f"Failed to optimize {table_name}: {e}")
        
        return jobs
    
    def get_optimization_report(self) -> Dict[str, Any]:
        """Get optimization status report for all tables"""
        report = {
            'generated_at': datetime.utcnow().isoformat(),
            'tables': [],
            'total_bytes_saved': 0,
            'total_files_compacted': 0
        }
        
        for table_name in TABLE_CONFIGS.keys():
            analysis = self.analyze_table(table_name)
            report['tables'].append(analysis)
        
        # Summarize job history
        for job in self.job_history[-100:]:
            report['total_bytes_saved'] += job.bytes_removed
            if job.optimization_type in [OptimizationType.OPTIMIZE, OptimizationType.ZORDER]:
                report['total_files_compacted'] += max(0, job.files_before - job.files_after)
        
        return report


# SQL templates for Delta Lake optimization
OPTIMIZATION_SQL_TEMPLATES = {
    'create_partitioned_table': """
        CREATE TABLE IF NOT EXISTS {table_name} (
            {columns}
        )
        USING DELTA
        PARTITIONED BY ({partition_columns})
        LOCATION '{location}'
        TBLPROPERTIES (
            'delta.autoOptimize.optimizeWrite' = 'true',
            'delta.autoOptimize.autoCompact' = 'true',
            'delta.targetFileSize' = '{target_file_size}'
        )
    """,
    
    'optimize_with_zorder': """
        OPTIMIZE {table_name}
        WHERE {partition_filter}
        ZORDER BY ({zorder_columns})
    """,
    
    'vacuum': """
        VACUUM {table_name}
        RETAIN {retention_hours} HOURS
    """,
    
    'analyze_statistics': """
        ANALYZE TABLE {table_name}
        COMPUTE STATISTICS FOR ALL COLUMNS
    """,
    
    'describe_detail': """
        DESCRIBE DETAIL {table_name}
    """,
    
    'describe_history': """
        DESCRIBE HISTORY {table_name}
        LIMIT 20
    """
}


# Singleton instance
_optimizer: Optional[DeltaOptimizer] = None

def get_delta_optimizer() -> DeltaOptimizer:
    global _optimizer
    if _optimizer is None:
        _optimizer = DeltaOptimizer()
        _optimizer.initialize()
    return _optimizer
