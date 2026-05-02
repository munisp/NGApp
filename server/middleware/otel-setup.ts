/**
 * OpenTelemetry Setup for TypeScript API Server
 * 
 * Initializes tracing and metrics with OTLP export.
 * Must be imported before any other module to ensure instrumentation hooks.
 */

import crypto from 'crypto';

// Configuration
const OTEL_CONFIG = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'payment-switch-api',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '2.0.0',
  environment: process.env.NODE_ENV || 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  samplingRatio: parseFloat(process.env.OTEL_SAMPLING_RATIO || '0.1'),
  batchTimeout: parseInt(process.env.OTEL_BATCH_TIMEOUT || '5000'),
  maxExportBatchSize: parseInt(process.env.OTEL_MAX_BATCH_SIZE || '512'),
};

// Trace context type
interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  status: 'OK' | 'ERROR' | 'UNSET';
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestampMs: number; attributes?: Record<string, string | number | boolean> }>;
}

// Span buffer for batch export
const spanBuffer: TraceSpan[] = [];
const MAX_BUFFER_SIZE = OTEL_CONFIG.maxExportBatchSize * 4;
let flushTimer: ReturnType<typeof setInterval> | null = null;

// Payment-specific span attributes
export interface PaymentSpanAttributes {
  'payment.id'?: string;
  'payment.amount'?: number;
  'payment.currency'?: string;
  'payment.method'?: string;
  'payment.status'?: string;
  'payment.sender_id'?: string;
  'payment.recipient_id'?: string;
  'payment.corridor'?: string;
  'payment.fx_rate'?: number;
  'payment.fee_amount'?: number;
  'payment.operation'?: string;
}

// Histogram buckets for payment latency (in ms)
const PAYMENT_LATENCY_BUCKETS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000];

// Metrics counters
export const metrics = {
  transactionsTotal: 0,
  transactionsSuccess: 0,
  transactionsFailed: 0,
  latencyHistogram: new Map<number, number>(),
  activeSpans: 0,
  droppedSpans: 0,
  exportedSpans: 0,
};

/**
 * Generate a W3C-compliant trace ID (32 hex chars)
 */
function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a span ID (16 hex chars)
 */
function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Start a new trace span
 */
export function startSpan(
  operationName: string,
  parentSpan?: TraceSpan,
  attributes?: PaymentSpanAttributes & Record<string, string | number | boolean>
): TraceSpan {
  const span: TraceSpan = {
    traceId: parentSpan?.traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parentSpan?.spanId,
    operationName,
    serviceName: OTEL_CONFIG.serviceName,
    startTimeMs: performance.now(),
    status: 'UNSET',
    attributes: {
      'service.name': OTEL_CONFIG.serviceName,
      'service.version': OTEL_CONFIG.serviceVersion,
      'deployment.environment': OTEL_CONFIG.environment,
      ...attributes,
    },
    events: [],
  };

  metrics.activeSpans++;
  return span;
}

/**
 * End a span and queue for export
 */
export function endSpan(span: TraceSpan, status: 'OK' | 'ERROR' = 'OK'): void {
  span.endTimeMs = performance.now();
  span.durationMs = span.endTimeMs - span.startTimeMs;
  span.status = status;
  metrics.activeSpans--;

  // Record in latency histogram
  const bucket = PAYMENT_LATENCY_BUCKETS.find(b => span.durationMs! <= b) || Infinity;
  metrics.latencyHistogram.set(bucket, (metrics.latencyHistogram.get(bucket) || 0) + 1);

  // Add to buffer
  if (spanBuffer.length >= MAX_BUFFER_SIZE) {
    metrics.droppedSpans++;
    spanBuffer.shift(); // Drop oldest
  }
  spanBuffer.push(span);

  // Update transaction counters
  if (span.attributes['payment.operation']) {
    metrics.transactionsTotal++;
    if (status === 'OK') metrics.transactionsSuccess++;
    else metrics.transactionsFailed++;
  }
}

/**
 * Add an event to a span
 */
export function addEvent(
  span: TraceSpan,
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  span.events.push({
    name,
    timestampMs: performance.now(),
    attributes,
  });
}

/**
 * Flush spans to OTLP collector
 */
