import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure, adminProcedure} from "../_core/trpc";
import { getDb } from "../db";
import { wells, telemetryReadings, alarms, workovers, productionRecords, alarmRules } from "../../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { withCache, cacheDel, TTL, cachePublish } from "../cache";

export const wellsRouter = router({
  // ── Wells CRUD ────────────────────────────────────────────────────────────────────────
  list: publicProcedure
    .input(z.object({
      status: z.enum(["ACTIVE","SHUT_IN","DRILLING","WORKOVER","ABANDONED"]).optional(),
      field: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const cacheKey = `og-rmm:wells:list:${input?.limit ?? 50}:${input?.offset ?? 0}:${input?.status ?? "all"}:${input?.field ?? "all"}`;
      return withCache(cacheKey, TTL.WELLS_LIST, async () => {
        try {
          const db = await getDb();
          if (!db) return { wells: [], total: 0 };
          const conditions: ReturnType<typeof eq>[] = [];
          if (input?.status) conditions.push(eq(wells.status, input.status));
          if (input?.field) conditions.push(eq(wells.field, input.field));
          const rows = await db.select().from(wells)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(wells.createdAt))
            .limit(input?.limit ?? 50)
            .offset(input?.offset ?? 0);
          const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(wells)
            .where(conditions.length ? and(...conditions) : undefined);
          return { wells: rows, total: Number(count) };
        } catch (err: unknown) {
          if (err instanceof TRPCError) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
        }
      });
    }),

  get: publicProcedure
    .input(z.object({ wellId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(wells).where(eq(wells.wellId, input.wellId)).limit(1);
      return row ?? null;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return null;
        const [row] = await db.select().from(wells).where(eq(wells.id, input.id)).limit(1);
        return row ?? null;
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      field: z.string(),
      basin: z.string().optional(),
      country: z.string().default("Kuwait"),
      operator: z.string().optional(),
      wellType: z.enum(["OIL","GAS","WATER_INJECTION","DISPOSAL","OBSERVATION"]).default("OIL"),
      status: z.enum(["ACTIVE","SHUT_IN","DRILLING","WORKOVER","ABANDONED"]).default("ACTIVE"),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      depth: z.number().optional(),
      apiNumber: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const wellId = `W-${nanoid(8).toUpperCase()}`;
      // Invalidate well list cache after creation
      await cacheDel("og-rmm:wells:list:50:0:all:all", "og-rmm:wells:list:200:0:all:all");
      const [row] = await db.insert(wells).values({
        wellId,
        name: input.name,
        field: input.field,
        basin: input.basin,
        country: input.country,
        operator: input.operator,
        wellType: input.wellType,
        status: input.status,
        latitude: input.latitude != null ? String(input.latitude) : undefined,
        longitude: input.longitude != null ? String(input.longitude) : undefined,
        depth: input.depth,
        apiNumber: input.apiNumber,
      }).returning();
      return { id: row.id, wellId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      status: z.enum(["ACTIVE","SHUT_IN","DRILLING","WORKOVER","ABANDONED"]).optional(),
      operator: z.string().optional(),
      field: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { id, ...updates } = input;
        await db.update(wells).set({ ...updates, updatedAt: new Date() }).where(eq(wells.id, id));
        await cacheDel("og-rmm:wells:list:50:0:all:all", "og-rmm:wells:list:200:0:all:all");
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(wells).where(eq(wells.id, input.id));
      await cacheDel("og-rmm:wells:list:50:0:all:all", "og-rmm:wells:list:200:0:all:all");
      return { success: true };
    }),

  // ── Telemetry ───────────────────────────────────────────────────────────────
  telemetry: publicProcedure
    .input(z.object({
      wellId: z.string(),
      hours: z.number().default(24),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - input.hours * 3600 * 1000);
        return db.select().from(telemetryReadings)
          .where(and(
            eq(telemetryReadings.wellId, input.wellId),
            gte(telemetryReadings.recordedAt, since)
          ))
          .orderBy(desc(telemetryReadings.recordedAt))
          .limit(input.limit);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  latestTelemetry: publicProcedure
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

  ingestTelemetry: publicProcedure
    .input(z.object({
      wellId: z.string(),
      tubingPressure: z.number().optional(),
      casingPressure: z.number().optional(),
      flowRate: z.number().optional(),
      oilRate: z.number().optional(),
      gasRate: z.number().optional(),
      waterRate: z.number().optional(),
      waterCut: z.number().optional(),
      gor: z.number().optional(),
      espCurrent: z.number().optional(),
      espVibration: z.number().optional(),
      espFrequency: z.number().optional(),
      espMotorTemp: z.number().optional(),
      wellheadTemp: z.number().optional(),
      chokePosition: z.number().optional(),
      bhp: z.number().optional(),
      bht: z.number().optional(),
      protocol: z.enum(["MQTT","MODBUS_TCP","MODBUS_RTU","OPC_UA","DNP3","HART"]).optional(),
      quality: z.number().int().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { wellId, ...readings } = input;
  
        // 1. Persist telemetry reading
        await db.insert(telemetryReadings).values({ wellId, ...readings });
  
        // 2. Automatic alarm evaluation (ISA-18.2 setpoint-based)
        //    Load active rules for this well and evaluate against incoming values
        const rules = await db.select().from(alarmRules)
          .where(and(eq(alarmRules.wellId, wellId), eq(alarmRules.enabled, true)));
  
        const triggeredAlarms: string[] = [];
        for (const rule of rules) {
          const fieldValue = (readings as Record<string, number | undefined>)[rule.sensorField];
          if (fieldValue == null) continue;
  
          // Check if condition is met (with dead-band hysteresis)
          const exceeded = (
            (rule.condition === "GT"  && fieldValue >  rule.threshold + (rule.deadBand ?? 0)) ||
            (rule.condition === "GTE" && fieldValue >= rule.threshold) ||
            (rule.condition === "LT"  && fieldValue <  rule.threshold - (rule.deadBand ?? 0)) ||
            (rule.condition === "LTE" && fieldValue <= rule.threshold)
          );
          if (!exceeded) continue;
  
          // Check if an active (non-cleared, non-suppressed) alarm already exists for this tag
          const [existing] = await db.select({ id: alarms.id, state: alarms.state })
            .from(alarms)
            .where(and(
              eq(alarms.wellId, wellId),
              eq(alarms.tag, rule.tag),
            ))
            .orderBy(desc(alarms.createdAt))
            .limit(1);
  
          const alreadyActive = existing &&
            (existing.state === "UNACKNOWLEDGED" || existing.state === "ACKNOWLEDGED");
          if (alreadyActive) continue;
  
          // Insert new alarm
          const alarmId = `ALM-${nanoid(8).toUpperCase()}`;
          await db.insert(alarms).values({
            alarmId,
            wellId,
            tag: rule.tag,
            description: rule.description,
            severity: rule.severity,
            state: "UNACKNOWLEDGED",
            value: fieldValue,
            setpoint: rule.threshold,
            unit: rule.unit ?? undefined,
            isa182Category: rule.isa182Category ?? "PROCESS",
            isStanding: false,
            isChattering: false,
          });
          triggeredAlarms.push(rule.tag);
          // Publish to Redis pub/sub for real-time SSE broadcast
          await cachePublish("og-rmm:alarm:created", {
            alarmId,
            wellId,
            tag: rule.tag,
            severity: rule.severity,
            description: rule.description,
            timestamp: new Date().toISOString(),
          });
        } // end for rule loop

        // Invalidate alarm caches after new alarms are triggered
        if (triggeredAlarms.length > 0) {
          await cacheDel("og-rmm:alarms:list:200:all", "og-rmm:alarms:stats", "og-rmm:overview:kpis");
        }

        return { success: true, alarmsTriggered: triggeredAlarms.length, tags: triggeredAlarms };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Alarm Rules CRUD ────────────────────────────────────────────────────────
  alarmRules: publicProcedure
    .input(z.object({ wellId: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(alarmRules)
        .where(input.wellId ? eq(alarmRules.wellId, input.wellId) : undefined)
        .orderBy(alarmRules.wellId, alarmRules.severity);
    }),

  createAlarmRule: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      tag: z.string(),
      sensorField: z.string(),
      condition: z.enum(["GT","LT","GTE","LTE"]),
      threshold: z.number(),
      deadBand: z.number().default(0),
      severity: z.number().int().min(1).max(4),
      description: z.string(),
      unit: z.string().optional(),
      isa182Category: z.string().default("PROCESS"),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const ruleId = `RULE-${nanoid(8).toUpperCase()}`;
        const [row] = await db.insert(alarmRules).values({ ruleId, ...input }).returning();
        return { id: row.id, ruleId };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  updateAlarmRule: protectedProcedure
    .input(z.object({
      id: z.number(),
      threshold: z.number().optional(),
      deadBand: z.number().optional(),
      severity: z.number().int().min(1).max(4).optional(),
      enabled: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(alarmRules).set({ ...updates, updatedAt: new Date() }).where(eq(alarmRules.id, id));
      return { success: true };
    }),

  deleteAlarmRule: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.delete(alarmRules).where(eq(alarmRules.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  // ── Alarms ──────────────────────────────────────────────────────────────────
  alarms: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      state: z.enum(["UNACKNOWLEDGED","ACKNOWLEDGED","CLEARED","SUPPRESSED"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: ReturnType<typeof eq>[] = [];
      if (input.wellId) conditions.push(eq(alarms.wellId, input.wellId));
      if (input.state) conditions.push(eq(alarms.state, input.state));
      return db.select().from(alarms)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(alarms.createdAt))
        .limit(input.limit);
    }),

  allAlarms: publicProcedure
    .input(z.object({
      state: z.enum(["UNACKNOWLEDGED","ACKNOWLEDGED","CLEARED","SUPPRESSED"]).optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(alarms)
          .where(input.state ? eq(alarms.state, input.state) : undefined)
          .orderBy(desc(alarms.createdAt))
          .limit(input.limit);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  acknowledgeAlarm: protectedProcedure
    .input(z.object({ id: z.number(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(alarms).set({
        state: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedBy: ctx.user.name ?? ctx.user.openId,
      }).where(eq(alarms.id, input.id));
      return { success: true };
    }),

  suppressAlarm: protectedProcedure
    .input(z.object({ id: z.number(), until: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.update(alarms).set({
          state: "SUPPRESSED",
          suppressedUntil: new Date(input.until),
        }).where(eq(alarms.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  clearAlarm: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(alarms).set({ state: "CLEARED", clearedAt: new Date() })
        .where(eq(alarms.id, input.id));
      return { success: true };
    }),

  // ── Workovers ───────────────────────────────────────────────────────────────
  workovers: publicProcedure
    .input(z.object({
      wellId: z.string().optional(),
      status: z.enum(["PLANNED","MOBILIZING","IN_PROGRESS","SUSPENDED","COMPLETED","CANCELLED"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        const conditions: ReturnType<typeof eq>[] = [];
        if (input.wellId) conditions.push(eq(workovers.wellId, input.wellId));
        if (input.status) conditions.push(eq(workovers.status, input.status));
        return db.select().from(workovers)
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(workovers.createdAt))
          .limit(input.limit);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  allWorkovers: publicProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workovers).orderBy(desc(workovers.createdAt)).limit(input.limit);
    }),

  createWorkover: protectedProcedure
    .input(z.object({
      wellId: z.string(),
      jobType: z.enum(["PUMP_REPLACEMENT","TUBING_REPAIR","STIMULATION","PERFORATION","SAND_CONTROL","SCALE_REMOVAL","CALIBRATION","INSPECTION","OTHER"]),
      priority: z.enum(["CRITICAL","HIGH","MEDIUM","LOW"]).default("MEDIUM"),
      description: z.string(),
      assignedTo: z.string().optional(),
      scheduledStart: z.string().optional(),
      budgetUsd: z.number().optional(),
      fromCalibration: z.boolean().default(false),
      calibrationSensorId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const jobId = `WO-${nanoid(8).toUpperCase()}`;
        const [row] = await db.insert(workovers).values({
          jobId,
          wellId: input.wellId,
          jobType: input.jobType,
          priority: input.priority,
          description: input.description,
          assignedTo: input.assignedTo,
          startDate: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
          budgetUsd: input.budgetUsd ? String(input.budgetUsd) : undefined,
          fromCalibration: input.fromCalibration,
          calibrationSensorId: input.calibrationSensorId,
          temporalWorkflowId: `wf-${jobId.toLowerCase()}`,
        }).returning();
        return { id: row.id, jobId };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  updateWorkoverStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["PLANNED","MOBILIZING","IN_PROGRESS","SUSPENDED","COMPLETED","CANCELLED"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: Record<string, any> = { status: input.status, updatedAt: new Date() };
      if (input.status === "COMPLETED") updates.completedDate = new Date();
      if (input.status === "IN_PROGRESS") updates.startDate = new Date();
      await db.update(workovers).set(updates).where(eq(workovers.id, input.id));
      return { success: true };
    }),

  // ── Overview stats (used by Overview page) ──────────────────────────────────
  stats: protectedProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select({ status: wells.status }).from(wells);
      const byStatus: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      }
      return { total: rows.length, active: byStatus["ACTIVE"] ?? 0, byStatus, addedThisWeek: 0 };
    } catch (err: unknown) {
      if (err instanceof TRPCError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
    }
  }),

  alarmStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { active: 0, critical: 0, newToday: 0 };
    const [stats] = await db.select({
      active: sql<number>`count(*)`,
      critical: sql<number>`sum(case when severity >= 4 then 1 else 0 end)`,
    }).from(alarms).where(eq(alarms.state, "UNACKNOWLEDGED"));
    return { active: Number(stats?.active ?? 0), critical: Number(stats?.critical ?? 0), newToday: 0 };
  }),

  activeAlarms: publicProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        return db.select().from(alarms)
          .where(eq(alarms.state, "UNACKNOWLEDGED"))
          .orderBy(desc(alarms.createdAt))
          .limit(input.limit);
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
      }
    }),

  productionTrend: publicProcedure
    .input(z.object({ days: z.number().default(14) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const since = new Date(Date.now() - input.days * 86400 * 1000);
      const rows = await db.select({
        date: sql<string>`date(date)`,
        oil: sql<number>`sum(oil_bbls)`,
        gas: sql<number>`sum(gas_mmscf * 10)`,
      }).from(productionRecords)
        .where(gte(productionRecords.date, since))
        .groupBy(sql`date(date)`)
        .orderBy(sql`date(date)`);
      return rows.map(r => ({ date: String(r.date).slice(5), oil: Number(r.oil ?? 0), gas: Number(r.gas ?? 0) }));
    }),

  // ── Per-well KPI Summary (for 6-well consolidated dashboard) ───────────────────
  kpiSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const wellRows = await db.select().from(wells).orderBy(wells.wellId).limit(6);
      // Latest telemetry per well using a self-join
      const latestTelRows = await db.execute(
        sql`SELECT t.* FROM telemetry_readings t
            INNER JOIN (
              SELECT well_id, MAX(recorded_at) AS max_ts
              FROM telemetry_readings GROUP BY well_id
            ) latest ON t.well_id = latest.well_id AND t.recorded_at = latest.max_ts`
      );
      const latestTelemetry = latestTelRows.rows as Array<Record<string, unknown>>;
      const alarmCounts = await db
        .select({
          wellId: alarms.wellId,
          count: sql<number>`count(*)`,
          critical: sql<number>`sum(case when severity >= 4 then 1 else 0 end)`,
        })
        .from(alarms)
        .where(eq(alarms.state, "UNACKNOWLEDGED"))
        .groupBy(alarms.wellId);
      const telMap = Object.fromEntries(latestTelemetry.map(t => [String(t.well_id), t]));
      const alarmMap = Object.fromEntries(alarmCounts.map(a => [a.wellId, a]));
      return wellRows.map(w => {
        const tel = telMap[w.wellId];
        const alm = alarmMap[w.wellId];
        const oilRate = tel?.oil_rate != null ? Number(tel.oil_rate) :
          (w.qMaxBpd ? w.qMaxBpd * (1 - (w.waterCutFraction ?? 0.3)) : null);
        const waterRate = tel?.water_rate != null ? Number(tel.water_rate) :
          (w.qMaxBpd ? w.qMaxBpd * (w.waterCutFraction ?? 0.3) : null);
        const gasRate = tel?.gas_rate != null ? Number(tel.gas_rate) :
          (oilRate && w.gorScfPerBbl ? oilRate * w.gorScfPerBbl / 1_000_000 : null);
        const activeAlarms = Number(alm?.count ?? 0);
        const criticalAlarms = Number(alm?.critical ?? 0);
        const riskScore = Math.min(100,
          criticalAlarms * 25 + activeAlarms * 5 +
          (w.status === "WORKOVER" ? 20 : 0) +
          (w.status === "SHUT_IN" ? 15 : 0));
        const riskLevel = riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : riskScore >= 25 ? "MODERATE" : "LOW";
        return {
          wellId: w.wellId,
          name: w.name,
          field: w.field,
          status: w.status,
          wellType: w.wellType,
          oilRateBopd: oilRate != null ? Math.round(oilRate) : null,
          gasRateMmscfd: gasRate != null ? Number(gasRate.toFixed(3)) : null,
          waterRateBwpd: waterRate != null ? Math.round(waterRate) : null,
          waterCutPct: w.waterCutFraction != null ? Math.round(w.waterCutFraction * 100) : null,
          gorScfBbl: w.gorScfPerBbl != null ? Math.round(w.gorScfPerBbl) : null,
          fwhpPsia: tel?.tubing_pressure != null ? Math.round(Number(tel.tubing_pressure)) : null,
          bhpPsia: tel?.bhp != null ? Math.round(Number(tel.bhp)) : null,
          espFrequencyHz: tel?.esp_frequency != null ? Number(tel.esp_frequency) : (w.espFrequencyHz ?? null),
          espMotorTempF: tel?.esp_motor_temp != null ? Number(tel.esp_motor_temp) : null,
          activeAlarms,
          criticalAlarms,
          riskScore,
          riskLevel,
          lastTelemetryAt: tel?.recorded_at != null ? new Date(String(tel.recorded_at)) : null,
        };
      });
    } catch {
      return [];
    }
  }),

  // ── Overview KPIs ───────────────────────────────────────────────────────────
  kpis: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [wellStats] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when status = 'ACTIVE' then 1 else 0 end)`,
      workover: sql<number>`sum(case when status = 'WORKOVER' then 1 else 0 end)`,
      shut_in: sql<number>`sum(case when status = 'SHUT_IN' then 1 else 0 end)`,
    }).from(wells);
    const [alarmStats] = await db.select({
      active: sql<number>`count(*)`,
      critical: sql<number>`sum(case when severity = 4 then 1 else 0 end)`,
    }).from(alarms).where(eq(alarms.state, "UNACKNOWLEDGED"));
    const [workoverStats] = await db.select({
      active: sql<number>`count(*)`,
    }).from(workovers).where(eq(workovers.status, "IN_PROGRESS"));
    return {
      totalWells: Number(wellStats?.total ?? 0),
      activeWells: Number(wellStats?.active ?? 0),
      workoverWells: Number(wellStats?.workover ?? 0),
      shutInWells: Number(wellStats?.shut_in ?? 0),
      activeAlarms: Number(alarmStats?.active ?? 0),
      criticalAlarms: Number(alarmStats?.critical ?? 0),
      activeWorkovers: Number(workoverStats?.active ?? 0),
    };
  }),
});
