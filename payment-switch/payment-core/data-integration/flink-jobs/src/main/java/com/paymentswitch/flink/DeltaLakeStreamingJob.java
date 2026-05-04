package com.paymentswitch.flink;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.CheckpointingMode;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.table.api.EnvironmentSettings;
import org.apache.flink.table.api.Table;
import org.apache.flink.table.api.bridge.java.StreamTableEnvironment;
import org.apache.flink.types.Row;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Properties;

/**
 * Flink Streaming Job with Delta Lake Connector
 * 
 * This job consumes domain events from Kafka topics and writes them to
 * Delta Lake with proper transactional commits (_delta_log).
 * 
 * Uses Flink Delta Lake Connector for ACID-compliant writes.
 * 
 * Topics consumed:
 * - domain.events.kyc, domain.events.aml, domain.events.remittance
 * - domain.events.fraud, domain.events.settlement, domain.events.reconciliation
 * - domain.events.transaction, domain.events.notification
 * - tigerbeetle.accounts, tigerbeetle.transfers, tigerbeetle.balances
 * 
 * Output (Delta Lake with _delta_log):
 * - s3a://lakehouse/delta/bronze/domain_events/
 * - s3a://lakehouse/delta/bronze/ledger_events/
 * - s3a://lakehouse/delta/silver/transactions/
 * - s3a://lakehouse/delta/gold/metrics/
 */
public class DeltaLakeStreamingJob {

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final String DELTA_BASE_PATH = "s3a://lakehouse/delta";

    public static void main(String[] args) throws Exception {
        // Get configuration from environment
        String kafkaBootstrapServers = getEnvOrDefault("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
        String s3Endpoint = getEnvOrDefault("S3_ENDPOINT", "http://rustfs.lakehouse:9000");
        String s3AccessKey = getEnvOrDefault("AWS_ACCESS_KEY_ID", "minioadmin");
        String s3SecretKey = getEnvOrDefault("AWS_SECRET_ACCESS_KEY", "minioadmin");
        String checkpointPath = getEnvOrDefault("CHECKPOINT_PATH", "s3a://lakehouse/checkpoints/flink");
        String deltaBasePath = getEnvOrDefault("DELTA_BASE_PATH", DELTA_BASE_PATH);

        // Create execution environment
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Create Table Environment for Delta Lake SQL support
        EnvironmentSettings settings = EnvironmentSettings.newInstance()
            .inStreamingMode()
            .build();
        StreamTableEnvironment tableEnv = StreamTableEnvironment.create(env, settings);

        // Configure checkpointing for exactly-once semantics
        env.enableCheckpointing(60000, CheckpointingMode.EXACTLY_ONCE);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);
        env.getCheckpointConfig().setMaxConcurrentCheckpoints(1);
        env.getCheckpointConfig().setTolerableCheckpointFailureNumber(3);

        // Configure S3/MinIO filesystem
        configureS3(s3Endpoint, s3AccessKey, s3SecretKey);

        // Create Delta Lake catalog
        tableEnv.executeSql(String.format(
            "CREATE CATALOG delta_catalog WITH (" +
            "  'type' = 'delta-catalog'," +
            "  'catalog-type' = 'in-memory'" +
            ")"
        ));
        tableEnv.useCatalog("delta_catalog");

        // Create Bronze Layer Tables (raw events)
        createBronzeTables(tableEnv, deltaBasePath);
        
        // Create Silver Layer Tables (cleaned/enriched)
        createSilverTables(tableEnv, deltaBasePath);
        
        // Create Gold Layer Tables (aggregated metrics)
        createGoldTables(tableEnv, deltaBasePath);

        // Create Kafka sources for domain events
        KafkaSource<String> domainEventsSource = createKafkaSource(
            kafkaBootstrapServers,
            "domain.events.*",
            "flink-delta-domain-events"
        );

        KafkaSource<String> ledgerEventsSource = createKafkaSource(
            kafkaBootstrapServers,
            "tigerbeetle.*",
            "flink-delta-ledger-events"
        );

        KafkaSource<String> transactionEventsSource = createKafkaSource(
            kafkaBootstrapServers,
            "domain.events.transaction",
            "flink-delta-transaction-events"
        );

        // Create data streams
        DataStream<String> domainEventsStream = env
            .fromSource(domainEventsSource, WatermarkStrategy.noWatermarks(), "Domain Events Source")
            .name("domain-events-source");

        DataStream<String> ledgerEventsStream = env
            .fromSource(ledgerEventsSource, WatermarkStrategy.noWatermarks(), "Ledger Events Source")
            .name("ledger-events-source");

        DataStream<String> transactionEventsStream = env
            .fromSource(transactionEventsSource, WatermarkStrategy.noWatermarks(), "Transaction Events Source")
            .name("transaction-events-source");

        // Process domain events to Row format for Delta Lake
        DataStream<Row> domainEventRows = domainEventsStream
            .map(new DomainEventToRowMapper())
            .name("parse-domain-events")
            .filter(row -> row != null)
            .name("filter-valid-domain-events");

        // Process ledger events to Row format
        DataStream<Row> ledgerEventRows = ledgerEventsStream
            .map(new LedgerEventToRowMapper())
            .name("parse-ledger-events")
            .filter(row -> row != null)
            .name("filter-valid-ledger-events");

        // Process transaction events for silver layer
        DataStream<Row> transactionRows = transactionEventsStream
            .map(new TransactionEventToRowMapper())
            .name("parse-transaction-events")
            .filter(row -> row != null)
            .name("filter-valid-transactions");

        // Convert streams to tables and insert into Delta Lake
        Table domainEventsTable = tableEnv.fromDataStream(domainEventRows);
        Table ledgerEventsTable = tableEnv.fromDataStream(ledgerEventRows);
        Table transactionsTable = tableEnv.fromDataStream(transactionRows);

        // Insert into Bronze layer with Delta Lake transactional commits
        tableEnv.createTemporaryView("domain_events_stream", domainEventsTable);
        tableEnv.createTemporaryView("ledger_events_stream", ledgerEventsTable);
        tableEnv.createTemporaryView("transactions_stream", transactionsTable);

        // Execute streaming inserts to Delta Lake
        tableEnv.executeSql(
            "INSERT INTO bronze_domain_events SELECT * FROM domain_events_stream"
        );
        
        tableEnv.executeSql(
            "INSERT INTO bronze_ledger_events SELECT * FROM ledger_events_stream"
        );

        tableEnv.executeSql(
            "INSERT INTO silver_transactions SELECT * FROM transactions_stream"
        );

        // Create continuous aggregation for Gold layer metrics
        tableEnv.executeSql(
            "INSERT INTO gold_transaction_metrics " +
            "SELECT " +
            "  TUMBLE_START(event_time, INTERVAL '1' MINUTE) as window_start," +
            "  TUMBLE_END(event_time, INTERVAL '1' MINUTE) as window_end," +
            "  COUNT(*) as transaction_count," +
            "  SUM(amount) as total_amount," +
            "  AVG(amount) as avg_amount," +
            "  SUM(CASE WHEN status = 'COMMITTED' THEN 1 ELSE 0 END) as success_count," +
            "  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count," +
            "  AVG(latency_ms) as avg_latency_ms," +
            "  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms," +
            "  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms " +
            "FROM silver_transactions " +
            "GROUP BY TUMBLE(event_time, INTERVAL '1' MINUTE)"
        );

        // Execute the job
        env.execute("Payment Switch Delta Lake Streaming Job");
    }

