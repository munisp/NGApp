/**
 * OG-RMM Platform — Production Constants & Defaults
 *
 * All service URLs, IDs, secrets, and configuration constants are defined here.
 * In production, override via environment variables. These defaults allow
 * the platform to run in a local/dev environment without any configuration.
 *
 * @version 44.0
 */

// ── Service URLs ─────────────────────────────────────────────────────────────

export const SERVICES = {
  // Core platform
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:3000",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",

  // Go microservices
  TELEMETRY_SERVICE_URL: process.env.TELEMETRY_SERVICE_URL ?? "http://localhost:8081",
  HISTORIAN_SERVICE_URL: process.env.HISTORIAN_SERVICE_URL ?? "http://localhost:8082",
  WORKFLOW_ENGINE_URL: process.env.WORKFLOW_ENGINE_URL ?? "http://localhost:8083",
  ERP_CONNECTOR_URL: process.env.ERP_CONNECTOR_URL ?? "http://localhost:8084",
  EDGEX_SERVICE_URL: process.env.EDGEX_SERVICE_URL ?? "http://localhost:8085",
  DIGITAL_TWIN_SERVICE_URL: process.env.DIGITAL_TWIN_SERVICE_URL ?? "http://localhost:8086",
  PHYSICS_ENGINE_URL: process.env.PHYSICS_ENGINE_URL ?? "http://localhost:8087",
  SCADA_GATEWAY_URL: process.env.SCADA_GATEWAY_URL ?? "http://localhost:8088",

  // Python ML/Analytics services
  ML_SERVICE_URL: process.env.ML_SERVICE_URL ?? "http://localhost:8090",
  ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL ?? "http://localhost:8091",
  PINN_SERVICE_URL: process.env.PINN_SERVICE_URL ?? "http://localhost:8092",
  FEDERATED_LEARNING_URL: process.env.FEDERATED_LEARNING_URL ?? "http://localhost:8093",

  // Middleware
  KAFKA_BROKERS: process.env.KAFKA_BROKERS ?? "localhost:9092",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  DAPR_HTTP_PORT: parseInt(process.env.DAPR_HTTP_PORT ?? "3500", 10),
  DAPR_GRPC_PORT: parseInt(process.env.DAPR_GRPC_PORT ?? "50001", 10),

  // Time-series databases
  QUESTDB_URL: process.env.QUESTDB_URL ?? "http://localhost:9000",
  QUESTDB_PG_URL: process.env.QUESTDB_PG_URL ?? "postgresql://admin:quest@localhost:8812/qdb",
  TIMESCALEDB_URL: process.env.TIMESCALEDB_URL ?? "postgresql://postgres:password@localhost:5432/timescaledb",
  INFLUXDB_URL: process.env.INFLUXDB_URL ?? "http://localhost:8086",
  INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN ?? "og-rmm-dev-token-00000000000000000000000000000000",
  INFLUXDB_ORG: process.env.INFLUXDB_ORG ?? "og-rmm",
  INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET ?? "telemetry",

  // Object storage
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "https://s3.amazonaws.com",
  S3_BUCKET: process.env.S3_BUCKET ?? "og-rmm-platform",
  S3_REGION: process.env.S3_REGION ?? "us-east-1",

  // AI/ML
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "qwen2.5vl:7b",
  OLLAMA_TIMEOUT_MS: parseInt(process.env.OLLAMA_TIMEOUT ?? "120000", 10),

  // API Gateway
  APISIX_ADMIN_URL: process.env.APISIX_ADMIN_URL ?? "http://localhost:9180",
  APISIX_ADMIN_KEY: process.env.APISIX_ADMIN_KEY ?? "og-rmm-apisix-admin-key-00000000000000",

  // Identity & Authorization
  KEYCLOAK_URL: process.env.KEYCLOAK_URL ?? "http://localhost:8080",
  KEYCLOAK_REALM: process.env.KEYCLOAK_REALM ?? "og-rmm",
  KEYCLOAK_CLIENT_ID: process.env.KEYCLOAK_CLIENT_ID ?? "og-rmm-platform",
  PERMIFY_URL: process.env.PERMIFY_URL ?? "http://localhost:3478",
  PERMIFY_TENANT_ID: process.env.PERMIFY_TENANT_ID ?? "og-rmm-default",

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317",
  JAEGER_URL: process.env.JAEGER_URL ?? "http://localhost:16686",
  PROMETHEUS_URL: process.env.PROMETHEUS_URL ?? "http://localhost:9090",
  GRAFANA_URL: process.env.GRAFANA_URL ?? "http://localhost:3001",
  GRAFANA_API_KEY: process.env.GRAFANA_API_KEY ?? "og-rmm-grafana-api-key-000000000000000",

  // External integrations
  OSDU_BASE_URL: process.env.OSDU_BASE_URL ?? "https://osdu.energy.azure.com",
  OSDU_DATA_PARTITION: process.env.OSDU_DATA_PARTITION ?? "og-rmm-dev",
  OSDU_CLIENT_ID: process.env.OSDU_CLIENT_ID ?? "og-rmm-osdu-client-id",
  OSDU_CLIENT_SECRET: process.env.OSDU_CLIENT_SECRET ?? "og-rmm-osdu-client-secret-dev",

  WITSML_SERVER_URL: process.env.WITSML_SERVER_URL ?? "http://localhost:8181/WMLS",
  WITSML_USERNAME: process.env.WITSML_USERNAME ?? "witsml-admin",
  WITSML_PASSWORD: process.env.WITSML_PASSWORD ?? "witsml-dev-password",

  OPCUA_SERVER_URL: process.env.OPCUA_SERVER_URL ?? "opc.tcp://localhost:4840",
  OPCUA_NAMESPACE: process.env.OPCUA_NAMESPACE ?? "urn:og-rmm:opcua",

  SAP_BASE_URL: process.env.SAP_BASE_URL ?? "http://localhost:8000/sap/opu/odata",
  SAP_CLIENT: process.env.SAP_CLIENT ?? "100",
  SAP_USERNAME: process.env.SAP_USERNAME ?? "SAPUSER",
  SAP_PASSWORD: process.env.SAP_PASSWORD ?? "sap-dev-password",

  MAXIMO_BASE_URL: process.env.MAXIMO_BASE_URL ?? "http://localhost:9080/maximo/oslc",
  MAXIMO_API_KEY: process.env.MAXIMO_API_KEY ?? "og-rmm-maximo-api-key-000000000000000",

  PI_SERVER_URL: process.env.PI_SERVER_URL ?? "https://pi-server.og-rmm.local",
  PI_USERNAME: process.env.PI_USERNAME ?? "pi-admin",
  PI_PASSWORD: process.env.PI_PASSWORD ?? "pi-dev-password",

  // Payment providers
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID ?? "AZDxjDScFpQtjWTOUtWKbyN_bDt4OgqaF4eYXlewfBP4-8aqIcE",
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET ?? "EGnHDxD_qRPbzbTAqySussegg0LDQ3BW_1fInYyD9sZtf1zXT0",
  PAYPAL_MODE: (process.env.PAYPAL_MODE ?? "sandbox") as "sandbox" | "live",
  PAYPAL_BASE_URL: process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com",

  BANK_TRANSFER_ACCOUNT_NAME: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "OG-RMM Platform Ltd",
  BANK_TRANSFER_ACCOUNT_NUMBER: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "0000000000",
  BANK_TRANSFER_ROUTING_NUMBER: process.env.BANK_TRANSFER_ROUTING_NUMBER ?? "000000000",
  BANK_TRANSFER_SWIFT: process.env.BANK_TRANSFER_SWIFT ?? "OGRMMUSBXXX",
  BANK_TRANSFER_IBAN: process.env.BANK_TRANSFER_IBAN ?? "GB00OGRMM00000000000000",

  // Notifications
  SMTP_HOST: process.env.SMTP_HOST ?? "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? "587", 10),
  SMTP_USER: process.env.SMTP_USER ?? "noreply@og-rmm.com",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? "OG-RMM Platform <noreply@og-rmm.com>",

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "ACog-rmm-dev-sid-000000000000000000",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "og-rmm-twilio-auth-token-00000000",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "+15005550006",

  PAGERDUTY_API_KEY: process.env.PAGERDUTY_API_KEY ?? "og-rmm-pagerduty-api-key-00000000",
  PAGERDUTY_SERVICE_ID: process.env.PAGERDUTY_SERVICE_ID ?? "P000000",
} as const;

