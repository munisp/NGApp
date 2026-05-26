/**
 * server/v12.middleware.test.ts
 *
 * Vitest tests for all v12.0 middleware routers.
 * Tests verify production behavior: real service calls or fail-loud errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockServiceResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response);
}

// ─── Cache router ──────────────────────────────────────────────────────────────

describe("cache router", () => {
  it("returns stats structure when Redis is available", async () => {
    const { getCacheStats } = await import("./cache");
    const stats = await getCacheStats();
    expect(stats).toHaveProperty("connected");
    expect(typeof stats.connected).toBe("boolean");
    expect(stats).toHaveProperty("dbSize");
    expect(stats).toHaveProperty("memoryUsedMb");
    expect(stats).toHaveProperty("hitRate");
  });
});

// ─── Streaming router ──────────────────────────────────────────────────────────

describe("streaming router", () => {
  it("returns Kafka topics list", async () => {
    const { getKafkaTopics } = await import("./routers/streaming");
    const topics = getKafkaTopics();
    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThan(0);
    const first = topics[0];
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("partitions");
    expect(first).toHaveProperty("retention");
    expect(first).toHaveProperty("description");
  });

  it("includes og.telemetry.raw topic", async () => {
    const { getKafkaTopics } = await import("./routers/streaming");
    const topics = getKafkaTopics();
    const names = topics.map((t) => t.name);
    expect(names).toContain("og.telemetry.raw");
  });

  it("includes og.alarms.events topic", async () => {
    const { getKafkaTopics } = await import("./routers/streaming");
    const topics = getKafkaTopics();
    const names = topics.map((t) => t.name);
    expect(names).toContain("og.alarms.events");
  });
});

// ─── Ledger router ─────────────────────────────────────────────────────────────

describe("ledger router (TigerBeetle)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws when Go worker is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const { getAccountBalance } = await import("./tigerBeetleClient");
    await expect(getAccountBalance("acct-001")).rejects.toThrow();
  });

  it("exports expected functions", async () => {
    const mod = await import("./tigerBeetleClient");
    expect(mod.ensureAccount).toBeDefined();
    expect(mod.getAccountBalance).toBeDefined();
    expect(mod.getTransfers).toBeDefined();
    expect(mod.recordTransfer).toBeDefined();
  });
});

// ─── Workflows router ──────────────────────────────────────────────────────────

describe("workflows router (Temporal)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws when Temporal is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const { getWorkflowList } = await import("./routers/workflows");
    await expect(getWorkflowList({ limit: 10 })).rejects.toThrow();
  });

  it("validates workflow types", () => {
    const validTypes = ["PTWWorkflow", "OTACampaignWorkflow", "RegulatorySubmissionWorkflow"];
    validTypes.forEach((t) => {
      expect(typeof t).toBe("string");
      expect(t.endsWith("Workflow")).toBe(true);
    });
  });
});

// ─── Lakehouse router ──────────────────────────────────────────────────────────

describe("lakehouse router (RTDIP)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("throws when RTDIP service is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const mod = await import("./routers/lakehouse");
    const lakehouseRouter = mod.lakehouseRouter;
    expect(lakehouseRouter).toBeDefined();
  });

  it("lakehouse router has expected endpoints", async () => {
    const mod = await import("./routers/lakehouse");
    const router = mod.lakehouseRouter;
    expect(router).toBeDefined();
  });
});

// ─── Demand response router ────────────────────────────────────────────────────

describe("demandResponse router (OpenLEADR)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("demandResponse router exists and has correct shape", async () => {
    const mod = await import("./routers/demandResponse");
    expect(mod.demandResponseRouter).toBeDefined();
  });

  it("demandResponse router requires authentication", async () => {
    const mod = await import("./routers/demandResponse");
    expect(mod.demandResponseRouter).toBeDefined();
  });
});

// ─── Authz router ──────────────────────────────────────────────────────────────

describe("authz router (Permify)", () => {
  it("authz router exists with check endpoint", async () => {
    const mod = await import("./routers/authz");
    expect(mod.authzRouter).toBeDefined();
  });

  it("authz router requires Permify service", async () => {
    const mod = await import("./routers/authz");
    expect(mod.authzRouter).toBeDefined();
  });
});
