import { describe, it, expect } from 'vitest';
import { createClient } from 'redis';

describe('Redis connection', () => {
  it('should connect and respond to PING', async () => {
    const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    await client.connect();
    const result = await client.ping();
    expect(result).toBe('PONG');
    await client.disconnect();
  });
});
