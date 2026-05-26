/**
 * v55.0 Production Sprint — Integration Tests
 * Covers: production constants, ENV defaults, and all major routers
 * Uses correct procedure names matching actual appRouter registrations.
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import {
  APP_VERSION,
  APP_NAME,
  DEFAULT_WELLS,
  DEFAULT_FIELD_ID,
  DEFAULT_TIMEZONE,
  PHYSICS_ENGINE_URL_DEFAULT,
  ML_SERVICE_URL_DEFAULT,
} from "../shared/const";

function makeCtx(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: role === "admin" ? "test-admin" : "test-user",
      name: role === "admin" ? "Test Admin" : "Test User",
      email: `${role}@test.com`,
      role,
      loginMethod: "manus",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const adminCaller = appRouter.createCaller(makeCtx("admin"));
const userCaller = appRouter.createCaller(makeCtx("user"));

// ─── Production Constants ──────────────────────────────────────────────────
describe("Production Constants", () => {
  it("APP_VERSION is v55.0", () => {
    expect(APP_VERSION).toBe("v55.0");
  });

  it("APP_NAME is set", () => {
    expect(APP_NAME).toBeTruthy();
    expect(APP_NAME.length).toBeGreaterThan(0);
  });

  it("DEFAULT_WELLS has 6 wells", () => {
    expect(DEFAULT_WELLS).toHaveLength(6);
    expect(DEFAULT_WELLS[0]).toBe("WELL-001");
  });

  it("DEFAULT_FIELD_ID is set", () => {
    expect(DEFAULT_FIELD_ID).toBe("field-001");
  });

  it("DEFAULT_TIMEZONE is set", () => {
    expect(DEFAULT_TIMEZONE).toBeTruthy();
  });

  it("PHYSICS_ENGINE_URL_DEFAULT is set", () => {
    expect(PHYSICS_ENGINE_URL_DEFAULT).toMatch(/^https?:\/\//);
  });

  it("ML_SERVICE_URL_DEFAULT is set", () => {
    expect(ML_SERVICE_URL_DEFAULT).toMatch(/^https?:\/\//);
  });
});

// ─── ENV Defaults ──────────────────────────────────────────────────────────
describe("ENV production defaults", () => {
  it("appVersion is v55.0", () => {
    expect(ENV.appVersion).toBe("v55.0");
  });

  it("appId is set", () => {
    expect(ENV.appId).toBeTruthy();
  });

  it("physicsUrl has a default", () => {
    expect(ENV.physicsUrl).toMatch(/^https?:\/\//);
  });

  it("mlUrl has a default", () => {
    expect(ENV.mlUrl).toMatch(/^https?:\/\//);
  });

  it("grafanaUrl has a default", () => {
    expect(ENV.grafanaUrl).toMatch(/^https?:\/\//);
  });

  it("influxdbUrl has a default", () => {
    expect(ENV.influxdbUrl).toMatch(/^https?:\/\//);
  });

  it("kafkaBrokers is an array", () => {
    expect(Array.isArray(ENV.kafkaBrokers)).toBe(true);
    expect(ENV.kafkaBrokers.length).toBeGreaterThan(0);
  });

  it("smtpHost is set", () => {
    expect(ENV.smtpHost).toBeTruthy();
  });

  it("smtpPort is a valid port number", () => {
    expect(ENV.smtpPort).toBeGreaterThan(0);
    expect(ENV.smtpPort).toBeLessThan(65536);
  });

  it("rateLimitWindowMs is positive", () => {
    expect(ENV.rateLimitWindowMs).toBeGreaterThan(0);
  });

  it("rateLimitMaxOperator is positive", () => {
    expect(ENV.rateLimitMaxOperator).toBeGreaterThan(0);
  });
});

// ─── Temporal Router (health) ─────────────────────────────────────────────
describe("Temporal router health", () => {
  it("temporal.health returns configured field", async () => {
    const result = await adminCaller.temporal.health();
    expect(result).toBeDefined();
    expect(typeof result.configured).toBe("boolean");
  });

  it("temporal.health returns mode field", async () => {
    const result = await adminCaller.temporal.health();
    expect(result.mode).toMatch(/^(live|simulation)$/);
  });
});

// ─── Overview Router ──────────────────────────────────────────────────────
describe("Overview router", () => {
  it("overview.kpis returns wells object", async () => {
    const result = await adminCaller.overview.kpis();
    expect(result).toBeDefined();
    expect(result.wells).toBeDefined();
    expect(typeof result.wells.total).toBe("number");
  });
});

// ─── Alarms Router ────────────────────────────────────────────────────────
describe("Alarms router", () => {
  it("alarms.list returns array", async () => {
    const result = await adminCaller.alarms.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Wells Router (alarm rules) ───────────────────────────────────────────
describe("Wells router alarm rules", () => {
  it("wells.alarmRules returns array", async () => {
    const result = await adminCaller.wells.alarmRules({});
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Production Targets Router ────────────────────────────────────────────
describe("Production targets router", () => {
  it("productionTargets.summary returns object", async () => {
    const result = await adminCaller.productionTargets.summary();
    expect(result).toBeDefined();
  });
});

// ─── Water Injection Router ───────────────────────────────────────────────
describe("Water injection router", () => {
  it("waterInjection.list returns object with records", async () => {
    const result = await adminCaller.waterInjection.list({});
    // Returns { records: [], total: number } when DB unavailable or empty
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
  });
});

// ─── Well Tests Router ────────────────────────────────────────────────────
describe("Well tests router", () => {
  it("wellTests.list returns array", async () => {
    const result = await adminCaller.wellTests.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Sand Management Router ───────────────────────────────────────────────
describe("Sand management router", () => {
  it("sandManagement.list returns array", async () => {
    try {
      const result = await adminCaller.sandManagement.list({});
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      // DB not available in test env
      expect(err.message).toMatch(/relation|does not exist|ECONNREFUSED|password|unavailable/i);
    }
  });
});

// ─── Reservoir Pressure Router ────────────────────────────────────────────
describe("Reservoir pressure router", () => {
  it("reservoirPressure.list returns array", async () => {
    const result = await adminCaller.reservoirPressure.list({ fieldId: "DEFAULT" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Wellbore Integrity Router ────────────────────────────────────────────
describe("Wellbore integrity router", () => {
  it("wellboreIntegrity.listInspections returns array", async () => {
    const result = await adminCaller.wellboreIntegrity.listInspections({ wellId: "WELL-001" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── OTA Management Router ────────────────────────────────────────────────
describe("OTA management router", () => {
  it("otaManagement.listFirmwareVersions returns array", async () => {
    const result = await adminCaller.otaManagement.listFirmwareVersions();
    expect(Array.isArray(result)).toBe(true);
  });

  it("otaManagement.listCampaigns returns array", async () => {
    const result = await adminCaller.otaManagement.listCampaigns();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Device Management Router ─────────────────────────────────────────────
describe("Device management router", () => {
  it("deviceManagement.listDevices returns array", async () => {
    const result = await adminCaller.deviceManagement.listDevices();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deviceManagement.getStats returns object", async () => {
    const result = await adminCaller.deviceManagement.getStats();
    expect(result).toBeDefined();
  });
});

// ─── Financials Router ────────────────────────────────────────────────────
describe("Financials router", () => {
  it("financials.list returns array", async () => {
    const result = await adminCaller.financials.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("financials.summary returns object", async () => {
    const result = await adminCaller.financials.summary();
    expect(result).toBeDefined();
  });
});

// ─── Shift Handover Router ────────────────────────────────────────────────
describe("Shift handover router", () => {
  it("shiftHandover.list returns array", async () => {
    const result = await adminCaller.shiftHandover.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Permit to Work Router ────────────────────────────────────────────────
describe("Permit to work router", () => {
  it("permitToWork.list returns array", async () => {
    const result = await adminCaller.permitToWork.list({});
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Data Export Router ───────────────────────────────────────────────────
describe("Data export router", () => {
  it("dataExport.production returns object", async () => {
    const result = await adminCaller.dataExport.production({ format: "json" });
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
  });
});

// ─── Regulatory Scheduler Router ──────────────────────────────────────────
describe("Regulatory scheduler router", () => {
  it("regulatoryScheduler.getConfig returns object", async () => {
    const result = await adminCaller.regulatoryScheduler.getConfig();
    expect(result).toBeDefined();
  });

  it("regulatoryScheduler.status returns object", async () => {
    const result = await adminCaller.regulatoryScheduler.status();
    expect(result).toBeDefined();
  });
});

// ─── Materials Management Router ──────────────────────────────────────────
describe("Materials management router (registered as 'materials')", () => {
  it("materials.suppliers.list returns array", async () => {
    // suppliers.list uses raw pg pool which may not have tables in test env
    // We just verify the procedure exists and returns an array or throws a DB error
    try {
      const result = await adminCaller.materials.suppliers.list({});
      expect(Array.isArray(result)).toBe(true);
    } catch (err: any) {
      // DB table not migrated in test env — procedure exists, DB tables may not
      expect(err.message).toMatch(/relation|does not exist|ECONNREFUSED|password|unavailable/i);
    }
  });
});
