/**
 * shared/infra/serviceClient.ts — Resilient HTTP client for inter-service calls.
 *
 * Combines circuit breaker + retry + timeout for every microservice call.
 * Each downstream service gets its own CircuitBreaker instance.
 */

import { CircuitBreaker, type CircuitBreakerOptions, CircuitOpenError } from "./circuitBreaker";
import { withRetry, HttpError, type RetryOptions } from "./retry";

export interface ServiceClientOptions {
  baseURL: string;
  serviceName: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retry?: Partial<RetryOptions>;
  circuitBreaker?: Partial<CircuitBreakerOptions>;
}

export class ServiceClient {
  private readonly cb: CircuitBreaker;
  private readonly baseURL: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly retryOpts: Partial<RetryOptions>;
  readonly serviceName: string;

  constructor(opts: ServiceClientOptions) {
    this.baseURL = opts.baseURL.replace(/\/$/, "");
    this.serviceName = opts.serviceName;
    this.timeoutMs = opts.timeoutMs ?? 5_000;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...opts.headers,
    };
    this.retryOpts = opts.retry ?? {};
    this.cb = new CircuitBreaker(opts.serviceName, {
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenMaxProbes: 1,
      onStateChange: (from, to, name) => {
        console.log(`[circuit-breaker] ${name}: ${from} → ${to}`);
      },
      ...opts.circuitBreaker,
    });
  }

  async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, headers);
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, body, headers);
  }

  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PUT", path, body, headers);
  }

  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("DELETE", path, undefined, headers);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseURL}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  getCircuitState() {
    return this.cb.getState();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.cb.execute(() =>
      withRetry(async () => {
        const url = `${this.baseURL}${path}`;
        const res = await fetch(url, {
          method,
          headers: { ...this.defaultHeaders, ...headers },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new HttpError(res.status, `${this.serviceName} ${method} ${path}: HTTP ${res.status} — ${text}`);
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          return (await res.json()) as T;
        }
        return (await res.text()) as unknown as T;
      }, this.retryOpts),
    );
  }
}

export { CircuitOpenError, HttpError };
