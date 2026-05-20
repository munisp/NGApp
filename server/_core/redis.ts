import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });
    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
    redisClient.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL.replace(/\/\/.*@/, "//***@"));
    });
  }
  return redisClient;
}

export async function redisHealthCheck(): Promise<{ status: string; latencyMs: number }> {
  try {
    const redis = getRedis();
    const start = Date.now();
    await redis.ping();
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (err) {
    return { status: "unhealthy", latencyMs: -1 };
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  const val = await redis.get(key);
  if (!val) return null;
  return JSON.parse(val) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  await redis.del(key);
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
