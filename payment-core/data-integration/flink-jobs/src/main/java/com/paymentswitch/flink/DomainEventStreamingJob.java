package com.paymentswitch.flink;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.core.fs.Path;
import org.apache.flink.formats.parquet.avro.AvroParquetWriters;
import org.apache.flink.streaming.api.CheckpointingMode;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.sink.filesystem.StreamingFileSink;
import org.apache.flink.streaming.api.functions.sink.filesystem.rollingpolicies.DefaultRollingPolicy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Properties;

/**
 * Flink Streaming Job for Domain Events
 * 
 * This job consumes domain events from Kafka topics and writes them to
 * Delta Lake (via Parquet files on S3/MinIO) for analytics and ML training.
 * 
 * Topics consumed:
 * - domain.events.kyc
 * - domain.events.aml
 * - domain.events.remittance
 * - domain.events.fraud
 * - domain.events.settlement
 * - domain.events.reconciliation
 * - domain.events.dispute
 * - domain.events.rate
 * - domain.events.fx
 * - tigerbeetle.accounts
 * - tigerbeetle.transfers
 * - tigerbeetle.balances
 * 
 * Output:
 * - s3a://delta-lake/bronze/domain_events/
 * - s3a://delta-lake/bronze/ledger_events/
 */
public class DomainEventStreamingJob {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        // Get configuration from environment
        String kafkaBootstrapServers = getEnvOrDefault("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
        String s3Endpoint = getEnvOrDefault("S3_ENDPOINT", "http://rustfs.lakehouse:9000");
        String s3AccessKey = getEnvOrDefault("AWS_ACCESS_KEY_ID", "");
        String s3SecretKey = getEnvOrDefault("AWS_SECRET_ACCESS_KEY", "");
        String checkpointPath = getEnvOrDefault("CHECKPOINT_PATH", "s3a://checkpoints/flink/domain-events");
        String outputPath = getEnvOrDefault("OUTPUT_PATH", "s3a://delta-lake/bronze/domain_events");

        // Create execution environment
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Configure checkpointing for exactly-once semantics
        env.enableCheckpointing(60000, CheckpointingMode.EXACTLY_ONCE);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
        env.getCheckpointConfig().setTolerableCheckpointFailureNumber(3);

        // Configure S3 filesystem
        configureS3(env, s3Endpoint, s3AccessKey, s3SecretKey);

        // Create Kafka sources for domain events
        KafkaSource<String> domainEventsSource = createKafkaSource(
            kafkaBootstrapServers,
            "domain.events.*",
            "flink-domain-events-consumer"
        );

        KafkaSource<String> ledgerEventsSource = createKafkaSource(
            kafkaBootstrapServers,
            "tigerbeetle.*",
            "flink-ledger-events-consumer"
        );

        // Create data streams
        DataStream<String> domainEventsStream = env
            .fromSource(domainEventsSource, WatermarkStrategy.noWatermarks(), "Domain Events Source")
            .name("domain-events-source");

        DataStream<String> ledgerEventsStream = env
            .fromSource(ledgerEventsSource, WatermarkStrategy.noWatermarks(), "Ledger Events Source")
            .name("ledger-events-source");

        // Process and enrich domain events
        DataStream<DomainEvent> processedDomainEvents = domainEventsStream
            .map(new DomainEventParser())
            .name("parse-domain-events")
            .filter(event -> event != null)
            .name("filter-valid-events");

        // Process ledger events
        DataStream<LedgerEvent> processedLedgerEvents = ledgerEventsStream
            .map(new LedgerEventParser())
            .name("parse-ledger-events")
            .filter(event -> event != null)
            .name("filter-valid-ledger-events");

        // Create sinks for Delta Lake (Parquet format)
        StreamingFileSink<DomainEvent> domainEventsSink = createParquetSink(
            outputPath + "/domain_events",
            DomainEvent.class
        );

        StreamingFileSink<LedgerEvent> ledgerEventsSink = createParquetSink(
            outputPath + "/ledger_events",
            LedgerEvent.class
        );

        // Add sinks to streams
        processedDomainEvents
            .addSink(domainEventsSink)
            .name("domain-events-sink");

        processedLedgerEvents
            .addSink(ledgerEventsSink)
            .name("ledger-events-sink");

        // Execute the job
        env.execute("Payment Switch Domain Events Streaming Job");
    }

    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null && !value.isEmpty() ? value : defaultValue;
    }

    private static void configureS3(StreamExecutionEnvironment env, String endpoint, String accessKey, String secretKey) {
        // S3 configuration is typically done via flink-conf.yaml or environment
        // This method documents the required configuration
        System.setProperty("fs.s3a.endpoint", endpoint);
        System.setProperty("fs.s3a.access.key", accessKey);
        System.setProperty("fs.s3a.secret.key", secretKey);
        System.setProperty("fs.s3a.path.style.access", "true");
        System.setProperty("fs.s3a.impl", "org.apache.hadoop.fs.s3a.S3AFileSystem");
    }

    private static KafkaSource<String> createKafkaSource(String bootstrapServers, String topicPattern, String groupId) {
        return KafkaSource.<String>builder()
            .setBootstrapServers(bootstrapServers)
            .setTopicPattern(java.util.regex.Pattern.compile(topicPattern))
            .setGroupId(groupId)
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();
    }

    private static <T> StreamingFileSink<T> createParquetSink(String path, Class<T> clazz) {
        return StreamingFileSink
            .forBulkFormat(
                new Path(path),
                AvroParquetWriters.forReflectRecord(clazz)
            )
            .withRollingPolicy(
                DefaultRollingPolicy.builder()
                    .withRolloverInterval(Duration.ofMinutes(15))
                    .withInactivityInterval(Duration.ofMinutes(5))
                    .withMaxPartSize(1024 * 1024 * 128) // 128MB
                    .build()
            )
            .build();
    }

    /**
     * Parser for domain events from Kafka
     */
    public static class DomainEventParser implements MapFunction<String, DomainEvent> {
        private static final ObjectMapper mapper = new ObjectMapper();

        @Override
        public DomainEvent map(String value) throws Exception {
            try {
                JsonNode node = mapper.readTree(value);
                
                DomainEvent event = new DomainEvent();
                event.eventId = getStringField(node, "event_id");
                event.eventType = getStringField(node, "event_type");
                event.timestamp = getStringField(node, "timestamp");
                event.version = getStringField(node, "version");
                event.sourceService = getStringField(node, "source_service");
                event.correlationId = getStringField(node, "correlation_id");
                event.causationId = getStringField(node, "causation_id");
                event.aggregateType = getStringField(node, "aggregate_type");
                event.aggregateId = getStringField(node, "aggregate_id");
                event.data = node.has("data") ? mapper.writeValueAsString(node.get("data")) : "{}";
                event.metadata = node.has("metadata") ? mapper.writeValueAsString(node.get("metadata")) : "{}";
                event.processedAt = java.time.Instant.now().toString();
                
                return event;
            } catch (Exception e) {
                System.err.println("Failed to parse domain event: " + e.getMessage());
                return null;
            }
        }

        private String getStringField(JsonNode node, String field) {
            return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
        }
    }

    /**
     * Parser for ledger events from TigerBeetle CDC
     */
    public static class LedgerEventParser implements MapFunction<String, LedgerEvent> {
        private static final ObjectMapper mapper = new ObjectMapper();

        @Override
        public LedgerEvent map(String value) throws Exception {
            try {
                JsonNode node = mapper.readTree(value);
                
                LedgerEvent event = new LedgerEvent();
                event.eventId = getStringField(node, "event_id");
                event.eventType = getStringField(node, "event_type");
                event.timestamp = getStringField(node, "timestamp");
                event.sequenceNumber = node.has("sequence_number") ? node.get("sequence_number").asLong() : 0;
                event.accountId = getStringField(node, "account_id");
                event.transferId = getStringField(node, "transfer_id");
                event.debitAccountId = getStringField(node, "debit_account_id");
                event.creditAccountId = getStringField(node, "credit_account_id");
                event.amount = node.has("amount") ? node.get("amount").asLong() : 0;
                event.ledger = node.has("ledger") ? node.get("ledger").asInt() : 0;
                event.code = node.has("code") ? node.get("code").asInt() : 0;
                event.flags = node.has("flags") ? node.get("flags").asInt() : 0;
                event.userData = getStringField(node, "user_data");
                event.data = node.has("data") ? mapper.writeValueAsString(node.get("data")) : "{}";
                event.processedAt = java.time.Instant.now().toString();
                
                return event;
            } catch (Exception e) {
                System.err.println("Failed to parse ledger event: " + e.getMessage());
                return null;
            }
        }

        private String getStringField(JsonNode node, String field) {
            return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
        }
    }

    /**
     * Domain Event POJO for Parquet serialization
     */
    public static class DomainEvent {
        public String eventId;
        public String eventType;
        public String timestamp;
        public String version;
        public String sourceService;
        public String correlationId;
        public String causationId;
        public String aggregateType;
        public String aggregateId;
        public String data;
        public String metadata;
        public String processedAt;

        public DomainEvent() {}
    }

    /**
     * Ledger Event POJO for Parquet serialization
     */
    public static class LedgerEvent {
        public String eventId;
        public String eventType;
        public String timestamp;
        public long sequenceNumber;
        public String accountId;
        public String transferId;
        public String debitAccountId;
        public String creditAccountId;
        public long amount;
        public int ledger;
        public int code;
        public int flags;
        public String userData;
        public String data;
        public String processedAt;

        public LedgerEvent() {}
    }
}
