import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  wells,
  telemetryReadings,
  alarms,
  productionRecords,
  workovers,
  workoverCosts,
  calibrationRecords,
  permits,
  fpsoVessels,
  hpuUnits,
  subseaTrees,
  siteConnectivity,
  actuatorCommands,
  financialEntries,
  allocationRecords,
  shiftHandovers,
  regulatoryReports,
  hseIncidents,
  securityEvents,
  mlPredictions,
  digitalTwinScenarios,
  auditLog,
  incidentTriage,
} from "../../drizzle/schema";
import { nanoid } from "nanoid";
import { queryHighResolutionTelemetry } from "../influxdb";
import { startWorkoverWorkflow, listWorkflows, cancelWorkflow, getWorkflowStatus, startIncidentTriageWorkflow, isTemporalLive, getTemporalAddress } from "../temporal";
import { withCache, cacheDel, TTL, cachePublish } from "../cache";

// ─── SEED HELPER ──────────────────────────────────────────────────────────────
async function seedWellsIfEmpty(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  const existing = await db.select({ id: wells.id }).from(wells).limit(1);
  if (existing.length > 0) return;

  const seedWells = [
    { wellId: "PB-047", name: "Permian Basin #47", field: "Permian Basin", basin: "Permian", country: "USA", latitude: "31.9686", longitude: "-102.0779", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 8500, operator: "WT Petrotech USA", dataClassification: "INTERNAL" as const },
    { wellId: "PB-052", name: "Permian Basin #52", field: "Permian Basin", basin: "Permian", country: "USA", latitude: "31.9800", longitude: "-102.0900", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 9200, operator: "WT Petrotech USA", dataClassification: "INTERNAL" as const },
    { wellId: "KW-001", name: "Kuwait Well KW-001", field: "Greater Burgan", basin: "Kuwait", country: "Kuwait", latitude: "29.0000", longitude: "47.9000", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 12000, operator: "KOC", dataClassification: "CONFIDENTIAL" as const },
    { wellId: "KW-002", name: "Kuwait Well KW-002", field: "Greater Burgan", basin: "Kuwait", country: "Kuwait", latitude: "29.0100", longitude: "47.9100", status: "SHUT_IN" as const, wellType: "OIL" as const, depth: 11500, operator: "KOC", dataClassification: "CONFIDENTIAL" as const },
    { wellId: "UAE-001", name: "Abu Dhabi UAE-001", field: "Zakum", basin: "Abu Dhabi", country: "UAE", latitude: "24.4539", longitude: "54.3773", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 14000, operator: "ADNOC", dataClassification: "RESTRICTED" as const },
    { wellId: "UAE-002", name: "Abu Dhabi UAE-002", field: "Zakum", basin: "Abu Dhabi", country: "UAE", latitude: "24.4600", longitude: "54.3800", status: "WORKOVER" as const, wellType: "GAS" as const, depth: 13500, operator: "ADNOC", dataClassification: "RESTRICTED" as const },
    { wellId: "GOM-001", name: "Gulf of Mexico GOM-001", field: "Deepwater GOM", basin: "Gulf of Mexico", country: "USA", latitude: "28.5000", longitude: "-88.5000", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 22000, operator: "WT Petrotech USA", dataClassification: "CONFIDENTIAL" as const },
    { wellId: "NS-001", name: "North Sea NS-001", field: "Brent", basin: "North Sea", country: "UK", latitude: "61.0000", longitude: "1.7000", status: "ACTIVE" as const, wellType: "OIL" as const, depth: 9800, operator: "WT Petrotech USA", dataClassification: "INTERNAL" as const },
  ];

  for (const w of seedWells) {
    await db.insert(wells).values(w).onConflictDoNothing();
  }

  // Seed alarms
  const alarmSeeds = [
    { alarmId: "ALM-001", wellId: "PB-047", tag: "THP_HIGH", description: "Tubing Head Pressure High", severity: 1, state: "UNACKNOWLEDGED" as const, value: 2850, setpoint: 2800, unit: "psi", isa182Category: "PROCESS", isStanding: false, isChattering: false },
    { alarmId: "ALM-002", wellId: "KW-001", tag: "ESP_VIB_HIGH", description: "ESP Vibration High", severity: 2, state: "ACKNOWLEDGED" as const, value: 0.42, setpoint: 0.35, unit: "g", isa182Category: "EQUIPMENT", isStanding: true, isChattering: false },
    { alarmId: "ALM-003", wellId: "UAE-001", tag: "GAS_DETECT", description: "H2S Gas Detected", severity: 1, state: "UNACKNOWLEDGED" as const, value: 12, setpoint: 5, unit: "ppm", isa182Category: "SAFETY", isStanding: false, isChattering: false },
    { alarmId: "ALM-004", wellId: "PB-052", tag: "FLOW_LOW", description: "Flow Rate Low", severity: 3, state: "CLEARED" as const, value: 180, setpoint: 200, unit: "bbl/d", isa182Category: "PROCESS", isStanding: false, isChattering: true },
    { alarmId: "ALM-005", wellId: "GOM-001", tag: "SUBSEA_LEAK", description: "Subsea Leak Detected", severity: 1, state: "UNACKNOWLEDGED" as const, value: 1, setpoint: 0, unit: "bool", isa182Category: "SAFETY", isStanding: false, isChattering: false },
  ];
  for (const a of alarmSeeds) {
    await db.insert(alarms).values(a).onConflictDoNothing();
  }

  // Seed production records (last 14 days)
  const now = new Date();
  for (const w of seedWells.slice(0, 5)) {
    for (let d = 13; d >= 0; d--) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      await db.insert(productionRecords).values({
        wellId: w.wellId,
        date,
        oilBbls: Math.round(800 + Math.random() * 400),
        gasMmscf: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
        waterBbls: Math.round(200 + Math.random() * 100),
        uptimeHours: 22 + Math.random() * 2,
      }).onConflictDoNothing();
    }
  }

  // Seed telemetry
  for (const w of seedWells.slice(0, 6)) {
    await db.insert(telemetryReadings).values({
      wellId: w.wellId,
      tubingPressure: 2200 + Math.random() * 600,
      casingPressure: 1800 + Math.random() * 400,
      flowRate: 600 + Math.random() * 400,
      waterCut: 20 + Math.random() * 30,
      gasOilRatio: 500 + Math.random() * 200,
      espCurrent: 45 + Math.random() * 15,
      espFrequency: 55 + Math.random() * 5,
      espVibration: 0.15 + Math.random() * 0.2,
      espMotorTemp: 85 + Math.random() * 20,
      espInletPressure: 800 + Math.random() * 200,
      espDischargePressure: 2100 + Math.random() * 300,
      wellheadTemp: 65 + Math.random() * 20,
      chokePosition: 60 + Math.random() * 30,
      protocol: "MQTT",
      quality: 95 + Math.floor(Math.random() * 5),
    }).onConflictDoNothing();
  }

  // Seed workovers
  const workoverSeeds = [
    { jobId: "WO-2024-001", wellId: "PB-047", jobType: "PUMP_REPLACEMENT" as const, status: "IN_PROGRESS" as const, priority: "HIGH" as const, description: "ESP pump replacement due to bearing failure", trigger: "ESP vibration exceeded threshold", assignedTo: "John Martinez", estimatedDays: 5, budgetUsd: "85000.00", temporalWorkflowId: "wf-wo-2024-001", fromCalibration: false },
    { jobId: "WO-2024-002", wellId: "KW-001", jobType: "SCALE_REMOVAL" as const, status: "PLANNED" as const, priority: "MEDIUM" as const, description: "Calcium carbonate scale removal", trigger: "Production decline 15%", assignedTo: "Ahmed Al-Rashid", estimatedDays: 3, budgetUsd: "45000.00", temporalWorkflowId: "wf-wo-2024-002", fromCalibration: false },
    { jobId: "WO-2024-003", wellId: "UAE-002", jobType: "STIMULATION" as const, status: "COMPLETED" as const, priority: "HIGH" as const, description: "Acid stimulation to restore productivity", trigger: "Skin factor > 15", assignedTo: "Mohammed Al-Zaabi", estimatedDays: 4, budgetUsd: "120000.00", actualCostUsd: "118500.00", temporalWorkflowId: "wf-wo-2024-003", fromCalibration: false },
  ];
  for (const wo of workoverSeeds) {
    await db.insert(workovers).values(wo).onConflictDoNothing();
  }

  // Seed calibration records
  const calSeeds = [
    { sensorId: "PT-PB047-001", wellId: "PB-047", sensorType: "PRESSURE" as const, tag: "PT-THP-001", status: "OVERDUE" as const, qualityScore: 72, driftPct: 2.8, intervalDays: 90, nistTraceable: true, technician: "Tech A" },
    { sensorId: "FT-PB047-001", wellId: "PB-047", sensorType: "FLOW" as const, tag: "FT-PROD-001", status: "DUE_SOON" as const, qualityScore: 88, driftPct: 0.9, intervalDays: 90, nistTraceable: true, technician: "Tech B" },
    { sensorId: "VT-KW001-001", wellId: "KW-001", sensorType: "VIBRATION" as const, tag: "VT-ESP-001", status: "CURRENT" as const, qualityScore: 96, driftPct: 0.2, intervalDays: 180, nistTraceable: true, technician: "Tech C" },
    { sensorId: "PT-UAE001-001", wellId: "UAE-001", sensorType: "PRESSURE" as const, tag: "PT-CHP-001", status: "OVERDUE" as const, qualityScore: 68, driftPct: 3.5, intervalDays: 90, nistTraceable: true, technician: "Tech D" },
  ];
  for (const c of calSeeds) {
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + (c.status === "OVERDUE" ? -5 : 15));
    const lastCal = new Date();
    lastCal.setDate(lastCal.getDate() - c.intervalDays + (c.status === "OVERDUE" ? -5 : 15));
    await db.insert(calibrationRecords).values({ ...c, lastCalibratedAt: lastCal, nextDueAt: nextDue }).onConflictDoNothing();
  }

  // Seed permits
  const permitSeeds = [
    { permitId: "PTW-2024-001", wellId: "PB-047", permitType: "HOT_WORK" as const, status: "ACTIVE" as const, title: "Welding on ESP skid", description: "Repair weld on ESP skid base plate", location: "Well PB-047 surface facility", requestedBy: "John Martinez", approvedBy: "Sarah Chen", sifBypassRequired: false, hazards: ["Fire", "Burns"], controls: ["Fire watch", "Hot work permit"] },
    { permitId: "PTW-2024-002", wellId: "KW-001", permitType: "CONFINED_SPACE" as const, status: "PENDING" as const, title: "Separator vessel inspection", description: "Internal inspection of production separator", location: "KW-001 separator skid", requestedBy: "Ahmed Al-Rashid", sifBypassRequired: true, sifBypassed: "SIF-KW001-SEP-01", hazards: ["H2S", "Oxygen deficiency"], controls: ["Gas monitor", "Rescue team"] },
    { permitId: "PTW-2024-003", wellId: "UAE-001", permitType: "ELECTRICAL" as const, status: "APPROVED" as const, title: "MCC panel maintenance", description: "Routine MCC panel inspection and cleaning", location: "UAE-001 electrical room", requestedBy: "Mohammed Al-Zaabi", approvedBy: "Dr. Fatima Al-Hashimi", sifBypassRequired: false, hazards: ["Electrical shock"], controls: ["LOTO", "Insulated tools"] },
  ];
  for (const p of permitSeeds) {
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 1);
    await db.insert(permits).values({ ...p, validFrom, validUntil }).onConflictDoNothing();
  }

  // Seed FPSO
  await db.insert(fpsoVessels).values({
    vesselId: "FPSO-001",
    name: "Al Shaheen FPSO",
    imoNumber: "IMO9234567",
    field: "Al Shaheen",
    status: "OPERATIONAL",
    latitude: "25.9000",
    longitude: "51.5000",
    storageBbls: 2000000,
    currentInventoryBbls: 1450000,
    processingCapacityBpd: 300000,
    currentProductionBpd: 245000,
    dataClassification: "CONFIDENTIAL",
  }).onConflictDoNothing();

  // Seed HPU
  await db.insert(hpuUnits).values({
    hpuId: "HPU-001",
    fpsoId: "FPSO-001",
    name: "HPU Skid A",
    status: "RUNNING",
    systemPressureBar: 207,
    reservoirLevelPct: 82,
    pumpAStatus: "RUNNING",
    pumpBStatus: "STANDBY",
    filterDpBar: 0.8,
    oilTempC: 48,
  }).onConflictDoNothing();

  // Seed subsea trees
  const treeSeeds = [
    { treeId: "SST-001", wellId: "GOM-001", fpsoId: "FPSO-001", name: "Tree A1", status: "ACTIVE" as const, waterDepthM: 1850, latitude: "28.5010", longitude: "-88.5020", masterValveOpen: true, wingValveOpen: true, swabValveOpen: false, annulusMasterOpen: true, wellheadPressureBar: 285, flowTempC: 42 },
    { treeId: "SST-002", wellId: "GOM-001", fpsoId: "FPSO-001", name: "Tree A2", status: "SHUT_IN" as const, waterDepthM: 1855, latitude: "28.5020", longitude: "-88.5030", masterValveOpen: false, wingValveOpen: false, swabValveOpen: false, annulusMasterOpen: true, wellheadPressureBar: 310, flowTempC: 38 },
  ];
  for (const t of treeSeeds) {
    await db.insert(subseaTrees).values(t).onConflictDoNothing();
  }

  // Seed site connectivity
  const connSeeds = [
    { siteId: "SITE-PB047", wellId: "PB-047", siteName: "Permian Basin #47", status: "ONLINE" as const, protocol: "MODBUS_TCP" as const, linkQualityPct: 98, latencyMs: 12, isSolarPowered: false, edgeAgentVersion: "2.4.1" },
    { siteId: "SITE-KW001", wellId: "KW-001", siteName: "Kuwait Well KW-001", status: "ONLINE" as const, protocol: "OPC_UA" as const, linkQualityPct: 95, latencyMs: 45, isSolarPowered: false, edgeAgentVersion: "2.4.1" },
    { siteId: "SITE-UAE001", wellId: "UAE-001", siteName: "Abu Dhabi UAE-001", status: "DEGRADED" as const, protocol: "DNP3" as const, linkQualityPct: 72, latencyMs: 180, isSolarPowered: true, solarVolts: 24.2, batteryPct: 78, edgeAgentVersion: "2.4.0" },
    { siteId: "SITE-NS001", wellId: "NS-001", siteName: "North Sea NS-001", status: "ONLINE" as const, protocol: "MQTT" as const, linkQualityPct: 88, latencyMs: 95, isSolarPowered: false, edgeAgentVersion: "2.4.1" },
  ];
  for (const s of connSeeds) {
    await db.insert(siteConnectivity).values({ ...s, lastSeenAt: new Date() }).onConflictDoNothing();
  }

  // Seed financial entries
  const finSeeds = [
    { entryId: "FIN-001", wellId: "PB-047", entryType: "REVENUE" as const, description: "Oil sales - March 2024", amountUsd: "1250000.00", counterparty: "Shell Trading", status: "POSTED" as const },
    { entryId: "FIN-002", wellId: "KW-001", entryType: "ROYALTY" as const, description: "KPC royalty payment Q1 2024", amountUsd: "375000.00", counterparty: "Kuwait Petroleum Corp", status: "SETTLED" as const },
    { entryId: "FIN-003", wellId: "UAE-001", entryType: "OPEX" as const, description: "Well services - February 2024", amountUsd: "85000.00", counterparty: "Halliburton", status: "POSTED" as const },
    { entryId: "FIN-004", wellId: "PB-052", entryType: "CAPEX" as const, description: "ESP replacement - WO-2024-001", amountUsd: "85000.00", counterparty: "Baker Hughes", status: "PENDING" as const },
  ];
  for (const f of finSeeds) {
    await db.insert(financialEntries).values({ ...f, valueDate: new Date() }).onConflictDoNothing();
  }

  // Seed HSE incidents
  await db.insert(hseIncidents).values({
    incidentId: "HSE-2024-001",
    wellId: "PB-047",
    incidentType: "NEAR_MISS",
    severity: "LOW",
    title: "Dropped object near ESP skid",
    description: "Wrench dropped from 2m height, no injury",
    location: "PB-047 wellhead area",
    reportedBy: "John Martinez",
    iogpCode: "NM-01",
    lostTimeDays: 0,
    occurredAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
  }).onConflictDoNothing();

  // Seed security events
  await db.insert(securityEvents).values({
    eventId: "SEC-2024-001",
    eventType: "INTRUSION_ATTEMPT",
    severity: "HIGH",
    source: "192.168.100.45",
    target: "OPC-UA Server KW-001",
    description: "Unauthorized OPC-UA connection attempt from unregistered IP",
    iec62443Zone: "Level 2 - Control",
    mitigated: true,
    mitigatedAt: new Date(),
    mitigatedBy: "SOC Analyst",
    occurredAt: new Date(Date.now() - 2 * 3600 * 1000),
  }).onConflictDoNothing();

  // Seed ML predictions
  for (const w of seedWells.slice(0, 5)) {
    await db.insert(mlPredictions).values({
      wellId: w.wellId,
      modelType: "ESP_FAILURE",
      healthScore: 60 + Math.random() * 35,
      failureProbability: Math.random() * 0.4,
      daysToFailure: Math.floor(30 + Math.random() * 90),
      confidence: 0.85 + Math.random() * 0.1,
      anomalyScore: Math.random() * 0.3,
      recommendation: "Monitor ESP vibration trend. Schedule inspection within 30 days.",
      modelVersion: "v2.3.1",
    }).onConflictDoNothing();
  }
}