async function flushSpans(): Promise<void> {
  if (spanBuffer.length === 0) return;

  const batch = spanBuffer.splice(0, OTEL_CONFIG.maxExportBatchSize);

  try {
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: OTEL_CONFIG.serviceName } },
            { key: 'service.version', value: { stringValue: OTEL_CONFIG.serviceVersion } },
            { key: 'deployment.environment', value: { stringValue: OTEL_CONFIG.environment } },
          ],
        },
        scopeSpans: [{
          scope: { name: OTEL_CONFIG.serviceName, version: OTEL_CONFIG.serviceVersion },
          spans: batch.map(span => ({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId || '',
            name: span.operationName,
            kind: 2, // SPAN_KIND_SERVER
            startTimeUnixNano: BigInt(Math.floor(span.startTimeMs * 1_000_000)).toString(),
            endTimeUnixNano: span.endTimeMs
              ? BigInt(Math.floor(span.endTimeMs * 1_000_000)).toString()
              : undefined,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: typeof value === 'number'
                ? { intValue: value }
                : typeof value === 'boolean'
                ? { boolValue: value }
                : { stringValue: String(value) },
            })),
            status: {
              code: span.status === 'OK' ? 1 : span.status === 'ERROR' ? 2 : 0,
            },
            events: span.events.map(evt => ({
              name: evt.name,
              timeUnixNano: BigInt(Math.floor(evt.timestampMs * 1_000_000)).toString(),
              attributes: evt.attributes
                ? Object.entries(evt.attributes).map(([k, v]) => ({
                    key: k,
                    value: typeof v === 'number' ? { intValue: v } : { stringValue: String(v) },
                  }))
                : [],
            })),
          })),
        }],
      }],
    };

    const response = await fetch(`${OTEL_CONFIG.otlpEndpoint}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      metrics.exportedSpans += batch.length;
    } else {
      // Re-queue on failure (with limit)
      if (spanBuffer.length + batch.length < MAX_BUFFER_SIZE) {
        spanBuffer.unshift(...batch);
      }
    }
  } catch {
    // Silently drop on connection error (collector might be down)
    metrics.droppedSpans += batch.length;
  }
}

/**
 * Initialize the tracing pipeline
 */
export function initTracing(): void {
  flushTimer = setInterval(flushSpans, OTEL_CONFIG.batchTimeout);
  console.log(`[OTel] Tracing initialized: service=${OTEL_CONFIG.serviceName}, endpoint=${OTEL_CONFIG.otlpEndpoint}`);
}

/**
 * Shutdown tracing (flush remaining spans)
 */
export async function shutdownTracing(): Promise<void> {
  if (flushTimer) clearInterval(flushTimer);
  await flushSpans();
  console.log(`[OTel] Tracing shutdown: exported=${metrics.exportedSpans}, dropped=${metrics.droppedSpans}`);
}

/**
 * Express middleware for automatic request tracing
 */
export function otelRequestMiddleware() {
  return (req: any, res: any, next: () => void) => {
    // Parse incoming trace context
    const traceparent = req.headers['traceparent'] as string;
    let parentSpan: TraceSpan | undefined;

    if (traceparent) {
      const parts = traceparent.split('-');
      if (parts.length === 4) {
        parentSpan = {
          traceId: parts[1],
          spanId: parts[2],
          operationName: 'parent',
          serviceName: 'upstream',
          startTimeMs: 0,
          status: 'UNSET',
          attributes: {},
          events: [],
        };
      }
    }

    const span = startSpan(
      `${req.method} ${req.path}`,
      parentSpan,
      {
        'http.method': req.method,
        'http.url': req.url,
        'http.target': req.path,
        'http.user_agent': req.headers['user-agent'] || '',
        'net.peer.ip': req.ip || req.socket.remoteAddress || '',
      }
    );

    // Propagate trace context downstream
    res.setHeader('traceparent', `00-${span.traceId}-${span.spanId}-01`);
    res.setHeader('x-correlation-id', req.headers['x-correlation-id'] || span.traceId);

    // Attach span to request for child span creation
    (req as any).__otelSpan = span;

    // Capture response
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      span.attributes['http.status_code'] = res.statusCode;
      endSpan(span, res.statusCode >= 400 ? 'ERROR' : 'OK');
      return originalEnd(...args);
    };

    next();
  };
}

/**
 * Get current span from request
 */
export function getSpanFromRequest(req: any): TraceSpan | undefined {
  return (req as any).__otelSpan;
}

/**
 * Create a child span from request context
 */
export function startChildSpan(
  req: any,
  operationName: string,
  attributes?: PaymentSpanAttributes & Record<string, string | number | boolean>
): TraceSpan {
  const parentSpan = getSpanFromRequest(req);
  return startSpan(operationName, parentSpan, attributes);
}

/**
 * Get metrics summary for the /metrics endpoint
 */
export function getMetricsSummary() {
  return {
    service: OTEL_CONFIG.serviceName,
    uptime: process.uptime(),
    tracing: {
      activeSpans: metrics.activeSpans,
      exportedSpans: metrics.exportedSpans,
      droppedSpans: metrics.droppedSpans,
      bufferSize: spanBuffer.length,
    },
    transactions: {
      total: metrics.transactionsTotal,
      success: metrics.transactionsSuccess,
      failed: metrics.transactionsFailed,
      successRate: metrics.transactionsTotal > 0
        ? (metrics.transactionsSuccess / metrics.transactionsTotal * 100).toFixed(2) + '%'
        : 'N/A',
    },
    latencyHistogram: Object.fromEntries(metrics.latencyHistogram),
  };
}
