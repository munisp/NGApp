/**
 * domain.ts — tRPC routers for all remaining platform modules:
 * calibration, FPSO/HPU/subsea, HSE, cybersecurity, regulatory,
 * digital twin, ML predictions, site connectivity, actuator commands, audit log
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure} from "../_core/trpc";
import { getDb } from "../db";
import {
  calibrationRecords, fpsoVessels, hpuUnits, subseaTrees,
  siteConnectivity, actuatorCommands, hseIncidents, securityEvents,
  regulatoryReports, mlPredictions, digitalTwinScenarios, auditLog,
  productionRecords, shiftHandovers, wellPhysicsParams, telemetryReadings,
  wells, declineCurveParams,
} from "../../drizzle/schema";
import { eq, desc, and, gte, lt, sql, or } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── CALIBRATION ──────────────────────────────────────────────────────────────
export const calibrationRouter = router({
  list: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      status: z.enum(["CURRENT","DUE_SOON","OVERDUE","IN_PROGRESS","FAILED"]).optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.wellId) conds.push(eq(calibrationRecords.wellId, input.wellId));
      if (input.status) conds.push(eq(calibrationRecords.status, input.status));
      return db.select().from(calibrationRecords)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(calibrationRecords.nextDueAt))
        .limit(input.limit);
    }),

  overdue: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(calibrationRecords)
      .where(or(eq(calibrationRecords.status, "OVERDUE"), eq(calibrationRecords.status, "DUE_SOON")))
      .orderBy(calibrationRecords.nextDueAt)
      .limit(50);
  }),

  create: protectedProcedure
    .input(z.object({
      sensorId: z.string(),
      wellId: z.string(),
      sensorType: z.enum(["PRESSURE","TEMPERATURE","FLOW","LEVEL","VIBRATION","CURRENT","VOLTAGE","GAS_DETECTOR","SAFETY_VALVE"]),
      tag: z.string(),
      intervalDays: z.number().default(90),
      nistTraceable: z.boolean().default(true),
      technician: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const nextDueAt = new Date(Date.now() + input.intervalDays * 86400000);
      const [row] = await db.insert(calibrationRecords).values({
        sensorId: input.sensorId,
        wellId: input.wellId,
        sensorType: input.sensorType,
        tag: input.tag,
        intervalDays: input.intervalDays,
        nistTraceable: input.nistTraceable,
        technician: input.technician,
        notes: input.notes,
        nextDueAt,
      }).returning();
      return { id: row.id };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["CURRENT","DUE_SOON","OVERDUE","IN_PROGRESS","FAILED"]),
      qualityScore: z.number().optional(),
      driftPct: z.number().optional(),
      certificateRef: z.string().optional(),
      technician: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updateData: any = { status: input.status };
      if (input.qualityScore !== undefined) updateData.qualityScore = input.qualityScore;
      if (input.driftPct !== undefined) updateData.driftPct = input.driftPct;
      if (input.certificateRef) updateData.certificateRef = input.certificateRef;
      if (input.technician) updateData.technician = input.technician;
      if (input.notes) updateData.notes = input.notes;
      if (input.status === "CURRENT") {
        updateData.lastCalibratedAt = new Date();
      }
      await db.update(calibrationRecords).set(updateData).where(eq(calibrationRecords.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(calibrationRecords).where(eq(calibrationRecords.id, input.id));
      return { success: true };
    }),
});

// ─── FPSO / OFFSHORE ──────────────────────────────────────────────────────────
export const fpsoRouter = router({
  vessels: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(fpsoVessels).orderBy(fpsoVessels.name);
  }),

  vessel: publicProcedure
    .input(z.object({ vesselId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(fpsoVessels).where(eq(fpsoVessels.vesselId, input.vesselId)).limit(1);
      return row ?? null;
    }),

  createVessel: protectedProcedure
    .input(z.object({
      name: z.string(),
      imoNumber: z.string().optional(),
      field: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      storageBbls: z.number().optional(),
      processingCapacityBpd: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const vesselId = `FPSO-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(fpsoVessels).values({
        vesselId,
        name: input.name,
        imoNumber: input.imoNumber,
        field: input.field,
        latitude: input.latitude ? String(input.latitude) : undefined,
        longitude: input.longitude ? String(input.longitude) : undefined,
        storageBbls: input.storageBbls,
        processingCapacityBpd: input.processingCapacityBpd,
      }).returning();
      return { id: row.id, vesselId };
    }),

  updateVessel: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["OPERATIONAL","MAINTENANCE","STANDBY","OFFHIRE"]).optional(),
      currentInventoryBbls: z.number().optional(),
      currentProductionBpd: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(fpsoVessels).set(updates).where(eq(fpsoVessels.id, id));
      return { success: true };
    }),

  hpuUnits: publicProcedure
    .input(z.object({ fpsoId: z.string().optional(), wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.fpsoId) conds.push(eq(hpuUnits.fpsoId, input.fpsoId));
      if (input.wellId) conds.push(eq(hpuUnits.wellId, input.wellId));
      return db.select().from(hpuUnits).where(conds.length ? and(...conds) : undefined);
    }),

  updateHpu: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["RUNNING","STANDBY","FAULT","MAINTENANCE"]).optional(),
      systemPressureBar: z.number().optional(),
      reservoirLevelPct: z.number().optional(),
      pumpAStatus: z.enum(["RUNNING","STANDBY","FAULT"]).optional(),
      pumpBStatus: z.enum(["RUNNING","STANDBY","FAULT"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(hpuUnits).set(updates).where(eq(hpuUnits.id, id));
      return { success: true };
    }),

  subseaTrees: publicProcedure
    .input(z.object({ fpsoId: z.string().optional(), wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.fpsoId) conds.push(eq(subseaTrees.fpsoId, input.fpsoId));
      if (input.wellId) conds.push(eq(subseaTrees.wellId, input.wellId));
      return db.select().from(subseaTrees).where(conds.length ? and(...conds) : undefined);
    }),

  updateSubseaTree: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["ACTIVE","SHUT_IN","MAINTENANCE","ABANDONED"]).optional(),
      masterValveOpen: z.boolean().optional(),
      wingValveOpen: z.boolean().optional(),
      swabValveOpen: z.boolean().optional(),
      wellheadPressureBar: z.number().optional(),
      flowTempC: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(subseaTrees).set(updates).where(eq(subseaTrees.id, id));
      return { success: true };
    }),
});

// ─── SITE CONNECTIVITY ────────────────────────────────────────────────────────
export const connectivityRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(siteConnectivity).orderBy(siteConnectivity.siteName);
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["ONLINE","DEGRADED","OFFLINE","BUFFERING","MAINTENANCE"]).optional(),
      linkQualityPct: z.number().optional(),
      latencyMs: z.number().optional(),
      bufferDepth: z.number().optional(),
      solarVolts: z.number().optional(),
      batteryPct: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(siteConnectivity).set({ ...updates, lastSeenAt: new Date() }).where(eq(siteConnectivity.id, id));
      return { success: true };
    }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      siteName: z.string(),
      protocol: z.enum(["MQTT","MODBUS_TCP","MODBUS_RTU","OPC_UA","DNP3","HART"]).default("MQTT"),
      isSolarPowered: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const siteId = `SITE-${nanoid(8).toUpperCase()}`;
      const [row] = await db.insert(siteConnectivity).values({ siteId, ...input }).returning();
      return { id: row.id, siteId };
    }),
});

// ─── ACTUATOR COMMANDS ────────────────────────────────────────────────────────
export const actuatorRouter = router({
  list: publicProcedure
    .input(z.object({ wellId: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(actuatorCommands)
        .where(input.wellId ? eq(actuatorCommands.wellId, input.wellId) : undefined)
        .orderBy(desc(actuatorCommands.createdAt))
        .limit(input.limit);
    }),

  issue: adminProcedure
    .input(z.object({
      wellId: z.string(),
      assetId: z.string(),
      assetName: z.string().optional(),
      commandType: z.enum(["VALVE_OPEN","VALVE_CLOSE","CHOKE_SETPOINT","PRESSURE_SETPOINT","PUMP_START","PUMP_STOP","ESD_ACTIVATE","ESD_RESET"]),
      targetValue: z.number().optional(),
      confirmationCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const commandId = `CMD-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(actuatorCommands).values({
        commandId,
        wellId: input.wellId,
        assetId: input.assetId,
        assetName: input.assetName,
        commandType: input.commandType,
        targetValue: input.targetValue,
        issuedBy: ctx.user.name ?? ctx.user.openId,
        confirmationCode: input.confirmationCode,
        auditTrail: [{ action: "ISSUED", by: ctx.user.openId, at: new Date().toISOString() }],
      }).returning();
      return { id: row.id, commandId };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["PENDING","SENT","ACKNOWLEDGED","EXECUTED","FAILED","CANCELLED"]),
      failureReason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updateData: any = { status: input.status };
      if (input.status === "EXECUTED") updateData.executedAt = new Date();
      if (input.failureReason) updateData.failureReason = input.failureReason;
      await db.update(actuatorCommands).set(updateData).where(eq(actuatorCommands.id, input.id));
      return { success: true };
    }),
});

// ─── HSE INCIDENTS ────────────────────────────────────────────────────────────
export const hseRouter = router({
  list: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      severity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).optional(),
      incidentType: z.enum(["NEAR_MISS","FIRST_AID","RECORDABLE","LTI","FATALITY","SPILL","FIRE","EXPLOSION","RELEASE"]).optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.wellId) conds.push(eq(hseIncidents.wellId, input.wellId));
      if (input.severity) conds.push(eq(hseIncidents.severity, input.severity));
      if (input.incidentType) conds.push(eq(hseIncidents.incidentType, input.incidentType));
      return db.select().from(hseIncidents)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(hseIncidents.occurredAt))
        .limit(input.limit);
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [stats] = await db.select({
      total: sql<number>`count(*)`,
      ltis: sql<number>`sum(case when incident_type = 'LTI' then 1 else 0 end)`,
      recordables: sql<number>`sum(case when incident_type = 'RECORDABLE' then 1 else 0 end)`,
      nearMisses: sql<number>`sum(case when incident_type = 'NEAR_MISS' then 1 else 0 end)`,
      totalLostDays: sql<number>`sum(lost_time_days)`,
    }).from(hseIncidents);
    return stats;
  }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string().optional(),
      incidentType: z.enum(["NEAR_MISS","FIRST_AID","RECORDABLE","LTI","FATALITY","SPILL","FIRE","EXPLOSION","RELEASE"]),
      severity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).default("LOW"),
      title: z.string(),
      description: z.string().optional(),
      location: z.string().optional(),
      reportedBy: z.string().optional(),
      occurredAt: z.string(),
      lostTimeDays: z.number().default(0),
      iogpCode: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const incidentId = `HSE-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(hseIncidents).values({
        incidentId,
        wellId: input.wellId,
        incidentType: input.incidentType,
        severity: input.severity,
        title: input.title,
        description: input.description,
        location: input.location,
        reportedBy: input.reportedBy ?? ctx.user.name ?? ctx.user.openId,
        occurredAt: new Date(input.occurredAt),
        lostTimeDays: input.lostTimeDays,
        iogpCode: input.iogpCode,
      }).returning();
      return { id: row.id, incidentId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      investigatedBy: z.string().optional(),
      rootCause: z.string().optional(),
      correctiveActions: z.array(z.string()).optional(),
      closedAt: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      const updateData: any = {};
      if (updates.investigatedBy) updateData.investigatedBy = updates.investigatedBy;
      if (updates.rootCause) updateData.rootCause = updates.rootCause;
      if (updates.correctiveActions) updateData.correctiveActions = updates.correctiveActions;
      if (updates.closedAt) updateData.closedAt = new Date(updates.closedAt);
      await db.update(hseIncidents).set(updateData).where(eq(hseIncidents.id, id));
      return { success: true };
    }),
  close: protectedProcedure
    .input(z.object({
      id: z.number(),
      closedAt: z.string().optional(),
      investigatedBy: z.string().optional(),
      rootCause: z.string().optional(),
      correctiveActions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(hseIncidents).set({
        closedAt: new Date(input.closedAt ?? Date.now()),
        investigatedBy: input.investigatedBy ?? ctx.user.name ?? ctx.user.openId,
        rootCause: input.rootCause,
        correctiveActions: input.correctiveActions,
      }).where(eq(hseIncidents.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(hseIncidents).where(eq(hseIncidents.id, input.id));
      return { success: true };
    }),

  /** Seed demo HSE incidents if table is empty */
  seedDemo: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const existing = await db.select({ id: hseIncidents.id }).from(hseIncidents).limit(1);
    if (existing.length > 0) return { seeded: false, message: "Already has data" };
    const demos = [
      { incidentId: "HSE-2026-001", incidentType: "NEAR_MISS" as const, severity: "LOW" as const, title: "Operator slipped on wet grating near wellhead", description: "Operator slipped on wet grating near wellhead", location: "Permian Basin #47", reportedBy: "J. Martinez", rootCause: "Inadequate drainage and missing anti-slip coating", correctiveActions: ["Anti-slip coating applied", "Drainage improved"], lostTimeDays: 0, occurredAt: new Date("2026-03-10") },
      { incidentId: "HSE-2026-002", incidentType: "FIRST_AID" as const, severity: "LOW" as const, title: "Minor hand laceration during valve packing replacement", description: "Minor hand laceration during valve packing replacement", location: "Eagle Ford #12", reportedBy: "A. Singh", rootCause: "Incorrect glove selection for task", correctiveActions: ["PPE matrix updated", "Toolbox talk conducted"], lostTimeDays: 0, occurredAt: new Date("2026-03-05") },
      { incidentId: "HSE-2026-003", incidentType: "NEAR_MISS" as const, severity: "MEDIUM" as const, title: "Dropped object — wrench fell from elevated work platform", description: "Dropped object — wrench fell from elevated work platform", location: "Midland Basin #3", reportedBy: "K. Al-Rashid", rootCause: "Tool tethering not used", correctiveActions: ["Tool tethering made mandatory", "Inspection checklist updated"], lostTimeDays: 0, occurredAt: new Date("2026-02-28") },
      { incidentId: "HSE-2026-004", incidentType: "RECORDABLE" as const, severity: "HIGH" as const, title: "H2S exposure during wellhead sampling — SCBA not worn", description: "Operator exposed to H2S above TLV during sampling operation", location: "Kuwait Field KW-047", reportedBy: "F. Al-Mutairi", rootCause: "SCBA requirement not enforced during sampling", correctiveActions: ["SCBA mandatory for all sampling", "H2S monitor calibration verified"], lostTimeDays: 2, iogpCode: "REC-01", occurredAt: new Date("2026-02-15") },
      { incidentId: "HSE-2026-005", incidentType: "SPILL" as const, severity: "MEDIUM" as const, title: "Minor hydrocarbon spill during pig trap opening", description: "Approximately 50L crude oil spill during pig trap maintenance", location: "Eagle Ford #8", reportedBy: "T. Williams", rootCause: "Residual pressure not fully bled before opening", correctiveActions: ["Bleed-down procedure updated", "Pressure gauge mandatory check added"], lostTimeDays: 0, iogpCode: "SP-02", occurredAt: new Date("2026-01-22") },
    ];
    for (const d of demos) {
      await db.insert(hseIncidents).values(d).onConflictDoNothing();
    }
    return { seeded: true, count: demos.length };
  }),
});

