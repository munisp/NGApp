"""
Bronze Layer — Raw data ingestion layer of the Lakehouse.

The Bronze layer stores raw, unprocessed data exactly as received from
source systems. Data is written as Parquet files partitioned by date
and source-specific keys.

Responsibilities:
  - Receive data from Kafka consumers (via Flink bronze-writer job)
  - Write to Parquet format with snappy compression
  - Partition by (date, source-specific key)
  - Maintain schema evolution tracking
  - NO transformations — data is stored as-is for full auditability
  - Retention: indefinite (regulatory requirement for audit trail)

Data Flow:
  Kafka Topics → Flink Bronze Writer → Parquet Files → Bronze Tables
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger("ingestion-engine.bronze")


class BronzeLayerManager:
    """Manages the Bronze (raw) layer of the Lakehouse."""

    def __init__(self, base_path: str):
        self.base_path = base_path
        self._write_count = 0
        self._bytes_written = 0
        self._last_write = datetime.now(timezone.utc).isoformat()
        self._partition_map = self._build_partition_map()
        logger.info(f"Bronze layer initialized at {base_path}")

    def _build_partition_map(self) -> dict[str, dict]:
        """Define partition strategy for each bronze table."""
        return {
            # Internal Exchange
            "exchange/orders": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 128,
                "retention_days": -1,  # indefinite
            },
            "exchange/trades": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 128,
                "retention_days": -1,
            },
            "exchange/orderbook_snapshots": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 90,
            },
            "exchange/circuit_breakers": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "exchange/fix_messages": {
                "partition_columns": ["date", "msg_type"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 128,
                "retention_days": 2555,  # ~7 years regulatory
            },
            # Clearing
            "clearing/positions": {
                "partition_columns": ["date", "account_id"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 64,
                "retention_days": -1,
            },
            "clearing/margins": {
                "partition_columns": ["date", "account_id"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 64,
                "retention_days": -1,
            },
            "clearing/ledger": {
                "partition_columns": ["date", "transfer_type"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 128,
                "retention_days": -1,
            },
            # Surveillance & Audit
            "surveillance/alerts": {
                "partition_columns": ["date", "alert_type"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "surveillance/audit_trail": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 256,
                "retention_days": -1,  # WORM — never delete
                "worm": True,
            },
            # Delivery
            "delivery/events": {
                "partition_columns": ["date", "warehouse_id"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            # External Market Data
            "market_data/cme": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 3650,  # 10 years
            },
            "market_data/ice": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 3650,
            },
            "market_data/lme": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 128,
                "retention_days": 3650,
            },
            "market_data/shfe": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 3650,
            },
            "market_data/mcx": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 128,
                "retention_days": 3650,
            },
            "market_data/reuters": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 128,
                "retention_days": 3650,
            },
            "market_data/bloomberg": {
                "partition_columns": ["date", "symbol"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 128,
                "retention_days": 3650,
            },
            "market_data/central_bank_rates": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            # Alternative Data
            "alternative/satellite_imagery": {
                "partition_columns": ["date", "region"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 512,
                "retention_days": 3650,
            },
            "alternative/weather_climate": {
                "partition_columns": ["date", "source"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 3650,
            },
            "alternative/shipping_ais": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 365,
            },
            "alternative/news_articles": {
                "partition_columns": ["date", "source"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 128,
                "retention_days": 1825,
            },
            "alternative/social_sentiment": {
                "partition_columns": ["date", "platform"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 64,
                "retention_days": 365,
            },
            "alternative/blockchain_events": {
                "partition_columns": ["date", "chain"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 64,
                "retention_days": -1,
            },
            # Regulatory
            "regulatory/cftc_cot": {
                "partition_columns": ["report_date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "regulatory/transaction_reports": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 64,
                "retention_days": -1,
            },
            "regulatory/sanctions_lists": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "regulatory/position_limits": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            # IoT / Physical
            "iot/warehouse_sensors": {
                "partition_columns": ["date", "warehouse_id"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 365,
            },
            "iot/fleet_tracking": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "zstd",
                "target_file_size_mb": 256,
                "retention_days": 365,
            },
            "iot/port_operations": {
                "partition_columns": ["date", "port_id"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": 365,
            },
            "iot/quality_assurance": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            # Reference
            "reference/contract_specs": {
                "partition_columns": ["effective_date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "reference/calendars": {
                "partition_columns": ["year"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "reference/margin_parameters": {
                "partition_columns": ["effective_date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            "reference/corporate_actions": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": -1,
            },
            # Infrastructure
            "infrastructure/ha_events": {
                "partition_columns": ["date"],
                "file_format": "parquet",
                "compression": "snappy",
                "target_file_size_mb": 16,
                "retention_days": 90,
            },
        }

    def status(self) -> dict:
        return {
            "status": "healthy",
            "base_path": self.base_path,
            "table_count": len(self._partition_map),
            "total_writes": self._write_count,
            "total_bytes_written": self._bytes_written,
            "last_write": self._last_write,
        }

    def partition_map(self) -> dict:
        return self._partition_map