// ─── WELLS ROUTER ─────────────────────────────────────────────────────────────
export const wellsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ACTIVE", "SHUT_IN", "DRILLING", "WORKOVER", "ABANDONED"]).optional(),
      country: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(wells).orderBy(desc(wells.createdAt));
      return rows.filter(w => {
        if (input?.status && w.status !== input.status) return false;
        if (input?.country && w.country !== input.country) return false;
        if (input?.search) {
          const s = input.search.toLowerCase();
          return w.name.toLowerCase().includes(s) || w.wellId.toLowerCase().includes(s) || w.field.toLowerCase().includes(s);
        }
        return true;
      });
    }),

  byId: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(wells).where(eq(wells.wellId, input.wellId)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      field: z.string().min(1),
      basin: z.string().optional(),
      country: z.string().default("Kuwait"),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      status: z.enum(["ACTIVE", "SHUT_IN", "DRILLING", "WORKOVER", "ABANDONED"]).default("ACTIVE"),
      wellType: z.enum(["OIL", "GAS", "WATER_INJECTION", "DISPOSAL", "OBSERVATION"]).default("OIL"),
      depth: z.number().optional(),
      operator: z.string().optional(),
      dataClassification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).default("INTERNAL"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const wellId = `WELL-${nanoid(6).toUpperCase()}`;
      await db.insert(wells).values({ ...input, wellId });
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CREATE_WELL", resource: "wells", resourceId: wellId, details: input });
      return { wellId };
    }),

  update: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      status: z.enum(["ACTIVE", "SHUT_IN", "DRILLING", "WORKOVER", "ABANDONED"]).optional(),
      operator: z.string().optional(),
      dataClassification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { wellId, ...updates } = input;
      await db.update(wells).set(updates).where(eq(wells.wellId, wellId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "UPDATE_WELL", resource: "wells", resourceId: wellId, details: updates });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(wells).where(eq(wells.wellId, input.wellId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "DELETE_WELL", resource: "wells", resourceId: input.wellId });
      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, active: 0, shutIn: 0, workover: 0, drilling: 0 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(wells);
    return {
      total: rows.length,
      active: rows.filter(w => w.status === "ACTIVE").length,
      shutIn: rows.filter(w => w.status === "SHUT_IN").length,
      workover: rows.filter(w => w.status === "WORKOVER").length,
      drilling: rows.filter(w => w.status === "DRILLING").length,
    };
  }),
});

