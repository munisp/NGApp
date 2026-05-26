#!/usr/bin/env python3
"""
Lakehouse to TigerBeetle Feedback Loop
Updates account limits and risk controls in TigerBeetle based on Lakehouse analytics
"""

import logging
import os
from datetime import datetime
from typing import Dict, Any, List

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from delta import *
import grpc

# Import TigerBeetle client (assuming it's available)
# from tigerbeetle import Client, Account, Transfer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LakehouseTigerBeetleFeedback:
    """
    Feedback loop from Lakehouse to TigerBeetle
    
    This service uses analytics insights from the Lakehouse to update
    account limits, risk controls, and other operational parameters in TigerBeetle.
    """
    
    def __init__(
        self,
        delta_lake_path: str,
        tigerbeetle_address: str,
        tigerbeetle_cluster_id: int,
        s3_endpoint: str,
        s3_access_key: str,
        s3_secret_key: str
    ):
        self.delta_lake_path = delta_lake_path
        self.tigerbeetle_address = tigerbeetle_address
        self.tigerbeetle_cluster_id = tigerbeetle_cluster_id
        self.s3_endpoint = s3_endpoint
        self.s3_access_key = s3_access_key
        self.s3_secret_key = s3_secret_key
        
        # Initialize Spark session
        self.spark = self._create_spark_session()
        
        # TigerBeetle client (via gRPC)
        self.ledger_client = None
        
    def _create_spark_session(self) -> SparkSession:
        """Create a Spark session configured for Delta Lake"""
        builder = (
            SparkSession.builder
            .appName("Lakehouse to TigerBeetle Feedback")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint)
            .config("spark.hadoop.fs.s3a.access.key", self.s3_access_key)
            .config("spark.hadoop.fs.s3a.secret.key", self.s3_secret_key)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        )
        
        return configure_spark_with_delta_pip(builder).getOrCreate()
    
    def connect_to_ledger(self):
        """Connect to the ledger service (TigerBeetle via gRPC)"""
        try:
            # In production, this would use the actual TigerBeetle client
            # For now, we'll use a gRPC stub to the ledger service
            channel = grpc.insecure_channel(self.tigerbeetle_address)
            # self.ledger_client = LedgerServiceStub(channel)
            logger.info(f"Connected to ledger service at {self.tigerbeetle_address}")
        except Exception as e:
            logger.error(f"Failed to connect to ledger service: {e}")
            raise
    
    def update_account_limits(self):
        """Update account transaction limits based on risk scores"""
        logger.info("Updating account limits based on risk scores...")
        
        # Read account risk scores from Delta Lake
        risk_scores_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/account_risk_scores")
        
        # Define limit tiers based on risk scores
        limits_df = risk_scores_df.withColumn(
            "daily_limit",
            when(col("risk_score") < 0.3, 1000000)  # Low risk: $10,000
            .when(col("risk_score") < 0.6, 500000)   # Medium risk: $5,000
            .otherwise(100000)                        # High risk: $1,000
        ).withColumn(
            "transaction_limit",
            when(col("risk_score") < 0.3, 100000)    # Low risk: $1,000 per txn
            .when(col("risk_score") < 0.6, 50000)     # Medium risk: $500 per txn
            .otherwise(10000)                         # High risk: $100 per txn
        )
        
        # Convert to list of updates
        limits_list = limits_df.select("account_id", "daily_limit", "transaction_limit").collect()
        
        # Update limits via ledger service
        for row in limits_list:
            self._update_account_limit_via_grpc(
                account_id=row.account_id,
                daily_limit=row.daily_limit,
                transaction_limit=row.transaction_limit
            )
        
        logger.info(f"Updated limits for {len(limits_list)} accounts")
    
    def apply_velocity_controls(self):
        """Apply velocity-based transaction controls"""
        logger.info("Applying velocity controls...")
        
        # Read velocity patterns from Delta Lake
        velocity_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/velocity_patterns")
        
        # Identify accounts with suspicious velocity patterns
        suspicious_accounts = velocity_df.filter(
            (col("txn_count_1h") > 50) |  # More than 50 transactions in 1 hour
            (col("txn_amount_1h") > 5000000)  # More than $50,000 in 1 hour
        )
        
        # Apply controls
        controls_list = suspicious_accounts.select("account_id").collect()
        
        for row in controls_list:
            self._apply_velocity_control_via_grpc(
                account_id=row.account_id,
                control_type="velocity_limit",
                duration_seconds=3600  # Apply control for 1 hour
            )
        
        logger.info(f"Applied velocity controls to {len(controls_list)} accounts")
    
    def update_fraud_flags(self):
        """Update fraud flags based on model predictions"""
        logger.info("Updating fraud flags...")
        
        # Read fraud scores from Delta Lake
        fraud_scores_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/fraud_scores")
        
        # Identify high-risk transactions
        high_risk_txns = fraud_scores_df.filter(col("fraud_score") > 0.8)
        
        # Get unique accounts involved in high-risk transactions
        high_risk_accounts = high_risk_txns.select("account_id").distinct().collect()
        
        # Flag accounts for review
        for row in high_risk_accounts:
            self._set_fraud_flag_via_grpc(
                account_id=row.account_id,
                flag_type="high_risk",
                reason="Multiple high-risk transactions detected"
            )
        
        logger.info(f"Flagged {len(high_risk_accounts)} accounts for fraud review")
    
    def _update_account_limit_via_grpc(self, account_id: int, daily_limit: int, transaction_limit: int):
        """Update account limits via gRPC call to ledger service"""
        try:
            # In production, this would call the actual gRPC method
            # request = UpdateAccountLimitsRequest(
            #     account_id=account_id,
            #     daily_limit=daily_limit,
            #     transaction_limit=transaction_limit
            # )
            # response = self.ledger_client.UpdateAccountLimits(request)
            
            logger.debug(f"Updated limits for account {account_id}: daily={daily_limit}, txn={transaction_limit}")
            
        except Exception as e:
            logger.error(f"Failed to update limits for account {account_id}: {e}")
    
    def _apply_velocity_control_via_grpc(self, account_id: int, control_type: str, duration_seconds: int):
        """Apply velocity control via gRPC call to ledger service"""
        try:
            # In production, this would call the actual gRPC method
            # request = ApplyVelocityControlRequest(
            #     account_id=account_id,
            #     control_type=control_type,
            #     duration_seconds=duration_seconds
            # )
            # response = self.ledger_client.ApplyVelocityControl(request)
            
            logger.debug(f"Applied velocity control to account {account_id}: type={control_type}, duration={duration_seconds}s")
            
        except Exception as e:
            logger.error(f"Failed to apply velocity control for account {account_id}: {e}")
    
    def _set_fraud_flag_via_grpc(self, account_id: int, flag_type: str, reason: str):
        """Set fraud flag via gRPC call to ledger service"""
        try:
            # In production, this would call the actual gRPC method
            # request = SetFraudFlagRequest(
            #     account_id=account_id,
            #     flag_type=flag_type,
            #     reason=reason
            # )
            # response = self.ledger_client.SetFraudFlag(request)
            
            logger.debug(f"Set fraud flag for account {account_id}: type={flag_type}, reason={reason}")
            
        except Exception as e:
            logger.error(f"Failed to set fraud flag for account {account_id}: {e}")
    
    def run(self):
        """Run all feedback operations"""
        logger.info("Starting Lakehouse to TigerBeetle Feedback Loop...")
        
        # Connect to ledger service
        self.connect_to_ledger()
        
        try:
            # Apply feedback controls
            self.update_account_limits()
            self.apply_velocity_controls()
            self.update_fraud_flags()
            
            logger.info("Feedback loop completed successfully")
            
        except Exception as e:
            logger.error(f"Feedback loop error: {e}", exc_info=True)
            raise
        finally:
            if self.spark:
                self.spark.stop()


def main():
    """Main entry point"""
    # Configuration from environment variables
    delta_lake_path = os.getenv('DELTA_LAKE_PATH', 's3a://lakehouse/delta')
    tigerbeetle_address = os.getenv('TIGERBEETLE_ADDRESS', 'ledger-service:50051')
    tigerbeetle_cluster_id = int(os.getenv('TIGERBEETLE_CLUSTER_ID', '0'))
    s3_endpoint = os.getenv('S3_ENDPOINT', 'http://minio:9000')
    s3_access_key = os.getenv('S3_ACCESS_KEY', 'minioadmin')
    s3_secret_key = os.getenv('S3_SECRET_KEY', 'minioadmin')
    
    # Create and run the feedback service
    feedback_service = LakehouseTigerBeetleFeedback(
        delta_lake_path=delta_lake_path,
        tigerbeetle_address=tigerbeetle_address,
        tigerbeetle_cluster_id=tigerbeetle_cluster_id,
        s3_endpoint=s3_endpoint,
        s3_access_key=s3_access_key,
        s3_secret_key=s3_secret_key
    )
    
    feedback_service.run()


if __name__ == '__main__':
    main()
