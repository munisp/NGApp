"""
Spark Batch Job for Transaction Analytics with Geospatial Processing

This job performs batch analytics on transaction data stored in Delta Lake,
including geospatial analytics using Apache Sedona.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.window import Window
from delta.tables import DeltaTable
from sedona.register import SedonaRegistrator
from sedona.core.SpatialRDD import PointRDD
from sedona.core.enums import GridType, IndexType
from sedona.sql.types import GeometryType
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TransactionAnalytics:
    """
    Main class for transaction analytics batch processing
    """
    
    def __init__(self):
        """Initialize Spark session with Delta Lake and Sedona"""
        self.spark = (SparkSession.builder
            .appName("Transaction Analytics")
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension,org.apache.sedona.sql.SedonaSqlExtensions")
            .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
            .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
            .config("spark.kryo.registrator", "org.apache.sedona.core.serde.SedonaKryoRegistrator")
            .config("spark.hadoop.fs.s3a.endpoint", "http://rustfs.lakehouse:9000")
            .config("spark.hadoop.fs.s3a.access.key", "${AWS_ACCESS_KEY_ID}")
            .config("spark.hadoop.fs.s3a.secret.key", "${AWS_SECRET_ACCESS_KEY}")
            .config("spark.hadoop.fs.s3a.path.style.access", "true")
            .config("spark.hadoop.fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem")
            .getOrCreate())
        
        # Register Sedona functions
        SedonaRegistrator.registerAll(self.spark)
        
        logger.info("Spark session initialized with Delta Lake and Sedona")
    
    def load_transactions(self, path="s3a://delta-lake/transactions"):
        """Load transaction data from Delta Lake"""
        logger.info(f"Loading transactions from {path}")
        return self.spark.read.format("delta").load(path)
    
    def calculate_daily_metrics(self, transactions_df):
        """Calculate daily transaction metrics"""
        logger.info("Calculating daily metrics")
        
        daily_metrics = (transactions_df
            .withColumn("date", to_date(col("timestamp")))
            .groupBy("date", "currency", "country")
            .agg(
                count("transaction_id").alias("transaction_count"),
                sum("amount").alias("total_amount"),
                avg("amount").alias("avg_amount"),
                min("amount").alias("min_amount"),
                max("amount").alias("max_amount"),
                stddev("amount").alias("stddev_amount"),
                sum(when(col("is_anomaly"), 1).otherwise(0)).alias("anomaly_count"),
                avg("fraud_score").alias("avg_fraud_score")
            )
            .orderBy("date", "currency", "country"))
        
        return daily_metrics
    
    def calculate_merchant_analytics(self, transactions_df):
        """Calculate merchant-level analytics"""
        logger.info("Calculating merchant analytics")
        
        merchant_analytics = (transactions_df
            .groupBy("merchant_category", "country")
            .agg(
                count("transaction_id").alias("transaction_count"),
                countDistinct("payer_id").alias("unique_payers"),
                countDistinct("payee_id").alias("unique_payees"),
                sum("amount").alias("total_amount"),
                avg("amount").alias("avg_amount"),
                sum(when(col("is_anomaly"), 1).otherwise(0)).alias("anomaly_count"),
                (sum(when(col("is_anomaly"), 1).otherwise(0)) / count("transaction_id") * 100).alias("anomaly_rate")
            )
            .orderBy(desc("transaction_count")))
        
        return merchant_analytics
    
    def detect_velocity_patterns(self, transactions_df):
        """Detect transaction velocity patterns for fraud detection"""
        logger.info("Detecting velocity patterns")
        
        # Define time windows
        window_1h = Window.partitionBy("payer_id").orderBy(col("timestamp").cast("long")).rangeBetween(-3600, 0)
        window_24h = Window.partitionBy("payer_id").orderBy(col("timestamp").cast("long")).rangeBetween(-86400, 0)
        
        velocity_patterns = (transactions_df
            .withColumn("tx_count_1h", count("transaction_id").over(window_1h))
            .withColumn("tx_count_24h", count("transaction_id").over(window_24h))
            .withColumn("amount_sum_1h", sum("amount").over(window_1h))
            .withColumn("amount_sum_24h", sum("amount").over(window_24h))
            .withColumn("high_velocity", 
                when((col("tx_count_1h") > 10) | (col("tx_count_24h") > 100), True).otherwise(False))
            .withColumn("high_amount_velocity",
                when((col("amount_sum_1h") > 50000) | (col("amount_sum_24h") > 500000), True).otherwise(False)))
        
        # Filter high-risk transactions
        high_risk = velocity_patterns.filter(
            (col("high_velocity") == True) | 
            (col("high_amount_velocity") == True) |
            (col("is_anomaly") == True)
        )
        
        return high_risk
    
    def perform_geospatial_analysis(self, transactions_df):
        """Perform geospatial analysis using Apache Sedona"""
        logger.info("Performing geospatial analysis")
        
        # Mock: Add latitude and longitude based on country (in production, this would come from actual data)
        country_coords = {
            "US": (37.0902, -95.7129),
            "UK": (55.3781, -3.4360),
            "CA": (56.1304, -106.3468),
            "AU": (-25.2744, 133.7751),
            "DE": (51.1657, 10.4515)
        }
        
        # Create a mapping expression
        mapping_expr = create_map([lit(x) for x in sum([[k, v] for k, v in country_coords.items()], [])])
        
        transactions_with_coords = (transactions_df
            .withColumn("coords", mapping_expr[col("country")])
            .withColumn("latitude", col("coords._1"))
            .withColumn("longitude", col("coords._2"))
            .filter(col("latitude").isNotNull()))
        
        # Create geometry column using Sedona
        transactions_with_coords.createOrReplaceTempView("transactions_temp")
        
        geospatial_df = self.spark.sql("""
            SELECT 
                *,
                ST_Point(CAST(longitude AS Decimal(24,20)), CAST(latitude AS Decimal(24,20))) as geometry
            FROM transactions_temp
        """)
        
        # Spatial clustering analysis
        geospatial_df.createOrReplaceTempView("transactions_geo")
        
        # Find transaction hotspots (areas with high transaction density)
        hotspots = self.spark.sql("""
            SELECT 
                country,
                merchant_category,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount,
                AVG(fraud_score) as avg_fraud_score,
                ST_AsText(ST_Centroid(ST_Union_Aggr(geometry))) as centroid
            FROM transactions_geo
            GROUP BY country, merchant_category
            HAVING COUNT(*) > 100
            ORDER BY transaction_count DESC
        """)
        
        return hotspots
    
    def build_fraud_features(self, transactions_df):
        """Build features for fraud detection models"""
        logger.info("Building fraud detection features")
        
        # Time-based features
        transactions_with_features = (transactions_df
            .withColumn("hour_of_day", hour(col("timestamp")))
            .withColumn("day_of_week", dayofweek(col("timestamp")))
            .withColumn("is_weekend", when(col("day_of_week").isin([1, 7]), 1).otherwise(0))
            .withColumn("is_night", when((col("hour_of_day") >= 22) | (col("hour_of_day") <= 6), 1).otherwise(0)))
        
        # Payer-level features
        payer_window = Window.partitionBy("payer_id").orderBy(col("timestamp"))
        
        payer_features = (transactions_with_features
            .withColumn("payer_tx_count", count("transaction_id").over(payer_window))
            .withColumn("payer_avg_amount", avg("amount").over(payer_window))
            .withColumn("payer_stddev_amount", stddev("amount").over(payer_window))
            .withColumn("amount_deviation", 
                abs(col("amount") - col("payer_avg_amount")) / (col("payer_stddev_amount") + 1)))
        
        # Merchant-level features
        merchant_window = Window.partitionBy("merchant_category")
        
        merchant_features = (payer_features
            .withColumn("merchant_tx_count", count("transaction_id").over(merchant_window))
            .withColumn("merchant_avg_amount", avg("amount").over(merchant_window))
            .withColumn("merchant_anomaly_rate", 
                sum(when(col("is_anomaly"), 1).otherwise(0)).over(merchant_window) / 
                count("transaction_id").over(merchant_window)))
        
        return merchant_features
    
    def save_to_delta(self, df, path, mode="overwrite"):
        """Save DataFrame to Delta Lake"""
        logger.info(f"Saving data to {path}")
        (df.write
            .format("delta")
            .mode(mode)
            .option("mergeSchema", "true")
            .save(path))
        
        logger.info(f"Data saved successfully to {path}")
    
    def run_analytics_pipeline(self):
        """Run the complete analytics pipeline"""
        logger.info("Starting analytics pipeline")
        
        try:
            # Load transactions
            transactions_df = self.load_transactions()
            
            # Calculate daily metrics
            daily_metrics = self.calculate_daily_metrics(transactions_df)
            self.save_to_delta(daily_metrics, "s3a://delta-lake/analytics/daily_metrics")
            
            # Calculate merchant analytics
            merchant_analytics = self.calculate_merchant_analytics(transactions_df)
            self.save_to_delta(merchant_analytics, "s3a://delta-lake/analytics/merchant_analytics")
            
            # Detect velocity patterns
            high_risk_transactions = self.detect_velocity_patterns(transactions_df)
            self.save_to_delta(high_risk_transactions, "s3a://delta-lake/analytics/high_risk_transactions")
            
            # Perform geospatial analysis
            hotspots = self.perform_geospatial_analysis(transactions_df)
            self.save_to_delta(hotspots, "s3a://delta-lake/analytics/transaction_hotspots")
            
            # Build fraud features
            fraud_features = self.build_fraud_features(transactions_df)
            self.save_to_delta(fraud_features, "s3a://delta-lake/ml/fraud_features")
            
            logger.info("Analytics pipeline completed successfully")
            
        except Exception as e:
            logger.error(f"Error in analytics pipeline: {str(e)}")
            raise
        finally:
            self.spark.stop()


def main():
    """Main entry point"""
    analytics = TransactionAnalytics()
    analytics.run_analytics_pipeline()


if __name__ == "__main__":
    main()
