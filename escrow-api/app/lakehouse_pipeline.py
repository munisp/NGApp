"""
Lakehouse Data Pipeline for EscrowProtect Platform

Provides data pipeline infrastructure for streaming events to the lakehouse (Apache Iceberg).
Supports real-time analytics, ML feature engineering, and compliance reporting.

Architecture:
    Kafka Topics → Flink/Spark Streaming → Iceberg Tables → Trino Queries
                                                          → ML Feature Store
                                                          → Analytics Dashboards

Table Catalog:
    - escrow.transactions: All financial transactions
    - escrow.escrows: Escrow lifecycle events
    - escrow.disputes: Dispute records and resolutions
    - escrow.users: User profiles and KYC status
    - escrow.sellers: Seller metrics and tiers
    - escrow.risk_assessments: Risk scoring history
    - escrow.fraud_alerts: Fraud detection events
    - escrow.reconciliation: Ledger reconciliation records
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, asdict, field
import uuid

logger = logging.getLogger(__name__)

# =============================================================================
# ICEBERG TABLE SCHEMAS
# =============================================================================

@dataclass
class IcebergColumn:
    """Definition of an Iceberg table column"""
    name: str
    type: str  # Iceberg types: string, long, double, timestamp, boolean, struct, array, map
    nullable: bool = True
    comment: str = ""
    
    def to_spark_type(self) -> str:
        """Convert to Spark SQL type"""
        type_mapping = {
            "string": "STRING",
            "long": "BIGINT",
            "int": "INT",
            "double": "DOUBLE",
            "float": "FLOAT",
            "boolean": "BOOLEAN",
            "timestamp": "TIMESTAMP",
            "date": "DATE",
            "binary": "BINARY",
            "decimal": "DECIMAL(38,10)",
        }
        return type_mapping.get(self.type, "STRING")
    
    def to_trino_type(self) -> str:
        """Convert to Trino SQL type"""
        type_mapping = {
            "string": "VARCHAR",
            "long": "BIGINT",
            "int": "INTEGER",
            "double": "DOUBLE",
            "float": "REAL",
            "boolean": "BOOLEAN",
            "timestamp": "TIMESTAMP(6)",
            "date": "DATE",
            "binary": "VARBINARY",
            "decimal": "DECIMAL(38,10)",
        }
        return type_mapping.get(self.type, "VARCHAR")


@dataclass
class IcebergTableSchema:
    """Definition of an Iceberg table schema"""
    name: str
    columns: List[IcebergColumn]
    partition_by: List[str] = field(default_factory=list)
    sort_by: List[str] = field(default_factory=list)
    comment: str = ""
    properties: Dict[str, str] = field(default_factory=dict)
    
    def to_spark_ddl(self, catalog: str = "iceberg", database: str = "escrow") -> str:
        """Generate Spark SQL CREATE TABLE statement"""
        columns_ddl = ",\n    ".join(
            f"{col.name} {col.to_spark_type()}" + 
            ("" if col.nullable else " NOT NULL") +
            (f" COMMENT '{col.comment}'" if col.comment else "")
            for col in self.columns
        )
        
        partition_clause = ""
        if self.partition_by:
            partition_clause = f"\nPARTITIONED BY ({', '.join(self.partition_by)})"
        
        properties_clause = ""
        if self.properties:
            props = ", ".join(f"'{k}' = '{v}'" for k, v in self.properties.items())
            properties_clause = f"\nTBLPROPERTIES ({props})"
        
        return f"""CREATE TABLE IF NOT EXISTS {catalog}.{database}.{self.name} (
    {columns_ddl}
){partition_clause}
USING iceberg{properties_clause}
COMMENT '{self.comment}'"""
    
    def to_trino_ddl(self, catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Generate Trino SQL CREATE TABLE statement"""
        columns_ddl = ",\n    ".join(
            f"{col.name} {col.to_trino_type()}" +
            ("" if col.nullable else " NOT NULL")
            for col in self.columns
        )
        
        partition_clause = ""
        if self.partition_by:
            partition_clause = f"\nWITH (partitioning = ARRAY[{', '.join(repr(p) for p in self.partition_by)}])"
        
        return f"""CREATE TABLE IF NOT EXISTS {catalog}.{schema}.{self.name} (
    {columns_ddl}
){partition_clause}"""


# =============================================================================
# TABLE DEFINITIONS
# =============================================================================