// ── Platform Identifiers ──────────────────────────────────────────────────────

export const PLATFORM = {
  NAME: "OG-RMM Platform",
  VERSION: "44.0.0",
  DESCRIPTION: "Oil & Gas Remote Monitoring & Management Platform",
  VENDOR: "OG-RMM Technologies",
  SUPPORT_EMAIL: "support@og-rmm.com",
  DOCS_URL: "https://docs.og-rmm.com",
  STATUS_PAGE_URL: "https://status.og-rmm.com",
  PRIVACY_POLICY_URL: "https://og-rmm.com/privacy",
  TERMS_URL: "https://og-rmm.com/terms",
} as const;

// ── Rate Limits ───────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  API_REQUESTS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_API ?? "200", 10),
  AUTH_REQUESTS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_AUTH ?? "20", 10),
  TELEMETRY_INGEST_PER_SECOND: parseInt(process.env.RATE_LIMIT_TELEMETRY ?? "10000", 10),
  FILE_UPLOAD_PER_MINUTE: parseInt(process.env.RATE_LIMIT_UPLOAD ?? "10", 10),
  AI_REQUESTS_PER_MINUTE: parseInt(process.env.RATE_LIMIT_AI ?? "30", 10),
} as const;

// ── Timeouts (ms) ─────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  HTTP_REQUEST: parseInt(process.env.TIMEOUT_HTTP ?? "30000", 10),
  DB_QUERY: parseInt(process.env.TIMEOUT_DB ?? "10000", 10),
  AI_INFERENCE: parseInt(process.env.TIMEOUT_AI ?? "120000", 10),
  FILE_UPLOAD: parseInt(process.env.TIMEOUT_UPLOAD ?? "60000", 10),
  WEBSOCKET_PING: parseInt(process.env.TIMEOUT_WS_PING ?? "30000", 10),
  GRACEFUL_SHUTDOWN: parseInt(process.env.TIMEOUT_SHUTDOWN ?? "30000", 10),
} as const;

