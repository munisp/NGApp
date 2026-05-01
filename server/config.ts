/**
 * NDSEP Production Configuration
 * Validates all required environment variables at startup.
 * Throws immediately if any required variable is missing.
 */
import { z } from "zod";
import { logger } from "./logger";

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Database
  DATABASE_URL: z.string().url().optional(), // Manus-injected (TiDB/MySQL)

  // Auth
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  VITE_APP_ID: z.string().min(1),
  OAUTH_SERVER_URL: z.string().url(),
  VITE_OAUTH_PORTAL_URL: z.string().url(),
  OWNER_OPEN_ID: z.string().optional(),
  OWNER_NAME: z.string().optional(),

  // Manus built-in APIs
  BUILT_IN_FORGE_API_URL: z.string().url().optional(),
  BUILT_IN_FORGE_API_KEY: z.string().optional(),
  VITE_FRONTEND_FORGE_API_KEY: z.string().optional(),
  VITE_FRONTEND_FORGE_API_URL: z.string().url().optional(),

  // Analytics
  VITE_ANALYTICS_ENDPOINT: z.string().url().optional(),
  VITE_ANALYTICS_WEBSITE_ID: z.string().optional(),

  // Optional: middleware services
  REDIS_URL: z.string().optional().default("redis://localhost:6379"),
  DAPR_HTTP_PORT: z.coerce.number().default(3500),
  KAFKA_BROKERS: z.string().optional().default("localhost:9092"),
  TEMPORAL_ADDRESS: z.string().optional().default("localhost:7233"),
  KEYCLOAK_URL: z.string().url().optional().default("http://localhost:8080"),
  PERMIFY_URL: z.string().url().optional().default("http://localhost:3476"),
  APISIX_ADMIN_URL: z.string().url().optional().default("http://localhost:9180"),
  TIGERBEETLE_URL: z.string().url().optional().default("http://localhost:3000"),
  ICEBERG_REST_URL: z.string().url().optional().default("http://localhost:8181"),
  FLUVIO_URL: z.string().url().optional().default("http://localhost:9003"),

  // Local PostgreSQL (NDSEP primary DB)
  NDSEP_DB_URL: z
    .string()
    .optional()
    .default("postgresql://ndsep_user:changeme@127.0.0.1:5432/ndsep_db"),
  NDSEP_DB_POOL_MIN: z.coerce.number().int().min(1).default(2),
  NDSEP_DB_POOL_MAX: z.coerce.number().int().min(2).default(20),
  NDSEP_DB_IDLE_TIMEOUT_MS: z.coerce.number().int().default(30000),
  NDSEP_DB_CONN_TIMEOUT_MS: z.coerce.number().int().default(5000),

  // Billing / DPCO scheduler
  INVOICE_OVERDUE_INTERVAL_MS: z.coerce.number().int().min(60000).default(24 * 60 * 60 * 1000), // 24h default
  DPCO_PLATFORM_FEE_STARTER: z.coerce.number().min(0).max(1).default(0.12),
  DPCO_PLATFORM_FEE_PROFESSIONAL: z.coerce.number().min(0).max(1).default(0.10),
  DPCO_PLATFORM_FEE_ENTERPRISE: z.coerce.number().min(0).max(1).default(0.08),
  DPCO_VAT_RATE: z.coerce.number().min(0).max(1).default(0.075), // 7.5% Nigeria VAT
  DPCO_CURRENCY: z.string().default("NGN"),
  // Security
  CORS_ORIGINS: z.string().optional().default("*"),
  TRUSTED_PROXIES: z.coerce.number().int().min(0).default(1),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    logger.error({ errors }, "❌ Environment validation failed — aborting startup");
    process.exit(1);
  }

  _config = result.data;
  logger.info(
    {
      NODE_ENV: _config.NODE_ENV,
      PORT: _config.PORT,
      LOG_LEVEL: _config.LOG_LEVEL,
    },
    "✅ Environment validated"
  );
  return _config;
}

export default getConfig;
