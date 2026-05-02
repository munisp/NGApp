package com.paymentswitch.lakehouse.flink;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.windowing.WindowFunction;
import org.apache.flink.streaming.api.windowing.assigners.TumblingEventTimeWindows;
import org.apache.flink.streaming.api.windowing.time.Time;
import org.apache.flink.streaming.api.windowing.windows.TimeWindow;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.table.api.Table;
import org.apache.flink.util.Collector;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.JsonNode;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Properties;

/**
 * Flink Streaming Job for Processing Payment Transactions
 * 
 * This job reads transaction data from Kafka, processes it in real-time,
 * and writes the results to Delta Lake on MinIO.
 */
public class TransactionStreamProcessor {
    
    private static final String KAFKA_BROKERS = "kafka.payment-switch:9092";
    private static final String KAFKA_TOPIC = "payment-transactions";
    private static final String CONSUMER_GROUP = "flink-transaction-processor";
    private static final String DELTA_LAKE_PATH = "s3a://delta-lake/transactions";
    
    public static void main(String[] args) throws Exception {
        // Set up the streaming execution environment
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Enable checkpointing for fault tolerance
        env.enableCheckpointing(60000); // checkpoint every 60 seconds
        env.getCheckpointConfig().setCheckpointTimeout(600000); // 10 minutes timeout
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000); // 30 seconds between checkpoints
        