# Common columns for all tables
COMMON_COLUMNS = [
    IcebergColumn("event_id", "string", False, "Unique event identifier"),
    IcebergColumn("event_timestamp", "timestamp", False, "When the event occurred"),
    IcebergColumn("ingestion_timestamp", "timestamp", False, "When the event was ingested"),
    IcebergColumn("correlation_id", "string", True, "Correlation ID for tracing"),
]

# Transactions table
TRANSACTIONS_TABLE = IcebergTableSchema(
    name="transactions",
    columns=COMMON_COLUMNS + [
        IcebergColumn("transaction_id", "string", False, "Transaction identifier"),
        IcebergColumn("escrow_id", "string", True, "Related escrow identifier"),
        IcebergColumn("transaction_type", "string", False, "Type: fund, release, refund, payout"),
        IcebergColumn("amount", "decimal", False, "Transaction amount"),
        IcebergColumn("currency", "string", False, "Currency code (NGN, GHS, KES, etc.)"),
        IcebergColumn("from_account", "string", True, "Source account"),
        IcebergColumn("to_account", "string", True, "Destination account"),
        IcebergColumn("status", "string", False, "Status: pending, completed, failed, reversed"),
        IcebergColumn("payment_method", "string", True, "Payment method used"),
        IcebergColumn("payment_reference", "string", True, "External payment reference"),
        IcebergColumn("ledger_entry_id", "string", True, "TigerBeetle ledger entry ID"),
        IcebergColumn("fee_amount", "decimal", True, "Transaction fee"),
        IcebergColumn("net_amount", "decimal", True, "Net amount after fees"),
        IcebergColumn("buyer_id", "string", True, "Buyer identifier"),
        IcebergColumn("seller_id", "string", True, "Seller identifier"),
        IcebergColumn("metadata", "string", True, "JSON metadata"),
    ],
    partition_by=["days(event_timestamp)", "currency"],
    sort_by=["event_timestamp", "transaction_id"],
    comment="All financial transactions in the escrow platform",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Escrows table
ESCROWS_TABLE = IcebergTableSchema(
    name="escrows",
    columns=COMMON_COLUMNS + [
        IcebergColumn("escrow_id", "string", False, "Escrow identifier"),
        IcebergColumn("buyer_id", "string", False, "Buyer identifier"),
        IcebergColumn("seller_id", "string", False, "Seller identifier"),
        IcebergColumn("amount", "decimal", False, "Escrow amount"),
        IcebergColumn("currency", "string", False, "Currency code"),
        IcebergColumn("status", "string", False, "Status: created, funded, released, refunded, disputed, expired"),
        IcebergColumn("description", "string", True, "Transaction description"),
        IcebergColumn("items", "string", True, "JSON array of items"),
        IcebergColumn("delivery_method", "string", True, "Delivery method"),
        IcebergColumn("created_at", "timestamp", False, "Creation timestamp"),
        IcebergColumn("funded_at", "timestamp", True, "Funding timestamp"),
        IcebergColumn("released_at", "timestamp", True, "Release timestamp"),
        IcebergColumn("expired_at", "timestamp", True, "Expiration timestamp"),
        IcebergColumn("expiry_date", "timestamp", True, "Expected expiry date"),
        IcebergColumn("release_reason", "string", True, "Reason for release"),
        IcebergColumn("platform_source", "string", True, "Source platform (instagram, whatsapp, etc.)"),
        IcebergColumn("metadata", "string", True, "JSON metadata"),
    ],
    partition_by=["days(event_timestamp)", "status"],
    sort_by=["event_timestamp", "escrow_id"],
    comment="Escrow lifecycle events",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Disputes table
DISPUTES_TABLE = IcebergTableSchema(
    name="disputes",
    columns=COMMON_COLUMNS + [
        IcebergColumn("dispute_id", "string", False, "Dispute identifier"),
        IcebergColumn("escrow_id", "string", False, "Related escrow identifier"),
        IcebergColumn("complainant_id", "string", False, "Who filed the dispute"),
        IcebergColumn("respondent_id", "string", False, "Who the dispute is against"),
        IcebergColumn("dispute_type", "string", False, "Type: item_not_received, item_not_as_described, etc."),
        IcebergColumn("status", "string", False, "Status: opened, evidence_submitted, escalated, resolved"),
        IcebergColumn("amount_disputed", "decimal", False, "Amount in dispute"),
        IcebergColumn("currency", "string", False, "Currency code"),
        IcebergColumn("reason", "string", True, "Dispute reason"),
        IcebergColumn("evidence_urls", "string", True, "JSON array of evidence URLs"),
        IcebergColumn("resolution", "string", True, "Resolution outcome"),
        IcebergColumn("winner_id", "string", True, "Winner of the dispute"),
        IcebergColumn("amount_awarded", "decimal", True, "Amount awarded to winner"),
        IcebergColumn("resolved_by", "string", True, "Who resolved the dispute"),
        IcebergColumn("resolution_notes", "string", True, "Resolution notes"),
        IcebergColumn("opened_at", "timestamp", False, "When dispute was opened"),
        IcebergColumn("resolved_at", "timestamp", True, "When dispute was resolved"),
        IcebergColumn("sla_deadline", "timestamp", True, "SLA deadline for resolution"),
        IcebergColumn("sla_breached", "boolean", True, "Whether SLA was breached"),
    ],
    partition_by=["days(event_timestamp)", "status"],
    sort_by=["event_timestamp", "dispute_id"],
    comment="Dispute records and resolutions",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Users table
USERS_TABLE = IcebergTableSchema(
    name="users",
    columns=COMMON_COLUMNS + [
        IcebergColumn("user_id", "string", False, "User identifier"),
        IcebergColumn("user_type", "string", False, "Type: buyer, seller, agent, admin"),
        IcebergColumn("kyc_tier", "string", True, "KYC tier: 0, 1, 2, 3"),
        IcebergColumn("kyc_status", "string", True, "KYC status: pending, verified, rejected"),
        IcebergColumn("phone_verified", "boolean", True, "Phone verification status"),
        IcebergColumn("email_verified", "boolean", True, "Email verification status"),
        IcebergColumn("bvn_verified", "boolean", True, "BVN verification status"),
        IcebergColumn("nin_verified", "boolean", True, "NIN verification status"),
        IcebergColumn("country", "string", True, "Country code"),
        IcebergColumn("state", "string", True, "State/region"),
        IcebergColumn("city", "string", True, "City"),
        IcebergColumn("registered_at", "timestamp", True, "Registration timestamp"),
        IcebergColumn("last_active_at", "timestamp", True, "Last activity timestamp"),
        IcebergColumn("total_transactions", "long", True, "Total transaction count"),
        IcebergColumn("total_volume", "decimal", True, "Total transaction volume"),
        IcebergColumn("risk_score", "double", True, "Current risk score"),
        IcebergColumn("is_blocked", "boolean", True, "Whether user is blocked"),
    ],
    partition_by=["country", "user_type"],
    sort_by=["event_timestamp", "user_id"],
    comment="User profiles and KYC status",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Sellers table
SELLERS_TABLE = IcebergTableSchema(
    name="sellers",
    columns=COMMON_COLUMNS + [
        IcebergColumn("seller_id", "string", False, "Seller identifier"),
        IcebergColumn("business_name", "string", True, "Business name"),
        IcebergColumn("seller_tier", "string", True, "Tier: bronze, silver, gold, platinum"),
        IcebergColumn("verification_status", "string", True, "Verification status"),
        IcebergColumn("total_sales", "long", True, "Total number of sales"),
        IcebergColumn("total_revenue", "decimal", True, "Total revenue"),
        IcebergColumn("average_rating", "double", True, "Average customer rating"),
        IcebergColumn("dispute_rate", "double", True, "Dispute rate percentage"),
        IcebergColumn("return_rate", "double", True, "Return rate percentage"),
        IcebergColumn("on_time_delivery_rate", "double", True, "On-time delivery rate"),
        IcebergColumn("fee_rate", "double", True, "Current fee rate"),
        IcebergColumn("payout_delay_hours", "int", True, "Payout delay in hours"),
        IcebergColumn("primary_category", "string", True, "Primary product category"),
        IcebergColumn("platform_sources", "string", True, "JSON array of platform sources"),
        IcebergColumn("bank_verified", "boolean", True, "Bank account verified"),
        IcebergColumn("joined_at", "timestamp", True, "When seller joined"),
    ],
    partition_by=["seller_tier"],
    sort_by=["event_timestamp", "seller_id"],
    comment="Seller metrics and tiers",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Risk assessments table
RISK_ASSESSMENTS_TABLE = IcebergTableSchema(
    name="risk_assessments",
    columns=COMMON_COLUMNS + [
        IcebergColumn("assessment_id", "string", False, "Assessment identifier"),
        IcebergColumn("entity_type", "string", False, "Entity type: transaction, user, escrow"),
        IcebergColumn("entity_id", "string", False, "Entity identifier"),
        IcebergColumn("risk_score", "double", False, "Risk score (0-1)"),
        IcebergColumn("risk_level", "string", False, "Risk level: low, medium, high, critical"),
        IcebergColumn("factors", "string", True, "JSON array of risk factors"),
        IcebergColumn("recommendation", "string", True, "Recommended action"),
        IcebergColumn("model_version", "string", True, "ML model version used"),
        IcebergColumn("assessed_at", "timestamp", False, "Assessment timestamp"),
    ],
    partition_by=["days(event_timestamp)", "risk_level"],
    sort_by=["event_timestamp", "assessment_id"],
    comment="Risk scoring history for ML training",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Fraud alerts table
FRAUD_ALERTS_TABLE = IcebergTableSchema(
    name="fraud_alerts",
    columns=COMMON_COLUMNS + [
        IcebergColumn("alert_id", "string", False, "Alert identifier"),
        IcebergColumn("entity_type", "string", False, "Entity type"),
        IcebergColumn("entity_id", "string", False, "Entity identifier"),
        IcebergColumn("fraud_type", "string", False, "Type of fraud detected"),
        IcebergColumn("confidence", "double", False, "Detection confidence (0-1)"),
        IcebergColumn("indicators", "string", True, "JSON array of fraud indicators"),
        IcebergColumn("action_taken", "string", True, "Action taken"),
        IcebergColumn("reviewed_by", "string", True, "Who reviewed the alert"),
        IcebergColumn("review_outcome", "string", True, "Review outcome: confirmed, false_positive"),
        IcebergColumn("detected_at", "timestamp", False, "Detection timestamp"),
        IcebergColumn("reviewed_at", "timestamp", True, "Review timestamp"),
    ],
    partition_by=["days(event_timestamp)", "fraud_type"],
    sort_by=["event_timestamp", "alert_id"],
    comment="Fraud detection events for analysis",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# Reconciliation table
RECONCILIATION_TABLE = IcebergTableSchema(
    name="reconciliation",
    columns=COMMON_COLUMNS + [
        IcebergColumn("reconciliation_id", "string", False, "Reconciliation identifier"),
        IcebergColumn("reconciliation_type", "string", False, "Type: daily, weekly, monthly, on_demand"),
        IcebergColumn("start_date", "date", False, "Period start date"),
        IcebergColumn("end_date", "date", False, "Period end date"),
        IcebergColumn("currency", "string", False, "Currency code"),
        IcebergColumn("expected_balance", "decimal", False, "Expected balance from transactions"),
        IcebergColumn("actual_balance", "decimal", False, "Actual balance from ledger"),
        IcebergColumn("discrepancy", "decimal", False, "Discrepancy amount"),
        IcebergColumn("discrepancy_percent", "double", False, "Discrepancy percentage"),
        IcebergColumn("status", "string", False, "Status: matched, discrepancy, investigating, resolved"),
        IcebergColumn("transactions_count", "long", True, "Number of transactions in period"),
        IcebergColumn("resolution_notes", "string", True, "Resolution notes"),
        IcebergColumn("completed_at", "timestamp", False, "Completion timestamp"),
    ],
    partition_by=["months(start_date)", "currency"],
    sort_by=["event_timestamp", "reconciliation_id"],
    comment="Ledger reconciliation records",
    properties={
        "write.format.default": "parquet",
        "write.parquet.compression-codec": "zstd",
    },
)

# All table schemas
ALL_TABLES = [
    TRANSACTIONS_TABLE,
    ESCROWS_TABLE,
    DISPUTES_TABLE,
    USERS_TABLE,
    SELLERS_TABLE,
    RISK_ASSESSMENTS_TABLE,
    FRAUD_ALERTS_TABLE,
    RECONCILIATION_TABLE,
]


# =============================================================================
# ANALYTICS QUERIES
# =============================================================================

class AnalyticsQueries:
    """Pre-built analytics queries for common use cases"""
    
    @staticmethod
    def daily_transaction_volume(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Daily transaction volume by currency"""
        return f"""
SELECT 
    DATE(event_timestamp) as transaction_date,
    currency,
    COUNT(*) as transaction_count,
    SUM(amount) as total_volume,
    AVG(amount) as avg_transaction_size,
    SUM(fee_amount) as total_fees
FROM {catalog}.{schema}.transactions
WHERE status = 'completed'
GROUP BY DATE(event_timestamp), currency
ORDER BY transaction_date DESC, currency
"""
    
    @staticmethod
    def seller_performance(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Seller performance metrics"""
        return f"""
SELECT 
    s.seller_id,
    s.business_name,
    s.seller_tier,
    s.total_sales,
    s.total_revenue,
    s.average_rating,
    s.dispute_rate,
    s.return_rate,
    s.on_time_delivery_rate,
    COUNT(DISTINCT e.escrow_id) as active_escrows,
    SUM(CASE WHEN e.status = 'disputed' THEN 1 ELSE 0 END) as disputed_escrows
FROM {catalog}.{schema}.sellers s
LEFT JOIN {catalog}.{schema}.escrows e ON s.seller_id = e.seller_id
    AND e.event_timestamp >= CURRENT_DATE - INTERVAL '30' DAY
GROUP BY s.seller_id, s.business_name, s.seller_tier, s.total_sales, 
         s.total_revenue, s.average_rating, s.dispute_rate, s.return_rate, 
         s.on_time_delivery_rate
ORDER BY s.total_revenue DESC
"""
    
    @staticmethod
    def dispute_analytics(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Dispute analytics and trends"""
        return f"""
SELECT 
    DATE(opened_at) as dispute_date,
    dispute_type,
    COUNT(*) as dispute_count,
    AVG(amount_disputed) as avg_amount,
    SUM(CASE WHEN resolution = 'buyer_wins' THEN 1 ELSE 0 END) as buyer_wins,
    SUM(CASE WHEN resolution = 'seller_wins' THEN 1 ELSE 0 END) as seller_wins,
    SUM(CASE WHEN sla_breached THEN 1 ELSE 0 END) as sla_breaches,
    AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at))/3600) as avg_resolution_hours
FROM {catalog}.{schema}.disputes
WHERE opened_at >= CURRENT_DATE - INTERVAL '30' DAY
GROUP BY DATE(opened_at), dispute_type
ORDER BY dispute_date DESC, dispute_count DESC
"""
    
    @staticmethod
    def risk_distribution(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Risk score distribution"""
        return f"""
SELECT 
    risk_level,
    entity_type,
    COUNT(*) as assessment_count,
    AVG(risk_score) as avg_risk_score,
    MIN(risk_score) as min_risk_score,
    MAX(risk_score) as max_risk_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY risk_score) as median_risk_score
FROM {catalog}.{schema}.risk_assessments
WHERE assessed_at >= CURRENT_DATE - INTERVAL '7' DAY
GROUP BY risk_level, entity_type
ORDER BY risk_level, entity_type
"""
    
    @staticmethod
    def fraud_detection_metrics(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Fraud detection accuracy metrics"""
        return f"""
SELECT 
    fraud_type,
    COUNT(*) as total_alerts,
    SUM(CASE WHEN review_outcome = 'confirmed' THEN 1 ELSE 0 END) as confirmed_fraud,
    SUM(CASE WHEN review_outcome = 'false_positive' THEN 1 ELSE 0 END) as false_positives,
    AVG(confidence) as avg_confidence,
    CAST(SUM(CASE WHEN review_outcome = 'confirmed' THEN 1 ELSE 0 END) AS DOUBLE) / 
        NULLIF(COUNT(*), 0) as precision_rate
FROM {catalog}.{schema}.fraud_alerts
WHERE detected_at >= CURRENT_DATE - INTERVAL '30' DAY
    AND review_outcome IS NOT NULL
GROUP BY fraud_type
ORDER BY total_alerts DESC
"""
    
    @staticmethod
    def reconciliation_summary(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Reconciliation summary"""
        return f"""
SELECT 
    currency,
    COUNT(*) as reconciliation_count,
    SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched_count,
    SUM(CASE WHEN status = 'discrepancy' THEN 1 ELSE 0 END) as discrepancy_count,
    SUM(ABS(discrepancy)) as total_discrepancy,
    AVG(ABS(discrepancy_percent)) as avg_discrepancy_percent,
    MAX(ABS(discrepancy)) as max_discrepancy
FROM {catalog}.{schema}.reconciliation
WHERE completed_at >= CURRENT_DATE - INTERVAL '30' DAY
GROUP BY currency
ORDER BY total_discrepancy DESC
"""
    
    @staticmethod
    def user_cohort_analysis(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """User cohort analysis by registration month"""
        return f"""
SELECT 
    DATE_TRUNC('month', registered_at) as cohort_month,
    user_type,
    kyc_tier,
    COUNT(*) as user_count,
    AVG(total_transactions) as avg_transactions,
    AVG(total_volume) as avg_volume,
    AVG(risk_score) as avg_risk_score,
    SUM(CASE WHEN is_blocked THEN 1 ELSE 0 END) as blocked_users
FROM {catalog}.{schema}.users
WHERE registered_at >= CURRENT_DATE - INTERVAL '12' MONTH
GROUP BY DATE_TRUNC('month', registered_at), user_type, kyc_tier
ORDER BY cohort_month DESC, user_type, kyc_tier
"""
    
    @staticmethod
    def platform_source_analysis(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Analysis by platform source (Instagram, WhatsApp, etc.)"""
        return f"""
SELECT 
    platform_source,
    COUNT(*) as escrow_count,
    SUM(amount) as total_volume,
    AVG(amount) as avg_escrow_size,
    SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as successful_escrows,
    SUM(CASE WHEN status = 'disputed' THEN 1 ELSE 0 END) as disputed_escrows,
    SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded_escrows,
    CAST(SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) AS DOUBLE) / 
        NULLIF(COUNT(*), 0) as success_rate
FROM {catalog}.{schema}.escrows
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30' DAY
    AND platform_source IS NOT NULL
GROUP BY platform_source
ORDER BY total_volume DESC
"""


# =============================================================================
# ML FEATURE STORE
# =============================================================================

class MLFeatureStore:
    """
    Feature store for ML model training and inference.
    Extracts features from lakehouse tables for risk scoring, fraud detection, etc.
    """
    
    @staticmethod
    def user_features_query(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Extract user features for risk scoring model"""
        return f"""
SELECT 
    u.user_id,
    u.user_type,
    u.kyc_tier,
    u.country,
    u.total_transactions,
    u.total_volume,
    u.risk_score as historical_risk_score,
    
    -- Transaction features (last 30 days)
    COALESCE(t.txn_count_30d, 0) as txn_count_30d,
    COALESCE(t.txn_volume_30d, 0) as txn_volume_30d,
    COALESCE(t.avg_txn_size_30d, 0) as avg_txn_size_30d,
    COALESCE(t.failed_txn_rate_30d, 0) as failed_txn_rate_30d,
    
    -- Dispute features
    COALESCE(d.dispute_count_30d, 0) as dispute_count_30d,
    COALESCE(d.dispute_rate_30d, 0) as dispute_rate_30d,
    COALESCE(d.disputes_won_rate, 0) as disputes_won_rate,
    
    -- Account age
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - u.registered_at) as account_age_days,
    
    -- Activity recency
    EXTRACT(HOUR FROM CURRENT_TIMESTAMP - u.last_active_at) as hours_since_active
    
FROM {catalog}.{schema}.users u

LEFT JOIN (
    SELECT 
        buyer_id as user_id,
        COUNT(*) as txn_count_30d,
        SUM(amount) as txn_volume_30d,
        AVG(amount) as avg_txn_size_30d,
        CAST(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS DOUBLE) / 
            NULLIF(COUNT(*), 0) as failed_txn_rate_30d
    FROM {catalog}.{schema}.transactions
    WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30' DAY
    GROUP BY buyer_id
) t ON u.user_id = t.user_id

LEFT JOIN (
    SELECT 
        complainant_id as user_id,
        COUNT(*) as dispute_count_30d,
        CAST(COUNT(*) AS DOUBLE) / NULLIF(
            (SELECT COUNT(*) FROM {catalog}.{schema}.escrows e 
             WHERE e.buyer_id = complainant_id 
             AND e.event_timestamp >= CURRENT_DATE - INTERVAL '30' DAY), 0
        ) as dispute_rate_30d,
        CAST(SUM(CASE WHEN winner_id = complainant_id THEN 1 ELSE 0 END) AS DOUBLE) / 
            NULLIF(COUNT(*), 0) as disputes_won_rate
    FROM {catalog}.{schema}.disputes
    WHERE opened_at >= CURRENT_DATE - INTERVAL '30' DAY
    GROUP BY complainant_id
) d ON u.user_id = d.user_id

WHERE u.event_timestamp = (
    SELECT MAX(event_timestamp) FROM {catalog}.{schema}.users u2 WHERE u2.user_id = u.user_id
)
"""
    
    @staticmethod
    def transaction_features_query(catalog: str = "iceberg", schema: str = "escrow") -> str:
        """Extract transaction features for fraud detection model"""
        return f"""
SELECT 
    t.transaction_id,
    t.escrow_id,
    t.amount,
    t.currency,
    t.transaction_type,
    
    -- Time features
    EXTRACT(HOUR FROM t.event_timestamp) as hour_of_day,
    EXTRACT(DOW FROM t.event_timestamp) as day_of_week,
    
    -- Buyer features
    COALESCE(b.total_transactions, 0) as buyer_total_txns,
    COALESCE(b.total_volume, 0) as buyer_total_volume,
    COALESCE(b.risk_score, 0.5) as buyer_risk_score,
    b.kyc_tier as buyer_kyc_tier,
    
    -- Seller features
    COALESCE(s.total_sales, 0) as seller_total_sales,
    COALESCE(s.total_revenue, 0) as seller_total_revenue,
    COALESCE(s.dispute_rate, 0) as seller_dispute_rate,
    COALESCE(s.average_rating, 0) as seller_rating,
    s.seller_tier,
    
    -- Velocity features (buyer)
    COALESCE(v.txns_last_hour, 0) as buyer_txns_last_hour,
    COALESCE(v.txns_last_24h, 0) as buyer_txns_last_24h,
    COALESCE(v.volume_last_24h, 0) as buyer_volume_last_24h,
    
    -- Amount deviation
    CASE 
        WHEN b.total_transactions > 0 THEN 
            (t.amount - COALESCE(b.total_volume / b.total_transactions, 0)) / 
            NULLIF(COALESCE(b.total_volume / b.total_transactions, 1), 0)
        ELSE 0 
    END as amount_deviation_from_avg

FROM {catalog}.{schema}.transactions t

LEFT JOIN {catalog}.{schema}.users b ON t.buyer_id = b.user_id
LEFT JOIN {catalog}.{schema}.sellers s ON t.seller_id = s.seller_id

LEFT JOIN (
    SELECT 
        buyer_id,
        SUM(CASE WHEN event_timestamp >= CURRENT_TIMESTAMP - INTERVAL '1' HOUR THEN 1 ELSE 0 END) as txns_last_hour,
        COUNT(*) as txns_last_24h,
        SUM(amount) as volume_last_24h
    FROM {catalog}.{schema}.transactions
    WHERE event_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24' HOUR
    GROUP BY buyer_id
) v ON t.buyer_id = v.buyer_id

WHERE t.event_timestamp >= CURRENT_DATE - INTERVAL '1' DAY
"""


# =============================================================================
# LAKEHOUSE CLIENT
# =============================================================================

class LakehouseClient:
    """
    Client for interacting with the lakehouse (Iceberg tables via Trino/Spark).
    """
    
    def __init__(
        self,
        trino_host: str = None,
        trino_port: int = None,
        catalog: str = "iceberg",
        schema: str = "escrow",
    ):
        self.trino_host = trino_host or os.getenv("TRINO_HOST", "localhost")
        self.trino_port = trino_port or int(os.getenv("TRINO_PORT", "8080"))
        self.catalog = catalog
        self.schema = schema
        self._connection = None
    
    async def _get_connection(self):
        """Get Trino connection (lazy initialization)"""
        if self._connection is not None:
            return self._connection
        
        try:
            import trino
            self._connection = trino.dbapi.connect(
                host=self.trino_host,
                port=self.trino_port,
                catalog=self.catalog,
                schema=self.schema,
            )
            logger.info(f"Connected to Trino at {self.trino_host}:{self.trino_port}")
            return self._connection
        except ImportError:
            logger.warning("trino package not installed, using mock connection")
            return None
        except Exception as e:
            logger.error(f"Failed to connect to Trino: {e}")
            return None
    
    async def execute_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dicts"""
        conn = await self._get_connection()
        
        if conn is None:
            logger.warning("No Trino connection, returning empty results")
            return []
        
        try:
            cursor = conn.cursor()
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            return []
    
    async def get_daily_volume(self, days: int = 30) -> List[Dict[str, Any]]:
        """Get daily transaction volume"""
        query = AnalyticsQueries.daily_transaction_volume(self.catalog, self.schema)
        query += f"\nLIMIT {days}"
        return await self.execute_query(query)
    
    async def get_seller_performance(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get seller performance metrics"""
        query = AnalyticsQueries.seller_performance(self.catalog, self.schema)
        query += f"\nLIMIT {limit}"
        return await self.execute_query(query)
    
    async def get_dispute_analytics(self) -> List[Dict[str, Any]]:
        """Get dispute analytics"""
        query = AnalyticsQueries.dispute_analytics(self.catalog, self.schema)
        return await self.execute_query(query)
    
    async def get_risk_distribution(self) -> List[Dict[str, Any]]:
        """Get risk score distribution"""
        query = AnalyticsQueries.risk_distribution(self.catalog, self.schema)
        return await self.execute_query(query)
    
    async def get_user_features(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get ML features for a specific user"""
        query = MLFeatureStore.user_features_query(self.catalog, self.schema)
        query += f"\nWHERE u.user_id = '{user_id}'"
        results = await self.execute_query(query)
        return results[0] if results else None
    
    async def close(self):
        """Close the connection"""
        if self._connection:
            self._connection.close()
            self._connection = None


# =============================================================================
# FASTAPI ROUTER FOR ANALYTICS
# =============================================================================

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

analytics_router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])

# Singleton lakehouse client
_lakehouse_client: Optional[LakehouseClient] = None

def get_lakehouse_client() -> LakehouseClient:
    global _lakehouse_client
    if _lakehouse_client is None:
        _lakehouse_client = LakehouseClient()
    return _lakehouse_client


class TableSchemaResponse(BaseModel):
    name: str
    columns: List[Dict[str, Any]]
    partition_by: List[str]
    comment: str


@analytics_router.get("/tables")
async def list_tables() -> List[TableSchemaResponse]:
    """List all lakehouse table schemas"""
    return [
        TableSchemaResponse(
            name=table.name,
            columns=[asdict(col) for col in table.columns],
            partition_by=table.partition_by,
            comment=table.comment,
        )
        for table in ALL_TABLES
    ]


@analytics_router.get("/tables/{table_name}/ddl")
async def get_table_ddl(table_name: str, format: str = Query("spark", enum=["spark", "trino"])):
    """Get DDL for a specific table"""
    table = next((t for t in ALL_TABLES if t.name == table_name), None)
    if not table:
        raise HTTPException(status_code=404, detail=f"Table {table_name} not found")
    
    if format == "spark":
        return {"ddl": table.to_spark_ddl()}
    else:
        return {"ddl": table.to_trino_ddl()}


@analytics_router.get("/queries")
async def list_queries():
    """List available pre-built analytics queries"""
    return {
        "queries": [
            {"name": "daily_transaction_volume", "description": "Daily transaction volume by currency"},
            {"name": "seller_performance", "description": "Seller performance metrics"},
            {"name": "dispute_analytics", "description": "Dispute analytics and trends"},
            {"name": "risk_distribution", "description": "Risk score distribution"},
            {"name": "fraud_detection_metrics", "description": "Fraud detection accuracy metrics"},
            {"name": "reconciliation_summary", "description": "Reconciliation summary"},
            {"name": "user_cohort_analysis", "description": "User cohort analysis"},
            {"name": "platform_source_analysis", "description": "Analysis by platform source"},
        ]
    }


@analytics_router.get("/queries/{query_name}")
async def get_query(query_name: str):
    """Get SQL for a specific analytics query"""
    queries = {
        "daily_transaction_volume": AnalyticsQueries.daily_transaction_volume,
        "seller_performance": AnalyticsQueries.seller_performance,
        "dispute_analytics": AnalyticsQueries.dispute_analytics,
        "risk_distribution": AnalyticsQueries.risk_distribution,
        "fraud_detection_metrics": AnalyticsQueries.fraud_detection_metrics,
        "reconciliation_summary": AnalyticsQueries.reconciliation_summary,
        "user_cohort_analysis": AnalyticsQueries.user_cohort_analysis,
        "platform_source_analysis": AnalyticsQueries.platform_source_analysis,
    }
    
    if query_name not in queries:
        raise HTTPException(status_code=404, detail=f"Query {query_name} not found")
    
    return {"query": queries[query_name]()}


@analytics_router.get("/ml/features/user/{user_id}")
async def get_user_ml_features(user_id: str):
    """Get ML features for a specific user"""
    client = get_lakehouse_client()
    features = await client.get_user_features(user_id)
    
    if not features:
        # Return default features if lakehouse not available
        return {
            "user_id": user_id,
            "features": {
                "txn_count_30d": 0,
                "txn_volume_30d": 0,
                "dispute_count_30d": 0,
                "account_age_days": 0,
                "risk_score": 0.5,
            },
            "source": "default",
        }
    
    return {"user_id": user_id, "features": features, "source": "lakehouse"}


@analytics_router.get("/ml/features/transaction")
async def get_transaction_ml_features_query():
    """Get the SQL query for transaction ML features"""
    return {"query": MLFeatureStore.transaction_features_query()}
