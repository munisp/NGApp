/**
 * Redis client with connection pooling, rate limiting, KYC gate, and pub/sub.
 */

export class RedisClient {
  private addr: string;
  private client: any;

  constructor(addr: string) {
    this.addr = addr;
    try {
      const Redis = require('ioredis');
      const [host, port] = addr.split(':');
      this.client = new Redis({ host, port: parseInt(port || '6379'), maxRetriesPerRequest: 3, retryStrategy: (times: number) => Math.min(times * 100, 3000) });
    } catch { this.client = null; }
  }

  async ping(): Promise<void> {
    if (!this.client) throw new Error('Redis not initialized');
    await this.client.ping();
  }

  async cacheJSON(key: string, value: unknown, ttlSeconds: number = 300): Promise<void> {
    if (!this.client) return;
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async getCachedJSON<T = unknown>(key: string): Promise<T | null> {
    if (!this.client) return null;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async rateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    if (!this.client) return true;
    const pipeline = this.client.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] ?? 0) <= maxRequests;
  }

  async acquireLock(key: string, ttlSeconds: number = 30): Promise<boolean> {
    if (!this.client) return false;
    const result = await this.client.set(`lock:${key}`, Date.now(), 'NX', 'EX', ttlSeconds);
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(`lock:${key}`);
  }

  async publish(channel: string, message: unknown): Promise<void> {
    if (!this.client) return;
    await this.client.publish(channel, JSON.stringify(message));
  }

  async setKYCGate(userId: string, allowed: boolean, level: number, ttl: number = 600): Promise<void> {
    await this.cacheJSON(`kyc:gate:${userId}`, { allowed, level, ts: Math.floor(Date.now() / 1000) }, ttl);
  }

  async getKYCGate(userId: string): Promise<{ allowed: boolean; level: number } | null> {
    return this.getCachedJSON(`kyc:gate:${userId}`);
  }

  async cachePolicy(policyId: string, data: Record<string, unknown>, ttl: number = 3600): Promise<void> {
    await this.cacheJSON(`policy:${policyId}`, data, ttl);
  }

  async getCachedPolicy(policyId: string): Promise<Record<string, unknown> | null> {
    return this.getCachedJSON(`policy:${policyId}`);
  }

  async cacheSession(sessionId: string, data: Record<string, unknown>, ttl: number = 1800): Promise<void> {
    await this.cacheJSON(`session:${sessionId}`, data, ttl);
  }

  async getSession(sessionId: string): Promise<Record<string, unknown> | null> {
    return this.getCachedJSON(`session:${sessionId}`);
  }

  async close(): Promise<void> {
    if (this.client) await this.client.quit();
  }
}
