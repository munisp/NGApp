/**
 * 54Link Structured Logger
 * Uses pino for JSON-structured logging with request ID correlation.
 * Log level is controlled by LOG_LEVEL env var (default: info in prod, debug in dev).
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        // Production: plain JSON for Promtail/Loki ingestion
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: {
          service: "pos-shell-demo",
          env: process.env.NODE_ENV ?? "production",
        },
      }),
});

/**
 * Create a child logger with a fixed request ID for per-request correlation.
 * Usage: const reqLogger = childLogger(requestId);
 */
export function childLogger(requestId: string) {
  return logger.child({ requestId });
}

/**
 * Log a structured audit event (always at INFO level regardless of LOG_LEVEL).
 */
export function auditLog(event: {
  actor: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}) {
  logger.info({ audit: true, ...event }, `AUDIT: ${event.actor} → ${event.action} on ${event.resource}`);
}

export default logger;
