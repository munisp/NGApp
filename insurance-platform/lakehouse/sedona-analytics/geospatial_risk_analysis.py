"""
Apache Sedona Geospatial Risk Analysis

This script performs geospatial analytics for insurance risk assessment,
including flood zones, crime hotspots, and claim clustering analysis.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, expr, count, sum as spark_sum, avg, lit, when
from sedona.register import SedonaRegistrator
from sedona.core.formatMapper import GeoJsonReader
from sedona.core.spatialOperator import RangeQuery, KNNQuery, JoinQuery
from sedona.core.enums import GridType, IndexType
import os


def create_sedona_spark_session():
    """Create Spark session with Apache Sedona support"""
    
    spark = SparkSession.builder \
        .appName("Insurance Platform - Geospatial Risk Analysis") \
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer") \
        .config("spark.kryo.registrator", "org.apache.sedona.core.serde.SedonaKryoRegistrator") \
        .config("spark.sql.extensions", "org.apache.sedona.sql.SedonaSqlExtensions") \
        .config("spark.hadoop.fs.s3a.endpoint", os.getenv("S3_ENDPOINT", "http://minio:9000")) \
        .config("spark.hadoop.fs.s3a.access.key", os.getenv("S3_ACCESS_KEY", "minioadmin")) \
        .config("spark.hadoop.fs.s3a.secret.key", os.getenv("S3_SECRET_KEY", "minioadmin")) \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .getOrCreate()
    
    # Register Sedona functions
    SedonaRegistrator.registerAll(spark)
    
    spark.sparkContext.setLogLevel("WARN")
    
    return spark


def load_policy_locations(spark, data_path):
    """Load policy locations with geospatial data"""
    
    print(f"Loading policy locations from: {data_path}")
    
    # Read policy data
    policies_df = spark.read.format("delta").load(data_path)
    
    # Create geometry column from latitude and longitude
    # Assuming policies have lat/lon in metadata
    policies_with_geom = spark.sql("""
        SELECT 
            policy_id,
            customer_id,
            policy_type,
            sum_assured,
            premium_amount,
            ST_Point(CAST(longitude AS Decimal(24,20)), CAST(latitude AS Decimal(24,20))) as geometry
        FROM policies_temp
        WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    """)
    
    print(f"Loaded {policies_with_geom.count()} policies with geospatial data")
    return policies_with_geom


def load_claims_locations(spark, data_path):
    """Load claims locations with geospatial data"""
    
    print(f"Loading claims locations from: {data_path}")
    
    claims_df = spark.read.format("delta").load(data_path)
    
    # Create geometry column
    claims_with_geom = spark.sql("""
        SELECT 
            claim_id,
            policy_id,
            customer_id,
            claim_amount,
            claim_type,
            status,
            ST_Point(CAST(incident_longitude AS Decimal(24,20)), CAST(incident_latitude AS Decimal(24,20))) as geometry,
            incident_date
        FROM claims_temp
        WHERE incident_longitude IS NOT NULL AND incident_latitude IS NOT NULL
    """)
    
    print(f"Loaded {claims_with_geom.count()} claims with geospatial data")
    return claims_with_geom


def analyze_claim_clustering(spark, claims_df, distance_km=1.0, min_claims=5):
    """
    Analyze claim clustering to detect potential fraud patterns
    
    Args:
        claims_df: DataFrame with claims and geometry
        distance_km: Distance threshold in kilometers
        min_claims: Minimum number of claims to consider as a cluster
    """
    
    print(f"Analyzing claim clustering (distance: {distance_km}km, min claims: {min_claims})")
    
    # Create temporary view
    claims_df.createOrReplaceTempView("claims_geom")
    
    # Find clusters using spatial join
    # Convert km to degrees (approximate: 1 degree ≈ 111 km)
    distance_degrees = distance_km / 111.0
    
    clusters_query = f"""
        SELECT 
            c1.claim_id as claim_id_1,
            c2.claim_id as claim_id_2,
            c1.claim_amount as amount_1,
            c2.claim_amount as amount_2,
            c1.incident_date as date_1,
            c2.incident_date as date_2,
            ST_Distance(c1.geometry, c2.geometry) as distance_degrees
        FROM claims_geom c1
        JOIN claims_geom c2
        ON c1.claim_id < c2.claim_id
        WHERE ST_Distance(c1.geometry, c2.geometry) < {distance_degrees}
        AND ABS(DATEDIFF(c1.incident_date, c2.incident_date)) <= 30
    """
    
    clusters_df = spark.sql(clusters_query)
    
    # Aggregate clusters
    cluster_stats = clusters_df.groupBy("claim_id_1").agg(
        count("claim_id_2").alias("nearby_claims_count"),
        spark_sum("amount_2").alias("total_nearby_amount"),
        avg("distance_degrees").alias("avg_distance")
    ).filter(col("nearby_claims_count") >= min_claims)
    
    print(f"Found {cluster_stats.count()} potential fraud clusters")
    
    # Save results
    output_path = "s3a://lakehouse/gold/geospatial/claim_clusters"
    cluster_stats.write.format("delta").mode("overwrite").save(output_path)
    
    return cluster_stats


def create_flood_risk_zones(spark, policies_df):
    """
    Create flood risk zones based on historical claims and geographical data
    """
    
    print("Creating flood risk zones...")
    
    # Load historical flood claims
    flood_claims_query = """
        SELECT 
            geometry,
            claim_amount,
            incident_date
        FROM claims_geom
        WHERE claim_type = 'FLOOD' OR claim_type = 'WATER_DAMAGE'
    """
    
    flood_claims = spark.sql(flood_claims_query)
    
    # Create grid cells (0.01 degree ≈ 1.1 km)
    grid_query = """
        SELECT 
            ST_MakeEnvelope(
                FLOOR(ST_X(geometry) / 0.01) * 0.01,
                FLOOR(ST_Y(geometry) / 0.01) * 0.01,
                (FLOOR(ST_X(geometry) / 0.01) + 1) * 0.01,
                (FLOOR(ST_Y(geometry) / 0.01) + 1) * 0.01
            ) as grid_cell,
            COUNT(*) as flood_claim_count,
            SUM(claim_amount) as total_flood_loss
        FROM flood_claims_temp
        GROUP BY 
            FLOOR(ST_X(geometry) / 0.01),
            FLOOR(ST_Y(geometry) / 0.01)
    """
    
    flood_claims.createOrReplaceTempView("flood_claims_temp")
    flood_risk_grid = spark.sql(grid_query)
    
    # Classify risk levels
    flood_risk_zones = flood_risk_grid.withColumn(
        "risk_level",
        when(col("flood_claim_count") >= 10, "HIGH")
        .when(col("flood_claim_count") >= 5, "MEDIUM")
        .otherwise("LOW")
    )
    
    print(f"Created {flood_risk_zones.count()} flood risk zones")
    
    # Save results
    output_path = "s3a://lakehouse/gold/geospatial/flood_risk_zones"
    flood_risk_zones.write.format("delta").mode("overwrite").save(output_path)
    
    return flood_risk_zones


def calculate_policy_risk_scores(spark, policies_df, flood_zones_df, crime_zones_df=None):
    """
    Calculate risk scores for policies based on geospatial factors
    """
    
    print("Calculating policy risk scores...")
    
    policies_df.createOrReplaceTempView("policies_geom")
    flood_zones_df.createOrReplaceTempView("flood_zones")
    
    # Join policies with flood risk zones
    risk_query = """
        SELECT 
            p.policy_id,
            p.customer_id,
            p.policy_type,
            p.sum_assured,
            p.premium_amount,
            p.geometry,
            COALESCE(f.risk_level, 'LOW') as flood_risk,
            COALESCE(f.flood_claim_count, 0) as historical_flood_claims,
            COALESCE(f.total_flood_loss, 0) as historical_flood_loss
        FROM policies_geom p
        LEFT JOIN flood_zones f
        ON ST_Within(p.geometry, f.grid_cell)
    """
    
    policies_with_risk = spark.sql(risk_query)
    
    # Calculate risk score (0-100)
    policies_with_risk = policies_with_risk.withColumn(
        "geospatial_risk_score",
        when(col("flood_risk") == "HIGH", 80)
        .when(col("flood_risk") == "MEDIUM", 50)
        .otherwise(20) +
        (col("historical_flood_claims") * 2)
    )
    
    # Cap at 100
    policies_with_risk = policies_with_risk.withColumn(
        "geospatial_risk_score",
        when(col("geospatial_risk_score") > 100, 100)
        .otherwise(col("geospatial_risk_score"))
    )
    
    print(f"Calculated risk scores for {policies_with_risk.count()} policies")
    
    # Save results
    output_path = "s3a://lakehouse/gold/geospatial/policy_risk_scores"
    policies_with_risk.write.format("delta").mode("overwrite").save(output_path)
    
    return policies_with_risk


def create_agent_territory_optimization(spark, policies_df, agents_df):
    """
    Optimize agent territories using geospatial clustering
    """
    
    print("Optimizing agent territories...")
    
    # Create Voronoi diagram based on agent locations
    # This would assign each policy to the nearest agent
    
    policies_df.createOrReplaceTempView("policies_geom")
    agents_df.createOrReplaceTempView("agents_geom")
    
    # Find nearest agent for each policy
    territory_query = """
        SELECT 
            p.policy_id,
            p.customer_id,
            p.geometry as policy_location,
            a.agent_id,
            a.agent_name,
            a.geometry as agent_location,
            ST_Distance(p.geometry, a.geometry) as distance_to_agent
        FROM policies_geom p
        CROSS JOIN agents_geom a
        QUALIFY ROW_NUMBER() OVER (PARTITION BY p.policy_id ORDER BY ST_Distance(p.geometry, a.geometry)) = 1
    """
    
    optimized_territories = spark.sql(territory_query)
    
    # Calculate territory statistics
    territory_stats = optimized_territories.groupBy("agent_id", "agent_name").agg(
        count("policy_id").alias("assigned_policies"),
        avg("distance_to_agent").alias("avg_distance_to_policies")
    )
    
    print(f"Optimized territories for {territory_stats.count()} agents")
    
    # Save results
    output_path = "s3a://lakehouse/gold/geospatial/agent_territories"
    optimized_territories.write.format("delta").mode("overwrite").save(output_path)
    
    territory_stats_path = "s3a://lakehouse/gold/geospatial/agent_territory_stats"
    territory_stats.write.format("delta").mode("overwrite").save(territory_stats_path)
    
    return optimized_territories, territory_stats


def main():
    """Main function for geospatial risk analysis"""
    
    spark = create_sedona_spark_session()
    
    print("=" * 80)
    print("Insurance Platform - Geospatial Risk Analysis")
    print("=" * 80)
    
    # Load data
    policies_df = load_policy_locations(spark, "s3a://lakehouse/silver/policies")
    claims_df = load_claims_locations(spark, "s3a://lakehouse/silver/claims")
    
    # Analyze claim clustering for fraud detection
    claim_clusters = analyze_claim_clustering(spark, claims_df, distance_km=1.0, min_claims=5)
    
    # Create flood risk zones
    flood_zones = create_flood_risk_zones(spark, policies_df)
    
    # Calculate policy risk scores
    policy_risk_scores = calculate_policy_risk_scores(spark, policies_df, flood_zones)
    
    # Agent territory optimization (if agent data available)
    # agents_df = load_agent_locations(spark, "s3a://lakehouse/silver/agents")
    # territories, territory_stats = create_agent_territory_optimization(spark, policies_df, agents_df)
    
    print("=" * 80)
    print("Geospatial risk analysis completed successfully")
    print("=" * 80)
    
    spark.stop()


if __name__ == "__main__":
    main()