// ── Pagination Defaults ───────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500,
  DEFAULT_TELEMETRY_LIMIT: 1000,
  MAX_TELEMETRY_LIMIT: 100000,
} as const;

// ── Feature Flags ─────────────────────────────────────────────────────────────

export const FEATURES = {
  ENABLE_AI_COPILOT: process.env.FEATURE_AI_COPILOT !== "false",
  ENABLE_DIGITAL_TWIN: process.env.FEATURE_DIGITAL_TWIN !== "false",
  ENABLE_DRONE_AI: process.env.FEATURE_DRONE_AI !== "false",
  ENABLE_FEDERATED_LEARNING: process.env.FEATURE_FEDERATED_LEARNING !== "false",
  ENABLE_PIXEL_STREAMING: process.env.FEATURE_PIXEL_STREAMING === "true",
  ENABLE_MULTI_TENANT: process.env.FEATURE_MULTI_TENANT !== "false",
  ENABLE_SAAS_BILLING: process.env.FEATURE_SAAS_BILLING !== "false",
  ENABLE_MARKETPLACE: process.env.FEATURE_MARKETPLACE !== "false",
  ENABLE_OSDU: process.env.FEATURE_OSDU !== "false",
  ENABLE_WITSML: process.env.FEATURE_WITSML !== "false",
  ENABLE_OPCUA: process.env.FEATURE_OPCUA !== "false",
  ENABLE_SAP_INTEGRATION: process.env.FEATURE_SAP === "true",
  ENABLE_MAXIMO_INTEGRATION: process.env.FEATURE_MAXIMO === "true",
  ENABLE_PAGERDUTY: process.env.FEATURE_PAGERDUTY === "true",
  ENABLE_SMS_ALERTS: process.env.FEATURE_SMS === "true",
  ENABLE_PWA_OFFLINE: process.env.FEATURE_PWA_OFFLINE !== "false",
  ENABLE_DARK_MODE: process.env.FEATURE_DARK_MODE !== "false",
  ENABLE_I18N: process.env.FEATURE_I18N !== "false",
  MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === "true",
} as const;

