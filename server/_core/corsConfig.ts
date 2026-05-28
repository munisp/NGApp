/**
 * CORS configuration for the OG-RMM platform.
 * Production: explicit allowlist. Development: permissive.
 */
import cors from "cors";

const PRODUCTION_ORIGINS = [
  process.env.APP_ORIGIN,
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

const isDev = process.env.NODE_ENV !== "production";

export const corsOptions: cors.CorsOptions = {
  origin: isDev
    ? true // Allow all origins in development
    : (origin, callback) => {
        if (!origin || PRODUCTION_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-request-id",
    "x-idempotency-key",
    "x-api-version",
  ],
  exposedHeaders: ["x-request-id"],
  maxAge: 86400, // 24 hours preflight cache
};

export const corsMiddleware = cors(corsOptions);
