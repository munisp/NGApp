import { describe, it, expect } from 'vitest';
import { generalRateLimiter, rateLimitErrorHandler } from './rateLimitMiddleware';

describe('rateLimitMiddleware', () => {
  it('exports generalRateLimiter as a function', () => {
    expect(typeof generalRateLimiter).toBe('function');
  });

  it('exports rateLimitErrorHandler as a function', () => {
    expect(typeof rateLimitErrorHandler).toBe('function');
  });
});