// ─── TELEMETRY ROUTER ─────────────────────────────────────────────────────────
export const telemetryRouter = router({
  latest: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(telemetryReadings)
        .where(eq(telemetryReadings.wellId, input.wellId))
        .orderBy(desc(telemetryReadings.recordedAt))
        .limit(1);
      return rows[0] ?? null;
    }),

  history: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      hours: z.number().default(24),
      /**
       * resolution: 'standard' queries PostgreSQL (1-min aggregates, up to 500 rows).
       * resolution: 'high' queries InfluxDB for sub-second SCADA data (10-sec aggregates).
       * Falls back to PostgreSQL when InfluxDB is unavailable.
       */
      resolution: z.enum(["standard", "high"]).default("standard"),
    }))
    .query(async ({ input }) => {
      // High-resolution path: InfluxDB with 10-second aggregates
      if (input.resolution === "high") {
        const influxData = await queryHighResolutionTelemetry(
          input.wellId,
          ["pressure", "temperature", "flow_rate", "choke_position"],
          input.hours,
          10
        );
        if (influxData.length > 0) {
          // Transform InfluxDB rows into the same shape as PostgreSQL rows
          const grouped: Record<string, Record<string, number>> = {};
          for (const pt of influxData) {
            if (!grouped[pt.time]) grouped[pt.time] = {};
            grouped[pt.time][pt.field] = pt.value;
          }
          return Object.entries(grouped).map(([time, fields]) => ({
            id: `influx-${time}`,
            wellId: input.wellId,
            recordedAt: new Date(time),
            tubingPressure: String(fields["pressure"] ?? null),
            casingPressure: null,
            flowRate: String(fields["flow_rate"] ?? null),
            waterCut: null,
            gasOilRatio: null,
            espCurrent: null,
            espFrequency: null,
            espVibration: null,
            espMotorTemp: String(fields["temperature"] ?? null),
            chokePosition: String(fields["choke_position"] ?? null),
            protocol: "MQTT" as const,
            quality: 100,
            source: "influxdb" as const,
          }));
        }
        // Fall through to PostgreSQL when InfluxDB returns no data
      }

      // Standard path: PostgreSQL
      const db = await getDb();
      if (!db) return [];
      const since = new Date(Date.now() - input.hours * 3600 * 1000);
      const rows = await db.select().from(telemetryReadings)
        .where(and(eq(telemetryReadings.wellId, input.wellId), gte(telemetryReadings.recordedAt, since)))
        .orderBy(desc(telemetryReadings.recordedAt))
        .limit(500);
      return rows.map(r => ({ ...r, source: "postgres" as const }));
    }),

  ingest: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      tubingPressure: z.number().optional(),
      casingPressure: z.number().optional(),
      flowRate: z.number().optional(),
      waterCut: z.number().optional(),
      gasOilRatio: z.number().optional(),
      espCurrent: z.number().optional(),
      espFrequency: z.number().optional(),
      espVibration: z.number().optional(),
      espMotorTemp: z.number().optional(),
      protocol: z.enum(["MQTT", "MODBUS_TCP", "MODBUS_RTU", "OPC_UA", "DNP3", "HART"]).default("MQTT"),
      quality: z.number().default(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(telemetryReadings).values(input);
      return { success: true };
    }),

  getLiveStreamStatus: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const TELEMETRY_SERVICE_URL = process.env.TELEMETRY_SERVICE_URL ?? "http://localhost:8082";
      try {
        const res = await fetch(`${TELEMETRY_SERVICE_URL}/api/v1/live-stream-status`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const status = await res.json() as {
          connected: boolean;
          source: string;
          messages_per_sec: number;
          total_consumed: number;
          consumer_lag: number;
          last_message_at: string;
          active_wells: string[];
        };
        const isWellLive = input.wellId
          ? (status.active_wells ?? []).includes(input.wellId)
          : status.connected;
        return {
          live: isWellLive,
          source: status.source ?? "unknown",
          messagesPerSec: status.messages_per_sec ?? 0,
          totalConsumed: status.total_consumed ?? 0,
          consumerLag: status.consumer_lag ?? 0,
          lastMessageAt: status.last_message_at ? new Date(status.last_message_at) : null,
          activeWells: status.active_wells ?? [],
        };
      } catch {
        return {
          live: false,
          source: "unavailable",
          messagesPerSec: 0,
          totalConsumed: 0,
          consumerLag: 0,
          lastMessageAt: null,
          activeWells: [],
        };
      }
    }),
});

