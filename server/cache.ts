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
  MATERIALS: 60,
  DAMAGE_ASSESSMENT: 45,
  DOMAIN: 30,
  TREXM: 120,
  OSDU_METADATA: 180,
  LAKEHOUSE: 60,
  OPERATIONS: 30,
  WATER_INJECTION: 30,
  DEVICE_MANAGEMENT: 30,
  PERMITS: 30,
  FINANCIALS: 120,
  AI_ADVANCED: 60,
} as const;

// ─── Cache Metrics ─────────────────────────────────────────────────────────────

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheMetrics() {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    total,
    hitRate: total > 0 ? Math.round((cacheHits / total) * 10000) / 100 : 0,
  };
}

export function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
}

// ─── Cache Key Builder ─────────────────────────────────────────────────────────

export function cacheKey(router: string, procedure: string, params?: Record<string, unknown>): string {
  const base = `og-rmm:${router}:${procedure}`;
  if (!params || Object.keys(params).length === 0) return base;
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k] ?? "_"}`).join(":");
  return `${base}:${sorted}`;
}

export function cacheKeyPattern(router: string, procedure?: string): string {
  return procedure ? `og-rmm:${router}:${procedure}:*` : `og-rmm:${router}:*`;
}

// ─── Stampede Protection (in-flight dedup) ─────────────────────────────────────

const inflight = new Map<string, Promise<unknown>>();

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
    if (!raw) {
      cacheMisses++;
      return null;
    }
    cacheHits++;
    return JSON.parse(raw) as T;
  } catch {
    cacheMisses++;
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

  // Stampede protection: if another caller is already fetching this key, wait for it
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = query().then(async (result) => {
    await cacheSet(key, result, ttlSeconds);
    inflight.delete(key);
    return result;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
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
  hits: number;
  misses: number;
}> {
  if (!redisClient || !redisConnected) {
    return { connected: false, url: REDIS_URL, dbSize: 0, memoryUsedMb: 0, hitRate: 0, hits: 0, misses: 0 };
  }
  try {
    const [dbSize, info] = await Promise.all([
      redisClient.dbsize(),
      redisClient.info("memory"),
    ]);
    const memMatch = info.match(/used_memory:(\d+)/);
    const memBytes = memMatch ? parseInt(memMatch[1]) : 0;
    const metrics = getCacheMetrics();
    return {
      connected: true,
      url: REDIS_URL,
      dbSize,
      memoryUsedMb: Math.round((memBytes / 1024 / 1024) * 100) / 100,
      hitRate: metrics.hitRate,
      hits: metrics.hits,
      misses: metrics.misses,
    };
  } catch {
    return { connected: false, url: REDIS_URL, dbSize: 0, memoryUsedMb: 0, hitRate: 0, hits: 0, misses: 0 };
  }
}

/**
 * Invalidate all cache keys matching a router pattern.
 * Uses SCAN to avoid blocking Redis on large keyspaces.
 */
export async function cacheInvalidateRouter(router: string, procedure?: string): Promise<number> {
  if (!redisClient || !redisConnected) return 0;
  const pattern = cacheKeyPattern(router, procedure);
  let deleted = 0;
  try {
    const stream = redisClient.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if ((keys as string[]).length > 0) {
        deleted += await redisClient.del(...(keys as string[]));
      }
    }
  } catch {
    // Silently ignore scan failures
  }
  return deleted;
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
