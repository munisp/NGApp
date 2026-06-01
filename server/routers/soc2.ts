import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { soc2AuditEvents, soc2Controls, type Soc2Control } from "../../drizzle/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const soc2Router = router({
  // ── Audit Events ──────────────────────────────────────────────────────
  listAuditEvents: adminProcedure
    .input(z.object({
      userId: z.string().optional(),
      action: z.string().optional(),
      resource: z.string().optional(),
      outcome: z.string().optional(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };
      const conditions = [];
      if (input?.fromDate) conditions.push(gte(soc2AuditEvents.eventTime, input.fromDate));
      if (input?.toDate) conditions.push(lte(soc2AuditEvents.eventTime, input.toDate));
      if (input?.outcome) conditions.push(eq(soc2AuditEvents.outcome, input.outcome));
      const query = db.select().from(soc2AuditEvents)
        .orderBy(desc(soc2AuditEvents.eventTime))
        .limit(input?.limit ?? 100)
        .offset(input?.offset ?? 0);
      if (conditions.length > 0) {
        const events = await query.where(and(...conditions));
        return { events, total: events.length };
      }
      const events = await query;
      return { events, total: events.length };
    }),

  logAuditEvent: protectedProcedure
    .input(z.object({
      action: z.string().min(1),
      resource: z.string().optional(),
      resourceId: z.string().optional(),
      outcome: z.string().default("success"),
      details: z.string().optional(),
      traceId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db.insert(soc2AuditEvents).values({
        ...input,
        userId: ctx.user.openId,
        userEmail: ctx.user.email ?? undefined,
        eventTime: new Date(),
      });
      return { success: true };
    }),

  // ── Controls ──────────────────────────────────────────────────────────
  listControls: protectedProcedure
    .input(z.object({
      trustServiceCriteria: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(soc2Controls).orderBy(soc2Controls.controlRef);
      let filtered: Soc2Control[] = rows;
      if (input?.trustServiceCriteria) { const t = input.trustServiceCriteria; filtered = filtered.filter((r: Soc2Control) => r.trustServiceCriteria === t); }
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: Soc2Control) => r.status === s); }
      return filtered;
    }),

  createControl: adminProcedure
    .input(z.object({
      controlRef: z.string().min(1),
      trustServiceCriteria: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      controlType: z.string().default("preventive"),
      frequency: z.string().default("continuous"),
      owner: z.string().optional(),
      status: z.string().default("in_place"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(soc2Controls).values({
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      return row;
    }),

  updateControl: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.string().optional(),
      lastTestedAt: z.date().optional(),
      testResult: z.string().optional(),
      evidence: z.string().optional(),
      deficiencies: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(soc2Controls)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(soc2Controls.id, id))
        .returning();
      return row;
    }),

  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalControls: 0, byStatus: {}, byCriteria: {}, recentEvents: 0 };
    const controls = await db.select().from(soc2Controls);
    const byStatus: Record<string, number> = {};
    const byCriteria: Record<string, number> = {};
    for (const c of controls) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCriteria[c.trustServiceCriteria] = (byCriteria[c.trustServiceCriteria] || 0) + 1;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await db.select().from(soc2AuditEvents).where(gte(soc2AuditEvents.eventTime, since));
    return {
      totalControls: controls.length,
      byStatus,
      byCriteria,
      recentEvents: recentEvents.length,
    };
  }),

  seedDefaultControls: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const defaults = [
      { controlRef: "CC1.1", trustServiceCriteria: "CC", title: "COSO Principle 1: Demonstrates Commitment to Integrity and Ethical Values", controlType: "preventive", frequency: "continuous" },
      { controlRef: "CC2.1", trustServiceCriteria: "CC", title: "COSO Principle 6: Specifies Suitable Objectives", controlType: "preventive", frequency: "annual" },
      { controlRef: "CC6.1", trustServiceCriteria: "CC", title: "Logical and Physical Access Controls", controlType: "preventive", frequency: "continuous" },
      { controlRef: "CC6.2", trustServiceCriteria: "CC", title: "Access Provisioning and Deprovisioning", controlType: "detective", frequency: "quarterly" },
      { controlRef: "CC7.1", trustServiceCriteria: "CC", title: "System Monitoring", controlType: "detective", frequency: "continuous" },
      { controlRef: "A1.1", trustServiceCriteria: "A", title: "Availability Commitments and System Requirements", controlType: "preventive", frequency: "continuous" },
      { controlRef: "C1.1", trustServiceCriteria: "C", title: "Confidentiality Commitments and System Requirements", controlType: "preventive", frequency: "continuous" },
      { controlRef: "PI1.1", trustServiceCriteria: "PI", title: "Processing Integrity Commitments", controlType: "detective", frequency: "continuous" },
    ];
    for (const d of defaults) {
      await db.insert(soc2Controls).values({
        ...d,
        status: "in_place",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }
    return { seeded: defaults.length };
  }),
});