// ─── ALARMS ROUTER ────────────────────────────────────────────────────────────
export const alarmsRouter = router({
  list: protectedProcedure
    .input(z.object({
      state: z.enum(["UNACKNOWLEDGED", "ACKNOWLEDGED", "CLEARED", "SUPPRESSED"]).optional(),
      severity: z.number().optional(),
      wellId: z.string().optional(),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ input }) => {
      const cacheKey = `og-rmm:alarms:list:${input?.limit ?? 100}:${input?.state ?? "all"}:${input?.wellId ?? "all"}`;
      return withCache(cacheKey, TTL.ALARMS_LIST, async () => {
        const db = await getDb();
        if (!db) return [];
        await seedWellsIfEmpty(db);
        const rows = await db.select().from(alarms).orderBy(desc(alarms.createdAt)).limit(input?.limit ?? 100);
        return rows.filter(a => {
          if (input?.state && a.state !== input.state) return false;
          if (input?.severity && a.severity !== input.severity) return false;
          if (input?.wellId && a.wellId !== input.wellId) return false;
          return true;
        });
      });
    }),

  acknowledge: protectedProcedure
    .input(z.object({ alarmId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(alarms).set({
        state: "ACKNOWLEDGED",
        acknowledgedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
        acknowledgedAt: new Date(),
      }).where(eq(alarms.alarmId, input.alarmId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "ACK_ALARM", resource: "alarms", resourceId: input.alarmId });
      // Invalidate alarm caches and publish event
      await cacheDel(`og-rmm:alarms:list:100:all:all`, `og-rmm:alarms:list:200:all:all`, "og-rmm:alarms:stats", "og-rmm:overview:kpis");
      await cachePublish("og-rmm:alarm:acknowledged", { alarmId: input.alarmId, by: ctx.user.name, timestamp: new Date().toISOString() });
      return { success: true };
    }),

  suppress: protectedProcedure
    .input(z.object({ alarmId: z.string(), hours: z.number().default(4) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const suppressedUntil = new Date(Date.now() + input.hours * 3600 * 1000);
      await db.update(alarms).set({ state: "SUPPRESSED", suppressedUntil }).where(eq(alarms.alarmId, input.alarmId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "SUPPRESS_ALARM", resource: "alarms", resourceId: input.alarmId, details: { hours: input.hours } });
      await cacheDel(`og-rmm:alarms:list:100:all:all`, "og-rmm:alarms:stats");
      return { success: true };
    }),

  clear: protectedProcedure
    .input(z.object({ alarmId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(alarms).set({ state: "CLEARED", clearedAt: new Date() }).where(eq(alarms.alarmId, input.alarmId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CLEAR_ALARM", resource: "alarms", resourceId: input.alarmId });
      await cacheDel(`og-rmm:alarms:list:100:all:all`, "og-rmm:alarms:stats", "og-rmm:overview:kpis");
      await cachePublish("og-rmm:alarm:cleared", { alarmId: input.alarmId, timestamp: new Date().toISOString() });
      return { success: true };
    }),

  bulkAcknowledge: protectedProcedure
    .input(z.object({ alarmIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      for (const alarmId of input.alarmIds) {
        await db.update(alarms).set({
          state: "ACKNOWLEDGED",
          acknowledgedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
          acknowledgedAt: new Date(),
        }).where(eq(alarms.alarmId, alarmId));
      }
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "BULK_ACK_ALARMS", resource: "alarms", details: { count: input.alarmIds.length } });
      await cacheDel(`og-rmm:alarms:list:100:all:all`, `og-rmm:alarms:list:200:all:all`, "og-rmm:alarms:stats", "og-rmm:overview:kpis");
      return { success: true, count: input.alarmIds.length };
    }),

  bulkClear: protectedProcedure
    .input(z.object({ alarmIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      for (const alarmId of input.alarmIds) {
        await db.update(alarms).set({ state: "CLEARED", clearedAt: new Date() }).where(eq(alarms.alarmId, alarmId));
      }
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "BULK_CLEAR_ALARMS", resource: "alarms", details: { count: input.alarmIds.length } });
      await cacheDel(`og-rmm:alarms:list:100:all:all`, "og-rmm:alarms:stats", "og-rmm:overview:kpis");
      return { success: true, count: input.alarmIds.length };
    }),

  bulkSuppress: protectedProcedure
    .input(z.object({ alarmIds: z.array(z.string()), hours: z.number().default(4) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const suppressedUntil = new Date(Date.now() + input.hours * 3600 * 1000);
      for (const alarmId of input.alarmIds) {
        await db.update(alarms).set({ state: "SUPPRESSED", suppressedUntil }).where(eq(alarms.alarmId, alarmId));
      }
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "BULK_SUPPRESS_ALARMS", resource: "alarms", details: { count: input.alarmIds.length, hours: input.hours } });
      await cacheDel(`og-rmm:alarms:list:100:all:all`, "og-rmm:alarms:stats");
      return { success: true, count: input.alarmIds.length };
    }),

  stats: protectedProcedure.query(async () => {
    return withCache("og-rmm:alarms:stats", TTL.ALARMS_LIST, async () => {
      const db = await getDb();
      if (!db) return { critical: 0, high: 0, medium: 0, unacknowledged: 0, standing: 0, chattering: 0 };
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(alarms);
      return {
        critical: rows.filter(a => a.severity === 1).length,
        high: rows.filter(a => a.severity === 2).length,
        medium: rows.filter(a => a.severity === 3).length,
        unacknowledged: rows.filter(a => a.state === "UNACKNOWLEDGED").length,
        standing: rows.filter(a => a.isStanding).length,
        chattering: rows.filter(a => a.isChattering).length,
      };
    });
  }),

  isaDaily: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
        const rows = await db.select().from(alarms).where(gte(alarms.createdAt, since));
        const byDay: Record<string, { total: number; standing: number; chattering: number; suppressed: number }> = {};
        for (const a of rows) {
          const d = new Date(a.createdAt ?? Date.now());
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          if (!byDay[label]) byDay[label] = { total: 0, standing: 0, chattering: 0, suppressed: 0 };
          byDay[label].total++;
          if (a.isStanding) byDay[label].standing++;
          if (a.isChattering) byDay[label].chattering++;
          if (a.state === "SUPPRESSED") byDay[label].suppressed++;
        }
        return Object.entries(byDay).map(([date, v]) => ({
          date,
          alarmRate: +(v.total / 24).toFixed(2),
          standing: v.standing,
          chattering: v.chattering,
          floods: 0,
          suppressed: v.suppressed,
          isa_limit: 1.0,
        }));
      } catch { return []; }
    }),

  priorityDist: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(alarms);
    return [
      { name: "Critical", value: rows.filter(a => a.severity === 1).length, color: "#ef4444" },
      { name: "High",     value: rows.filter(a => a.severity === 2).length, color: "#f97316" },
      { name: "Medium",   value: rows.filter(a => a.severity === 3).length, color: "#eab308" },
      { name: "Low",      value: rows.filter(a => a.severity === 4).length, color: "#6b7280" },
    ];
  }),

  chatteringList: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(alarms).where(eq(alarms.isChattering, true));
    const byTag: Record<string, { tag: string; description: string; wellId: string; count: number }> = {};
    for (const a of rows) {
      const key = a.tag;
      if (!byTag[key]) byTag[key] = { tag: a.tag, description: a.description, wellId: a.wellId, count: 0 };
      byTag[key].count++;
    }
    return Object.values(byTag).sort((a, b) => b.count - a.count).slice(0, 10).map(r => ({
      ...r,
      last24h: Math.ceil(r.count * 0.25),
    }));
  }),
});