        // Set up Table Environment for Delta Lake integration
        StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env);
        
        // Configure S3/MinIO properties
        Properties s3Props = new Properties();
        s3Props.setProperty("s3.endpoint", "http://rustfs.lakehouse:9000");
        s3Props.setProperty("s3.path.style.access", "true");
        s3Props.setProperty("s3.access-key", "${AWS_ACCESS_KEY_ID}");
        s3Props.setProperty("s3.secret-key", "${AWS_SECRET_ACCESS_KEY}");
        
        // Create Kafka source
        KafkaSource<String> source = KafkaSource.<String>builder()
            .setBootstrapServers(KAFKA_BROKERS)
            .setTopics(KAFKA_TOPIC)
            .setGroupId(CONSUMER_GROUP)
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();
        
        // Read from Kafka
        DataStream<String> kafkaStream = env.fromSource(
            source,
            WatermarkStrategy.forBoundedOutOfOrderness(Duration.ofSeconds(10)),
            "Kafka Source"
        );
        
        // Parse JSON and extract transaction data
        DataStream<Transaction> transactions = kafkaStream
            .map(new JsonToTransactionMapper())
            .name("Parse Transactions");
        
        // Enrich transactions with additional data
        DataStream<EnrichedTransaction> enrichedTransactions = transactions
            .map(new TransactionEnricher())
            .name("Enrich Transactions");
        
        // Detect anomalies in real-time
        DataStream<EnrichedTransaction> flaggedTransactions = enrichedTransactions
            .map(new AnomalyDetector())
            .name("Detect Anomalies");
        
        // Aggregate transactions by time window
        DataStream<TransactionAggregate> aggregates = flaggedTransactions
            .keyBy(t -> t.payerId)
            .window(TumblingEventTimeWindows.of(Time.minutes(5)))
            .apply(new TransactionAggregator())
            .name("Aggregate Transactions");
        
        // Write enriched transactions to Delta Lake
        tableEnv.executeSql(
            "CREATE TABLE IF NOT EXISTS transactions_delta (" +
            "  transaction_id STRING," +
            "  payer_id STRING," +
            "  payee_id STRING," +
            "  amount DECIMAL(18, 2)," +
            "  currency STRING," +
            "  timestamp TIMESTAMP(3)," +
            "  status STRING," +
            "  fraud_score DOUBLE," +
            "  is_anomaly BOOLEAN," +
            "  merchant_category STRING," +
            "  country STRING," +
            "  PRIMARY KEY (transaction_id) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'path' = '" + DELTA_LAKE_PATH + "'," +
            "  'table-name' = 'transactions'" +
            ")"
        );
        
        // Convert DataStream to Table and insert into Delta Lake
        Table transactionTable = tableEnv.fromDataStream(flaggedTransactions);
        transactionTable.executeInsert("transactions_delta");
        
        // Write aggregates to Delta Lake
        tableEnv.executeSql(
            "CREATE TABLE IF NOT EXISTS transaction_aggregates_delta (" +
            "  payer_id STRING," +
            "  window_start TIMESTAMP(3)," +
            "  window_end TIMESTAMP(3)," +
            "  transaction_count BIGINT," +
            "  total_amount DECIMAL(18, 2)," +
            "  avg_amount DECIMAL(18, 2)," +
            "  max_amount DECIMAL(18, 2)," +
            "  anomaly_count BIGINT," +
            "  PRIMARY KEY (payer_id, window_start) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'path' = 's3a://delta-lake/transaction_aggregates'," +
            "  'table-name' = 'transaction_aggregates'" +
            ")"
        );
        
        Table aggregateTable = tableEnv.fromDataStream(aggregates);
        aggregateTable.executeInsert("transaction_aggregates_delta");
        
        // Execute the Flink job
        env.execute("Transaction Stream Processor");
    }
    
    /**
     * Maps JSON string to Transaction object
     */
    public static class JsonToTransactionMapper implements MapFunction<String, Transaction> {
        private final ObjectMapper objectMapper = new ObjectMapper();
        
        @Override
        public Transaction map(String json) throws Exception {
            JsonNode node = objectMapper.readTree(json);
            
            Transaction transaction = new Transaction();
            transaction.transactionId = node.get("transaction_id").asText();
            transaction.payerId = node.get("payer").get("id_value").asText();
            transaction.payeeId = node.get("payee").get("id_value").asText();
            transaction.amount = node.get("amount").asDouble();
            transaction.currency = node.get("currency").asText();
            transaction.timestamp = node.get("timestamp").asLong();
            transaction.status = node.get("status").asText("PENDING");
            
            return transaction;
        }
    }
    
    /**
     * Enriches transaction with additional data
     */
    public static class TransactionEnricher implements MapFunction<Transaction, EnrichedTransaction> {
        @Override
        public EnrichedTransaction map(Transaction transaction) throws Exception {
            EnrichedTransaction enriched = new EnrichedTransaction();
            enriched.transactionId = transaction.transactionId;
            enriched.payerId = transaction.payerId;
            enriched.payeeId = transaction.payeeId;
            enriched.amount = transaction.amount;
            enriched.currency = transaction.currency;
            enriched.timestamp = transaction.timestamp;
            enriched.status = transaction.status;
            
            // Enrich with merchant category (mock implementation)
            enriched.merchantCategory = getMerchantCategory(transaction.payeeId);
            
            // Enrich with country (mock implementation)
            enriched.country = getCountryFromPayerId(transaction.payerId);
            
            return enriched;
        }
        
        private String getMerchantCategory(String payeeId) {
            // Mock implementation - in production, this would query a database
            int hash = Math.abs(payeeId.hashCode() % 10);
            String[] categories = {"RETAIL", "FOOD", "TRANSPORT", "ENTERTAINMENT", 
                                   "UTILITIES", "HEALTHCARE", "EDUCATION", "TRAVEL", 
                                   "FINANCIAL", "OTHER"};
            return categories[hash];
        }
        
        private String getCountryFromPayerId(String payerId) {
            // Mock implementation - in production, this would query a database
            int hash = Math.abs(payerId.hashCode() % 5);
            String[] countries = {"US", "UK", "CA", "AU", "DE"};
            return countries[hash];
        }
    }
    
    /**
     * Detects anomalies in transactions
     */
    public static class AnomalyDetector implements MapFunction<EnrichedTransaction, EnrichedTransaction> {
        @Override
        public EnrichedTransaction map(EnrichedTransaction transaction) throws Exception {
            // Calculate fraud score based on multiple factors
            double fraudScore = 0.0;
            
            // High amount transactions
            if (transaction.amount > 10000) {
                fraudScore += 0.3;
            }
            
            // Suspicious merchant categories
            if ("FINANCIAL".equals(transaction.merchantCategory) || 
                "OTHER".equals(transaction.merchantCategory)) {
                fraudScore += 0.2;
            }
            
            // High-risk countries (mock implementation)
            if ("XX".equals(transaction.country)) {
                fraudScore += 0.5;
            }
            
            transaction.fraudScore = fraudScore;
            transaction.isAnomaly = fraudScore > 0.7;
            
            return transaction;
        }
    }
    
    /**
     * Aggregates transactions by time window
     */
    public static class TransactionAggregator 
            implements WindowFunction<EnrichedTransaction, TransactionAggregate, String, TimeWindow> {
        @Override
        public void apply(
                String payerId,
                TimeWindow window,
                Iterable<EnrichedTransaction> transactions,
                Collector<TransactionAggregate> out) throws Exception {
            
            TransactionAggregate aggregate = new TransactionAggregate();
            aggregate.payerId = payerId;
            aggregate.windowStart = window.getStart();
            aggregate.windowEnd = window.getEnd();
            
            long count = 0;
            double totalAmount = 0.0;
            double maxAmount = 0.0;
            long anomalyCount = 0;
            
            for (EnrichedTransaction transaction : transactions) {
                count++;
                totalAmount += transaction.amount;
                maxAmount = Math.max(maxAmount, transaction.amount);
                if (transaction.isAnomaly) {
                    anomalyCount++;
                }
            }
            
            aggregate.transactionCount = count;
            aggregate.totalAmount = totalAmount;
            aggregate.avgAmount = totalAmount / count;
            aggregate.maxAmount = maxAmount;
            aggregate.anomalyCount = anomalyCount;
            
            out.collect(aggregate);
        }
    }
    
    // Data classes
    public static class Transaction {
        public String transactionId;
        public String payerId;
        public String payeeId;
        public double amount;
        public String currency;
        public long timestamp;
        public String status;
    }
    
    public static class EnrichedTransaction extends Transaction {
        public String merchantCategory;
        public String country;
        public double fraudScore;
        public boolean isAnomaly;
    }
    
    public static class TransactionAggregate {
        public String payerId;
        public long windowStart;
        public long windowEnd;
        public long transactionCount;
        public double totalAmount;
        public double avgAmount;
        public double maxAmount;
        public long anomalyCount;
    }
}
