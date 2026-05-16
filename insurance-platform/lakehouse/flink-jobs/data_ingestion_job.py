"""
Apache Flink Data Ingestion Job for Insurance Platform Lakehouse

This job ingests data from multiple sources (Kafka, PostgreSQL, TigerBeetle)
and writes to Delta Lake in Bronze layer (raw data).
"""

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment, EnvironmentSettings
from pyflink.table.descriptors import Schema, Kafka, Json, FileSystem
from pyflink.table.window import Tumble
import os


def create_kafka_source_table(table_env, topic_name, table_name):
    """Create Kafka source table for streaming data ingestion"""
    
    kafka_brokers = os.getenv("KAFKA_BROKERS", "kafka-0:9092,kafka-1:9092,kafka-2:9092")
    
    ddl = f"""
        CREATE TABLE {table_name} (
            event_id STRING,
            event_type STRING,
            event_timestamp TIMESTAMP(3),
            payload STRING,
            WATERMARK FOR event_timestamp AS event_timestamp - INTERVAL '5' SECOND
        ) WITH (
            'connector' = 'kafka',
            'topic' = '{topic_name}',
            'properties.bootstrap.servers' = '{kafka_brokers}',
            'properties.group.id' = 'flink-lakehouse-ingestion',
            'scan.startup.mode' = 'earliest-offset',
            'format' = 'json',
            'json.fail-on-missing-field' = 'false',
            'json.ignore-parse-errors' = 'true'
        )
    """
    
    table_env.execute_sql(ddl)
    print(f"Created Kafka source table: {table_name} for topic: {topic_name}")


def create_postgres_source_table(table_env, table_name, source_table):
    """Create PostgreSQL source table for CDC (Change Data Capture)"""
    
    postgres_host = os.getenv("POSTGRES_HOST", "postgres")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB", "insurance")
    postgres_user = os.getenv("POSTGRES_USER", "postgres")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    
    ddl = f"""
        CREATE TABLE {table_name} (
            id STRING,
            data STRING,
            created_at TIMESTAMP(3),
            updated_at TIMESTAMP(3),
            PRIMARY KEY (id) NOT ENFORCED
        ) WITH (
            'connector' = 'jdbc',
            'url' = 'jdbc:postgresql://{postgres_host}:{postgres_port}/{postgres_db}',
            'table-name' = '{source_table}',
            'username' = '{postgres_user}',
            'password' = '{postgres_password}',
            'scan.partition.column' = 'id',
            'scan.partition.num' = '4',
            'scan.partition.lower-bound' = '0',
            'scan.partition.upper-bound' = '1000000'
        )
    """
    
    table_env.execute_sql(ddl)
    print(f"Created PostgreSQL source table: {table_name} from {source_table}")


def create_delta_lake_sink(table_env, table_name, path):
    """Create Delta Lake sink table for Bronze layer"""
    
    s3_endpoint = os.getenv("S3_ENDPOINT", "http://minio:9000")
    s3_access_key = os.getenv("S3_ACCESS_KEY", "minioadmin")
    s3_secret_key = os.getenv("S3_SECRET_KEY", "minioadmin")
    
    ddl = f"""
        CREATE TABLE {table_name} (
            event_id STRING,
            event_type STRING,
            event_timestamp TIMESTAMP(3),
            payload STRING,
            ingestion_timestamp TIMESTAMP(3),
            partition_date STRING
        ) PARTITIONED BY (partition_date) 
        WITH (
            'connector' = 'delta',
            'path' = '{path}',
            's3.endpoint' = '{s3_endpoint}',
            's3.access-key' = '{s3_access_key}',
            's3.secret-key' = '{s3_secret_key}',
            's3.path-style-access' = 'true'
        )
    """
    
    table_env.execute_sql(ddl)
    print(f"Created Delta Lake sink table: {table_name} at path: {path}")


def ingest_payment_events(table_env):
    """Ingest payment events from Kafka to Delta Lake Bronze layer"""
    
    # Create source table
    create_kafka_source_table(table_env, "payment-events", "payment_events_source")
    
    # Create sink table
    create_delta_lake_sink(
        table_env, 
        "payment_events_bronze",
        "s3a://lakehouse/bronze/payment_events"
    )
    
    # Insert data with partitioning
    insert_sql = """
        INSERT INTO payment_events_bronze
        SELECT 
            event_id,
            event_type,
            event_timestamp,
            payload,
            CURRENT_TIMESTAMP as ingestion_timestamp,
            DATE_FORMAT(event_timestamp, 'yyyy-MM-dd') as partition_date
        FROM payment_events_source
    """
    
    table_env.execute_sql(insert_sql)
    print("Payment events ingestion job started")


