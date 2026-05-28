/**
 * shared/infra/circuitBreaker.ts — Circuit breaker for inter-service calls.
 *
 * States: CLOSED → OPEN (after failureThreshold) → HALF_OPEN (after resetTimeout)
 * In HALF_OPEN, a single probe request decides whether to re-close or re-open.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxProbes: number;
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
}

const DEFAULTS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxProbes: 1,
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenProbes = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(
    private readonly name: string,
    opts?: Partial<CircuitBreakerOptions>,
  ) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  getState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.opts.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      } else {
        throw new CircuitOpenError(this.name);
      }
    }

    if (this.state === "HALF_OPEN") {
      if (this.halfOpenProbes >= this.opts.halfOpenMaxProbes) {
        throw new CircuitOpenError(this.name);
      }
      this.halfOpenProbes++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN" || this.state === "OPEN") {
      this.transition("CLOSED");
    }
    this.failures = 0;
    this.halfOpenProbes = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.transition("OPEN");
      this.halfOpenProbes = 0;
      return;
    }

    if (this.failures >= this.opts.failureThreshold) {
      this.transition("OPEN");
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    if (from === to) return;
    this.state = to;
    this.opts.onStateChange?.(from, to, this.name);
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — request rejected`);
    this.name = "CircuitOpenError";
  }
}
