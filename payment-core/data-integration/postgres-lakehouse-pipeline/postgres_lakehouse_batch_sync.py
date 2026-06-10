#!/usr/bin/env python3
"""
PostgreSQL to Lakehouse Batch Sync
Performs periodic batch synchronization from PostgreSQL to Delta Lake
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List

import psycopg2
from psycopg2.extras import RealDictCursor
from pyspark.sql import SparkSession
from pyspark.sql.types import *
from delta import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PostgresLakehouseBatchSync:
    """
    Batch synchronization service from PostgreSQL to Delta Lake
    
    This service complements the real-time streaming pipeline by performing
    periodic full or incremental batch syncs to ensure data consistency.
    """
    
    def __init__(
        self,
        postgres_dsn: str,
        delta_lake_path: str,
        s3_endpoint: str,
        s3_access_key: str,
        s3_secret_key: str,
        batch_size: int = 10000
    ):
        self.postgres_dsn = postgres_dsn
        self.delta_lake_path = delta_lake_path
        self.s3_endpoint = s3_endpoint
        self.s3_access_key = s3_access_key
        self.s3_secret_key = s3_secret_key
        self.batch_size = batch_size
        
        # Initialize Spark session
        self.spark = self._create_spark_session()
        
    def _create_spark_session(self) -> SparkSession:
        """Create a Spark session configured for Delta Lake and S3"""
        builder = (
            SparkSession.builder
            .appName("PostgreSQL to Lakehouse Batch Sync")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint)
            .config("spark.hadoop.fs.s3a.access.key", self.s3_access_key)
            .config("spark.hadoop.fs.s3a.secret.key", self.s3_secret_key)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
            .config("spark.sql.adaptive.enabled", "true")
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
        )
        
        return configure_spark_with_delta_pip(builder).getOrCreate()
    
    def sync_transactions(self, incremental: bool = True):
        """Sync transactions from PostgreSQL to Delta Lake"""
        logger.info("Starting transaction sync...")
        
        # Determine the sync strategy
        if incremental:
            last_sync_time = self._get_last_sync_time("transactions")
            where_clause = f"WHERE updated_at > '{last_sync_time}'"
        else:
            where_clause = ""
        
        # Read from PostgreSQL
        query = f"""
            SELECT 
                id AS transaction_id,
                account_id,
                amount,
                transaction_type,
                status,
                created_at,
                updated_at,
                metadata
            FROM transactions
            {where_clause}
            ORDER BY updated_at
        """
        
        logger.info(f"Executing query: {query}")
        
        # Read data using JDBC
        df = (
            self.spark.read
            .format("jdbc")
            .option("url", self.postgres_dsn.replace("postgresql://", "jdbc:postgresql://"))
            .option("dbtable", f"({query}) AS transactions")
            .option("user", self._extract_user_from_dsn())
            .option("password", self._extract_password_from_dsn())
            .option("driver", "org.postgresql.Driver")
            .option("fetchsize", str(self.batch_size))
            .load()
        )
        
        logger.info(f"Read {df.count()} records from PostgreSQL")
        
        # Write to Delta Lake
        delta_path = f"{self.delta_lake_path}/transactions"
        
        if incremental:
            # Merge for incremental updates
            self._merge_to_delta(df, delta_path, "transaction_id")
        else:
            # Overwrite for full sync
            df.write.format("delta").mode("overwrite").save(delta_path)
        
        # Update last sync time
        self._update_last_sync_time("transactions")
        
        logger.info("Transaction sync completed")
    
    def sync_accounts(self, incremental: bool = True):
        """Sync accounts from PostgreSQL to Delta Lake"""
        logger.info("Starting account sync...")
        
        # Similar to sync_transactions
        if incremental:
            last_sync_time = self._get_last_sync_time("accounts")
            where_clause = f"WHERE synced_at > '{last_sync_time}'"
        else:
            where_clause = ""
        
        query = f"""
            SELECT 
                id AS account_id,
                debits_pending,
                debits_posted,
                credits_pending,
                credits_posted,
                ledger,
                code,
                timestamp,
                synced_at
            FROM tigerbeetle_accounts
            {where_clause}
            ORDER BY synced_at
        """
        
        df = (
            self.spark.read
            .format("jdbc")
            .option("url", self.postgres_dsn.replace("postgresql://", "jdbc:postgresql://"))
            .option("dbtable", f"({query}) AS accounts")
            .option("user", self._extract_user_from_dsn())
            .option("password", self._extract_password_from_dsn())
            .option("driver", "org.postgresql.Driver")
            .option("fetchsize", str(self.batch_size))
            .load()
        )
        
        logger.info(f"Read {df.count()} records from PostgreSQL")
        
        # Write to Delta Lake
        delta_path = f"{self.delta_lake_path}/accounts"
        
        if incremental:
            self._merge_to_delta(df, delta_path, "account_id")
        else:
            df.write.format("delta").mode("overwrite").save(delta_path)
        
        self._update_last_sync_time("accounts")
        
        logger.info("Account sync completed")
    
    def sync_transfers(self, incremental: bool = True):
        """Sync transfers from PostgreSQL to Delta Lake"""
        logger.info("Starting transfer sync...")
        
        if incremental:
            last_sync_time = self._get_last_sync_time("transfers")
            where_clause = f"WHERE synced_at > '{last_sync_time}'"
        else:
            where_clause = ""
        
        query = f"""
            SELECT 
                id AS transfer_id,
                debit_account_id,
                credit_account_id,
                amount,
                ledger,
                code,
                timestamp,
                synced_at
            FROM tigerbeetle_transfers
            {where_clause}
            ORDER BY synced_at
        """
        
        df = (
            self.spark.read
            .format("jdbc")
            .option("url", self.postgres_dsn.replace("postgresql://", "jdbc:postgresql://"))
            .option("dbtable", f"({query}) AS transfers")
            .option("user", self._extract_user_from_dsn())
            .option("password", self._extract_password_from_dsn())
            .option("driver", "org.postgresql.Driver")
            .option("fetchsize", str(self.batch_size))
            .load()
        )
        
        logger.info(f"Read {df.count()} records from PostgreSQL")
        
        # Write to Delta Lake
        delta_path = f"{self.delta_lake_path}/transfers"
        
        if incremental:
            self._merge_to_delta(df, delta_path, "transfer_id")
        else:
            df.write.format("delta").mode("overwrite").save(delta_path)
        
        self._update_last_sync_time("transfers")
        
        logger.info("Transfer sync completed")
    
    def _merge_to_delta(self, df, delta_path: str, merge_key: str):
        """Merge DataFrame into Delta Lake table"""
        from delta.tables import DeltaTable
        
        # Check if the Delta table exists
        if DeltaTable.isDeltaTable(self.spark, delta_path):
            # Perform merge (upsert)
            delta_table = DeltaTable.forPath(self.spark, delta_path)
            
            (
                delta_table.alias("target")
                .merge(
                    df.alias("source"),
                    f"target.{merge_key} = source.{merge_key}"
                )
                .whenMatchedUpdateAll()
                .whenNotMatchedInsertAll()
                .execute()
            )
            
            logger.info(f"Merged data into {delta_path}")
        else:
            # Create new table
            df.write.format("delta").save(delta_path)
            logger.info(f"Created new Delta table at {delta_path}")
    
    def _get_last_sync_time(self, table_name: str) -> str:
        """Get the last sync time for a table"""
        # In production, this would read from a metadata store
        # For now, return a default value
        default_time = (datetime.now() - timedelta(hours=1)).isoformat()
        return default_time
    
    def _update_last_sync_time(self, table_name: str):
        """Update the last sync time for a table"""
        # In production, this would write to a metadata store
        logger.info(f"Updated last sync time for {table_name}")
    
    def _extract_user_from_dsn(self) -> str:
        """Extract username from PostgreSQL DSN"""
        # postgresql://user:password@host:port/database
        parts = self.postgres_dsn.split("//")[1].split("@")[0]
        return parts.split(":")[0]
    
    def _extract_password_from_dsn(self) -> str:
        """Extract password from PostgreSQL DSN"""
        parts = self.postgres_dsn.split("//")[1].split("@")[0]
        return parts.split(":")[1]
    
    def run_full_sync(self):
        """Run a full sync of all tables"""
        logger.info("Starting full sync...")
        
        self.sync_accounts(incremental=False)
        self.sync_transfers(incremental=False)
        self.sync_transactions(incremental=False)
        
        logger.info("Full sync completed")
    
    def run_incremental_sync(self):
        """Run an incremental sync of all tables"""
        logger.info("Starting incremental sync...")
        
        self.sync_accounts(incremental=True)
        self.sync_transfers(incremental=True)
        self.sync_transactions(incremental=True)
        
        logger.info("Incremental sync completed")


def main():
    """Main entry point"""
    # Configuration from environment variables
    postgres_dsn = os.getenv('POSTGRES_DSN', 'postgresql://user:password@postgres:5432/payment_switch')
    delta_lake_path = os.getenv('DELTA_LAKE_PATH', 's3a://lakehouse/delta')
    s3_endpoint = os.getenv('S3_ENDPOINT', 'http://rustfs.lakehouse:9000')
    s3_access_key = os.getenv('S3_ACCESS_KEY', 'minioadmin')
    s3_secret_key = os.getenv('S3_SECRET_KEY', 'minioadmin')
    sync_mode = os.getenv('SYNC_MODE', 'incremental')  # 'full' or 'incremental'
    
    # Create and run the sync service
    sync_service = PostgresLakehouseBatchSync(
        postgres_dsn=postgres_dsn,
        delta_lake_path=delta_lake_path,
        s3_endpoint=s3_endpoint,
        s3_access_key=s3_access_key,
        s3_secret_key=s3_secret_key
    )
    
    if sync_mode == 'full':
        sync_service.run_full_sync()
    else:
        sync_service.run_incremental_sync()


if __name__ == '__main__':
    main()
