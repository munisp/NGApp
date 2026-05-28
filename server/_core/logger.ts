/**
 * Structured logger for the OG-RMM platform.
 * Uses Pino for JSON-structured logging with request correlation.
 */
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino/file", options: { destination: 1 } }
      : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: pino.stdSerializers,
  base: {
    service: "og-rmm-server",
    version: "v56.0",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
export default logger;
