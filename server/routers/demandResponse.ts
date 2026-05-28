import { TRPCError } from "@trpc/server";
/**
 * server/routers/demandResponse.ts — OpenADR 3.1 Demand Response router
 *
 * v12.2: Fully database-backed (drPrograms, drEvents, drVens tables).
 * All endpoints require authentication. No simulated fallbacks.
 *
 * Use cases:
 * - GCC utility peak-tariff load shedding for compressors/pumps
 * - Automated demand-response event creation from production optimization
 * - VEN (Virtual End Node) registration and reporting
 */
import { z } from "zod";
import { protectedProcedure, router, adminProcedure} from "../_core/trpc";
import { getDb } from "../db";
import { drPrograms, drEvents, drVens } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const VTN_URL = process.env.OPENLEADR_VTN_URL ?? "http://localhost:3001";
const VTN_ENABLED = process.env.OPENLEADR_ENABLED === "true";
const OPENSTEF_URL = process.env.OPENSTEF_URL ?? "http://localhost:8001";

// ─── OpenSTEF helper ──────────────────────────────────────────────────────────
async function openStefFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${OPENSTEF_URL}${path}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── VTN proxy helper ──────────────────────────────────────────────────────────

async function vtnFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  if (!VTN_ENABLED) return null;
  try {
    const res = await fetch(`${VTN_URL}${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}









// ─── Router ────────────────────────────────────────────────────────────────────

export const demandResponseRouter = router({
  // ── Programs ─────────────────────────────────────────────────────────────────
  getPrograms: protectedProcedure
    .input(z.object({ status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional() }).optional())
    .query(async ({ input }) => {
      const vtnPrograms = await vtnFetch<unknown[]>("/programs");
      if (vtnPrograms) return { programs: vtnPrograms, source: "vtn" };

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let rows = await db.select().from(drPrograms).orderBy(desc(drPrograms.createdAt));
      if (input?.status) rows = rows.filter((r) => r.status === input.status);
      return { programs: rows, source: "database" };
    }),

  createProgram: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      programType: z.string().default("DEMAND_RESPONSE"),
      country: z.string().default("US"),
      principalProgram: z.boolean().default(false),
      bindingEvents: z.boolean().default(true),
      localPrice: z.boolean().default(false),
      timezone: z.string().default("UTC"),
      description: z.string().optional(),
      intervalPeriod: z.string().default("PT1H"),
      status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).default("ACTIVE"),
    }))
    .mutation(async ({ input, ctx }) => {
      const programId = `PROG-${Date.now().toString(36).toUpperCase()}`;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.insert(drPrograms).values({
        programId,
        name: input.name,
        programType: input.programType,
        country: input.country,
        principalProgram: input.principalProgram,
        bindingEvents: input.bindingEvents,
        localPrice: input.localPrice,
        timezone: input.timezone,
        description: input.description,
        intervalPeriod: input.intervalPeriod,
        status: input.status,
        createdBy: ctx.user.name ?? ctx.user.email ?? "unknown",
      }).returning();
      return { ...row, source: "database" };
    }),

  updateProgram: protectedProcedure
    .input(z.object({
      programId: z.string(),
      name: z.string().optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional(),
      bindingEvents: z.boolean().optional(),
      localPrice: z.boolean().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { programId, ...updates } = input;
      await db.update(drPrograms)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(drPrograms.programId, programId));
      return { success: true, source: "database" };
    }),

  deleteProgram: adminProcedure
    .input(z.object({ programId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(drPrograms).where(eq(drPrograms.programId, input.programId));
      return { success: true, source: "database" };
    }),

  // ── Events ───────────────────────────────────────────────────────────────────
  getEvents: protectedProcedure
    .input(z.object({
      programId: z.string().optional(),
      status: z.enum(["SCHEDULED", "ACTIVE", "CANCELLED", "COMPLETED"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const vtnEvents = await vtnFetch<unknown[]>("/events");
      if (vtnEvents) return { events: vtnEvents, source: "vtn" };

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let rows = await db.select().from(drEvents).orderBy(desc(drEvents.createdAt));
      if (input?.programId) rows = rows.filter((r) => r.programId === input.programId);
      if (input?.status) rows = rows.filter((r) => r.status === input.status);
      return { events: rows, source: "database" };
    }),

  createEvent: protectedProcedure
    .input(z.object({
      programId: z.string(),
      eventName: z.string().min(1),
      priority: z.number().int().min(0).max(9).default(0),
      startTime: z.string(),
      endTime: z.string(),
      signalType: z.enum(["SIMPLE", "PRICE", "LOAD", "EMERGENCY"]).default("SIMPLE"),
      payloadValue: z.number(),
      payloadUnit: z.string().default("kW"),
      targets: z.array(z.object({ type: z.string(), values: z.array(z.string()) })).optional(),
      intervalPeriod: z.string().default("PT1H"),
      reportRequired: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const eventId = `EVT-${randomUUID().slice(0, 8).toUpperCase()}`;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.insert(drEvents).values({
        eventId,
        programId: input.programId,
        eventName: input.eventName,
        priority: input.priority,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        signalType: input.signalType,
        payloadValue: input.payloadValue,
        payloadUnit: input.payloadUnit,
        targets: input.targets ? JSON.stringify(input.targets) : null,
        intervalPeriod: input.intervalPeriod,
        reportRequired: input.reportRequired,
        createdBy: ctx.user.name ?? ctx.user.email ?? "unknown",
      }).returning();
      return { ...row, source: "database" };
    }),

  updateEventStatus: protectedProcedure
    .input(z.object({
      eventId: z.string(),
      status: z.enum(["SCHEDULED", "ACTIVE", "CANCELLED", "COMPLETED"]),
    }))
     .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(drEvents)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(drEvents.eventId, input.eventId));
      return { success: true, source: "database" };
    }),
  cancelEvent: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(drEvents)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(drEvents.eventId, input.eventId));
      return { status: "cancelled", source: "database" };
    }),

  // ── VENs ─────────────────────────────────────────────────────────────────────
  getVens: protectedProcedure
    .input(z.object({ programId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let rows = await db.select().from(drVens).orderBy(desc(drVens.createdAt));
      if (input?.programId) rows = rows.filter((r) => r.programId === input.programId);
      return { vens: rows, source: "database" };
    }),

  registerVen: protectedProcedure
    .input(z.object({
      venName: z.string().min(1),
      programId: z.string(),
      facilityId: z.string().optional(),
      resourceType: z.string().default("COMPRESSOR"),
      maxLoadKw: z.number().optional(),
      capabilities: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const venId = `VEN-${input.resourceType.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [row] = await db.insert(drVens).values({
        venId,
        venName: input.venName,
        programId: input.programId,
        facilityId: input.facilityId,
        resourceType: input.resourceType,
        maxLoadKw: input.maxLoadKw,
        capabilities: input.capabilities ? JSON.stringify(input.capabilities) : null,
        status: "REGISTERED",
      }).returning();
      return { ...row, source: "database" };
    }),

  // ── VTN status ───────────────────────────────────────────────────────────────
  getStatus: protectedProcedure.query(async () => {
    if (!VTN_ENABLED) return { healthy: false, mode: "disabled", version: "N/A" };
    try {
      const res = await fetch(`${VTN_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return { healthy: res.ok, mode: "vtn", version: "OpenLEADR-rs" };
    } catch {
      return { healthy: false, mode: "unavailable", version: "N/A" };
    }
  }),

  // ── Summary ────────────────────────────────────────────
  getSummary: protectedProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) throw new Error("no db");
      const [programs, events, vens] = await Promise.all([
        db.select().from(drPrograms),
        db.select().from(drEvents),
        db.select().from(drVens),
      ]);
      if (programs.length > 0 || events.length > 0) {
        // Enrich VEN availability with OpenSTEF forecast-derived headroom where available
        let totalAvailableKw = 0;
        for (const ven of vens) {
          if (ven.status === "REGISTERED" && ven.facilityId) {
            const tag = `${ven.facilityId}_DEMAND_KW`;
            const avail = await openStefFetch<{ available_headroom_kw: number; available_for_dr: boolean }>(
              `/availability/${encodeURIComponent(tag)}`
            );
            if (avail?.available_for_dr) {
              totalAvailableKw += avail.available_headroom_kw;
            } else {
              totalAvailableKw += ven.availableKw ?? 0;
            }
          } else {
            totalAvailableKw += ven.availableKw ?? 0;
          }
        }
        return {
          totalPrograms: programs.length,
          activePrograms: programs.filter((p) => p.status === "ACTIVE").length,
          totalEvents: events.length,
          activeEvents: events.filter((e) => e.status === "ACTIVE").length,
          scheduledEvents: events.filter((e) => e.status === "SCHEDULED").length,
          totalVens: vens.length,
          registeredVens: vens.filter((v) => v.status === "REGISTERED").length,
          pendingVens: vens.filter((v) => v.status === "PENDING").length,
          totalAvailableKw: Math.round(totalAvailableKw),
          source: "database",
        };
      }
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }),

  /**
   * getForecastBaseline — returns the OpenSTEF P50 forecast for a facility power
   * tag at a given future time. Used to pre-fill DR event payload values with
   * forecast-derived baseline and recommended curtailment.
   */
  getForecastBaseline: protectedProcedure
    .input(
      z.object({
        tag: z.string().min(1),
        targetTime: z.string().optional(),
        horizonHours: z.number().int().min(1).max(48).default(24),
      })
    )
    .query(async ({ input }) => {
      const { tag, targetTime, horizonHours } = input;
      const forecast = await openStefFetch<{
        forecast: Array<{ timestamp: string; p05: number; p50: number; p95: number }>;
        baseline_kw: number;
        available_headroom_kw: number;
      }>(`/forecast/${encodeURIComponent(tag)}?horizon_hours=${horizonHours}`);
      if (forecast) {
        let baselineKw = forecast.baseline_kw;
        if (targetTime && forecast.forecast.length > 0) {
          const target = new Date(targetTime).getTime();
          const closest = forecast.forecast.reduce((best, pt) => {
            const diff = Math.abs(new Date(pt.timestamp).getTime() - target);
            const bestDiff = Math.abs(new Date(best.timestamp).getTime() - target);
            return diff < bestDiff ? pt : best;
          });
          baselineKw = closest.p50;
        }
        return {
          tag,
          baselineKw: Math.round(baselineKw),
          availableHeadroomKw: Math.round(forecast.available_headroom_kw),
          recommendedCurtailmentKw: Math.round(forecast.available_headroom_kw * 0.8),
          forecastPoints: forecast.forecast.length,
          source: "openstef",
        };
      }
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `OpenSTEF forecast unavailable for tag ${tag}`,
      });
    }),

  /**
   * dispatchDrEvent — activates a DR event and pushes OPC-UA setpoint write-backs
   * to all VENs registered under the event's program.
   *
   * For each registered VEN the procedure:
   *   1. Resolves the facility power demand tag (e.g. FAC-001_DEMAND_KW)
   *   2. Calls the RTDIP /writeback/{tag} endpoint with the curtailment setpoint
   *   3. Updates the event status to ACTIVE in the database
   *   4. Returns a per-VEN dispatch summary
   */
  dispatchDrEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string().min(1),
        dryRun: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const RTDIP_URL = process.env.RTDIP_URL ?? "http://localhost:8000";
      const results: Array<{
        venId: string;
        facilityId: string;
        tag: string;
        setpoint: number;
        status: string;
        message: string;
      }> = [];

      // Load event and its VENs from DB
      let event: { payloadValue: number | null; programId: string; eventId: string } | null = null;
      let vens: Array<{ venId: string; facilityId: string | null; availableKw: number | null }> = [];

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const events = await db.select().from(drEvents).where(eq(drEvents.eventId, input.eventId));
      if (events.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: `Event ${input.eventId} not found` });
      event = events[0];
      vens = await db.select().from(drVens).where(eq(drVens.programId, event.programId));

      const curtailmentKw = event.payloadValue ?? 100;

      // Dispatch setpoint to each registered VEN via OPC-UA write-back
      for (const ven of vens) {
        if (!ven.facilityId) continue;
        const tag = `${ven.facilityId}.DEMAND_SETPOINT_KW`;
        const setpoint = Math.max(0, (ven.availableKw ?? 0) - curtailmentKw);

        if (input.dryRun) {
          results.push({
            venId: ven.venId,
            facilityId: ven.facilityId,
            tag,
            setpoint,
            status: "dry_run",
            message: `[DRY RUN] Would write ${tag} = ${setpoint} kW`,
          });
          continue;
        }

        try {
          const res = await fetch(`${RTDIP_URL}/writeback/${encodeURIComponent(tag)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tag,
              value: setpoint,
              unit: "kW",
              source: "dr_event",
              eventId: input.eventId,
            }),
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json() as { status: string; message: string };
          results.push({
            venId: ven.venId,
            facilityId: ven.facilityId,
            tag,
            setpoint,
            status: data.status,
            message: data.message,
          });
        } catch (err) {
          results.push({
            venId: ven.venId,
            facilityId: ven.facilityId,
            tag,
            setpoint,
            status: "error",
            message: `Write-back failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Update event status to ACTIVE and write audit log entries (skip on dry run)
      if (!input.dryRun) {
        try {
          const db = await getDb();
          if (db) {
            await db.update(drEvents)
              .set({ status: "ACTIVE", updatedAt: new Date() })
              .where(eq(drEvents.eventId, input.eventId));
            // Write one audit log entry per VEN dispatch
            const { drAuditLog } = await import("../../drizzle/schema");
            for (const r of results) {
              await db.insert(drAuditLog).values({
                eventId: input.eventId,
                programId: event?.programId ?? null,
                venId: r.venId,
                tag: r.tag,
                setpointKw: r.setpoint,
                baselineKw: curtailmentKw,
                opcuaStatus: r.status === "applied" ? "SENT" : "FAILED",
                dispatchedAt: new Date(),
                regulatoryRef: "FERC Order 2222 / OpenADR 3.1",
                notes: r.message,
              });
            }
          }
        } catch {
          // non-fatal — dispatch already sent
        }
      }

      const successCount = results.filter((r) => r.status === "applied" || r.status === "dry_run").length;
      return {
        eventId: input.eventId,
        dryRun: input.dryRun,
        dispatched: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
        results,
        dispatchedAt: new Date().toISOString(),
        dispatchedBy: ctx.user.name ?? ctx.user.email ?? "unknown",
      };
    }),

  /**
   * getAuditLog — DR event audit log for regulatory reporting.
   * Returns per-VEN dispatch records with setpoint, baseline, OPC-UA status.
   */
  getAuditLog: protectedProcedure
    .input(
      z.object({
        eventId: z.string().optional(),
        programId: z.string().optional(),
        limit: z.number().int().default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("no db");
        const { drAuditLog } = await import("../../drizzle/schema");
        const { and } = await import("drizzle-orm");
        const conditions = [];
        if (input.eventId) conditions.push(eq(drAuditLog.eventId, input.eventId));
        if (input.programId) conditions.push(eq(drAuditLog.programId, input.programId));
        const query = db.select().from(drAuditLog).orderBy(desc(drAuditLog.dispatchedAt)).limit(input.limit);
        const rows = conditions.length > 0
          ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
          : await query;
        return { entries: rows, source: "database" };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Unknown error" });
      }
    }),

  /** Generate a regulatory compliance report for a date range */
  generateComplianceReport: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        format: z.enum(["json", "csv"]).default("json"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const start = new Date(input.startDate).getTime();
      const end = new Date(input.endDate).getTime();

      type AuditEntry = {
        id: number; eventId: string; programId: string; venId: string; tag: string;
        setpointKw: number; baselineKw: number; actualKw: number | null;
        deviationKw: number | null; curtailmentKw: number; opcuaStatus: string;
        dispatchedAt: string; confirmedAt: string | null;
        regulatoryRef: string | null; notes: string | null;
      };
      let entries: AuditEntry[] = [];

      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { drAuditLog } = await import("../../drizzle/schema");
      const { gte, lte, and: andOp } = await import("drizzle-orm");
      const rows = await db.select().from(drAuditLog)
        .where(andOp(gte(drAuditLog.dispatchedAt, new Date(start)), lte(drAuditLog.dispatchedAt, new Date(end))))
        .orderBy(drAuditLog.dispatchedAt);
      entries = rows.map((r) => ({
        id: r.id, eventId: r.eventId, programId: r.programId ?? "", venId: r.venId ?? "", tag: r.tag ?? "",
        setpointKw: r.setpointKw ?? 0, baselineKw: r.baselineKw ?? 0, actualKw: r.actualKw,
        deviationKw: r.deviationKw, curtailmentKw: r.curtailmentKw ?? 0, opcuaStatus: r.opcuaStatus ?? "",
        dispatchedAt: new Date(r.dispatchedAt).toISOString(),
        confirmedAt: r.confirmedAt ? new Date(r.confirmedAt).toISOString() : null,
        regulatoryRef: r.regulatoryRef, notes: r.notes,
      }));

      const totalEvents = new Set(entries.map((e) => e.eventId)).size;
      const totalDispatches = entries.length;
      const successfulDispatches = entries.filter((e) => e.opcuaStatus === "SENT").length;
      const totalCurtailmentMwh = entries.reduce((s, e) => s + e.curtailmentKw, 0) / 1000;
      const avgDeviation = entries.reduce((s, e) => s + Math.abs(e.deviationKw ?? 0), 0) / Math.max(entries.length, 1);
      const opcuaSuccessRate = (successfulDispatches / Math.max(totalDispatches, 1)) * 100;

      const summary = {
        reportPeriod: { start: input.startDate, end: input.endDate },
        generatedAt: new Date().toISOString(),
        regulatoryFramework: "FERC Order 2222 / OpenADR 3.1 / IEC 62746-10-3",
        totalDrEvents: totalEvents, totalDispatches, successfulDispatches,
        opcuaSuccessRate: +opcuaSuccessRate.toFixed(1),
        totalCurtailmentMwh: +totalCurtailmentMwh.toFixed(3),
        avgBaselineDeviationKw: +avgDeviation.toFixed(2),
        complianceStatus: opcuaSuccessRate >= 95 ? "COMPLIANT" : opcuaSuccessRate >= 80 ? "CONDITIONAL" : "NON-COMPLIANT",
      };

      if (input.format === "csv") {
        const header = ["id","eventId","programId","venId","tag","setpointKw","baselineKw",
          "actualKw","deviationKw","curtailmentKw","opcuaStatus","dispatchedAt","confirmedAt",
          "regulatoryRef","notes"].join(",");
        const csvRows = entries.map((e) =>
          [e.id,e.eventId,e.programId,e.venId,e.tag,e.setpointKw,e.baselineKw,
           e.actualKw??"",e.deviationKw??"",e.curtailmentKw,e.opcuaStatus,
           e.dispatchedAt,e.confirmedAt??"",`"${e.regulatoryRef??""}"`,`"${e.notes??""}"`].join(",")
        );
        return { format: "csv" as const, summary, csv: [header,...csvRows].join("\n"), entries: [] };
      }
      return { format: "json" as const, summary, csv: null, entries };
    }),

  /**
   * generateComplianceReportPDF — FERC/NERC regulatory PDF report.
   * Returns base64-encoded PDF bytes and a suggested filename.
   */
  generateComplianceReportPDF: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const start = new Date(input.startDate).getTime();
      const end = new Date(input.endDate).getTime();
      type AuditEntry = {
        id: number; eventId: string; programId: string; venId: string; tag: string;
        setpointKw: number; baselineKw: number; actualKw: number | null;
        deviationKw: number | null; curtailmentKw: number; opcuaStatus: string;
        dispatchedAt: string; confirmedAt: string | null;
        regulatoryRef: string | null; notes: string | null;
      };
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { drAuditLog } = await import("../../drizzle/schema");
      const { gte, lte, and: andOp } = await import("drizzle-orm");
      const rows = await db.select().from(drAuditLog)
        .where(andOp(gte(drAuditLog.dispatchedAt, new Date(start)), lte(drAuditLog.dispatchedAt, new Date(end))))
        .orderBy(drAuditLog.dispatchedAt);
      const entries: AuditEntry[] = rows.map((r) => ({
        id: r.id, eventId: r.eventId, programId: r.programId ?? "",
        venId: r.venId ?? "", tag: r.tag ?? "",
        setpointKw: r.setpointKw ?? 0, baselineKw: r.baselineKw ?? 0,
        actualKw: r.actualKw, deviationKw: r.deviationKw,
        curtailmentKw: r.curtailmentKw ?? 0, opcuaStatus: r.opcuaStatus ?? "",
        dispatchedAt: new Date(r.dispatchedAt).toISOString(),
        confirmedAt: r.confirmedAt ? new Date(r.confirmedAt).toISOString() : null,
        regulatoryRef: r.regulatoryRef, notes: r.notes,
      }));
      const totalEvents = new Set(entries.map((e) => e.eventId)).size;
      const totalDispatches = entries.length;
      const successfulDispatches = entries.filter((e) => e.opcuaStatus === "SENT").length;
      const totalCurtailmentMwh = entries.reduce((s, e) => s + e.curtailmentKw, 0) / 1000;
      const avgDeviation = entries.reduce((s, e) => s + Math.abs(e.deviationKw ?? 0), 0) / Math.max(entries.length, 1);
      const opcuaSuccessRate = (successfulDispatches / Math.max(totalDispatches, 1)) * 100;
      const complianceStatus = opcuaSuccessRate >= 95 ? "COMPLIANT" : opcuaSuccessRate >= 80 ? "CONDITIONAL" : "NON-COMPLIANT";

      const PDFDocument = (await import("pdfkit")).default;
      const pdfChunks: Buffer[] = [];
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        doc.on("data", (chunk: Buffer) => pdfChunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(pdfChunks).toString("base64")));
        doc.on("error", reject);

        // Header
        doc.fontSize(18).font("Helvetica-Bold").fillColor("#1a2e4a").text("OG RMM Platform", { align: "center" });
        doc.fontSize(13).font("Helvetica").fillColor("#333").text("Demand Response Compliance Report", { align: "center" });
        doc.fontSize(9).fillColor("#666").text("FERC Order 2222 / OpenADR 3.1 / IEC 62746-10-3", { align: "center" });
        doc.moveDown(0.5);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#e0e0e0");
        doc.moveDown(0.5);

        // Metadata
        doc.fontSize(9).fillColor("#333");
        doc.text(`Report Period: ${input.startDate.slice(0, 10)} to ${input.endDate.slice(0, 10)}`);
        doc.text(`Generated At: ${new Date().toISOString()}`);
        doc.text(`Compliance Status: ${complianceStatus}`);
        doc.moveDown(0.8);

        // Summary KPIs
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#111").text("Executive Summary");
        doc.moveDown(0.3);
        const kpis: [string, string][] = [
          ["Total DR Events", String(totalEvents)],
          ["Total Dispatches", String(totalDispatches)],
          ["Successful Dispatches", String(successfulDispatches)],
          ["OPC-UA Success Rate", `${opcuaSuccessRate.toFixed(1)}%`],
          ["Total Curtailment", `${totalCurtailmentMwh.toFixed(3)} MWh`],
          ["Avg Baseline Deviation", `${avgDeviation.toFixed(2)} kW`],
        ];
        doc.fontSize(9).font("Helvetica").fillColor("#333");
        for (const [label, value] of kpis) {
          doc.text(`${label}: `, { continued: true }).font("Helvetica-Bold").text(value);
          doc.font("Helvetica");
        }
        doc.moveDown(0.8);

        // Dispatch records table
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#111").text("Dispatch Records");
        doc.moveDown(0.3);
        const colWidths = [60, 55, 55, 45, 45, 45, 65, 85];
        const colHeaders = ["Event ID", "Program", "VEN ID", "Setpoint", "Baseline", "OPC-UA", "Dispatched", "Reg. Ref"];
        const startX = 40;
        let y = doc.y;
        // Header row
        doc.fontSize(7).font("Helvetica-Bold").fillColor("#fff");
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 14).fill("#2d4a6e");
        let x = startX;
        for (let i = 0; i < colHeaders.length; i++) {
          doc.fillColor("#fff").text(colHeaders[i], x + 2, y + 3, { width: colWidths[i] - 4, lineBreak: false });
          x += colWidths[i];
        }
        y += 14;
        // Data rows
        doc.fontSize(6.5).font("Helvetica");
        for (let ri = 0; ri < Math.min(entries.length, 40); ri++) {
          const e = entries[ri];
          const rowBg = ri % 2 === 0 ? "#f8f9fa" : "#ffffff";
          doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 12).fill(rowBg);
          const cells = [
            e.eventId, e.programId, e.venId,
            `${e.setpointKw} kW`, `${e.baselineKw} kW`, e.opcuaStatus,
            new Date(e.dispatchedAt).toISOString().slice(0, 16),
            (e.regulatoryRef ?? "-").slice(0, 18),
          ];
          x = startX;
          for (let ci = 0; ci < cells.length; ci++) {
            const color = ci === 5 ? (e.opcuaStatus === "SENT" ? "#16a34a" : "#dc2626") : "#333";
            doc.fillColor(color).text(cells[ci], x + 2, y + 2, { width: colWidths[ci] - 4, lineBreak: false });
            x += colWidths[ci];
          }
          y += 12;
          if (y > 760) { doc.addPage(); y = 40; }
        }
        if (entries.length > 40) {
          doc.moveDown(0.5).fontSize(8).fillColor("#666")
            .text(`... and ${entries.length - 40} more records (see CSV export for full dataset)`);
        }
        // Footer
        doc.moveDown(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#e0e0e0");
        doc.moveDown(0.3);
        doc.fontSize(7).fillColor("#999")
          .text("This report was generated by OG RMM Platform v17.0. Confidential — for regulatory submission only.", { align: "center" });
        doc.end();
      });

      return {
        pdfBase64,
        filename: `dr-compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      };
    }),
});