// ─── PRODUCTION ROUTER ────────────────────────────────────────────────────────
export const productionRouter = router({
  daily: protectedProcedure
    .input(z.object({ wellId: z.string().optional(), days: z.number().default(14) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
      const rows = await db.select().from(productionRecords)
        .where(input.wellId
          ? and(eq(productionRecords.wellId, input.wellId), gte(productionRecords.date, since))
          : gte(productionRecords.date, since))
        .orderBy(productionRecords.date);
      return rows;
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalBpd: 0, totalGasMmscfd: 0, totalWaterBpd: 0, uptimePct: 0 };
    await seedWellsIfEmpty(db);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await db.select().from(productionRecords).where(gte(productionRecords.date, yesterday));
    const totalBpd = rows.reduce((s, r) => s + (r.oilBbls ?? 0), 0);
    const totalGas = rows.reduce((s, r) => s + (r.gasMmscf ?? 0), 0);
    const totalWater = rows.reduce((s, r) => s + (r.waterBbls ?? 0), 0);
    const avgUptime = rows.length > 0 ? rows.reduce((s, r) => s + (r.uptimeHours ?? 24), 0) / rows.length : 24;
    return { totalBpd, totalGasMmscfd: totalGas, totalWaterBpd: totalWater, uptimePct: (avgUptime / 24) * 100 };
  }),

  record: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      date: z.date(),
      oilBbls: z.number().default(0),
      gasMmscf: z.number().default(0),
      waterBbls: z.number().default(0),
      uptimeHours: z.number().default(24),
      downtime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(productionRecords).values(input);
      return { success: true };
    }),
});

// ─── WORKOVERS ROUTER ─────────────────────────────────────────────────────────
export const workoverRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["PLANNED", "MOBILIZING", "IN_PROGRESS", "SUSPENDED", "COMPLETED", "CANCELLED"]).optional(),
      wellId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(workovers).orderBy(desc(workovers.createdAt));
      return rows.filter(w => {
        if (input?.status && w.status !== input.status) return false;
        if (input?.wellId && w.wellId !== input.wellId) return false;
        return true;
      });
    }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      jobType: z.enum(["PUMP_REPLACEMENT", "TUBING_REPAIR", "STIMULATION", "PERFORATION", "SAND_CONTROL", "SCALE_REMOVAL", "CALIBRATION", "INSPECTION", "OTHER"]),
      priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
      description: z.string().optional(),
      trigger: z.string().optional(),
      assignedTo: z.string().optional(),
      estimatedDays: z.number().optional(),
      budgetUsd: z.string().optional(),
      fromCalibration: z.boolean().default(false),
      calibrationSensorId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const jobId = `WO-${new Date().getFullYear()}-${nanoid(4).toUpperCase()}`;

      // Start Temporal durable workflow for the workover lifecycle
      const { workflowId: temporalWorkflowId, runId } = await startWorkoverWorkflow({
        workoverJobId: jobId,
        wellId: input.wellId,
        jobType: input.jobType,
        estimatedDays: input.estimatedDays ?? 3,
        estimatedCost: Number(input.budgetUsd ?? 0),
        contractor: input.assignedTo ?? "TBD",
        description: input.description ?? "",
        requestedBy: ctx.user.name ?? ctx.user.openId,
      });

      await db.insert(workovers).values({ ...input, jobId, temporalWorkflowId, status: "PLANNED" });
      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? "",
        action: "CREATE_WORKOVER",
        resource: "workovers",
        resourceId: jobId,
        details: { ...input, temporalWorkflowId, temporalRunId: runId },
      });
      return { jobId, temporalWorkflowId };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      jobId: z.string(),
      status: z.enum(["PLANNED", "MOBILIZING", "IN_PROGRESS", "SUSPENDED", "COMPLETED", "CANCELLED"]),
      actualCostUsd: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { jobId, ...updates } = input;
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === "COMPLETED") updateData.completedDate = new Date();
      await db.update(workovers).set(updateData).where(eq(workovers.jobId, jobId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "UPDATE_WORKOVER_STATUS", resource: "workovers", resourceId: jobId, details: updates });
      return { success: true };
    }),

  addCost: protectedProcedure
    .input(z.object({
      workoverId: z.number(),
      category: z.enum(["LABOR", "EQUIPMENT", "MATERIALS", "TRANSPORT", "THIRD_PARTY", "OTHER"]),
      description: z.string().optional(),
      amountUsd: z.string(),
      vendor: z.string().optional(),
      invoiceRef: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(workoverCosts).values(input);
      return { success: true };
    }),

  costs: protectedProcedure
    .input(z.object({ workoverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workoverCosts).where(eq(workoverCosts.workoverId, input.workoverId));
    }),
});

// ─── CALIBRATION ROUTER ───────────────────────────────────────────────────────
export const calibrationRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["CURRENT", "DUE_SOON", "OVERDUE", "IN_PROGRESS", "FAILED"]).optional(),
      wellId: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(calibrationRecords).orderBy(calibrationRecords.nextDueAt);
      return rows.filter(c => {
        if (input?.status && c.status !== input.status) return false;
        if (input?.wellId && c.wellId !== input.wellId) return false;
        return true;
      });
    }),

  update: adminProcedure
    .input(z.object({
      sensorId: z.string(),
      status: z.enum(["CURRENT", "DUE_SOON", "OVERDUE", "IN_PROGRESS", "FAILED"]).optional(),
      qualityScore: z.number().optional(),
      driftPct: z.number().optional(),
      lastCalibratedAt: z.date().optional(),
      nextDueAt: z.date().optional(),
      certificateRef: z.string().optional(),
      technician: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { sensorId, ...updates } = input;
      await db.update(calibrationRecords).set(updates).where(eq(calibrationRecords.sensorId, sensorId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "UPDATE_CALIBRATION", resource: "calibration", resourceId: sensorId, details: updates });
      return { success: true };
    }),

  generateWorkover: adminProcedure
    .input(z.object({ sensorId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const sensors = await db.select().from(calibrationRecords).where(eq(calibrationRecords.sensorId, input.sensorId)).limit(1);
      if (!sensors[0]) throw new Error("Sensor not found");
      const sensor = sensors[0];
      const jobId = `WO-CAL-${nanoid(6).toUpperCase()}`;
      const [newWo] = await db.insert(workovers).values({
        jobId,
        wellId: sensor.wellId,
        jobType: "CALIBRATION",
        status: "PLANNED",
        priority: sensor.status === "OVERDUE" ? "HIGH" : "MEDIUM",
        description: `Calibration workover for sensor ${sensor.tag}`,
        trigger: `Sensor drift: ${sensor.driftPct}%, quality score: ${sensor.qualityScore}%`,
        fromCalibration: true,
        calibrationSensorId: sensor.sensorId,
        temporalWorkflowId: `wf-${jobId.toLowerCase()}`,
      }).returning({ id: workovers.id });
      if (newWo) {
        await db.update(calibrationRecords).set({ workoverId: newWo.id }).where(eq(calibrationRecords.sensorId, input.sensorId));
      }
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "GENERATE_CALIBRATION_WORKOVER", resource: "calibration", resourceId: input.sensorId, details: { jobId } });
      return { jobId };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { overdue: 0, dueSoon: 0, current: 0, avgQuality: 100 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(calibrationRecords);
    return {
      overdue: rows.filter(c => c.status === "OVERDUE").length,
      dueSoon: rows.filter(c => c.status === "DUE_SOON").length,
      current: rows.filter(c => c.status === "CURRENT").length,
      avgQuality: rows.length > 0 ? Math.round(rows.reduce((s, c) => s + (c.qualityScore ?? 100), 0) / rows.length) : 100,
    };
  }),
});

