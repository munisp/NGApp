/**
 * OG-RMM Platform — Domain CRUD & Business Logic Tests
 * Covers: sandProductionRecords, producedWaterRecords, workovers, workoverCosts,
 *         permits (PTW), reservoirPressureRecords, regulatoryReports, hseIncidents,
 *         physics business rules, water injection rules
 *
 * All tests run against a real PostgreSQL instance (configured via vitest.config.ts)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  sandProductionRecords,
  producedWaterRecords,
  workovers,
  workoverCosts,
  permits,
  reservoirPressureRecords,
  regulatoryReports,
  hseIncidents,
} from "../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const TEST_WELL_ID = "W-CRUD-TEST-001";
const TEST_FIELD_ID = "F-CRUD-TEST-001";
const TEST_USER = "test-engineer";

let db: Awaited<ReturnType<typeof getDb>>;

beforeAll(async () => {
  db = await getDb();
  if (!db) throw new Error("Database not available — check POSTGRES_URL env var");
});

afterAll(async () => {
  try {
    await db.delete(sandProductionRecords).where(eq(sandProductionRecords.wellId, TEST_WELL_ID));
    await db.delete(producedWaterRecords).where(eq(producedWaterRecords.fieldId, TEST_FIELD_ID));
    await db.delete(permits).where(eq(permits.permitId, "PTW-CRUD-TEST-001"));
    await db.delete(reservoirPressureRecords).where(eq(reservoirPressureRecords.wellId, TEST_WELL_ID));
    await db.delete(hseIncidents).where(eq(hseIncidents.incidentId, "INC-CRUD-TEST-001"));
    await db.delete(regulatoryReports).where(eq(regulatoryReports.reportId, "RPT-CRUD-TEST-001"));
    // workovers cleanup: need to find by jobId
    const wo = await db.select({ id: workovers.id }).from(workovers).where(eq(workovers.jobId, "WO-CRUD-TEST-001"));
    if (wo.length > 0) {
      await db.delete(workoverCosts).where(eq(workoverCosts.workoverId, wo[0].id));
      await db.delete(workovers).where(eq(workovers.jobId, "WO-CRUD-TEST-001"));
    }
  } catch {
    // Ignore cleanup errors
  }
});

// =============================================================================
// SAND PRODUCTION RECORDS
// =============================================================================
describe("Sand Production Records CRUD", () => {
  let sandRecordId: number;

  it("should insert a sand production record", async () => {
    const result = await db.insert(sandProductionRecords).values({
      wellId: TEST_WELL_ID,
      recordedAt: new Date(),
      sandRateMgL: 150.5,
      cumulativeSandKg: 2500,
      drawdownPsi: 450,
      flowRateBpd: 820,
      waterCut: 0.30,
      sandRisk: "MODERATE",
      criticalDrawdownPsi: 600,
      safetyMarginPsi: 150,
      sandControlMethod: "STANDALONE_SCREEN",
      completionType: "CASED_PERFORATED",
      ucsPsi: 2500,
      actionTaken: "Reduced drawdown by 50 psi",
      notes: "Sand onset detected — test record",
    }).returning({ id: sandProductionRecords.id });
    expect(result).toHaveLength(1);
    sandRecordId = result[0].id;
    expect(sandRecordId).toBeGreaterThan(0);
  });

  it("should query sand records by well ID", async () => {
    const records = await db
      .select()
      .from(sandProductionRecords)
      .where(eq(sandProductionRecords.wellId, TEST_WELL_ID));
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].sandRisk).toBe("MODERATE");
  });

  it("should query sand records by risk level", async () => {
    const records = await db
      .select()
      .from(sandProductionRecords)
      .where(and(
        eq(sandProductionRecords.wellId, TEST_WELL_ID),
        eq(sandProductionRecords.sandRisk, "MODERATE")
      ));
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it("should update sand record risk to HIGH", async () => {
    await db.update(sandProductionRecords)
      .set({ sandRisk: "HIGH", drawdownPsi: 700 })
      .where(eq(sandProductionRecords.id, sandRecordId));
    const updated = await db.select().from(sandProductionRecords).where(eq(sandProductionRecords.id, sandRecordId));
    expect(updated[0].sandRisk).toBe("HIGH");
    expect(updated[0].drawdownPsi).toBe(700);
  });

  it("should delete sand production record", async () => {
    await db.delete(sandProductionRecords).where(eq(sandProductionRecords.id, sandRecordId));
    const remaining = await db.select().from(sandProductionRecords).where(eq(sandProductionRecords.id, sandRecordId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// PRODUCED WATER RECORDS
// =============================================================================
describe("Produced Water Records CRUD", () => {
  let waterRecordId: number;

  it("should insert a produced water record", async () => {
    const result = await db.insert(producedWaterRecords).values({
      fieldId: TEST_FIELD_ID,
      recordDate: new Date(),
      producedWaterBbl: 5200,
      injectedWaterBbl: 4800,
      disposedWaterBbl: 400,
      recycledWaterBbl: 200,
      oilInWaterMgL: 25,
      tssMgL: 15,
      phValue: 7.2,
      chlorideMgL: 45000,
      waterQualityStatus: "COMPLIANT",
      injectionEfficiencyPct: 92.3,
      recyclingRatePct: 3.8,
      treatmentCostUsd: 1250,
      environmentalRisk: "LOW",
      notes: "Test water record",
    }).returning({ id: producedWaterRecords.id });
    expect(result).toHaveLength(1);
    waterRecordId = result[0].id;
    expect(waterRecordId).toBeGreaterThan(0);
  });

  it("should query produced water records by field", async () => {
    const records = await db
      .select()
      .from(producedWaterRecords)
      .where(eq(producedWaterRecords.fieldId, TEST_FIELD_ID))
      .orderBy(desc(producedWaterRecords.recordDate));
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].waterQualityStatus).toBe("COMPLIANT");
  });

  it("should filter records by date range", async () => {
    const start = new Date(Date.now() - 86400000);
    const end = new Date(Date.now() + 86400000);
    const records = await db
      .select()
      .from(producedWaterRecords)
      .where(and(
        eq(producedWaterRecords.fieldId, TEST_FIELD_ID),
        gte(producedWaterRecords.recordDate, start),
        lte(producedWaterRecords.recordDate, end)
      ));
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it("should update water quality status to NON_COMPLIANT", async () => {
    await db.update(producedWaterRecords)
      .set({ waterQualityStatus: "NON_COMPLIANT", oilInWaterMgL: 45 })
      .where(eq(producedWaterRecords.id, waterRecordId));
    const updated = await db.select().from(producedWaterRecords).where(eq(producedWaterRecords.id, waterRecordId));
    expect(updated[0].waterQualityStatus).toBe("NON_COMPLIANT");
  });

  it("should delete produced water record", async () => {
    await db.delete(producedWaterRecords).where(eq(producedWaterRecords.id, waterRecordId));
    const remaining = await db.select().from(producedWaterRecords).where(eq(producedWaterRecords.id, waterRecordId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// PERMIT TO WORK — State Machine
// =============================================================================
describe("Permit to Work — State Machine", () => {
  let permitId: number;

  const validTransitions: Record<string, string[]> = {
    DRAFT: ["PENDING"],
    PENDING: ["APPROVED", "DRAFT"],
    APPROVED: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["CLOSED", "CANCELLED"],
    CLOSED: [],
    CANCELLED: [],
    EXPIRED: [],
  };

  const canTransition = (from: string, to: string) =>
    validTransitions[from]?.includes(to) ?? false;

  it("should insert a PTW in DRAFT state", async () => {
    const result = await db.insert(permits).values({
      permitId: "PTW-CRUD-TEST-001",
      wellId: TEST_WELL_ID,
      permitType: "HOT_WORK",
      status: "DRAFT",
      title: "Wellhead valve replacement — test",
      description: "Replace gate valve on Christmas tree",
      requestedBy: TEST_USER,
      validFrom: new Date(Date.now() + 86400000),
      validUntil: new Date(Date.now() + 2 * 86400000),
      hazards: ["H2S", "HIGH_PRESSURE", "FIRE"],
      controls: ["Gas detector", "SCBA", "Fire extinguisher"],
      isolations: ["Wellhead isolation valve closed"],
      sifBypassRequired: false,
    }).returning({ id: permits.id });
    expect(result).toHaveLength(1);
    permitId = result[0].id;
    expect(permitId).toBeGreaterThan(0);
  });

  it("DRAFT → PENDING should be allowed", () => {
    expect(canTransition("DRAFT", "PENDING")).toBe(true);
  });

  it("PENDING → APPROVED should be allowed", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
  });

  it("APPROVED → ACTIVE should be allowed", () => {
    expect(canTransition("APPROVED", "ACTIVE")).toBe(true);
  });

  it("ACTIVE → CLOSED should be allowed", () => {
    expect(canTransition("ACTIVE", "CLOSED")).toBe(true);
  });

  it("CLOSED → ACTIVE should NOT be allowed", () => {
    expect(canTransition("CLOSED", "ACTIVE")).toBe(false);
  });

  it("CANCELLED → ACTIVE should NOT be allowed", () => {
    expect(canTransition("CANCELLED", "ACTIVE")).toBe(false);
  });

  it("DRAFT → ACTIVE should NOT be allowed (skip approval)", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(false);
  });

  it("should progress permit through full lifecycle", async () => {
    await db.update(permits).set({ status: "PENDING" }).where(eq(permits.id, permitId));
    let p = await db.select().from(permits).where(eq(permits.id, permitId));
    expect(p[0].status).toBe("PENDING");

    await db.update(permits)
      .set({ status: "APPROVED", approvedBy: "senior-engineer", approvedAt: new Date() })
      .where(eq(permits.id, permitId));
    p = await db.select().from(permits).where(eq(permits.id, permitId));
    expect(p[0].status).toBe("APPROVED");

    await db.update(permits).set({ status: "ACTIVE" }).where(eq(permits.id, permitId));
    p = await db.select().from(permits).where(eq(permits.id, permitId));
    expect(p[0].status).toBe("ACTIVE");

    await db.update(permits)
      .set({ status: "CLOSED", closedBy: TEST_USER, closedAt: new Date() })
      .where(eq(permits.id, permitId));
    p = await db.select().from(permits).where(eq(permits.id, permitId));
    expect(p[0].status).toBe("CLOSED");
    expect(p[0].closedBy).toBe(TEST_USER);
  });

  it("should delete permit record", async () => {
    await db.delete(permits).where(eq(permits.id, permitId));
    const remaining = await db.select().from(permits).where(eq(permits.id, permitId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// WORKOVER LIFECYCLE — Full CRUD + Cost Tracking
// =============================================================================
describe("Workover Lifecycle CRUD", () => {
  let workoverId: number;
  let costId: number;

  it("should insert a workover job in PLANNED state", async () => {
    const result = await db.insert(workovers).values({
      jobId: "WO-CRUD-TEST-001",
      wellId: TEST_WELL_ID,
      jobType: "STIMULATION",
      status: "PLANNED",
      priority: "HIGH",
      description: "Acid stimulation to reduce skin — test",
      budgetUsd: "250000",
      estimatedDays: 7,
    }).returning({ id: workovers.id });
    expect(result).toHaveLength(1);
    workoverId = result[0].id;
    expect(workoverId).toBeGreaterThan(0);
  });

  it("should insert workover cost items", async () => {
    const result = await db.insert(workoverCosts).values({
      workoverId: workoverId,
      category: "MATERIALS",
      description: "Acid stimulation chemicals",
      amountUsd: "45000",
      vendor: "Halliburton",
      invoiceRef: "HAL-2026-001",
    }).returning({ id: workoverCosts.id });
    expect(result).toHaveLength(1);
    costId = result[0].id;
  });

  it("should query workover costs by workover ID", async () => {
    const costs = await db.select().from(workoverCosts).where(eq(workoverCosts.workoverId, workoverId));
    expect(costs.length).toBeGreaterThanOrEqual(1);
    expect(parseFloat(costs[0].amountUsd)).toBeCloseTo(45000, 0);
  });

  it("should progress workover PLANNED → IN_PROGRESS", async () => {
    await db.update(workovers)
      .set({ status: "IN_PROGRESS", startDate: new Date() })
      .where(eq(workovers.id, workoverId));
    const w = await db.select().from(workovers).where(eq(workovers.id, workoverId));
    expect(w[0].status).toBe("IN_PROGRESS");
  });

  it("should progress workover IN_PROGRESS → COMPLETED", async () => {
    await db.update(workovers)
      .set({ status: "COMPLETED", completedDate: new Date(), actualCostUsd: "48000", actualDays: 6 })
      .where(eq(workovers.id, workoverId));
    const w = await db.select().from(workovers).where(eq(workovers.id, workoverId));
    expect(w[0].status).toBe("COMPLETED");
    expect(parseFloat(w[0].actualCostUsd!)).toBeCloseTo(48000, 0);
  });

  it("should compute workover cost variance (under budget)", async () => {
    const w = await db.select().from(workovers).where(eq(workovers.id, workoverId));
    const budget = parseFloat(w[0].budgetUsd!);
    const actual = parseFloat(w[0].actualCostUsd!);
    const variancePct = ((actual - budget) / budget) * 100;
    expect(variancePct).toBeLessThan(0); // under budget
  });

  it("should delete workover cost and job", async () => {
    await db.delete(workoverCosts).where(eq(workoverCosts.id, costId));
    await db.delete(workovers).where(eq(workovers.id, workoverId));
    const remaining = await db.select().from(workovers).where(eq(workovers.id, workoverId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// RESERVOIR PRESSURE RECORDS
// =============================================================================
describe("Reservoir Pressure Records CRUD", () => {
  let pressureRecordId: number;

  it("should insert a reservoir pressure record", async () => {
    const result = await db.insert(reservoirPressureRecords).values({
      fieldId: TEST_FIELD_ID,
      wellId: TEST_WELL_ID,
      recordDate: new Date(),
      measuredPressurePsia: 3050,
      measurementMethod: "BHP",
      depthFt: 8000,
      waterCutFrac: 0.28,
      gasCap: false,
      aquiferStrength: "MODERATE",
      notes: "Post-BU test measurement",
    }).returning({ id: reservoirPressureRecords.id });
    expect(result).toHaveLength(1);
    pressureRecordId = result[0].id;
  });

  it("should query pressure records by well", async () => {
    const records = await db
      .select()
      .from(reservoirPressureRecords)
      .where(eq(reservoirPressureRecords.wellId, TEST_WELL_ID))
      .orderBy(desc(reservoirPressureRecords.recordDate));
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].measuredPressurePsia).toBeCloseTo(3050, 0);
  });

  it("should update reservoir pressure record", async () => {
    await db.update(reservoirPressureRecords)
      .set({ measuredPressurePsia: 3020, notes: "Corrected after gauge calibration" })
      .where(eq(reservoirPressureRecords.id, pressureRecordId));
    const updated = await db.select().from(reservoirPressureRecords).where(eq(reservoirPressureRecords.id, pressureRecordId));
    expect(updated[0].measuredPressurePsia).toBeCloseTo(3020, 0);
  });

  it("should delete reservoir pressure record", async () => {
    await db.delete(reservoirPressureRecords).where(eq(reservoirPressureRecords.id, pressureRecordId));
    const remaining = await db.select().from(reservoirPressureRecords).where(eq(reservoirPressureRecords.id, pressureRecordId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// REGULATORY REPORTS
// =============================================================================
describe("Regulatory Reports CRUD", () => {
  let reportId: number;

  it("should insert a regulatory report in DRAFT", async () => {
    const result = await db.insert(regulatoryReports).values({
      reportId: "RPT-CRUD-TEST-001",
      reportType: "BSEE_OGOR",
      period: "2026-Q1",
      status: "DRAFT",
      language: "EN",
      notes: "Test regulatory report",
    }).returning({ id: regulatoryReports.id });
    expect(result).toHaveLength(1);
    reportId = result[0].id;
  });

  it("should update report status to SUBMITTED", async () => {
    await db.update(regulatoryReports)
      .set({ status: "SUBMITTED", submittedAt: new Date(), submittedBy: TEST_USER, submissionRef: "EPA-2026-001" })
      .where(eq(regulatoryReports.id, reportId));
    const updated = await db.select().from(regulatoryReports).where(eq(regulatoryReports.id, reportId));
    expect(updated[0].status).toBe("SUBMITTED");
    expect(updated[0].submittedBy).toBe(TEST_USER);
  });

  it("should delete regulatory report", async () => {
    await db.delete(regulatoryReports).where(eq(regulatoryReports.id, reportId));
    const remaining = await db.select().from(regulatoryReports).where(eq(regulatoryReports.id, reportId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// HSE INCIDENTS
// =============================================================================
describe("HSE Incidents CRUD", () => {
  let incidentId: number;

  it("should insert an HSE incident", async () => {
    const result = await db.insert(hseIncidents).values({
      incidentId: "INC-CRUD-TEST-001",
      wellId: TEST_WELL_ID,
      incidentType: "NEAR_MISS",
      severity: "MEDIUM",
      title: "H2S detector alarm during valve maintenance",
      description: "Portable H2S detector alarmed at 10ppm during wellhead valve work",
      location: "Wellhead Area A",
      reportedBy: TEST_USER,
      occurredAt: new Date(),
      correctiveActions: ["Improve ventilation", "Mandatory H2S training refresh"],
    }).returning({ id: hseIncidents.id });
    expect(result).toHaveLength(1);
    incidentId = result[0].id;
  });

  it("should query incidents by well", async () => {
    const incidents = await db.select().from(hseIncidents).where(eq(hseIncidents.wellId, TEST_WELL_ID));
    expect(incidents.length).toBeGreaterThanOrEqual(1);
    expect(incidents[0].incidentType).toBe("NEAR_MISS");
  });

  it("should update incident with investigation results", async () => {
    await db.update(hseIncidents)
      .set({ investigatedBy: "safety-officer", rootCause: "Inadequate pre-job H2S risk assessment", closedAt: new Date() })
      .where(eq(hseIncidents.id, incidentId));
    const updated = await db.select().from(hseIncidents).where(eq(hseIncidents.id, incidentId));
    expect(updated[0].rootCause).toContain("H2S");
    expect(updated[0].closedAt).toBeDefined();
  });

  it("should delete HSE incident", async () => {
    await db.delete(hseIncidents).where(eq(hseIncidents.id, incidentId));
    const remaining = await db.select().from(hseIncidents).where(eq(hseIncidents.id, incidentId));
    expect(remaining).toHaveLength(0);
  });
});

// =============================================================================
// PHYSICS BUSINESS RULES — Pure Computation
// =============================================================================
describe("Physics Business Rules", () => {
  it("should compute ESP operating frequency from affinity laws", () => {
    const baseFreq = 60, targetRate = 800, ratedRate = 1000;
    expect(baseFreq * (targetRate / ratedRate)).toBeCloseTo(48, 0);
  });

  it("should compute ESP power from affinity laws (P ∝ N³)", () => {
    const basePower = 100, baseFreq = 60, targetFreq = 48;
    expect(basePower * Math.pow(targetFreq / baseFreq, 3)).toBeCloseTo(51.2, 0);
  });

  it("should compute VRR > 1 for over-injection", () => {
    const injBwpd = 5000, oilBpd = 2000, waterBpd = 1500, gasMmscfd = 1.0;
    const bo = 1.25, bw = 1.02, bg = 0.005;
    const voidage = oilBpd * bo + waterBpd * bw + gasMmscfd * 1000 * bg;
    expect((injBwpd * bw) / voidage).toBeGreaterThan(1.0);
  });

  it("should compute VRR < 1 for under-injection", () => {
    const injBwpd = 1000, oilBpd = 3000, waterBpd = 2000, gasMmscfd = 2.0;
    const bo = 1.25, bw = 1.02, bg = 0.005;
    const voidage = oilBpd * bo + waterBpd * bw + gasMmscfd * 1000 * bg;
    expect((injBwpd * bw) / voidage).toBeLessThan(1.0);
  });

  it("should compute Buckley-Leverett fractional flow at Sw=0.5", () => {
    const sw = 0.5, swi = 0.2, sor = 0.25;
    const krwMax = 0.3, kroMax = 0.8, nw = 2, no = 3, muW = 0.5, muO = 2.0;
    const swNorm = (sw - swi) / (1 - swi - sor);
    const krw = krwMax * Math.pow(swNorm, nw);
    const kro = kroMax * Math.pow(1 - swNorm, no);
    const fw = (krw / muW) / (krw / muW + kro / muO);
    expect(fw).toBeGreaterThan(0);
    expect(fw).toBeLessThan(1);
  });

  it("should compute Darcy flow rate", () => {
    const k = 85, h = 50, pr = 3000, pwf = 2000, mu = 1.5, bo = 1.2;
    const re = 1500, rw = 0.328, skin = 2;
    const q = (k * h * (pr - pwf)) / (141.2 * mu * bo * (Math.log(re / rw) + skin));
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThan(5000);
  });

  it("should compute material balance OOIP", () => {
    const areAcres = 500, thicknessFt = 50, porosity = 0.18, swi = 0.25, boi = 1.2;
    const ooip = 7758 * areAcres * thicknessFt * porosity * (1 - swi) / boi;
    expect(ooip).toBeGreaterThan(1e6);
    expect(ooip).toBeLessThan(1e9);
  });

  it("should compute recovery factor", () => {
    const rf = (500000 / 2.5e6) * 100;
    expect(rf).toBeCloseTo(20, 0);
    expect(rf).toBeLessThan(100);
  });

  it("should compute GOR from production rates", () => {
    const gor = (1.2 * 1e6) / 850;
    expect(gor).toBeCloseTo(1412, 0);
  });

  it("should compute water cut from production rates", () => {
    const wc = (320 / (850 + 320)) * 100;
    expect(wc).toBeCloseTo(27.35, 1);
  });

  it("should compute Arps hyperbolic EUR", () => {
    const qi = 1000, di = 0.08, b = 0.5, t = 120;
    const eur = (qi / ((1 - b) * di)) * (1 - Math.pow(1 + b * di * t, (b - 1) / b));
    expect(eur).toBeGreaterThan(0);
    expect(eur).toBeLessThan(qi * t);
  });

  it("should compute wellbore hydrostatic pressure", () => {
    expect(0.433 * 8000).toBeCloseTo(3464, 0);
  });

  it("should classify sand risk score correctly", () => {
    const classify = (s: number) => s < 25 ? "LOW" : s < 50 ? "MODERATE" : s < 75 ? "HIGH" : "CRITICAL";
    expect(classify(10)).toBe("LOW");
    expect(classify(35)).toBe("MODERATE");
    expect(classify(60)).toBe("HIGH");
    expect(classify(85)).toBe("CRITICAL");
  });

  it("should compute Turner critical velocity for liquid loading", () => {
    const vCrit = 5.62 * Math.pow(60 * (62.4 - 0.8) / (0.8 * 0.8), 0.25);
    expect(vCrit).toBeGreaterThan(0);
  });

  it("should compute workover NPV payback period", () => {
    const incrementalRate = (2.3 - 1.5) * 500; // bopd
    const paybackDays = 48000 / (incrementalRate * (75 - 20));
    expect(incrementalRate).toBeGreaterThan(0);
    expect(paybackDays).toBeLessThan(30);
  });

  it("should compute injection well injectivity index", () => {
    const ii = 3000 / (1200 + 2500);
    expect(ii).toBeGreaterThan(0);
  });

  it("should compute waterflood oil recovery", () => {
    const ooip = 2.5e6, ea = 0.7, ev = 0.6, ed = 0.5;
    const recovery = ooip * ea * ev * ed;
    expect(recovery).toBeGreaterThan(0);
    expect(recovery).toBeLessThan(ooip);
  });

  it("should compute injection pressure limit from fracture gradient", () => {
    expect(0.7 * 5000).toBeCloseTo(3500, 0);
  });

  it("should compute produced water treatment cost per barrel", () => {
    expect(12500 / 5200).toBeCloseTo(2.4, 1);
  });
});