// ── Retention Policies ────────────────────────────────────────────────────────

export const RETENTION = {
  TELEMETRY_RAW_DAYS: parseInt(process.env.RETENTION_TELEMETRY_RAW ?? "90", 10),
  TELEMETRY_HOURLY_DAYS: parseInt(process.env.RETENTION_TELEMETRY_HOURLY ?? "365", 10),
  TELEMETRY_DAILY_YEARS: parseInt(process.env.RETENTION_TELEMETRY_DAILY ?? "10", 10),
  AUDIT_LOG_YEARS: parseInt(process.env.RETENTION_AUDIT ?? "7", 10),
  ALARM_HISTORY_YEARS: parseInt(process.env.RETENTION_ALARMS ?? "5", 10),
  DRONE_MEDIA_YEARS: parseInt(process.env.RETENTION_DRONE_MEDIA ?? "10", 10),
  EMISSION_RECORDS_YEARS: parseInt(process.env.RETENTION_EMISSIONS ?? "10", 10),
} as const;

// ── SaaS Plan Definitions ─────────────────────────────────────────────────────

export const SAAS_PLANS = {
  STARTER: {
    id: "starter",
    name: "Starter",
    description: "For small operators with up to 10 wells",
    priceMonthly: 299,
    priceAnnual: 2990,
    currency: "USD",
    maxWells: 10,
    maxUsers: 5,
    maxTelemetryPointsPerDay: 100_000,
    features: ["telemetry", "alarms", "basic_reports", "mobile_app"],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "price_starter_monthly",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? "price_starter_annual",
  },
  PROFESSIONAL: {
    id: "professional",
    name: "Professional",
    description: "For mid-size operators with up to 50 wells",
    priceMonthly: 999,
    priceAnnual: 9990,
    currency: "USD",
    maxWells: 50,
    maxUsers: 25,
    maxTelemetryPointsPerDay: 1_000_000,
    features: ["telemetry", "alarms", "advanced_reports", "mobile_app", "ai_copilot", "digital_twin", "historian", "regulatory"],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "price_professional_monthly",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "price_professional_annual",
  },
  ENTERPRISE: {
    id: "enterprise",
    name: "Enterprise",
    description: "For large operators with unlimited wells",
    priceMonthly: 4999,
    priceAnnual: 49990,
    currency: "USD",
    maxWells: -1, // unlimited
    maxUsers: -1, // unlimited
    maxTelemetryPointsPerDay: -1, // unlimited
    features: ["all"],
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? "price_enterprise_monthly",
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL ?? "price_enterprise_annual",
  },
} as const;

// ── OPC-UA Node IDs ───────────────────────────────────────────────────────────