    private static void createBronzeTables(StreamTableEnvironment tableEnv, String basePath) {
        // Bronze Domain Events Table
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS bronze_domain_events (" +
            "  event_id STRING," +
            "  event_type STRING," +
            "  event_timestamp TIMESTAMP(3)," +
            "  version STRING," +
            "  source_service STRING," +
            "  correlation_id STRING," +
            "  causation_id STRING," +
            "  aggregate_type STRING," +
            "  aggregate_id STRING," +
            "  data STRING," +
            "  metadata STRING," +
            "  processed_at TIMESTAMP(3)," +
            "  WATERMARK FOR event_timestamp AS event_timestamp - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/bronze/domain_events'," +
            "  'delta.appendOnly' = 'true'" +
            ")", basePath
        ));

        // Bronze Ledger Events Table
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS bronze_ledger_events (" +
            "  event_id STRING," +
            "  event_type STRING," +
            "  event_timestamp TIMESTAMP(3)," +
            "  sequence_number BIGINT," +
            "  account_id STRING," +
            "  transfer_id STRING," +
            "  debit_account_id STRING," +
            "  credit_account_id STRING," +
            "  amount BIGINT," +
            "  ledger INT," +
            "  code INT," +
            "  flags INT," +
            "  user_data STRING," +
            "  data STRING," +
            "  processed_at TIMESTAMP(3)," +
            "  WATERMARK FOR event_timestamp AS event_timestamp - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/bronze/ledger_events'," +
            "  'delta.appendOnly' = 'true'" +
            ")", basePath
        ));
    }

    private static void createSilverTables(StreamTableEnvironment tableEnv, String basePath) {
        // Silver Transactions Table (cleaned and enriched)
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS silver_transactions (" +
            "  transaction_id STRING," +
            "  event_time TIMESTAMP(3)," +
            "  payer_id STRING," +
            "  payer_name STRING," +
            "  payee_id STRING," +
            "  payee_name STRING," +
            "  amount DECIMAL(18, 2)," +
            "  currency STRING," +
            "  status STRING," +
            "  transaction_type STRING," +
            "  latency_ms BIGINT," +
            "  fraud_score DOUBLE," +
            "  correlation_id STRING," +
            "  processed_at TIMESTAMP(3)," +
            "  WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/silver/transactions'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Silver Participants Table
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS silver_participants (" +
            "  participant_id STRING," +
            "  name STRING," +
            "  type STRING," +
            "  status STRING," +
            "  kyc_status STRING," +
            "  net_debit_cap DECIMAL(18, 2)," +
            "  current_position DECIMAL(18, 2)," +
            "  updated_at TIMESTAMP(3)," +
            "  WATERMARK FOR updated_at AS updated_at - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/silver/participants'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Silver Fraud Alerts Table
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS silver_fraud_alerts (" +
            "  alert_id STRING," +
            "  transaction_id STRING," +
            "  alert_time TIMESTAMP(3)," +
            "  alert_type STRING," +
            "  severity STRING," +
            "  status STRING," +
            "  risk_score DOUBLE," +
            "  ml_confidence DOUBLE," +
            "  payer_id STRING," +
            "  payee_id STRING," +
            "  amount DECIMAL(18, 2)," +
            "  resolved_at TIMESTAMP(3)," +
            "  resolution STRING," +
            "  WATERMARK FOR alert_time AS alert_time - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/silver/fraud_alerts'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Silver Settlements Table
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS silver_settlements (" +
            "  settlement_id STRING," +
            "  window_id STRING," +
            "  settlement_time TIMESTAMP(3)," +
            "  status STRING," +
            "  total_transactions BIGINT," +
            "  total_amount DECIMAL(18, 2)," +
            "  participant_count INT," +
            "  approvals_received INT," +
            "  approvals_required INT," +
            "  opened_at TIMESTAMP(3)," +
            "  closed_at TIMESTAMP(3)," +
            "  WATERMARK FOR settlement_time AS settlement_time - INTERVAL '5' SECOND" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/silver/settlements'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));
    }

    private static void createGoldTables(StreamTableEnvironment tableEnv, String basePath) {
        // Gold Transaction Metrics (pre-aggregated for dashboards)
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS gold_transaction_metrics (" +
            "  window_start TIMESTAMP(3)," +
            "  window_end TIMESTAMP(3)," +
            "  transaction_count BIGINT," +
            "  total_amount DECIMAL(18, 2)," +
            "  avg_amount DECIMAL(18, 2)," +
            "  success_count BIGINT," +
            "  failed_count BIGINT," +
            "  avg_latency_ms DOUBLE," +
            "  p95_latency_ms DOUBLE," +
            "  p99_latency_ms DOUBLE," +
            "  PRIMARY KEY (window_start) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/gold/transaction_metrics'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Gold Participant Health Metrics
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS gold_participant_health (" +
            "  window_start TIMESTAMP(3)," +
            "  window_end TIMESTAMP(3)," +
            "  participant_id STRING," +
            "  participant_name STRING," +
            "  tps DOUBLE," +
            "  success_rate DOUBLE," +
            "  avg_latency_ms DOUBLE," +
            "  transaction_count BIGINT," +
            "  total_volume DECIMAL(18, 2)," +
            "  health_status STRING," +
            "  PRIMARY KEY (window_start, participant_id) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/gold/participant_health'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Gold Fraud Summary Metrics
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS gold_fraud_metrics (" +
            "  window_start TIMESTAMP(3)," +
            "  window_end TIMESTAMP(3)," +
            "  open_alerts BIGINT," +
            "  critical_alerts BIGINT," +
            "  resolved_today BIGINT," +
            "  avg_resolution_time_minutes DOUBLE," +
            "  avg_risk_score DOUBLE," +
            "  blocked_transactions BIGINT," +
            "  reviewed_transactions BIGINT," +
            "  PRIMARY KEY (window_start) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/gold/fraud_metrics'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));

        // Gold Settlement Summary
        tableEnv.executeSql(String.format(
            "CREATE TABLE IF NOT EXISTS gold_settlement_metrics (" +
            "  window_start TIMESTAMP(3)," +
            "  window_end TIMESTAMP(3)," +
            "  pending_settlements BIGINT," +
            "  settled_today BIGINT," +
            "  total_settled_amount DECIMAL(18, 2)," +
            "  active_participants BIGINT," +
            "  avg_settlement_time_hours DOUBLE," +
            "  PRIMARY KEY (window_start) NOT ENFORCED" +
            ") WITH (" +
            "  'connector' = 'delta'," +
            "  'table-path' = '%s/gold/settlement_metrics'," +
            "  'delta.appendOnly' = 'false'" +
            ")", basePath
        ));
    }

    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null && !value.isEmpty() ? value : defaultValue;
    }

    private static void configureS3(String endpoint, String accessKey, String secretKey) {
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

    /**
     * Maps domain events to Row format for Delta Lake
     */
    public static class DomainEventToRowMapper implements MapFunction<String, Row> {
        private static final ObjectMapper mapper = new ObjectMapper();

        @Override
        public Row map(String value) throws Exception {
            try {
                JsonNode node = mapper.readTree(value);
                return Row.of(
                    getStringField(node, "event_id"),
                    getStringField(node, "event_type"),
                    java.sql.Timestamp.valueOf(getStringField(node, "timestamp").replace("T", " ").replace("Z", "")),
                    getStringField(node, "version"),
                    getStringField(node, "source_service"),
                    getStringField(node, "correlation_id"),
                    getStringField(node, "causation_id"),
                    getStringField(node, "aggregate_type"),
                    getStringField(node, "aggregate_id"),
                    node.has("data") ? mapper.writeValueAsString(node.get("data")) : "{}",
                    node.has("metadata") ? mapper.writeValueAsString(node.get("metadata")) : "{}",
                    new java.sql.Timestamp(System.currentTimeMillis())
                );
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
     * Maps ledger events to Row format for Delta Lake
     */
    public static class LedgerEventToRowMapper implements MapFunction<String, Row> {
        private static final ObjectMapper mapper = new ObjectMapper();

        @Override
        public Row map(String value) throws Exception {
            try {
                JsonNode node = mapper.readTree(value);
                return Row.of(
                    getStringField(node, "event_id"),
                    getStringField(node, "event_type"),
                    java.sql.Timestamp.valueOf(getStringField(node, "timestamp").replace("T", " ").replace("Z", "")),
                    node.has("sequence_number") ? node.get("sequence_number").asLong() : 0L,
                    getStringField(node, "account_id"),
                    getStringField(node, "transfer_id"),
                    getStringField(node, "debit_account_id"),
                    getStringField(node, "credit_account_id"),
                    node.has("amount") ? node.get("amount").asLong() : 0L,
                    node.has("ledger") ? node.get("ledger").asInt() : 0,
                    node.has("code") ? node.get("code").asInt() : 0,
                    node.has("flags") ? node.get("flags").asInt() : 0,
                    getStringField(node, "user_data"),
                    node.has("data") ? mapper.writeValueAsString(node.get("data")) : "{}",
                    new java.sql.Timestamp(System.currentTimeMillis())
                );
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
     * Maps transaction events to Row format for Silver layer
     */
    public static class TransactionEventToRowMapper implements MapFunction<String, Row> {
        private static final ObjectMapper mapper = new ObjectMapper();

        @Override
        public Row map(String value) throws Exception {
            try {
                JsonNode node = mapper.readTree(value);
                JsonNode data = node.has("data") ? node.get("data") : node;
                
                return Row.of(
                    getStringField(data, "transaction_id"),
                    java.sql.Timestamp.valueOf(getStringField(node, "timestamp").replace("T", " ").replace("Z", "")),
                    getStringField(data, "payer_id"),
                    getStringField(data, "payer_name"),
                    getStringField(data, "payee_id"),
                    getStringField(data, "payee_name"),
                    data.has("amount") ? new java.math.BigDecimal(data.get("amount").asText()) : java.math.BigDecimal.ZERO,
                    getStringField(data, "currency"),
                    getStringField(data, "status"),
                    getStringField(data, "transaction_type"),
                    data.has("latency_ms") ? data.get("latency_ms").asLong() : 0L,
                    data.has("fraud_score") ? data.get("fraud_score").asDouble() : 0.0,
                    getStringField(node, "correlation_id"),
                    new java.sql.Timestamp(System.currentTimeMillis())
                );
            } catch (Exception e) {
                System.err.println("Failed to parse transaction event: " + e.getMessage());
                return null;
            }
        }

        private String getStringField(JsonNode node, String field) {
            return node.has(field) && !node.get(field).isNull() ? node.get(field).asText() : null;
        }
    }
}
