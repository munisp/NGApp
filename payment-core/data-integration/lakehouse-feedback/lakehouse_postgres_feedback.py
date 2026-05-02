#!/usr/bin/env python3
"""
Lakehouse to PostgreSQL Feedback Loop
Writes analytics insights and aggregations from Lakehouse back to PostgreSQL
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List

import psycopg2
from psycopg2.extras import execute_batch
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window
from delta import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LakehousePostgresFeedback:
    """
    Feedback loop from Lakehouse to PostgreSQL
    
    This service computes analytics and insights in the Lakehouse using Spark,
    then writes the results back to PostgreSQL for operational use.
    """
    
    def __init__(
        self,
        delta_lake_path: str,
        postgres_dsn: str,
        s3_endpoint: str,
        s3_access_key: str,
        s3_secret_key: str
    ):
        self.delta_lake_path = delta_lake_path
        self.postgres_dsn = postgres_dsn
        self.s3_endpoint = s3_endpoint
        self.s3_access_key = s3_access_key
        self.s3_secret_key = s3_secret_key
        
        # Initialize Spark session
        self.spark = self._create_spark_session()
        
        # PostgreSQL connection
        self.pg_conn = None
        
    def _create_spark_session(self) -> SparkSession:
        """Create a Spark session configured for Delta Lake"""
        builder = (
            SparkSession.builder
            .appName("Lakehouse to PostgreSQL Feedback")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.hadoop.fs.s3a.endpoint", self.s3_endpoint)
            .config("spark.hadoop.fs.s3a.access.key", self.s3_access_key)
            .config("spark.hadoop.fs.s3a.secret.key", self.s3_secret_key)
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
        )
        
        return configure_spark_with_delta_pip(builder).getOrCreate()
    
    def connect_to_postgres(self):
        """Establish connection to PostgreSQL"""
        try:
            self.pg_conn = psycopg2.connect(self.postgres_dsn)
            logger.info("Connected to PostgreSQL")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise
    
    def compute_account_risk_scores(self):
        """Compute risk scores for accounts based on transaction patterns"""
        logger.info("Computing account risk scores...")
        
        # Read transactions from Delta Lake
        transactions_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/transactions")
        
        # Read fraud scores
        fraud_scores_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/fraud_scores")
        
        # Join transactions with fraud scores
        enriched_df = transactions_df.join(
            fraud_scores_df,
            transactions_df.transaction_id == fraud_scores_df.transaction_id,
            "left"
        )
        
        # Compute risk scores per account
        risk_scores = enriched_df.groupBy("account_id").agg(
            avg("fraud_score").alias("avg_fraud_score"),
            max("fraud_score").alias("max_fraud_score"),
            count("*").alias("transaction_count"),
            sum(when(col("fraud_score") > 0.8, 1).otherwise(0)).alias("high_risk_count")
        )
        
        # Calculate overall risk score
        risk_scores = risk_scores.withColumn(
            "risk_score",
            (col("avg_fraud_score") * 0.5 + col("max_fraud_score") * 0.3 + 
             (col("high_risk_count") / col("transaction_count")) * 0.2)
        )
        
        # Write to PostgreSQL
        self._write_to_postgres(risk_scores, "account_risk_scores")
        
        logger.info("Account risk scores computed and written to PostgreSQL")
    
    def compute_merchant_analytics(self):
        """Compute merchant analytics and performance metrics"""
        logger.info("Computing merchant analytics...")
        
        # Read transactions from Delta Lake
        transactions_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/transactions")
        
        # Compute merchant metrics
        merchant_analytics = transactions_df.groupBy("merchant_id").agg(
            count("*").alias("total_transactions"),
            sum("amount").alias("total_volume"),
            avg("amount").alias("avg_transaction_amount"),
            countDistinct("account_id").alias("unique_customers"),
            sum(when(col("status") == "success", 1).otherwise(0)).alias("successful_transactions"),
            sum(when(col("status") == "failed", 1).otherwise(0)).alias("failed_transactions")
        )
        
        # Calculate success rate
        merchant_analytics = merchant_analytics.withColumn(
            "success_rate",
            col("successful_transactions") / col("total_transactions")
        )
        
        # Write to PostgreSQL
        self._write_to_postgres(merchant_analytics, "merchant_analytics")
        
        logger.info("Merchant analytics computed and written to PostgreSQL")
    
    def compute_velocity_patterns(self):
        """Compute velocity patterns for fraud detection"""
        logger.info("Computing velocity patterns...")
        
        # Read transactions from Delta Lake
        transactions_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/transactions")
        
        # Define time windows
        window_spec_1h = Window.partitionBy("account_id").orderBy(col("created_at").cast("long")).rangeBetween(-3600, 0)
        window_spec_24h = Window.partitionBy("account_id").orderBy(col("created_at").cast("long")).rangeBetween(-86400, 0)
        
        # Compute velocity metrics
        velocity_df = transactions_df.withColumn(
            "txn_count_1h", count("*").over(window_spec_1h)
        ).withColumn(
            "txn_amount_1h", sum("amount").over(window_spec_1h)
        ).withColumn(
            "txn_count_24h", count("*").over(window_spec_24h)
        ).withColumn(
            "txn_amount_24h", sum("amount").over(window_spec_24h)
        )
        
        # Select latest velocity metrics per account
        latest_velocity = velocity_df.groupBy("account_id").agg(
            max("txn_count_1h").alias("txn_count_1h"),
            max("txn_amount_1h").alias("txn_amount_1h"),
            max("txn_count_24h").alias("txn_count_24h"),
            max("txn_amount_24h").alias("txn_amount_24h"),
            max("created_at").alias("updated_at")
        )
        
        # Write to PostgreSQL
        self._write_to_postgres(latest_velocity, "velocity_patterns")
        
        logger.info("Velocity patterns computed and written to PostgreSQL")
    
    def compute_fraud_model_performance(self):
        """Compute fraud model performance metrics"""
        logger.info("Computing fraud model performance...")
        
        # Read fraud scores and labels
        fraud_scores_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/fraud_scores")
        fraud_labels_df = self.spark.read.format("delta").load(f"{self.delta_lake_path}/fraud_labels")
        
        # Join scores with labels
        evaluation_df = fraud_scores_df.join(
            fraud_labels_df,
            fraud_scores_df.transaction_id == fraud_labels_df.transaction_id,
            "inner"
        )
        
        # Compute confusion matrix
        evaluation_df = evaluation_df.withColumn(
            "predicted_fraud",
            when(col("fraud_score") > 0.5, 1).otherwise(0)
        )
        
        confusion_matrix = evaluation_df.groupBy("model_version").agg(
            sum(when((col("predicted_fraud") == 1) & (col("is_fraud") == 1), 1).otherwise(0)).alias("true_positives"),
            sum(when((col("predicted_fraud") == 1) & (col("is_fraud") == 0), 1).otherwise(0)).alias("false_positives"),
            sum(when((col("predicted_fraud") == 0) & (col("is_fraud") == 1), 1).otherwise(0)).alias("false_negatives"),
            sum(when((col("predicted_fraud") == 0) & (col("is_fraud") == 0), 1).otherwise(0)).alias("true_negatives")
        )
        
        # Calculate metrics
        performance_metrics = confusion_matrix.withColumn(
            "precision",
            col("true_positives") / (col("true_positives") + col("false_positives"))
        ).withColumn(
            "recall",
            col("true_positives") / (col("true_positives") + col("false_negatives"))
        ).withColumn(
            "f1_score",
            2 * col("precision") * col("recall") / (col("precision") + col("recall"))
        ).withColumn(
            "accuracy",
            (col("true_positives") + col("true_negatives")) / 
            (col("true_positives") + col("false_positives") + col("false_negatives") + col("true_negatives"))
        )
        
        # Write to PostgreSQL
        self._write_to_postgres(performance_metrics, "fraud_model_performance")
        
        logger.info("Fraud model performance computed and written to PostgreSQL")
    
    def _write_to_postgres(self, df, table_name: str):
        """Write DataFrame to PostgreSQL"""
        try:
            # Convert to Pandas for easier insertion
            pandas_df = df.toPandas()
            
            if pandas_df.empty:
                logger.warning(f"No data to write to {table_name}")
                return
            
            # Create cursor
            cursor = self.pg_conn.cursor()
            
            # Create table if it doesn't exist
            self._create_table_if_not_exists(cursor, table_name, pandas_df)
            
            # Prepare insert statement
            columns = list(pandas_df.columns)
            placeholders = ', '.join(['%s'] * len(columns))
            insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
            
            # Insert data
            data = [tuple(row) for row in pandas_df.values]
            execute_batch(cursor, insert_sql, data)
            
            self.pg_conn.commit()
            cursor.close()
            
            logger.info(f"Wrote {len(pandas_df)} rows to {table_name}")
            
        except Exception as e:
            logger.error(f"Failed to write to PostgreSQL table {table_name}: {e}")
            self.pg_conn.rollback()
            raise
    
    def _create_table_if_not_exists(self, cursor, table_name: str, pandas_df):
        """Create table in PostgreSQL if it doesn't exist"""
        # Map pandas dtypes to PostgreSQL types
        type_mapping = {
            'int64': 'BIGINT',
            'float64': 'DOUBLE PRECISION',
            'object': 'TEXT',
            'datetime64[ns]': 'TIMESTAMP',
            'bool': 'BOOLEAN'
        }
        
        columns = []
        for col, dtype in pandas_df.dtypes.items():
            pg_type = type_mapping.get(str(dtype), 'TEXT')
            columns.append(f"{col} {pg_type}")
        
        create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)})"
        
        try:
            cursor.execute(create_sql)
            self.pg_conn.commit()
        except Exception as e:
            logger.warning(f"Table {table_name} may already exist: {e}")
            self.pg_conn.rollback()
    
    def run(self):
        """Run all feedback computations"""
        logger.info("Starting Lakehouse to PostgreSQL Feedback Loop...")
        
        # Connect to PostgreSQL
        self.connect_to_postgres()
        
        try:
            # Compute and write analytics
            self.compute_account_risk_scores()
            self.compute_merchant_analytics()
            self.compute_velocity_patterns()
            self.compute_fraud_model_performance()
            
            logger.info("Feedback loop completed successfully")
            
        except Exception as e:
            logger.error(f"Feedback loop error: {e}", exc_info=True)
            raise
        finally:
            if self.pg_conn:
                self.pg_conn.close()
            
            if self.spark:
                self.spark.stop()


def main():
    """Main entry point"""
    # Configuration from environment variables
    delta_lake_path = os.getenv('DELTA_LAKE_PATH', 's3a://lakehouse/delta')
    postgres_dsn = os.getenv('POSTGRES_DSN', 'postgresql://user:password@postgres:5432/payment_switch')
    s3_endpoint = os.getenv('S3_ENDPOINT', 'http://minio:9000')
    s3_access_key = os.getenv('S3_ACCESS_KEY', 'minioadmin')
    s3_secret_key = os.getenv('S3_SECRET_KEY', 'minioadmin')
    
    # Create and run the feedback service
    feedback_service = LakehousePostgresFeedback(
        delta_lake_path=delta_lake_path,
        postgres_dsn=postgres_dsn,
        s3_endpoint=s3_endpoint,
        s3_access_key=s3_access_key,
        s3_secret_key=s3_secret_key
    )
    
    feedback_service.run()


if __name__ == '__main__':
    main()