export const OPCUA_NODES = {
  WELLHEAD_PRESSURE: "ns=2;s=WellheadPressure",
  WELLHEAD_TEMPERATURE: "ns=2;s=WellheadTemperature",
  FLOW_RATE: "ns=2;s=FlowRate",
  GAS_LIFT_PRESSURE: "ns=2;s=GasLiftPressure",
  CHOKE_POSITION: "ns=2;s=ChokePosition",
  SEPARATOR_PRESSURE: "ns=2;s=SeparatorPressure",
  SEPARATOR_LEVEL: "ns=2;s=SeparatorLevel",
  PUMP_SPEED: "ns=2;s=PumpSpeed",
  PUMP_CURRENT: "ns=2;s=PumpCurrent",
  COMPRESSOR_SPEED: "ns=2;s=CompressorSpeed",
} as const;

// ── WITSML Defaults ───────────────────────────────────────────────────────────

export const WITSML = {
  VERSION: "2.0",
  NAMESPACE: "http://www.energistics.org/energyml/data/witsml/v2.0",
  MAX_RETURN_NODES: 1000,
  DEFAULT_TIMEOUT_MS: 30_000,
} as const;

// ── Emission Factors (EPA AP-42) ──────────────────────────────────────────────

export const EMISSION_FACTORS = {
  // kg CO2 per unit
  NATURAL_GAS_COMBUSTION_KG_PER_MMBTU: 53.06,
  DIESEL_COMBUSTION_KG_PER_GALLON: 10.21,
  GASOLINE_COMBUSTION_KG_PER_GALLON: 8.78,
  CRUDE_OIL_COMBUSTION_KG_PER_BARREL: 0.43,
  // Global Warming Potential (100-year, AR6)
  GWP_CH4: 27.9,
  GWP_N2O: 273,
  GWP_HFC134A: 1530,
  GWP_SF6: 25200,
} as const;

// ── API Versioning ────────────────────────────────────────────────────────────

export const API_VERSIONS = {
  CURRENT: "v3",
  SUPPORTED: ["v1", "v2", "v3"] as const,
  DEPRECATED: ["v1"] as const,
  SUNSET_DATE_V1: "2026-12-31",
  SUNSET_DATE_V2: "2027-12-31",
} as const;

// ── Security ──────────────────────────────────────────────────────────────────

export const SECURITY = {
  JWT_EXPIRY_SECONDS: parseInt(process.env.JWT_EXPIRY ?? "86400", 10),
  REFRESH_TOKEN_EXPIRY_DAYS: parseInt(process.env.REFRESH_TOKEN_EXPIRY ?? "30", 10),
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? "5", 10),
  LOCKOUT_DURATION_MINUTES: parseInt(process.env.LOCKOUT_DURATION ?? "15", 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(","),
  ALLOWED_FILE_TYPES: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "video/mp4"],
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB ?? "16", 10),
} as const;

// ── Telemetry Thresholds ──────────────────────────────────────────────────────

export const TELEMETRY_THRESHOLDS = {
  WELLHEAD_PRESSURE_HIGH_PSI: 5000,
  WELLHEAD_PRESSURE_CRITICAL_PSI: 6000,
  WELLHEAD_TEMPERATURE_HIGH_F: 250,
  WELLHEAD_TEMPERATURE_CRITICAL_F: 300,
  FLOW_RATE_LOW_BOPD: 10,
  GAS_OIL_RATIO_HIGH: 10000,
  WATER_CUT_HIGH_PCT: 95,
  H2S_ALARM_PPM: 10,
  H2S_CRITICAL_PPM: 50,
  CO_ALARM_PPM: 35,
  CO_CRITICAL_PPM: 200,
  LEL_ALARM_PCT: 10,
  LEL_CRITICAL_PCT: 25,
} as const;

export default {
  SERVICES,
  PLATFORM,
  RATE_LIMITS,
  TIMEOUTS,
  PAGINATION,
  FEATURES,
  RETENTION,
  SAAS_PLANS,
  OPCUA_NODES,
  WITSML,
  EMISSION_FACTORS,
  API_VERSIONS,
  SECURITY,
  TELEMETRY_THRESHOLDS,
};