// ─── FPSO ROUTER ──────────────────────────────────────────────────────────────
export const fpsoRouter = router({
  vessels: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedWellsIfEmpty(db);
    return db.select().from(fpsoVessels).orderBy(fpsoVessels.name);
  }),

  hpuUnits: protectedProcedure
    .input(z.object({ fpsoId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(hpuUnits);
      return input.fpsoId ? rows.filter(h => h.fpsoId === input.fpsoId) : rows;
    }),

  subseaTrees: protectedProcedure
    .input(z.object({ fpsoId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(subseaTrees);
      return input.fpsoId ? rows.filter(t => t.fpsoId === input.fpsoId) : rows;
    }),

  updateHpu: protectedProcedure
    .input(z.object({
      hpuId: z.string(),
      systemPressureBar: z.number().optional(),
      reservoirLevelPct: z.number().optional(),
      pumpAStatus: z.enum(["RUNNING", "STANDBY", "FAULT"]).optional(),
      pumpBStatus: z.enum(["RUNNING", "STANDBY", "FAULT"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { hpuId, ...updates } = input;
      await db.update(hpuUnits).set(updates).where(eq(hpuUnits.hpuId, hpuId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "UPDATE_HPU", resource: "hpu", resourceId: hpuId, details: updates });
      return { success: true };
    }),

  updateTree: protectedProcedure
    .input(z.object({
      treeId: z.string(),
      masterValveOpen: z.boolean().optional(),
      wingValveOpen: z.boolean().optional(),
      swabValveOpen: z.boolean().optional(),
      status: z.enum(["ACTIVE", "SHUT_IN", "MAINTENANCE", "ABANDONED"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { treeId, ...updates } = input;
      await db.update(subseaTrees).set(updates).where(eq(subseaTrees.treeId, treeId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "UPDATE_SUBSEA_TREE", resource: "subsea_trees", resourceId: treeId, details: updates });
      return { success: true };
    }),
});

// ─── CONNECTIVITY ROUTER ──────────────────────────────────────────────────────
export const connectivityRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedWellsIfEmpty(db);
    return db.select().from(siteConnectivity).orderBy(siteConnectivity.siteName);
  }),

  update: protectedProcedure
    .input(z.object({
      siteId: z.string(),
      status: z.enum(["ONLINE", "DEGRADED", "OFFLINE", "BUFFERING", "MAINTENANCE"]).optional(),
      linkQualityPct: z.number().optional(),
      latencyMs: z.number().optional(),
      bufferDepth: z.number().optional(),
      solarVolts: z.number().optional(),
      batteryPct: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { siteId, ...updates } = input;
      await db.update(siteConnectivity).set({ ...updates, lastSeenAt: new Date() }).where(eq(siteConnectivity.siteId, siteId));
      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { online: 0, degraded: 0, offline: 0, avgQuality: 0 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(siteConnectivity);
    return {
      online: rows.filter(s => s.status === "ONLINE").length,
      degraded: rows.filter(s => s.status === "DEGRADED").length,
      offline: rows.filter(s => s.status === "OFFLINE").length,
      avgQuality: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.linkQualityPct ?? 0), 0) / rows.length) : 0,
    };
  }),
});

// ─── ACTUATOR ROUTER ──────────────────────────────────────────────────────────
export const actuatorRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(actuatorCommands).orderBy(desc(actuatorCommands.createdAt)).limit(50);
      return input.wellId ? rows.filter(a => a.wellId === input.wellId) : rows;
    }),

  sendCommand: adminProcedure
    .input(z.object({
      wellId: z.string(),
      assetId: z.string(),
      assetName: z.string().optional(),
      commandType: z.enum(["VALVE_OPEN", "VALVE_CLOSE", "CHOKE_SETPOINT", "PRESSURE_SETPOINT", "PUMP_START", "PUMP_STOP", "ESD_ACTIVATE", "ESD_RESET"]),
      targetValue: z.number().optional(),
      confirmationCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const commandId = `CMD-${nanoid(8).toUpperCase()}`;
      await db.insert(actuatorCommands).values({
        ...input,
        commandId,
        issuedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
        status: "SENT",
        auditTrail: [{ timestamp: new Date().toISOString(), action: "ISSUED", user: ctx.user.email }],
      });
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "SEND_ACTUATOR_COMMAND", resource: "actuator_commands", resourceId: commandId, details: input });
      return { commandId };
    }),

  updateStatus: adminProcedure
    .input(z.object({
      commandId: z.string(),
      status: z.enum(["PENDING", "SENT", "ACKNOWLEDGED", "EXECUTED", "FAILED", "CANCELLED"]),
      failureReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { commandId, ...updates } = input;
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.status === "EXECUTED") updateData.executedAt = new Date();
      await db.update(actuatorCommands).set(updateData).where(eq(actuatorCommands.commandId, commandId));
      return { success: true };
    }),
});

// ─── FINANCIALS ROUTER ────────────────────────────────────────────────────────
export const financialsRouter = router({
  list: protectedProcedure
    .input(z.object({
      entryType: z.enum(["REVENUE", "ROYALTY", "OPEX", "CAPEX", "TAX", "SETTLEMENT", "ADJUSTMENT"]).optional(),
      wellId: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(financialEntries).orderBy(desc(financialEntries.createdAt)).limit(input?.limit ?? 50);
      return rows.filter(f => {
        if (input?.entryType && f.entryType !== input.entryType) return false;
        if (input?.wellId && f.wellId !== input.wellId) return false;
        return true;
      });
    }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      entryType: z.enum(["REVENUE", "ROYALTY", "OPEX", "CAPEX", "TAX", "SETTLEMENT", "ADJUSTMENT"]),
      description: z.string(),
      amountUsd: z.string(),
      currency: z.string().default("USD"),
      counterparty: z.string().optional(),
      valueDate: z.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const entryId = `FIN-${nanoid(6).toUpperCase()}`;
      await db.insert(financialEntries).values({ ...input, entryId, status: "PENDING" });
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CREATE_FINANCIAL_ENTRY", resource: "financial_entries", resourceId: entryId, details: input });
      return { entryId };
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalRevenue: 0, totalOpex: 0, totalCapex: 0, totalRoyalties: 0, netIncome: 0 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(financialEntries);
    const sum = (type: string) => rows.filter(r => r.entryType === type).reduce((s, r) => s + parseFloat(r.amountUsd ?? "0"), 0);
    const totalRevenue = sum("REVENUE");
    const totalOpex = sum("OPEX");
    const totalCapex = sum("CAPEX");
    const totalRoyalties = sum("ROYALTY");
    return { totalRevenue, totalOpex, totalCapex, totalRoyalties, netIncome: totalRevenue - totalOpex - totalCapex - totalRoyalties };
  }),
});

