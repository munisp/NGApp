/**
 * Sentry error monitoring initialization.
 * Only active if SENTRY_DSN environment variable is set.
 */
import * as Sentry from "@sentry/node";
import logger from "./logger";

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info("Sentry DSN not configured — error monitoring disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: `og-rmm@${process.env.APP_VERSION ?? "56.0.0"}`,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // Strip sensitive data from error reports
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  initialized = true;
  logger.info("Sentry error monitoring initialized");
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

export function getSentryErrorHandler(): import("express").ErrorRequestHandler {
  if (!initialized) {
    return (_err, _req, _res, next) => next(_err);
  }
  return Sentry.expressErrorHandler() as unknown as import("express").ErrorRequestHandler;
}
