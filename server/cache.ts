/**
 * server/cache.ts — Redis-backed caching layer for OG-RMM Platform
 *
 * Provides TTL-based caching for wells, alarms, and production queries.
 * Falls back to a no-op in-memory stub when Redis is unavailable.
 */
import Redis from "ioredis";

// ─── Configuration ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const CACHE_ENABLED = process.env.REDIS_ENABLED !== "false";

// Default TTLs (seconds)
export const TTL = {
  WELLS_LIST: 30,
  ALARMS_LIST: 15,
  PRODUCTION_RECORDS: 60,
  SENSOR_LATEST: 10,
  REGULATORY_SUBMISSIONS: 120,
  SHIFT_HANDOVER: 30,
  STATS: 300,
} as const;

// ─── Client ────────────────────────────────────────────────────────────────────

let redisClient: Redis | null = null;
let redisConnected = false;

if (CACHE_ENABLED) {
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redisClient.on("connect", () => {
      redisConnected = true;
      console.log("[cache] Redis connected:", REDIS_URL);
    });

    redisClient.on("error", (err) => {
      if (redisConnected) {
        console.warn("[cache] Redis error (falling back to no-op):", err.message);
      }
      redisConnected = false;
    });

    redisClient.on("close", () => {
      redisConnected = false;
    });

    // Attempt initial connection (non-blocking)
    redisClient.connect().catch(() => {
      console.warn("[cache] Redis unavailable — caching disabled");
    });
  } catch {
    console.warn("[cache] Redis init failed — caching disabled");
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get a cached value by key. Returns null on miss or when Redis is unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisClient || !redisConnected) return null;
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with a TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redisClient || !redisConnected) return;
  try {
    await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silently ignore cache write failures
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redisClient || !redisConnected || keys.length === 0) return;
  try {
    await redisClient.del(...keys);
  } catch {
    // Silently ignore
  }
}

/**
 * Wrap a database query with cache-aside logic.
 * On hit: returns cached value immediately.
 * On miss: executes the query, caches the result, and returns it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  query: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const result = await query();
  await cacheSet(key, result, ttlSeconds);
  return result;
}

/**
 * Publish a message to a Redis pub/sub channel.
 * Used for real-time alarm broadcast to SSE clients.
 */
export async function cachePublish(channel: string, payload: unknown): Promise<void> {
  if (!redisClient || !redisConnected) return;
  try {
    await redisClient.publish(channel, JSON.stringify(payload));
  } catch {
    // Silently ignore
  }
}

/**
 * Returns basic Redis stats for the infrastructure status page.
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  url: string;
  dbSize: number;
  memoryUsedMb: number;
  hitRate: number;
}> {
  if (!redisClient || !redisConnected) {
    return { connected: false, url: REDIS_URL, dbSize: 0, memoryUsedMb: 0, hitRate: 0 };
  }
  try {
    const [dbSize, info] = await Promise.all([
      redisClient.dbsize(),
      redisClient.info("memory"),
    ]);
    const memMatch = info.match(/used_memory:(\d+)/);
    const memBytes = memMatch ? parseInt(memMatch[1]) : 0;
    return {
      connected: true,
      url: REDIS_URL,
      dbSize,
      memoryUsedMb: Math.round((memBytes / 1024 / 1024) * 100) / 100,
      hitRate: 0, // Would require keyspace stats tracking
    };
  } catch {
    return { connected: false, url: REDIS_URL, dbSize: 0, memoryUsedMb: 0, hitRate: 0 };
  }
}

export { redisConnected };

/**
 * Returns a dedicated Redis subscriber client for pub/sub.
 * Creates a new connection (required by Redis — a subscribed client cannot issue other commands).
 * Returns null when Redis is unavailable.
 */
let subClient: Redis | null = null;

export function getSubClient(): Redis | null {
  if (!CACHE_ENABLED) return null;
  if (subClient) return subClient;
  try {
    subClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    subClient.connect().catch(() => {
      console.warn("[cache] Redis sub-client unavailable");
      subClient = null;
    });
    return subClient;
  } catch {
    return null;
  }
}