// ─── HSE ROUTER ───────────────────────────────────────────────────────────────
export const hseRouter = router({
  incidents: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      return db.select().from(hseIncidents).orderBy(desc(hseIncidents.occurredAt)).limit(input?.limit ?? 50);
    }),

  createIncident: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      incidentType: z.enum(["NEAR_MISS", "FIRST_AID", "RECORDABLE", "LTI", "FATALITY", "SPILL", "FIRE", "EXPLOSION", "RELEASE"]),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      title: z.string(),
      description: z.string().optional(),
      location: z.string().optional(),
      reportedBy: z.string().optional(),
      iogpCode: z.string().optional(),
      lostTimeDays: z.number().default(0),
      occurredAt: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const incidentId = `HSE-${new Date().getFullYear()}-${nanoid(4).toUpperCase()}`;
      await db.insert(hseIncidents).values({ ...input, incidentId });
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CREATE_HSE_INCIDENT", resource: "hse_incidents", resourceId: incidentId, details: input });
      return { incidentId };
    }),

  closeIncident: protectedProcedure
    .input(z.object({
      incidentId: z.string(),
      rootCause: z.string(),
      correctiveActions: z.array(z.string()),
      investigatedBy: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { incidentId, ...updates } = input;
      await db.update(hseIncidents).set({ ...updates, closedAt: new Date() }).where(eq(hseIncidents.incidentId, incidentId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CLOSE_HSE_INCIDENT", resource: "hse_incidents", resourceId: incidentId });
      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, nearMiss: 0, recordable: 0, lti: 0, ltifr: 0, trir: 0 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(hseIncidents);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const ytd = rows.filter(r => r.occurredAt >= yearStart);
    const hoursWorked = 500000;
    return {
      total: rows.length,
      nearMiss: rows.filter(r => r.incidentType === "NEAR_MISS").length,
      recordable: rows.filter(r => r.incidentType === "RECORDABLE").length,
      lti: rows.filter(r => r.incidentType === "LTI").length,
      ltifr: (ytd.filter(r => r.incidentType === "LTI").length / hoursWorked) * 1000000,
      trir: (ytd.filter(r => ["RECORDABLE", "LTI", "FATALITY"].includes(r.incidentType)).length / hoursWorked) * 200000,
    };
  }),
});

// ─── SECURITY ROUTER ──────────────────────────────────────────────────────────
export const securityRouter = router({
  events: protectedProcedure
    .input(z.object({ limit: z.number().default(50), mitigated: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(securityEvents).orderBy(desc(securityEvents.occurredAt)).limit(input?.limit ?? 50);
      if (input?.mitigated !== undefined) return rows.filter(e => e.mitigated === input.mitigated);
      return rows;
    }),

  mitigate: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(securityEvents).set({
        mitigated: true,
        mitigatedAt: new Date(),
        mitigatedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
      }).where(eq(securityEvents.eventId, input.eventId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "MITIGATE_SECURITY_EVENT", resource: "security_events", resourceId: input.eventId });
      return { success: true };
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, critical: 0, high: 0, unmitigated: 0 };
    await seedWellsIfEmpty(db);
    const rows = await db.select().from(securityEvents);
    return {
      total: rows.length,
      critical: rows.filter(e => e.severity === "CRITICAL").length,
      high: rows.filter(e => e.severity === "HIGH").length,
      unmitigated: rows.filter(e => !e.mitigated).length,
    };
  }),

  // IEC 62443 S21.2 — Trigger IncidentTriageWorkflow for a security event
  triggerTriage: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Check if already triaged
      const existing = await db.select().from(incidentTriage)
        .where(eq(incidentTriage.eventId, input.eventId)).limit(1);
      if (existing.length > 0 && existing[0].status === "RUNNING") {
        return { workflowId: existing[0].workflowId, status: "RUNNING" };
      }
      // Fetch the security event for context
      const events = await db.select().from(securityEvents)
        .where(eq(securityEvents.eventId, input.eventId)).limit(1);
      const ev = events[0];
      const severityMap: Record<string, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };
      const severityNum = ev ? (severityMap[ev.severity] ?? 3) : 3;

      // Start Temporal IncidentTriageWorkflow (live or simulated)
      const triageInsert = await db.insert(incidentTriage).values({
        eventId: input.eventId,
        workflowId: `triage-pending-${input.eventId}`,
        status: "RUNNING",
        openCtiScore: 0,
        tlpClassification: "TLP:WHITE",
        nodeIsolated: false,
      }).onConflictDoNothing().returning();
      const triageId = triageInsert[0]?.id ?? 0;

      const { workflowId } = await startIncidentTriageWorkflow({
        eventId: input.eventId,
        severity: severityNum,
        target: ev?.target ?? "unknown",
        eventType: ev?.eventType ?? "UNKNOWN",
        triageId,
      });

      // Update triage record with real workflow ID
      await db.update(incidentTriage).set({ workflowId, updatedAt: new Date() })
        .where(eq(incidentTriage.eventId, input.eventId));

      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? "",
        action: "TRIGGER_INCIDENT_TRIAGE",
        resource: "incident_triage",
        resourceId: input.eventId,
        details: { workflowId, temporalAddress: getTemporalAddress() },
      });

      return { workflowId, status: "RUNNING", temporalLive: true };
    }),

  // IEC 62443 S21.2 — Re-admit an isolated node after remediation
  readmitNode: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(incidentTriage).set({
        nodeIsolated: false,
        nodeReadmittedAt: new Date(),
        nodeReadmittedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
        updatedAt: new Date(),
      }).where(eq(incidentTriage.eventId, input.eventId));
      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? "",
        action: "READMIT_NODE",
        resource: "incident_triage",
        resourceId: input.eventId,
      });
      return { success: true };
    }),

  // List all triage records
  triageList: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(incidentTriage)
        .orderBy(desc(incidentTriage.createdAt))
        .limit(input?.limit ?? 20);
    }),
});

// ─── ML ROUTER ────────────────────────────────────────────────────────────────
export const mlRouter = router({
  predictions: protectedProcedure
    .input(z.object({ wellId: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(mlPredictions).orderBy(desc(mlPredictions.predictedAt)).limit(input.limit);
      return input.wellId ? rows.filter(p => p.wellId === input.wellId) : rows;
    }),

  latestByWell: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(mlPredictions)
        .where(and(eq(mlPredictions.wellId, input.wellId), eq(mlPredictions.modelType, "ESP_FAILURE")))
        .orderBy(desc(mlPredictions.predictedAt))
        .limit(1);
      return rows[0] ?? null;
    }),
});

// ─── DIGITAL TWIN ROUTER ──────────────────────────────────────────────────────
export const digitalTwinRouter = router({
  scenarios: protectedProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      return db.select().from(digitalTwinScenarios).where(eq(digitalTwinScenarios.wellId, input.wellId)).orderBy(desc(digitalTwinScenarios.createdAt));
    }),

  saveScenario: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      name: z.string(),
      reservoirPressurePsi: z.number().optional(),
      skinFactor: z.number().optional(),
      perforationInterval: z.number().optional(),
      espFrequencyHz: z.number().optional(),
      chokeOpeningPct: z.number().optional(),
      predictedRateBpd: z.number().optional(),
      iprAofBpd: z.number().optional(),
      optimumRateBpd: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const scenarioId = `DT-${nanoid(6).toUpperCase()}`;
      await db.insert(digitalTwinScenarios).values({ ...input, scenarioId, createdBy: ctx.user.name ?? ctx.user.email ?? "Unknown" });
      return { scenarioId };
    }),
});

// ─── REGULATORY ROUTER ────────────────────────────────────────────────────────
export const regulatoryRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    await seedWellsIfEmpty(db);
    return db.select().from(regulatoryReports).orderBy(desc(regulatoryReports.createdAt));
  }),

  create: protectedProcedure
    .input(z.object({
      reportType: z.enum(["API_14C", "BSEE_OGOR", "EPA_SUBPART_W", "MOCCAE", "ADNOC_HSE", "KOC_ENV", "NCSC_INCIDENT"]),
      period: z.string(),
      language: z.enum(["EN", "AR", "BILINGUAL"]).default("EN"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const reportId = `RPT-${nanoid(6).toUpperCase()}`;
      await db.insert(regulatoryReports).values({ ...input, reportId, status: "DRAFT", generatedAt: new Date() });
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "CREATE_REGULATORY_REPORT", resource: "regulatory_reports", resourceId: reportId, details: input });
      return { reportId };
    }),

  submit: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(regulatoryReports).set({
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedBy: ctx.user.name ?? ctx.user.email ?? "Unknown",
      }).where(eq(regulatoryReports.reportId, input.reportId));
      await db.insert(auditLog).values({ userId: ctx.user.id, userEmail: ctx.user.email ?? "", action: "SUBMIT_REGULATORY_REPORT", resource: "regulatory_reports", resourceId: input.reportId });
      return { success: true };
    }),
});

