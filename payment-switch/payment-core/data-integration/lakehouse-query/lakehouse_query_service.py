#!/usr/bin/env python3
"""
Lakehouse Query Service
Provides query layer for analytics activities to access Delta Lake data
"""

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from functools import lru_cache

import redis
from pyspark.sql import SparkSession
from delta import DeltaTable

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    data: Any
    row_count: int
    execution_time_ms: float
    cached: bool
    query_id: str


class LakehouseQueryService:
    """Query service for accessing Delta Lake analytics data"""
    
    def __init__(
        self,
        spark_master: str = "spark://spark-master:7077",
        s3_endpoint: str = "http://rustfs.lakehouse:9000",
        s3_access_key: Optional[str] = None,
        s3_secret_key: Optional[str] = None,
        redis_url: str = "redis://redis:6379/0",
        delta_base_path: str = "s3a://lakehouse/delta"
    ):
        self.spark_master = spark_master
        self.s3_endpoint = s3_endpoint
        self.s3_access_key = s3_access_key or os.getenv('S3_ACCESS_KEY', os.getenv('MINIO_ACCESS_KEY', 'minioadmin'))
        self.s3_secret_key = s3_secret_key or os.getenv('S3_SECRET_KEY', os.getenv('MINIO_SECRET_KEY', 'minioadmin'))
        self.redis_url = redis_url
        self.delta_base_path = delta_base_path
        
        self.spark: Optional[SparkSession] = None
        self.redis_client: Optional[redis.Redis] = None
        self.cache_ttl = 300
        
    def initialize(self):
        """Initialize Spark session and Redis connection"""
        logger.info("Initializing Lakehouse Query Service...")
        
        try:
            self.spark = SparkSession.builder \
                .appName("LakehouseQueryService") \
                .master(self.spark_master) \
                .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
                .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
                .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint) \
                .config("spark.hadoop.fs.s3a.access.key", self.s3_access_key) \
                .config("spark.hadoop.fs.s3a.secret.key", self.s3_secret_key) \
                .config("spark.hadoop.fs.s3a.path.style.access", "true") \
                .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
                .getOrCreate()
            logger.info("Spark session initialized")
        except Exception as e:
            logger.warning(f"Could not initialize Spark session: {e}")
            self.spark = None
        
        try:
            self.redis_client = redis.from_url(self.redis_url)
            self.redis_client.ping()
            logger.info("Redis cache connected")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
            self.redis_client = None
        
        logger.info("Lakehouse Query Service initialized")
    
    def _get_cache_key(self, query_name: str, params: Dict[str, Any]) -> str:
        """Generate cache key for a query"""
        params_str = json.dumps(params, sort_keys=True, default=str)
        return f"lakehouse_query:{query_name}:{hash(params_str)}"
    
    def _get_cached_result(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached query result"""
        if not self.redis_client:
            return None
        try:
            data = self.redis_client.get(cache_key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
        return None
    
    def _cache_result(self, cache_key: str, result: Dict[str, Any], ttl: int = None):
        """Cache query result"""
        if not self.redis_client:
            return
        try:
            self.redis_client.setex(cache_key, ttl or self.cache_ttl, json.dumps(result, default=str))
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    def get_merchant_metrics(self, merchant_id: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get merchant analytics metrics from lakehouse"""
        cache_key = self._get_cache_key("merchant_metrics", {"merchant_id": merchant_id, "start": start_date, "end": end_date})
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not self.spark:
            return self._fallback_merchant_metrics(merchant_id)
        
        try:
            transactions_path = f"{self.delta_base_path}/transactions"
            df = self.spark.read.format("delta").load(transactions_path)
            
            df = df.filter(
                (df.merchant_id == merchant_id) &
                (df.created_at >= start_date) &
                (df.created_at <= end_date)
            )
            
            from pyspark.sql import functions as F
            
            metrics = df.agg(
                F.count("*").alias("total_transactions"),
                F.sum("amount").alias("total_revenue"),
                F.avg("amount").alias("average_transaction_value"),
                F.sum(F.when(df.status == "completed", 1).otherwise(0)).alias("successful_transactions"),
                F.sum(F.when(df.status == "failed", 1).otherwise(0)).alias("failed_transactions"),
                F.sum(F.when(df.status == "refunded", 1).otherwise(0)).alias("refunded_transactions"),
                F.countDistinct("customer_id").alias("unique_customers")
            ).collect()[0]
            
            total = metrics.total_transactions or 1
            result = {
                "merchant_id": merchant_id,
                "period": {"start": start_date, "end": end_date},
                "total_transactions": int(metrics.total_transactions or 0),
                "total_revenue": float(metrics.total_revenue or 0),
                "average_transaction_value": float(metrics.average_transaction_value or 0),
                "success_rate": float(metrics.successful_transactions or 0) / total,
                "refund_rate": float(metrics.refunded_transactions or 0) / total,
                "unique_customers": int(metrics.unique_customers or 0),
                "source": "lakehouse"
            }
            
            self._cache_result(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error querying merchant metrics: {e}")
            return self._fallback_merchant_metrics(merchant_id)
    
    def _fallback_merchant_metrics(self, merchant_id: str) -> Dict[str, Any]:
        """Fallback metrics when lakehouse is unavailable"""
        return {
            "merchant_id": merchant_id,
            "total_transactions": 0,
            "total_revenue": 0,
            "average_transaction_value": 0,
            "success_rate": 0,
            "refund_rate": 0,
            "unique_customers": 0,
            "source": "fallback"
        }
    
    def get_transaction_analytics(self, start_date: str, end_date: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Get transaction analytics from lakehouse"""
        cache_key = self._get_cache_key("transaction_analytics", {"start": start_date, "end": end_date, "filters": filters})
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not self.spark:
            return self._fallback_transaction_analytics()
        
        try:
            transactions_path = f"{self.delta_base_path}/transactions"
            df = self.spark.read.format("delta").load(transactions_path)
            
            df = df.filter((df.created_at >= start_date) & (df.created_at <= end_date))
            
            if filters:
                if filters.get("currency"):
                    df = df.filter(df.currency == filters["currency"])
                if filters.get("payment_method"):
                    df = df.filter(df.payment_method == filters["payment_method"])
            
            from pyspark.sql import functions as F
            
            overall = df.agg(
                F.count("*").alias("total_transactions"),
                F.sum("amount").alias("total_volume"),
                F.avg("amount").alias("avg_transaction_value"),
                F.sum(F.when(df.status == "completed", 1).otherwise(0)).alias("successful"),
                F.sum(F.when(df.fraud_score > 0.8, 1).otherwise(0)).alias("high_risk_count")
            ).collect()[0]
            
            by_payment_method = df.groupBy("payment_method").agg(
                F.count("*").alias("count"),
                F.sum("amount").alias("volume")
            ).collect()
            
            payment_methods = {}
            total_count = overall.total_transactions or 1
            for row in by_payment_method:
                if row.payment_method:
                    payment_methods[row.payment_method] = {
                        "count": int(row.count),
                        "volume": float(row.volume or 0),
                        "percentage": float(row.count) / total_count
                    }
            
            result = {
                "period": {"start": start_date, "end": end_date},
                "total_transactions": int(overall.total_transactions or 0),
                "total_volume": float(overall.total_volume or 0),
                "average_transaction_value": float(overall.avg_transaction_value or 0),
                "success_rate": float(overall.successful or 0) / total_count,
                "fraud_rate": float(overall.high_risk_count or 0) / total_count,
                "payment_methods": payment_methods,
                "source": "lakehouse"
            }
            
            self._cache_result(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error querying transaction analytics: {e}")
            return self._fallback_transaction_analytics()
    
    def _fallback_transaction_analytics(self) -> Dict[str, Any]:
        """Fallback analytics when lakehouse is unavailable"""
        return {
            "total_transactions": 0,
            "total_volume": 0,
            "average_transaction_value": 0,
            "success_rate": 0,
            "fraud_rate": 0,
            "payment_methods": {},
            "source": "fallback"
        }
    
    def get_fraud_analytics(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get fraud analytics from lakehouse"""
        cache_key = self._get_cache_key("fraud_analytics", {"start": start_date, "end": end_date})
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not self.spark:
            return self._fallback_fraud_analytics()
        
        try:
            fraud_scores_path = f"{self.delta_base_path}/fraud_scores"
            df = self.spark.read.format("delta").load(fraud_scores_path)
            
            df = df.filter((df.timestamp >= start_date) & (df.timestamp <= end_date))
            
            from pyspark.sql import functions as F
            
            metrics = df.agg(
                F.count("*").alias("total_scored"),
                F.avg("fraud_score").alias("avg_fraud_score"),
                F.sum(F.when(df.decision == "block", 1).otherwise(0)).alias("blocked"),
                F.sum(F.when(df.decision == "review", 1).otherwise(0)).alias("review"),
                F.sum(F.when(df.decision == "allow", 1).otherwise(0)).alias("allowed"),
                F.avg("latency_ms").alias("avg_latency_ms")
            ).collect()[0]
            
            total = metrics.total_scored or 1
            result = {
                "period": {"start": start_date, "end": end_date},
                "total_scored": int(metrics.total_scored or 0),
                "average_fraud_score": float(metrics.avg_fraud_score or 0),
                "block_rate": float(metrics.blocked or 0) / total,
                "review_rate": float(metrics.review or 0) / total,
                "allow_rate": float(metrics.allowed or 0) / total,
                "avg_scoring_latency_ms": float(metrics.avg_latency_ms or 0),
                "source": "lakehouse"
            }
            
            self._cache_result(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error querying fraud analytics: {e}")
            return self._fallback_fraud_analytics()
    
    def _fallback_fraud_analytics(self) -> Dict[str, Any]:
        """Fallback fraud analytics when lakehouse is unavailable"""
        return {
            "total_scored": 0,
            "average_fraud_score": 0,
            "block_rate": 0,
            "review_rate": 0,
            "allow_rate": 0,
            "avg_scoring_latency_ms": 0,
            "source": "fallback"
        }
    
    def get_settlement_analytics(self, start_date: str, end_date: str, provider: Optional[str] = None) -> Dict[str, Any]:
        """Get settlement analytics from lakehouse"""
        cache_key = self._get_cache_key("settlement_analytics", {"start": start_date, "end": end_date, "provider": provider})
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not self.spark:
            return self._fallback_settlement_analytics()
        
        try:
            settlements_path = f"{self.delta_base_path}/settlements"
            df = self.spark.read.format("delta").load(settlements_path)
            
            df = df.filter((df.settled_at >= start_date) & (df.settled_at <= end_date))
            
            if provider:
                df = df.filter(df.provider == provider)
            
            from pyspark.sql import functions as F
            
            metrics = df.agg(
                F.count("*").alias("total_settlements"),
                F.sum("amount").alias("total_settled"),
                F.avg("latency_seconds").alias("avg_latency"),
                F.sum(F.when(df.status == "completed", 1).otherwise(0)).alias("successful"),
                F.sum(F.when(df.status == "failed", 1).otherwise(0)).alias("failed")
            ).collect()[0]
            
            by_provider = df.groupBy("provider").agg(
                F.count("*").alias("count"),
                F.sum("amount").alias("volume"),
                F.avg("latency_seconds").alias("avg_latency")
            ).collect()
            
            providers = {}
            for row in by_provider:
                if row.provider:
                    providers[row.provider] = {
                        "count": int(row.count),
                        "volume": float(row.volume or 0),
                        "avg_latency_seconds": float(row.avg_latency or 0)
                    }
            
            total = metrics.total_settlements or 1
            result = {
                "period": {"start": start_date, "end": end_date},
                "total_settlements": int(metrics.total_settlements or 0),
                "total_settled_amount": float(metrics.total_settled or 0),
                "average_latency_seconds": float(metrics.avg_latency or 0),
                "success_rate": float(metrics.successful or 0) / total,
                "failure_rate": float(metrics.failed or 0) / total,
                "by_provider": providers,
                "source": "lakehouse"
            }
            
            self._cache_result(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error querying settlement analytics: {e}")
            return self._fallback_settlement_analytics()
    
    def _fallback_settlement_analytics(self) -> Dict[str, Any]:
        """Fallback settlement analytics when lakehouse is unavailable"""
        return {
            "total_settlements": 0,
            "total_settled_amount": 0,
            "average_latency_seconds": 0,
            "success_rate": 0,
            "failure_rate": 0,
            "by_provider": {},
            "source": "fallback"
        }
    
    def get_corridor_analytics(self, corridor: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get corridor-specific analytics for remittances"""
        cache_key = self._get_cache_key("corridor_analytics", {"corridor": corridor, "start": start_date, "end": end_date})
        cached = self._get_cached_result(cache_key)
        if cached:
            return cached
        
        if not self.spark:
            return self._fallback_corridor_analytics(corridor)
        
        try:
            remittances_path = f"{self.delta_base_path}/remittances"
            df = self.spark.read.format("delta").load(remittances_path)
            
            df = df.filter(
                (df.corridor == corridor) &
                (df.created_at >= start_date) &
                (df.created_at <= end_date)
            )
            
            from pyspark.sql import functions as F
            
            metrics = df.agg(
                F.count("*").alias("total_remittances"),
                F.sum("source_amount").alias("total_source_volume"),
                F.sum("destination_amount").alias("total_destination_volume"),
                F.avg("exchange_rate").alias("avg_exchange_rate"),
                F.avg("total_fees").alias("avg_fees"),
                F.sum(F.when(df.status == "completed", 1).otherwise(0)).alias("completed"),
                F.avg("completion_time_seconds").alias("avg_completion_time")
            ).collect()[0]
            
            total = metrics.total_remittances or 1
            result = {
                "corridor": corridor,
                "period": {"start": start_date, "end": end_date},
                "total_remittances": int(metrics.total_remittances or 0),
                "total_source_volume": float(metrics.total_source_volume or 0),
                "total_destination_volume": float(metrics.total_destination_volume or 0),
                "average_exchange_rate": float(metrics.avg_exchange_rate or 0),
                "average_fees": float(metrics.avg_fees or 0),
                "completion_rate": float(metrics.completed or 0) / total,
                "average_completion_time_seconds": float(metrics.avg_completion_time or 0),
                "source": "lakehouse"
            }
            
            self._cache_result(cache_key, result)
            return result
            
        except Exception as e:
            logger.error(f"Error querying corridor analytics: {e}")
            return self._fallback_corridor_analytics(corridor)
    
    def _fallback_corridor_analytics(self, corridor: str) -> Dict[str, Any]:
        """Fallback corridor analytics when lakehouse is unavailable"""
        return {
            "corridor": corridor,
            "total_remittances": 0,
            "total_source_volume": 0,
            "total_destination_volume": 0,
            "average_exchange_rate": 0,
            "average_fees": 0,
            "completion_rate": 0,
            "average_completion_time_seconds": 0,
            "source": "fallback"
        }
    
    def close(self):
        """Close connections"""
        if self.spark:
            self.spark.stop()


_query_service: Optional[LakehouseQueryService] = None


def get_query_service() -> LakehouseQueryService:
    """Get singleton query service instance"""
    global _query_service
    if _query_service is None:
        _query_service = LakehouseQueryService(
            spark_master=os.getenv('SPARK_MASTER', 'spark://spark-master:7077'),
            s3_endpoint=os.getenv('S3_ENDPOINT', 'http://rustfs.lakehouse:9000'),
            redis_url=os.getenv('REDIS_URL', 'redis://redis:6379/0')
        )
        _query_service.initialize()
    return _query_service
