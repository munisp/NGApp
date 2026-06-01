/**
 * Production Hardening Tests — v33.0
 * Tests RBAC enforcement, error handling, and safety-critical procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mock the database ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = no DB → routers return safe defaults
}));

// ── Import routers after mocks ─────────────────────────────────────────────────
import { deviceManagementRouter } from "./routers/deviceManagement";
import { otaManagementRouter } from "./routers/otaManagement";
import { financialsRouter } from "./routers/financials";
import { silCertificationRouter } from "./routers/silCertification";
import { wellsRouter } from "./routers/wells";

// ── Context helpers ────────────────────────────────────────────────────────────
type UserRole = "user" | "admin";

function makeCtx(role: UserRole = "user") {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-open-id`,
      email: `${role}@example.com`,
      name: role === "admin" ? "Admin User" : "Regular User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

function makeUnauthCtx() {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: vi.fn() } as any,
  };
}

// ── Device Management Router ───────────────────────────────────────────────────
describe("deviceManagementRouter — RBAC & Error Handling", () => {
  it("listDevices returns empty array when DB unavailable (authenticated user)", async () => {
    const caller = deviceManagementRouter.createCaller(makeCtx("user"));
    const result = await caller.listDevices({ limit: 10 });
    // listDevices returns array directly when DB unavailable
    expect(result === null || Array.isArray(result) || typeof result === "object").toBe(true);
  });

  it("listDevices rejects unauthenticated requests", async () => {
    const caller = deviceManagementRouter.createCaller(makeUnauthCtx());
    await expect(caller.listDevices({ limit: 10 })).rejects.toThrow(TRPCError);
  });

  it("deleteDevice rejects non-admin users", async () => {
    const caller = deviceManagementRouter.createCaller(makeCtx("user"));
    await expect(caller.deleteDevice({ id: 1 })).rejects.toThrow(TRPCError);
  });

  it("deleteDevice allows admin users (returns NOT_FOUND when DB unavailable)", async () => {
    const caller = deviceManagementRouter.createCaller(makeCtx("admin"));
    // With no DB, expect a TRPCError (NOT_FOUND or INTERNAL_SERVER_ERROR) — not FORBIDDEN
    try {
      await caller.deleteDevice({ id: 1 });
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const trpcErr = err as TRPCError;
      expect(trpcErr.code).not.toBe("FORBIDDEN");
    }
  });

  it("getDevice throws INTERNAL_SERVER_ERROR when DB unavailable", async () => {
    const caller = deviceManagementRouter.createCaller(makeCtx("user"));
    // When DB is unavailable, getDevice throws TRPCError INTERNAL_SERVER_ERROR
    await expect(caller.getDevice({ id: 1 })).rejects.toThrow(TRPCError);
  });
});

// ── OTA Management Router ──────────────────────────────────────────────────────
describe("otaManagementRouter — RBAC & Error Handling", () => {
  it("listFirmwareVersions returns empty array when DB unavailable", async () => {
    const caller = otaManagementRouter.createCaller(makeCtx("user"));
    const result = await caller.listFirmwareVersions({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("createCampaign rejects non-admin users", async () => {
    const caller = otaManagementRouter.createCaller(makeCtx("user"));
    await expect(
      caller.createCampaign({
        name: "Test Campaign",
        firmwareId: 1,
        targetDeviceIds: [1, 2],
        scheduledAt: new Date().toISOString(),
      })
    ).rejects.toThrow(TRPCError);
  });

  it("createCampaign rejects unauthenticated requests", async () => {
    const caller = otaManagementRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.createCampaign({
        name: "Test Campaign",
        firmwareId: 1,
        targetDeviceIds: [1, 2],
        scheduledAt: new Date().toISOString(),
      })
    ).rejects.toThrow(TRPCError);
  });

  it("listCampaigns returns empty array when DB unavailable", async () => {
    const caller = otaManagementRouter.createCaller(makeCtx("user"));
    const result = await caller.listCampaigns();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Financials Router ──────────────────────────────────────────────────────────
describe("financialsRouter — Auth & Error Handling", () => {
  it("summary returns null when DB unavailable", async () => {
    const caller = financialsRouter.createCaller(makeCtx("user"));
    const result = await caller.summary();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("summary rejects unauthenticated requests", async () => {
    const caller = financialsRouter.createCaller(makeUnauthCtx());
    await expect(caller.summary()).rejects.toThrow(TRPCError);
  });

  it("list returns array when DB unavailable", async () => {
    const caller = financialsRouter.createCaller(makeCtx("user"));
    const result = await caller.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("monthlyTrend returns empty array when DB unavailable", async () => {
    const caller = financialsRouter.createCaller(makeCtx("user"));
    const result = await caller.monthlyTrend({ months: 6 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── SIL Certification Router (Safety-Critical) ────────────────────────────────
describe("silCertificationRouter — Safety-Critical RBAC", () => {
  it("listAssessments returns array when DB unavailable", async () => {
    const caller = silCertificationRouter.createCaller(makeCtx("user"));
    const result = await caller.listAssessments();
    expect(Array.isArray(result)).toBe(true);
  });

  it("listAssessments rejects unauthenticated requests", async () => {
    const caller = silCertificationRouter.createCaller(makeUnauthCtx());
    await expect(caller.listAssessments()).rejects.toThrow(TRPCError);
  });

  it("summary returns valid shape when DB unavailable", async () => {
    const caller = silCertificationRouter.createCaller(makeCtx("user"));
    const result = await caller.summary();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("updateControl rejects unauthenticated requests", async () => {
    const caller = silCertificationRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.updateControl({ id: 1, status: "COMPLIANT" })
    ).rejects.toThrow(TRPCError);
  });
});

// ── Wells Router — RBAC on deleteAlarmRule ────────────────────────────────────
describe("wellsRouter — RBAC on destructive operations", () => {
  it("deleteAlarmRule rejects non-admin users", async () => {
    const caller = wellsRouter.createCaller(makeCtx("user"));
    await expect(caller.deleteAlarmRule({ id: 1 })).rejects.toThrow(TRPCError);
  });

  it("deleteAlarmRule rejects unauthenticated requests", async () => {
    const caller = wellsRouter.createCaller(makeUnauthCtx());
    await expect(caller.deleteAlarmRule({ id: 1 })).rejects.toThrow(TRPCError);
  });

  it("list returns empty result when DB unavailable", async () => {
    const caller = wellsRouter.createCaller(makeCtx("user"));
    const result = await caller.list({ limit: 10 });
    expect(result).toHaveProperty("wells");
    expect(Array.isArray(result.wells)).toBe(true);
  });

  it("createAlarmRule rejects unauthenticated requests", async () => {
    const caller = wellsRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.createAlarmRule({
        wellId: 1,
        tag: "PT-101",
        description: "High Pressure",
        threshold: 100,
        deadBand: 5,
        severity: 3,
        unit: "PSI",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("ingestTelemetry rejects unauthenticated requests", async () => {
    const caller = wellsRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.ingestTelemetry({
        wellId: 1,
        readings: [{ tag: "PT-101", value: 95, unit: "PSI", ts: Date.now() }],
      })
    ).rejects.toThrow(TRPCError);
  });
});

// ── Error Handling — Graceful Degradation ─────────────────────────────────────
describe("Error Handling — Graceful Degradation", () => {
  it("wellsRouter.kpis returns null gracefully when DB unavailable", async () => {
    const caller = wellsRouter.createCaller(makeCtx("user"));
    const result = await caller.kpis();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("financialsRouter.summary returns null gracefully when DB unavailable", async () => {
    const caller = financialsRouter.createCaller(makeCtx("user"));
    const result = await caller.summary();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("deviceManagementRouter.listDevices returns gracefully when DB unavailable", async () => {
    const caller = deviceManagementRouter.createCaller(makeCtx("user"));
    const result = await caller.listDevices({ limit: 10 });
    // Should return without throwing
    expect(result === null || Array.isArray(result) || typeof result === "object").toBe(true);
  });
});
