import type { Request, Response, NextFunction } from 'express';

interface MetricEntry {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'ok' | 'error';
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; message: string }>;
}

interface ErrorEntry {
  id: string;
  error: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: number;
  resolved: boolean;
}

class MetricsCollector {
  private metrics: MetricEntry[] = [];
  private maxEntries = 50000;

  record(name: string, value: number, tags: Record<string, string> = {}): void {
    this.metrics.push({ name, value, tags, timestamp: Date.now() });
    if (this.metrics.length > this.maxEntries) {
      this.metrics = this.metrics.slice(-this.maxEntries / 2);
    }
  }

  increment(name: string, tags: Record<string, string> = {}): void {
    this.record(name, 1, tags);
  }

  timing(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    this.record(name, durationMs, { ...tags, unit: 'ms' });
  }

  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.record(name, value, { ...tags, type: 'gauge' });
  }

  getMetrics(name?: string, since?: number): MetricEntry[] {
    let results = this.metrics;
    if (name) results = results.filter((m) => m.name === name);
    if (since) results = results.filter((m) => m.timestamp >= since);
    return results;
  }

  getSummary(name: string, windowMs = 60000): { count: number; avg: number; min: number; max: number; p95: number } {
    const now = Date.now();
    const entries = this.metrics.filter((m) => m.name === name && m.timestamp >= now - windowMs);
    if (entries.length === 0) return { count: 0, avg: 0, min: 0, max: 0, p95: 0 };

    const values = entries.map((e) => e.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const p95Index = Math.floor(values.length * 0.95);

    return {
      count: values.length,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p95: values[p95Index] || values[values.length - 1],
    };
  }
}

class TracingService {
  private spans: TraceSpan[] = [];
  private maxSpans = 10000;

  startSpan(operationName: string, parentSpanId?: string): TraceSpan {
    const span: TraceSpan = {
      traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      spanId: `span_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      status: 'ok',
      tags: {},
      logs: [],
    };
    this.spans.push(span);
    if (this.spans.length > this.maxSpans) {
      this.spans = this.spans.slice(-this.maxSpans / 2);
    }
    return span;
  }

  endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok'): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
  }

  getTraces(limit = 100): TraceSpan[] {
    return this.spans.slice(-limit);
  }
}

class ErrorTracker {
  private errors: ErrorEntry[] = [];
  private maxErrors = 5000;

  capture(error: Error | string, context: Record<string, unknown> = {}): string {
    const id = `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const entry: ErrorEntry = {
      id,
      error: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      timestamp: Date.now(),
      resolved: false,
    };
    this.errors.push(entry);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors / 2);
    }
    console.error(`[ErrorTracker] ${entry.error}`, context);
    return id;
  }

  getErrors(resolved?: boolean, limit = 100): ErrorEntry[] {
    let results = this.errors;
    if (resolved !== undefined) results = results.filter((e) => e.resolved === resolved);
    return results.slice(-limit);
  }

  resolve(errorId: string): boolean {
    const entry = this.errors.find((e) => e.id === errorId);
    if (entry) {
      entry.resolved = true;
      return true;
    }
    return false;
  }

  getErrorRate(windowMs = 60000): number {
    const now = Date.now();
    return this.errors.filter((e) => e.timestamp >= now - windowMs).length;
  }
}

export const metrics = new MetricsCollector();
export const tracing = new TracingService();
export const errorTracker = new ErrorTracker();

export function requestMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const span = tracing.startSpan(`${req.method} ${req.path}`);
    span.tags.method = req.method;
    span.tags.path = req.path;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = String(res.statusCode);

      metrics.timing('http.request.duration', duration, {
        method: req.method,
        path: req.route?.path || req.path,
        status: statusCode,
      });

      metrics.increment('http.request.count', {
        method: req.method,
        status: statusCode,
      });

      if (res.statusCode >= 400) {
        metrics.increment('http.request.errors', {
          method: req.method,
          status: statusCode,
        });
      }

      span.tags.status = statusCode;
      tracing.endSpan(span, res.statusCode >= 500 ? 'error' : 'ok');
    });

    next();
  };
}

export function healthCheckEndpoint() {
  return (_req: Request, res: Response) => {
    const requestDuration = metrics.getSummary('http.request.duration');
    const errorRate = errorTracker.getErrorRate();
    const requestCount = metrics.getSummary('http.request.count');

    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics: {
        requestsPerMinute: requestCount.count,
        avgResponseTimeMs: Math.round(requestDuration.avg),
        p95ResponseTimeMs: Math.round(requestDuration.p95),
        errorsPerMinute: errorRate,
      },
    });
  };
}

export const monitoring = {
  metrics,
  tracing,
  errorTracker,
  requestMetricsMiddleware,
  healthCheckEndpoint,
};
