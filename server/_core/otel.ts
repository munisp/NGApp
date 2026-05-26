/**
 * OpenTelemetry instrumentation for the OG-RMM TypeScript server.
 * Must be imported before any other module for auto-instrumentation to work.
 *
 * Configure with environment variables:
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP gRPC endpoint (default: http://localhost:4317)
 *   OTEL_SERVICE_NAME           — service name (default: og-rmm-server)
 *   OTEL_TRACES_SAMPLER_ARG     — sampling rate 0.0-1.0 (default: 0.1)
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import logger from "./logger";

const OTEL_ENABLED = process.env.OTEL_ENABLED === "true";

let sdk: NodeSDK | undefined;

export function initOtel(): void {
  if (!OTEL_ENABLED) {
    logger.info("OpenTelemetry disabled (set OTEL_ENABLED=true to enable)");
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4317";

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "og-rmm-server",
      [ATTR_SERVICE_VERSION]: "56.0.0",
    }),
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false }, // Noisy
        "@opentelemetry/instrumentation-express": { enabled: true },
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-pg": { enabled: true },
        "@opentelemetry/instrumentation-ioredis": { enabled: true },
      }),
    ],
  });

  sdk.start();
  logger.info({ endpoint }, "OpenTelemetry initialized");
}

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info("OpenTelemetry shut down");
  }
}
