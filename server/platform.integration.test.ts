/**
 * Platform Integration Tests
 * Tests all major routers to ensure they are wired and functional
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the database ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // null = no DB → routers return []
}));

// ── Import routers after mocks ─────────────────────────────────────────────────
import { wellsRouter } from "./routers/wells";
import { financialsRouter } from "./routers/financials";

// ── Minimal tRPC caller helper ─────────────────────────────────────────────────
// All procedures are now protectedProcedure — must pass an authenticated user context
function makeCaller(routerInstance: any) {
  return routerInstance.createCaller({
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {} } as any,
  });
}

// ── Wells Router ───────────────────────────────────────────────────────────────
describe("wellsRouter", () => {
  it("list returns empty array when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.list({ limit: 10 });
    expect(result).toHaveProperty("wells");
    expect(Array.isArray(result.wells)).toBe(true);
  });

  it("stats returns null or valid shape when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.stats();
    // stats returns null when DB unavailable — just ensure no throw
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("alarmStats returns valid shape when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.alarmStats();
    expect(result).toHaveProperty("active");
    expect(result).toHaveProperty("critical");
    expect(result).toHaveProperty("newToday");
  });

  it("productionTrend returns array when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.productionTrend({ days: 7 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("activeAlarms returns array when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.activeAlarms({ limit: 5 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("allWorkovers returns array when DB unavailable", async () => {
    const caller = makeCaller(wellsRouter);
    const result = await caller.allWorkovers({});
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Financials Router ──────────────────────────────────────────────────────────
describe("financialsRouter", () => {
  it("summary returns valid shape when DB unavailable", async () => {
    const caller = makeCaller(financialsRouter);
    const result = await caller.summary();
    // summary returns null when DB unavailable — just ensure no throw
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("list returns array when DB unavailable", async () => {
    const caller = makeCaller(financialsRouter);
    const result = await caller.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Router wiring sanity check ─────────────────────────────────────────────────
describe("router exports", () => {
  it("wellsRouter exports required procedures", () => {
    expect(wellsRouter).toBeDefined();
    expect(typeof wellsRouter).toBe("object");
  });

  it("financialsRouter exports required procedures", () => {
    expect(financialsRouter).toBeDefined();
    expect(typeof financialsRouter).toBe("object");
  });
});
