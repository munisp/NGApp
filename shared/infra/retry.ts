/**
 * shared/infra/retry.ts — Exponential-backoff retry with jitter.
 *
 * Used by all inter-service HTTP/gRPC calls for transient failure recovery.
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
  retryableStatuses?: Set<number>;
}

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  jitter: true,
  retryableStatuses: new Set([408, 429, 500, 502, 503, 504]),
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
): Promise<T> {
  const config = { ...DEFAULTS, ...opts };
  let lastErr: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;

      if (attempt === config.maxRetries) break;

      if (!isRetryable(err, config)) throw err;

      const delay = computeDelay(attempt, config);
      await sleep(delay);
    }
  }

  throw lastErr;
}

function isRetryable(err: unknown, config: RetryOptions): boolean {
  if (err instanceof TypeError) return true; // network error
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    return config.retryableStatuses?.has(status) ?? false;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("econnreset") ||
      msg.includes("econnrefused") ||
      msg.includes("timeout") ||
      msg.includes("socket hang up") ||
      msg.includes("network")
    );
  }
  return false;
}

function computeDelay(attempt: number, config: RetryOptions): number {
  const exp = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);
  if (!config.jitter) return exp;
  return Math.floor(exp * (0.5 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