def ingest_policy_events(table_env):
    """Ingest policy events from Kafka to Delta Lake Bronze layer"""
    
    # Create source table
    create_kafka_source_table(table_env, "policy-events", "policy_events_source")
    
    # Create sink table
    create_delta_lake_sink(
        table_env,
        "policy_events_bronze",
        "s3a://lakehouse/bronze/policy_events"
    )
    
    # Insert data with partitioning
    insert_sql = """
        INSERT INTO policy_events_bronze
        SELECT 
            event_id,
            event_type,
            event_timestamp,
            payload,
            CURRENT_TIMESTAMP as ingestion_timestamp,
            DATE_FORMAT(event_timestamp, 'yyyy-MM-dd') as partition_date
        FROM policy_events_source
    """
    
    table_env.execute_sql(insert_sql)
    print("Policy events ingestion job started")


def ingest_verification_events(table_env):
    """Ingest verification events from Kafka to Delta Lake Bronze layer"""
    
    # Create source table
    create_kafka_source_table(table_env, "verification-events", "verification_events_source")
    
    # Create sink table
    create_delta_lake_sink(
        table_env,
        "verification_events_bronze",
        "s3a://lakehouse/bronze/verification_events"
    )
    
    # Insert data with partitioning
    insert_sql = """
        INSERT INTO verification_events_bronze
        SELECT 
            event_id,
            event_type,
            event_timestamp,
            payload,
            CURRENT_TIMESTAMP as ingestion_timestamp,
            DATE_FORMAT(event_timestamp, 'yyyy-MM-dd') as partition_date
        FROM verification_events_source
    """
    
    table_env.execute_sql(insert_sql)
    print("Verification events ingestion job started")


def ingest_postgres_snapshots(table_env):
    """Ingest PostgreSQL table snapshots to Delta Lake Bronze layer"""
    
    tables = [
        ("policies", "policies_snapshot_bronze"),
        ("payments", "payments_snapshot_bronze"),
        ("claims", "claims_snapshot_bronze"),
        ("customers", "customers_snapshot_bronze")
    ]
    
    for source_table, sink_table in tables:
        # Create source table
        create_postgres_source_table(table_env, f"{source_table}_source", source_table)
        
        # Create sink table
        create_delta_lake_sink(
            table_env,
            sink_table,
            f"s3a://lakehouse/bronze/{source_table}_snapshots"
        )
        
        # Insert data
        insert_sql = f"""
            INSERT INTO {sink_table}
            SELECT 
                id,
                data,
                created_at,
                updated_at,
                CURRENT_TIMESTAMP as ingestion_timestamp,
                DATE_FORMAT(updated_at, 'yyyy-MM-dd') as partition_date
            FROM {source_table}_source
        """
        
        table_env.execute_sql(insert_sql)
        print(f"PostgreSQL snapshot ingestion started for {source_table}")


def main():
    """Main function to run all data ingestion jobs"""
    
    # Create execution environment
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(4)
    
    # Enable checkpointing for fault tolerance
    env.enable_checkpointing(60000)  # Checkpoint every 60 seconds
    
    # Create table environment
    settings = EnvironmentSettings.new_instance() \
        .in_streaming_mode() \
        .build()
    table_env = StreamTableEnvironment.create(env, settings)
    
    # Configure table environment
    table_env.get_config().set("pipeline.name", "Insurance Platform Data Ingestion")
    table_env.get_config().set("execution.checkpointing.mode", "EXACTLY_ONCE")
    table_env.get_config().set("execution.checkpointing.interval", "60s")
    
    # Add required JARs
    jars = [
        "/opt/flink/lib/flink-connector-kafka.jar",
        "/opt/flink/lib/flink-connector-jdbc.jar",
        "/opt/flink/lib/delta-core.jar",
        "/opt/flink/lib/delta-storage.jar",
        "/opt/flink/lib/postgresql-jdbc.jar"
    ]
    
    for jar in jars:
        if os.path.exists(jar):
            table_env.get_config().set("pipeline.jars", jar)
    
    print("Starting Insurance Platform Data Ingestion Jobs...")
    
    # Start ingestion jobs
    ingest_payment_events(table_env)
    ingest_policy_events(table_env)
    ingest_verification_events(table_env)
    ingest_postgres_snapshots(table_env)
    
    print("All ingestion jobs started successfully")
    print("Flink job is running. Press Ctrl+C to stop.")
    
    # Execute the job
    env.execute("Insurance Platform Data Ingestion")


if __name__ == "__main__":
    main()
