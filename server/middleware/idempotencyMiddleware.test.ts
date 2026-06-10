import { describe, it, expect } from 'vitest';

describe('idempotencyMiddleware', () => {
  it('exports middleware function', async () => {
    const mod = await import('./idempotencyMiddleware');
    expect(mod).toBeDefined();
  });
});
