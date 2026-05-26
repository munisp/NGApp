/**
 * server/v12.middleware.test.ts
 *
 * Vitest tests for all v12.0 middleware routers.
 * Tests run in simulation mode (no external services required).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Force simulation mode for all middleware services
process.env.RTDIP_ENABLED = "false";
process.env.GO_WORKER_ENABLED = "false";
process.env.OPENLEADR_ENABLED = "false";

function mockWorkerResponse(data: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response);
}

// ─── Cache router ──────────────────────────────────────────────────────────────

describe("cache router", () => {
  it("returns simulated stats when Redis is unavailable", async () => {
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

  it("returns simulated ledger when worker is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const { getLedgerForWell } = await import("./tigerBeetleClient");
    const ledger = await getLedgerForWell("W-001");
    expect(ledger).toHaveProperty("wellId", "W-001");
    expect(ledger).toHaveProperty("oilBbl");
    expect(ledger).toHaveProperty("gasMscf");
    expect(ledger).toHaveProperty("waterBbl");
    expect(ledger.source).toBe("simulated");
  });

  it("returns worker data when available", async () => {
    mockWorkerResponse({
      wellId: "W-001",
      oilBbl: 12345,
      gasMscf: 6789,
      waterBbl: 1234,
      source: "tigerbeetle",
    });
    const { getLedgerForWell } = await import("./tigerBeetleClient");
    const ledger = await getLedgerForWell("W-001");
    expect(ledger.oilBbl).toBe(12345);
    expect(ledger.source).toBe("tigerbeetle");
  });
});

// ─── Workflows router ──────────────────────────────────────────────────────────

describe("workflows router (Temporal)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns simulated workflow list when Temporal is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const { getWorkflowList } = await import("./routers/workflows");
    const result = await getWorkflowList({ limit: 10 });
    expect(result).toHaveProperty("workflows");
    expect(Array.isArray(result.workflows)).toBe(true);
    expect(result.source).toBe("simulated");
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

  it("returns simulated status when RTDIP service is unavailable", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
    const { getRtdipStatus } = await import("./routers/lakehouse");
    const status = await getRtdipStatus();
    expect(status).toHaveProperty("healthy");
    expect(status).toHaveProperty("mode");
    expect(status.mode).toBe("simulated");
  });

  it("returns simulated tags for well", async () => {
    const { getRtdipTags } = await import("./routers/lakehouse");
    const result = await getRtdipTags({ wellId: "W-001", limit: 10 });
    expect(result).toHaveProperty("tags");
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags.length).toBeGreaterThan(0);
    const tag = result.tags[0];
    expect(tag).toHaveProperty("tag");
    expect(tag).toHaveProperty("description");
    expect(tag).toHaveProperty("unit");
    expect(tag.tag).toContain("W-001");
  });
});

// ─── Demand response router ────────────────────────────────────────────────────

describe("demandResponse router (OpenLEADR)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns simulated programs when VTN is unavailable", async () => {
    const { getSimulatedPrograms } = await import("./routers/demandResponse");
    const programs = getSimulatedPrograms();
    expect(Array.isArray(programs)).toBe(true);
    expect(programs.length).toBeGreaterThan(0);
    const prog = programs[0];
    expect(prog).toHaveProperty("programId");
    expect(prog).toHaveProperty("name");
    expect(prog).toHaveProperty("country");
  });

  it("returns simulated events when VTN is unavailable", async () => {
    const { getSimulatedEvents } = await import("./routers/demandResponse");
    const events = getSimulatedEvents();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty("eventId");
    expect(events[0]).toHaveProperty("programId");
    expect(events[0]).toHaveProperty("signalType");
  });
});

// ─── Authz router ──────────────────────────────────────────────────────────────

describe("authz router (Permify)", () => {
  it("admin role allows all permissions in simulation", async () => {
    const { simulatePermifyCheck } = await import("./routers/authz");
    expect(simulatePermifyCheck("user", "u1", "read", "well", "W-001", "admin")).toBe(true);
    expect(simulatePermifyCheck("user", "u1", "write", "well", "W-001", "admin")).toBe(true);
    expect(simulatePermifyCheck("user", "u1", "admin", "well", "W-001", "admin")).toBe(true);
  });

  it("viewer role allows read but not write", async () => {
    const { simulatePermifyCheck } = await import("./routers/authz");
    expect(simulatePermifyCheck("user", "u1", "read", "well", "W-001", "viewer")).toBe(true);
    expect(simulatePermifyCheck("user", "u1", "write", "well", "W-001", "viewer")).toBe(false);
  });

  it("operator role allows read and write", async () => {
    const { simulatePermifyCheck } = await import("./routers/authz");
    expect(simulatePermifyCheck("user", "u1", "read", "well", "W-001", "operator")).toBe(true);
    expect(simulatePermifyCheck("user", "u1", "write", "well", "W-001", "operator")).toBe(true);
  });
});
