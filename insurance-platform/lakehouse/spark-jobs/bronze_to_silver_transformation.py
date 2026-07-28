"""
Apache Spark Job for Bronze to Silver Layer Transformation

This job reads raw data from Bronze layer (Delta Lake), performs data quality checks,
transformations, and writes cleaned data to Silver layer.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, from_json, to_timestamp, current_timestamp, 
    year, month, dayofmonth, hour, lit, when, regexp_replace,
    trim, lower, upper, coalesce
)
from pyspark.sql.types import (
    StructType, StructField, StringType, LongType, 
    TimestampType, DoubleType, BooleanType
)
from delta import DeltaTable
import os


def create_spark_session():
    """Create Spark session with Delta Lake and S3 support"""
    
    spark = SparkSession.builder \
        .appName("Insurance Platform - Bronze to Silver") \
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
        .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog") \
        .config("spark.hadoop.fs.s3a.endpoint", os.getenv("S3_ENDPOINT", "http://minio:9000")) \
        .config("spark.hadoop.fs.s3a.access.key", os.getenv("S3_ACCESS_KEY", "minioadmin")) \
        .config("spark.hadoop.fs.s3a.secret.key", os.getenv("S3_SECRET_KEY", "minioadmin")) \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem") \
        .config("spark.sql.adaptive.enabled", "true") \
        .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
        .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    
    return spark


def define_payment_schema():
    """Define schema for payment events"""
    return StructType([
        StructField("event_id", StringType(), False),
        StructField("event_type", StringType(), False),
        StructField("payment_id", StringType(), False),
        StructField("transaction_id", StringType(), False),
        StructField("policy_id", StringType(), False),
        StructField("customer_id", StringType(), False),
        StructField("amount", LongType(), False),
        StructField("currency", StringType(), False),
        StructField("payment_type", StringType(), False),
        StructField("status", StringType(), False),
        StructField("timestamp", TimestampType(), False)
    ])


def define_policy_schema():
    """Define schema for policy events"""
    return StructType([
        StructField("event_id", StringType(), False),
        StructField("event_type", StringType(), False),
        StructField("policy_id", StringType(), False),
        StructField("policy_number", StringType(), False),
        StructField("customer_id", StringType(), False),
        StructField("policy_type", StringType(), False),
        StructField("status", StringType(), False),
        StructField("timestamp", TimestampType(), False)
    ])


def transform_payment_events(spark, bronze_path, silver_path):
    """Transform payment events from Bronze to Silver layer"""
    
    print(f"Reading payment events from Bronze: {bronze_path}")
    
    # Read from Bronze layer
    bronze_df = spark.read.format("delta").load(bronze_path)
    
    # Parse JSON payload
    payment_schema = define_payment_schema()
    parsed_df = bronze_df.withColumn(
        "parsed_payload",
        from_json(col("payload"), payment_schema)
    )
    
    # Extract fields and apply transformations
    silver_df = parsed_df.select(
        col("parsed_payload.event_id").alias("event_id"),
        col("parsed_payload.event_type").alias("event_type"),
        col("parsed_payload.payment_id").alias("payment_id"),
        col("parsed_payload.transaction_id").alias("transaction_id"),
        col("parsed_payload.policy_id").alias("policy_id"),
        col("parsed_payload.customer_id").alias("customer_id"),
        col("parsed_payload.amount").alias("amount"),
        upper(trim(col("parsed_payload.currency"))).alias("currency"),
        upper(trim(col("parsed_payload.payment_type"))).alias("payment_type"),
        upper(trim(col("parsed_payload.status"))).alias("status"),
        col("parsed_payload.timestamp").alias("event_timestamp"),
        col("ingestion_timestamp")
    )
    
    # Data quality checks and filters
    silver_df = silver_df.filter(
        (col("payment_id").isNotNull()) &
        (col("amount") > 0) &
        (col("currency").isin(["NGN", "USD", "EUR"])) &
        (col("status").isin(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED"]))
    )
    
    # Add derived columns
    silver_df = silver_df.withColumn("year", year(col("event_timestamp"))) \
        .withColumn("month", month(col("event_timestamp"))) \
        .withColumn("day", dayofmonth(col("event_timestamp"))) \
        .withColumn("hour", hour(col("event_timestamp"))) \
        .withColumn("processed_timestamp", current_timestamp())
    
    # Write to Silver layer with partitioning
    print(f"Writing transformed payment events to Silver: {silver_path}")
    
    silver_df.write \
        .format("delta") \
        .mode("append") \
        .partitionBy("year", "month", "day") \
        .option("mergeSchema", "true") \
        .save(silver_path)
    
    print(f"Transformed {silver_df.count()} payment events to Silver layer")


def transform_policy_events(spark, bronze_path, silver_path):
    """Transform policy events from Bronze to Silver layer"""
    
    print(f"Reading policy events from Bronze: {bronze_path}")
    
    # Read from Bronze layer
    bronze_df = spark.read.format("delta").load(bronze_path)
    
    # Parse JSON payload
    policy_schema = define_policy_schema()
    parsed_df = bronze_df.withColumn(
        "parsed_payload",
        from_json(col("payload"), policy_schema)
    )
    
    # Extract fields and apply transformations
    silver_df = parsed_df.select(
        col("parsed_payload.event_id").alias("event_id"),
        col("parsed_payload.event_type").alias("event_type"),
        col("parsed_payload.policy_id").alias("policy_id"),
        col("parsed_payload.policy_number").alias("policy_number"),
        col("parsed_payload.customer_id").alias("customer_id"),
        upper(trim(col("parsed_payload.policy_type"))).alias("policy_type"),
        upper(trim(col("parsed_payload.status"))).alias("status"),
        col("parsed_payload.timestamp").alias("event_timestamp"),
        col("ingestion_timestamp")
    )
    
    # Data quality checks
    silver_df = silver_df.filter(
        (col("policy_id").isNotNull()) &
        (col("policy_number").isNotNull()) &
        (col("policy_type").isin(["MOTOR", "HEALTH", "LIFE", "PROPERTY", "MARINE", "TRAVEL", "MICRO"])) &
        (col("status").isin(["DRAFT", "PENDING", "ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]))
    )
    
    # Add derived columns
    silver_df = silver_df.withColumn("year", year(col("event_timestamp"))) \
        .withColumn("month", month(col("event_timestamp"))) \
        .withColumn("day", dayofmonth(col("event_timestamp"))) \
        .withColumn("processed_timestamp", current_timestamp())
    
    # Write to Silver layer
    print(f"Writing transformed policy events to Silver: {silver_path}")
    
    silver_df.write \
        .format("delta") \
        .mode("append") \
        .partitionBy("year", "month", "day") \
        .option("mergeSchema", "true") \
        .save(silver_path)
    
    print(f"Transformed {silver_df.count()} policy events to Silver layer")


def create_customer_360_view(spark, silver_base_path, gold_path):
    """Create Customer 360 view in Gold layer by joining multiple Silver tables"""
    
    print("Creating Customer 360 view...")
    
    # Read Silver layer tables
    policies_df = spark.read.format("delta").load(f"{silver_base_path}/policy_events")
    payments_df = spark.read.format("delta").load(f"{silver_base_path}/payment_events")
    
    # Aggregate policy data per customer
    customer_policies = policies_df.groupBy("customer_id").agg(
        count("policy_id").alias("total_policies"),
        countDistinct(when(col("status") == "ACTIVE", col("policy_id"))).alias("active_policies"),
        countDistinct(when(col("status") == "CANCELLED", col("policy_id"))).alias("cancelled_policies")
    )
    
    # Aggregate payment data per customer
    customer_payments = payments_df.groupBy("customer_id").agg(
        count("payment_id").alias("total_payments"),
        sum(when(col("status") == "COMPLETED", col("amount"))).alias("total_premium_paid"),
        countDistinct(when(col("status") == "FAILED", col("payment_id"))).alias("failed_payments")
    )
    
    # Join to create 360 view
    customer_360 = customer_policies.join(
        customer_payments,
        "customer_id",
        "full_outer"
    ).withColumn("last_updated", current_timestamp())
    
    # Write to Gold layer
    print(f"Writing Customer 360 view to Gold: {gold_path}")
    
    customer_360.write \
        .format("delta") \
        .mode("overwrite") \
        .option("overwriteSchema", "true") \
        .save(gold_path)
    
    print(f"Created Customer 360 view with {customer_360.count()} customers")


def optimize_delta_tables(spark, paths):
    """Optimize Delta tables with OPTIMIZE and VACUUM"""
    
    for path in paths:
        print(f"Optimizing Delta table: {path}")
        
        # Run OPTIMIZE
        spark.sql(f"OPTIMIZE delta.`{path}`")
        
        # Run VACUUM (remove old files older than 7 days)
        spark.sql(f"VACUUM delta.`{path}` RETAIN 168 HOURS")
        
        print(f"Optimized: {path}")


def main():
    """Main function to run Bronze to Silver transformation"""
    
    spark = create_spark_session()
    
    print("=" * 80)
    print("Insurance Platform - Bronze to Silver Transformation")
    print("=" * 80)
    
    # Define paths
    bronze_base = "s3a://lakehouse/bronze"
    silver_base = "s3a://lakehouse/silver"
    gold_base = "s3a://lakehouse/gold"
    
    # Transform payment events
    transform_payment_events(
        spark,
        f"{bronze_base}/payment_events",
        f"{silver_base}/payment_events"
    )
    
    # Transform policy events
    transform_policy_events(
        spark,
        f"{bronze_base}/policy_events",
        f"{silver_base}/policy_events"
    )
    
    # Create Customer 360 view in Gold layer
    create_customer_360_view(
        spark,
        silver_base,
        f"{gold_base}/customer_360"
    )
    
    # Optimize Delta tables
    optimize_delta_tables(spark, [
        f"{silver_base}/payment_events",
        f"{silver_base}/policy_events",
        f"{gold_base}/customer_360"
    ])
    
    print("=" * 80)
    print("Bronze to Silver transformation completed successfully")
    print("=" * 80)
    
    spark.stop()


if __name__ == "__main__":
    main()
