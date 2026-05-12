import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";

describe("Health & Monitoring Endpoints", () => {
  it("/healthz returns database connected status", async () => {
    const resp = await fetch(`${BASE}/healthz`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(["redis", "memory"]).toContain(data.redis);
    expect(["kafka", "memory"]).toContain(data.kafka);
    expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("/healthz includes memory metrics", async () => {
    const resp = await fetch(`${BASE}/healthz`);
    const data = await resp.json() as any;
    expect(data.memory).toBeDefined();
    expect(data.memory.rss).toBeGreaterThan(0);
    expect(data.memory.heapUsed).toBeGreaterThan(0);
  });

  it("/api/platform/redis/status returns stats", async () => {
    const resp = await fetch(`${BASE}/api/platform/redis/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.stats).toBeDefined();
    expect(typeof data.stats.hits).toBe("number");
    expect(typeof data.stats.misses).toBe("number");
  });

  it("/api/platform/kafka/status returns topics", async () => {
    const resp = await fetch(`${BASE}/api/platform/kafka/status`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data.topics.length).toBe(20);
    expect(data.stats).toBeDefined();
    expect(typeof data.stats.published).toBe("number");
  });

  it("/api/platform/sessions/stats returns session info", async () => {
    const resp = await fetch(`${BASE}/api/platform/sessions/stats`);
    expect(resp.status).toBe(200);
    const data = await resp.json() as any;
    expect(data).toBeDefined();
  });
});
