/**
 * ENV — Centralized environment configuration with production-safe defaults.
 *
 * All values have sensible defaults so the platform starts without any secrets
 * configured. Override via environment variables or the Manus Secrets panel.
 *
 * Convention:
 *   - Internal service URLs default to Docker Compose service names (e.g. "kafka:9092")
 *   - Localhost equivalents for development (e.g. "localhost:9092")
 *   - Tokens/passwords default to clearly-labeled placeholder strings
 */
export const ENV = {
  // ─── Core Platform ────────────────────────────────────────────────────────
  appVersion:     "v55.0",
  appId:          process.env.VITE_APP_ID          ?? "og-rmm-platform",
  physicsUrl:     process.env.PHYSICS_URL           ?? "http://localhost:4001",
  mlUrl:          process.env.ML_URL                ?? "http://localhost:4003",
  pinnModelS3Key: process.env.PINN_MODEL_S3_KEY     ?? "pinn-models/og-physics-55.0.0/latest.pt",
  pinnVersionKey: process.env.PINN_VERSION_KEY      ?? "pinn-models/version.json",
  cookieSecret:   process.env.JWT_SECRET            ?? "og-rmm-jwt-secret-change-in-production",
  databaseUrl:    process.env.POSTGRES_URL          ?? process.env.DATABASE_URL ?? "postgresql://ogrmm:ogrmm_secure_2026@localhost:5432/og_rmm",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL      ?? "https://api.manus.im",
  ownerOpenId:    process.env.OWNER_OPEN_ID         ?? "",
  ownerName:      process.env.OWNER_NAME            ?? "Platform Administrator",
  isProduction:   process.env.NODE_ENV === "production",
  forgeApiUrl:    process.env.BUILT_IN_FORGE_API_URL  ?? "https://api.manus.im",
  forgeApiKey:    process.env.BUILT_IN_FORGE_API_KEY  ?? "",
  vapidPublicKey:  process.env.VAPID_PUBLIC_KEY       ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY      ?? "",

  // ─── SMTP Email ───────────────────────────────────────────────────────────
  // Used by: regulatory scheduler, alarm escalation, shift handover email,
  //          calibration due-date alerts, materials reorder alerts, PTW notifications
  smtpHost:     process.env.SMTP_HOST     ?? "smtp.gmail.com",
  smtpPort:     parseInt(process.env.SMTP_PORT ?? "587"),
  smtpSecure:   (process.env.SMTP_SECURE ?? "false") === "true",
  smtpUser:     process.env.SMTP_USER     ?? "og-rmm-notifications@example.com",
  smtpPass:     process.env.SMTP_PASS     ?? "og-rmm-smtp-password-default",
  smtpFrom:     process.env.SMTP_FROM     ?? '"OG-RMM Platform" <og-rmm-notifications@example.com>',
  emailDefaultRecipient: process.env.EMAIL_DEFAULT_RECIPIENT ?? "operations@example.com",
  alertEmailRecipients: process.env.ALERT_EMAIL_RECIPIENTS ?? "ops-team@og-rmm.local",

  // ─── Kafka / Redpanda ─────────────────────────────────────────────────────
  kafkaBrokers:   (process.env.KAFKA_BROKERS ?? "localhost:19092").split(","),
  kafkaClientId:  process.env.KAFKA_CLIENT_ID ?? "og-rmm-server",
  kafkaGroupId:   process.env.KAFKA_GROUP_ID  ?? "og-rmm-consumers",

  // ─── Grafana ──────────────────────────────────────────────────────────────
  grafanaUrl:      process.env.GRAFANA_URL       ?? "http://localhost:3001",
  grafanaUser:     process.env.GRAFANA_USER      ?? "admin",
  grafanaPassword: process.env.GRAFANA_PASSWORD  ?? "og-rmm-grafana-admin",
  grafanaOrgId:    parseInt(process.env.GRAFANA_ORG_ID ?? "1"),

  // ─── InfluxDB Time-Series Telemetry ───────────────────────────────────────
  influxdbUrl:    process.env.INFLUXDB_URL    ?? "http://localhost:8086",
  influxdbToken:  process.env.INFLUXDB_TOKEN  ?? "og-rmm-influxdb-token-default",
  influxdbOrg:    process.env.INFLUXDB_ORG    ?? "og-rmm",
  influxdbBucket: process.env.INFLUXDB_BUCKET ?? "og-telemetry",

  // ─── Redis Cache & Pub/Sub ────────────────────────────────────────────────
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",

  // ─── Temporal Workflow Orchestration ─────────────────────────────────────
  temporalAddress:   process.env.TEMPORAL_ADDRESS   ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "og-rmm",

  // ─── Modbus / Field Protocols ─────────────────────────────────────────────
  // SIMULATION_FALLBACK=true means the Rust edge agent generates synthetic data.
  // Set to false and configure MODBUS_TCP_HOST per well to use real PLCs.
  modbusSimulationFallback: (process.env.SIMULATION_FALLBACK ?? "true") === "true",
  modbusTcpHost:   process.env.MODBUS_TCP_HOST   ?? "192.168.1.100",
  modbusTcpPort:   parseInt(process.env.MODBUS_TCP_PORT ?? "502"),
  modbusUnitId:    parseInt(process.env.MODBUS_UNIT_ID  ?? "1"),
  opcuaEndpoint:   process.env.OPCUA_ENDPOINT    ?? "opc.tcp://localhost:4840",
  dnp3MasterAddr:  parseInt(process.env.DNP3_MASTER_ADDR ?? "1"),
  dnp3OutstationAddr: parseInt(process.env.DNP3_OUTSTATION_ADDR ?? "10"),
  mqttBrokerUrl:   process.env.MQTT_BROKER_URL   ?? "mqtt://localhost:1883",

  // ─── Firebase Push Notifications ─────────────────────────────────────────
  firebaseProjectId:    process.env.FIREBASE_PROJECT_ID    ?? "og-rmm-platform",
  firebaseClientEmail:  process.env.FIREBASE_CLIENT_EMAIL  ?? "firebase-adminsdk@og-rmm-platform.iam.gserviceaccount.com",
  firebasePrivateKey:   process.env.FIREBASE_PRIVATE_KEY   ?? "",
  fcmServerKey:         process.env.FCM_SERVER_KEY          ?? "",

  // ─── OpenCTI Threat Intelligence ─────────────────────────────────────────
  openCtiUrl:   process.env.OPENCTI_URL   ?? "http://localhost:8080",
  openCtiToken: process.env.OPENCTI_TOKEN ?? "og-rmm-opencti-token-default",

  // ─── Grafana OnCall ───────────────────────────────────────────────────────
  grafanaOnCallUrl:   process.env.GRAFANA_ONCALL_URL   ?? "http://localhost:8080/integrations/v1/webhook/default",
  grafanaOnCallToken: process.env.GRAFANA_ONCALL_TOKEN ?? "og-rmm-oncall-token-default",

  // ─── SAP S/4HANA ERP ─────────────────────────────────────────────────────
  sapBaseUrl:  process.env.SAP_BASE_URL  ?? "https://sap-mock.og-rmm.internal",
  sapUsername: process.env.SAP_USERNAME  ?? "og_rmm_svc",
  sapPassword: process.env.SAP_PASSWORD  ?? "og-rmm-sap-password-default",

  // ─── Oracle ERP Cloud ─────────────────────────────────────────────────────
  oracleBaseUrl:      process.env.ORACLE_BASE_URL      ?? "https://oracle-mock.og-rmm.internal",
  oracleClientId:     process.env.ORACLE_CLIENT_ID     ?? "og-rmm-oracle-client",
  oracleClientSecret: process.env.ORACLE_CLIENT_SECRET ?? "og-rmm-oracle-secret-default",

  // ─── TigerBeetle Financial Ledger ─────────────────────────────────────────
  tigerBeetleAddress: process.env.TIGERBEETLE_ADDRESS ?? "localhost:3000",

  // ─── EMQX MQTT Broker ────────────────────────────────────────────────────
  emqxUrl:    process.env.EMQX_URL     ?? "mqtt://localhost:1883",
  emqxApiUrl: process.env.EMQX_API_URL ?? "http://localhost:18083",
  emqxApiKey: process.env.EMQX_API_KEY ?? "og-rmm-emqx-key-default",

  // ─── TDengine Secondary TSDB ──────────────────────────────────────────────
  tdengineUrl: process.env.TDENGINE_URL ?? "http://localhost:6041",

  // ─── OpenSearch Log Aggregation ───────────────────────────────────────────
  openSearchUrl:      process.env.OPENSEARCH_URL      ?? "http://localhost:9200",
  openSearchUser:     process.env.OPENSEARCH_USER     ?? "admin",
  openSearchPassword: process.env.OPENSEARCH_PASSWORD ?? "og-rmm-opensearch-default",

  // ─── EdgeX Foundry ────────────────────────────────────────────────────────
  edgexCoreDataUrl:     process.env.EDGEX_CORE_DATA_URL     ?? "http://localhost:59880",
  edgexCoreMetadataUrl: process.env.EDGEX_CORE_METADATA_URL ?? "http://localhost:59881",

  // ─── Fluvio Streaming ─────────────────────────────────────────────────────
  fluvioDualPublish: (process.env.FLUVIO_DUAL_PUBLISH ?? "true") === "true",
  fluvioEndpoint:    process.env.FLUVIO_ENDPOINT    ?? "localhost:9003",
  fluvioAdminUrl:    process.env.FLUVIO_ADMIN_URL   ?? "http://localhost:9004",

  // ─── Aveva PI System ──────────────────────────────────────────────────────
  piWebApiUrl:  process.env.PI_WEB_API_URL  ?? "https://pi-server.og-rmm.internal/piwebapi",
  piUsername:   process.env.PI_USERNAME     ?? "og_rmm_readonly",
  piPassword:   process.env.PI_PASSWORD     ?? "og-rmm-pi-password-default",

  // ─── OSDU (Open Subsurface Data Universe) ─────────────────────────────────
  osduBaseUrl:    process.env.OSDU_BASE_URL    ?? "https://osdu.og-rmm.internal",
  osduClientId:   process.env.OSDU_CLIENT_ID   ?? "og-rmm-osdu-client",
  osduClientSecret: process.env.OSDU_CLIENT_SECRET ?? "og-rmm-osdu-secret-default",
  osduDataPartition: process.env.OSDU_DATA_PARTITION ?? "og-rmm-partition",

  // ─── Twilio SMS (alarm escalation) ────────────────────────────────────────
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "AC-og-rmm-twilio-default",
  twilioAuthToken:  process.env.TWILIO_AUTH_TOKEN  ?? "og-rmm-twilio-token-default",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "+15550000000",

  // ─── Multi-Tenant Field Isolation ─────────────────────────────────────────
  // When enabled, all DB queries are scoped to ctx.user.fieldId
  multiTenantEnabled: (process.env.MULTI_TENANT_ENABLED ?? "false") === "true",
  defaultFieldId:     process.env.DEFAULT_FIELD_ID ?? "field-001",

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  rateLimitWindowMs:    parseInt(process.env.RATE_LIMIT_WINDOW_MS    ?? "60000"),
  rateLimitMaxOperator: parseInt(process.env.RATE_LIMIT_MAX_OPERATOR ?? "1000"),
  rateLimitMaxAdmin:    parseInt(process.env.RATE_LIMIT_MAX_ADMIN    ?? "5000"),
};
