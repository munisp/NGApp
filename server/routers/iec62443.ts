import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { generateIec62443Report } from "../services/iec62443Report";
import { getDb } from "../db";
import { iec62443Controls, iec62443Assessments, type Iec62443Control } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const iec62443Router = router({
  // ── Controls CRUD ──────────────────────────────────────────────────────
  listControls: protectedProcedure
    .input(z.object({
      zone: z.string().optional(),
      status: z.string().optional(),
      category: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(iec62443Controls).orderBy(iec62443Controls.controlId);
      let filtered: Iec62443Control[] = rows;
      if (input?.zone) { const z = input.zone; filtered = filtered.filter((r: Iec62443Control) => r.zone === z); }
      if (input?.status) { const s = input.status; filtered = filtered.filter((r: Iec62443Control) => r.status === s); }
      if (input?.category) { const c = input.category; filtered = filtered.filter((r: Iec62443Control) => r.category === c); }
      if (input?.search) {
        const q = input.search.toLowerCase();
        filtered = filtered.filter((r: Iec62443Control) => r.title.toLowerCase().includes(q) || r.controlId.toLowerCase().includes(q));
      }
      return filtered;
    }),

  getControl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.select().from(iec62443Controls).where(eq(iec62443Controls.id, input.id));
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  createControl: adminProcedure
    .input(z.object({
      controlId: z.string().min(1),
      zone: z.string().min(1),
      category: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      requirement: z.string().optional(),
      status: z.string().default("not_started"),
      assignedTo: z.string().optional(),
      targetDate: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(iec62443Controls).values({
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
      evidenceUrl: z.string().optional(),
      assignedTo: z.string().optional(),
      targetDate: z.date().optional(),
      completedAt: z.date().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(iec62443Controls)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(iec62443Controls.id, id))
        .returning();
      return row;
    }),

  deleteControl: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(iec62443Controls).where(eq(iec62443Controls.id, input.id));
      return { success: true };
    }),

  // ── Assessments ────────────────────────────────────────────────────────
  listAssessments: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(iec62443Assessments).orderBy(desc(iec62443Assessments.assessmentDate));
  }),

  createAssessment: adminProcedure
    .input(z.object({
      assessmentDate: z.date(),
      assessorName: z.string().optional(),
      assessorOrg: z.string().optional(),
      targetSl: z.number().int().min(1).max(4).default(2),
      achievedSl: z.number().int().min(0).max(4).optional(),
      overallScore: z.number().min(0).max(100).optional(),
      findings: z.string().optional(),
      recommendations: z.string().optional(),
      reportUrl: z.string().optional(),
      status: z.string().default("in_progress"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [row] = await db.insert(iec62443Assessments).values({
        ...input,
        createdAt: new Date(),
      }).returning();
      return row;
    }),

  updateAssessment: adminProcedure
    .input(z.object({
      id: z.number(),
      achievedSl: z.number().int().optional(),
      overallScore: z.number().optional(),
      findings: z.string().optional(),
      recommendations: z.string().optional(),
      reportUrl: z.string().optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      const [row] = await db.update(iec62443Assessments)
        .set(data)
        .where(eq(iec62443Assessments.id, id))
        .returning();
      return row;
    }),

  // ── Summary stats ──────────────────────────────────────────────────────
  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, byStatus: {}, byZone: {}, completionPct: 0 };
    const controls = await db.select().from(iec62443Controls);
    const total = controls.length;
    const byStatus: Record<string, number> = {};
    const byZone: Record<string, number> = {};
    for (const c of controls) {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byZone[c.zone] = (byZone[c.zone] || 0) + 1;
    }
    const completed = byStatus["completed"] || 0;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, byStatus, byZone, completionPct };
  }),  // ── Generate PDF gap report ────────────────────────────────────────────────────────────────────────
  generateReport: protectedProcedure
    .input(z.object({
      targetSL: z.number().int().min(1).max(4).default(2),
      organizationName: z.string().optional(),
      preparedBy: z.string().optional(),
    }).optional())
    .mutation(async ({ input }) => {
      return generateIec62443Report({
        targetSL: input?.targetSL ?? 2,
        organizationName: input?.organizationName,
        preparedBy: input?.preparedBy,
      });
    }),

  // ── Seed default IEC 62443 controls ─────────────────────────────────────
  seedDefaultControls: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const defaults = [
      { controlId: "SR-1.1", zone: "SL2", category: "Access Control", title: "Human User Identification and Authentication", requirement: "The control system shall provide the capability to identify and authenticate all human users." },
      { controlId: "SR-1.2", zone: "SL2", category: "Access Control", title: "Software Process and Device Identification and Authentication", requirement: "The control system shall provide the capability to identify and authenticate all software processes and devices." },
      { controlId: "SR-1.3", zone: "SL2", category: "Access Control", title: "Account Management", requirement: "The control system shall provide the capability to manage all accounts by authorized users." },
      { controlId: "SR-2.1", zone: "SL2", category: "Use Control", title: "Authorization Enforcement", requirement: "The control system shall enforce authorizations assigned to all human users." },
      { controlId: "SR-3.1", zone: "SL2", category: "System Integrity", title: "Communication Integrity", requirement: "The control system shall provide the capability to protect the integrity of transmitted information." },
      { controlId: "SR-3.3", zone: "SL2", category: "System Integrity", title: "Security Functionality Verification", requirement: "The control system shall provide the capability to support verification of the intended operation of security functions." },
      { controlId: "SR-4.1", zone: "SL2", category: "Data Confidentiality", title: "Information Confidentiality", requirement: "The control system shall provide the capability to protect the confidentiality of information at rest and in transit." },
      { controlId: "SR-5.1", zone: "SL2", category: "Restricted Data Flow", title: "Network Segmentation", requirement: "The control system shall provide the capability to segment networks to limit the exposure of control system components." },
      { controlId: "SR-6.1", zone: "SL2", category: "Timely Response to Events", title: "Audit Log Accessibility", requirement: "The control system shall provide the capability to read all security audit logs." },
      { controlId: "SR-7.1", zone: "SL2", category: "Resource Availability", title: "Denial of Service Protection", requirement: "The control system shall provide the capability to operate in a degraded mode during a DoS event." },
    ];
    for (const d of defaults) {
      await db.insert(iec62443Controls).values({
        ...d,
        status: "not_started",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
    }
    return { seeded: defaults.length };
  }),
});