// ─── CYBERSECURITY ────────────────────────────────────────────────────────────
export const cybersecurityRouter = router({
  events: publicProcedure
    .input(z.object({
      severity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).optional(),
      mitigated: z.boolean().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.severity) conds.push(eq(securityEvents.severity, input.severity));
      if (input.mitigated !== undefined) conds.push(eq(securityEvents.mitigated, input.mitigated));
      return db.select().from(securityEvents)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(securityEvents.occurredAt))
        .limit(input.limit);
    }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [stats] = await db.select({
      total: sql<number>`count(*)`,
      critical: sql<number>`sum(case when severity = 'CRITICAL' then 1 else 0 end)`,
      high: sql<number>`sum(case when severity = 'HIGH' then 1 else 0 end)`,
      unmitigated: sql<number>`sum(case when mitigated = false then 1 else 0 end)`,
    }).from(securityEvents);
    return stats;
  }),

  createEvent: protectedProcedure
    .input(z.object({
      eventType: z.enum(["INTRUSION_ATTEMPT","MALWARE","UNAUTHORIZED_ACCESS","POLICY_VIOLATION","ANOMALY","PHISHING","RANSOMWARE","SCADA_ATTACK"]),
      severity: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).default("LOW"),
      source: z.string().optional(),
      target: z.string().optional(),
      description: z.string().optional(),
      cveId: z.string().optional(),
      iec62443Zone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const eventId = `SEC-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(securityEvents).values({ eventId, ...input }).returning();
      return { id: row.id, eventId };
    }),

  mitigate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(securityEvents).set({
        mitigated: true,
        mitigatedAt: new Date(),
        mitigatedBy: ctx.user.name ?? ctx.user.openId,
      }).where(eq(securityEvents.id, input.id));
      return { success: true };
    }),
});

// ─── REGULATORY REPORTS ───────────────────────────────────────────────────────
export const regulatoryRouter = router({
  list: publicProcedure
    .input(z.object({
      reportType: z.enum(["API_14C","BSEE_OGOR","EPA_SUBPART_W","MOCCAE","ADNOC_HSE","KOC_ENV","NCSC_INCIDENT"]).optional(),
      status: z.enum(["DRAFT","PENDING","SUBMITTED","ACCEPTED","REJECTED"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.reportType) conds.push(eq(regulatoryReports.reportType, input.reportType));
      if (input.status) conds.push(eq(regulatoryReports.status, input.status));
      return db.select().from(regulatoryReports)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(regulatoryReports.createdAt))
        .limit(input.limit);
    }),

  generate: protectedProcedure
    .input(z.object({
      reportType: z.enum(["API_14C","BSEE_OGOR","EPA_SUBPART_W","MOCCAE","ADNOC_HSE","KOC_ENV","NCSC_INCIDENT"]),
      period: z.string(),
      language: z.enum(["EN","AR","BILINGUAL"]).default("EN"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const reportId = `RPT-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(regulatoryReports).values({
        reportId,
        reportType: input.reportType,
        period: input.period,
        language: input.language,
        notes: input.notes,
        generatedAt: new Date(),
        submittedBy: ctx.user.name ?? ctx.user.openId,
      }).returning();
      return { id: row.id, reportId };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["DRAFT","PENDING","SUBMITTED","ACCEPTED","REJECTED"]),
      fileUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updateData: any = { status: input.status };
      if (input.status === "SUBMITTED") {
        updateData.submittedAt = new Date();
        updateData.submittedBy = ctx.user.name ?? ctx.user.openId;
      }
      if (input.fileUrl) updateData.fileUrl = input.fileUrl;
      await db.update(regulatoryReports).set(updateData).where(eq(regulatoryReports.id, input.id));
      return { success: true };
    }),

  generatePDF: protectedProcedure
    .input(z.object({
      reportType: z.enum(["API_14C","BSEE_OGOR","EPA_SUBPART_W","MOCCAE","ADNOC_HSE","KOC_ENV","NCSC_INCIDENT"]),
      period: z.string(),
      language: z.enum(["EN","AR","BILINGUAL"]).default("EN"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { generateRegulatoryPDF } = await import("../regulatoryPDF");
      const reportId = `RPT-${nanoid(10).toUpperCase()}`;
      const templateMap: Record<string, "ADNOC_PRODUCTION" | "KOC_ENV" | "ARAMCO_WELL_INTEGRITY" | "ADNOC_HSE" | "MOCCAE"> = {
        ADNOC_HSE: "ADNOC_HSE",
        MOCCAE: "MOCCAE",
        KOC_ENV: "KOC_ENV",
        API_14C: "ARAMCO_WELL_INTEGRITY",
        BSEE_OGOR: "ADNOC_PRODUCTION",
        EPA_SUBPART_W: "KOC_ENV",
        NCSC_INCIDENT: "ARAMCO_WELL_INTEGRITY",
      };
      const template = templateMap[input.reportType] ?? "ADNOC_PRODUCTION";
      const { url, sizeBytes } = await generateRegulatoryPDF({
        template,
        period: input.period,
        language: input.language,
        generatedBy: ctx.user.name ?? ctx.user.openId,
        reportId,
      });
      const [row] = await db.insert(regulatoryReports).values({
        reportId,
        reportType: input.reportType,
        period: input.period,
        language: input.language,
        notes: input.notes,
        fileUrl: url,
        generatedAt: new Date(),
        submittedBy: ctx.user.name ?? ctx.user.openId,
        status: "DRAFT",
      }).returning();
      return { id: row.id, reportId, url, sizeBytes };
    }),

  /**
   * Submit a generated report to the relevant regulatory authority.
   * E-filing stub: replace the simulated delay with the real API call in production.
   */
  submitToAuthority: protectedProcedure
    .input(z.object({
      id: z.number(),
      authority: z.enum(["ADNOC", "KOC", "ARAMCO", "MOCCAE", "BSEE", "EPA", "NCSC"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [report] = await db.select().from(regulatoryReports)
        .where(eq(regulatoryReports.id, input.id)).limit(1);
      if (!report) throw new Error("Report not found");
      if (!report.fileUrl) throw new Error("Generate PDF first before submitting");
      if (report.status === "SUBMITTED" || report.status === "ACCEPTED") {
        throw new Error(`Report already ${report.status.toLowerCase()}`);
      }

      // Use eFilingService: retry logic, exponential backoff, per-authority endpoint config
      // Set ADNOC_EFILING_URL + ADNOC_EFILING_KEY env vars to activate live ADNOC integration
      const { submitToAuthority: eFile } = await import("../eFilingService");
      const filingResult = await eFile(input.authority, {
        reportId: report.reportId,
        reportType: report.reportType,
        pdfUrl: report.fileUrl,
        submittedBy: ctx.user.name ?? ctx.user.openId,
        notes: input.notes,
        metadata: { reportDbId: report.id, platform: "OG-RMM" },
      });

      await db.update(regulatoryReports).set({
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedBy: ctx.user.name ?? ctx.user.openId,
        submissionRef: filingResult.submissionRef,
        updatedAt: new Date(),
      }).where(eq(regulatoryReports.id, input.id));

      return {
        success: true,
        submissionRef: filingResult.submissionRef,
        authority: input.authority,
        submittedAt: filingResult.submittedAt,
        isStub: filingResult.isStub,
        attempts: filingResult.attempts,
        message: `Report ${report.reportId} submitted to ${input.authority}. Ref: ${filingResult.submissionRef}`,
      };
    }),

  /**
   * List submission history — all SUBMITTED/ACCEPTED/REJECTED reports with refs.
   */
  submissionHistory: publicProcedure
    .input(z.object({
      limit: z.number().default(100),
      status: z.enum(["SUBMITTED", "ACCEPTED", "REJECTED"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { inArray } = await import("drizzle-orm");
      const statusFilter = input.status
        ? eq(regulatoryReports.status, input.status)
        : inArray(regulatoryReports.status, ["SUBMITTED", "ACCEPTED", "REJECTED"]);
      return db.select().from(regulatoryReports)
        .where(statusFilter)
        .orderBy(desc(regulatoryReports.submittedAt))
        .limit(input.limit);
    }),

  /**
   * Re-submit a REJECTED report to the authority.
   * Resets status to SUBMITTED and generates a new submissionRef.
   */
  resubmit: protectedProcedure
    .input(z.object({
      id: z.number(),
      authority: z.enum(["ADNOC", "KOC", "ARAMCO", "MOCCAE", "BSEE", "EPA", "NCSC"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [report] = await db.select().from(regulatoryReports)
        .where(eq(regulatoryReports.id, input.id)).limit(1);
      if (!report) throw new Error("Report not found");
      if (!report.fileUrl) throw new Error("No PDF attached — regenerate PDF first");
      if (report.status === "ACCEPTED") throw new Error("Report already accepted");
      // Use eFilingService with isResub=true (appends -RESUB suffix to ref)
      const { submitToAuthority: eFile } = await import("../eFilingService");
      const filingResult = await eFile(input.authority, {
        reportId: report.reportId,
        reportType: report.reportType,
        pdfUrl: report.fileUrl,
        submittedBy: ctx.user.name ?? ctx.user.openId,
        notes: input.notes,
        metadata: { reportDbId: report.id, platform: "OG-RMM", resubmission: true },
      }, true);
      await db.update(regulatoryReports).set({
        status: "SUBMITTED",
        submittedAt: new Date(),
        submittedBy: ctx.user.name ?? ctx.user.openId,
        submissionRef: filingResult.submissionRef,
        notes: input.notes ?? report.notes,
        updatedAt: new Date(),
      }).where(eq(regulatoryReports.id, input.id));
      return {
        success: true,
        submissionRef: filingResult.submissionRef,
        authority: input.authority,
        submittedAt: filingResult.submittedAt,
        isStub: filingResult.isStub,
        attempts: filingResult.attempts,
        message: `Report ${report.reportId} re-submitted to ${input.authority}. New Ref: ${filingResult.submissionRef}`,
      };
    }),

  /**
   * Admin-only: simulate authority response by setting status to ACCEPTED or REJECTED.
   * Used for demo/testing without a live e-filing API.
   */
  updateSubmissionStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["ACCEPTED", "REJECTED"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [report] = await db.select().from(regulatoryReports)
        .where(eq(regulatoryReports.id, input.id)).limit(1);
      if (!report) throw new Error("Report not found");
      await db.update(regulatoryReports).set({
        status: input.status,
        notes: input.notes ?? report.notes,
        updatedAt: new Date(),
      }).where(eq(regulatoryReports.id, input.id));
      return {
        success: true,
        reportId: report.reportId,
        status: input.status,
        message: `Report ${report.reportId} marked as ${input.status} by ${ctx.user.name ?? ctx.user.openId}`,
      };
    }),

  /**
   * Calendar data: reports with computed dueDate for month-grid display.
   */
  calendarData: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const reports = await db.select().from(regulatoryReports)
      .orderBy(desc(regulatoryReports.createdAt)).limit(200);
    const quarterEnd: Record<string, string> = { Q1: "-03-31", Q2: "-06-30", Q3: "-09-30", Q4: "-12-31" };
    return reports.map(r => {
      let dueDate: string | null = null;
      if (r.period) {
        const [year, quarter] = r.period.split("-");
        if (quarter && quarterEnd[quarter]) dueDate = `${year}${quarterEnd[quarter]}`;
        else if (r.period.match(/^\d{4}-\d{2}$/)) dueDate = `${r.period}-28`;
        else if (r.period.match(/^\d{4}$/)) dueDate = `${r.period}-12-31`;
      }
      return { ...r, dueDate };
    });
  }),

  // Bilingual Arabic/English regulatory report export
  generateBilingualPDF: protectedProcedure
    .input(z.object({
      reportId: z.string().optional(),
      reportType: z.string().default("MONTHLY_PRODUCTION"),
      period: z.string().default("2025-Q4"),
      language: z.enum(["ar", "en", "bilingual"]).default("bilingual"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Build bilingual report data
      const reportData = {
        reportType: input.reportType,
        period: input.period,
        language: input.language,
        generatedAt: new Date().toISOString(),
        generatedBy: ctx.user.name ?? ctx.user.email,
        // Arabic labels
        titleAr: "تقرير الإنتاج الشهري",
        titleEn: "Monthly Production Report",
        authorityAr: "هيئة النفط والغاز",
        authorityEn: "Oil & Gas Regulatory Authority",
        // Content sections
        sections: [
          {
            headingAr: "ملخص الإنتاج",
            headingEn: "Production Summary",
            content: "See attached data tables",
          },
          {
            headingAr: "بيانات الآبار",
            headingEn: "Well Data",
            content: "Well-level production breakdown",
          },
          {
            headingAr: "الامتثال البيئي",
            headingEn: "Environmental Compliance",
            content: "GHG emissions and flaring data",
          },
        ],
      };

      // Generate HTML for bilingual report
      const isAr = input.language === "ar";
      const isBilingual = input.language === "bilingual";

      const htmlContent = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${reportData.titleEn} / ${reportData.titleAr}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&family=Roboto:wght@400;700&display=swap');
    body { font-family: 'Roboto', sans-serif; margin: 40px; color: #1a1a2e; }
    .ar { font-family: 'Noto Sans Arabic', sans-serif; direction: rtl; text-align: right; }
    .header { display: flex; justify-content: space-between; border-bottom: 3px solid #C9A84C; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #C9A84C; }
    .bilingual-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .section-en { border-left: 4px solid #C9A84C; padding-left: 16px; }
    .section-ar { border-right: 4px solid #C9A84C; padding-right: 16px; text-align: right; direction: rtl; }
    h1 { font-size: 22px; color: #0A0E1A; }
    h2 { font-size: 16px; color: #C9A84C; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #0A0E1A; color: #C9A84C; padding: 8px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
    .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 16px; font-size: 11px; color: #666; }
    .classification { background: #0A0E1A; color: #C9A84C; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">OG-RMM Platform</div>
      <div style="font-size:12px;color:#666;margin-top:4px">${reportData.authorityEn}</div>
    </div>
    <div style="text-align:right" class="ar">
      <div class="logo">${reportData.authorityAr}</div>
      <div style="font-size:12px;color:#666;margin-top:4px">${reportData.period}</div>
    </div>
  </div>

  ${isBilingual ? `
  <div class="bilingual-row">
    <div class="section-en"><h1>${reportData.titleEn}</h1><p>Period: ${reportData.period}</p><p>Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</p><p>Prepared by: ${reportData.generatedBy}</p></div>
    <div class="section-ar ar"><h1>${reportData.titleAr}</h1><p>الفترة: ${reportData.period}</p><p>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' })}</p><p>أعده: ${reportData.generatedBy}</p></div>
  </div>` : `<h1>${isAr ? reportData.titleAr : reportData.titleEn}</h1>`}

  <span class="classification">CONFIDENTIAL — RESTRICTED DISTRIBUTION</span>

  ${reportData.sections.map(s => isBilingual ? `
  <div class="bilingual-row" style="margin-top:24px">
    <div class="section-en"><h2>${s.headingEn}</h2><p>${s.content}</p></div>
    <div class="section-ar ar"><h2>${s.headingAr}</h2><p>${s.content}</p></div>
  </div>` : `<div style="margin-top:24px"><h2>${isAr ? s.headingAr : s.headingEn}</h2><p>${s.content}</p></div>`).join('')}

  <div class="footer">
    <p>Generated by OG-RMM Platform · ${new Date().toISOString()} · ${ctx.user.email}</p>
    ${isBilingual ? `<p class="ar" style="text-align:right">تم الإنشاء بواسطة منصة OG-RMM · ${new Date().toLocaleDateString('ar-SA')}</p>` : ''}
  </div>
</body></html>`;

      return {
        html: htmlContent,
        reportType: input.reportType,
        period: input.period,
        language: input.language,
        generatedAt: new Date().toISOString(),
        titleEn: reportData.titleEn,
        titleAr: reportData.titleAr,
      };
    }),
});

// ─── ML PREDICTIONS ───────────────────────────────────────────────────────────
export const mlRouter = router({
  predictions: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      modelType: z.enum(["ESP_FAILURE","ANOMALY_DETECTION","PRODUCTION_FORECAST","DECLINE_CURVE"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.wellId) conds.push(eq(mlPredictions.wellId, input.wellId));
      if (input.modelType) conds.push(eq(mlPredictions.modelType, input.modelType));
      return db.select().from(mlPredictions)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(mlPredictions.predictedAt))
        .limit(input.limit);
    }),

  latestByWell: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mlPredictions)
        .where(eq(mlPredictions.wellId, input.wellId))
        .orderBy(desc(mlPredictions.predictedAt))
        .limit(4);
    }),

  ingest: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      modelType: z.enum(["ESP_FAILURE","ANOMALY_DETECTION","PRODUCTION_FORECAST","DECLINE_CURVE"]),
      healthScore: z.number().optional(),
      failureProbability: z.number().optional(),
      daysToFailure: z.number().optional(),
      confidence: z.number().optional(),
      anomalyScore: z.number().optional(),
      features: z.record(z.string(), z.number()).optional(),
      recommendation: z.string().optional(),
      modelVersion: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [row] = await db.insert(mlPredictions).values({
        ...input,
        features: input.features ?? null,
      }).returning();
      return { id: row.id };
    }),
});

// ─── DIGITAL TWIN ─────────────────────────────────────────────────────────────
export const digitalTwinRouter = router({
  scenarios: publicProcedure
    .input(z.object({ wellId: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(digitalTwinScenarios)
        .where(input.wellId ? eq(digitalTwinScenarios.wellId, input.wellId) : undefined)
        .orderBy(desc(digitalTwinScenarios.createdAt))
        .limit(input.limit);
    }),

  createScenario: protectedProcedure
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
      const scenarioId = `DT-${nanoid(10).toUpperCase()}`;
      const [row] = await db.insert(digitalTwinScenarios).values({
        scenarioId,
        ...input,
        createdBy: ctx.user.name ?? ctx.user.openId,
      }).returning();
      return { id: row.id, scenarioId };
    }),

  deleteScenario: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(digitalTwinScenarios).where(eq(digitalTwinScenarios.id, input.id));
      return { success: true };
    }),

  /**
   * Get calibrated physics parameters for a well.
   * Falls back to sensible defaults if no params exist yet.
   */
  getPhysicsParams: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(wellPhysicsParams)
        .where(eq(wellPhysicsParams.wellId, input.wellId))
        .limit(1);
      if (row) return row;
      // Fall back to well-level physics columns
      const [well] = await db.select().from(wells)
        .where(eq(wells.wellId, input.wellId))
        .limit(1);
      if (!well) return null;
      return {
        wellId: input.wellId,
        reservoirPressurePsi: well.reservoirPressurePsi ?? 3200,
        qMaxBpd: well.qMaxBpd ?? 1200,
        skinFactor: well.skinFactor ?? 0,
        perforationIntervalFt: well.perforationIntervalFt ?? 120,
        tvdFt: well.depth ?? 8500,
        fluidGradientPsiPerFt: well.fluidGradientPsiPerFt ?? 0.433,
        waterCutFraction: well.waterCutFraction ?? 0.25,
        gorScfPerBbl: well.gorScfPerBbl ?? 450,
        espFrequencyHz: well.espFrequencyHz ?? 50,
        espMinFreqHz: 35,
        espMaxFreqHz: 65,
        qi: well.qMaxBpd ?? 1200,
        di: 0.08,
        b: 0,
        curveType: "EXPONENTIAL" as const,
        confidenceScore: 0.5,
        calibratedAt: well.createdAt,
        calibratedBy: null,
        notes: "Auto-derived from well record (not yet calibrated)",
      };
    }),

  /**
   * Upsert calibrated physics parameters for a well.
   * Called when a scenario is accepted as the new baseline.
   */
  upsertPhysicsParams: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      reservoirPressurePsi: z.number(),
      qMaxBpd: z.number(),
      skinFactor: z.number().optional(),
      perforationIntervalFt: z.number().optional(),
      tvdFt: z.number().optional(),
      fluidGradientPsiPerFt: z.number().optional(),
      waterCutFraction: z.number().optional(),
      gorScfPerBbl: z.number().optional(),
      espFrequencyHz: z.number().optional(),
      qi: z.number().optional(),
      di: z.number().optional(),
      b: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const now = new Date();
      await db.insert(wellPhysicsParams).values({
        wellId: input.wellId,
        reservoirPressurePsi: input.reservoirPressurePsi,
        qMaxBpd: input.qMaxBpd,
        skinFactor: input.skinFactor ?? 0,
        perforationIntervalFt: input.perforationIntervalFt ?? 120,
        tvdFt: input.tvdFt ?? 8500,
        fluidGradientPsiPerFt: input.fluidGradientPsiPerFt ?? 0.433,
        waterCutFraction: input.waterCutFraction ?? 0.25,
        gorScfPerBbl: input.gorScfPerBbl ?? 450,
        espFrequencyHz: input.espFrequencyHz ?? 50,
        qi: input.qi ?? input.qMaxBpd,
        di: input.di ?? 0.08,
        b: input.b ?? 0,
        calibratedAt: now,
        calibratedBy: ctx.user.name ?? ctx.user.openId,
        confidenceScore: 0.9,
        notes: input.notes,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: wellPhysicsParams.wellId,
        set: {
          reservoirPressurePsi: input.reservoirPressurePsi,
          qMaxBpd: input.qMaxBpd,
          skinFactor: input.skinFactor ?? 0,
          perforationIntervalFt: input.perforationIntervalFt ?? 120,
          tvdFt: input.tvdFt,
          fluidGradientPsiPerFt: input.fluidGradientPsiPerFt,
          waterCutFraction: input.waterCutFraction,
          gorScfPerBbl: input.gorScfPerBbl,
          espFrequencyHz: input.espFrequencyHz,
          qi: input.qi,
          di: input.di,
          b: input.b,
          calibratedAt: now,
          calibratedBy: ctx.user.name ?? ctx.user.openId,
          confidenceScore: 0.9,
          notes: input.notes,
          updatedAt: now,
        },
      });
      return { success: true };
    }),

  /**
   * Get the latest telemetry reading for a well (for real-time DT sync).
   */
  getLatestTelemetry: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(telemetryReadings)
        .where(eq(telemetryReadings.wellId, input.wellId))
        .orderBy(desc(telemetryReadings.recordedAt))
        .limit(1);
      return row ?? null;
    }),

  /**
   * Get decline curve params for a well (from declineCurveParams table).
   */
  getDeclineCurve: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(declineCurveParams)
        .where(eq(declineCurveParams.wellId, input.wellId))
        .orderBy(desc(declineCurveParams.fittedAt))
        .limit(1);
      return row ?? null;
    }),

  /**
   * Generate LLM-powered optimization recommendations for a well.
   * Uses live physics params, latest telemetry, and scenario history.
   */
  generateRecommendations: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      wellName: z.string(),
      reservoirPressurePsi: z.number(),
      qMaxBpd: z.number(),
      skinFactor: z.number(),
      espFrequencyHz: z.number(),
      currentFlowRateBpd: z.number().optional(),
      waterCutPct: z.number().optional(),
      bhpPsi: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("../_core/llm");
      const prompt = `You are a petroleum engineer AI assistant for an oil & gas remote monitoring platform.

Analyze the following well parameters and provide exactly 3 optimization recommendations in JSON format.

Well: ${input.wellName} (${input.wellId})
Reservoir Pressure: ${input.reservoirPressurePsi} PSI
Absolute Open Flow (AOF / q_max): ${input.qMaxBpd} BPD
Skin Factor: ${input.skinFactor} (positive = damage, negative = stimulation)
ESP Frequency: ${input.espFrequencyHz} Hz
${input.currentFlowRateBpd ? `Current Flow Rate: ${input.currentFlowRateBpd} BPD` : ""}
${input.waterCutPct ? `Water Cut: ${input.waterCutPct}%` : ""}
${input.bhpPsi ? `Bottom Hole Pressure: ${input.bhpPsi} PSI` : ""}

Return a JSON array of exactly 3 recommendations, each with these fields:
- priority: "HIGH" | "MEDIUM" | "LOW"
- action: string (specific engineering action, max 120 chars)
- impact: string (quantified production impact, e.g. "+85 BPD estimated gain")
- confidence: number (0-100)
- basis: string (engineering rationale, max 200 chars)
- category: "ESP" | "STIMULATION" | "CHOKE" | "CHEMICAL" | "WORKOVER" | "MONITORING"`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a petroleum engineer AI. Always respond with valid JSON only, no markdown fences." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "well_recommendations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string" },
                        action: { type: "string" },
                        impact: { type: "string" },
                        confidence: { type: "number" },
                        basis: { type: "string" },
                        category: { type: "string" },
                      },
                      required: ["priority", "action", "impact", "confidence", "basis", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recommendations"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        return { recommendations: parsed.recommendations, source: "llm" };
      } catch (err) {
        // Fallback to deterministic recommendations if LLM fails
        const skinPenalty = input.skinFactor > 3 ? input.qMaxBpd * 0.12 : 0;
        const espGain = input.espFrequencyHz < 58 ? input.qMaxBpd * 0.06 : 0;
        const chokePotential = input.qMaxBpd * 0.03;
        return {
          recommendations: [
            {
              priority: espGain > 50 ? "HIGH" : "MEDIUM",
              action: `Increase ESP frequency from ${input.espFrequencyHz} Hz to ${Math.min(input.espFrequencyHz + 4, 65)} Hz`,
              impact: `+${Math.round(espGain)} BPD estimated gain`,
              confidence: 87,
              basis: "Nodal analysis indicates VLP curve intersection below optimum operating point.",
              category: "ESP",
            },
            {
              priority: "MEDIUM",
              action: "Reduce wellhead backpressure by 50 PSI via choke adjustment",
              impact: `+${Math.round(chokePotential)} BPD estimated gain`,
              confidence: 72,
              basis: "Current WHP is limiting VLP operating point. Separator capacity allows reduction.",
              category: "CHOKE",
            },
            {
              priority: skinPenalty > 80 ? "HIGH" : "LOW",
              action: `Schedule acid stimulation — skin factor estimated at +${input.skinFactor.toFixed(1)}`,
              impact: `+${Math.round(skinPenalty)} BPD post-stimulation`,
              confidence: 65,
              basis: "Pressure transient analysis indicates formation damage. Acid job ROI: 4.2x at current oil price.",
              category: "STIMULATION",
            },
          ],
          source: "deterministic",
        };
      }
    }),
});

// ─── PRODUCTION RECORDS ───────────────────────────────────────────────────────
export const productionRouter = router({
  list: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().default(90),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds: any[] = [];
      if (input.wellId) conds.push(eq(productionRecords.wellId, input.wellId));
      if (input.from) conds.push(gte(productionRecords.date, new Date(input.from)));
      return db.select().from(productionRecords)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(productionRecords.date))
        .limit(input.limit);
    }),

  summary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
      const [stats] = await db.select({
      totalOil: sql<number>`sum(oil_bbls)`,
      totalGas: sql<number>`sum(gas_mmscf)`,
      totalWater: sql<number>`sum(water_bbls)`,
      avgUptime: sql<number>`avg(uptime_hours)`,
    }).from(productionRecords);
    return stats;
  }),

  create: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      recordDate: z.string(),
      oilBbls: z.number().optional(),
      gasMmscf: z.number().optional(),
      waterBbls: z.number().optional(),
      uptimePct: z.number().optional(),
      downtimeReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [row] = await db.insert(productionRecords).values({
        wellId: input.wellId,
        date: new Date(input.recordDate),
        oilBbls: input.oilBbls,
        gasMmscf: input.gasMmscf,
        waterBbls: input.waterBbls,
        uptimeHours: input.uptimePct ? (input.uptimePct / 100) * 24 : undefined,
        downtime: input.downtimeReason,
      }).returning();
      return { id: row.id };
    }),
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
export const auditRouter = router({
  list: publicProcedure
    .input(z.object({
      resource: z.string().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(auditLog)
        .where(input.resource ? eq(auditLog.resource, input.resource) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);
    }),

  log: protectedProcedure
    .input(z.object({
      action: z.string(),
      resource: z.string(),
      resourceId: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.insert(auditLog).values({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? undefined,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: input.details ?? null,
      });
      return { success: true };
    }),
});

// ─── DIGITAL TWIN EXTENSIONS ──────────────────────────────────────────────────
// These procedures extend the existing digitalTwinRouter by being exported
// separately and merged in the appRouter under the same namespace.
// They call the Python ML service (port 4003) for Ollama-powered features.

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:4003";

/**
 * Call the Python ML service with a timeout and fallback.
 */
async function callMlService<T>(
  path: string,
  body: unknown,
  timeoutMs = 15_000,
): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const digitalTwinExtRouter = router({
  /**
   * Get all wells from DB with their physics parameters for the Digital Twin.
   * Returns wells enriched with physics columns for IPR/VLP computation.
   */
  listWellsWithPhysics: publicProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(wells)
        .orderBy(wells.wellId)
        .limit(input.limit);
      return rows.map((w) => ({
        wellId: w.wellId,
        wellName: w.name,
        field: w.field,
        status: w.status,
        latitude: w.latitude ? Number(w.latitude) : null,
        longitude: w.longitude ? Number(w.longitude) : null,
        depth: w.depth,
        // Physics columns (may be null if not yet populated)
        reservoirPressurePsi: w.reservoirPressurePsi ?? 3200,
        qMaxBpd: w.qMaxBpd ?? 1200,
        fluidGradientPsiPerFt: w.fluidGradientPsiPerFt ?? 0.433,
        skinFactor: w.skinFactor ?? 0,
        tubingIdIn: w.tubingIdIn ?? 2.441,
        casingIdIn: w.casingIdIn ?? 7.0,
        permeabilityMd: w.permeabilityMd ?? 50,
        porosityFraction: w.porosityFraction ?? 0.22,
        netPayFt: w.netPayFt ?? 80,
        espFrequencyHz: w.espFrequencyHz ?? 50,
        waterCutFraction: w.waterCutFraction ?? 0.25,
        gorScfPerBbl: w.gorScfPerBbl ?? 450,
        perforationIntervalFt: w.perforationIntervalFt ?? 120,
      }));
    }),

  /**
   * Run sensitivity analysis for a well parameter.
   * Returns an array of {parameter, value, rateBpd} for tornado chart.
   */
  sensitivityAnalysis: publicProcedure
    .input(z.object({
      wellId: z.string(),
      baseReservoirPressure: z.number(),
      baseQMax: z.number(),
      baseSkinFactor: z.number(),
      baseEspFrequency: z.number(),
      baseWaterCut: z.number(),
    }))
    .query(async ({ input }) => {
      // Compute ±20% sensitivity for each key parameter
      // Uses Vogel IPR approximation: q = qmax * (1 - 0.2*(Pwf/Pr) - 0.8*(Pwf/Pr)^2)
      // Assumes Pwf = 0.5 * Pr (50% drawdown) as base operating point
      const base = input.baseQMax;
      const results: Array<{
        parameter: string;
        lowValue: number;
        highValue: number;
        lowRate: number;
        highRate: number;
        baseRate: number;
        unit: string;
      }> = [];

      const vogelRate = (pr: number, qmax: number, skin: number) => {
        const skinPenalty = Math.max(0, 1 - skin * 0.05);
        const pwf = pr * 0.5;
        const ratio = pwf / pr;
        return Math.max(0, qmax * skinPenalty * (1 - 0.2 * ratio - 0.8 * ratio * ratio));
      };

      const baseRate = vogelRate(
        input.baseReservoirPressure,
        input.baseQMax,
        input.baseSkinFactor,
      );

      // Reservoir pressure ±20%
      results.push({
        parameter: "Reservoir Pressure",
        lowValue: input.baseReservoirPressure * 0.8,
        highValue: input.baseReservoirPressure * 1.2,
        lowRate: vogelRate(input.baseReservoirPressure * 0.8, input.baseQMax, input.baseSkinFactor),
        highRate: vogelRate(input.baseReservoirPressure * 1.2, input.baseQMax, input.baseSkinFactor),
        baseRate,
        unit: "PSI",
      });

      // qMax ±20%
      results.push({
        parameter: "AOF (q_max)",
        lowValue: input.baseQMax * 0.8,
        highValue: input.baseQMax * 1.2,
        lowRate: vogelRate(input.baseReservoirPressure, input.baseQMax * 0.8, input.baseSkinFactor),
        highRate: vogelRate(input.baseReservoirPressure, input.baseQMax * 1.2, input.baseSkinFactor),
        baseRate,
        unit: "BPD",
      });

      // Skin factor ±2 (absolute)
      results.push({
        parameter: "Skin Factor",
        lowValue: Math.max(0, input.baseSkinFactor - 2),
        highValue: input.baseSkinFactor + 2,
        lowRate: vogelRate(input.baseReservoirPressure, input.baseQMax, Math.max(0, input.baseSkinFactor - 2)),
        highRate: vogelRate(input.baseReservoirPressure, input.baseQMax, input.baseSkinFactor + 2),
        baseRate,
        unit: "dimensionless",
      });

      // ESP frequency ±10 Hz (maps to ±15% rate via affinity law)
      const espBase = input.baseEspFrequency;
      results.push({
        parameter: "ESP Frequency",
        lowValue: Math.max(35, espBase - 10),
        highValue: Math.min(65, espBase + 10),
        lowRate: baseRate * Math.pow(Math.max(35, espBase - 10) / espBase, 1),
        highRate: baseRate * Math.pow(Math.min(65, espBase + 10) / espBase, 1),
        baseRate,
        unit: "Hz",
      });

      // Water cut ±15%
      const wcBase = input.baseWaterCut;
      results.push({
        parameter: "Water Cut",
        lowValue: Math.max(0, wcBase - 15),
        highValue: Math.min(95, wcBase + 15),
        lowRate: baseRate * (1 + (wcBase - Math.max(0, wcBase - 15)) * 0.005),
        highRate: baseRate * (1 - (Math.min(95, wcBase + 15) - wcBase) * 0.005),
        baseRate,
        unit: "%",
      });

      return results;
    }),

  /**
   * Compare multiple scenarios side-by-side.
   * Returns a matrix of {scenarioId, wellId, name, predictedRate, delta, ...}.
   */
  compareScenarios: publicProcedure
    .input(z.object({
      wellId: z.string(),
      scenarioIds: z.array(z.number()).min(1).max(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(digitalTwinScenarios)
        .where(
          and(
            eq(digitalTwinScenarios.wellId, input.wellId),
            sql`${digitalTwinScenarios.id} = ANY(ARRAY[${sql.join(input.scenarioIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
          )
        )
        .orderBy(desc(digitalTwinScenarios.createdAt));

      const baseRate = rows[0]?.predictedRateBpd ?? 0;
      return rows.map((r) => ({
        id: r.id,
        scenarioId: r.scenarioId,
        name: r.name,
        reservoirPressurePsi: r.reservoirPressurePsi,
        skinFactor: r.skinFactor,
        espFrequencyHz: r.espFrequencyHz,
        chokeOpeningPct: r.chokeOpeningPct,
        predictedRateBpd: r.predictedRateBpd,
        iprAofBpd: r.iprAofBpd,
        optimumRateBpd: r.optimumRateBpd,
        deltaBpd: r.predictedRateBpd != null && baseRate
          ? r.predictedRateBpd - baseRate
          : null,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      }));
    }),

  /**
   * Get ML service health status (for Infrastructure page).
   */
  mlServiceHealth: protectedProcedure.query(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return { available: false, capabilities: null };
      const data = await res.json() as {
        status: string;
        capabilities: Record<string, string>;
        ollama: { available: boolean; model: string };
      };
      return {
        available: true,
        status: data.status,
        capabilities: data.capabilities,
        ollama: data.ollama,
      };
    } catch {
      return { available: false, capabilities: null, ollama: null };
    }
  }),

  /**
   * Call Python ML service for Ollama-powered well recommendations.
   * Falls back to rule-based recommendations if ML service is unavailable.
   */
  mlRecommend: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      currentRateBpd: z.number(),
      operatingPointPwf: z.number(),
      reservoirPressure: z.number(),
      espFrequencyHz: z.number(),
      waterCutPct: z.number(),
      recentAnomalies: z.array(z.string()).default([]),
      context: z.string().default(""),
    }))
    .mutation(async ({ input }) => {
      const result = await callMlService<{
        well_id: string;
        recommendations: string[];
        priority: string;
        estimated_uplift_bpd: number;
        confidence: number;
        model: string;
      }>("/recommend", {
        well_id: input.wellId,
        current_rate_bpd: input.currentRateBpd,
        operating_point_pwf: input.operatingPointPwf,
        reservoir_pressure: input.reservoirPressure,
        esp_frequency_hz: input.espFrequencyHz,
        water_cut_pct: input.waterCutPct,
        recent_anomalies: input.recentAnomalies,
        context: input.context,
      });

      if (result) {
        return {
          recommendations: result.recommendations.map((r, i) => ({
            priority: i === 0 ? result.priority : "MEDIUM",
            action: r,
            impact: `+${Math.round(result.estimated_uplift_bpd / result.recommendations.length)} BPD estimated`,
            confidence: Math.round(result.confidence * 100),
            basis: "ML service recommendation",
            category: "ESP" as const,
          })),
          source: result.model,
          estimatedUpliftBpd: result.estimated_uplift_bpd,
        };
      }

      // Fallback if ML service is unavailable
      return {
        recommendations: [
          {
            priority: "MEDIUM",
            action: "ML service unavailable — using deterministic recommendations",
            impact: "N/A",
            confidence: 50,
            basis: "Rule-based fallback",
            category: "MONITORING" as const,
          },
        ],
        source: "fallback",
        estimatedUpliftBpd: 0,
      };
    }),

  /**
   * Detect anomalies in well telemetry using the Python ML service.
   */
  detectAnomalies: publicProcedure
    .input(z.object({
      wellId: z.string(),
      parameter: z.string(),
      values: z.array(z.number()).min(5),
    }))
    .query(async ({ input }) => {
      const result = await callMlService<{
        anomalies: Array<{ index: number; value: number; score: number; is_anomaly: boolean; reason: string }>;
        anomaly_count: number;
        method: string;
        simulation: boolean;
      }>("/anomaly/detect", {
        well_id: input.wellId,
        parameter: input.parameter,
        values: input.values,
      });
      return result ?? { anomalies: [], anomaly_count: 0, method: "unavailable", simulation: true };
    }),

  /**
   * Calibrate Arps decline curve from production history using the Python ML service.
   */
  calibrateDecline: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      productionHistory: z.array(z.number()).min(2),
    }))
    .mutation(async ({ input }) => {
      const result = await callMlService<{
        qi: number;
        di: number;
        b: number;
        r_squared: number;
        eur_mbbl: number;
        simulation: boolean;
      }>("/decline/calibrate", {
        well_id: input.wellId,
        production_history: input.productionHistory,
      });
      return result ?? null;
    }),
});
