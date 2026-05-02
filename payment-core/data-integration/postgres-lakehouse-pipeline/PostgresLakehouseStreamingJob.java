package com.paymentswitch.integration;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.formats.json.JsonNodeDeserializationSchema;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.JsonNode;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.table.api.Table;
import org.apache.flink.table.api.TableResult;

import java.time.Duration;

/**
 * Flink Streaming Job: PostgreSQL to Lakehouse
 * 
 * This job consumes CDC events from PostgreSQL (via Debezium and Kafka),
 * performs transformations and enrichments, and writes the data to Delta Lake
 * in the Lakehouse.
 */
public class PostgresLakehouseStreamingJob {
    
    private static final String KAFKA_BOOTSTRAP_SERVERS = System.getenv().getOrDefault(
        "KAFKA_BOOTSTRAP_SERVERS", "kafka:9092"
    );
    
    private static final String KAFKA_TOPIC_POSTGRES_CDC = System.getenv().getOrDefault(
        "KAFKA_TOPIC_POSTGRES_CDC", "postgres.public.transactions"
    );
    
    private static final String KAFKA_GROUP_ID = System.getenv().getOrDefault(
        "KAFKA_GROUP_ID", "flink-postgres-lakehouse"
    );
    
    private static final String DELTA_LAKE_PATH = System.getenv().getOrDefault(
        "DELTA_LAKE_PATH", "s3a://lakehouse/delta/transactions"
    );
    
    private static final String S3_ENDPOINT = System.getenv().getOrDefault(
        "S3_ENDPOINT", "http://rustfs.lakehouse:9000"
    );
    
    private static final String S3_ACCESS_KEY = System.getenv().getOrDefault(
        "S3_ACCESS_KEY", "minioadmin"
    );
    
    private static final String S3_SECRET_KEY = System.getenv().getOrDefault(
        "S3_SECRET_KEY", "minioadmin"
    );
    
    public static void main(String[] args) throws Exception {
        // Set up the streaming execution environment
        final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Configure checkpointing for exactly-once semantics
        env.enableCheckpointing(60000); // Checkpoint every 60 seconds
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(300000);
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
        
        // Set up the Table API environment
        final StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env);
        
        // Configure S3/MinIO for Delta Lake
        tableEnv.getConfig().getConfiguration().setString(
            "s3.endpoint", S3_ENDPOINT
        );
        tableEnv.getConfig().getConfiguration().setString(
            "s3.access-key", S3_ACCESS_KEY
        );
        tableEnv.getConfig().getConfiguration().setString(
            "s3.secret-key", S3_SECRET_KEY
        );
        tableEnv.getConfig().getConfiguration().setString(
            "s3.path.style.access", "true"
        );
        
        // Create Kafka source for PostgreSQL CDC events
        KafkaSource<JsonNode> kafkaSource = KafkaSource.<JsonNode>builder()
            .setBootstrapServers(KAFKA_BOOTSTRAP_SERVERS)
            .setTopics(KAFKA_TOPIC_POSTGRES_CDC)
            .setGroupId(KAFKA_GROUP_ID)
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new JsonNodeDeserializationSchema())
            .build();
        
        // Create data stream from Kafka
        DataStream<JsonNode> cdcStream = env.fromSource(
            kafkaSource,
            WatermarkStrategy.<JsonNode>forBoundedOutOfOrderness(Duration.ofSeconds(5))
                .withIdleness(Duration.ofMinutes(1)),
            "PostgreSQL CDC Source"
        );
        
        // Transform and enrich the CDC events
        DataStream<JsonNode> enrichedStream = cdcStream
            .map(new CDCTransformFunction())
            .name("Transform CDC Events");
        
        // Register the enriched stream as a temporary table
        tableEnv.createTemporaryView("enriched_transactions", enrichedStream);
        
        // Create Delta Lake sink table
        String createDeltaTableDDL = String.format(
            "CREATE TABLE IF NOT EXISTS delta_transactions (" +
            "  transaction_id BIGINT," +
            "  account_id BIGINT," +
            "  amount BIGINT," +
            "  transaction_type STRING," +
            "  status STRING," +
            "  created_at TIMESTAMP(3)," +
            "  updated_at TIMESTAMP(3)," +
            "  metadata STRING," +
            "  PRIMARY KEY (transaction_id) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'path' = '%s'," +
            "  'table-name' = 'transactions'," +
            "  'sink.parallelism' = '4'" +
            ")",
            DELTA_LAKE_PATH
        );
        
        tableEnv.executeSql(createDeltaTableDDL);
        
        // Insert enriched data into Delta Lake
        String insertSQL = 
            "INSERT INTO delta_transactions " +
            "SELECT " +
            "  CAST(JSON_VALUE(data, '$.transaction_id') AS BIGINT) AS transaction_id," +
            "  CAST(JSON_VALUE(data, '$.account_id') AS BIGINT) AS account_id," +
            "  CAST(JSON_VALUE(data, '$.amount') AS BIGINT) AS amount," +
            "  JSON_VALUE(data, '$.transaction_type') AS transaction_type," +
            "  JSON_VALUE(data, '$.status') AS status," +
            "  TO_TIMESTAMP(JSON_VALUE(data, '$.created_at')) AS created_at," +
            "  TO_TIMESTAMP(JSON_VALUE(data, '$.updated_at')) AS updated_at," +
            "  JSON_VALUE(data, '$.metadata') AS metadata " +
            "FROM enriched_transactions";
        
        TableResult result = tableEnv.executeSql(insertSQL);
        
        // Execute the job
        env.execute("PostgreSQL to Lakehouse Streaming Job");
    }
    
    /**
     * Function to transform and enrich CDC events
     */
    public static class CDCTransformFunction implements MapFunction<JsonNode, JsonNode> {
        private final ObjectMapper mapper = new ObjectMapper();
        
        @Override
        public JsonNode map(JsonNode cdcEvent) throws Exception {
            ObjectNode enriched = mapper.createObjectNode();
            
            // Extract the payload from the Debezium CDC event
            JsonNode payload = cdcEvent.get("payload");
            if (payload == null) {
                return enriched;
            }
            
            JsonNode after = payload.get("after");
            if (after == null) {
                return enriched;
            }
            
            // Add the data
            enriched.set("data", after);
            
            // Add metadata
            ObjectNode metadata = enriched.putObject("metadata");
            metadata.put("source", "postgres");
            metadata.put("operation", payload.get("op").asText());
            metadata.put("timestamp", payload.get("ts_ms").asLong());
            
            // Add enrichment (e.g., geolocation, fraud score)
            // This would typically call external services
            enriched.put("enriched_at", System.currentTimeMillis());
            
            return enriched;
        }
    }
}