// ─── ALLOCATION ROUTER ────────────────────────────────────────────────────────
export const allocationRouter = router({
  list: protectedProcedure
    .input(z.object({ wellId: z.string().optional(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
      const rows = await db.select().from(allocationRecords).where(gte(allocationRecords.date, since)).orderBy(desc(allocationRecords.date));
      return input.wellId ? rows.filter(r => r.wellId === input.wellId) : rows;
    }),

  record: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      separatorId: z.string().optional(),
      date: z.date(),
      allocatedOilBbls: z.number().optional(),
      allocatedGasMmscf: z.number().optional(),
      allocatedWaterBbls: z.number().optional(),
      allocationFactor: z.number().optional(),
      method: z.enum(["WELL_TEST", "METERED", "CALCULATED", "ESTIMATED"]).default("WELL_TEST"),
      imbalanceBbls: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(allocationRecords).values(input);
      return { success: true };
    }),

  /** Separator-level summary built from allocationRecords. Replaces hardcoded SEPARATORS[] in UI. */
  getSeparators: protectedProcedure
    .input(z.object({ fieldId: z.string().optional() }))
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const rows = await db.select().from(allocationRecords)
        .where(gte(allocationRecords.date, new Date(Date.now() - 30 * 24 * 3600 * 1000)))
        .orderBy(desc(allocationRecords.date));
      const sepMap = new Map<string, { separatorId: string; totalOilBbls: number; totalGasMmscf: number; totalWaterBbls: number; wellIds: string[]; imbalanceSum: number; recordCount: number }>();
      for (const r of rows) {
        const sid = r.separatorId ?? "SEP-DEFAULT";
        if (!sepMap.has(sid)) sepMap.set(sid, { separatorId: sid, totalOilBbls: 0, totalGasMmscf: 0, totalWaterBbls: 0, wellIds: [], imbalanceSum: 0, recordCount: 0 });
        const s = sepMap.get(sid)!;
        s.totalOilBbls += r.allocatedOilBbls ?? 0;
        s.totalGasMmscf += r.allocatedGasMmscf ?? 0;
        s.totalWaterBbls += r.allocatedWaterBbls ?? 0;
        s.imbalanceSum += Math.abs(r.imbalanceBbls ?? 0);
        s.recordCount++;
        if (!s.wellIds.includes(r.wellId)) s.wellIds.push(r.wellId);
      }
      return Array.from(sepMap.values()).map(s => ({
        separatorId: s.separatorId,
        wellCount: s.wellIds.length,
        wellIds: s.wellIds,
        totalOilBbls: Math.round(s.totalOilBbls),
        totalGasMmscf: Math.round(s.totalGasMmscf * 100) / 100,
        totalWaterBbls: Math.round(s.totalWaterBbls),
        avgImbalanceBbls: s.recordCount > 0 ? Math.round(s.imbalanceSum / s.recordCount) : 0,
      }));
    }),

  /** Per-well allocation breakdown for a separator. Replaces hardcoded ALLOCATIONS[] in UI. */
  getWellAllocations: protectedProcedure
    .input(z.object({ separatorId: z.string().optional(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      await seedWellsIfEmpty(db);
      const since = new Date(Date.now() - input.days * 24 * 3600 * 1000);
      const rows = await db.select().from(allocationRecords).where(gte(allocationRecords.date, since)).orderBy(desc(allocationRecords.date));
      const filtered = input.separatorId ? rows.filter(r => r.separatorId === input.separatorId) : rows;
      const wellRows = await db.select({ wellId: wells.wellId, name: wells.name }).from(wells);
      const nameMap = new Map(wellRows.map(w => [w.wellId, w.name]));
      const wellMap = new Map<string, typeof filtered[0]>();
      for (const r of filtered) { if (!wellMap.has(r.wellId)) wellMap.set(r.wellId, r); }
      return Array.from(wellMap.values()).map(r => ({
        wellId: r.wellId,
        wellName: nameMap.get(r.wellId) ?? r.wellId,
        separatorId: r.separatorId ?? "SEP-DEFAULT",
        allocatedOilBbls: r.allocatedOilBbls ?? 0,
        allocatedGasMmscf: r.allocatedGasMmscf ?? 0,
        allocatedWaterBbls: r.allocatedWaterBbls ?? 0,
        allocationFactor: r.allocationFactor ?? 1.0,
        method: r.method,
        imbalanceBbls: r.imbalanceBbls ?? 0,
        date: r.date,
      }));
    }),
});

// ─── AUDIT LOG ROUTER ─────────────────────────────────────────────────────────
export const auditRouter = router({
  list: protectedProcedure
    .input(z.object({ resource: z.string().optional(), limit: z.number().default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit);
      return input.resource ? rows.filter(r => r.resource === input.resource) : rows;
    }),
});

// ─── OVERVIEW STATS ROUTER ────────────────────────────────────────────────────
export const overviewRouter = router({
  kpis: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { wells: { total: 0, active: 0 }, alarms: { critical: 0, unacknowledged: 0 }, production: { bpd: 0 }, connectivity: { online: 0 } };
    await seedWellsIfEmpty(db);

    const [wellRows, alarmRows, prodRows, connRows] = await Promise.all([
      db.select().from(wells),
      db.select().from(alarms),
      db.select().from(productionRecords).where(gte(productionRecords.date, new Date(Date.now() - 24 * 3600 * 1000))),
      db.select().from(siteConnectivity),
    ]);

    return {
      wells: { total: wellRows.length, active: wellRows.filter(w => w.status === "ACTIVE").length },
      alarms: { critical: alarmRows.filter(a => a.severity === 1).length, unacknowledged: alarmRows.filter(a => a.state === "UNACKNOWLEDGED").length },
      production: { bpd: prodRows.reduce((s, r) => s + (r.oilBbls ?? 0), 0) },
      connectivity: { online: connRows.filter(s => s.status === "ONLINE").length, total: connRows.length },
    };
  }),
});

// ─── TEMPORAL WORKFLOW ROUTER ─────────────────────────────────────────────────
export const temporalRouter = router({
  /**
   * List recent workflows (all types or filtered by type).
   * Returns simulated data when Temporal server is not available.
   */
  list: protectedProcedure
    .input(z.object({
      workflowType: z.string().optional(),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ input }) => {
      return listWorkflows(input?.workflowType, input?.limit ?? 20);
    }),

  /**
   * Get status of a specific workflow by ID.
   */
  status: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      return getWorkflowStatus(input.workflowId);
    }),

  /**
   * Start a workover workflow manually (admin only).
   */
  startWorkover: protectedProcedure
    .input(z.object({
      workoverJobId: z.string(),
      wellId: z.string(),
      jobType: z.string(),
      estimatedDays: z.number().default(3),
      estimatedCost: z.number().default(0),
      contractor: z.string().default("TBD"),
      description: z.string().default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await startWorkoverWorkflow({
        ...input,
        requestedBy: ctx.user.name ?? ctx.user.openId,
      });
      return result;
    }),

  /**
   * Cancel a running workflow (admin only).
   */
  cancel: adminProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      const success = await cancelWorkflow(input.workflowId);
      return { success };
    }),

  /**
   * Health check — returns whether Temporal server is reachable.
   */
  health: protectedProcedure.query(async () => {
    const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "";
    return {
      configured: !!TEMPORAL_ADDRESS,
      address: TEMPORAL_ADDRESS || "not configured",
      mode: TEMPORAL_ADDRESS ? "live" : "not_configured",
    };
  }),
});
